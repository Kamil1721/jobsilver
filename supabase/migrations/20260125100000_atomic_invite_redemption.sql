-- Migration: Add Atomic Tester Invite Redemption Function
-- Fixes P0 race condition vulnerability in tester invite redemption
-- Uses row locking (FOR UPDATE) to prevent concurrent redemption attempts

-- ============================================
-- Create atomic invite redemption function
-- ============================================

CREATE OR REPLACE FUNCTION redeem_tester_invite(
  p_invite_code TEXT,
  p_user_id UUID
) RETURNS jsonb AS $$
DECLARE
  v_invite RECORD;
  v_result jsonb;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT * INTO v_invite
  FROM tester_invites
  WHERE invite_code = UPPER(p_invite_code)
  FOR UPDATE;

  -- Check if invite exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- Check if invite is active
  IF NOT v_invite.is_active THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- Check if already used
  IF v_invite.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- Check if expired
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- Atomically mark invite as used
  UPDATE tester_invites
  SET
    used_by = p_user_id,
    used_at = NOW(),
    updated_at = NOW()
  WHERE id = v_invite.id;

  -- Update user profile to grant tester status
  UPDATE profiles
  SET
    is_tester = true,
    tester_invite_code = v_invite.invite_code,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite.id,
    'invite_code', v_invite.invite_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION redeem_tester_invite(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_tester_invite(TEXT, UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION redeem_tester_invite(TEXT, UUID) IS 'Atomically redeems a tester invite code for a user, preventing race conditions with row locking';
