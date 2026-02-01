-- Migration: Fix overly permissive RLS policies on admin tables
-- Date: 2026-01-21
-- Issue: api_usage and api_request_log had USING(true) allowing any authenticated user access

-- ============================================
-- Drop existing overly permissive policies
-- ============================================

DROP POLICY IF EXISTS "Service can manage api_usage" ON api_usage;
DROP POLICY IF EXISTS "Service can manage api_request_log" ON api_request_log;

-- ============================================
-- Create proper RLS policies for api_usage
-- ============================================

-- Allow admins to read api_usage
CREATE POLICY "Admins can read api_usage" ON api_usage
  FOR SELECT USING (is_admin());

-- Service role (used by backend) can insert/update
-- This relies on service_role bypassing RLS
-- No explicit policy needed as service role bypasses RLS

-- ============================================
-- Create proper RLS policies for api_request_log
-- ============================================

-- Allow admins to read api_request_log
CREATE POLICY "Admins can read api_request_log" ON api_request_log
  FOR SELECT USING (is_admin());

-- Users can see their own request logs (if they triggered it)
CREATE POLICY "Users can read own api_request_log" ON api_request_log
  FOR SELECT USING (auth.uid() = triggered_by_user_id);

-- ============================================
-- Comments
-- ============================================

COMMENT ON POLICY "Admins can read api_usage" ON api_usage IS 'Only admin users can view API usage statistics';
COMMENT ON POLICY "Admins can read api_request_log" ON api_request_log IS 'Only admin users can view detailed request logs';
COMMENT ON POLICY "Users can read own api_request_log" ON api_request_log IS 'Users can see requests they triggered';
