import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe, getPlanFromPriceId, isValidPlan } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import type { SubscriptionPlan } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Disable body parsing for webhook signature verification
export const runtime = 'nodejs'

// In-memory cache for processed event IDs (prevents duplicate processing within same instance)
// Note: For multi-instance deployments, use Redis or a database table instead
const processedEvents = new Map<string, number>()
const EVENT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

type SupabaseServiceClient = ReturnType<typeof createServiceClient>

interface SubscriptionReconciliationResult {
  success: true
  applied: boolean
  ignored_reason: string | null
  user_id: string
  stripe_subscription_id: string
  ledger_plan: string
  entitled_plan: SubscriptionPlan
  previous_plan: string
  previous_subscription_started_at: string | null
  production_mode: boolean
  subscription_started_at: string | null
  schedule_cleared: boolean
}

interface ReconcileSubscriptionOptions {
  knownUserId?: string
  forceStatus?: Stripe.Subscription.Status
  clearScheduledDowngrade?: boolean
}

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

function getStripeReferenceId(
  reference: string | { id: string } | null | undefined
): string | null {
  if (typeof reference === 'string') return reference
  return reference?.id ?? null
}

function toIsoTimestamp(timestamp: number | null | undefined): string | null {
  return timestamp == null ? null : new Date(timestamp * 1000).toISOString()
}

function isStripeResourceMissing(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeInvalidRequestError
    && error.code === 'resource_missing'
}

function parseReconciliationResult(
  value: unknown,
  subscriptionId: string
): SubscriptionReconciliationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid reconciliation result for subscription ${subscriptionId}`)
  }

  const result = value as Record<string, unknown>
  const entitledPlan = result.entitled_plan

  if (
    result.success !== true
    || typeof result.applied !== 'boolean'
    || typeof result.user_id !== 'string'
    || typeof result.stripe_subscription_id !== 'string'
    || typeof result.ledger_plan !== 'string'
    || typeof result.previous_plan !== 'string'
    || typeof result.production_mode !== 'boolean'
    || typeof result.schedule_cleared !== 'boolean'
    || (result.ignored_reason !== null && typeof result.ignored_reason !== 'string')
    || (
      result.previous_subscription_started_at !== null
      && typeof result.previous_subscription_started_at !== 'string'
    )
    || (
      result.subscription_started_at !== null
      && typeof result.subscription_started_at !== 'string'
    )
    || (!isValidPlan(entitledPlan as string) && entitledPlan !== 'free')
  ) {
    throw new Error(`Malformed reconciliation result for subscription ${subscriptionId}`)
  }

  return result as unknown as SubscriptionReconciliationResult
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
        await handleSubscriptionChanged(supabase, subscription)
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
 * Creates/updates the customer record and reconciles current Stripe state.
 */
async function handleCheckoutCompleted(
  supabase: SupabaseServiceClient,
  session: Stripe.Checkout.Session
) {
  console.log('Processing checkout.session.completed:', session.id)

  const userId = session.metadata?.supabase_user_id
  const subscriptionId = getStripeReferenceId(session.subscription)

  if (!userId) {
    throw new Error(`Checkout session ${session.id} is missing supabase_user_id metadata`)
  }

  // Non-subscription Checkout sessions have nothing to reconcile.
  if (!subscriptionId) {
    console.info(`Checkout session ${session.id} has no subscription; no reconciliation needed`)
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const customerId = getStripeReferenceId(subscription.customer)
  const sessionCustomerId = getStripeReferenceId(session.customer)

  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} is missing a Stripe customer`)
  }

  if (sessionCustomerId && sessionCustomerId !== customerId) {
    throw new Error(`Checkout session ${session.id} customer does not match its subscription`)
  }

  const { error: customerError } = await supabase.from('customers').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
  }, {
    onConflict: 'user_id',
  })

  if (customerError) {
    throw new Error(`Failed to persist Stripe customer for user ${userId}: ${customerError.message}`)
  }

  await reconcileSubscription(supabase, subscription, { knownUserId: userId })
  console.log(`Checkout completed for user ${userId}`)
}

/**
 * Stripe does not guarantee webhook ordering. Created/updated event payloads
 * are snapshots, so always retrieve the current object before applying them.
 */
async function handleSubscriptionChanged(
  supabase: SupabaseServiceClient,
  eventSubscription: Stripe.Subscription
) {
  const currentSubscription = await stripe.subscriptions.retrieve(eventSubscription.id)
  await reconcileSubscription(supabase, currentSubscription)
}

