import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { computePostingKey } from '@/lib/auto-apply/platform-detector'

export const dynamic = 'force-dynamic'

const MAX_ANSWER_KEY_LENGTH = 200
const MAX_ANSWER_VALUE_LENGTH = 10000
const MAX_ANSWER_ENTRIES = 50

const answersBodySchema = z.object({
  answers: z
    .record(
      z.string().max(MAX_ANSWER_KEY_LENGTH, `Question key must be under ${MAX_ANSWER_KEY_LENGTH} characters`),
      z.string().max(MAX_ANSWER_VALUE_LENGTH, `Answer must be under ${MAX_ANSWER_VALUE_LENGTH} characters`)
    )
    .refine(
      (obj) => Object.keys(obj).length <= MAX_ANSWER_ENTRIES,
      { message: `Maximum ${MAX_ANSWER_ENTRIES} answers allowed` }
    ),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const rateLimit = checkRateLimit(user.id, RATE_LIMITS.sensitive, 'auto-apply-answers')
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
    return NextResponse.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const parsed = answersBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid request body', details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const { answers } = parsed.data

  // Confirm the job exists and belongs to this user (RLS enforces ownership)
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, application_url')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Job not found' } },
      { status: 404 }
    )
  }

  const postingKey = job.application_url
    ? computePostingKey(job.application_url)
    : computePostingKey(jobId)

  const { error: upsertError } = await supabase
    .from('job_applications')
    .upsert(
      {
        user_id: user.id,
        job_id: jobId,
        posting_key: postingKey,
        answers,
        status: 'draft',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,job_id' }
    )

  if (upsertError) {
    console.error('[auto-apply/answers] upsert failed', upsertError)
    return NextResponse.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to save answers' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
