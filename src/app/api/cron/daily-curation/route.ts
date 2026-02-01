import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { JobFilters, Job, CurationLogStatus } from '@/lib/supabase/types'
import { notifyNewMatches } from '@/lib/email/triggers'
import type { JobMatch } from '@/lib/email/templates/job-matches'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for Vercel

const DAILY_JOB_TARGET = 20
const MAX_FETCH_ATTEMPTS = 3

interface CurationSummary {
  success: boolean
  totalUsers: number
  usersProcessed: number
  usersFailed: number
  totalJobsCurated: number
  totalJobsFailed: number
  errors: string[]
  startedAt: string
  completedAt: string
  durationMs: number
}

interface UserCurationResult {
  userId: string
  success: boolean
  jobsCurated: number
  jobsFailed: number
  error?: string
  skipped?: boolean
  skipReason?: string
  curatedJobs?: JobMatch[]
}

/**
 * Daily Curation Cron Endpoint
 *
 * Called by Vercel Cron or external cron service (cron-job.org)
 * Triggers job curation for all users with production_mode enabled
 *
 * Authentication: Requires CRON_SECRET header
 *
 * This endpoint is idempotent - safe to call multiple times per day
 * Users who have already reached their daily quota will be skipped
 */
export async function GET(request: NextRequest): Promise<NextResponse<CurationSummary | { error: string }>> {
  const startTime = Date.now()
  const startedAt = new Date().toISOString()

  // Authenticate cron request
  const authResult = authenticateCronRequest(request)
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error! },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()
  const errors: string[] = []
  const results: UserCurationResult[] = []

  try {
    // Get all users with production mode enabled
    const { data: productionUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, production_mode, job_filters, cv_url')
      .eq('production_mode', true)

    if (usersError) {
      console.error('Error fetching production users:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch production users' },
        { status: 500 }
      )
    }

    if (!productionUsers || productionUsers.length === 0) {
      return NextResponse.json({
        success: true,
        totalUsers: 0,
        usersProcessed: 0,
        usersFailed: 0,
        totalJobsCurated: 0,
        totalJobsFailed: 0,
        errors: [],
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      })
    }

    console.log(`[Daily Curation] Starting curation for ${productionUsers.length} users`)

    // Process each user sequentially to avoid overwhelming the system
    for (const user of productionUsers) {
      try {
        const result = await curateJobsForUser(supabase, user)
        results.push(result)

        if (!result.success && result.error) {
          errors.push(`User ${user.id}: ${result.error}`)
        }

        // Small delay between users to prevent rate limiting
        await sleep(1000)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`User ${user.id}: ${errorMessage}`)
        results.push({
          userId: user.id,
          success: false,
          jobsCurated: 0,
          jobsFailed: 0,
          error: errorMessage,
        })
      }
    }

    // Calculate summary
    const summary: CurationSummary = {
      success: errors.length === 0,
      totalUsers: productionUsers.length,
      usersProcessed: results.filter(r => r.success).length,
      usersFailed: results.filter(r => !r.success).length,
      totalJobsCurated: results.reduce((sum, r) => sum + r.jobsCurated, 0),
      totalJobsFailed: results.reduce((sum, r) => sum + r.jobsFailed, 0),
      errors: errors.slice(0, 10), // Limit error messages
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    }

    console.log('[Daily Curation] Completed:', summary)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Daily Curation] Critical error:', error)
    return NextResponse.json(
      { error: 'Curation failed due to internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST handler for manual triggering (same logic as GET)
 */
export async function POST(request: NextRequest): Promise<NextResponse<CurationSummary | { error: string }>> {
  return GET(request)
}

/**
 * Authenticate cron request using CRON_SECRET
 */
function authenticateCronRequest(request: NextRequest): { success: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Daily Curation] CRON_SECRET not configured')
    return { success: false, error: 'Cron secret not configured' }
  }

  // Check Authorization header (Vercel Cron format)
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) {
    return { success: true }
  }

  // Check X-Cron-Secret header (alternative format)
  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader === cronSecret) {
    return { success: true }
  }

  // NOTE: Query parameter authentication removed for security reasons
  // Secrets in URLs can be logged by proxies, load balancers, and server logs

  return { success: false, error: 'Unauthorized: Invalid cron secret' }
}

