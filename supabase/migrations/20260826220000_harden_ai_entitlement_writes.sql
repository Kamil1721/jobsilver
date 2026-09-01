BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- CV generation history is an entitlement decision, not editable profile data.
-- Server routes use the service role to claim/finalize the first generation.
REVOKE INSERT (cv_is_generated), UPDATE (cv_is_generated)
ON TABLE public.profiles
FROM authenticated;

COMMENT ON COLUMN public.profiles.cv_is_generated IS
  'Server-managed: whether the included first AI CV generation has been consumed.';

-- Usage counters are also server-managed. Authenticated users retain SELECT on
-- their own rows, but cannot reset counters or call the privileged increment RPC.
DROP POLICY IF EXISTS "Users can insert own ai usage" ON public.user_ai_usage;
DROP POLICY IF EXISTS "Users can update own ai usage" ON public.user_ai_usage;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.user_ai_usage
FROM authenticated;

REVOKE EXECUTE
ON FUNCTION public.increment_ai_usage(uuid, text, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.increment_ai_usage(uuid, text, integer)
TO service_role;

REVOKE EXECUTE
ON FUNCTION public.get_daily_ai_usage(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.get_daily_ai_usage(uuid)
TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
