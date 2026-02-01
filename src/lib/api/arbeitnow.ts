/**
 * Arbeitnow Job Search API Integration
 *
 * API Documentation: https://www.arbeitnow.com/blog/job-board-api
 * Coverage: Europe-focused, remote jobs, visa sponsorship jobs
 * Authentication: No API key required (public API)
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number // Unix timestamp
}

export interface ArbeitnowResponse {
  data: ArbeitnowJob[]
  links: {
    first: string
    last: string
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number
    last_page: number
    path: string
    per_page: number
    to: number
    total: number
    terms: string
    info: string
  }
}

export interface ArbeitnowSearchParams {
  query?: string
  page?: number
  remote?: boolean
  visaSponsorship?: boolean
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class ArbeitnowApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ArbeitnowApiError'
  }
}

export class ArbeitnowTimeoutError extends ArbeitnowApiError {
  constructor(timeoutMs: number) {
    super(`Arbeitnow API request timed out after ${timeoutMs}ms`, 0)
    this.name = 'ArbeitnowTimeoutError'
  }
}

export class ArbeitnowRateLimitError extends ArbeitnowApiError {
  constructor(
    public retryAfterSeconds: number
  ) {
    super('Arbeitnow API rate limit exceeded', 429)
    this.name = 'ArbeitnowRateLimitError'
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ARBEITNOW_BASE_URL = 'https://www.arbeitnow.com/api/job-board-api'
const ARBEITNOW_TIMEOUT_MS = 30000
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000
const MAX_PAGE = 50

export const SOURCE_NAME = 'arbeitnow'
export const SOURCE_LABEL = 'Arbeitnow'

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  attempt: number = 1
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ARBEITNOW_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    // Handle rate limiting (HTTP 429)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      if (attempt < MAX_RETRIES) {
        const waitTime = Math.min(retryAfter * 1000, 60000) // Cap at 60 seconds
        console.warn(`Arbeitnow rate limited, retrying after ${waitTime/1000}s (attempt ${attempt}/${MAX_RETRIES})`)
        await sleep(waitTime)
        return fetchWithRetry(url, attempt + 1)
      }
      throw new ArbeitnowRateLimitError(retryAfter)
    }

    // Handle other errors with retry
    if (!response.ok && attempt < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Arbeitnow API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ArbeitnowTimeoutError(ARBEITNOW_TIMEOUT_MS)
    }

    if (attempt < MAX_RETRIES && !(error instanceof ArbeitnowRateLimitError)) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Arbeitnow network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    throw error
  }
}

function validateResponse(data: unknown): ArbeitnowResponse {
  if (!data || typeof data !== 'object') {
    throw new ArbeitnowApiError('Invalid response format from Arbeitnow API', 500)
  }

  const response = data as Record<string, unknown>

  if (!Array.isArray(response.data)) {
    throw new ArbeitnowApiError('Missing data array in Arbeitnow response', 500)
  }

  const meta = response.meta as Record<string, unknown> | undefined
  const links = response.links as Record<string, unknown> | undefined

  return {
    data: response.data.slice(0, 100).map(validateJob),
    links: {
      first: String(links?.first || ''),
      last: String(links?.last || ''),
      prev: links?.prev ? String(links.prev) : null,
      next: links?.next ? String(links.next) : null
    },
    meta: {
      current_page: typeof meta?.current_page === 'number' ? meta.current_page : 1,
      from: typeof meta?.from === 'number' ? meta.from : 0,
      last_page: typeof meta?.last_page === 'number' ? meta.last_page : 1,
      path: String(meta?.path || ''),
      per_page: typeof meta?.per_page === 'number' ? meta.per_page : 100,
      to: typeof meta?.to === 'number' ? meta.to : 0,
      total: typeof meta?.total === 'number' ? meta.total : 0,
      terms: String(meta?.terms || ''),
      info: String(meta?.info || '')
    }
  }
}

function validateJob(job: unknown): ArbeitnowJob {
  if (!job || typeof job !== 'object') {
    throw new ArbeitnowApiError('Invalid job object in response', 500)
  }

  const j = job as Record<string, unknown>

  return {
    slug: String(j.slug || ''),
    company_name: String(j.company_name || 'Unknown Company'),
    title: String(j.title || 'Untitled Position'),
    description: String(j.description || '').slice(0, 50000),
    remote: Boolean(j.remote),
    url: String(j.url || ''),
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    job_types: Array.isArray(j.job_types) ? j.job_types.map(String) : [],
    location: String(j.location || ''),
    created_at: typeof j.created_at === 'number' ? j.created_at : Date.now() / 1000
  }
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Search for jobs using the Arbeitnow API
 */
