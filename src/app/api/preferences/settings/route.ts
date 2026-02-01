import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessFeature } from '@/lib/features/config'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'
import { z } from 'zod'
import type { SubscriptionPlan } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Validation schema for PUT request
const updateSettingsSchema = z.object({
  learning_enabled: z.boolean().optional(),
  track_interactions: z.boolean().optional(),
  use_for_recommendations: z.boolean().optional(),
  use_for_chat: z.boolean().optional(),
})

/**
 * GET /api/preferences/settings
 * Get user's learning settings
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

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'settings-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
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

    // Get user settings
    const { data: settings, error } = await supabase
      .from('user_learning_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch settings' } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json(
        {
          data: {
            settings: {
              learning_enabled: true,
              track_interactions: true,
              use_for_recommendations: true,
              use_for_chat: true,
              last_reset_at: null,
            },
            is_default: true
          }
        },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      {
        data: {
          settings,
          is_default: false
        }
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in GET /api/preferences/settings:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch settings' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/preferences/settings
 * Update learning settings (enable/disable)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, user.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'settings-put')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
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

    // Validate request body
    let body: z.infer<typeof updateSettingsSchema>
    try {
      const rawBody = await request.json()
      body = updateSettingsSchema.parse(rawBody)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: validationError.issues } },
          { status: 400, headers: getRateLimitHeaders(rateLimit) }
        )
      }
      throw validationError
    }

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('user_learning_settings')
      .upsert({
        user_id: user.id,
        ...body,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to update settings' } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      { data: { settings } },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in PUT /api/preferences/settings:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } },
      { status: 500 }
    )
  }
}
