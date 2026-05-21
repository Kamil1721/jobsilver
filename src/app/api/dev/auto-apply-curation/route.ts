import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { searchJobs, mapFantasticJobToJob } from '@/lib/api/fantasticjobs'
import { extractAndStoreForJob } from '@/lib/auto-apply/curation-extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * DEV-ONLY trigger for the auto-apply curation pipeline.
 *
 * Fetches a small batch of jobs from fantastic.jobs, stores any not already
 * present for the user, runs question extraction on each, and returns a JSON
 * summary. Lets you exercise the curation -> extraction flow on a dev server
 * without the production cron's CRON_SECRET / production_mode prerequisites.
 *
 *   GET /api/dev/auto-apply-curation?limit=5&userId=<uuid>
 *
 * Returns 404 in production.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Not found' } },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 5, 20)
  const requestedUserId = searchParams.get('userId')

  const supabase = createServiceClient()

  // Resolve the owning user: explicit ?userId, else the first profile.
  let userId = requestedUserId
  if (!userId) {
    const { data: firstProfile } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single()
    userId = firstProfile?.id ?? null
  }
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'no_user', message: 'No profile found — pass ?userId=<uuid>' } },
      { status: 400 },
    )
  }

  // 1. Fetch a batch of jobs from fantastic.jobs.
  let fjJobs
  try {
    fjJobs = await searchJobs({ limit, description_type: 'html' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fantastic.jobs request failed'
    return NextResponse.json({ error: { code: 'fetch_failed', message } }, { status: 502 })
  }

  // De-dupe against jobs already stored for this user.
  const { data: existing } = await supabase
    .from('jobs')
    .select('external_id')
    .eq('user_id', userId)
  const existingIds = new Set((existing ?? []).map((j) => j.external_id))

  // 2. Store each new job, then extract its questions.
  const results: Array<Record<string, unknown>> = []
  for (const fjJob of fjJobs) {
    const mapped = mapFantasticJobToJob(fjJob, userId)

    if (existingIds.has(mapped.external_id)) {
      results.push({ title: mapped.title, skipped: 'already stored' })
      continue
    }

    const { data: savedJob, error: saveError } = await supabase
      .from('jobs')
      .insert({
        user_id: mapped.user_id,
        external_id: mapped.external_id,
        source: mapped.source,
        ats_source: mapped.ats_source,
        title: mapped.title,
        company: mapped.company,
        company_logo_url: mapped.company_logo_url,
        location: mapped.location,
        salary_min: mapped.salary_min,
        salary_max: mapped.salary_max,
        salary_currency: mapped.salary_currency,
        job_type: mapped.job_type,
        remote: mapped.remote,
        remote_type: mapped.remote_type,
        description: mapped.description,
        application_url: mapped.application_url,
        status: 'discovered',
        auto_apply_status: 'manual',
      })
      .select()
      .single()

    if (saveError || !savedJob) {
      results.push({ title: mapped.title, error: saveError?.message ?? 'insert failed' })
      continue
    }
    existingIds.add(mapped.external_id)

    const extraction = await extractAndStoreForJob(
      supabase,
      savedJob.id,
      mapped.application_url,
    )
    results.push({
      jobId: savedJob.id,
      title: mapped.title,
      company: mapped.company,
      applicationUrl: mapped.application_url,
      questionsStatus: extraction.status,
      questionCount: extraction.questionCount,
      ...(extraction.error ? { extractionError: extraction.error } : {}),
    })
  }

  const readyCount = results.filter((r) => r.questionsStatus === 'ready').length
  return NextResponse.json({
    userId,
    jobsFetched: fjJobs.length,
    jobsProcessed: results.length,
    jobsWithQuestions: readyCount,
    results,
  })
}
