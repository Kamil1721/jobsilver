-- Migration: Add Tester System
-- Creates tester_invites table and adds tester columns to profiles
-- Testers get full Ultra-level access without being admins

-- ============================================
-- Add tester columns to profiles table
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_tester BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tester_invite_code TEXT;

-- Index for efficient tester queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_tester ON profiles (is_tester) WHERE is_tester = true;

-- ============================================
-- Create tester_invites table
-- ============================================

CREATE TABLE IF NOT EXISTS tester_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The unique invite code used in signup URLs
  invite_code TEXT NOT NULL UNIQUE,

  -- Who created this invite (admin)
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Who used this invite (nullable until used)
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- When the invite was used
  used_at TIMESTAMPTZ,

  -- Optional expiry date
  expires_at TIMESTAMPTZ,

  -- Whether the invite is still active (can be revoked by admin)
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up invites by code
CREATE INDEX IF NOT EXISTS idx_tester_invites_code ON tester_invites (invite_code);

-- Index for finding active invites
CREATE INDEX IF NOT EXISTS idx_tester_invites_active ON tester_invites (is_active) WHERE is_active = true;

-- Index for invites by creator
CREATE INDEX IF NOT EXISTS idx_tester_invites_created_by ON tester_invites (created_by);

-- ============================================
-- Enable RLS
-- ============================================

ALTER TABLE tester_invites ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for tester_invites
-- ============================================

-- Admins can view all invites
CREATE POLICY "Admins can view all tester invites"
  ON tester_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can create invites
CREATE POLICY "Admins can create tester invites"
  ON tester_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
    AND created_by = auth.uid()
  );

-- Admins can update invites (revoke, etc.)
CREATE POLICY "Admins can update tester invites"
  ON tester_invites
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can delete invites
CREATE POLICY "Admins can delete tester invites"
  ON tester_invites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role can do anything (for signup process)
CREATE POLICY "Service role has full access to tester invites"
  ON tester_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anyone can SELECT a specific invite by code (for validation during signup)
-- This is intentionally permissive to allow invite validation before user is created
CREATE POLICY "Anyone can validate tester invites by code"
  ON tester_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- Auto-update trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_tester_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tester_invites_updated_at
  BEFORE UPDATE ON tester_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_tester_invites_updated_at();

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON TABLE tester_invites IS 'Invite codes for testers - testers get full Ultra-level feature access';
COMMENT ON COLUMN tester_invites.invite_code IS 'Unique code used in signup URL (e.g., /signup?invite=CODE)';
COMMENT ON COLUMN tester_invites.created_by IS 'Admin who created this invite';
COMMENT ON COLUMN tester_invites.used_by IS 'User who redeemed this invite (null if unused)';
COMMENT ON COLUMN tester_invites.used_at IS 'Timestamp when invite was redeemed';
COMMENT ON COLUMN tester_invites.expires_at IS 'Optional expiry date - invite invalid after this time';
COMMENT ON COLUMN tester_invites.is_active IS 'Whether invite is active - can be set to false to revoke';

COMMENT ON COLUMN profiles.is_tester IS 'Whether user is a tester with Ultra-level access';
COMMENT ON COLUMN profiles.tester_invite_code IS 'The invite code this tester used to sign up';
