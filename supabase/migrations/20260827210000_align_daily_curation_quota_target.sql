BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The caller resolves billing/tester entitlements and passes the resulting
-- daily target as p_jobs_needed: free=3, pro=15, Ultra/tester=35.
CREATE OR REPLACE FUNCTION public.check_and_reserve_daily_quota(
  p_user_id uuid,
  p_jobs_needed integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_existing_count bigint;
  v_max_daily_target constant integer := 35;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Daily quota calculation requires a user';
  END IF;

  IF p_jobs_needed IS NULL
     OR p_jobs_needed < 0
     OR p_jobs_needed > v_max_daily_target THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Daily job target must be between 0 and 35';
  END IF;

  -- Serialize quota snapshots for this user and fail closed when the profile
  -- is missing instead of returning capacity for an unknown user.
  PERFORM 1
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Daily quota profile was not found';
  END IF;

  SELECT pg_catalog.count(*)
  INTO v_existing_count
  FROM public.jobs AS j
  WHERE j.user_id = p_user_id
    AND j.created_at >= CURRENT_DATE
    AND j.status IN ('discovered', 'saved');

  IF v_existing_count >= p_jobs_needed THEN
    RETURN 0;
  END IF;

  -- The guarded branch above makes this bigint-to-integer cast safe because
  -- both operands are now within the validated 0..35 target range.
  RETURN p_jobs_needed - v_existing_count::integer;
END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.check_and_reserve_daily_quota(uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.check_and_reserve_daily_quota(uuid, integer)
TO service_role;

COMMENT ON FUNCTION public.check_and_reserve_daily_quota(uuid, integer) IS
  'Service-only daily curation capacity check using a caller-validated plan target from 0 through 35.';

NOTIFY pgrst, 'reload schema';

COMMIT;
