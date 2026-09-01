import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getAppOrigin, getTrustedSameOriginUrl } from '@/lib/security/urls'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session for subscription management
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
    const rateLimit = checkRateLimit(user.id, { maxRequests: 10, windowSeconds: 60, prefix: 'portal' }, 'stripe-portal')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many portal requests. Please wait.' } },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    // Parse optional return URL
    const baseUrl = getAppOrigin(request.url)
    let returnUrl: string | undefined
    try {
      const body = await request.json()
      if (body.returnUrl && typeof body.returnUrl === 'string') {
        returnUrl = getTrustedSameOriginUrl(body.returnUrl, baseUrl)
      }
    } catch {
      // No body or invalid JSON, use default return URL
    }

    // Use service client to lookup customer
    const serviceClient = createServiceClient()

    // Get customer's Stripe ID
    const { data: customer, error: customerError } = await serviceClient
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (customerError || !customer?.stripe_customer_id) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_CUSTOMER',
            message: 'No billing account found. Please subscribe to a plan first.',
          },
        },
        { status: 404 }
      )
    }

    // Verify customer exists in Stripe
    try {
      const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id)
      if (stripeCustomer.deleted) {
        return NextResponse.json(
          {
            error: {
              code: 'CUSTOMER_DELETED',
              message: 'Billing account no longer exists. Please contact support.',
            },
          },
          { status: 404 }
        )
      }
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Billing account not found in payment system.',
          },
        },
        { status: 404 }
      )
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl || baseUrl + '/dashboard',
    })

    return NextResponse.json({
      data: {
        url: session.url,
      },
    })
  } catch (error) {
    console.error('Portal session error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'PORTAL_ERROR',
          message: 'Failed to create billing portal session',
        },
      },
      { status: 500 }
    )
  }
}
