import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Job, AllSubscriptionPlans } from '@/lib/supabase/types'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'
import { getEffectivePlan } from '@/lib/features/config'
import { getDailyJobLimit } from '@/lib/stripe/plans'

export const dynamic = 'force-dynamic'

const MAX_FETCH_ATTEMPTS = 3

interface CurationResult {
  success: boolean
  jobsCurated: number
  jobsFailed: number
  message: string
}

/**
 * Check if this is an internal call from webhook/cron
 * Returns user ID if valid internal call, null otherwise
 */
function getInternalCallUserId(request: NextRequest): string | null {
  const internalSecret = request.headers.get('X-Internal-Secret')
  const userId = request.headers.get('X-User-Id')

  // Verify internal secret matches - require env var to be set
  // Support both INTERNAL_API_KEY (preferred) and INTERNAL_API_SECRET (legacy) for backwards compatibility
  const expectedSecret = process.env.INTERNAL_API_KEY || process.env.INTERNAL_API_SECRET
  if (!expectedSecret) {
    console.warn('INTERNAL_API_KEY not configured')
    return null
  }
  if (internalSecret === expectedSecret && userId) {
    return userId
  }
  return null
}

// Curate daily jobs for a user - fetch, scrape, and prepare
export async function POST(request: NextRequest): Promise<NextResponse<CurationResult | { error: string }>> {
  try {
    // Check for internal call (from webhook/cron)
    const internalUserId = getInternalCallUserId(request)
    let userId: string
    let supabase: Awaited<ReturnType<typeof createClient>>

    if (internalUserId) {
      // Internal call - use service client and provided user ID
      console.log(`Internal curation call for user: ${internalUserId}`)
      supabase = createServiceClient() as unknown as Awaited<ReturnType<typeof createClient>>
      userId = internalUserId
    } else {
      // Regular user call - authenticate via session
      supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id

      // Rate limiting - only for user calls (not internal)
      const clientId = getClientIdentifier(request, userId)
      const rateLimit = checkRateLimit(
        clientId,
        { maxRequests: 3, windowSeconds: 60, prefix: 'curate' },
        'jobs-curate'
      )

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many curation requests. Please try again later.' },
          {
            status: 429,
            headers: getRateLimitHeaders(rateLimit),
          }
        )
      }
    }

    // Check if production mode is enabled and get subscription plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('production_mode, job_filters, screening_answers, cv_url, subscription_plan, is_tester, is_admin')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 400 })
    }

    // P0 FIX: Server-side plan validation - free users cannot use auto-curation
    const billingPlan = (profile.subscription_plan || 'free') as AllSubscriptionPlans
    const effectivePlan = getEffectivePlan(billingPlan, profile.is_tester || profile.is_admin)
    const dailyJobLimit = getDailyJobLimit(effectivePlan)

    if (dailyJobLimit === 0) {
      return NextResponse.json({
        error: 'UPGRADE_REQUIRED',
        message: 'Auto job curation requires a Starter plan or higher',
        requiredPlan: 'starter',
      }, { status: 403 })
    }

    if (!profile.production_mode) {
      return NextResponse.json({
        error: 'Production mode is not enabled'
      }, { status: 400 })
    }

    if (!profile.job_filters) {
      return NextResponse.json({
        error: 'Please configure job preferences first'
      }, { status: 400 })
    }

    // Check how many jobs user already has for today (plan-based limit)
    const today = new Date().toISOString().split('T')[0]
    const { count: existingJobsCount, error: existingJobsCountError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .in('status', ['discovered', 'saved'])

    if (existingJobsCountError || existingJobsCount === null) {
      throw new Error(`Failed to count today's jobs${existingJobsCountError ? `: ${existingJobsCountError.message}` : ''}`)
    }

    const jobsNeeded = Math.max(0, dailyJobLimit - existingJobsCount)

    if (jobsNeeded === 0) {
      return NextResponse.json({
        success: true,
        jobsCurated: 0,
        jobsFailed: 0,
        message: 'Daily job quota already met'
      })
    }

    // Fetch and curate jobs
    const result = await curateJobsForUser(
      supabase,
      userId,
      jobsNeeded
    )

    return NextResponse.json({
      ...result,
      plan: billingPlan,
      dailyLimit: dailyJobLimit,
      existingToday: existingJobsCount,
    })
  } catch (error) {
    console.error('Error curating jobs:', error)
    return NextResponse.json(
      { error: 'Failed to curate jobs' },
      { status: 500 }
    )
  }
}

async function curateJobsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  targetCount: number
): Promise<CurationResult> {
  let jobsCurated = 0
  let attempts = 0

  while (jobsCurated < targetCount && attempts < MAX_FETCH_ATTEMPTS) {
    attempts++

    // Fetch jobs from external sources based on filters
    // This would call your existing job search logic
    const jobs = await fetchPersonalizedJobs(supabase, userId, targetCount - jobsCurated)

    if (jobs.length === 0) {
      break // No more jobs available
    }

    // Search persists each returned job. Counting rows preserves the curation
    // contract without violating jobs' unique constraints.
    jobsCurated += Math.min(jobs.length, targetCount - jobsCurated)
  }

  return {
    success: true,
    jobsCurated,
    jobsFailed: 0,
    message: jobsCurated >= targetCount
      ? `Successfully curated ${jobsCurated} jobs`
      : `Curated ${jobsCurated} jobs (target was ${targetCount}, limited by available matches)`
  }
}

async function fetchPersonalizedJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  count: number
): Promise<Partial<Job>[]> {
  // Get existing job external IDs and company+title combos to avoid duplicates
  // Include all statuses - discarded jobs block same company+title until 60-day cleanup
  const { data: existingJobs, error: existingJobsError } = await supabase
    .from('jobs')
    .select('external_id, company, title')
    .eq('user_id', userId)

  if (existingJobsError) {
    throw new Error(`Failed to load existing jobs: ${existingJobsError.message}`)
  }

  const existingIds = new Set(existingJobs?.map(j => j.external_id) || [])
  try {
    const response = await fetch(
      `${process.env.INTERNAL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          useProfileFilters: true,
          limit: count,
          userId,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Internal search returned ${response.status} during curation`)
    }

    const data = await response.json()
    if (!Array.isArray(data.jobs)) {
      throw new Error('Internal search returned an invalid jobs payload')
    }

    return data.jobs
      .filter((job: Job) => !existingIds.has(job.external_id))
      .slice(0, count)
  } catch (error) {
    console.error('Error fetching curated jobs from internal search:', error)
    throw error instanceof Error ? error : new Error('Internal search failed during curation')
  }
}
