/**
 * Ashby Public Job Posting API Client
 *
 * Public API for accessing jobs from Ashby job boards.
 * Docs: https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 * Key benefits:
 * - Direct URLs to real application forms
 * - Full job descriptions from API
 * - Application form structure from API
 * - No authentication required - public API
 */

import { formatDescription } from '@/lib/utils/format-description'
import type { Job, ScrapedQuestion, ScrapedQuestionType } from '@/lib/supabase/types'

const ASHBY_API = 'https://api.ashbyhq.com/posting-api'

// =============================================================================
// TYPES - Ashby API Response Types
// =============================================================================

export interface AshbyLocation {
  id: string
  name: string
  isRemote: boolean
  city?: string
  region?: string
  country?: string
  address?: {
    postalAddress?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }
}

export interface AshbyDepartment {
  id: string
  name: string
  parentId?: string
}

export interface AshbyCompensation {
  type: 'Salary' | 'Hourly' | 'Commission' | 'Equity'
  currency: string
  min: number
  max: number
  interval: 'Year' | 'Month' | 'Week' | 'Hour'
}

export interface AshbyFormField {
  id: string
  type: 'String' | 'LongText' | 'Email' | 'Phone' | 'File' | 'Select' | 'MultiSelect' | 'Boolean' | 'Date' | 'Number' | 'Url'
  title: string
  isRequired: boolean
  description?: string
  selectableValues?: Array<{ id: string; label: string }>
  path: string // e.g., "name", "email", "resume", "customField.uuid"
}

export interface AshbyJobPosting {
  id: string
  title: string
  description: string // HTML
  descriptionPlain?: string
  publishedAt: string
  updatedAt: string
  employmentType: 'FullTime' | 'PartTime' | 'Contract' | 'Internship' | 'Temporary' | null
  location: AshbyLocation
  department: AshbyDepartment | null
  team?: { id: string; name: string } | null
  compensation?: AshbyCompensation[]
  isRemote: boolean
  isListed: boolean
  applyUrl: string
  externalLink?: string
  applicationFormDefinition?: {
    sections: Array<{
      id: string
      title: string
      fields: AshbyFormField[]
    }>
  }
}

export interface AshbyJobBoardInfo {
  id: string
  name: string
  organizationName: string
}

// List response item (different from full posting)
export interface AshbyJobPostingListItem {
  id: string
  title: string
  department: string | null
  team: string | null
  employmentType: 'FullTime' | 'PartTime' | 'Contract' | 'Internship' | 'Temporary' | null
  location: string
  secondaryLocations: string[]
  publishedAt: string
  isListed: boolean
  isRemote: boolean
  address?: {
    postalAddress?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }
  jobUrl: string
  applyUrl: string
  descriptionHtml?: string
  descriptionPlain?: string
}

export interface AshbyJobPostingsResponse {
  jobs: AshbyJobPostingListItem[]
  apiVersion?: string
}