/**
 * Handle customer.subscription.deleted event
 * Retrieves current state first. If Stripe reports that the terminal resource
 * no longer exists, the signed deletion snapshot is safe to use for revocation.
 */
async function handleSubscriptionDeleted(
  supabase: SupabaseServiceClient,
  eventSubscription: Stripe.Subscription
) {
  console.log('Processing subscription deletion:', eventSubscription.id)

  try {
    const currentSubscription = await stripe.subscriptions.retrieve(eventSubscription.id)
    await reconcileSubscription(supabase, currentSubscription, { forceStatus: 'canceled' })
  } catch (error) {
    if (!isStripeResourceMissing(error)) throw error

    console.info(
      `Stripe subscription ${eventSubscription.id} is no longer retrievable; applying terminal revocation`
    )
    await reconcileSubscription(supabase, eventSubscription, { forceStatus: 'canceled' })
  }
}

/**
 * Handle invoice.payment_succeeded event
 * Reconciles the current subscription rather than the invoice snapshot.
 */
async function handleInvoicePaymentSucceeded(
  supabase: SupabaseServiceClient,
  invoice: Stripe.Invoice
) {
  const subscriptionId = getStripeReferenceId(
    invoice.parent?.subscription_details?.subscription
  )
  if (!subscriptionId) return

  console.log('Processing payment succeeded for subscription:', subscriptionId)

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await reconcileSubscription(supabase, subscription)
}

/**
 * Handle invoice.payment_failed event
 * Reconciles Stripe's current subscription status. A stale failure event must
 * not overwrite a later successful payment or cancellation.
 */
async function handleInvoicePaymentFailed(
  supabase: SupabaseServiceClient,
  invoice: Stripe.Invoice
) {
  const subscriptionId = getStripeReferenceId(
    invoice.parent?.subscription_details?.subscription
  )
  if (!subscriptionId) return

  console.log('Processing payment failed for subscription:', subscriptionId)

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const result = await reconcileSubscription(supabase, subscription)
  const firstItem = subscription.items.data[0]

  if (subscription.status !== 'past_due') {
    console.info(
      `Payment failure for ${subscriptionId} is stale relative to current status ${subscription.status}`
    )
    return
  }

  const isFirstCharge = invoice.billing_reason === 'subscription_create'
  const relevantEnd = isFirstCharge && subscription.trial_end
    ? subscription.trial_end
    : firstItem?.current_period_end

  console.log(
    `${isFirstCharge ? 'First charge' : 'Renewal'} failed for user ${result.user_id}; `
    + `current entitlement is ${result.entitled_plan} until ${toIsoTimestamp(relevantEnd) ?? 'no valid expiry'}`
  )
}

/**
 * Handle subscription_schedule.released event
 * This fires when a subscription schedule completes all phases and releases
 * the subscription back to a regular subscription (e.g., after Ultra→Pro transition)
 */
async function handleSubscriptionScheduleReleased(
  supabase: SupabaseServiceClient,
  schedule: Stripe.SubscriptionSchedule
) {
  console.log('Processing subscription schedule released:', schedule.id)

  // Get the released subscription ID
  const subscriptionId = schedule.released_subscription
  if (!subscriptionId) {
    console.info(`Released schedule ${schedule.id} has no associated subscription; no reconciliation needed`)
    return
  }

  // Stripe does not guarantee webhook ordering. Retrieve the current
  // subscription so the price active at release time drives entitlement.
  const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId)
  const result = await reconcileSubscription(supabase, currentSubscription, {
    clearScheduledDowngrade: true,
  })

  console.log(
    result.schedule_cleared
      ? `Cleared scheduled downgrade for subscription ${subscriptionId}`
      : `Released schedule ${schedule.id} had no local downgrade marker to clear`
  )
}

