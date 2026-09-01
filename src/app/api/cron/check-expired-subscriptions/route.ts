import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/check-expired-subscriptions
 *
 * Daily cron job that acts as a safety net for subscription expiration.
 * Downgrades users whose subscriptions have expired but weren't properly
 * handled by Stripe webhooks.
 *
 * Scenarios this handles:
 * - Trial conversion failed and trial has ended
 * - Renewal failed and paid period has ended
 * - Stripe webhook was missed or failed
 *
 * Schedule: Daily at 6 AM (runs alongside daily-curation)
 */
/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function GET(request: Request) {
  // Verify cron secret using timing-safe comparison
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Expired subscriptions cron: CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const expectedBearer = `Bearer ${cronSecret}`
  if (!authHeader || authHeader.length !== expectedBearer.length || !safeCompare(authHeader, expectedBearer)) {
    console.error('Expired subscriptions cron: Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('Running expired subscriptions check...')

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  // Find subscriptions that are:
  // 1. In a failed/canceled state (past_due, unpaid, canceled)
  // 2. Have an expired current_period_end (or trial_end for trial conversions)
  const { data: expiredSubscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end, trial_end, stripe_subscription_id')
    .in('status', ['past_due', 'unpaid', 'canceled'])

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
    console.log('No expired subscriptions to process')
    return NextResponse.json({ checked: 0, downgraded: 0 })
  }

  let downgraded = 0
  const errors: string[] = []

  for (const sub of expiredSubscriptions) {
    // Determine the relevant expiration date
    // For past_due, use current_period_end (they paid for this period)
    // But if trial_end exists and is more recent, use that (trial conversion failed)
    // Use the LATEST paid-through date. A historical trial_end always predates the
    // current paid period, so preferring the earlier date would downgrade past_due
    // users who already paid for the current period (trial_end only matters when the
    // subscription never converted, i.e. there is no later current_period_end).
    let expirationDate: string | null = sub.current_period_end

    if (sub.trial_end) {
      const trialEndDate = new Date(sub.trial_end)
      const periodEndDate = sub.current_period_end ? new Date(sub.current_period_end) : null

      if (!periodEndDate || trialEndDate > periodEndDate) {
        expirationDate = sub.trial_end
      }
    }

    // Skip if no expiration date or not yet expired
    if (!expirationDate || new Date(expirationDate) > new Date(now)) {
      continue
    }

    // Downgrade to free (only if still on pro or ultra)
    const { error: updateError, count } = await supabase
      .from('profiles')
      .update(
        {
          subscription_plan: 'free',
          subscription_started_at: null,
        },
        { count: 'exact' } // without this supabase-js returns count: null and downgrades are invisible
      )
      .eq('id', sub.user_id)
      .in('subscription_plan', ['pro', 'ultra']) // Update if on pro or ultra

    if (updateError) {
      errors.push(`User ${sub.user_id}: ${updateError.message}`)
      console.error(`Error downgrading user ${sub.user_id}:`, updateError)
    } else if (count && count > 0) {
      downgraded++
      console.log(
        `Downgraded user ${sub.user_id} - ` +
        `status: ${sub.status}, expired: ${expirationDate}`
      )
    }
  }

  const result = {
    checked: expiredSubscriptions.length,
    downgraded,
    errors: errors.length > 0 ? errors : undefined,
  }

  console.log('Expired subscriptions check complete:', result)
  return NextResponse.json(result)
}
