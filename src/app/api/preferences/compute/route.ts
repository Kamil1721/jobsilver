/**
 * Preference Compute API
 *
 * POST /api/preferences/compute - Recompute preferences for authenticated user
 * GET /api/preferences/compute - Get current preferences without recomputing
 *
 * Rate limited to 1 recompute per minute to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeUserPreferences, getUserPreferences } from '@/lib/ai/preference-learning'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'

// Rate limit config: 1 recompute per minute
const RATE_LIMIT_CONFIG = {
  maxRequests: 1,
  windowSeconds: 60,
  prefix: 'pref-compute',
}

// Rate limit for GET requests: 30 per minute
const GET_RATE_LIMIT_CONFIG = {
  maxRequests: 30,
  windowSeconds: 60,
  prefix: 'pref-compute-get',
}

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

    // Check rate limit
    const identifier = getClientIdentifier(request, user.id)
    const rateLimitResult = checkRateLimit(identifier, RATE_LIMIT_CONFIG, 'compute')

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.resetAt - Math.floor(Date.now() / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please wait before recomputing preferences.',
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

    // Compute preferences
    await computeUserPreferences(user.id)

    // Fetch and return the updated preferences
    const preferences = await getUserPreferences(user.id)

    return NextResponse.json(
      {
        data: {
          preferences,
          computedAt: new Date().toISOString(),
        },
        meta: {
          rateLimit: {
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.resetAt,
          },
        },
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  } catch (error) {
    console.error('[API] Error computing preferences:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to compute preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/preferences/compute - Get current preferences without recomputing
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

    // Check rate limit
    const identifier = getClientIdentifier(request, user.id)
    const rateLimitResult = checkRateLimit(identifier, GET_RATE_LIMIT_CONFIG, 'get')

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

    // Fetch current preferences
    const preferences = await getUserPreferences(user.id)

    if (!preferences) {
      return NextResponse.json(
        {
          data: {
            preferences: null,
            message: 'No preferences computed yet. Use POST to compute.',
          },
        },
        { status: 200, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    return NextResponse.json(
      {
        data: {
          preferences,
        },
      },
      { status: 200, headers: getRateLimitHeaders(rateLimitResult) }
    )
  } catch (error) {
    console.error('[API] Error fetching preferences:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch preferences',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    )
  }
}
