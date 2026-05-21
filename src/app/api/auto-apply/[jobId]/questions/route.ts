import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { detectAts } from '@/lib/auto-apply/platform-detector'
import { getOrExtractQuestions } from '@/lib/auto-apply/questions-store'
import { prefillFromProfile } from '@/lib/auto-apply/profile-prefill'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
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

  const rateLimit = checkRateLimit(user.id, RATE_LIMITS.standard, 'auto-apply-questions')
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
    return NextResponse.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  // Load the job via the user-scoped client (RLS enforces ownership)
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

  const applicationUrl = job.application_url
  if (!applicationUrl) {
    return NextResponse.json({ supported: false, reason: 'no_url' })
  }

  const platform = detectAts(applicationUrl)
  if (platform === 'other') {
    return NextResponse.json({ supported: false, reason: 'unsupported_ats' })
  }

  // Extract (or retrieve cached) questions — wrap in try/catch; extraction
  // failure is an expected outcome, not an unhandled server error.
  let questions
  try {
    questions = await getOrExtractQuestions(applicationUrl)
  } catch (err) {
    console.error('[auto-apply/questions] extraction failed for', applicationUrl, err)
    return NextResponse.json({ supported: false, reason: 'extraction_failed' })
  }

  // Load profile for prefill
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const prefilled = profile
    ? prefillFromProfile(questions, profile as Profile)
    : questions.map((q) => ({ ...q, prefilledFromProfile: false as const }))

  // Load any existing draft answers for this (user, job) pair
  const { data: draft } = await supabase
    .from('job_applications')
    .select('answers')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .single()

  const savedAnswers: Record<string, string> = (draft?.answers as Record<string, string>) ?? {}

  return NextResponse.json({ supported: true, questions: prefilled, savedAnswers })
}
