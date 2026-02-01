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

// Validation schema for POST request
const favoriteSchema = z.object({
  favorite_reason: z.string().max(500).optional(),
})

/**
 * GET /api/jobs/[id]/favorite
 * Check if a job is favorited by the current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

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
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'favorite-get')

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

    // Check if job is favorited
    const { data: favorite, error } = await supabase
      .from('user_favorite_jobs')
      .select('id, favorited_at, favorite_reason')
      .eq('user_id', user.id)
      .eq('job_id', jobId)
      .maybeSingle()

    if (error) {
      console.error('Error checking favorite status:', error)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to check favorite status' } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json(
      {
        data: {
          is_favorited: !!favorite,
          favorite: favorite || null
        }
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in GET /api/jobs/[id]/favorite:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to check favorite status' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs/[id]/favorite
 * Add a job to favorites and track the interaction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

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
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'favorite-post')

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
    let body: z.infer<typeof favoriteSchema> = {}
    try {
      const rawBody = await request.json().catch(() => ({}))
      body = favoriteSchema.parse(rawBody)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: validationError.issues } },
          { status: 400, headers: getRateLimitHeaders(rateLimit) }
        )
      }
    }

    // Verify job exists and belongs to user
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Job not found' } },
        { status: 404, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Check user learning settings
    const { data: settings } = await supabase
      .from('user_learning_settings')
      .select('learning_enabled, track_interactions')
      .eq('user_id', user.id)
      .maybeSingle()

    const shouldTrackInteraction = settings?.track_interactions ?? true

    // Add to favorites (upsert to handle re-favoriting)
    const { data: favorite, error: insertError } = await supabase
      .from('user_favorite_jobs')
      .upsert({
        user_id: user.id,
        job_id: jobId,
        favorite_reason: body.favorite_reason || null,
        favorited_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,job_id',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding favorite:', insertError)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: insertError.message } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Track the favorite interaction if enabled
    if (shouldTrackInteraction) {
      await supabase
        .from('user_interactions')
        .insert({
          user_id: user.id,
          job_id: jobId,
          interaction_type: 'favorite',
          metadata: body.favorite_reason ? { reason: body.favorite_reason } : {},
        })
    }

    return NextResponse.json(
      { data: { favorite } },
      { status: 201, headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in POST /api/jobs/[id]/favorite:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to add favorite' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/jobs/[id]/favorite
 * Remove a job from favorites and track the unfavorite interaction
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

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
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.standard, 'favorite-delete')

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

    // Check user learning settings
    const { data: settings } = await supabase
      .from('user_learning_settings')
      .select('track_interactions')
      .eq('user_id', user.id)
      .maybeSingle()

    const shouldTrackInteraction = settings?.track_interactions ?? true

    // Delete from favorites
    const { error: deleteError } = await supabase
      .from('user_favorite_jobs')
      .delete()
      .eq('user_id', user.id)
      .eq('job_id', jobId)

    if (deleteError) {
      console.error('Error removing favorite:', deleteError)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: deleteError.message } },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Track the unfavorite interaction if enabled
    if (shouldTrackInteraction) {
      await supabase
        .from('user_interactions')
        .insert({
          user_id: user.id,
          job_id: jobId,
          interaction_type: 'unfavorite',
          metadata: {},
        })
    }

    return NextResponse.json(
      { data: { success: true } },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in DELETE /api/jobs/[id]/favorite:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to remove favorite' } },
      { status: 500 }
    )
  }
}
