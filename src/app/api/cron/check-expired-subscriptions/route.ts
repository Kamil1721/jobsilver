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
    let expirationDate: string | null = sub.current_period_end

    // If trial_end is set and current_period_end is not, or trial_end is before current_period_end,
    // the user was on trial and their first payment failed
    if (sub.trial_end) {
      const trialEndDate = new Date(sub.trial_end)
      const periodEndDate = sub.current_period_end ? new Date(sub.current_period_end) : null

      // Use trial_end if it's the only date or if it's earlier (trial conversion failure)
      if (!periodEndDate || trialEndDate <= periodEndDate) {
        expirationDate = sub.trial_end
      }
    }

    // Skip if no expiration date or not yet expired
    if (!expirationDate || new Date(expirationDate) > new Date(now)) {
      continue
    }

    // Downgrade to free (only if still on pro)
    const { error: updateError, count } = await supabase
      .from('profiles')
      .update({
        subscription_plan: 'free',
        subscription_started_at: null,
      })
      .eq('id', sub.user_id)
      .eq('subscription_plan', 'pro') // Only update if still on pro

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
