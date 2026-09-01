import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe, getPriceId, type BillingCycle } from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getAppOrigin, getTrustedSameOriginUrl } from '@/lib/security/urls'

export const dynamic = 'force-dynamic'

// Request validation schema
// 3-tier model: 'pro' and 'ultra' plans available for purchase
const checkoutRequestSchema = z.object({
  plan: z.enum(['pro', 'ultra']).or(z.enum(['starter']).transform(() => 'pro' as const)).or(z.enum(['mega']).transform(() => 'ultra' as const)), // Legacy plans redirect
  billingCycle: z.enum(['weekly', 'monthly']).default('monthly'),
  successUrl: z.string().max(2048).optional(),
  cancelUrl: z.string().max(2048).optional(),
})

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for subscription purchase
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

    // Rate limiting - 10 requests per minute
    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowSeconds: 60, prefix: 'checkout' }, 'stripe-checkout')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many checkout requests. Please wait.' } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parseResult = checkoutRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request parameters',
            details: parseResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { plan, billingCycle, successUrl: rawSuccessUrl, cancelUrl: rawCancelUrl } = parseResult.data

    // Validate and sanitize redirect URLs (prevent open redirect attacks)
    const baseUrl = getAppOrigin(request.url)
    const successUrl = getTrustedSameOriginUrl(rawSuccessUrl, baseUrl)
    const cancelUrl = getTrustedSameOriginUrl(rawCancelUrl, baseUrl)
    const successDestination = new URL(
      successUrl || `${baseUrl}/setup?subscription=success`
    )
    const completionUrl = new URL('/api/stripe/checkout/complete', baseUrl)
    completionUrl.searchParams.set(
      'next',
      `${successDestination.pathname}${successDestination.search}${successDestination.hash}`
    )
    // Stripe replaces this literal after checkout. Keep it outside
    // URLSearchParams so the braces are not percent-encoded.
    const verifiedSuccessUrl = `${completionUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`

    // Validate plan has a price ID configured for this billing cycle
    const priceId = getPriceId(plan, billingCycle as BillingCycle)
    if (!priceId) {
      return NextResponse.json(
        {
          error: {
            code: 'PLAN_NOT_CONFIGURED',
            message: `Price not configured for plan: ${plan} (${billingCycle})`,
          },
        },
        { status: 400 }
      )
    }

    // Profile data is display-only here. Billing identity must come from the
    // verified Auth user because profiles.email is user-editable.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const verifiedEmail = user.email

    // Use service client to manage customers table
    const serviceClient = createServiceClient()

    // Check if customer already exists
    let stripeCustomerId: string | null = null
    const { data: existingCustomer } = await serviceClient
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (existingCustomer?.stripe_customer_id) {
      // Verify customer exists in Stripe
      try {
        const stripeCustomer = await stripe.customers.retrieve(
          existingCustomer.stripe_customer_id
        )
        if (!stripeCustomer.deleted) {
          stripeCustomerId = existingCustomer.stripe_customer_id
        }
      } catch {
        // Customer doesn't exist in Stripe, will create new one
        console.log('Stripe customer not found, creating new one')
      }
    }

    // Create new Stripe customer if needed
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: verifiedEmail || undefined,
        name: profile?.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })

      stripeCustomerId = stripeCustomer.id

      // Store customer mapping
      await serviceClient.from('customers').upsert({
        user_id: user.id,
        stripe_customer_id: stripeCustomerId,
      })
    }

    // Check if user already has an active subscription.
    // Fail CLOSED on query error: skipping this guard on a transient DB failure would
    // let an already-subscribed user create a second concurrent subscription.
    // .maybeSingle() so zero rows is a clean null rather than an error.
    const { data: existingSubscription, error: existingSubError } = await serviceClient
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (existingSubError) {
      console.error('Could not verify existing subscription before checkout:', existingSubError)
      return NextResponse.json(
        { error: { code: 'SUBSCRIPTION_CHECK_FAILED', message: 'Could not verify your subscription status. Please try again.' } },
        { status: 500 }
      )
    }

    if (existingSubscription) {
      // Redirect to billing portal for upgrade/change
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: successUrl || `${baseUrl}/dashboard`,
      })

      return NextResponse.json({
        data: {
          url: portalSession.url,
          type: 'portal',
          message: 'Redirecting to billing portal to manage subscription',
        },
      })
    }

    // Check trial eligibility against durable local and Stripe history.
    // The verified Auth email is only a supplemental cross-account signal.
    // Note: Ultra plan has no trial - charges immediately
    let isEligibleForTrial = plan === 'pro' // Only Pro has trial

    if (isEligibleForTrial) {
      try {
        const { count: localSubscriptionCount, error: localHistoryError } =
          await serviceClient
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

        if (localHistoryError) {
          throw localHistoryError
        }

        if ((localSubscriptionCount ?? 0) > 0) {
          isEligibleForTrial = false
        }

        if (isEligibleForTrial && stripeCustomerId) {
          const customerSubscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            limit: 1,
            status: 'all',
          })

          if (customerSubscriptions.data.length > 0) {
            isEligibleForTrial = false
          }
        }

        const existingCustomers =
          isEligibleForTrial && verifiedEmail
            ? await stripe.customers.list({
                email: verifiedEmail,
                limit: 100,
              })
            : null

        // Check any account with the verified Auth email for prior history.
        for (const customer of existingCustomers?.data ?? []) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 1,
            status: 'all', // Include canceled, past_due, etc.
          })

          if (subscriptions.data.length > 0) {
            isEligibleForTrial = false
            break
          }
        }
      } catch (error) {
        // A history-check failure must never grant an unverified trial.
        console.error('Stripe trial eligibility check failed:', error)
        isEligibleForTrial = false
      }
    }

    // Create Checkout session
    // Note: Ultra plan has no trial - charges immediately
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: verifiedSuccessUrl,
      cancel_url: cancelUrl || `${baseUrl}/choose-plan?subscription=canceled`,
      subscription_data: {
        // Only give trial to first-time Pro subscribers (Ultra has no trial)
        ...(isEligibleForTrial && plan === 'pro' && { trial_period_days: 3 }),
        metadata: {
          supabase_user_id: user.id,
          plan: plan,
          billing_cycle: billingCycle,
        },
      },
      metadata: {
        supabase_user_id: user.id,
        plan: plan,
        billing_cycle: billingCycle,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({
      data: {
        url: session.url,
        sessionId: session.id,
        type: 'checkout',
      },
    })
  } catch (error) {
    console.error('Checkout session error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: {
          code: 'CHECKOUT_ERROR',
          message: 'Failed to create checkout session',
        },
      },
      { status: 500 }
    )
  }
}
