-- Migration: Security improvements - remove hardcoded admin email from database
-- Date: 2026-01-23
-- Purpose: Admin access should be controlled by is_admin flag only, not hardcoded emails

-- ============================================
-- Update is_admin function to use flag only
-- ============================================

-- The is_admin function should only check the is_admin flag in profiles
-- Admin emails are now managed through the ADMIN_EMAILS environment variable
-- in the application layer, which sets the is_admin flag

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user has is_admin = TRUE in their profile
  -- The application layer handles syncing ADMIN_EMAILS env var with this flag
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Add comment explaining admin access model
-- ============================================

COMMENT ON FUNCTION is_admin() IS
'Checks if current user is an admin by checking the is_admin flag in profiles table.
Admin status is managed through:
1. ADMIN_EMAILS environment variable in application (sets is_admin flag)
2. Direct database updates to is_admin flag by existing admins
Never hardcode admin emails in database functions or migrations.';

-- ============================================
-- Ensure RLS policies use the updated function
-- ============================================

-- The existing policies already reference is_admin() so they will automatically
-- use the updated function definition

-- Add index on is_admin for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- ============================================
-- Add rate limiting tracking table (optional)
-- This can be used for persistent rate limiting with Redis/database
-- ============================================

-- Note: The current implementation uses in-memory rate limiting which is
-- sufficient for single-instance deployments. For multi-instance deployments,
-- consider using Redis or this database table for shared rate limit state.

-- CREATE TABLE IF NOT EXISTS rate_limit_records (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   identifier TEXT NOT NULL,          -- User ID or IP address
--   endpoint TEXT NOT NULL,             -- API endpoint
--   window_start TIMESTAMPTZ NOT NULL,  -- When the window started
--   request_count INTEGER DEFAULT 1,    -- Number of requests in window
--   UNIQUE(identifier, endpoint, window_start)
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_records(identifier, endpoint);
-- CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup ON rate_limit_records(window_start);

-- ============================================
-- Comments and documentation
-- ============================================

COMMENT ON INDEX idx_profiles_is_admin IS 'Partial index for fast admin user lookups';
