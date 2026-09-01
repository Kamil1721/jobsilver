import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for Vercel

const BATCH_SIZE = 1000 // Delete in batches to avoid timeouts

interface CleanupSummary {
  success: boolean
  jobsDeleted: number
  errors: string[]
  startedAt: string
  completedAt: string
  durationMs: number
}

/**
 * Cleanup Expired Jobs Cron Endpoint
 *
 * Called by Vercel Cron daily at 7 AM UTC
 * Deletes jobs older than 60 days from their creation date
 *
 * IMPORTANT: Favorited jobs are EXCLUDED from cleanup to preserve user data
 *
 * Authentication: Requires CRON_SECRET header
 *
 * This endpoint is idempotent - safe to call multiple times
 *
 * Note: Chat messages are automatically deleted via ON DELETE CASCADE
 * on the job_chat_messages.job_id foreign key constraint.
 */
export async function GET(request: NextRequest): Promise<NextResponse<CleanupSummary | { error: string }>> {
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

  try {
    // Calculate the cutoff date (60 days ago)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const cutoffDate = sixtyDaysAgo.toISOString()

    console.log(`[Cleanup] Starting cleanup of jobs older than ${cutoffDate}`)

    // Get ALL favorited job IDs to exclude from cleanup (paginated: PostgREST caps
    // unpaginated selects at max-rows, which would silently drop favorites past the cap).
    // Favorited jobs should NEVER be auto-deleted — if we cannot load the full
    // exclusion list, ABORT the run rather than delete with an incomplete set.
    const favoritedJobIds = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data: favPage, error: favError } = await supabase
        .from('user_favorite_jobs')
        .select('job_id')
        .range(from, from + 999)

      if (favError) {
        console.error('[Cleanup] Error fetching favorited jobs — aborting cleanup:', favError)
        return NextResponse.json(
          {
            success: false,
            jobsDeleted: 0,
            errors: [`Fetch favorites error: ${favError.message} — cleanup aborted to protect favorites`],
            startedAt,
            completedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          },
          { status: 500 }
        )
      }

      for (const f of favPage || []) favoritedJobIds.add(f.job_id)
      if (!favPage || favPage.length < 1000) break
    }
    console.log(`[Cleanup] Excluding ${favoritedJobIds.size} favorited jobs from cleanup`)

    // Delete jobs in batches to avoid timeouts with large datasets
    // Chat messages are automatically deleted via ON DELETE CASCADE
    // Keyset pagination (created_at, id) so surviving favorited rows can't make the
    // loop refetch the same undeletable batch forever.
    let totalDeleted = 0
    let hasMore = true
    let cursor: { created_at: string; id: string } | null = null

    while (hasMore) {
      // First, get a batch of expired jobs
      let batchQuery = supabase
        .from('jobs')
        .select('id, created_at')
        .lt('created_at', cutoffDate)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)
      if (cursor) {
        batchQuery = batchQuery.or(
          `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
        )
      }
      const { data: expiredJobs, error: fetchError } = await batchQuery

      if (fetchError) {
        console.error('[Cleanup] Error fetching expired jobs:', fetchError)
        errors.push(`Fetch error: ${fetchError.message}`)
        break
      }

      if (!expiredJobs || expiredJobs.length === 0) {
        hasMore = false
        break
      }

      // Filter out favorited jobs
      const jobsToDelete = expiredJobs
        .filter(job => !favoritedJobIds.has(job.id))
        .map(job => job.id)

      if (jobsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('jobs')
          .delete()
          .in('id', jobsToDelete)

        if (deleteError) {
          console.error('[Cleanup] Error deleting jobs batch:', deleteError)
          errors.push(`Delete error: ${deleteError.message}`)
          break
        }

        totalDeleted += jobsToDelete.length
      }

      // Advance the keyset cursor past this batch regardless of what was deletable
      const lastRow = expiredJobs[expiredJobs.length - 1]
      cursor = { created_at: lastRow.created_at, id: lastRow.id }

      // Check if we got a full batch (might be more to process)
      hasMore = expiredJobs.length === BATCH_SIZE

      if (hasMore) {
        // Small delay between batches to give the database breathing room
        await sleep(100)
      }
    }

    const summary: CleanupSummary = {
      success: errors.length === 0,
      jobsDeleted: totalDeleted,
      errors: errors.slice(0, 10),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    }

    console.log('[Cleanup] Completed:', summary)

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[Cleanup] Critical error:', error)
    return NextResponse.json(
      { error: 'Cleanup failed due to internal error' },
      { status: 500 }
    )
  }
}

/**
 * Utility sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * POST handler for manual triggering (same logic as GET)
 */
export async function POST(request: NextRequest): Promise<NextResponse<CleanupSummary | { error: string }>> {
  return GET(request)
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Authenticate cron request using CRON_SECRET
 */
function authenticateCronRequest(request: NextRequest): { success: boolean; error?: string } {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cleanup] CRON_SECRET not configured')
    return { success: false, error: 'Cron secret not configured' }
  }

  // Check Authorization header (Vercel Cron format)
  const authHeader = request.headers.get('authorization')
  const expectedBearer = `Bearer ${cronSecret}`
  if (authHeader && authHeader.length === expectedBearer.length && safeCompare(authHeader, expectedBearer)) {
    return { success: true }
  }

  // Check X-Cron-Secret header (alternative format)
  const cronHeader = request.headers.get('x-cron-secret')
  if (cronHeader && cronHeader.length === cronSecret.length && safeCompare(cronHeader, cronSecret)) {
    return { success: true }
  }

  return { success: false, error: 'Unauthorized: Invalid cron secret' }
}
