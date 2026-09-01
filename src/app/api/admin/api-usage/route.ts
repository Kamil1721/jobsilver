import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAdminAuth } from '@/lib/admin/auth'
import { PLAN_LIMITS } from '@/lib/supabase/types'
import {
  apiUsageActionSchema,
  parseRequestBody,
} from '@/lib/security/validation'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/api-usage
 * Get API usage statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: adminAuth.error || 'Forbidden' }, { status: 403 })
    }

    // Rate limiting
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'api-usage-get')

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const monthsParam = searchParams.get('months')

    // Validate and sanitize months param
    const months = Math.min(Math.max(1, parseInt(monthsParam || '6', 10) || 6), 24)

    // Get current month for reference
    const currentMonth = new Date().toISOString().slice(0, 7)

    // Get historical usage data
    const { data: usageHistory, error: usageError } = await supabase
      .from('api_usage')
      .select('*')
      .order('month_year', { ascending: false })
      .limit(months)

    if (usageError) {
      console.error('Error fetching API usage:', usageError)
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
    }

    // Get current month's data (or create placeholder)
    let currentMonthData = usageHistory?.find(u => u.month_year === currentMonth)
    if (!currentMonthData) {
      currentMonthData = {
        id: 'current',
        month_year: currentMonth,
        jobs_fetched: 0,
        requests_made: 0,
        jobs_limit: 250,
        requests_limit: 25,
        rapidapi_plan: process.env.RAPIDAPI_PLAN || 'basic',
        rate_limit_remaining: null,
        rate_limit_reset: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    // Get recent request log for debugging
    const { data: recentRequests, error: requestsError } = await supabase
      .from('api_request_log')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(20)

    if (requestsError) {
      console.error('Error fetching request log:', requestsError)
    }

    // Calculate totals
    const totalJobsFetched = usageHistory?.reduce((sum, u) => sum + (u.jobs_fetched || 0), 0) || 0
    const totalRequests = usageHistory?.reduce((sum, u) => sum + (u.requests_made || 0), 0) || 0

    // Get current plan limits
    const currentPlan = process.env.RAPIDAPI_PLAN || 'basic'
    const planInfo = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.basic

    return NextResponse.json(
      {
        current_month: {
          month: currentMonth,
          jobs_fetched: currentMonthData.jobs_fetched,
          jobs_limit: currentMonthData.jobs_limit,
          jobs_percentage: Math.round((currentMonthData.jobs_fetched / currentMonthData.jobs_limit) * 100),
          requests_made: currentMonthData.requests_made,
          requests_limit: currentMonthData.requests_limit,
          requests_percentage: Math.round((currentMonthData.requests_made / currentMonthData.requests_limit) * 100),
          rate_limit_remaining: currentMonthData.rate_limit_remaining,
          rate_limit_reset: currentMonthData.rate_limit_reset,
        },
        plan: {
          name: currentPlan,
          jobs_limit: planInfo.jobs,
          requests_limit: planInfo.requests,
          price: planInfo.price,
        },
        history: usageHistory || [],
        totals: {
          jobs_fetched: totalJobsFetched,
          requests_made: totalRequests,
          months_tracked: usageHistory?.length || 0,
        },
        recent_requests: recentRequests || [],
      },
      { headers: getRateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    console.error('Error in api-usage API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch API usage' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/api-usage/reset
 * Reset current month's usage (admin only, for testing)
 */
export async function POST(request: NextRequest) {
  try {
    const adminAuth = await checkAdminAuth()

    if (!adminAuth.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    // Rate limiting - stricter for state-changing operations
    const clientId = getClientIdentifier(request, adminAuth.user?.id)
    const rateLimit = checkRateLimit(
      clientId,
      { maxRequests: 5, windowSeconds: 60, prefix: 'admin-api-usage' },
      'api-usage-post'
    )

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      )
    }

    // Validate request body
    const bodyValidation = await parseRequestBody(request, apiUsageActionSchema)

    if (!bodyValidation.success) {
      return NextResponse.json(bodyValidation.error, { status: 400 })
    }

    const { action } = bodyValidation.data

    const supabase = await createClient()

    if (action === 'reset_current_month') {
      const currentMonth = new Date().toISOString().slice(0, 7)

      const { error } = await supabase
        .from('api_usage')
        .update({
          jobs_fetched: 0,
          requests_made: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('month_year', currentMonth)

      if (error) {
        console.error('Error resetting usage:', error)
        return NextResponse.json({ error: 'Failed to reset usage' }, { status: 500 })
      }

      return NextResponse.json(
        { success: true, message: 'Current month usage reset' },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    if (action === 'clear_request_log') {
      // Clear old request logs (keep last 24 hours)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { error, count } = await supabase
        .from('api_request_log')
        .delete({ count: 'exact' })
        .lt('requested_at', cutoff)

      if (error) {
        console.error('Error clearing request log:', error)
        return NextResponse.json({ error: 'Failed to clear request log' }, { status: 500 })
      }

      return NextResponse.json(
        { success: true, deleted: count, message: 'Old request logs cleared' },
        { headers: getRateLimitHeaders(rateLimit) }
      )
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in api-usage POST:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
