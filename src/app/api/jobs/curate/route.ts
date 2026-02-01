import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { JobFilters, Job, AllSubscriptionPlans } from '@/lib/supabase/types'
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitHeaders,
} from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// Plan-based daily job limits
const PLAN_JOB_LIMITS: Record<AllSubscriptionPlans, number> = {
  free: 0,        // Free users cannot use auto-curation
  starter: 10,    // Starter: 10 jobs/day
  basic: 15,      // Basic: 15 jobs/day
  pro: 20,        // Pro: 20 jobs/day
  ultra: 30,      // Ultra: 30 jobs/day
  mega: 50,       // Mega: 50 jobs/day
}

const DEFAULT_DAILY_JOB_TARGET = 20
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
      .select('production_mode, job_filters, screening_answers, cv_url, subscription_plan')
      .eq('id', userId)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 400 })
    }

    // P0 FIX: Server-side plan validation - free users cannot use auto-curation
    const userPlan = (profile.subscription_plan || 'free') as AllSubscriptionPlans
    const dailyJobLimit = PLAN_JOB_LIMITS[userPlan] ?? 0

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

    const jobFilters = profile.job_filters as JobFilters

    // Check how many jobs user already has for today (plan-based limit)
    const today = new Date().toISOString().split('T')[0]
    const { count: existingJobsCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00`)
      .in('status', ['discovered', 'saved'])

    const jobsNeeded = Math.max(0, dailyJobLimit - (existingJobsCount || 0))

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
      jobFilters,
      jobsNeeded,
      dailyJobLimit
    )

    return NextResponse.json({
      ...result,
      plan: userPlan,
      dailyLimit: dailyJobLimit,
      existingToday: existingJobsCount || 0,
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
  filters: JobFilters,
  targetCount: number,
  dailyLimit: number
): Promise<CurationResult> {
  let jobsCurated = 0
  let jobsFailed = 0
  let attempts = 0

  while (jobsCurated < targetCount && attempts < MAX_FETCH_ATTEMPTS) {
    attempts++

    // Fetch jobs from external sources based on filters
    // This would call your existing job search logic
    const jobs = await fetchPersonalizedJobs(supabase, userId, filters, targetCount - jobsCurated)

    if (jobs.length === 0) {
      break // No more jobs available
    }

    for (const job of jobs) {
      if (jobsCurated >= targetCount) break

      try {
        // Save job to database
        const { data: savedJob, error: saveError } = await supabase
          .from('jobs')
          .insert({
            user_id: userId,
            external_id: job.external_id,
            source: job.source,
            title: job.title,
            company: job.company,
            company_logo_url: job.company_logo_url,
            location: job.location,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            salary_currency: job.salary_currency,
            job_type: job.job_type,
            remote: job.remote,
            remote_type: job.remote_type,
            description: job.description,
            application_url: job.application_url,
            match_score: job.match_score,
            status: 'discovered', // All jobs start as discovered (manual apply model)
            platform_detected: job.platform_detected,
            auto_apply_status: 'manual',
            ats_source: job.ats_source,
            ats_job_id: job.ats_job_id,
          })
          .select()
          .single()

        if (saveError) {
          console.error('Failed to save job:', saveError)
          jobsFailed++
          continue
        }

        jobsCurated++
      } catch (err) {
        console.error('Error processing job:', err)
        jobsFailed++
      }
    }
  }

  return {
    success: true,
    jobsCurated,
    jobsFailed,
    message: jobsCurated >= targetCount
      ? `Successfully curated ${jobsCurated} jobs`
      : `Curated ${jobsCurated} jobs (target was ${targetCount}, limited by available matches)`
  }
}

async function fetchPersonalizedJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  filters: JobFilters,
  count: number
): Promise<Partial<Job>[]> {
  // Get existing job external IDs to avoid duplicates
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('external_id')
    .eq('user_id', userId)

  const existingIds = new Set(existingJobs?.map(j => j.external_id) || [])

  // Build search queries from filters
  const searchQueries = buildSearchQueries(filters)

  // Fetch from fantastic.jobs API or other sources
  // This is a placeholder - in production, call your actual job APIs
  const jobs: Partial<Job>[] = []

  for (const query of searchQueries) {
    if (jobs.length >= count * 2) break // Fetch extra to account for duplicates/failures

    try {
      // Call internal search API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            filters,
            limit: count,
            skipQuota: true, // Internal curation doesn't count against quota
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        const newJobs = (data.jobs || []).filter(
          (j: Job) => !existingIds.has(j.external_id)
        )
        jobs.push(...newJobs)
        newJobs.forEach((j: Job) => existingIds.add(j.external_id))
      }
    } catch (err) {
      console.error('Error fetching jobs for query:', query, err)
    }
  }

  return jobs.slice(0, count)
}

function buildSearchQueries(filters: JobFilters): string[] {
  const queries: string[] = []

  // Use job titles as primary queries
  if (filters.job_titles && filters.job_titles.length > 0) {
    queries.push(...filters.job_titles)
  }

  // Add keyword-based queries
  if (filters.include_keywords && filters.include_keywords.length > 0) {
    queries.push(...filters.include_keywords.slice(0, 3))
  }

  return queries.length > 0 ? queries : ['software engineer'] // Default fallback
}