export interface AshbyJobPostingInfoResponse {
  jobPosting: AshbyJobPosting
  jobBoard?: AshbyJobBoardInfo
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch all job postings from an Ashby job board
 * @param boardName - The company's Ashby board name (URL slug)
 */
export async function fetchAshbyJobPostings(
  boardName: string
): Promise<AshbyJobPostingListItem[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${ASHBY_API}/job-board/${boardName}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`Ashby board not found: ${boardName}`)
        return []
      }
      throw new Error(`Ashby API error: ${res.status}`)
    }

    const data: AshbyJobPostingsResponse = await res.json()
    return data.jobs || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ashby API timeout for board: ${boardName}`)
    }
    throw error
  }
}

/**
 * Get detailed job posting information including application form
 * @param boardName - The company's Ashby board name
 * @param jobPostingId - The job posting ID
 */
export async function getAshbyJobPosting(
  boardName: string,
  jobPostingId: string
): Promise<AshbyJobPosting | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(`${ASHBY_API}/job-board/${boardName}/job/${jobPostingId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) {
        return null
      }
      throw new Error(`Ashby API error: ${res.status}`)
    }

    const data: AshbyJobPostingInfoResponse = await res.json()
    return data.jobPosting || null
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ashby job posting timeout: ${boardName}/${jobPostingId}`)
    }
    throw error
  }
}

/**
 * Get job board info for an Ashby board
 */
export async function getAshbyJobBoardInfo(
  boardName: string
): Promise<AshbyJobBoardInfo | null> {
  const postings = await fetchAshbyJobPostings(boardName)

  // The job board info is included in the response
  // If we got any postings, the board exists
  if (postings.length > 0) {
    return {
      id: boardName,
      name: boardName,
      organizationName: boardName,
    }
  }

  return null
}

// =============================================================================
// MAPPING FUNCTIONS
// =============================================================================

/**
 * Map Ashby field type to our ScrapedQuestionType
 */
function mapFieldType(ashbyType: string): ScrapedQuestionType {
  switch (ashbyType) {
    case 'String':
      return 'text'
    case 'LongText':
      return 'textarea'
    case 'Email':
      return 'email'
    case 'Phone':
      return 'phone'
    case 'File':
      return 'file'
    case 'Select':
      return 'select'
    case 'MultiSelect':
      return 'checkbox'
    case 'Boolean':
      return 'checkbox'
    case 'Date':
      return 'date'
    case 'Number':
      return 'number'
    case 'Url':
      return 'url'
    default:
      return 'text'
  }
}

/**
 * Map Ashby application form fields to our ScrapedQuestion format
 */
export function mapAshbyFormFields(posting: AshbyJobPosting | AshbyJobPostingListItem): ScrapedQuestion[] {
  const questions: ScrapedQuestion[] = []

  // List items don't have form definitions - use standard questions
  if ('jobUrl' in posting) {
    return generateStandardAshbyQuestions()
  }

  const fullPosting = posting as AshbyJobPosting
  if (!fullPosting.applicationFormDefinition?.sections) {
    // Return standard Ashby fields if no form definition
    return generateStandardAshbyQuestions()
  }

  for (const section of fullPosting.applicationFormDefinition.sections) {
    for (const field of section.fields) {
      questions.push({
        id: `ashby_${field.id}`,
        label: field.title,
        type: mapFieldType(field.type),
        required: field.isRequired,
        placeholder: field.description || undefined,
        options: field.selectableValues?.map(v => v.label) || undefined,
        selector: `[data-ashby-path="${field.path}"]`,
        page: 1,
        section: section.title,
      })
    }
  }

  return questions
}

/**
 * Generate standard Ashby form questions when form definition is not available
 */
export function generateStandardAshbyQuestions(): ScrapedQuestion[] {
  return [
    {
      id: 'ashby_name',
      label: 'Full name',
      type: 'text',
      required: true,
      selector: 'input[name="name"], input[data-ashby-path="name"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'ashby_email',
      label: 'Email',
      type: 'email',
      required: true,
      selector: 'input[name="email"], input[data-ashby-path="email"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'ashby_phone',
      label: 'Phone',
      type: 'phone',
      required: false,
      selector: 'input[name="phone"], input[data-ashby-path="phone"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'ashby_resume',
      label: 'Resume/CV',
      type: 'file',
      required: true,
      selector: 'input[type="file"], input[data-ashby-path="resume"]',
      page: 1,
      section: 'documents',
    },
    {
      id: 'ashby_linkedin',
      label: 'LinkedIn URL',
      type: 'url',
      required: false,
      selector: 'input[name="linkedinUrl"], input[data-ashby-path="linkedinUrl"]',
      page: 1,
      section: 'links',
    },
  ]
}

/**
 * Determine remote type from Ashby posting
 */
function detectRemoteType(posting: AshbyJobPosting): 'fully_remote' | 'hybrid' | 'onsite' {
  // Ashby has explicit remote flag
  if (posting.isRemote || posting.location?.isRemote) {
    // Check for hybrid indicators in description
    const description = (posting.description || '').toLowerCase()
    const hybridPatterns = [
      /hybrid/i,
      /\d+\s*days?\s*(in|at)\s*(the\s+)?office/i,
    ]

    if (hybridPatterns.some(p => p.test(description))) {
      return 'hybrid'
    }
    return 'fully_remote'
  }

  return 'onsite'
}

/**
 * Build location string from Ashby location object
 */
function buildLocationString(location: AshbyLocation): string {
  const parts: string[] = []

  if (location.name) {
    parts.push(location.name)
  } else {
    if (location.city) parts.push(location.city)
    if (location.region) parts.push(location.region)
    if (location.country) parts.push(location.country)
  }

  if (parts.length === 0 && location.isRemote) {
    return 'Remote'
  }

  return parts.join(', ') || 'Not specified'
}

/**
 * Map job type from Ashby employment type
 */
function mapJobType(employmentType: AshbyJobPosting['employmentType']): string {
  if (!employmentType) return 'FULLTIME'

  switch (employmentType) {
    case 'FullTime':
      return 'FULLTIME'
    case 'PartTime':
      return 'PARTTIME'
    case 'Contract':
    case 'Temporary':
      return 'CONTRACTOR'
    case 'Internship':
      return 'INTERN'
    default:
      return 'FULLTIME'
  }
}

/**
 * Parse salary from Ashby compensation array
 */
function parseSalary(compensation?: AshbyCompensation[]): {
  min: number | null
  max: number | null
  currency: string | null
} {
  if (!compensation || compensation.length === 0) {
    return { min: null, max: null, currency: null }
  }

  // Find salary compensation (prefer over hourly, commission, equity)
  const salary = compensation.find(c => c.type === 'Salary')
    || compensation.find(c => c.type === 'Hourly')

  if (!salary) {
    return { min: null, max: null, currency: null }
  }

  let min = salary.min
  let max = salary.max

  // Convert to annual if not already
  if (salary.interval === 'Hour') {
    min = min * 2080 // 40 hours * 52 weeks
    max = max * 2080
  } else if (salary.interval === 'Month') {
    min = min * 12
    max = max * 12
  } else if (salary.interval === 'Week') {
    min = min * 52
    max = max * 52
  }

  return {
    min,
    max,
    currency: salary.currency || 'USD',
  }
}

/**
 * Map an Ashby job posting to our unified Job format
 */
export function mapAshbyJobPostingToJob(
  posting: AshbyJobPosting | AshbyJobPostingListItem,
  userId: string,
  companyName: string,
  boardName: string
): Partial<Job> {
  // Handle both full posting and list item formats
  const isListItem = 'jobUrl' in posting

  // Get compensation if available (full posting only)
  const salary = 'compensation' in posting ? parseSalary(posting.compensation) : { min: null, max: null, currency: null }

  // Get remote type
  const remoteType = posting.isRemote ? 'fully_remote' : 'onsite'

  // Get plain text description
  let description = ''
  if (isListItem) {
    const listItem = posting as AshbyJobPostingListItem
    description = listItem.descriptionPlain || formatDescription(listItem.descriptionHtml || '')
  } else {
    const fullPosting = posting as AshbyJobPosting
    description = fullPosting.descriptionPlain || formatDescription(fullPosting.description || '')
  }

  // Get location string
  const location = isListItem
    ? (posting as AshbyJobPostingListItem).location
    : buildLocationString((posting as AshbyJobPosting).location)

  // Get department/team
  let industryCategory: string | null = null
  if (isListItem) {
    const listItem = posting as AshbyJobPostingListItem
    industryCategory = listItem.department || listItem.team || null
  } else {
    const fullPosting = posting as AshbyJobPosting
    industryCategory = fullPosting.department?.name || fullPosting.team?.name || null
  }

  // Get apply URL
  const applicationUrl = isListItem
    ? (posting as AshbyJobPostingListItem).applyUrl
    : ((posting as AshbyJobPosting).applyUrl || (posting as AshbyJobPosting).externalLink)

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: `ashby_${boardName}_${posting.id}`,
    source: 'ashby',
    title: posting.title,
    company: companyName,
    company_logo_url: null,
    location,
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    job_type: mapJobType(posting.employmentType),
    remote: remoteType !== 'onsite',
    remote_type: remoteType,
    industry_category: industryCategory,
    description,
    application_url: applicationUrl,
    status: 'discovered' as const,
    job_posted_at: posting.publishedAt,
    created_at: new Date().toISOString(),
    platform_detected: 'ashby' as const,
    // Store ATS-specific data
    ats_source: 'ashby',
    ats_job_id: posting.id,
  } as Partial<Job> & { ats_source: string; ats_job_id: string }
}

/**
 * Search jobs across multiple Ashby boards
 */
export async function searchAshbyJobs(
  boards: Array<{ name: string; displayName: string }>,
  userId: string,
  options: {
    query?: string
    limit?: number
  } = {}
): Promise<Array<Partial<Job> & { questions?: ScrapedQuestion[] }>> {
  const { query, limit = 100 } = options
  const queryLower = query?.toLowerCase()

  // Fetch postings from all boards in parallel
  const boardResults = await Promise.allSettled(
    boards.map(async (board) => {
      const postings = await fetchAshbyJobPostings(board.name)
      return { board, postings }
    })
  )

  const allJobs: Array<Partial<Job> & { questions?: ScrapedQuestion[] }> = []

  for (const result of boardResults) {
    if (result.status === 'fulfilled') {
      const { board, postings } = result.value

      for (const posting of postings) {
        // Skip unlisted jobs
        if (!posting.isListed) {
          continue
        }

        // Optional: filter by query if provided
        if (queryLower) {
          const titleMatch = posting.title.toLowerCase().includes(queryLower)
          const descMatch = (posting.descriptionPlain || posting.descriptionHtml || '').toLowerCase().includes(queryLower)
          if (!titleMatch && !descMatch) {
            continue
          }
        }

        // Map to our format
        const mappedJob = mapAshbyJobPostingToJob(posting, userId, board.displayName, board.name)

        // Map form fields to questions
        const questions = mapAshbyFormFields(posting)
        allJobs.push({ ...mappedJob, questions })

        // Check limit
        if (allJobs.length >= limit) {
          break
        }
      }
    } else {
      console.error(`Failed to fetch Ashby postings for board:`, result.reason)
    }

    if (allJobs.length >= limit) {
      break
    }
  }

  return allJobs.slice(0, limit)
}

/**
 * Extract board name and job ID from an Ashby URL
 * Supports:
 * - jobs.ashbyhq.com/{board}/jobs/{id}
 * - {board}.ashbyhq.com/{id}
 */
export function parseAshbyUrl(url: string): { boardName: string; jobId: string } | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const pathname = urlObj.pathname

    // jobs.ashbyhq.com/{board}/jobs/{id} or jobs.ashbyhq.com/{board}/{id}
    if (hostname === 'jobs.ashbyhq.com') {
      // Try pattern with /jobs/
      let match = pathname.match(/^\/([^/]+)\/jobs\/([^/]+)/)
      if (match) {
        return { boardName: match[1], jobId: match[2] }
      }
      // Try pattern without /jobs/
      match = pathname.match(/^\/([^/]+)\/([a-f0-9-]+)/)
      if (match) {
        return { boardName: match[1], jobId: match[2] }
      }
    }

    // {board}.ashbyhq.com/{id}
    if (hostname.endsWith('.ashbyhq.com') && hostname !== 'jobs.ashbyhq.com') {
      const boardName = hostname.replace('.ashbyhq.com', '')
      const match = pathname.match(/^\/([a-f0-9-]+)/)
      if (match) {
        return { boardName, jobId: match[1] }
      }
    }

    return null
  } catch {
    return null
  }
}

export const SOURCE_NAME = 'ashby'
