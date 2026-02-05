import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface CronHealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  lastCurationRun: string | null
  lastCurationStatus: string | null
  usersPendingCuration: number
  usersWithProductionMode: number
  cronSecretConfigured: boolean
  internalApiKeyConfigured: boolean
  issues: string[]
  timestamp: string
}

/**
 * GET /api/cron/health
 *
 * Health check endpoint for monitoring cron job status.
 *
 * Security: Returns limited info without auth, full details with CRON_SECRET.
 * - Without auth: Only returns status (healthy/warning/critical) and timestamp
 * - With auth: Returns full details including issues and user counts
 */
export async function GET(request: NextRequest): Promise<NextResponse<CronHealthStatus | { status: string; timestamp: string }>> {
  const issues: string[] = []
  const timestamp = new Date().toISOString()

  // Check if authenticated (for full details)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isAuthenticated = cronSecret && authHeader === `Bearer ${cronSecret}`

  // Check environment configuration
  const cronSecretConfigured = !!process.env.CRON_SECRET
  const internalApiKeyConfigured = !!process.env.INTERNAL_API_KEY

  if (!cronSecretConfigured) {
    issues.push('CRON_SECRET not configured - cron jobs will fail authentication')
  }
  if (!internalApiKeyConfigured) {
    issues.push('INTERNAL_API_KEY not configured - job search may fail')
  }

  const supabase = createServiceClient()

  // Check last curation run
  const { data: lastCuration } = await supabase
    .from('curation_logs')
    .select('created_at, status')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const lastCurationRun = lastCuration?.created_at || null
  const lastCurationStatus = lastCuration?.status || null

  // Check if curation is overdue (more than 25 hours since last run)
  if (lastCurationRun) {
    const hoursSinceLastRun = (Date.now() - new Date(lastCurationRun).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastRun > 25) {
      issues.push(`Curation overdue: last run was ${Math.round(hoursSinceLastRun)} hours ago`)
    }
  } else {
    issues.push('No curation logs found - cron may have never run successfully')
  }

  // Count users with production mode enabled
  const { count: usersWithProductionMode } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('production_mode', true)

  // Count users who need curation today (have production_mode but no jobs today)
  const today = new Date().toISOString().split('T')[0]
  const { data: usersNeedingCuration } = await supabase
    .from('profiles')
    .select('id')
    .eq('production_mode', true)
    .not('job_filters', 'is', null)

  let usersPendingCuration = 0
  if (usersNeedingCuration) {
    for (const user of usersNeedingCuration) {
      const { count: todayJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00`)

      if ((todayJobs || 0) === 0) {
        usersPendingCuration++
      }
    }
  }

  if (usersPendingCuration > 0 && new Date().getUTCHours() >= 7) {
    issues.push(`${usersPendingCuration} users haven't received jobs today (after 7 AM UTC)`)
  }

  // Determine overall status
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (issues.some(i => i.includes('CRON_SECRET') || i.includes('never run'))) {
    status = 'critical'
  } else if (issues.length > 0) {
    status = 'warning'
  }

  // Return limited info for unauthenticated requests (security)
  if (!isAuthenticated) {
    return NextResponse.json({
      status,
      timestamp,
    })
  }

  // Return full details for authenticated requests
  return NextResponse.json({
    status,
    lastCurationRun,
    lastCurationStatus,
    usersPendingCuration,
    usersWithProductionMode: usersWithProductionMode || 0,
    cronSecretConfigured,
    internalApiKeyConfigured,
    issues,
    timestamp,
  })
}
