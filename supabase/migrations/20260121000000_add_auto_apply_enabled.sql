-- Add auto_apply_enabled field to profiles table
-- This controls whether the system automatically applies to jobs on behalf of the user

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_apply_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.auto_apply_enabled IS 'When true, system automatically fills and submits job applications for the user';
