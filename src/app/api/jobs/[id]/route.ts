import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApplicationQuestions } from '@/lib/ai/matching'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { z } from 'zod'
import type { JobStatus } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// UUID v4 regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Maximum size limits for application_answers to prevent abuse
const MAX_ANSWER_KEY_LENGTH = 200
const MAX_ANSWER_VALUE_LENGTH = 10000  // 10KB per answer
const MAX_ANSWER_ENTRIES = 50

// Validation schema for application_answers
const applicationAnswersSchema = z.record(
  z.string().max(MAX_ANSWER_KEY_LENGTH, `Question key must be under ${MAX_ANSWER_KEY_LENGTH} characters`),
  z.string().max(MAX_ANSWER_VALUE_LENGTH, `Answer must be under ${MAX_ANSWER_VALUE_LENGTH} characters`)
).refine(
  (obj) => Object.keys(obj).length <= MAX_ANSWER_ENTRIES,
  { message: `Maximum ${MAX_ANSWER_ENTRIES} answers allowed` }
).optional()

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// Valid job status values for validation
const VALID_JOB_STATUSES: JobStatus[] = ['discovered', 'saved', 'applied', 'interviewing', 'offer', 'discarded']

function isValidJobStatus(status: unknown): status is JobStatus {
  return typeof status === 'string' && VALID_JOB_STATUSES.includes(status as JobStatus)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting for job detail requests (generous limit for normal usage)
    const rateLimit = checkRateLimit(user.id, { maxRequests: 100, windowSeconds: 60, prefix: 'job-detail' }, 'job-detail')
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Generate application questions if not already present
    if (!job.application_questions || job.application_questions.length === 0) {
      const questions = await generateApplicationQuestions(job)

      // Update job with questions
      await supabase
        .from('jobs')
        .update({ application_questions: questions })
        .eq('id', params.id)

      job.application_questions = questions
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error fetching job:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, application_answers } = body

    const updateData: Record<string, unknown> = {}

    if (status) {
      // Validate status is a valid JobStatus value
      if (!isValidJobStatus(status)) {
        return NextResponse.json(
          { error: `Invalid status value. Must be one of: ${VALID_JOB_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = status
      if (status === 'applied') {
        updateData.applied_at = new Date().toISOString()
        // Set expiry to 60 days from now
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + 60)
        updateData.expires_at = expiryDate.toISOString()
      }
    }

    if (application_answers !== undefined) {
      // Validate application_answers to prevent abuse
      const answerValidation = applicationAnswersSchema.safeParse(application_answers)
      if (!answerValidation.success) {
        return NextResponse.json(
          { error: 'Invalid application answers', details: answerValidation.error.flatten() },
          { status: 400 }
        )
      }
      updateData.application_answers = application_answers
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Job update error:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 400 })
    }

    // If marking as applied, also save to history
    if (status === 'applied') {
      await supabase.from('application_history').insert({
        user_id: user.id,
        job_id: job.id,
        job_title: job.title,
        company: job.company,
        status: 'applied',
        applied_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error updating job:', error)
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'generate_questions') {
      // Fetch the job
      const { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error || !job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      // Generate new questions
      const questions = await generateApplicationQuestions(job)

      // Update job with questions
      await supabase
        .from('jobs')
        .update({ application_questions: questions })
        .eq('id', params.id)

      return NextResponse.json({ questions })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing job action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate UUID format
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Job delete error:', error)
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    )
  }
}
