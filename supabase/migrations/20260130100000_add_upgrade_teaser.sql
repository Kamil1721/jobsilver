-- Add upgrade_teaser column to profiles table
-- Stores information about additional jobs available with premium plans
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS upgrade_teaser jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.upgrade_teaser IS 'JSON object storing info about hidden jobs for free users: {hidden_jobs_count, message, total_found, shown}';
