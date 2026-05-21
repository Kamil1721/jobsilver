import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { computePostingKey } from '@/lib/auto-apply/platform-detector'

export const dynamic = 'force-dynamic'

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const SIGNED_URL_TTL = 600 // seconds

/** Shape returned by both POST and DELETE. */
export interface ResumeState {
  source: 'profile' | 'override'
  fileName: string
  viewUrl: string
}

/** Sign a path in the cvs bucket and return a short-lived URL. */
async function signCvPath(path: string): Promise<string | null> {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from('cvs')
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auto-apply/[jobId]/resume
// Upload a per-application resume override (multipart/form-data, field "file").
// ──────────────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const rateLimit = checkRateLimit(
    user.id,
    RATE_LIMITS.sensitive,
    'auto-apply-resume',
  )
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      rateLimit.resetAt - Math.floor(Date.now() / 1000),
    )
    return NextResponse.json(
      {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please slow down.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // --- Parse multipart form ---
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid multipart form data' } },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Missing "file" field' } },
      { status: 400 },
    )
  }

  // --- Validate extension ---
  const originalName = file.name
  const ext = originalName.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only PDF, DOC, and DOCX files are allowed.',
        },
      },
      { status: 400 },
    )
  }

  // --- Validate size ---
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File must be 10 MB or smaller.',
        },
      },
      { status: 400 },
    )
  }

  // --- Confirm the job exists and belongs to this user (RLS) ---
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, application_url')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Job not found' } },
      { status: 404 },
    )
  }

  if (!job.application_url) {
    return NextResponse.json(
      {
        error: {
          code: 'NO_APPLICATION_URL',
          message: 'This job has no application URL.',
        },
      },
      { status: 400 },
    )
  }

  // --- Upload to storage ---
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100)
  const storagePath = `${user.id}/applications/${jobId}/${randomUUID()}-${sanitizedName}`

  const fileBuffer = await file.arrayBuffer()
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from('cvs')
    .upload(storagePath, fileBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('[auto-apply/resume] upload failed', uploadError)
    return NextResponse.json(
      {
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload your resume — try again.',
        },
      },
      { status: 500 },
    )
  }

  // --- Upsert job_applications row with override ---
  // (job_applications is not yet in generated types; the table is accessed via the
  //  untyped overload — same pattern as answers/apply routes.)
  const postingKey = computePostingKey(job.application_url)
  const { error: upsertError } = await supabase
    .from('job_applications')
    .upsert(
      {
        user_id: user.id,
        job_id: jobId,
        posting_key: postingKey,
        resume_override_path: storagePath,
        resume_override_filename: originalName,
        status: 'draft',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,job_id' },
    )

  if (upsertError) {
    console.error('[auto-apply/resume] upsert failed', upsertError)
    // Best-effort cleanup of the uploaded file.
    await serviceClient.storage.from('cvs').remove([storagePath]).catch(() => {})
    return NextResponse.json(
      {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save resume reference — try again.',
        },
      },
      { status: 500 },
    )
  }

  // --- Sign the uploaded path and return new state ---
  const viewUrl = await signCvPath(storagePath)
  if (!viewUrl) {
    // File is stored and DB row is set — just the signed URL failed. Return
    // success with an empty viewUrl; the UI shows the filename but the link is
    // non-functional until the user reloads.
    console.warn('[auto-apply/resume] could not sign newly uploaded path', storagePath)
  }

  return NextResponse.json({
    resume: {
      source: 'override',
      fileName: originalName,
      viewUrl: viewUrl ?? '',
    } satisfies ResumeState,
  })
}

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/auto-apply/[jobId]/resume
// Clear the resume override; revert to the profile CV.
// ──────────────────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const rateLimit = checkRateLimit(
    user.id,
    RATE_LIMITS.sensitive,
    'auto-apply-resume',
  )
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      rateLimit.resetAt - Math.floor(Date.now() / 1000),
    )
    return NextResponse.json(
      {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please slow down.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // Load the current row so we know which file to delete (best-effort).
  const { data: row } = await supabase
    .from('job_applications')
    .select('resume_override_path')
    .eq('user_id', user.id)
    .eq('job_id', jobId)
    .maybeSingle()

  // row is typed as `any` by Supabase (job_applications not yet in generated types)
  const overridePath: string | null = row?.resume_override_path ?? null

  // Clear the override columns (idempotent — fine if the row doesn't exist).
  await supabase
    .from('job_applications')
    .update({
      resume_override_path: null,
      resume_override_filename: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('job_id', jobId)

  // Best-effort: remove the stored file from the bucket.
  if (overridePath) {
    const serviceClient = createServiceClient()
    await serviceClient.storage
      .from('cvs')
      .remove([overridePath])
      .catch(() => {})
  }

  // Return current resume state — the profile CV (if any).
  const { data: profile } = await supabase
    .from('profiles')
    .select('cv_url')
    .eq('id', user.id)
    .single()

  const cvUrl = (profile as { cv_url?: string | null } | null)?.cv_url ?? null

  if (!cvUrl) {
    return NextResponse.json({ resume: null })
  }

  const viewUrl = await signCvPath(cvUrl)
  const fileName = cvUrl.split('/').pop() ?? cvUrl

  return NextResponse.json({
    resume: {
      source: 'profile',
      fileName,
      viewUrl: viewUrl ?? '',
    } satisfies ResumeState,
  })
}
