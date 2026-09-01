BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.redeem_tester_invite(
  p_invite_code text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_invite public.tester_invites%ROWTYPE;
  v_profile_rows integer;
  v_invite_rows integer;
BEGIN
  -- Serialize redemption by user before locking an invite. This prevents two
  -- different invites from being consumed concurrently by the same user.
  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- A tester has already reached the desired state. Do not inspect, consume,
  -- or rewrite a newly supplied invite code on retries.
  IF v_profile.is_tester IS TRUE THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'invite_code', v_profile.tester_invite_code
    );
  END IF;

  SELECT i.*
  INTO v_invite
  FROM public.tester_invites AS i
  WHERE i.invite_code = pg_catalog.upper(p_invite_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  -- A retry by the user who already owns the invite is successful. If legacy
  -- data contains the invite assignment without the profile grant, repair the
  -- profile while retaining the original invite usage timestamps.
  IF v_invite.used_by = p_user_id THEN
    UPDATE public.profiles AS p
    SET is_tester = true,
        tester_invite_code = v_invite.invite_code,
        has_selected_plan = true,
        subscription_plan = 'pro',
        updated_at = pg_catalog.clock_timestamp()
    WHERE p.id = p_user_id
    RETURNING p.* INTO v_profile;

    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;

    IF v_profile_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Tester invite redemption invariant violated';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'invite_id', v_invite.id,
      'invite_code', v_invite.invite_code
    );
  END IF;

  IF v_invite.used_by IS NOT NULL
     OR v_invite.is_active IS NOT TRUE
     OR (
       v_invite.expires_at IS NOT NULL
       AND v_invite.expires_at <= pg_catalog.clock_timestamp()
     ) THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

  UPDATE public.tester_invites AS i
  SET used_by = p_user_id,
      used_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  WHERE i.id = v_invite.id
    AND i.used_by IS NULL
  RETURNING i.* INTO v_invite;

  GET DIAGNOSTICS v_invite_rows = ROW_COUNT;

  IF v_invite_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Tester invite redemption invariant violated';
  END IF;

  UPDATE public.profiles AS p
  SET is_tester = true,
      tester_invite_code = v_invite.invite_code,
      has_selected_plan = true,
      subscription_plan = 'pro',
      updated_at = pg_catalog.clock_timestamp()
  WHERE p.id = p_user_id
  RETURNING p.* INTO v_profile;

  GET DIAGNOSTICS v_profile_rows = ROW_COUNT;

  IF v_profile_rows <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Tester invite redemption invariant violated';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'invite_id', v_invite.id,
    'invite_code', v_invite.invite_code
  );
END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.redeem_tester_invite(text, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.redeem_tester_invite(text, uuid)
TO service_role;

COMMENT ON FUNCTION public.redeem_tester_invite(text, uuid) IS
  'Atomically and idempotently grants tester access while serializing redemptions by profile and invite.';

NOTIFY pgrst, 'reload schema';

COMMIT;
