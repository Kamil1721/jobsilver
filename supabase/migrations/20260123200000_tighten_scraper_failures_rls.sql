-- Migration: Tighten RLS policies on scraper_failures table
-- Date: 2026-01-23
-- Issue: Insert/update policies allowed any authenticated user to write to any row
-- Fix: Restrict insert to only the user's own records

-- ============================================
-- Drop existing overly permissive policies
-- ============================================

DROP POLICY IF EXISTS "Service can insert scraper failures" ON scraper_failures;
DROP POLICY IF EXISTS "Service can update scraper failures" ON scraper_failures;

-- ============================================
-- Create proper RLS policies
-- ============================================

-- Users can only insert failures for themselves (internal API calls)
-- The service role bypasses RLS so backend operations still work
CREATE POLICY "Users can insert own scraper failures" ON scraper_failures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users cannot update scraper failures directly
-- Updates are done via service role (admin operations) which bypasses RLS
-- This policy allows admins (via is_admin function) to update any record
CREATE POLICY "Admins can update scraper failures" ON scraper_failures
  FOR UPDATE USING (is_admin());

-- ============================================
-- Comments
-- ============================================

COMMENT ON POLICY "Users can insert own scraper failures" ON scraper_failures
  IS 'Users can only insert scraper failures for their own jobs';
COMMENT ON POLICY "Admins can update scraper failures" ON scraper_failures
  IS 'Only admins can update/review scraper failures';
