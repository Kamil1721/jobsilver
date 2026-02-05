import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, getPlanFromPriceId } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'
import { mapLegacyPlan } from '@/lib/stripe/plans'

export const dynamic = 'force-dynamic'

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs'

// In-memory cache for processed event IDs (prevents duplicate processing within same instance)
// Note: For multi-instance deployments, use Redis or a database table instead
const processedEvents = new Map<string, number>()
const EVENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function isEventProcessed(eventId: string): boolean {
  const timestamp = processedEvents.get(eventId)
  if (!timestamp) return false

  // Check if cache entry has expired
  if (Date.now() - timestamp > EVENT_CACHE_TTL) {
    processedEvents.delete(eventId)
    return false
  }
  return true
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now())

  // Cleanup old entries periodically (every 100 events)
  if (processedEvents.size > 100) {
    const now = Date.now()
    const keysToDelete: string[] = []
    processedEvents.forEach((timestamp, id) => {
      if (now - timestamp > EVENT_CACHE_TTL) {
        keysToDelete.push(id)
      }
    })
    keysToDelete.forEach(id => processedEvents.delete(id))
  }
}

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription management
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('Webhook: Missing stripe-signature header')
    return NextResponse.json(
      { error: { code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' } },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('Webhook: STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' } },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature verification failed:', message)
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: `Webhook signature verification failed: ${message}` } },
      { status: 400 }
    )
  }

  console.log(`Webhook received: ${event.type} (${event.id})`)

  // Idempotency check - prevent duplicate processing of the same event
  if (isEventProcessed(event.id)) {
    console.log(`Webhook event already processed: ${event.id}`)
    return NextResponse.json({ received: true, deduplicated: true })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabase, session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabase, subscription)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(supabase, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(supabase, invoice)
        break
      }

      case 'subscription_schedule.released': {
        // When a subscription schedule completes and releases, the subscription
        // continues as a regular subscription. This happens after Ultra→Pro transitions.
        const schedule = event.data.object as Stripe.SubscriptionSchedule
        await handleSubscriptionScheduleReleased(supabase, schedule)
        break
      }

      default:
        console.log(`Unhandled webhook event: ${event.type}`)
    }

    // Mark event as processed after successful handling
    markEventProcessed(event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: { code: 'HANDLER_ERROR', message: 'Webhook handler failed' } },
      { status: 500 }
    )
  }
}

