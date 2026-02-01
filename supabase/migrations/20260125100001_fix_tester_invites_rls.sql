-- Migration: Fix Tester Invites RLS Policy
-- Removes overly permissive policy that allowed anyone to SELECT all tester invites
-- Validation is now handled via the redeem_tester_invite SECURITY DEFINER function

-- ============================================
-- Drop the overly permissive policy
-- ============================================

-- This policy was too permissive - it allowed any anon or authenticated user
-- to read ALL tester invite records, which could lead to information disclosure
DROP POLICY IF EXISTS "Anyone can validate tester invites by code" ON tester_invites;

-- ============================================
-- No replacement policy needed
-- ============================================

-- The redeem_tester_invite function uses SECURITY DEFINER which means it
-- executes with the permissions of the function owner (superuser), bypassing RLS.
-- This is the correct approach because:
-- 1. It prevents direct SELECT access to the tester_invites table
-- 2. The function handles all validation atomically
-- 3. Information disclosure is prevented (function returns generic errors)

-- Users who need to validate invites before signup must use the service client
-- or the API endpoint which uses the service role.

COMMENT ON TABLE tester_invites IS 'Invite codes for testers - access restricted to admins and service role only. Validation happens via redeem_tester_invite function.';