export async function searchJobs(params: ArbeitnowSearchParams = {}): Promise<ArbeitnowJob[]> {
  // Build URL
  const url = new URL(ARBEITNOW_BASE_URL)

  // Add pagination
  if (params.page && params.page > 0 && params.page <= MAX_PAGE) {
    url.searchParams.set('page', String(params.page))
  }

  // Add remote filter
  if (params.remote !== undefined) {
    url.searchParams.set('remote', params.remote ? 'true' : 'false')
  }

  // Add visa sponsorship filter
  if (params.visaSponsorship !== undefined) {
    url.searchParams.set('visa_sponsorship', params.visaSponsorship ? 'true' : 'false')
  }

  try {
    const response = await fetchWithRetry(url.toString())

    if (!response.ok) {
      throw new ArbeitnowApiError(
        `Arbeitnow API error: ${response.status} ${response.statusText}`,
        response.status
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new ArbeitnowApiError('Invalid JSON response from Arbeitnow API', 500)
    }

    const validatedResponse = validateResponse(data)
    let jobs = validatedResponse.data

    // Client-side filtering for query (Arbeitnow doesn't have text search)
    if (params.query) {
      const queryLower = params.query.toLowerCase()
      jobs = jobs.filter(job => {
        const titleMatch = job.title.toLowerCase().includes(queryLower)
        const companyMatch = job.company_name.toLowerCase().includes(queryLower)
        const descMatch = job.description.toLowerCase().includes(queryLower)
        const tagMatch = job.tags.some(t => t.toLowerCase().includes(queryLower))
        const locationMatch = job.location.toLowerCase().includes(queryLower)
        return titleMatch || companyMatch || descMatch || tagMatch || locationMatch
      })
    }

    return jobs
  } catch (error) {
    if (error instanceof ArbeitnowApiError) {
      throw error
    }

    throw new ArbeitnowApiError(
      `Unexpected error from Arbeitnow API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    )
  }
}

/**
 * Fetch multiple pages of jobs
 */
export async function searchJobsMultiPage(
  params: Omit<ArbeitnowSearchParams, 'page'>,
  maxPages: number = 3
): Promise<ArbeitnowJob[]> {
  const allJobs: ArbeitnowJob[] = []
  const seenSlugs = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    try {
      const jobs = await searchJobs({ ...params, page })

      if (jobs.length === 0) break

      for (const job of jobs) {
        if (!seenSlugs.has(job.slug)) {
          seenSlugs.add(job.slug)
          allJobs.push(job)
        }
      }

      // Add a small delay between pages to be respectful
      if (page < maxPages) {
        await sleep(500)
      }
    } catch (error) {
      console.warn(`Arbeitnow page ${page} failed:`, error)
      break
    }
  }

  return allJobs
}

// =============================================================================
// MAPPING FUNCTION
// =============================================================================

import type { Job } from '@/lib/supabase/types'

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Maps an Arbeitnow job to the internal Job schema
 */
export function mapArbeitnowJobToJob(arbeitnowJob: ArbeitnowJob, userId: string): Partial<Job> {
  // Determine remote type
  let remoteType: 'fully_remote' | 'hybrid' | 'onsite' = arbeitnowJob.remote ? 'fully_remote' : 'onsite'

  // Check for hybrid in description or tags
  const descLower = arbeitnowJob.description.toLowerCase()
  const tagsLower = arbeitnowJob.tags.map(t => t.toLowerCase())

  if (tagsLower.includes('hybrid') || descLower.includes('hybrid')) {
    remoteType = 'hybrid'
  }

  // Map job types
  let jobType = 'FULLTIME'
  const jobTypesLower = arbeitnowJob.job_types.map(t => t.toLowerCase())

  if (jobTypesLower.includes('part time') || jobTypesLower.includes('part-time')) {
    jobType = 'PARTTIME'
  } else if (jobTypesLower.includes('contract') || jobTypesLower.includes('freelance')) {
    jobType = 'CONTRACTOR'
  } else if (jobTypesLower.includes('internship') || jobTypesLower.includes('intern')) {
    jobType = 'INTERN'
  }

  // Get industry from tags
  const industryTags = ['Technology', 'Finance', 'Healthcare', 'Marketing', 'Sales', 'Engineering', 'Design']
  const industry = arbeitnowJob.tags.find(t =>
    industryTags.some(ind => t.toLowerCase().includes(ind.toLowerCase()))
  ) || null

  // Strip HTML from description
  const description = stripHtml(arbeitnowJob.description)

  // Parse created_at timestamp
  let createdAt = new Date().toISOString()
  if (arbeitnowJob.created_at) {
    try {
      // Arbeitnow uses Unix timestamp
      const parsed = new Date(arbeitnowJob.created_at * 1000)
      if (!isNaN(parsed.getTime())) {
        createdAt = parsed.toISOString()
      }
    } catch {
      // Keep default
    }
  }

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: arbeitnowJob.slug,
    source: SOURCE_NAME,
    title: arbeitnowJob.title,
    company: arbeitnowJob.company_name,
    company_logo_url: null,
    location: arbeitnowJob.location || 'Europe',
    salary_min: null, // Arbeitnow doesn't provide salary
    salary_max: null,
    salary_currency: null,
    job_type: jobType,
    remote: arbeitnowJob.remote,
    remote_type: remoteType,
    industry_category: industry,
    description: description,
    application_url: arbeitnowJob.url,
    status: 'discovered',
    created_at: createdAt,
    job_posted_at: createdAt,
    match_score: null,
    platform_detected: null,
    auto_apply_status: 'manual'
  }
}
