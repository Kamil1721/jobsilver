import { computePostingKey } from '@/lib/auto-apply/platform-detector'
import { extractQuestions } from '@/lib/auto-apply/extraction'
import type { ApplicationQuestion, QuestionOption } from '@/lib/auto-apply/types'
import { createServiceClient } from '@/lib/supabase/server'

// DB row shape (snake_case columns from job_application_questions)
interface DbQuestionRow {
  field_key: string
  label: string
  field_type: string
  semantic_type: string
  required: boolean
  options: QuestionOption[] | null
  position: number
  source: string
}

function rowToQuestion(row: DbQuestionRow): ApplicationQuestion {
  return {
    fieldKey: row.field_key,
    label: row.label,
    fieldType: row.field_type as ApplicationQuestion['fieldType'],
    semanticType: row.semantic_type as ApplicationQuestion['semanticType'],
    required: row.required,
    options: row.options ?? undefined,
    position: row.position,
    source: row.source as ApplicationQuestion['source'],
  }
}

/**
 * Return cached questions for `jobUrl` if they exist in the DB; otherwise
 * extract them, persist them, and return the extracted list.
 *
 * Uses a service-role client so it can bypass RLS (called from server-side
 * code, not from user-facing requests that carry a session cookie).
 */
export async function getOrExtractQuestions(jobUrl: string): Promise<ApplicationQuestion[]> {
  const postingKey = computePostingKey(jobUrl)
  const supabase = createServiceClient()

  // --- Cache hit path ---
  const { data: cached, error: selectError } = await supabase
    .from('job_application_questions')
    .select('field_key, label, field_type, semantic_type, required, options, position, source')
    .eq('posting_key', postingKey)
    .order('position')

  if (selectError) {
    throw new Error(`Failed to query question cache: ${selectError.message}`)
  }

  if (cached && cached.length > 0) {
    return (cached as DbQuestionRow[]).map(rowToQuestion)
  }

  // --- Cache miss: extract then persist ---
  const result = await extractQuestions(jobUrl)
  const questions = result.questions

  if (questions.length === 0) {
    return []
  }

  const rows = questions.map((q) => ({
    posting_key: postingKey,
    field_key: q.fieldKey,
    label: q.label,
    field_type: q.fieldType,
    semantic_type: q.semanticType,
    required: q.required,
    options: q.options ?? null,
    position: q.position,
    source: q.source,
  }))

  const { error: insertError } = await supabase
    .from('job_application_questions')
    .insert(rows)

  if (insertError) {
    // Unique-constraint violation: a concurrent extraction won the race.
    // Re-select and return the stored rows.
    if (insertError.code === '23505') {
      const { data: concurrent, error: refetchError } = await supabase
        .from('job_application_questions')
        .select('field_key, label, field_type, semantic_type, required, options, position, source')
        .eq('posting_key', postingKey)
        .order('position')

      if (refetchError) {
        throw new Error(`Failed to re-fetch after concurrent insert: ${refetchError.message}`)
      }

      return ((concurrent ?? []) as DbQuestionRow[]).map(rowToQuestion)
    }

    throw new Error(`Failed to cache questions: ${insertError.message}`)
  }

  return questions
}
