import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  validateInternalAuth,
  validateAdminAuth,
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/security/rate-limit'

// Admin endpoint to trigger job search for a specific user
// Requires either: (1) valid admin session OR (2) valid internal API key
export async function POST(request: NextRequest) {
  try {
    // First, try internal API key authentication (for cron jobs, etc.)
    const internalAuth = validateInternalAuth(request, {
      keyHeader: 'x-api-key',
      envVar: 'INTERNAL_API_KEY',
      requireVercelInProduction: true,
    })

    let isInternalCall = internalAuth.valid

    // If not internal call, require admin user authentication
    if (!isInternalCall) {
      const supabase = await createClient()
      const adminAuth = await validateAdminAuth(supabase)

      if (!adminAuth.valid) {
        return NextResponse.json({ error: adminAuth.error || 'Unauthorized' }, { status: 401 })
      }

      // Rate limit admin calls
      const clientId = getClientIdentifier(request, adminAuth.userId)
      const rateLimit = checkRateLimit(clientId, RATE_LIMITS.admin, 'admin-trigger-search')
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        )
      }
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, job_filters, subscription_plan')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Call the search endpoint with internal API key
    const searchUrl = new URL('/api/jobs/search', request.url)
    const internalApiKey = process.env.INTERNAL_API_KEY

    if (!internalApiKey) {
      return NextResponse.json({ error: 'INTERNAL_API_KEY not configured' }, { status: 500 })
    }

    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': internalApiKey,
      },
      body: JSON.stringify({
        useProfileFilters: true,
        userId: userId, // Pass user ID for internal call
      }),
    })

    const searchResult = await searchResponse.json()

    return NextResponse.json({
      success: true,
      userId,
      searchResult,
    })
  } catch (error) {
    console.error('Admin trigger-search error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger search' },
      { status: 500 }
    )
  }
}
