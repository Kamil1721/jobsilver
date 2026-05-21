import { classifySemanticType } from '@/lib/auto-apply/classify'
import { parseAshbyUrl } from '@/lib/auto-apply/platform-detector'
import type { ApplicationQuestion, FieldType, QuestionOption } from '@/lib/auto-apply/types'

/**
 * Ashby exposes application form structure via their internal GraphQL API at
 * `jobs.ashbyhq.com/api/non-user-graphql`. The public REST API at
 * `api.ashbyhq.com/posting-api/job-board/{board}/job/{id}` consistently
 * returns 401 without a private API key, so we use the GraphQL endpoint
 * instead — it is the same API that powers the jobs.ashbyhq.com job board
 * UI and requires no authentication.
 *
 * Field type mapping (field.type values observed in the wild):
 *   String    → text
 *   Email     → text   (semanticType classifier will detect 'email')
 *   Phone     → text   (semanticType classifier will detect 'phone')
 *   Url       → text   (semanticType classifier will detect 'url')
 *   LongText  → textarea
 *   File      → file
 *   Select    → select  (with options from selectableValues)
 *   MultiSelect → multiselect (with options from selectableValues)
 *   Boolean   → select  (synthesized Yes / No options)
 *   Date      → text
 *   Number    → text
 *   Location  → text
 *
 * Any unrecognised type is mapped to 'text'.
 */

const ASHBY_GQL_URL = 'https://jobs.ashbyhq.com/api/non-user-graphql'

const ASHBY_FORM_QUERY = /* GraphQL */ `
  query GetJobPostingForm(
    $organizationHostedJobsPageName: String!
    $jobPostingId: String!
  ) {
    jobPosting(
      organizationHostedJobsPageName: $organizationHostedJobsPageName
      jobPostingId: $jobPostingId
    ) {
      id
      title
      applicationForm {
        id
        sections {
          title
          fieldEntries {
            id
            field
            isRequired
            isHidden
          }
        }
      }
    }
  }
`

interface AshbyFieldEntry {
  id: string
  field: {
    id: string
    path: string
    title: string
    type: string
    selectableValues?: Array<{ id: string; label: string }>
  }
  isRequired: boolean
  isHidden: boolean | null
}

interface AshbyFormSection {
  title: string | null
  fieldEntries: AshbyFieldEntry[]
}

interface AshbyApplicationForm {
  id: string
  sections: AshbyFormSection[]
}

interface AshbyJobPosting {
  id: string
  title: string
  applicationForm: AshbyApplicationForm | null
}

interface AshbyGqlResponse {
  data?: { jobPosting?: AshbyJobPosting | null }
  errors?: Array<{ message: string }>
}

function mapAshbyFieldType(type: string): FieldType {
  switch (type) {
    case 'LongText':
      return 'textarea'
    case 'File':
      return 'file'
    case 'Select':
    case 'ValueSelect':
    case 'Boolean':
      return 'select'
    case 'MultiSelect':
      return 'multiselect'
    // String, Email, Phone, Url, Date, Number, Location → text
    // (semanticType classifier handles email/phone/url detection)
    default:
      return 'text'
  }
}

function buildOptions(entry: AshbyFieldEntry): QuestionOption[] | undefined {
  const type = entry.field.type

  if (type === 'Boolean') {
    return [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ]
  }

  if ((type === 'Select' || type === 'ValueSelect' || type === 'MultiSelect') &&
      Array.isArray(entry.field.selectableValues) &&
      entry.field.selectableValues.length > 0) {
    return entry.field.selectableValues.map((v) => ({
      label: v.label,
      value: v.id,
    }))
  }

  return undefined
}

/**
 * Extract application questions from an Ashby job posting URL.
 * Uses the Ashby job board GraphQL API (no auth required).
 */
export async function extractAshbyQuestions(url: string): Promise<ApplicationQuestion[]> {
  const parsed = parseAshbyUrl(url)
  if (!parsed) {
    throw new Error(
      `Could not parse an Ashby job board name and posting id from URL: "${url}". ` +
        'Expected a path like /{jobBoardName}/{jobPostingId}.',
    )
  }

  const { jobBoardName, jobPostingId } = parsed

  let upstream: Response
  try {
    upstream = await fetch(ASHBY_GQL_URL + '?op=GetJobPostingForm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Referer: `https://jobs.ashbyhq.com/${jobBoardName}/${jobPostingId}`,
      },
      body: JSON.stringify({
        operationName: 'GetJobPostingForm',
        variables: {
          organizationHostedJobsPageName: jobBoardName,
          jobPostingId,
        },
        query: ASHBY_FORM_QUERY,
      }),
      cache: 'no-store',
    })
  } catch (err) {
    throw new Error(`Failed to reach the Ashby API: ${String(err)}`)
  }

  if (!upstream.ok) {
    throw new Error(`Ashby API responded with ${upstream.status} for board "${jobBoardName}" posting "${jobPostingId}".`)
  }

  let body: AshbyGqlResponse
  try {
    body = (await upstream.json()) as AshbyGqlResponse
  } catch {
    throw new Error('Ashby API returned invalid JSON.')
  }

  if (body.errors?.length) {
    throw new Error(`Ashby API errors: ${body.errors.map((e) => e.message).join('; ')}`)
  }

  const jobPosting = body.data?.jobPosting
  if (!jobPosting) {
    throw new Error(`Ashby posting "${jobPostingId}" not found on board "${jobBoardName}".`)
  }

  const questions: ApplicationQuestion[] = []
  const form = jobPosting.applicationForm

  if (!form) {
    return questions
  }

  for (const section of form.sections) {
    for (const entry of section.fieldEntries) {
      // Skip hidden fields
      if (entry.isHidden === true) {
        continue
      }

      const fieldKey = entry.field.path
      const label = entry.field.title || entry.id
      const fieldType = mapAshbyFieldType(entry.field.type)
      const semanticType = classifySemanticType(fieldKey, label, fieldType)
      const options = buildOptions(entry)

      const q: ApplicationQuestion = {
        fieldKey,
        label,
        fieldType,
        semanticType,
        required: entry.isRequired,
        position: questions.length,
        source: 'api',
      }

      if (options) {
        q.options = options
      }

      questions.push(q)
    }
  }

  return questions
}
