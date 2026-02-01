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
import type { SubscriptionPlan, ConfidenceLevel } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// Validation constraints for JSONB fields
const MAX_KEY_LENGTH = 100
const MAX_ENTRIES = 20
const WEIGHT_MIN = -1
const WEIGHT_MAX = 1
const KEY_PATTERN = /^[\w\s\-&.,'()]+$/  // Alphanumeric, spaces, common punctuation

// Reusable validator for weighted preference maps
const weightedMapSchema = z.record(
  z.string().max(MAX_KEY_LENGTH).regex(KEY_PATTERN, 'Invalid characters in key'),
  z.number().min(WEIGHT_MIN).max(WEIGHT_MAX)
).refine(
  (obj) => Object.keys(obj).length <= MAX_ENTRIES,
  { message: `Maximum ${MAX_ENTRIES} entries allowed` }
)

// Validation schema for PUT request (partial update)
const updatePreferencesSchema = z.object({
  preferred_industries: weightedMapSchema.optional(),
  preferred_company_sizes: weightedMapSchema.optional(),
  preferred_job_types: weightedMapSchema.optional(),
  remote_preference: weightedMapSchema.optional(),
  preferred_salary_min: z.number().int().min(0).max(10000000).nullable().optional(),
  preferred_salary_max: z.number().int().min(0).max(10000000).nullable().optional(),
  salary_currency: z.string().max(3).nullable().optional(),
  keyword_weights: weightedMapSchema.optional(),
  preferred_locations: weightedMapSchema.optional(),
  preferred_companies: weightedMapSchema.optional(),
  avoided_companies: z.array(
    z.string().max(MAX_KEY_LENGTH).regex(KEY_PATTERN, 'Invalid characters')
  ).max(50, 'Maximum 50 avoided companies').optional(),
})

/**
 * GET /api/preferences
 * Get user's learned preferences
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
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'preferences-get')

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

    // Get user preferences
    const { data: preferences, error } = await supabase
      .from('user_ai_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching preferences:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch preferences' } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Return default preferences if none exist
    if (!preferences) {
      return NextResponse.json(
        {
          data: {
            preferences: null,
            has_preferences: false,
            message: 'No preferences computed yet. Interact with jobs to build your preference profile.'
          }
        },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      {
        data: {
          preferences,
          has_preferences: true
        }
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in GET /api/preferences:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/preferences
 * Update/override specific preferences (user corrections)
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
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'preferences-put')

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
    let body: z.infer<typeof updatePreferencesSchema>
    try {
      const rawBody = await request.json()
      body = updatePreferencesSchema.parse(rawBody)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: validationError.issues } },
          { status: 400, headers: getRateLimitHeaders(rateLimit) }
        )
      }
      throw validationError
    }

    // Check if preferences exist
    const { data: existingPreferences } = await supabase
      .from('user_ai_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Build update data
    const updateData: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    }

    let preferences
    let error

    if (existingPreferences) {
      // Update existing preferences
      const result = await supabase
        .from('user_ai_preferences')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()

      preferences = result.data
      error = result.error
    } else {
      // Insert new preferences with defaults
      const result = await supabase
        .from('user_ai_preferences')
        .insert({
          user_id: user.id,
          confidence_level: 'none' as ConfidenceLevel,
          ...updateData,
        })
        .select()
        .single()

      preferences = result.data
      error = result.error
    }

    if (error) {
      console.error('Error updating preferences:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to update preferences' } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      { data: { preferences } },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in PUT /api/preferences:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' } },
      { status: 500 }
    )
  }
}
