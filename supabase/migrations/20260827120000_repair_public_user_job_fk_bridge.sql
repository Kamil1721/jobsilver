BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- jobs.user_id predates profiles and still references public.users. Keep the
-- auth trigger and fallback bootstrap aligned with that canonical FK contract.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, clock_timestamp()))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.created_at, clock_timestamp()),
    clock_timestamp()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (id, email, created_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.created_at, clock_timestamp())
FROM auth.users AS au
WHERE au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Remove stale failure artifacts produced when candidates were found but every
-- job insert failed. Successful searches rebuild this value from returned jobs.
UPDATE public.profiles
SET
  upgrade_teaser = NULL,
  updated_at = clock_timestamp()
WHERE jsonb_typeof(upgrade_teaser) = 'object'
  AND (upgrade_teaser ->> 'shown') ~ '^[0-9]+$'
  AND (upgrade_teaser ->> 'shown')::integer = 0;

REVOKE ALL PRIVILEGES
ON FUNCTION public.handle_new_user()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.handle_new_user()
TO service_role;

REVOKE ALL PRIVILEGES
ON TABLE public.users
FROM anon, authenticated;

GRANT ALL PRIVILEGES
ON TABLE public.users
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
