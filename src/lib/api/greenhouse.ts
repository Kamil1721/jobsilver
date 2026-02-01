/**
 * Greenhouse Job Board API Client
 *
 * Public API for accessing jobs from Greenhouse job boards.
 * Docs: https://developers.greenhouse.io/job-board.html
 *
 * Key benefits:
 * - Direct URLs to real application forms (no aggregators)
 * - Full job descriptions from API
 * - Application questions included in response
 * - No authentication required - public API
 */

import { formatDescription } from '@/lib/utils/format-description'
import type { Job, ScrapedQuestion, ScrapedQuestionType } from '@/lib/supabase/types'

const GREENHOUSE_API = 'https://boards-api.greenhouse.io/v1/boards'

// =============================================================================
// TYPES - Greenhouse API Response Types
// =============================================================================

export interface GreenhouseQuestion {
  label: string
  required: boolean
  name: string
  type: string // 'input_text', 'input_file', 'multi_value_single_select', 'multi_value_multi_select', etc.
  values?: Array<{ label: string; value: number | string }>
  description?: string
}

export interface GreenhouseLocation {
  name: string
}

export interface GreenhouseDepartment {
  id: number
  name: string
  parent_id: number | null
  child_ids: number[]
}

export interface GreenhouseOffice {
  id: number
  name: string
  location: string
  parent_id: number | null
  child_ids: number[]
}

export interface GreenhouseJob {
  id: number
  internal_job_id: number
  title: string
  content: string // HTML job description
  updated_at: string
  absolute_url: string // Direct link to apply
  location: GreenhouseLocation
  departments: GreenhouseDepartment[]
  offices: GreenhouseOffice[]
  questions?: GreenhouseQuestion[] // Application questions - only with ?questions=true
  metadata?: Array<{ id: number; name: string; value: string | string[] | null }>
}

export interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[]
  meta: {
    total: number
  }
}

export interface GreenhouseBoardInfo {
  name: string
  content: string
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch all jobs from a company's Greenhouse job board
 * @param boardToken - The company's Greenhouse board token (URL slug)
 * @param includeContent - Include full job description (default: true)
 */
export async function fetchGreenhouseJobs(
  boardToken: string,
  includeContent: boolean = true
): Promise<GreenhouseJob[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const url = new URL(`${GREENHOUSE_API}/${boardToken}/jobs`)
    if (includeContent) {
      url.searchParams.set('content', 'true')
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`Greenhouse board not found: ${boardToken}`)
        return []
      }
      throw new Error(`Greenhouse API error: ${res.status}`)
    }

    const data: GreenhouseJobsResponse = await res.json()
    return data.jobs || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Greenhouse API timeout for board: ${boardToken}`)
    }
    throw error
  }
}

/**
 * Get detailed job information including application questions
 * @param boardToken - The company's Greenhouse board token
 * @param jobId - The Greenhouse job ID
 */
export async function getGreenhouseJob(
  boardToken: string,
  jobId: number
): Promise<GreenhouseJob | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const url = new URL(`${GREENHOUSE_API}/${boardToken}/jobs/${jobId}`)
    url.searchParams.set('questions', 'true')

    const res = await fetch(url.toString(), {
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
      throw new Error(`Greenhouse API error: ${res.status}`)
    }

    return await res.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Greenhouse job details timeout: ${boardToken}/${jobId}`)
    }
    throw error
  }
}

/**
 * Get Greenhouse board information
 * @param boardToken - The company's Greenhouse board token
 */
