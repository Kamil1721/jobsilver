import { NextRequest, NextResponse } from 'next/server'
import { getAppOrigin, getSafeInternalPath } from '@/lib/security/urls'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request.url)
  const next = getSafeInternalPath(
    request.nextUrl.searchParams.get('next'),
    '/setup?subscription=success'
  )
  const sessionId = request.nextUrl.searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.redirect(new URL('/choose-plan?subscription=invalid', origin))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
    const belongsToUser =
      checkoutSession.metadata?.supabase_user_id === user.id
    const isCompletedSubscription =
      checkoutSession.status === 'complete' &&
      checkoutSession.mode === 'subscription' &&
      Boolean(checkoutSession.subscription)

    if (!belongsToUser || !isCompletedSubscription) {
      return NextResponse.redirect(new URL('/choose-plan?subscription=invalid', origin))
    }

    const { data: updatedProfile, error: updateError } = await createServiceClient()
      .from('profiles')
      .update({
        has_selected_plan: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id')
      .maybeSingle()

    if (updateError || !updatedProfile) {
      console.error('[Checkout Complete] Failed to mark plan selected:', updateError)
      return NextResponse.redirect(new URL('/choose-plan?subscription=pending', origin))
    }

    return NextResponse.redirect(new URL(next, origin))
  } catch (error) {
    console.error('[Checkout Complete] Failed to verify checkout:', error)
    return NextResponse.redirect(new URL('/choose-plan?subscription=pending', origin))
  }
}
