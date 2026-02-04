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
 * Deletes all jobs older than 60 days from their creation date
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

    // Delete jobs in batches to avoid timeouts with large datasets
    // Chat messages are automatically deleted via ON DELETE CASCADE
    let totalDeleted = 0
    let hasMore = true

    while (hasMore) {
      const { data: deletedJobs, error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .lt('created_at', cutoffDate)
        .limit(BATCH_SIZE)
        .select('id')

      if (deleteError) {
        console.error('[Cleanup] Error deleting jobs batch:', deleteError)
        errors.push(`Delete error: ${deleteError.message}`)
        break // Stop on error to avoid infinite loop
      }

      const batchDeleted = deletedJobs?.length || 0
      totalDeleted += batchDeleted
      hasMore = batchDeleted === BATCH_SIZE

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
