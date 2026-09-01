import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/lib/stripe/plans'
import type { SubscriptionPlan } from '@/lib/supabase/types'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stripe/subscription
 * Returns the current user's subscription status and plan details
 */
export async function GET(request: NextRequest) {
  try {
    const optionalAuth = request.nextUrl.searchParams.get('optionalAuth') === '1'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      if (optionalAuth) {
        return NextResponse.json({ data: { authenticated: false } })
      }

      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'subscription-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Get user's profile with plan, tester, and admin status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_started_at, is_tester, is_admin')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: { code: 'PROFILE_ERROR', message: 'Failed to fetch profile' } },
        { status: 500 }
      )
    }

    const plan = (profile?.subscription_plan || 'free') as SubscriptionPlan
    const limits = PLAN_LIMITS[plan]

    // Use service client to get subscription details
    const serviceClient = createServiceClient()

    // Get subscription details if exists
    const { data: subscription } = await serviceClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Get usage stats for current period
    const today = new Date().toISOString().split('T')[0]
    const { data: quota } = await supabase
      .from('user_job_quotas')
      .select('jobs_fetched')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    return NextResponse.json({
      data: {
        authenticated: true,
        plan,
        limits,
        isTester: profile?.is_tester || false,
        isAdmin: profile?.is_admin || false,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at,
          trialEnd: subscription.trial_end,
        } : null,
        usage: {
          jobsFetchedToday: quota?.jobs_fetched || 0,
          // Add more usage metrics as needed
        },
        startedAt: profile?.subscription_started_at,
      },
    })
  } catch (error) {
    console.error('Subscription fetch error:', error)

    return NextResponse.json(
      {
        error: {
          code: 'SUBSCRIPTION_ERROR',
          message: 'Failed to fetch subscription details',
        },
      },
      { status: 500 }
    )
  }
}
