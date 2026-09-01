BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Persist the Stripe ledger row and the profile's billing entitlement in one
-- transaction. Only trusted server code may reconcile Stripe state.
CREATE OR REPLACE FUNCTION public.reconcile_stripe_subscription(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_status text,
  p_plan text,
  p_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_trial_start timestamptz,
  p_trial_end timestamptz,
  p_clear_scheduled_downgrade boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_subscription_id text := NULLIF(pg_catalog.btrim(p_stripe_subscription_id), '');
  v_customer_id text := NULLIF(pg_catalog.btrim(p_stripe_customer_id), '');
  v_price_id text := NULLIF(pg_catalog.btrim(p_price_id), '');
  v_existing public.subscriptions%ROWTYPE;
  v_persisted public.subscriptions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_updated_profile public.profiles%ROWTYPE;
  v_subscription_owner uuid;
  v_has_existing boolean := false;
  v_applied boolean := true;
  v_ignored_reason text := NULL;
  v_ledger_plan text;
  v_entitled_plan text;
  v_existing_entitled_plan text := 'free';
  v_status_could_entitle boolean;
  v_should_clear_schedule boolean := false;
  v_schedule_cleared boolean := false;
  v_subscription_rows integer;
  v_profile_rows integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Stripe reconciliation requires a user';
  END IF;

  IF v_subscription_id IS NULL OR v_customer_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Stripe reconciliation requires non-empty subscription and customer identifiers';
  END IF;

  IF p_status IS NULL
     OR p_status <> ALL (
       ARRAY[
         'incomplete',
         'incomplete_expired',
         'trialing',
         'active',
         'past_due',
         'canceled',
         'unpaid',
         'paused'
       ]::text[]
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Stripe reconciliation received an invalid subscription status';
  END IF;

  IF p_plan IS NOT NULL
     AND p_plan <> ALL (ARRAY['pro', 'ultra']::text[]) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Stripe reconciliation received an invalid canonical plan';
  END IF;

  IF p_plan IS NOT NULL AND v_price_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A mapped Stripe plan requires a non-empty price identifier';
  END IF;

  IF p_cancel_at_period_end IS NULL
     OR p_clear_scheduled_downgrade IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'Stripe reconciliation requires explicit boolean values';
  END IF;

  IF p_current_period_start IS NOT NULL
     AND p_current_period_end IS NOT NULL
     AND p_current_period_end < p_current_period_start THEN
    RAISE EXCEPTION USING
      ERRCODE = '22007',
      MESSAGE = 'Stripe current period ends before it starts';
  END IF;

  IF p_trial_start IS NOT NULL
     AND p_trial_end IS NOT NULL
     AND p_trial_end < p_trial_start THEN
    RAISE EXCEPTION USING
      ERRCODE = '22007',
      MESSAGE = 'Stripe trial ends before it starts';
  END IF;

  -- Evaluate grant capability with a known paid plan. Unknown prices are
  -- retryable failures only when the current state could grant paid access;
  -- terminal/non-entitling states still reconcile and revoke access.
  v_status_could_entitle := public.stripe_entitled_plan(
    p_status,
    'pro',
    p_current_period_end,
    p_trial_end,
    v_now
  ) <> 'free';

  IF p_plan IS NULL AND v_status_could_entitle THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'An unknown Stripe price cannot grant paid entitlement';
  END IF;

  -- Lock every potentially conflicting subscription row in a stable order.
  -- Profile rows are intentionally not locked until subscription persistence
  -- is complete, matching the subscription-to-profile lock order used by
  -- tester reconciliation.
  PERFORM s.id
  FROM public.subscriptions AS s
  WHERE s.user_id = p_user_id
     OR s.stripe_subscription_id = v_subscription_id
  ORDER BY s.id
  FOR UPDATE;

  SELECT s.*
  INTO v_existing
  FROM public.subscriptions AS s
  WHERE s.user_id = p_user_id;

  v_has_existing := FOUND;

  SELECT s.user_id
  INTO v_subscription_owner
  FROM public.subscriptions AS s
  WHERE s.stripe_subscription_id = v_subscription_id;

  IF FOUND AND v_subscription_owner <> p_user_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Stripe subscription is already linked to another user';
  END IF;

  IF v_has_existing THEN
    v_existing_entitled_plan := public.stripe_entitled_plan(
      v_existing.status,
      v_existing.plan,
      v_existing.current_period_end,
      v_existing.trial_end,
      v_now
    );

    -- Stripe cancellation is terminal for a subscription ID. This also closes
    -- the small retrieve-to-write race where a worker fetched an active object
    -- immediately before another worker persisted its cancellation.
    IF v_existing.stripe_subscription_id = v_subscription_id
       AND v_existing.status = 'canceled'
       AND p_status <> 'canceled' THEN
      v_applied := false;
      v_ignored_reason := 'terminal_cancellation';
    -- A delayed terminal event for a replaced subscription must not revoke a
    -- different subscription that currently provides paid access.
    ELSIF v_existing.stripe_subscription_id <> v_subscription_id
          AND v_existing_entitled_plan <> 'free'
          AND NOT v_status_could_entitle THEN
      v_applied := false;
      v_ignored_reason := 'superseded_subscription';
    END IF;
  END IF;

  IF v_applied THEN
    v_ledger_plan := CASE
      WHEN p_plan = ANY (ARRAY['pro', 'ultra']::text[]) THEN p_plan
      WHEN v_has_existing
           AND v_existing.plan = ANY (
             ARRAY['free', 'basic', 'pro', 'ultra', 'mega']::text[]
           ) THEN v_existing.plan
      ELSE 'free'
    END;

    v_entitled_plan := public.stripe_entitled_plan(
      p_status,
      v_ledger_plan,
      p_current_period_end,
      p_trial_end,
      v_now
    );

    v_should_clear_schedule := p_clear_scheduled_downgrade
      OR COALESCE((
        v_has_existing
        AND p_plan IS NOT NULL
        AND CASE v_existing.scheduled_downgrade_to
          WHEN 'pro' THEN 'pro'
          WHEN 'ultra' THEN 'ultra'
          WHEN 'mega' THEN 'ultra'
          ELSE NULL
        END = p_plan
      ), false);

    v_schedule_cleared := v_has_existing
      AND v_should_clear_schedule
      AND (
        v_existing.scheduled_downgrade_to IS NOT NULL
        OR v_existing.scheduled_downgrade_date IS NOT NULL
      );

    IF v_has_existing THEN
      UPDATE public.subscriptions AS s
      SET stripe_subscription_id = v_subscription_id,
          stripe_customer_id = v_customer_id,
          status = p_status,
          plan = v_ledger_plan,
          price_id = v_price_id,
          current_period_start = p_current_period_start,
          current_period_end = p_current_period_end,
          cancel_at_period_end = p_cancel_at_period_end,
          canceled_at = p_canceled_at,
          trial_start = p_trial_start,
          trial_end = p_trial_end,
          scheduled_downgrade_to = CASE
            WHEN v_should_clear_schedule THEN NULL
            ELSE s.scheduled_downgrade_to
          END,
          scheduled_downgrade_date = CASE
            WHEN v_should_clear_schedule THEN NULL
            ELSE s.scheduled_downgrade_date
          END,
          updated_at = v_now
      WHERE s.id = v_existing.id
      RETURNING s.* INTO v_persisted;
    ELSE
      INSERT INTO public.subscriptions (
        user_id,
        stripe_subscription_id,
        stripe_customer_id,
        status,
        plan,
        price_id,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        trial_start,
        trial_end,
        scheduled_downgrade_to,
        scheduled_downgrade_date,
        updated_at
      )
      VALUES (
        p_user_id,
        v_subscription_id,
        v_customer_id,
        p_status,
        v_ledger_plan,
        v_price_id,
        p_current_period_start,
        p_current_period_end,
        p_cancel_at_period_end,
        p_canceled_at,
        p_trial_start,
        p_trial_end,
        NULL,
        NULL,
        v_now
      )
      RETURNING * INTO v_persisted;
    END IF;

    GET DIAGNOSTICS v_subscription_rows = ROW_COUNT;

    IF v_subscription_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Stripe subscription persistence invariant violated';
    END IF;
  ELSE
    v_persisted := v_existing;
    v_ledger_plan := v_existing.plan;
    v_entitled_plan := v_existing_entitled_plan;
  END IF;

  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'Stripe subscription profile was not found';
  END IF;

  IF v_applied THEN
    UPDATE public.profiles AS p
    SET subscription_plan = v_entitled_plan,
        subscription_started_at = CASE
          WHEN v_entitled_plan = 'free' THEN NULL
          WHEN p_status = 'active' AND p_current_period_start IS NOT NULL
            THEN p_current_period_start
          ELSE p.subscription_started_at
        END,
        has_selected_plan = true,
        updated_at = v_now
    WHERE p.id = p_user_id
    RETURNING p.* INTO v_updated_profile;

    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;

    IF v_profile_rows <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Stripe profile entitlement persistence invariant violated';
    END IF;
  ELSE
    v_updated_profile := v_profile;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'applied', v_applied,
    'ignored_reason', v_ignored_reason,
    'user_id', p_user_id,
    'stripe_subscription_id', v_persisted.stripe_subscription_id,
    'ledger_plan', v_ledger_plan,
    'entitled_plan', v_entitled_plan,
    'previous_plan', COALESCE(v_profile.subscription_plan, 'free'),
    'previous_subscription_started_at', v_profile.subscription_started_at,
    'production_mode', COALESCE(v_profile.production_mode, false),
    'subscription_started_at', v_updated_profile.subscription_started_at,
    'schedule_cleared', v_schedule_cleared
  );
END;
$function$;

REVOKE ALL PRIVILEGES
ON FUNCTION public.reconcile_stripe_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.reconcile_stripe_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean
)
TO service_role;

COMMENT ON FUNCTION public.reconcile_stripe_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  boolean,
  timestamptz,
  timestamptz,
  timestamptz,
  boolean
) IS
  'Service-only atomic Stripe ledger/profile reconciliation with terminal-state and entitlement guards.';

NOTIFY pgrst, 'reload schema';

COMMIT;
