import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { detectAts } from '@/lib/auto-apply/platform-detector'
import { getOrExtractQuestions } from '@/lib/auto-apply/questions-store'
import { prefillFromProfile } from '@/lib/auto-apply/profile-prefill'
import type { Profile } from '@/lib/supabase/types'

const SIGNED_URL_TTL = 600 // seconds

/** Sign a path in the cvs bucket via the service client. */
async function signCvPath(path: string): Promise<string | null> {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from('cvs')
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

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

  // Load any existing draft answers + resume override for this (user, job) pair.
  // Use maybeSingle() to avoid logging a PGRST116 error for the common no-draft case.
  const { data: draft } = await supabase
    .from('job_applications')
    .select('answers, resume_override_path, resume_override_filename')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  const savedAnswers: Record<string, string | string[]> =
    (draft?.answers as Record<string, string | string[]>) ?? {}

  // draft is typed as `any` by Supabase (job_applications not yet in generated types)
  const overridePath: string | null = draft?.resume_override_path ?? null
  const overrideFilename: string | null = draft?.resume_override_filename ?? null

  // Build the richer `resume` object describing whichever CV is currently in effect.
  type ResumeInfo = {
    source: 'profile' | 'override'
    fileName: string
    viewUrl: string
  } | null

  let resume: ResumeInfo = null

  if (overridePath && overrideFilename) {
    // Per-application override takes priority.
    const viewUrl = await signCvPath(overridePath)
    resume = {
      source: 'override',
      fileName: overrideFilename,
      viewUrl: viewUrl ?? '',
    }
  } else {
    // Fall back to the profile CV.
    const cvUrl = (profile as Profile | null)?.cv_url
    if (cvUrl) {
      const viewUrl = await signCvPath(cvUrl)
      resume = {
        source: 'profile',
        fileName: cvUrl.split('/').pop() ?? cvUrl,
        viewUrl: viewUrl ?? '',
      }
    }
  }

  return NextResponse.json({
    supported: true,
    ats: platform,
    questions: prefilled,
    savedAnswers,
    resume,
  })
}
