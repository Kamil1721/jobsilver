import { classifySemanticType } from '@/lib/auto-apply/classify'
import { parseGreenhouseUrl } from '@/lib/auto-apply/platform-detector'
import type { ApplicationQuestion, FieldType } from '@/lib/auto-apply/types'

// Greenhouse field.type → FieldType
const FIELD_TYPE_MAP: Record<string, FieldType> = {
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
  questions?: GreenhouseQuestion[]
}

/**
 * Extract application questions from a Greenhouse job posting URL.
 * Emits one ApplicationQuestion per field (a Greenhouse "question" can have
 * multiple fields — e.g. a resume question carries both a file upload and a
 * textarea for pasting text).
 */
export async function extractGreenhouseQuestions(url: string): Promise<ApplicationQuestion[]> {
  const parsed = parseGreenhouseUrl(url)
  if (!parsed) {
    throw new Error(
      `Could not parse a Greenhouse board token and job id from URL: "${url}". ` +
        'Expected a path like /{boardToken}/jobs/{jobId}.',
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
  } catch (err) {
    throw new Error(`Failed to reach the Greenhouse API: ${String(err)}`)
  }

  if (!upstream.ok) {
    throw new Error(
      `Greenhouse API responded with ${upstream.status} for board "${boardToken}" job "${jobId}".`,
    )
  }

  let job: GreenhouseJob
  try {
    job = (await upstream.json()) as GreenhouseJob
  } catch {
    throw new Error('Greenhouse API returned invalid JSON.')
  }

  const questions: ApplicationQuestion[] = []

  for (const question of job.questions ?? []) {
    const label = question.label ?? 'Question'
    const required = question.required === true

    // A Greenhouse "question" (e.g. Resume/CV, Cover Letter) can carry both an
    // input_file field and a textarea companion (upload OR paste). When a file
    // field is present, emit only the file field and drop the textarea so the
    // UI shows a single control for the question.
    const hasFileField = (question.fields ?? []).some((f) => f.type === 'input_file')

    for (const field of question.fields ?? []) {
      if (hasFileField && field.type === 'textarea') {
        continue
      }

      const fieldType = FIELD_TYPE_MAP[field.type ?? '']
      if (!fieldType) {
        // Unknown / unsupported field type — skip rather than guess.
        continue
      }

      const fieldKey = field.name ?? `field_${questions.length}`
      const semanticType = classifySemanticType(fieldKey, label, fieldType)

      const q: ApplicationQuestion = {
        fieldKey,
        label,
        fieldType,
        semanticType,
        required,
        position: questions.length,
        source: 'api',
      }

      if ((fieldType === 'select' || fieldType === 'multiselect') && Array.isArray(field.values)) {
        q.options = field.values.map((v, i) => ({
          label: v.label ?? String(v.value ?? `Option ${i + 1}`),
          value: String(v.value ?? ''),
        }))
      }

      questions.push(q)
    }
  }

  return questions
}
