\set ON_ERROR_STOP on

BEGIN;

-- Deterministic helper truth table. Every assertion runs inside this
-- transaction, and the fixture is removed by the final ROLLBACK.
DO $test$
DECLARE
  v_as_of timestamptz := '2026-08-27 12:00:00+00'::timestamptz;
  v_case record;
  v_actual text;
BEGIN
  FOR v_case IN
    SELECT *
    FROM (
      VALUES
        ('active paid access', 'active', 'pro', v_as_of + interval '30 days', NULL::timestamptz, 'pro'),
        ('trialing paid access', 'trialing', 'ultra', v_as_of + interval '30 days', v_as_of + interval '7 days', 'ultra'),
        ('unexpired past-due access', 'past_due', 'pro', v_as_of + interval '1 hour', NULL::timestamptz, 'pro'),
        ('expired past-due access', 'past_due', 'pro', v_as_of - interval '1 second', NULL::timestamptz, 'free'),
        ('past-due without an end', 'past_due', 'pro', NULL::timestamptz, NULL::timestamptz, 'free'),
        ('paused with future period', 'paused', 'ultra', v_as_of + interval '30 days', v_as_of - interval '1 day', 'free'),
        ('canceled paid plan', 'canceled', 'ultra', v_as_of + interval '30 days', NULL::timestamptz, 'free')
    ) AS cases(label, status, plan, current_period_end, trial_end, expected)
  LOOP
    v_actual := public.stripe_entitled_plan(
      v_case.status,
      v_case.plan,
      v_case.current_period_end,
      v_case.trial_end,
      v_as_of
    );

    IF v_actual IS DISTINCT FROM v_case.expected THEN
      RAISE EXCEPTION
        'stripe_entitled_plan failed %: expected %, got %',
        v_case.label,
        v_case.expected,
        v_actual;
    END IF;
  END LOOP;
END;
$test$;

-- Exercise the same transition used by webhook reconciliation, including a
-- paused snapshot whose price is unknown. Paused remains an accepted ledger
-- status, preserves the prior valid plan, and revokes stored billing access.
DO $test$
DECLARE
  v_user_id uuid := pg_catalog.gen_random_uuid();
  v_as_of timestamptz := pg_catalog.clock_timestamp();
  v_result jsonb;
  v_profile public.profiles%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    'paused-entitlement-' || v_user_id::text || '@example.invalid',
    '',
    v_as_of,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    v_as_of,
    v_as_of
  );

  v_result := public.reconcile_stripe_subscription(
    p_user_id => v_user_id,
    p_stripe_subscription_id => 'sub_paused_' || pg_catalog.replace(v_user_id::text, '-', ''),
    p_stripe_customer_id => 'cus_paused_' || pg_catalog.replace(v_user_id::text, '-', ''),
    p_status => 'active',
    p_plan => 'pro',
    p_price_id => 'price_known_pro_test',
    p_current_period_start => v_as_of - interval '1 day',
    p_current_period_end => v_as_of + interval '29 days',
    p_cancel_at_period_end => false,
    p_canceled_at => NULL,
    p_trial_start => NULL,
    p_trial_end => NULL,
    p_clear_scheduled_downgrade => false
  );

  IF v_result ->> 'entitled_plan' IS DISTINCT FROM 'pro' THEN
    RAISE EXCEPTION 'active setup did not grant pro: %', v_result;
  END IF;

  PERFORM public.set_tester_status(v_user_id, true, 'PAUSED_TRUTH_TABLE');

  v_result := public.reconcile_stripe_subscription(
    p_user_id => v_user_id,
    p_stripe_subscription_id => 'sub_paused_' || pg_catalog.replace(v_user_id::text, '-', ''),
    p_stripe_customer_id => 'cus_paused_' || pg_catalog.replace(v_user_id::text, '-', ''),
    p_status => 'paused',
    p_plan => NULL,
    p_price_id => 'price_unknown_paused_test',
    p_current_period_start => v_as_of - interval '1 day',
    p_current_period_end => v_as_of + interval '29 days',
    p_cancel_at_period_end => false,
    p_canceled_at => NULL,
    p_trial_start => v_as_of - interval '8 days',
    p_trial_end => v_as_of - interval '1 day',
    p_clear_scheduled_downgrade => false
  );

  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  SELECT s.*
  INTO v_subscription
  FROM public.subscriptions AS s
  WHERE s.user_id = v_user_id;

  IF v_result ->> 'applied' IS DISTINCT FROM 'true'
     OR v_result ->> 'entitled_plan' IS DISTINCT FROM 'free'
     OR v_result ->> 'ledger_plan' IS DISTINCT FROM 'pro'
     OR v_subscription.status IS DISTINCT FROM 'paused'
     OR v_subscription.plan IS DISTINCT FROM 'pro'
     OR v_profile.subscription_plan IS DISTINCT FROM 'free'
     OR v_profile.subscription_started_at IS NOT NULL
     OR v_profile.is_tester IS NOT TRUE THEN
    RAISE EXCEPTION
      'paused reconciliation invariant failed: result=%, profile=%, subscription=%',
      v_result,
      pg_catalog.to_jsonb(v_profile),
      pg_catalog.to_jsonb(v_subscription);
  END IF;

  v_result := public.set_tester_status(v_user_id, false, NULL);

  SELECT p.*
  INTO v_profile
  FROM public.profiles AS p
  WHERE p.id = v_user_id;

  IF v_result ->> 'is_tester' IS DISTINCT FROM 'false'
     OR v_result ->> 'subscription_plan' IS DISTINCT FROM 'free'
     OR v_profile.is_tester IS NOT FALSE
     OR v_profile.tester_invite_code IS NOT NULL
     OR v_profile.subscription_plan IS DISTINCT FROM 'free'
     OR v_profile.subscription_started_at IS NOT NULL THEN
    RAISE EXCEPTION
      'paused tester revocation invariant failed: result=%, profile=%',
      v_result,
      pg_catalog.to_jsonb(v_profile);
  END IF;
END;
$test$;

ROLLBACK;
