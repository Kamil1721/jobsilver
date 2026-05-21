import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { getSkyvernRun, isTerminalStatus } from '@/lib/skyvern/client'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  // --- Auth ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // --- Rate limit (standard tier — this endpoint is polled by the UI) ---
  const rateLimit = checkRateLimit(user.id, RATE_LIMITS.standard, 'auto-apply-status')
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
    return NextResponse.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  // --- Load application row ---
  const { data: application } = await supabase
    .from('job_applications')
    .select('status, skyvern_run_id, skyvern_app_url, result_screenshot_url, failure_reason, submitted_at')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  if (!application) {
    return NextResponse.json({ status: 'none' })
  }

  const storedStatus = application.status as string

  // Only poll Skyvern when the run is in-flight (submitting).
  // For terminal local statuses (applied, failed, failed_verification), return stored state.
  if (storedStatus === 'submitting' && application.skyvern_run_id) {
    let skyvernResult: Awaited<ReturnType<typeof getSkyvernRun>>
    try {
      skyvernResult = await getSkyvernRun(application.skyvern_run_id)
    } catch (err) {
      console.error('[auto-apply/status] getSkyvernRun failed', err)
      // Return current stored state — the UI can retry.
      return NextResponse.json({
        status: storedStatus,
        screenshotUrl: application.result_screenshot_url ?? null,
        failureReason: application.failure_reason ?? null,
        appUrl: application.skyvern_app_url ?? null,
      })
    }

    const skyvernStatus = skyvernResult.status
    const screenshotUrl = skyvernResult.screenshotUrls[0] ?? null

    let newStatus = storedStatus
    let submittedAt: string | null = null
    let failureReason: string | null = application.failure_reason ?? null

    if (skyvernStatus === 'completed') {
      // Safely narrow output to check form_submitted
      const output =
        typeof skyvernResult.output === 'object' && skyvernResult.output !== null
          ? (skyvernResult.output as Record<string, unknown>)
          : {}

      if (output.form_submitted === true) {
        newStatus = 'applied'
        submittedAt = new Date().toISOString()
      } else {
        newStatus = 'failed_verification'
        failureReason =
          typeof output.notes === 'string' && output.notes.trim().length > 0
            ? output.notes
            : 'Verification failed: not all fields were correct or required fields were missing.'
      }
    } else if (isTerminalStatus(skyvernStatus) && skyvernStatus !== 'completed') {
      // failed / terminated / timed_out / canceled
      newStatus = 'failed'
      failureReason = skyvernResult.failureReason ?? `Skyvern run ended with status: ${skyvernStatus}`
    }
    // Otherwise still running/queued — keep 'submitting', no DB update needed.

    // Persist state changes when the run has reached a new terminal status.
    if (newStatus !== storedStatus) {
      const updates: Record<string, unknown> = {
        status: newStatus,
        result_screenshot_url: screenshotUrl,
        failure_reason: failureReason,
        updated_at: new Date().toISOString(),
      }
      if (submittedAt) {
        updates.submitted_at = submittedAt
      }

      const { error: updateError } = await supabase
        .from('job_applications')
        .update(updates)
        .eq('user_id', user.id)
        .eq('job_id', jobId)

      if (updateError) {
        console.error('[auto-apply/status] failed to persist status update', updateError)
      }

      return NextResponse.json({
        status: newStatus,
        screenshotUrl,
        failureReason,
        appUrl: application.skyvern_app_url ?? null,
      })
    }

    // Still running — return current state with latest screenshot if available.
    return NextResponse.json({
      status: storedStatus,
      screenshotUrl: screenshotUrl ?? application.result_screenshot_url ?? null,
      failureReason: application.failure_reason ?? null,
      appUrl: application.skyvern_app_url ?? null,
    })
  }

  // Terminal or draft — return stored state without calling Skyvern.
  return NextResponse.json({
    status: storedStatus,
    screenshotUrl: application.result_screenshot_url ?? null,
    failureReason: application.failure_reason ?? null,
    appUrl: application.skyvern_app_url ?? null,
  })
}
