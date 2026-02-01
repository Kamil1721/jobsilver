import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/plan/select
 *
 * Handles free plan selection during onboarding.
 * Sets has_selected_plan=true and subscription_plan='free'.
 *
 * For paid plans, users are redirected to Stripe checkout instead.
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

    const body = await request.json()
    const { plan } = body

    // Only handle free plan selection here
    // Paid plans should go through /api/stripe/checkout
    if (plan !== 'free') {
      return NextResponse.json(
        { error: { code: 'INVALID_PLAN', message: 'Use /api/stripe/checkout for paid plans' } },
        { status: 400 }
      )
    }

    // Use service client to update the profile
    const serviceClient = createServiceClient()

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        has_selected_plan: true,
        subscription_plan: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile for free plan selection:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to update plan selection' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Free plan selected',
      redirectTo: '/setup',
    })
  } catch (error) {
    console.error('Plan selection error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/plan/select
 *
 * Returns the current plan selection status for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('has_selected_plan, subscription_plan, is_tester')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: 'Failed to fetch profile' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      hasSelectedPlan: profile?.has_selected_plan ?? false,
      currentPlan: profile?.subscription_plan ?? 'free',
      isTester: profile?.is_tester ?? false,
    })
  } catch (error) {
    console.error('Plan status error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