/**
 * Handle checkout.session.completed event
 * Creates/updates customer and subscription records
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  session: Stripe.Checkout.Session
) {
  console.log('Processing checkout.session.completed:', session.id)

  const userId = session.metadata?.supabase_user_id
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('Checkout session missing supabase_user_id metadata')
    return
  }

  // Ensure customer record exists
  await supabase.from('customers').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
  })

  // Fetch full subscription details
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await handleSubscriptionUpdated(supabase, subscription, userId)
  }

  console.log(`Checkout completed for user ${userId}`)
}

/**
 * Handle customer.subscription.created/updated events
 * Updates subscription record and user's plan
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription,
  knownUserId?: string
) {
  console.log('Processing subscription update:', subscription.id, 'Status:', subscription.status)

  // Get user ID from metadata or lookup by customer
  let userId = knownUserId || subscription.metadata?.supabase_user_id

  if (!userId) {
    // Lookup by customer ID
    const { data: customer } = await supabase
      .from('customers')
      .select('user_id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()

    userId = customer?.user_id
  }

  if (!userId) {
    console.error('Cannot find user for subscription:', subscription.id)
    return
  }

  // Get plan from price ID and migrate legacy plans to 3-tier model
  const priceId = subscription.items.data[0]?.price.id
  const rawPlan = subscription.metadata?.plan || getPlanFromPriceId(priceId) || 'free'
  // Migrate legacy plans: starter/basic -> free, mega -> ultra
  const plan = mapLegacyPlan(rawPlan as AllSubscriptionPlans)

  // Log legacy plan migrations
  if (rawPlan !== plan) {
    console.log(`Legacy plan migration: ${rawPlan} -> ${plan} for subscription ${subscription.id}`)
  }

  // Extract period timestamps - handle different Stripe SDK versions
  const periodStart = (subscription as unknown as Record<string, unknown>).current_period_start as number | undefined
  const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end as number | undefined

  // Check if there was a scheduled downgrade that's now complete
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('scheduled_downgrade_to')
    .eq('user_id', userId)
    .single()

  // Clear scheduled downgrade fields if the plan transition has happened
  const shouldClearSchedule = existingSub?.scheduled_downgrade_to === plan

  // Upsert subscription record
  const { error: subError } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    plan: plan,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    // Clear scheduled downgrade if the transition has happened
    ...(shouldClearSchedule && {
      scheduled_downgrade_to: null,
      scheduled_downgrade_date: null,
    }),
  }, {
    onConflict: 'user_id',
  })

  if (subError) {
    console.error('Error upserting subscription:', subError)
    return
  }

  // Get current plan to detect upgrades
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('subscription_plan, production_mode, subscription_started_at')
    .eq('id', userId)
    .single()

  const previousPlan = currentProfile?.subscription_plan || 'free'
  const activePlan = getActivePlan(subscription.status, plan as SubscriptionPlan)

  // Update user's profile with active plan and mark plan as selected
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_plan: activePlan,
      subscription_started_at: subscription.status === 'active' && periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      // Mark that user has selected a plan (via Stripe checkout)
      has_selected_plan: true,
    })
    .eq('id', userId)

  if (profileError) {
    console.error('Error updating profile subscription:', profileError)
  }

  // Trigger instant job curation on plan UPGRADE (free -> paid)
  // Additional safeguard: don't trigger if subscription was started in the last 5 minutes
  // (prevents duplicate curation from webhook retries/race conditions)
  const isUpgrade = previousPlan === 'free' && activePlan !== 'free'
  const recentlyUpgraded = currentProfile?.subscription_started_at &&
    (Date.now() - new Date(currentProfile.subscription_started_at).getTime()) < 5 * 60 * 1000

  if (isUpgrade && currentProfile?.production_mode && !recentlyUpgraded) {
    console.log(`Plan upgrade detected for user ${userId}: ${previousPlan} -> ${activePlan}. Triggering instant curation.`)

    // Trigger job curation in background using internal service call
    // Pass user_id and internal secret to bypass auth (webhook has no session)
    // Support both INTERNAL_API_KEY (preferred) and INTERNAL_API_SECRET (legacy)
    const internalSecret = process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_SECRET
    if (internalSecret) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/curate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
          'X-User-Id': userId,
        },
      }).catch(err => console.error('Failed to trigger upgrade curation:', err))
    } else {
      console.warn('INTERNAL_API_KEY not configured, skipping curation trigger')
    }
  } else if (isUpgrade && recentlyUpgraded) {
    console.log(`Plan upgrade for user ${userId} skipped curation (recently upgraded)`)
  }

  console.log(`Subscription updated for user ${userId}: ${plan} (${subscription.status})`)
}

/**
 * Handle customer.subscription.deleted event
 * Resets user to free plan
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  console.log('Processing subscription deletion:', subscription.id)

  // Find user by subscription
  const { data: subRecord } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!subRecord?.user_id) {
    console.error('Cannot find user for deleted subscription:', subscription.id)
    return
  }

  // Update subscription status
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  // Reset user to free plan
  await supabase
    .from('profiles')
    .update({
      subscription_plan: 'free',
      subscription_started_at: null,
    })
    .eq('id', subRecord.user_id)

  console.log(`Subscription canceled for user ${subRecord.user_id}`)
}

/**
 * Handle invoice.payment_succeeded event
 * Updates subscription period dates
 */
async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice
) {
  // Get subscription from invoice - handle different SDK versions
  const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null
  if (!subscriptionId) return

  console.log('Processing payment succeeded for subscription:', subscriptionId)

  // Refresh subscription data from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await handleSubscriptionUpdated(supabase, subscription)
}

