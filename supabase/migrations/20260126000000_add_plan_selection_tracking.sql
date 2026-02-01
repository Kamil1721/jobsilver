-- Migration: Add plan selection tracking
-- Track if user has explicitly selected a plan during onboarding

-- Add has_selected_plan column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_selected_plan BOOLEAN DEFAULT FALSE;

-- Mark existing users who should bypass plan selection:
-- - Users with non-free subscription (they chose a plan via Stripe)
-- - Users who are testers (granted via /tester page)
-- - Users who have job_filters (completed setup, implies they selected a plan before this feature)
UPDATE profiles SET has_selected_plan = TRUE
WHERE subscription_plan != 'free'
   OR is_tester = TRUE
   OR (job_filters IS NOT NULL AND job_filters != '{}'::jsonb);

-- Create index for efficient middleware lookups
CREATE INDEX IF NOT EXISTS idx_profiles_has_selected_plan ON profiles(has_selected_plan);

-- Comment on column
COMMENT ON COLUMN profiles.has_selected_plan IS 'Whether user has explicitly selected a plan during onboarding (free or paid)';
