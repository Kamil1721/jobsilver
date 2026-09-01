BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Authorization is flag-based. A user-controlled email must never grant admin.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_admin IS TRUE
  );
$function$;

-- RLS limits rows; column privileges keep user-owned rows from becoming a
-- privilege-escalation path. service_role intentionally keeps its broad grant.
REVOKE ALL PRIVILEGES
ON TABLE public.profiles
FROM anon, authenticated;

GRANT SELECT
ON TABLE public.profiles
TO authenticated;

GRANT INSERT (
  id,
  full_name,
  email,
  phone,
  location,
  cv_url,
  cv_parsed_data,
  job_filters,
  updated_at,
  screening_answers,
  generated_queries,
  queries_profile_hash,
  queries_generated_at,
  production_mode,
  cv_is_generated,
  upgrade_teaser,
  email_notifications,
  notification_preferences
)
ON TABLE public.profiles
TO authenticated;

GRANT UPDATE (
  id,
  full_name,
  email,
  phone,
  location,
  cv_url,
  cv_parsed_data,
  job_filters,
  updated_at,
  screening_answers,
  generated_queries,
  queries_profile_hash,
  queries_generated_at,
  production_mode,
  cv_is_generated,
  upgrade_teaser,
  email_notifications,
  notification_preferences
)
ON TABLE public.profiles
TO authenticated;

-- This SECURITY DEFINER RPC accepts a user id. Only trusted server code may
-- call it; the server already redeems invites with the service-role client.
REVOKE ALL PRIVILEGES
ON FUNCTION public.redeem_tester_invite(text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.redeem_tester_invite(text, uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
