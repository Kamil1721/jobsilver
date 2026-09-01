BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Replace the daily-only signature. Application deployment is migration-first:
-- callers pass both the trusted daily limit and trusted active-job limit.
DROP FUNCTION IF EXISTS public.reserve_daily_job_quota(uuid, integer, integer);

CREATE FUNCTION public.reserve_daily_job_quota(
  p_user_id uuid,
  p_jobs_requested integer,
  p_jobs_limit integer,
  p_active_jobs_limit integer
)
RETURNS TABLE (
  reservation_id uuid,
  quota_date date,
  reserved integer,
  remaining integer,
  jobs_fetched integer,
  job_limit integer,
  active_jobs_count bigint,
  active_jobs_limit integer,
  active_jobs_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_quota public.user_job_quotas%ROWTYPE;
  v_reservation_id uuid;
  v_reserved integer;
  v_daily_remaining bigint;
  v_active_jobs_count bigint;
  v_active_jobs_reserved bigint;
  v_active_remaining bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Job capacity reservation requires a user';
  END IF;

  IF p_jobs_requested IS NULL
     OR p_jobs_requested < 0
     OR p_jobs_requested > 35
     OR p_jobs_limit IS NULL
     OR p_jobs_limit < 0
     OR p_jobs_limit > 35 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Daily job request and limit must be valid values from 0 through 35';
  END IF;

  IF p_active_jobs_limit IS NULL
     OR (p_active_jobs_limit <> -1
       AND (p_active_jobs_limit < 0 OR p_active_jobs_limit > 200)) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Active job limit must be -1 (unlimited) or a value from 0 through 200';
  END IF;

  -- This per-user lock is stable across midnight, unlike date-scoped quota
  -- rows. It serializes reservations that straddle two quota dates.
  PERFORM 1
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Job capacity profile was not found';
  END IF;

  -- INSERT ... ON CONFLICT locks the user's current quota row. Every reserve,
  -- settle, and renew operation takes this lock before touching reservations.
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

  -- Lock every quota row that contributes outstanding active capacity before
  -- touching its reservations. The order remains quota rows, then reservations.
  PERFORM q.id
  FROM public.user_job_quotas AS q
  WHERE q.user_id = p_user_id
    AND (q.id = v_quota.id OR q.jobs_reserved > 0)
  ORDER BY q.date, q.id
  FOR UPDATE;

  -- Recover abandoned reservations across date boundaries. This is required
  -- for a search reserved shortly before midnight and recovered after midnight.
  WITH expired AS (
    UPDATE public.daily_job_quota_reservations AS r
    SET
      jobs_saved = 0,
      settled_at = pg_catalog.clock_timestamp()
    WHERE r.user_id = p_user_id
      AND r.settled_at IS NULL
      AND r.expires_at <= pg_catalog.clock_timestamp()
    RETURNING r.quota_date, r.slots
  ), released AS (
    SELECT expired.quota_date, pg_catalog.sum(expired.slots) AS slots
    FROM expired
    GROUP BY expired.quota_date
    HAVING pg_catalog.sum(expired.slots) > 0
  )
  UPDATE public.user_job_quotas AS q
  SET jobs_reserved = GREATEST(0, q.jobs_reserved - released.slots)
  FROM released
  WHERE q.user_id = p_user_id
    AND q.date = released.quota_date;

  SELECT q.* INTO v_quota
  FROM public.user_job_quotas AS q
  WHERE q.id = v_quota.id
  FOR UPDATE;

  SELECT COALESCE(pg_catalog.sum(q.jobs_reserved), 0)
  INTO v_active_jobs_reserved
  FROM public.user_job_quotas AS q
  WHERE q.user_id = p_user_id;

  SELECT pg_catalog.count(*)
  INTO v_active_jobs_count
  FROM public.jobs AS j
  WHERE j.user_id = p_user_id
    AND j.status = 'discovered';

  v_daily_remaining := GREATEST(
    0,
    v_quota.jobs_limit - v_quota.jobs_fetched - v_quota.jobs_reserved
  );

  IF p_active_jobs_limit = -1 THEN
    v_active_remaining := p_jobs_requested;
  ELSE
    -- Unsettled reservations reduce active capacity as well as daily capacity,
    -- preventing concurrent searches from reserving the same active slots.
    v_active_remaining := GREATEST(
      0,
      p_active_jobs_limit::bigint - v_active_jobs_count - v_active_jobs_reserved
    );
  END IF;

  v_reserved := LEAST(
    p_jobs_requested::bigint,
    v_daily_remaining,
    v_active_remaining
  )::integer;

  IF v_reserved > 0 THEN
    UPDATE public.user_job_quotas AS q
    SET jobs_reserved = q.jobs_reserved + v_reserved
    WHERE q.id = v_quota.id
    RETURNING q.* INTO v_quota;

    v_active_jobs_reserved := v_active_jobs_reserved + v_reserved;
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
    v_quota.jobs_limit,
    v_active_jobs_count,
    p_active_jobs_limit,
    CASE
      WHEN p_active_jobs_limit = -1 THEN -1
      ELSE GREATEST(
        0,
        p_active_jobs_limit::bigint - v_active_jobs_count - v_active_jobs_reserved
      )::integer
    END;
END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer, integer)
TO service_role;

COMMENT ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer, integer) IS
  'Service-only atomic reservation of the minimum daily and active-job capacity using quota-first lock ordering.';

-- Deploy-window compatibility: the still-running app revision calls the 3-arg
-- signature until the new deploy is promoted. Keep a thin wrapper (active-jobs
-- limit -1 = unlimited, matching pre-migration behavior) so job searches don't
-- 500 during the migrate-then-deploy window. Drop it in a follow-up migration.
CREATE FUNCTION public.reserve_daily_job_quota(
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
  job_limit integer,
  active_jobs_count bigint,
  active_jobs_limit integer,
  active_jobs_remaining integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT * FROM public.reserve_daily_job_quota(p_user_id, p_jobs_requested, p_jobs_limit, -1);
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer)
TO service_role;

COMMENT ON FUNCTION public.reserve_daily_job_quota(uuid, integer, integer) IS
  'Deploy-window compatibility wrapper delegating to the 4-arg version with unlimited active-jobs; drop after the migration-first deploy is fully promoted.';

NOTIFY pgrst, 'reload schema';

COMMIT;
