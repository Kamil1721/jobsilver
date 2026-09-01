-- Migration: signup fails with 23505 when an orphaned public.users row holds the email
--
-- ROOT CAUSE: public.users has UNIQUE (email). The old account-deletion route silently
-- swallowed child-table delete failures (fixed in app code 2026-09-01), leaving
-- public.users rows behind after their auth.users row was removed. A new signup with the
-- same email gets a NEW id, so handle_new_user's ON CONFLICT (id) DO NOTHING does not
-- apply — the email unique constraint aborts the whole GoTrue transaction and the user
-- sees a generic authentication error. Reproduced 2026-09-01 with a blocked address
-- (SQLSTATE 23505 on auth.users insert).
--
-- FIX (two parts):
--   1. Data repair: remove existing orphaned public.users rows (no auth.users backing).
--      All current orphans have zero dependent jobs rows; jobs FK is ON DELETE CASCADE.
--   2. Harden handle_new_user: before inserting, clear any ORPHANED same-email row so a
--      stale orphan can never block a signup again. Rows still backed by auth.users are
--      never touched.
--
-- LOCK BEHAVIOR: plain DML + CREATE OR REPLACE FUNCTION — brief locks only, safe live.
-- ROLLBACK: restore previous handle_new_user (no orphan-clear); deleted orphans are
-- unrecoverable but were already unreachable data.

BEGIN;

-- 1. Data repair
DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id);

DELETE FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

-- 2. Self-healing trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Clear orphaned rows holding this email (their auth user no longer exists);
  -- without this, users_email_key aborts the signup with 23505.
  DELETE FROM public.users u
  WHERE u.email = NEW.email
    AND u.id <> NEW.id
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id);

  DELETE FROM public.profiles p
  WHERE p.email = NEW.email
    AND p.id <> NEW.id
    AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id);

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

COMMIT;
