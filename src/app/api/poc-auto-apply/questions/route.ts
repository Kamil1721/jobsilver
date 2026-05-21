import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PoC: Auto-Apply — Greenhouse question normalization.
 *
 * Self-contained. Does NOT touch Supabase / auth / existing feature code.
 *
 * GET /api/poc-auto-apply/questions?jobUrl=https://job-boards.greenhouse.io/{board}/jobs/{id}
 */

type NormalizedQuestionType = 'text' | 'textarea' | 'select' | 'file' | 'multiselect'

interface NormalizedQuestion {
  id: string
  label: string
  type: NormalizedQuestionType
  required: boolean
  options?: { label: string; value: string }[]
}

interface QuestionsResponse {
  jobTitle: string
  location: string
  questions: NormalizedQuestion[]
}

// Greenhouse field.type → our normalized type
const FIELD_TYPE_MAP: Record<string, NormalizedQuestionType> = {
  input_text: 'text',
  input_hidden: 'text',
  textarea: 'textarea',
  multi_value_single_select: 'select',
  multi_value_multi_select: 'multiselect',
  input_file: 'file',
}

interface GreenhouseFieldValue {
  label?: string
  value?: unknown
}

interface GreenhouseField {
  name?: string
  type?: string
  values?: GreenhouseFieldValue[]
}

interface GreenhouseQuestion {
  label?: string
  required?: boolean
  fields?: GreenhouseField[]
}

interface GreenhouseJob {
  title?: string
  location?: { name?: string }
  questions?: GreenhouseQuestion[]
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Parse a Greenhouse job URL into its board token and job id.
 * Expected path shape: /{boardToken}/jobs/{jobId}
 */
function parseGreenhouseUrl(jobUrl: string): { boardToken: string; jobId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(jobUrl)
  } catch {
    return null
  }

  // Path segments, ignoring empty entries from leading/trailing slashes.
  const segments = parsed.pathname.split('/').filter(Boolean)
  const jobsIndex = segments.indexOf('jobs')

  if (jobsIndex < 1 || jobsIndex + 1 >= segments.length) {
    return null
  }

  const boardToken = segments[jobsIndex - 1]
  const jobId = segments[jobsIndex + 1]

  if (!boardToken || !jobId) {
    return null
  }

  return { boardToken, jobId }
}

export async function GET(request: NextRequest) {
  const jobUrl = request.nextUrl.searchParams.get('jobUrl')

  if (!jobUrl) {
    return errorResponse('MISSING_JOB_URL', 'Query param "jobUrl" is required.', 400)
  }

  const parsed = parseGreenhouseUrl(jobUrl)
  if (!parsed) {
    return errorResponse(
      'INVALID_JOB_URL',
      'Could not parse a Greenhouse board token and job id from the URL. ' +
        'Expected a path like /{boardToken}/jobs/{jobId}.',
      400,
    )
  }

  const { boardToken, jobId } = parsed
  const apiUrl =
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}` +
    `/jobs/${encodeURIComponent(jobId)}?questions=true`

  let upstream: Response
  try {
    upstream = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch {
    return errorResponse('UPSTREAM_FETCH_FAILED', 'Failed to reach the Greenhouse API.', 502)
  }

  if (!upstream.ok) {
    const status = upstream.status === 404 ? 404 : 502
    return errorResponse(
      'UPSTREAM_ERROR',
      `Greenhouse API responded with ${upstream.status} for board "${boardToken}" job "${jobId}".`,
      status,
    )
  }

  let job: GreenhouseJob
  try {
    job = (await upstream.json()) as GreenhouseJob
  } catch {
    return errorResponse('UPSTREAM_PARSE_FAILED', 'Greenhouse API returned invalid JSON.', 502)
  }

  const questions: NormalizedQuestion[] = []

  for (const question of job.questions ?? []) {
    const label = question.label ?? 'Question'
    const required = question.required === true

    // A Greenhouse "question" can carry multiple fields — emit one per field.
    for (const field of question.fields ?? []) {
      const type = FIELD_TYPE_MAP[field.type ?? '']
      if (!type) {
        // Unknown / unsupported field type — skip rather than guess.
        continue
      }

      const normalized: NormalizedQuestion = {
        id: field.name ?? `${label}-${questions.length}`,
        label,
        type,
        required,
      }

      if ((type === 'select' || type === 'multiselect') && Array.isArray(field.values)) {
        normalized.options = field.values.map((v, i) => ({
          label: v.label ?? String(v.value ?? `Option ${i + 1}`),
          value: String(v.value ?? ''),
        }))
      }

      questions.push(normalized)
    }
  }

  const payload: QuestionsResponse = {
    jobTitle: job.title ?? 'Untitled role',
    location: job.location?.name ?? 'Unspecified',
    questions,
  }

  return NextResponse.json(payload)
}
