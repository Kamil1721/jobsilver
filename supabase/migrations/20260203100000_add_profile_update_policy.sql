-- Migration: Add missing RLS policy for users to update their own profile
-- Date: 2026-02-03
-- Fixes: "Failed to update notification settings" error

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Also ensure users can read their own profile (may already exist)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
