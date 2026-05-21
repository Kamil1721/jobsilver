import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PoC: Auto-Apply — poll a Skyvern run's status.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * GET /api/poc-auto-apply/status?runId=tsk_...
 */

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.SKYVERN_API_KEY
  if (!apiKey) {
    return errorResponse(
      'MISSING_API_KEY',
      'SKYVERN_API_KEY is not configured in the environment.',
      500,
    )
  }

  const runId = request.nextUrl.searchParams.get('runId')
  if (!runId) {
    return errorResponse('MISSING_RUN_ID', 'Query param "runId" is required.', 400)
  }

  let upstream: Response
  try {
    upstream = await fetch(`https://api.skyvern.com/v1/runs/${encodeURIComponent(runId)}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    })
  } catch {
    return errorResponse('SKYVERN_REQUEST_FAILED', 'Failed to reach the Skyvern API.', 502)
  }

  let data: {
    status?: string
    output?: unknown
    screenshot_urls?: unknown
    failure_reason?: unknown
  } = {}
  try {
    data = (await upstream.json()) as typeof data
  } catch {
    // Fall through to the !upstream.ok handler below.
  }

  if (!upstream.ok) {
    return errorResponse('SKYVERN_ERROR', `Skyvern API responded with ${upstream.status}.`, 502)
  }

  return NextResponse.json({
    status: data.status ?? 'unknown',
    output: data.output ?? null,
    screenshotUrls: Array.isArray(data.screenshot_urls) ? data.screenshot_urls : [],
    failureReason: data.failure_reason ?? null,
  })
}