/**
 * Handle invoice.payment_failed event
 * Updates subscription status
 *
 * Behavior follows the same logic as cancellation:
 * - Trial conversion fails: Access ends when trial ends (user never paid)
 * - Renewal fails: Access continues until current paid period ends (user has paid)
 *
 * The actual downgrade happens via:
 * 1. Stripe eventually cancels/updates the subscription after retries
 * 2. Our check-expired-subscriptions cron as a safety net
 */
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice
) {
  // Get subscription from invoice - handle different SDK versions
  const subscriptionId = (invoice as unknown as Record<string, unknown>).subscription as string | null
  if (!subscriptionId) return

  console.log('Processing payment failed for subscription:', subscriptionId)

  // Get the billing reason to distinguish trial conversion vs renewal
  // billing_reason values: subscription_create, subscription_cycle, subscription_update, etc.
  const billingReason = (invoice as unknown as Record<string, unknown>).billing_reason as string | undefined

  // First charge (trial conversion) vs renewal
  const isFirstCharge = billingReason === 'subscription_create'

  // Find user by subscription for logging
  const { data: subRecord } = await supabase
    .from('subscriptions')
    .select('user_id, current_period_end, trial_end')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!subRecord?.user_id) {
    console.error('Cannot find user for failed payment:', subscriptionId)
  }

  // Update subscription status to past_due
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId)

  if (isFirstCharge) {
    // TRIAL CONVERSION FAILED: User never paid, access ends when trial ends
    // getActivePlan returns plan for 'past_due', but Stripe will update
    // subscription status when trial ends and payment hasn't succeeded.
    // The check-expired-subscriptions cron provides a safety net.
    console.log(
      `First charge failed for user ${subRecord?.user_id || 'unknown'} - ` +
      `access will end when trial ends (${subRecord?.trial_end || 'unknown'})`
    )
  } else {
    // RENEWAL FAILED: User has paid for current period
    // Keep their access until current_period_end (getActivePlan returns plan for past_due)
    // After period ends, check-expired-subscriptions cron will downgrade if Stripe hasn't
    console.log(
      `Renewal failed for user ${subRecord?.user_id || 'unknown'} - ` +
      `keeping access until period ends (${subRecord?.current_period_end || 'unknown'})`
    )
  }
}

/**
 * Determine active plan based on subscription status
 *
 * Handles all Stripe subscription statuses:
 * - active: Full plan access
 * - trialing: Full plan access during trial
 * - past_due: Grace period - keep plan but payment retry in progress
 * - incomplete: Checkout not finished (initial payment failed) - no access
 * - incomplete_expired: Checkout abandoned after 23 hours - no access
 * - paused: Subscription paused (configurable) - keep plan
 * - unpaid: Payment failed after all retry attempts - no access
 * - canceled: Subscription ended - no access
 */
function getActivePlan(status: string, plan: SubscriptionPlan): SubscriptionPlan {
  // States that grant full plan access
  const activeStatuses = ['active', 'trialing']
  if (activeStatuses.includes(status)) {
    return plan
  }

  // Grace period states - keep plan but may need notification
  if (status === 'past_due') {
    return plan
  }

  // Incomplete states - checkout not finished, no access
  if (status === 'incomplete' || status === 'incomplete_expired') {
    return 'free'
  }

  // Paused - configurable, for now treat as active (keeps plan)
  // This allows subscription pausing without losing access
  if (status === 'paused') {
    return plan
  }

  // Unpaid - payment failed after grace period, no access
  if (status === 'unpaid') {
    return 'free'
  }

  // All other statuses revert to free (including 'canceled')
  return 'free'
}

/**
 * Handle subscription_schedule.released event
 * This fires when a subscription schedule completes all phases and releases
 * the subscription back to a regular subscription (e.g., after Ultra→Pro transition)
 */
async function handleSubscriptionScheduleReleased(
  supabase: ReturnType<typeof createServiceClient>,
  schedule: Stripe.SubscriptionSchedule
) {
  console.log('Processing subscription schedule released:', schedule.id)

  // Get the released subscription ID
  const subscriptionId = schedule.released_subscription
  if (!subscriptionId) {
    console.log('No released subscription ID, skipping')
    return
  }

  // Clear scheduled downgrade fields for this subscription
  const { error } = await supabase
    .from('subscriptions')
    .update({
      scheduled_downgrade_to: null,
      scheduled_downgrade_date: null,
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('Error clearing scheduled downgrade fields:', error)
    return
  }

  console.log(`Cleared scheduled downgrade for subscription ${subscriptionId}`)
}
