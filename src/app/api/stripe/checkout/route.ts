import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe, getPriceId, isValidPlan, isValidBillingCycle, type BillingCycle } from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Request validation schema
// 2-tier model: Only 'pro' plan available for purchase
const checkoutRequestSchema = z.object({
  plan: z.enum(['pro']).or(z.enum(['starter', 'ultra']).transform(() => 'pro' as const)), // Legacy plans redirect to pro
  billingCycle: z.enum(['weekly', 'monthly']).default('monthly'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
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

    const { plan, billingCycle, successUrl, cancelUrl } = parseResult.data

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

    // Get user's email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    const email = profile?.email || user.email

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
      } catch (error) {
        // Customer doesn't exist in Stripe, will create new one
        console.log('Stripe customer not found, creating new one')
      }
    }

    // Create new Stripe customer if needed
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: email || undefined,
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

    // Check if user already has an active subscription
    const { data: existingSubscription } = await serviceClient
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .single()

    if (existingSubscription) {
      // Redirect to billing portal for upgrade/change
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: successUrl || `${getBaseUrl(request)}/dashboard`,
      })

      return NextResponse.json({
        data: {
          url: portalSession.url,
          type: 'portal',
          message: 'Redirecting to billing portal to manage subscription',
        },
      })
    }

    // Create Checkout session
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
      success_url: successUrl || `${getBaseUrl(request)}/setup?subscription=success`,
      cancel_url: cancelUrl || `${getBaseUrl(request)}/choose-plan?subscription=canceled`,
      subscription_data: {
        trial_period_days: 3,
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

/**
 * Get base URL from request
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}`
}
