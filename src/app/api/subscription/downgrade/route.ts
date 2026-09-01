import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  stripe,
  getStripeClient,
  getPriceId,
  getPlanFromPriceId,
  isValidPlan,
} from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { isDowngrade } from '@/lib/features/config'
import type { SubscriptionPlan } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Note: PLAN_HIERARCHY and isDowngrade are now exported from @/lib/features/config
// Import from there instead of this route for shared plan hierarchy logic

// Valid downgrade reasons
const VALID_REASONS = [
  'too_expensive',
  'not_using',
  'found_alternative',
  'missing_features',
  'temporary_break',
  'other',
] as const

type DowngradeReason = (typeof VALID_REASONS)[number]

/**
 * Get user-friendly error message for Stripe error codes
 */
function getStripeErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'resource_missing':
      return 'Subscription not found. It may have been canceled.'
    case 'subscription_payment_intent_requires_action':
      return 'Payment requires additional verification. Please update your payment method.'
    default:
      return 'Payment system error. Please try again or contact support.'
  }
}

/**
 * POST /api/subscription/downgrade
 * Handles subscription downgrades with reason tracking
 *
 * For downgrade to 'free': Cancels subscription at period end
 * For downgrade to 'pro' (from Ultra): Uses Stripe Subscription Schedules to automatically
 *   transition to Pro pricing at period end - no user action required
 *
 * Note: We use cancel_at_period_end for free downgrades and subscription schedules for
 * plan downgrades to ensure users keep their current plan access until the period ends.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Rate limiting - 5 requests per minute (sensitive operation)
    const rateLimit = checkRateLimit(
      user.id,
      { maxRequests: 5, windowSeconds: 60, prefix: 'downgrade' },
      'subscription-downgrade'
    )
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait.' } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Parse and validate request body
    let body: { targetPlan?: string; reason?: string; idempotencyKey?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      )
    }

    const { targetPlan, reason, idempotencyKey } = body

    // Validate target plan
    if (!targetPlan || (targetPlan !== 'pro' && targetPlan !== 'free')) {
      return NextResponse.json(
        { error: { code: 'INVALID_PLAN', message: 'Target plan must be "pro" or "free"' } },
        { status: 400 }
      )
    }

    // Validate reason
    if (!reason || !VALID_REASONS.includes(reason as DowngradeReason)) {
      return NextResponse.json(
        { error: { code: 'INVALID_REASON', message: 'A valid downgrade reason is required' } },
        { status: 400 }
      )
    }

    // Use service client for database operations
    const serviceClient = createServiceClient()

    // Get user's current profile and subscription
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { code: 'PROFILE_NOT_FOUND', message: 'User profile not found' } },
        { status: 404 }
      )
    }

    const currentPlan = profile.subscription_plan as SubscriptionPlan

    // Verify this is actually a downgrade using the shared utility
    if (!isDowngrade(currentPlan, targetPlan)) {
      return NextResponse.json(
        { error: { code: 'NOT_A_DOWNGRADE', message: 'This is not a downgrade. To upgrade your plan, please use the billing portal or checkout page.' } },
        { status: 400 }
      )
    }

    // Get the user's Stripe subscription with full status
    const { data: subscription, error: subError } = await serviceClient
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, current_period_end, status, cancel_at_period_end, scheduled_downgrade_to')
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } },
        { status: 404 }
      )
    }

    // P1-2 FIX: Validate subscription status
    const validStatuses = ['active', 'trialing']
    if (!validStatuses.includes(subscription.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_SUBSCRIPTION_STATUS', message: 'Cannot modify subscription in current state' } },
        { status: 400 }
      )
    }

    // P1-1 FIX: Check if already pending cancellation (idempotency)
    // This also handles the P2-2 edge case: if Stripe call succeeded but DB update failed
    // on a previous attempt, the subscription will have cancel_at_period_end=true in Stripe,
    // which gets synced to our DB, so retries will correctly return ALREADY_CANCELING.
    if (subscription.cancel_at_period_end || subscription.scheduled_downgrade_to) {
      // scheduled_downgrade_to covers the Ultra→Pro schedule path: a subscription
      // already attached to a Stripe schedule cannot be attached again, so a repeat
      // POST must short-circuit here instead of failing with a generic STRIPE_ERROR.
      return NextResponse.json(
        { error: { code: 'ALREADY_CANCELING', message: 'A downgrade or cancellation is already scheduled for this subscription.' } },
        { status: 409 }
      )
    }

    let periodEndDate = subscription.current_period_end

    // Record the downgrade reason FIRST for analytics (P1-3, P2-7 partial fix)
    // Insert before Stripe call so we have the reason even if Stripe fails
    // Uses regular client since RLS policy allows users to insert their own records
    try {
      await supabase
        .from('downgrade_reasons')
        .insert({
          user_id: user.id,
          from_plan: currentPlan,
          to_plan: targetPlan,
          reason: reason,
        })
    } catch (insertError) {
      // Log but don't fail the operation - analytics is not critical
      console.error('Failed to record downgrade reason:', insertError)
    }

    // Set up Stripe API options with idempotency key if provided
    const stripeOptions: Stripe.RequestOptions = {}
    if (idempotencyKey) {
      stripeOptions.idempotencyKey = `downgrade-${user.id}-${idempotencyKey}`
    }

    let message: string

    if (targetPlan === 'free') {
      // For downgrade to free: Cancel subscription at period end
      const updatedStripeSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        { cancel_at_period_end: true },
        stripeOptions
      )

      // Get the actual period end from Stripe (item-level since the basil API / SDK v22,
      // with legacy top-level fallback)
      const periodEnd =
        updatedStripeSubscription.items?.data?.[0]?.current_period_end ??
        ((updatedStripeSubscription as unknown as Record<string, unknown>).current_period_end as number | undefined)
      if (periodEnd) {
        periodEndDate = new Date(periodEnd * 1000).toISOString()
      }

      // Update local subscription record — surface (but don't fail on) DB errors so
      // Stripe/DB divergence is at least visible in logs
      const { error: cancelSyncError } = await serviceClient
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id)
      if (cancelSyncError) {
        console.error('Failed to record cancel_at_period_end locally (Stripe already updated):', cancelSyncError)
      }

      message = 'Your subscription will be canceled at the end of your billing period.'
    } else {
      // For Ultra→Pro: Use Subscription Schedules to auto-transition
      // First, get the current subscription from Stripe to determine billing cycle
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)

      // Determine billing cycle from current subscription
      const currentItem = stripeSubscription.items.data[0]
      if (!currentItem) {
        return NextResponse.json(
          { error: { code: 'CURRENT_PRICE_NOT_CONFIGURED', message: 'Current subscription price is unavailable' } },
          { status: 500 }
        )
      }

      const currentPrice = getPlanFromPriceId(currentItem.price.id)
      if (!currentPrice || !isValidPlan(currentPrice.plan)) {
        return NextResponse.json(
          { error: { code: 'CURRENT_PRICE_NOT_CONFIGURED', message: 'Current subscription price is not configured' } },
          { status: 500 }
        )
      }

      if (currentPrice.plan !== 'ultra') {
        return NextResponse.json(
          { error: { code: 'SUBSCRIPTION_STATE_MISMATCH', message: 'Stripe subscription does not match the current Ultra plan' } },
          { status: 409 }
        )
      }

      const billingCycle = currentPrice.billingCycle

      // Get current_period_end — since the Stripe "basil" API (SDK v22) this lives on
      // the subscription ITEM, not the subscription (same as the webhook reads it).
      // Fall back to the legacy top-level field for older API versions.
      const currentPeriodEnd =
        currentItem.current_period_end ??
        ((stripeSubscription as unknown as Record<string, unknown>).current_period_end as number | undefined)

      if (typeof currentPeriodEnd !== 'number' || !Number.isFinite(currentPeriodEnd)) {
        // Fail BEFORE creating the schedule — a schedule created without valid phase
        // dates leaves the subscription attached to an orphan schedule in Stripe.
        return NextResponse.json(
          { error: { code: 'STRIPE_STATE_UNAVAILABLE', message: 'Could not determine the current billing period end. Please try again or contact support.' } },
          { status: 500 }
        )
      }

      // Get the Pro price ID for the same billing cycle
      const proPriceId = getPriceId('pro', billingCycle)
      if (!proPriceId) {
        return NextResponse.json(
          { error: { code: 'PRICE_NOT_CONFIGURED', message: 'Pro plan pricing not configured for this billing cycle' } },
          { status: 500 }
        )
      }

      // Create a subscription schedule from the existing subscription
      // This will automatically transition to Pro at the end of the current period
      const stripeClient = getStripeClient()
      const schedule = await stripeClient.subscriptionSchedules.create({
        from_subscription: subscription.stripe_subscription_id,
      }, stripeOptions)

      // Update the schedule to transition to Pro at next period
      await stripeClient.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release', // Continue as regular subscription after schedule completes
        phases: [
          {
            // Current phase (Ultra) - keep until period end
            items: [{ price: currentItem.price.id, quantity: 1 }],
            start_date: schedule.phases[0]?.start_date || Math.floor(Date.now() / 1000),
            end_date: currentPeriodEnd,
            metadata: {
              plan: currentPrice.plan,
              billing_cycle: billingCycle,
            },
          },
          {
            // Next phase (Pro) - starts at period end, continues indefinitely
            items: [{ price: proPriceId, quantity: 1 }],
            start_date: currentPeriodEnd,
            metadata: {
              plan: 'pro',
              billing_cycle: billingCycle,
            },
          },
        ],
      }, stripeOptions)

      periodEndDate = new Date(currentPeriodEnd * 1000).toISOString()

      // Update local subscription record to indicate scheduled downgrade.
      // Surface DB failure loudly: the Stripe schedule already exists, and losing this
      // marker both hides the pending downgrade from the UI and breaks the
      // ALREADY_CANCELING idempotency guard for repeat requests.
      const { error: scheduleSyncError } = await serviceClient
        .from('subscriptions')
        .update({
          scheduled_downgrade_to: 'pro',
          scheduled_downgrade_date: periodEndDate,
        })
        .eq('stripe_subscription_id', subscription.stripe_subscription_id)
      if (scheduleSyncError) {
        console.error(
          'Stripe downgrade schedule created but local subscriptions update failed:',
          scheduleSyncError
        )
      }

      message = `Your plan will automatically change to Pro on ${new Date(periodEndDate).toLocaleDateString()}. You'll keep Ultra access until then.`
    }

    return NextResponse.json({
      data: {
        success: true,
        targetPlan,
        periodEndDate,
        currentPlanUntil: periodEndDate,
        message,
      },
    })
  } catch (error) {
    // P2-4 FIX: Better Stripe error handling
    if (error instanceof Stripe.errors.StripeError) {
      console.error('Stripe error during downgrade:', {
        code: error.code,
        type: error.type,
        message: error.message,
      })
      return NextResponse.json(
        { error: { code: 'STRIPE_ERROR', message: getStripeErrorMessage(error.code) } },
        { status: 500 }
      )
    }

    // P3-1 FIX: Sanitized error logging
    console.error('Downgrade error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      // Don't log full error object which may contain sensitive data
    })

    return NextResponse.json(
      { error: { code: 'DOWNGRADE_ERROR', message: 'Failed to process downgrade' } },
      { status: 500 }
    )
  }
}
