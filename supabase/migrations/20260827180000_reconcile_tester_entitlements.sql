BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Keep billing entitlement derivation in one service-only function so tester
-- reconciliation and Stripe webhook reconciliation cannot drift. For a
-- past-due subscription, access lasts only until the earlier applicable trial
-- or paid-period boundary; a missing or elapsed boundary grants no access.
-- Stripe's paused state stops billing after a trial ends without a payment
-- method, so it remains valid ledger state but never grants product access.
CREATE OR REPLACE FUNCTION public.stripe_entitled_plan(
  p_status text,
  p_plan text,
  p_current_period_end timestamptz,
  p_trial_end timestamptz,
  p_as_of timestamptz DEFAULT pg_catalog.clock_timestamp()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN p_status = ANY (ARRAY['active', 'trialing']::text[])
      OR (
        p_status = 'past_due'
        AND CASE
          WHEN p_trial_end IS NOT NULL
               AND (
                 p_current_period_end IS NULL
                 OR p_trial_end <= p_current_period_end
               )
            THEN p_trial_end
          ELSE p_current_period_end
        END > p_as_of
      )
    THEN CASE p_plan
      WHEN 'pro' THEN 'pro'
      WHEN 'ultra' THEN 'ultra'
      WHEN 'mega' THEN 'ultra'
      ELSE 'free'
    END
    ELSE 'free'
  END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.stripe_entitled_plan(text, text, timestamptz, timestamptz, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.stripe_entitled_plan(text, text, timestamptz, timestamptz, timestamptz)
TO service_role;

COMMENT ON FUNCTION public.stripe_entitled_plan(text, text, timestamptz, timestamptz, timestamptz) IS
  'Service-only canonical Stripe billing entitlement derivation, including expiry-aware past-due access and paused-state revocation.';

-- Tester access is an independent entitlement. The stored subscription plan
-- must continue to reflect billing truth so revoking tester access cannot
-- leave invite-granted paid access behind or overwrite a paid Ultra plan.
CREATE OR REPLACE FUNCTION public.set_tester_status(
  p_user_id uuid,
  p_is_tester boolean,
  p_invite_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_entitled_plan text := 'free';
BEGIN
  IF p_user_id IS NULL OR p_is_tester IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Tester status requires a user and explicit status';
  END IF;

  IF p_is_tester IS FALSE THEN
    -- Lock billing state before profile state. This keeps reconciliation
    -- deterministic if a webhook is updating the same subscription.
    SELECT s.*
    INTO v_subscription
    FROM public.subscriptions AS s
    WHERE s.user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
      v_entitled_plan := public.stripe_entitled_plan(
        v_subscription.status,
        v_subscription.plan,
        v_subscription.current_period_end,
        v_subscription.trial_end,
        pg_catalog.clock_timestamp()
      );
    END IF;
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Tester profile was not found';
  END IF;

  IF p_is_tester IS TRUE THEN
    -- A duplicate grant is a true no-op: preserve the original invite
    -- provenance and timestamp instead of rewriting them as ADMIN_GRANTED.
    IF v_profile.is_tester IS NOT TRUE THEN
      UPDATE public.profiles AS p
      SET is_tester = true,
          tester_invite_code = COALESCE(
            NULLIF(pg_catalog.btrim(p_invite_code), ''),
            'ADMIN_GRANTED'
          ),
          has_selected_plan = true,
          updated_at = pg_catalog.clock_timestamp()
      WHERE p.id = p_user_id
      RETURNING p.* INTO v_profile;
    END IF;
  ELSE
    UPDATE public.profiles AS p
    SET is_tester = false,
        tester_invite_code = NULL,
        subscription_plan = v_entitled_plan,
        subscription_started_at = CASE
          WHEN v_entitled_plan = 'free' THEN NULL
          ELSE p.subscription_started_at
        END,
        updated_at = pg_catalog.clock_timestamp()
    WHERE p.id = p_user_id
    RETURNING p.* INTO v_profile;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'user_id', v_profile.id,
    'is_tester', v_profile.is_tester,
    'subscription_plan', v_profile.subscription_plan,
    'tester_invite_code', v_profile.tester_invite_code
  );
END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.set_tester_status(uuid, boolean, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.set_tester_status(uuid, boolean, text)
TO service_role;

COMMENT ON FUNCTION public.set_tester_status(uuid, boolean, text) IS
  'Service-only tester grant/revoke with atomic billing-entitlement reconciliation.';

-- Preserve the invite redemption locks and idempotency, but grant only the
-- tester flag. Tester privileges are derived from is_tester and must not
-- rewrite the user's paid plan.
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
  v_invite_rows integer;
BEGIN
  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'reason', 'invalid');
  END IF;

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

  -- Idempotent retries are handled by the is_tester check above. If an
  -- administrator revoked that status, a previously consumed invite must not
  -- be able to grant it again, even to its original owner.
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

  PERFORM public.set_tester_status(p_user_id, true, v_invite.invite_code);

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
  'Atomically grants tester access without changing billing entitlement.';

-- Freeze subscription writes before profile rows are locked so the backfill
-- reconciles one stable billing snapshot in subscription-to-profile lock order.
LOCK TABLE public.subscriptions IN SHARE MODE;

-- Repair billing truth for existing testers. Their tester flag continues to
-- provide tester access; this only restores the plan represented by Stripe.
WITH reconciled AS (
  SELECT
    p.id,
    public.stripe_entitled_plan(
      s.status,
      s.plan,
      s.current_period_end,
      s.trial_end,
      pg_catalog.clock_timestamp()
    ) AS entitled_plan
  FROM public.profiles AS p
  LEFT JOIN public.subscriptions AS s ON s.user_id = p.id
  WHERE p.is_tester IS TRUE
)
UPDATE public.profiles AS p
SET subscription_plan = r.entitled_plan,
    subscription_started_at = CASE
      WHEN r.entitled_plan = 'free' THEN NULL
      ELSE p.subscription_started_at
    END,
    updated_at = pg_catalog.clock_timestamp()
FROM reconciled AS r
WHERE p.id = r.id
  AND (
    p.subscription_plan IS DISTINCT FROM r.entitled_plan
    OR (r.entitled_plan = 'free' AND p.subscription_started_at IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
