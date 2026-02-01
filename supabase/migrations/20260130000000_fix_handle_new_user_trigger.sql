-- Fix handle_new_user trigger to also insert into public.users table
-- The jobs table has a foreign key to public.users, so we need to create users there too
-- Previously, only profiles was populated, causing foreign key violations when creating jobs

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Insert into public.users (required for jobs foreign key)
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Insert into public.profiles
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill any existing users who are missing from public.users
INSERT INTO public.users (id, email, created_at)
SELECT au.id, au.email, au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;
