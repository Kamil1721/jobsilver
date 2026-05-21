import { computePostingKey } from '@/lib/auto-apply/platform-detector'
import { getOrExtractQuestions } from '@/lib/auto-apply/questions-store'
import { UnsupportedAtsError } from '@/lib/auto-apply/extraction'
import { createServiceClient } from '@/lib/supabase/server'

export type QuestionsStatus = 'pending' | 'ready' | 'failed' | 'unsupported'

export interface ExtractAndStoreResult {
  postingKey: string
  status: QuestionsStatus
  questionCount: number
  error?: string
}

/**
 * Extract a job posting's application questions and record the outcome on its
 * `jobs` row. Shared by the daily-curation cron and the dev trigger route.
 *
 * Never throws — extraction failure is recorded as a status, not propagated,
 * so one bad posting cannot abort a curation run.
 *
 *   - 'ready'       — questions extracted (or the posting genuinely has none).
 *   - 'unsupported' — URL is not a Greenhouse/Lever/Ashby ATS (no extractor yet).
 *   - 'failed'      — a supported ATS returned an error.
 */
export async function extractAndStoreForJob(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  applicationUrl: string,
): Promise<ExtractAndStoreResult> {
  const postingKey = computePostingKey(applicationUrl)
  let status: QuestionsStatus = 'failed'
  let questionCount = 0
  let error: string | undefined

  try {
    const questions = await getOrExtractQuestions(applicationUrl)
    questionCount = questions.length
    status = 'ready'
  } catch (err) {
    if (err instanceof UnsupportedAtsError) {
      status = 'unsupported'
    } else {
      status = 'failed'
      error = err instanceof Error ? err.message : 'Unknown extraction error'
      console.error(`[auto-apply] Question extraction failed for job ${jobId}:`, error)
    }
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ posting_key: postingKey, questions_status: status })
    .eq('id', jobId)

  if (updateError) {
    console.error(
      `[auto-apply] Failed to record questions_status for job ${jobId}:`,
      updateError.message,
    )
  }

  return { postingKey, status, questionCount, error }
}
