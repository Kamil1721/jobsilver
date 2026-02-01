-- Add auto_apply_mode column to profiles table
-- This controls how the system handles job applications:
-- - 'full_auto': System automatically submits applications, jobs go directly to "applied"
-- - 'assisted': System fills out forms, jobs go to "ready_to_apply", user reviews and confirms
-- - 'manual': No automatic filling, user does everything manually

-- Create the enum type for auto_apply_mode
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auto_apply_mode_type') THEN
    CREATE TYPE auto_apply_mode_type AS ENUM ('full_auto', 'assisted', 'manual');
  END IF;
END$$;

-- Add the column with default 'assisted' (safer for new users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auto_apply_mode auto_apply_mode_type DEFAULT 'assisted';

-- Add a comment for documentation
COMMENT ON COLUMN profiles.auto_apply_mode IS 'Controls auto-apply behavior: full_auto (submit automatically), assisted (fill forms, user confirms), manual (no automation)';

-- Add an index for efficient queries on auto_apply_mode
CREATE INDEX IF NOT EXISTS idx_profiles_auto_apply_mode ON profiles(auto_apply_mode);

-- Add 'form_filled' status to jobs for assisted mode
-- This tracks jobs where forms have been filled but not yet submitted
-- Note: We use a TEXT column for status, so we just need to document the new value
COMMENT ON COLUMN jobs.auto_apply_status IS 'Auto-apply status: not_started, not_available, manual, scraping, ready_to_apply, form_filled, submitting, applied, failed, login_required, scrape_failed';