async function resolveSubscriptionUserId(
  supabase: SupabaseServiceClient,
  subscription: Stripe.Subscription,
  knownUserId?: string
): Promise<string> {
  const customerId = getStripeReferenceId(subscription.customer)
  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} is missing a Stripe customer`)
  }

  const { data: ledgerOwner, error: ledgerError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle()

  if (ledgerError) {
    throw new Error(`Failed to look up subscription ${subscription.id}: ${ledgerError.message}`)
  }

  const { data: customerOwner, error: customerError } = await supabase
    .from('customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (customerError) {
    throw new Error(`Failed to look up Stripe customer ${customerId}: ${customerError.message}`)
  }

  const metadataUserId = subscription.metadata?.supabase_user_id
  const candidateUserIds = [
    ledgerOwner?.user_id,
    knownUserId,
    metadataUserId,
    customerOwner?.user_id,
  ].filter((value): value is string => Boolean(value))

  if (new Set(candidateUserIds).size > 1) {
    throw new Error(`Conflicting user ownership for subscription ${subscription.id}`)
  }

  const userId = candidateUserIds[0]
  if (!userId) {
    throw new Error(`Cannot find a user for subscription ${subscription.id}`)
  }

  return userId
}

async function reconcileSubscription(
  supabase: SupabaseServiceClient,
  subscription: Stripe.Subscription,
  options: ReconcileSubscriptionOptions = {}
): Promise<SubscriptionReconciliationResult> {
  const customerId = getStripeReferenceId(subscription.customer)
  if (!customerId) {
    throw new Error(`Subscription ${subscription.id} is missing a Stripe customer`)
  }

  const userId = await resolveSubscriptionUserId(
    supabase,
    subscription,
    options.knownUserId
  )
  const currentItem = subscription.items.data[0]
  const priceId = currentItem?.price.id ?? null
  const priceMapping = priceId ? getPlanFromPriceId(priceId) : null
  const plan = priceMapping && isValidPlan(priceMapping.plan)
    ? priceMapping.plan
    : null
  const status = options.forceStatus ?? subscription.status

  if (!plan) {
    console.warn('Webhook: subscription price is not mapped', {
      subscriptionId: subscription.id,
      priceId,
      status,
    })
  } else if (subscription.metadata?.plan && subscription.metadata.plan !== plan) {
    console.warn('Webhook: subscription metadata plan differs from current price', {
      subscriptionId: subscription.id,
      metadataPlan: subscription.metadata.plan,
      pricePlan: plan,
    })
  }

  const { data, error } = await supabase.rpc('reconcile_stripe_subscription', {
    p_user_id: userId,
    p_stripe_subscription_id: subscription.id,
    p_stripe_customer_id: customerId,
    p_status: status,
    p_plan: plan,
    p_price_id: priceId,
    p_current_period_start: toIsoTimestamp(currentItem?.current_period_start),
    p_current_period_end: toIsoTimestamp(currentItem?.current_period_end),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_canceled_at: toIsoTimestamp(subscription.canceled_at ?? subscription.ended_at),
    p_trial_start: toIsoTimestamp(subscription.trial_start),
    p_trial_end: toIsoTimestamp(subscription.trial_end),
    p_clear_scheduled_downgrade: options.clearScheduledDowngrade ?? false,
  })

  if (error) {
    throw new Error(`Failed to reconcile subscription ${subscription.id}: ${error.message}`)
  }

  const result = parseReconciliationResult(data, subscription.id)
  if (result.user_id !== userId) {
    throw new Error(`Reconciliation returned the wrong user for subscription ${subscription.id}`)
  }

  if (!result.applied) {
    console.info('Ignored stale Stripe subscription state', {
      subscriptionId: subscription.id,
      reason: result.ignored_reason,
    })
    return result
  }

  const isUpgrade = result.previous_plan === 'free' && result.entitled_plan !== 'free'
  const previousStartedAtMs = result.previous_subscription_started_at
    ? new Date(result.previous_subscription_started_at).getTime()
    : Number.NaN
  const recentlyUpgraded = Number.isFinite(previousStartedAtMs)
    && Date.now() - previousStartedAtMs < 5 * 60 * 1000

  if (isUpgrade && result.production_mode && !recentlyUpgraded) {
    console.log(
      `Plan upgrade detected for user ${userId}: ${result.previous_plan} -> ${result.entitled_plan}. `
      + 'Triggering instant curation.'
    )

    const internalSecret = process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_SECRET
    if (internalSecret) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/curate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
          'X-User-Id': userId,
        },
      }).catch(error => console.error('Failed to trigger upgrade curation:', error))
    } else {
      console.warn('INTERNAL_API_KEY not configured, skipping curation trigger')
    }
  } else if (isUpgrade && recentlyUpgraded) {
    console.log(`Plan upgrade for user ${userId} skipped curation (recently upgraded)`)
  }

  console.log(
    `Subscription reconciled for user ${userId}: ${result.ledger_plan} `
    + `(${status}, entitlement ${result.entitled_plan})`
  )

  return result
}