export async function getGreenhouseBoardInfo(
  boardToken: string
): Promise<GreenhouseBoardInfo | null> {
  try {
    const res = await fetch(`${GREENHOUSE_API}/${boardToken}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      return null
    }

    return await res.json()
  } catch {
    return null
  }
}

// =============================================================================
// MAPPING FUNCTIONS
// =============================================================================

/**
 * Map Greenhouse question type to our ScrapedQuestionType
 */
function mapQuestionType(greenhouseType: string): ScrapedQuestionType {
  switch (greenhouseType) {
    case 'input_text':
      return 'text'
    case 'textarea':
      return 'textarea'
    case 'input_file':
      return 'file'
    case 'multi_value_single_select':
      return 'select'
    case 'multi_value_multi_select':
      return 'checkbox'
    case 'input_hidden':
      return 'text' // Hidden fields are typically pre-filled
    default:
      return 'text'
  }
}

/**
 * Map Greenhouse questions to our ScrapedQuestion format
 */
export function mapGreenhouseQuestions(questions: GreenhouseQuestion[]): ScrapedQuestion[] {
  return questions
    .filter(q => q.type !== 'input_hidden') // Filter out hidden fields
    .map((q, index) => ({
      id: `gh_q_${index}_${q.name}`,
      label: q.label,
      type: mapQuestionType(q.type),
      required: q.required,
      placeholder: q.description || undefined,
      options: q.values?.map(v => v.label) || undefined,
      selector: `[name="${q.name}"]`, // Greenhouse uses name attribute
      page: 1,
      section: 'application',
    }))
}

/**
 * Determine remote type from job data
 */
function detectRemoteType(job: GreenhouseJob): 'fully_remote' | 'hybrid' | 'onsite' {
  const location = (job.location?.name || '').toLowerCase()
  const content = (job.content || '').toLowerCase()

  // Check for remote indicators
  const remotePatterns = [
    /\bremote\b/i,
    /work from anywhere/i,
    /fully distributed/i,
  ]

  const hybridPatterns = [
    /hybrid/i,
    /\d+\s*days?\s*(in|at)\s*(the\s+)?office/i,
    /remote\s*\/\s*office/i,
  ]

  const isRemote = remotePatterns.some(p => p.test(location) || p.test(content))
  const isHybrid = hybridPatterns.some(p => p.test(location) || p.test(content))

  if (isHybrid) return 'hybrid'
  if (isRemote) return 'fully_remote'
  return 'onsite'
}

/**
 * Map a Greenhouse job to our unified Job format
 */
export function mapGreenhouseJobToJob(
  job: GreenhouseJob,
  userId: string,
  companyName: string,
  boardToken: string
): Partial<Job> {
  // Strip HTML from content for plain text description
  const plainDescription = formatDescription(job.content || '')

  // Get department name
  const department = job.departments?.[0]?.name || null

  // Build location string
  const locationParts: string[] = []
  if (job.location?.name) {
    locationParts.push(job.location.name)
  }
  const offices = job.offices?.map(o => o.name).filter(Boolean) || []
  if (offices.length > 0 && !locationParts.includes(offices[0])) {
    locationParts.push(...offices)
  }

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: `greenhouse_${boardToken}_${job.id}`,
    source: 'greenhouse',
    title: job.title,
    company: companyName,
    company_logo_url: null,
    location: locationParts.join(', ') || 'Not specified',
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    job_type: 'FULLTIME', // Greenhouse doesn't provide this in API
    remote: detectRemoteType(job) !== 'onsite',
    remote_type: detectRemoteType(job),
    industry_category: department,
    description: plainDescription,
    application_url: job.absolute_url,
    status: 'discovered' as const,
    job_posted_at: job.updated_at,
    created_at: new Date().toISOString(),
    platform_detected: 'greenhouse',
    // Store ATS-specific data
    ats_source: 'greenhouse',
    ats_job_id: String(job.id),
  } as Partial<Job> & { ats_source: string; ats_job_id: string }
}

/**
 * Search jobs across multiple Greenhouse boards
 */
export async function searchGreenhouseJobs(
  boards: Array<{ token: string; name: string }>,
  userId: string,
  options: {
    query?: string
    limit?: number
  } = {}
): Promise<Array<Partial<Job> & { questions?: ScrapedQuestion[] }>> {
  const { query, limit = 100 } = options
  const queryLower = query?.toLowerCase()

  // Fetch jobs from all boards in parallel
  const boardResults = await Promise.allSettled(
    boards.map(async (board) => {
      const jobs = await fetchGreenhouseJobs(board.token)
      return { board, jobs }
    })
  )

  const allJobs: Array<Partial<Job> & { questions?: ScrapedQuestion[] }> = []

  for (const result of boardResults) {
    if (result.status === 'fulfilled') {
      const { board, jobs } = result.value

      for (const job of jobs) {
        // Optional: filter by query if provided
        if (queryLower) {
          const titleMatch = job.title.toLowerCase().includes(queryLower)
          const descMatch = (job.content || '').toLowerCase().includes(queryLower)
          if (!titleMatch && !descMatch) {
            continue
          }
        }

        // Map to our format
        const mappedJob = mapGreenhouseJobToJob(job, userId, board.name, board.token)

        // If job has questions from list endpoint, include them
        if (job.questions) {
          const questions = mapGreenhouseQuestions(job.questions)
          allJobs.push({ ...mappedJob, questions })
        } else {
          allJobs.push(mappedJob)
        }

        // Check limit
        if (allJobs.length >= limit) {
          break
        }
      }
    } else {
      console.error(`Failed to fetch Greenhouse jobs for board:`, result.reason)
    }

    if (allJobs.length >= limit) {
      break
    }
  }

  return allJobs.slice(0, limit)
}

/**
 * Fetch job with questions for a specific Greenhouse job
 * This is useful for getting questions when we only have the job URL
 */
export async function fetchGreenhouseJobWithQuestions(
  boardToken: string,
  jobId: number,
  userId: string,
  companyName: string
): Promise<{ job: Partial<Job>; questions: ScrapedQuestion[] } | null> {
  const jobData = await getGreenhouseJob(boardToken, jobId)
  if (!jobData) return null

  const mappedJob = mapGreenhouseJobToJob(jobData, userId, companyName, boardToken)
  const questions = jobData.questions ? mapGreenhouseQuestions(jobData.questions) : []

  return { job: mappedJob, questions }
}

/**
 * Extract board token and job ID from a Greenhouse URL
 * Supports:
 * - boards.greenhouse.io/{board}/jobs/{id}
 * - job-boards.greenhouse.io/{board}/jobs/{id}
 * - {company}.greenhouse.io/jobs/{id}
 */
export function parseGreenhouseUrl(url: string): { boardToken: string; jobId: number } | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const pathname = urlObj.pathname

    // boards.greenhouse.io/{board}/jobs/{id}
    if (hostname === 'boards.greenhouse.io' || hostname === 'job-boards.greenhouse.io') {
      const match = pathname.match(/^\/([^/]+)\/jobs\/(\d+)/)
      if (match) {
        return { boardToken: match[1], jobId: parseInt(match[2], 10) }
      }
    }

    // {company}.greenhouse.io/jobs/{id}
    if (hostname.endsWith('.greenhouse.io')) {
      const boardToken = hostname.replace('.greenhouse.io', '')
      const match = pathname.match(/^\/jobs\/(\d+)/)
      if (match) {
        return { boardToken, jobId: parseInt(match[1], 10) }
      }
    }

    return null
  } catch {
    return null
  }
}

export const SOURCE_NAME = 'greenhouse'
