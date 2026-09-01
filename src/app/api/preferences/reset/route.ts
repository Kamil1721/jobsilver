import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessFeature } from '@/lib/features/config'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'
import type { SubscriptionPlan } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/preferences/reset
 * Reset all learned preferences for user
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

    // Rate limiting - lower limit for reset (10 per hour)
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, { maxRequests: 10, windowSeconds: 3600, prefix: 'pref-reset' }, 'preferences-reset')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Please try again later.' } },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Get user's plan to check feature access
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, is_tester')
      .eq('id', user.id)
      .single()

    const userPlan = (profile?.subscription_plan || 'free') as SubscriptionPlan
    const isTester = profile?.is_tester || false

    if (!canAccessFeature(userPlan, 'ai_learning', isTester)) {
      return NextResponse.json(
        {
          error: {
            code: 'FEATURE_GATED',
            message: 'AI Learning feature requires Pro plan or higher'
          }
        },
        { status: 403, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Perform all deletions and track errors
    // We want to attempt all operations and only report success if ALL succeed
    const errors: { operation: string; error: string }[] = []

    // Delete user favorites first (depends on nothing)
    const { error: favoritesError } = await supabase
      .from('user_favorite_jobs')
      .delete()
      .eq('user_id', user.id)

    if (favoritesError) {
      console.error('Error deleting favorites:', favoritesError)
      errors.push({ operation: 'favorites', error: favoritesError.message })
    }

    // Delete user interactions
    const { error: interactionsError } = await supabase
      .from('user_interactions')
      .delete()
      .eq('user_id', user.id)

    if (interactionsError) {
      console.error('Error deleting interactions:', interactionsError)
      errors.push({ operation: 'interactions', error: interactionsError.message })
    }

    // Delete user preferences
    const { error: preferencesError } = await supabase
      .from('user_ai_preferences')
      .delete()
      .eq('user_id', user.id)

    if (preferencesError) {
      console.error('Error deleting preferences:', preferencesError)
      errors.push({ operation: 'preferences', error: preferencesError.message })
    }

    // If any deletion failed, return error (don't proceed to claim success)
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'PARTIAL_FAILURE',
            message: 'Some data could not be deleted. Please try again.',
            details: errors,
          },
        },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Update learning settings with reset timestamp
    const { error: settingsError } = await supabase
      .from('user_learning_settings')
      .upsert(
        {
          user_id: user.id,
          last_reset_at: new Date().toISOString(),
          learning_enabled: true,
          track_interactions: true,
          use_for_recommendations: true,
          use_for_chat: true,
        },
        {
          onConflict: 'user_id',
        }
      )

    if (settingsError) {
      console.error('Error updating settings:', settingsError)
      // Non-fatal: data was deleted, just couldn't update timestamp
    }

    return NextResponse.json(
      {
        data: {
          success: true,
          message: 'All learned preferences, interactions, and favorites have been reset.',
          reset_at: new Date().toISOString(),
        },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in POST /api/preferences/reset:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to reset preferences' } },
      { status: 500 }
    )
  }
}
