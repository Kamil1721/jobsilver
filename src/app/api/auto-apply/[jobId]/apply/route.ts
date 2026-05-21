import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { getOrExtractQuestions } from '@/lib/auto-apply/questions-store'
import { createSkyvernTask } from '@/lib/skyvern/client'

export const dynamic = 'force-dynamic'

export async function POST(
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

  // --- Rate limit (sensitive tier — same as answers route) ---
  const rateLimit = checkRateLimit(user.id, RATE_LIMITS.sensitive, 'auto-apply-apply')
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
    return NextResponse.json(
      { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please slow down.' } },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  // --- Load job (RLS-scoped, validates ownership) ---
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, title, company, application_url')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Job not found' } },
      { status: 404 }
    )
  }

  if (!job.application_url) {
    return NextResponse.json(
      { error: { code: 'NO_APPLICATION_URL', message: 'This job has no application URL.' } },
      { status: 400 }
    )
  }

  // --- Load draft answers + resume override ---
  const { data: draft } = await supabase
    .from('job_applications')
    .select('answers, status, skyvern_run_id, resume_override_path')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  const draftAnswers = draft?.answers as Record<string, string | string[]> | null | undefined
  if (!draft || !draftAnswers || Object.keys(draftAnswers).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_ANSWERS',
          message: 'Fill in and save the application form first.',
        },
      },
      { status: 400 }
    )
  }

  // Guard: don't kick off a second run for an already-submitting or applied row.
  if (draft.status === 'submitting' && draft.skyvern_run_id) {
    return NextResponse.json(
      {
        error: {
          code: 'ALREADY_SUBMITTING',
          message: 'An application is already in progress. Check the status endpoint.',
        },
      },
      { status: 409 }
    )
  }
  if (draft.status === 'applied') {
    return NextResponse.json(
      {
        error: {
          code: 'ALREADY_APPLIED',
          message: 'This application has already been submitted.',
        },
      },
      { status: 409 }
    )
  }

  // --- Resolve and sign CV URL ---
  // Prefer the per-application resume override; fall back to the profile CV.
  // draft is typed as `any` by Supabase (job_applications not yet in generated types)
  const resumeOverridePath: string | null = draft?.resume_override_path ?? null

  const serviceClient = createServiceClient()
  let cvPathToSign: string | null = resumeOverridePath

  if (!cvPathToSign) {
    // No override — use the profile CV.
    const { data: profile } = await supabase
      .from('profiles')
      .select('cv_url')
      .eq('id', user.id)
      .single()

    if (!profile?.cv_url) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_CV',
            message: 'Add a CV to your profile before applying.',
          },
        },
        { status: 400 },
      )
    }

    cvPathToSign = profile.cv_url
  }

  const { data: signedData, error: signedError } = await serviceClient.storage
    .from('cvs')
    // cvPathToSign is guaranteed non-null here — either the override path or profile.cv_url.
    .createSignedUrl(cvPathToSign as string, 3600)

  if (signedError || !signedData?.signedUrl) {
    console.error('[auto-apply/apply] failed to sign CV URL', signedError)
    return NextResponse.json(
      { error: { code: 'CV_SIGN_FAILED', message: 'Failed to prepare your CV for upload.' } },
      { status: 500 },
    )
  }

  const cvSignedUrl = signedData.signedUrl

  // --- Map fieldKey → human label via question cache ---
  let labelMap = new Map<string, string>()
  try {
    const questions = await getOrExtractQuestions(job.application_url)
    labelMap = new Map(questions.map((q) => [q.fieldKey, q.label]))
  } catch (err) {
    // Non-fatal: fall back to fieldKey labels
    console.warn('[auto-apply/apply] could not load question labels', err)
  }

  // Build human-readable answer list for the prompt.
  // Array answers (multi-select) are joined with ", ".
  const answerLines = Object.entries(draftAnswers)
    .map(([fieldKey, value]) => {
      const label = labelMap.get(fieldKey) ?? fieldKey
      const displayValue = Array.isArray(value) ? value.join(', ') : value
      return `- ${label}: ${displayValue}`
    })
    .join('\n')

  // --- Build Skyvern prompt ---
  const prompt = [
    'You are submitting a real job application on behalf of the applicant.',
    '',
    'Navigate to the job application form and fill in each field using EXACTLY the values listed below:',
    answerLines,
    '',
    `For the Resume/CV file-upload field, upload the file located at this URL: ${cvSignedUrl}`,
    'Use the file upload control to attach it — do not type the URL into a text field.',
    'IMPORTANT: Upload the CV file to the Resume/CV field ONLY. If there is a separate Cover Letter upload field, leave it completely empty — do not attach the CV or any other file to it.',
    '',
    'After filling every field:',
    '1. Read back the current value shown in each field and verify it matches the intended value.',
    '2. Verify that the CV/Resume file was successfully attached.',
    '3. If EVERY field is correct and no required field is empty or missing, click the Submit/Apply',
    '   button to submit the application. This is a real submission — proceed when all checks pass.',
    '4. If any required field cannot be filled, or any field value is wrong after verification,',
    '   do NOT submit. Stop and report the problem in the "notes" field.',
  ].join('\n')

  // --- Create Skyvern task ---
  let skyvernRun: { runId: string; appUrl: string | null }
  try {
    skyvernRun = await createSkyvernTask({
      url: job.application_url,
      prompt,
      title: `Apply: ${job.title} @ ${job.company}`,
      // Hard cap: a stuck run aborts cheaply instead of looping for 30+ min.
      // ~12 steps is enough for a single-page form; raise only if real runs need it.
      maxSteps: 12,
      dataExtractionSchema: {
        type: 'object',
        properties: {
          verification_passed: {
            type: 'boolean',
            description:
              'true if every form field was verified to contain the correct value and the CV was attached.',
          },
          form_submitted: {
            type: 'boolean',
            description:
              'true only if the Submit/Apply button was actually clicked and the form was submitted.',
          },
          notes: {
            type: 'string',
            description:
              'Any issues encountered during filling, verification, or submission. Empty string if all went well.',
          },
        },
        required: ['verification_passed', 'form_submitted', 'notes'],
      },
    })
  } catch (err) {
    console.error('[auto-apply/apply] createSkyvernTask failed', err)
    return NextResponse.json(
      { error: { code: 'SKYVERN_ERROR', message: 'Failed to start the Skyvern application task.' } },
      { status: 502 }
    )
  }

  // --- Persist run metadata to job_applications ---
  const { error: upsertError } = await supabase
    .from('job_applications')
    .upsert(
      {
        user_id: user.id,
        job_id: jobId,
        status: 'submitting',
        skyvern_run_id: skyvernRun.runId,
        skyvern_app_url: skyvernRun.appUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,job_id' }
    )

  if (upsertError) {
    console.error('[auto-apply/apply] failed to persist skyvern run metadata', upsertError)
    // Skyvern task is already running — log but return run info so the client can poll.
  }

  return NextResponse.json({
    ok: true,
    runId: skyvernRun.runId,
    appUrl: skyvernRun.appUrl,
  })
}
