import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ActiveAnnouncement, SubscriptionPlan } from '@/lib/supabase/types'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Rate limit config for public announcements endpoint
const ANNOUNCEMENTS_RATE_LIMIT = {
  maxRequests: 60,
  windowSeconds: 60,
  prefix: 'announcements',
}

// Valid plans to prevent injection
const VALID_PLANS: SubscriptionPlan[] = ['free', 'pro']

/**
 * GET /api/announcements/active
 * Get active announcements for the current user's plan
 *
 * Query params:
 * - plan: 'free' | 'pro' (optional, defaults to 'free')
 *
 * Returns announcements sorted by priority (highest first)
 */
export async function GET(request: NextRequest) {
  try {
    // P1 FIX: Add rate limiting to public endpoint
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, ANNOUNCEMENTS_RATE_LIMIT, 'active')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const planParam = searchParams.get('plan') || 'free'

    // P2 FIX: Validate plan parameter to prevent injection
    const plan: SubscriptionPlan = VALID_PLANS.includes(planParam as SubscriptionPlan)
      ? (planParam as SubscriptionPlan)
      : 'free'

    const supabase = await createClient()

    // P1 FIX: Try to get actual user plan from auth if available
    // This prevents users from spoofing their plan
    let actualPlan: SubscriptionPlan = plan
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single()

      if (profile?.subscription_plan) {
        actualPlan = profile.subscription_plan as SubscriptionPlan
      }
    }

    // Get active announcements that:
    // 1. Are marked as active
    // 2. Have started (starts_at <= now)
    // 3. Haven't ended yet (ends_at is null or > now)
    // P1 FIX: Include target_plans in initial query to avoid N+1
    const now = new Date().toISOString()

    // P0 FIX: Use parameterized query instead of string interpolation
    // Supabase's .or() with string interpolation can be vulnerable
    // Instead, we'll filter ends_at in application code after fetching
    const { data: announcements, error } = await supabase
      .from('admin_announcements')
      .select('id, message, type, priority, target_plans, ends_at, updated_at')
      .eq('is_active', true)
      .lte('starts_at', now)
      .order('priority', { ascending: false })

    if (error) {
      // P0 FIX: Gracefully handle missing table (migration not run)
      // PostgreSQL error code 42P01 = undefined_table
      const errorMessage = error.message || ''
      const errorCode = (error as { code?: string }).code
      if (errorCode === '42P01' || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        console.warn('[Announcements] Table admin_announcements does not exist. Run migration 20260205_admin_improvements.sql')
        return NextResponse.json(
          { announcements: [] },
          { headers: getRateLimitHeaders(rateLimit) }
        )
      }
      console.error('Error fetching announcements:', error)
      return NextResponse.json(
        { error: 'Failed to fetch announcements' },
        { status: 500, headers: getRateLimitHeaders(rateLimit) }
      )
    }

    // Filter announcements in application code
    // This avoids SQL injection and handles the complex logic safely
    const filteredAnnouncements: ActiveAnnouncement[] = []

    for (const ann of announcements || []) {
      // Check if announcement has ended (ends_at is null = never ends, or ends_at > now)
      const endsAt = ann.ends_at as string | null
      if (endsAt !== null && new Date(endsAt) <= new Date(now)) {
        continue // Skip expired announcements
      }

      // Check target_plans - null means all plans
      const targetPlans = ann.target_plans as string[] | null
      if (targetPlans === null || targetPlans.includes(actualPlan)) {
        filteredAnnouncements.push({
          id: ann.id,
          message: ann.message,
          type: ann.type as ActiveAnnouncement['type'],
          priority: ann.priority,
          updated_at: ann.updated_at as string,
        })
      }
    }

    return NextResponse.json(
      { announcements: filteredAnnouncements },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in announcements API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    )
  }
}