/**
 * Curate jobs for a single user
 */
async function curateJobsForUser(
  supabase: ReturnType<typeof createServiceClient>,
  user: {
    id: string
    email: string | null
    production_mode: boolean
    job_filters: JobFilters | null
    cv_url: string | null
  }
): Promise<UserCurationResult> {
  // Create curation log entry
  const { data: logEntry, error: logError } = await supabase
    .from('curation_logs')
    .insert({
      user_id: user.id,
      status: 'running' as CurationLogStatus,
      jobs_target: DAILY_JOB_TARGET,
      jobs_curated: 0,
      jobs_failed: 0,
      metadata: { triggered_by: 'cron' },
    })
    .select()
    .single()

  if (logError) {
    console.error(`[Daily Curation] Failed to create log for user ${user.id}:`, logError)
  }

  const logId = logEntry?.id

  try {
    // Check if user has job filters configured
    if (!user.job_filters) {
      await updateCurationLog(supabase, logId, {
        status: 'failed',
        error_message: 'No job filters configured',
      })
      return {
        userId: user.id,
        success: false,
        jobsCurated: 0,
        jobsFailed: 0,
        skipped: true,
        skipReason: 'No job filters configured',
      }
    }

    // Use database function with transaction isolation to prevent race conditions
    // This locks the user's profile row and atomically checks/reserves quota
    let jobsNeeded: number

    const { data: quotaResult, error: quotaError } = await supabase
      .rpc('check_and_reserve_daily_quota', {
        p_user_id: user.id,
        p_jobs_needed: DAILY_JOB_TARGET,
      })

    if (quotaError) {
      console.warn(`[Daily Curation] Quota function failed for user ${user.id}, falling back to query:`, quotaError.message)
      // Fallback to the old method if the function doesn't exist yet
      const today = new Date().toISOString().split('T')[0]
      const { count: existingJobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)
        .in('status', ['discovered', 'saved'])

      jobsNeeded = Math.max(0, DAILY_JOB_TARGET - (existingJobsCount || 0))
    } else {
      jobsNeeded = quotaResult as number
    }

    if (jobsNeeded === 0) {
      console.log(`[Daily Curation] User ${user.id} already has daily quota`)
      await updateCurationLog(supabase, logId, {
        status: 'success',
        jobs_target: DAILY_JOB_TARGET,
        jobs_curated: 0,
        metadata: { reason: 'daily_quota_met' },
      })
      return {
        userId: user.id,
        success: true,
        jobsCurated: 0,
        jobsFailed: 0,
        skipped: true,
        skipReason: 'Daily quota already met',
      }
    }

    // Fetch and curate jobs
    const result = await fetchAndCurateJobs(
      supabase,
      user.id,
      user.job_filters,
      jobsNeeded
    )

    // Update curation log
    await updateCurationLog(supabase, logId, {
      status: result.jobsFailed > 0 ? 'partial' : 'success',
      jobs_target: jobsNeeded,
      jobs_curated: result.jobsCurated,
      jobs_failed: result.jobsFailed,
    })

    console.log(`[Daily Curation] User ${user.id}: curated ${result.jobsCurated}, failed ${result.jobsFailed}`)

    // Send email notification for new job matches
    if (result.jobsCurated > 0 && result.curatedJobs.length > 0) {
      try {
        const emailResult = await notifyNewMatches(
          user.id,
          result.jobsCurated,
          result.curatedJobs
        )
        if (emailResult.success) {
          console.log(`[Daily Curation] Email notification sent to user ${user.id}`)
        } else if (emailResult.error !== 'Job match notifications disabled') {
          console.warn(`[Daily Curation] Email notification failed for user ${user.id}:`, emailResult.error)
        }
      } catch (emailError) {
        // Don't fail the curation if email fails
        console.error(`[Daily Curation] Email notification error for user ${user.id}:`, emailError)
      }
    }

    return {
      userId: user.id,
      success: true,
      jobsCurated: result.jobsCurated,
      jobsFailed: result.jobsFailed,
      curatedJobs: result.curatedJobs,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Daily Curation] Error for user ${user.id}:`, errorMessage)

    await updateCurationLog(supabase, logId, {
      status: 'failed',
      error_message: errorMessage,
    })

    return {
      userId: user.id,
      success: false,
      jobsCurated: 0,
      jobsFailed: 0,
      error: errorMessage,
    }
  }
}

/**
 * Fetch jobs from search API and save them for a user
 */
async function fetchAndCurateJobs(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  filters: JobFilters,
  targetCount: number
): Promise<{ jobsCurated: number; jobsFailed: number; curatedJobs: JobMatch[] }> {
  let jobsCurated = 0
  let jobsFailed = 0
  let attempts = 0
  const curatedJobs: JobMatch[] = []

  // Get existing job external IDs to avoid duplicates
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('external_id')
    .eq('user_id', userId)

  const existingIds = new Set(existingJobs?.map(j => j.external_id) || [])

  // Build search queries from filters
  const searchQueries = buildSearchQueries(filters)

  while (jobsCurated < targetCount && attempts < MAX_FETCH_ATTEMPTS) {
    attempts++

    const jobs = await fetchJobsFromSearch(searchQueries, filters, targetCount - jobsCurated, existingIds)

    if (jobs.length === 0) {
      console.log(`[Daily Curation] No more jobs available for user ${userId}`)
      break
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
            remote: job.remote ?? false,
            remote_type: job.remote_type,
            description: job.description,
            application_url: job.application_url,
            match_score: job.match_score,
            status: 'discovered',
            platform_detected: job.platform_detected,
            auto_apply_status: 'manual',
            ats_source: job.ats_source,
            ats_job_id: job.ats_job_id,
          })
          .select()
          .single()

        if (saveError) {
          console.error(`[Daily Curation] Failed to save job:`, saveError)
          jobsFailed++
          continue
        }

        jobsCurated++
        existingIds.add(job.external_id)

        // Track curated job for email notification (top 5)
        if (curatedJobs.length < 5 && savedJob) {
          curatedJobs.push({
            id: savedJob.id,
            title: savedJob.title,
            company: savedJob.company,
            location: savedJob.location || 'Remote',
            matchScore: savedJob.match_score || undefined,
          })
        }
      } catch (err) {
        console.error(`[Daily Curation] Error processing job:`, err)
        jobsFailed++
      }
    }
  }

  return { jobsCurated, jobsFailed, curatedJobs }
}

/**
 * Build search queries from job filters
 */
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

/**
 * Fetch jobs from the internal search API
 */
async function fetchJobsFromSearch(
  queries: string[],
  filters: JobFilters,
  count: number,
  existingIds: Set<string | null>
): Promise<Partial<Job>[]> {
  const jobs: Partial<Job>[] = []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  for (const query of queries) {
    if (jobs.length >= count * 2) break // Fetch extra to account for duplicates

    try {
      const response = await fetch(`${appUrl}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Internal API key for cron/internal calls
          'x-api-key': process.env.INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          query,
          filters,
          limit: count,
          skipQuota: true, // Internal curation doesn't count against quota
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newJobs = (data.jobs || []).filter(
          (j: Job) => !existingIds.has(j.external_id)
        )
        jobs.push(...newJobs)
        newJobs.forEach((j: Job) => existingIds.add(j.external_id))
      } else {
        console.warn(`[Daily Curation] Search API returned ${response.status} for query: ${query}`)
      }
    } catch (err) {
      console.error(`[Daily Curation] Error fetching jobs for query "${query}":`, err)
    }
  }

  return jobs.slice(0, count)
}

/**
 * Update curation log entry
 */
async function updateCurationLog(
  supabase: ReturnType<typeof createServiceClient>,
  logId: string | undefined,
  updates: {
    status?: CurationLogStatus
    jobs_target?: number
    jobs_curated?: number
    jobs_failed?: number
    error_message?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  if (!logId) return

  try {
    await supabase
      .from('curation_logs')
      .update({
        ...updates,
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId)
  } catch (err) {
    console.error('[Daily Curation] Error updating curation log:', err)
  }
}

/**
 * Utility sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
