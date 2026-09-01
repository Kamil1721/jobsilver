BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Profile email is a display cache. Only trusted server paths may copy the
-- verified address from auth.users into it.
REVOKE INSERT (email), UPDATE (email)
ON TABLE public.profiles
FROM anon, authenticated;

ALTER TABLE public.daily_job_quota_reservations
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

UPDATE public.daily_job_quota_reservations
SET expires_at = created_at + interval '30 minutes'
WHERE expires_at IS NULL;

ALTER TABLE public.daily_job_quota_reservations
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 minutes');

ALTER TABLE public.daily_job_quota_reservations
  DROP CONSTRAINT IF EXISTS daily_job_quota_reservations_expires_at_check;

ALTER TABLE public.daily_job_quota_reservations
  ADD CONSTRAINT daily_job_quota_reservations_expires_at_check
  CHECK (expires_at IS NOT NULL) NOT VALID;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key text PRIMARY KEY,
  request_count bigint NOT NULL,
  reset_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_limits_key_length CHECK (length(key) BETWEEN 1 AND 300),
  CONSTRAINT api_rate_limits_request_count_check CHECK (request_count >= 0)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamp with time zone := clock_timestamp();
  v_rate_limit public.api_rate_limits%ROWTYPE;
BEGIN
  IF length(p_key) NOT BETWEEN 1 AND 300
    OR p_max_requests <= 0
    OR p_window_seconds <= 0
  THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  INSERT INTO public.api_rate_limits AS rl (
    key,
    request_count,
    reset_at,
    updated_at
  )
  VALUES (
    p_key,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  ON CONFLICT (key) DO UPDATE
  SET
    request_count = CASE
      WHEN rl.reset_at <= v_now THEN 1
      ELSE rl.request_count + 1
    END,
    reset_at = CASE
      WHEN rl.reset_at <= v_now
        THEN v_now + make_interval(secs => p_window_seconds)
      ELSE rl.reset_at
    END,
    updated_at = v_now
  RETURNING * INTO v_rate_limit;

  RETURN jsonb_build_object(
    'allowed', v_rate_limit.request_count <= p_max_requests,
    'count', v_rate_limit.request_count,
    'reset_at', v_rate_limit.reset_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_daily_job_quota(
  p_user_id uuid,
  p_jobs_requested integer,
  p_jobs_limit integer
)
RETURNS TABLE (
  reservation_id uuid,
  quota_date date,
  reserved integer,
  remaining integer,
  jobs_fetched integer,
  job_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_quota public.user_job_quotas%ROWTYPE;
  v_reservation_id uuid;
  v_reserved integer;
  v_released bigint;
BEGIN
  IF p_jobs_requested < 0 OR p_jobs_limit < 0 THEN
    RAISE EXCEPTION 'Quota request and limit must be non-negative';
  END IF;

  INSERT INTO public.user_job_quotas (
    user_id,
    date,
    jobs_fetched,
    jobs_limit,
    jobs_reserved
  )
  VALUES (
    p_user_id,
    CURRENT_DATE,
    0,
    p_jobs_limit,
    0
  )
  ON CONFLICT (user_id, date) DO UPDATE
  SET jobs_limit = EXCLUDED.jobs_limit
  RETURNING * INTO v_quota;

  WITH expired AS (
    UPDATE public.daily_job_quota_reservations AS r
    SET
      jobs_saved = 0,
      settled_at = clock_timestamp()
    WHERE r.user_id = p_user_id
      AND r.quota_date = v_quota.date
      AND r.settled_at IS NULL
      AND r.expires_at <= clock_timestamp()
    RETURNING r.slots
  )
  SELECT COALESCE(SUM(expired.slots), 0)
  INTO v_released
  FROM expired;

  IF v_released > 0 THEN
    UPDATE public.user_job_quotas AS q
    SET jobs_reserved = GREATEST(0, q.jobs_reserved - v_released)
    WHERE q.id = v_quota.id
    RETURNING q.* INTO v_quota;
  END IF;

  v_reserved := LEAST(
    p_jobs_requested,
    GREATEST(0, v_quota.jobs_limit - v_quota.jobs_fetched - v_quota.jobs_reserved)
  )::integer;

  IF v_reserved > 0 THEN
    UPDATE public.user_job_quotas AS q
    SET jobs_reserved = q.jobs_reserved + v_reserved
    WHERE q.id = v_quota.id
    RETURNING q.* INTO v_quota;
  END IF;

  INSERT INTO public.daily_job_quota_reservations (
    user_id,
    quota_date,
    slots
  )
  VALUES (
    p_user_id,
    v_quota.date,
    v_reserved
  )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY
  SELECT
    v_reservation_id,
    v_quota.date,
    v_reserved,
    GREATEST(0, v_quota.jobs_limit - v_quota.jobs_fetched - v_quota.jobs_reserved)::integer,
    v_quota.jobs_fetched,
    v_quota.jobs_limit;
END;
$function$;

-- Keep the lock order consistent with reserve_daily_job_quota: quota row,
-- then reservation row. This avoids a reserve/recovery racing a settlement
-- with the opposite lock order.
CREATE OR REPLACE FUNCTION public.settle_daily_job_quota(
  p_reservation_id uuid,
  p_user_id uuid,
  p_jobs_saved integer
)
RETURNS TABLE (
  remaining integer,
  jobs_fetched integer,
  job_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_quota public.user_job_quotas%ROWTYPE;
  v_reservation public.daily_job_quota_reservations%ROWTYPE;
  v_quota_date date;
BEGIN
  SELECT r.quota_date INTO v_quota_date
  FROM public.daily_job_quota_reservations AS r
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota reservation was not found';
  END IF;

  SELECT q.* INTO v_quota
  FROM public.user_job_quotas AS q
  WHERE q.user_id = p_user_id
    AND q.date = v_quota_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota row was not found';
  END IF;

  SELECT r.* INTO v_reservation
  FROM public.daily_job_quota_reservations AS r
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota reservation was not found';
  END IF;

  IF p_jobs_saved < 0 OR p_jobs_saved > v_reservation.slots THEN
    RAISE EXCEPTION 'Invalid daily job quota settlement';
  END IF;

  IF v_reservation.settled_at IS NOT NULL THEN
    IF v_reservation.jobs_saved <> p_jobs_saved THEN
      RAISE EXCEPTION 'Daily job quota reservation was already settled with a different saved count';
    END IF;

    RETURN QUERY
    SELECT
      GREATEST(0, v_quota.jobs_limit - v_quota.jobs_fetched - v_quota.jobs_reserved)::integer,
      v_quota.jobs_fetched,
      v_quota.jobs_limit;
    RETURN;
  END IF;

  UPDATE public.user_job_quotas AS q
  SET
    jobs_reserved = q.jobs_reserved - v_reservation.slots,
    jobs_fetched = q.jobs_fetched + p_jobs_saved
  WHERE q.id = v_quota.id
    AND q.jobs_reserved >= v_reservation.slots
    AND q.jobs_fetched + p_jobs_saved <= q.jobs_limit
  RETURNING q.* INTO v_quota;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota settlement could not be applied';
  END IF;

  UPDATE public.daily_job_quota_reservations AS r
  SET
    jobs_saved = p_jobs_saved,
    settled_at = clock_timestamp()
  WHERE r.id = v_reservation.id;

  RETURN QUERY
  SELECT
    GREATEST(0, v_quota.jobs_limit - v_quota.jobs_fetched - v_quota.jobs_reserved)::integer,
    v_quota.jobs_fetched,
    v_quota.jobs_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.renew_daily_job_quota_reservation(
  p_reservation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_quota_id uuid;
  v_quota_date date;
  v_settled_at timestamp with time zone;
BEGIN
  SELECT r.quota_date INTO v_quota_date
  FROM public.daily_job_quota_reservations AS r
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota reservation was not found';
  END IF;

  SELECT q.id INTO v_quota_id
  FROM public.user_job_quotas AS q
  WHERE q.user_id = p_user_id
    AND q.date = v_quota_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota row was not found';
  END IF;

  SELECT r.settled_at INTO v_settled_at
  FROM public.daily_job_quota_reservations AS r
  WHERE r.id = p_reservation_id
    AND r.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota reservation was not found';
  END IF;

  IF v_settled_at IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.daily_job_quota_reservations AS r
  SET expires_at = clock_timestamp() + interval '30 minutes'
  WHERE r.id = p_reservation_id;

  RETURN true;
END;
$function$;

COMMENT ON COLUMN public.daily_job_quota_reservations.expires_at IS
  'Abandoned reservations become recoverable after 30 minutes.';

COMMENT ON FUNCTION public.check_rate_limit(text, integer, integer) IS
  'Atomic fixed-window rate limiter for trusted server endpoints.';

COMMENT ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer) IS
  'Atomically recovers expired reservations and reserves daily job capacity.';

COMMENT ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer) IS
  'Idempotently settles one reservation using a quota-first lock order.';

COMMENT ON FUNCTION public.renew_daily_job_quota_reservation(uuid, uuid) IS
  'Renews an active reservation immediately before durable job inserts.';

REVOKE ALL PRIVILEGES
ON TABLE public.api_rate_limits
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.check_rate_limit(text, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.check_rate_limit(text, integer, integer)
TO service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
TO service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer)
TO service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.renew_daily_job_quota_reservation(uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.renew_daily_job_quota_reservation(uuid, uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
