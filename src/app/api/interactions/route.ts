/**
 * Interactions API
 *
 * POST /api/interactions - Track a user interaction with a job
 * GET /api/interactions - Get user's interaction history/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  trackInteractionAndLearn,
  trackInteractionsBatch,
  getUserInteractionStats,
} from '@/lib/ai/track-interaction'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'
import { canAccessFeature } from '@/lib/features/config'
import type { InteractionType, SubscriptionPlan } from '@/lib/supabase/types'

// Valid interaction types
const INTERACTION_TYPES = [
  'view',
  'view_details',
  'save',
  'favorite',
  'apply',
  'discard',
  'skip',
  'unfavorite',
] as const

// Validation schema for single interaction
const interactionSchema = z.object({
  jobId: z.string().uuid('Invalid job ID format'),
  type: z.enum(INTERACTION_TYPES),
  metadata: z.record(z.string(), z.unknown()).optional(),
  durationSeconds: z.number().int().positive().optional(),
})

// Validation schema for batch interactions
const batchInteractionSchema = z.object({
  interactions: z
    .array(
      z.object({
        jobId: z.string().uuid('Invalid job ID format'),
        type: z.enum(INTERACTION_TYPES),
        metadata: z.record(z.string(), z.unknown()).optional(),
        durationSeconds: z.number().int().positive().optional(),
      })
    )
    .min(1, 'At least one interaction required')
    .max(50, 'Maximum 50 interactions per batch'),
})

// Rate limit config: 60 requests per minute for single, 10 for batch
const SINGLE_RATE_LIMIT = {
  maxRequests: 60,
  windowSeconds: 60,
  prefix: 'interaction',
}

const BATCH_RATE_LIMIT = {
  maxRequests: 10,
  windowSeconds: 60,
  prefix: 'interaction-batch',
}

/**
 * POST /api/interactions
 *
 * Track a single interaction or batch of interactions.
 *
 * Body for single: { jobId: string, type: InteractionType, metadata?: object, durationSeconds?: number }
 * Body for batch: { interactions: [{ jobId, type, metadata?, durationSeconds? }] }
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Check feature access - AI learning requires Pro plan or higher
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
            message: 'AI learning features require a Pro plan or higher',
            requiredPlan: 'pro',
          },
        },
        { status: 403 }
      )
    }

    // Check if user has track_interactions enabled
    const { data: learningSettings } = await supabase
      .from('user_learning_settings')
      .select('track_interactions')
      .eq('user_id', user.id)
      .single()

    // Default to true if no settings exist, otherwise respect user setting
    if (learningSettings && learningSettings.track_interactions === false) {
      return NextResponse.json(
        {
          data: {
            success: true,
            skipped: true,
            message: 'Interaction tracking is disabled in your settings',
          },
        },
        { status: 200 }
      )
    }

    const body = await request.json()

    // Check if this is a batch request
    if ('interactions' in body) {
      // Batch request
      const identifier = getClientIdentifier(request, user.id)
      const rateLimitResult = checkRateLimit(identifier, BATCH_RATE_LIMIT, 'batch')

      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.resetAt - Math.floor(Date.now() / 1000)
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many batch requests. Please wait.',
              retryAfter,
            },
          },
          {
            status: 429,
            headers: {
              ...getRateLimitHeaders(rateLimitResult),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }

      // Validate batch request
      const parseResult = batchInteractionSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: parseResult.error.flatten(),
            },
          },
          { status: 400 }
        )
      }

      const { interactions } = parseResult.data

      // Track batch
      const result = await trackInteractionsBatch(
        user.id,
        interactions.map(i => ({
          jobId: i.jobId,
          type: i.type as InteractionType,
          metadata: i.metadata,
          durationSeconds: i.durationSeconds,
        }))
      )

      return NextResponse.json(
        {
          data: {
            success: result.success,
            count: result.count,
          },
        },
        {
          status: result.success ? 200 : 500,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    } else {
      // Single interaction
      const identifier = getClientIdentifier(request, user.id)
      const rateLimitResult = checkRateLimit(identifier, SINGLE_RATE_LIMIT, 'single')

      if (!rateLimitResult.allowed) {
        const retryAfter = rateLimitResult.resetAt - Math.floor(Date.now() / 1000)
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please wait.',
              retryAfter,
            },
          },
          {
            status: 429,
            headers: {
              ...getRateLimitHeaders(rateLimitResult),
              'Retry-After': retryAfter.toString(),
            },
          }
        )
      }

      // Validate single request
      const parseResult = interactionSchema.safeParse(body)
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request body',
              details: parseResult.error.flatten(),
            },
          },
          { status: 400 }
        )
      }

      const { jobId, type, metadata, durationSeconds } = parseResult.data

      // Track interaction
      const result = await trackInteractionAndLearn(
        user.id,
        jobId,
        type as InteractionType,
        metadata,
        durationSeconds
      )

      return NextResponse.json(
        {
          data: {
            success: result.success,
            recomputed: result.recomputed,
          },
        },
        {
          status: result.success ? 200 : 500,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }
  } catch (error) {
    console.error('[API] Error tracking interaction:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to track interaction',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

// Rate limit for GET requests
const GET_RATE_LIMIT = {
  maxRequests: 30,
  windowSeconds: 60,
  prefix: 'interaction-get',
}

/**
 * GET /api/interactions
 *
 * Get user's interaction statistics.
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Rate limiting
    const identifier = getClientIdentifier(request, user.id)
    const rateLimitResult = checkRateLimit(identifier, GET_RATE_LIMIT, 'get')

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.resetAt - Math.floor(Date.now() / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please wait.',
            retryAfter,
          },
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            'Retry-After': retryAfter.toString(),
          },
        }
      )
    }

    // Check feature access - AI learning requires Pro plan or higher
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
            message: 'AI learning features require a Pro plan or higher',
            requiredPlan: 'pro',
          },
        },
        { status: 403, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Get interaction statistics
    const stats = await getUserInteractionStats(user.id)

    return NextResponse.json(
      {
        data: stats,
      },
      { status: 200, headers: getRateLimitHeaders(rateLimitResult) }
    )
  } catch (error) {
    console.error('[API] Error fetching interaction stats:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch interaction statistics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}
