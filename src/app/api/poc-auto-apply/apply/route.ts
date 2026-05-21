import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PoC: Auto-Apply — kick off a Skyvern fill-only run.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * POST /api/poc-auto-apply/apply
 * Body: {
 *   jobUrl: string,
 *   answers: Record<string, string>,
 *   cvId?: string,   // filename returned by /api/poc-auto-apply/cv-upload
 *   origin?: string, // public origin Skyvern can reach (window.location.origin)
 * }
 */

const SKYVERN_TASKS_URL = 'https://api.skyvern.com/v1/run/tasks'

interface ApplyBody {
  jobUrl?: unknown
  answers?: unknown
  cvId?: unknown
  origin?: unknown
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Build a publicly reachable CV download URL from the supplied origin.
 * Returns null if the origin is missing or not a valid http(s) URL.
 */
function buildCvUrl(origin: unknown, cvId: string): string | null {
  if (typeof origin !== 'string' || origin.trim().length === 0) return null
  let parsed: URL
  try {
    parsed = new URL(origin.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const base = parsed.origin
  return `${base}/api/poc-auto-apply/cv/${encodeURIComponent(cvId)}`
}

/** A JSON-schema-safe property key derived from a question id. */
function schemaKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.SKYVERN_API_KEY
  if (!apiKey) {
    return errorResponse(
      'MISSING_API_KEY',
      'SKYVERN_API_KEY is not configured in the environment.',
      500,
    )
  }

  let body: ApplyBody
  try {
    body = (await request.json()) as ApplyBody
  } catch {
    return errorResponse('INVALID_BODY', 'Request body must be valid JSON.', 400)
  }

  const jobUrl = typeof body.jobUrl === 'string' ? body.jobUrl.trim() : ''
  if (!jobUrl) {
    return errorResponse('MISSING_JOB_URL', 'Body field "jobUrl" is required.', 400)
  }

  const rawAnswers =
    body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
      ? (body.answers as Record<string, unknown>)
      : {}

  // Keep only non-empty string answers.
  const answers: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawAnswers)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      answers[key] = value.trim()
    }
  }

  // Optional CV upload: only honored when a valid public origin is supplied.
  const cvId = typeof body.cvId === 'string' ? body.cvId.trim() : ''
  const cvUrl = cvId ? buildCvUrl(body.origin, cvId) : null

  if (Object.keys(answers).length === 0 && !cvUrl) {
    return errorResponse(
      'NO_ANSWERS',
      'At least one non-empty answer or an uploaded CV is required.',
      400,
    )
  }

  // Human-readable label:value list for the prompt.
  const answersList = Object.entries(answers)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n')

  // One string property per answered field, plus the mandatory safety flag.
  const schemaProperties: Record<string, { type: string; description: string }> = {}
  for (const id of Object.keys(answers)) {
    schemaProperties[schemaKey(id)] = {
      type: 'string',
      description: `The value currently shown in the form field for "${id}" after filling.`,
    }
  }
  schemaProperties.form_submitted = {
    type: 'boolean',
    description:
      'true only if the form was actually submitted. This must be false — the form must NOT be submitted.',
  }
  if (cvUrl) {
    schemaProperties.resume_uploaded = {
      type: 'boolean',
      description:
        'true if a file was successfully attached to the Resume/CV field.',
    }
  }

  const promptLines: string[] = [
    'You are filling out a job application form as a fill-only test.',
    '',
  ]

  if (answersList) {
    promptLines.push(
      'Fill the job application form on this page using exactly these values:',
      answersList,
      '',
    )
  }

  if (cvUrl) {
    promptLines.push(
      'For the Resume/CV file-upload field, upload the file located at this URL: ' +
        `${cvUrl} — use the file upload control to attach it.`,
      '',
    )
  }

  promptLines.push(
    'CRITICAL SAFETY RULES:',
    '- Do NOT click "Submit Application" or any submit/apply button.',
    '- Do NOT submit the form under any circumstances.',
    '- This is a fill-only test. Leave the form filled but unsubmitted.',
    '',
    'After filling, read back the current value of each field you filled.',
  )

  const prompt = promptLines.join('\n')

  const skyvernBody = {
    engine: 'skyvern-2.0',
    title: 'JobSilver PoC apply (NO SUBMIT)',
    url: jobUrl,
    max_steps: 25,
    prompt,
    data_extraction_schema: {
      type: 'object',
      properties: schemaProperties,
    },
  }

  let upstream: Response
  try {
    upstream = await fetch(SKYVERN_TASKS_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(skyvernBody),
      cache: 'no-store',
    })
  } catch {
    return errorResponse('SKYVERN_REQUEST_FAILED', 'Failed to reach the Skyvern API.', 502)
  }

  let data: { run_id?: string; app_url?: string } = {}
  try {
    data = (await upstream.json()) as { run_id?: string; app_url?: string }
  } catch {
    // Fall through — handled by the !upstream.ok / missing-run_id checks below.
  }

  if (!upstream.ok) {
    return errorResponse(
      'SKYVERN_ERROR',
      `Skyvern API responded with ${upstream.status}.`,
      502,
    )
  }

  if (!data.run_id) {
    return errorResponse('SKYVERN_NO_RUN_ID', 'Skyvern response did not include a run id.', 502)
  }

  return NextResponse.json({ runId: data.run_id, appUrl: data.app_url ?? null })
}
