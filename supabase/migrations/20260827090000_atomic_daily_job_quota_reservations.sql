BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.user_job_quotas
  ADD COLUMN IF NOT EXISTS jobs_reserved bigint NOT NULL DEFAULT 0;

ALTER TABLE public.user_job_quotas
  DROP CONSTRAINT IF EXISTS user_job_quotas_jobs_reserved_check;

ALTER TABLE public.user_job_quotas
  ADD CONSTRAINT user_job_quotas_jobs_reserved_check
  CHECK (jobs_reserved >= 0) NOT VALID;

CREATE TABLE IF NOT EXISTS public.daily_job_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date date NOT NULL,
  slots bigint NOT NULL CHECK (slots >= 0),
  jobs_saved bigint CHECK (jobs_saved >= 0 AND jobs_saved <= slots),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  settled_at timestamp with time zone
);

ALTER TABLE public.daily_job_quota_reservations ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.reserve_daily_job_quota(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.settle_daily_job_quota(uuid, date, integer, integer);

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
BEGIN
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

  SELECT q.* INTO v_quota
  FROM public.user_job_quotas AS q
  WHERE q.user_id = p_user_id
    AND q.date = v_reservation.quota_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily job quota row was not found';
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

COMMENT ON COLUMN public.user_job_quotas.jobs_reserved IS
  'In-flight job slots reserved by active searches; settled slots become jobs_fetched.';

COMMENT ON TABLE public.daily_job_quota_reservations IS
  'Idempotency ledger for daily job quota reservations and settlements.';

COMMENT ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer) IS
  'Atomically reserves daily job slots while enforcing the caller-supplied server plan limit.';

COMMENT ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer) IS
  'Atomically converts saved reservation slots to jobs_fetched and releases unused slots.';

DROP POLICY IF EXISTS "Users can insert own quotas" ON public.user_job_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON public.user_job_quotas;

REVOKE ALL PRIVILEGES
ON TABLE public.user_job_quotas
FROM anon, authenticated;

GRANT SELECT
ON TABLE public.user_job_quotas
TO authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.daily_job_quota_reservations
FROM PUBLIC, anon, authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.daily_job_quota_reservations
TO service_role;

REVOKE ALL PRIVILEGES
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
TO service_role;

GRANT EXECUTE
ON FUNCTION public.settle_daily_job_quota(uuid, uuid, integer)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
