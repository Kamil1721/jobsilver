/**
 * The Muse Job Search API Integration
 *
 * API Documentation: https://www.themuse.com/developers/api/v2
 * Coverage: Primarily US jobs, all industries
 */

import { formatDescription } from '@/lib/utils/format-description'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface TheMuseJob {
  id: number
  name: string // Job title
  type: string
  publication_date: string
  short_name: string
  model_type: string
  locations: Array<{
    name: string
  }>
  categories: Array<{
    name: string
  }>
  levels: Array<{
    name: string
    short_name: string
  }>
  tags: string[]
  refs: {
    landing_page: string
  }
  company: {
    id: number
    name: string
    short_name: string
  }
  contents: string // HTML description
}

export interface TheMuseResponse {
  page: number
  page_count: number
  items_per_page: number
  took: number
  timed_out: boolean
  total: number
  results: TheMuseJob[]
}

export interface TheMuseSearchParams {
  query?: string
  page?: number
  category?: string
  level?: 'Entry Level' | 'Mid Level' | 'Senior Level' | 'Management' | 'Internship'
  location?: string
  company?: string
  descending?: boolean
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class TheMuseApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public requestId?: string
  ) {
    super(message)
    this.name = 'TheMuseApiError'
  }
}

export class TheMuseRateLimitError extends TheMuseApiError {
  constructor(
    public retryAfterSeconds: number,
    requestId?: string
  ) {
    super('The Muse API rate limit exceeded', 403, requestId)
    this.name = 'TheMuseRateLimitError'
  }
}

export class TheMuseTimeoutError extends TheMuseApiError {
  constructor(timeoutMs: number) {
    super(`The Muse API request timed out after ${timeoutMs}ms`, 0)
    this.name = 'TheMuseTimeoutError'
  }
}

export class TheMuseValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TheMuseValidationError'
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const THEMUSE_BASE_URL = 'https://www.themuse.com/api/public/jobs'
const THEMUSE_TIMEOUT_MS = 30000
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000
const MAX_PAGE = 100

export const THEMUSE_CATEGORIES = [
  'Account Management',
  'Business & Strategy',
  'Creative & Design',
  'Customer Service',
  'Data Science',
  'Editorial',
  'Education',
  'Engineering',
  'Finance',
  'Fundraising & Development',
  'Healthcare & Medicine',
  'HR & Recruiting',
  'Legal',
  'Marketing & PR',
  'Operations',
  'Project & Product Management',
  'Retail',
  'Sales',
  'Social Media & Community',
  'Software Engineering'
] as const

export const THEMUSE_LEVELS = [
  'Entry Level',
  'Mid Level',
  'Senior Level',
  'Management',
  'Internship'
] as const

export const SOURCE_NAME = 'themuse'
export const SOURCE_LABEL = 'The Muse'

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
  const timeoutId = setTimeout(() => controller.abort(), THEMUSE_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    // Handle rate limiting (The Muse returns 403 for rate limits)
    if (response.status === 403) {
      const resetHeader = response.headers.get('X-RateLimit-Reset')
      const retryAfter = resetHeader ? parseInt(resetHeader, 10) : 60
      if (attempt < MAX_RETRIES) {
        console.warn(`The Muse rate limited, retrying after ${retryAfter}s (attempt ${attempt}/${MAX_RETRIES})`)
        await sleep(Math.min(retryAfter * 1000, 60000)) // Cap at 60 seconds
        return fetchWithRetry(url, attempt + 1)
      }
      throw new TheMuseRateLimitError(retryAfter)
    }

    // Handle other errors with retry
    if (!response.ok && attempt < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`The Muse API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new TheMuseTimeoutError(THEMUSE_TIMEOUT_MS)
    }

    if (attempt < MAX_RETRIES && !(error instanceof TheMuseRateLimitError)) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`The Muse network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    throw error
  }
}

function validateResponse(data: unknown): TheMuseResponse {
  if (!data || typeof data !== 'object') {
    throw new TheMuseApiError('Invalid response format from The Muse API', 500)
  }

  const response = data as Record<string, unknown>

  if (!Array.isArray(response.results)) {
    throw new TheMuseApiError('Missing results array in The Muse response', 500)
  }

  return {
    page: typeof response.page === 'number' ? response.page : 0,
    page_count: typeof response.page_count === 'number' ? response.page_count : 0,
    items_per_page: typeof response.items_per_page === 'number' ? response.items_per_page : 20,
    took: typeof response.took === 'number' ? response.took : 0,
    timed_out: typeof response.timed_out === 'boolean' ? response.timed_out : false,
    total: typeof response.total === 'number' ? response.total : 0,
    results: response.results.slice(0, 100).map(validateJob)
  }
}

function validateJob(job: unknown): TheMuseJob {
  if (!job || typeof job !== 'object') {
    throw new TheMuseApiError('Invalid job object in response', 500)
  }

  const j = job as Record<string, unknown>
  const company = j.company as Record<string, unknown> | undefined
  const refs = j.refs as Record<string, unknown> | undefined

  return {
    id: typeof j.id === 'number' ? j.id : 0,
    name: String(j.name || 'Untitled Position'),
    type: String(j.type || ''),
    publication_date: String(j.publication_date || new Date().toISOString()),
    short_name: String(j.short_name || ''),
    model_type: String(j.model_type || ''),
    locations: Array.isArray(j.locations)
      ? j.locations.map((loc: unknown) => ({
          name: String((loc as Record<string, unknown>)?.name || '')
        }))
      : [],
    categories: Array.isArray(j.categories)
      ? j.categories.map((cat: unknown) => ({
          name: String((cat as Record<string, unknown>)?.name || '')
        }))
      : [],
    levels: Array.isArray(j.levels)
      ? j.levels.map((lvl: unknown) => ({
          name: String((lvl as Record<string, unknown>)?.name || ''),
          short_name: String((lvl as Record<string, unknown>)?.short_name || '')
        }))
      : [],
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    refs: {
      landing_page: String(refs?.landing_page || '')
    },
    company: {
      id: typeof company?.id === 'number' ? company.id : 0,
      name: String(company?.name || 'Unknown Company'),
      short_name: String(company?.short_name || '')
    },
    contents: String(j.contents || '').slice(0, 50000)
  }
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Sanitize a string for use in API requests
 */
function sanitizeString(input: string | undefined, maxLength: number = 200): string {
  if (!input) return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML
}

/**
 * Validate and sanitize search parameters
 */
function validateSearchParams(params: TheMuseSearchParams): TheMuseSearchParams {
  const validated: TheMuseSearchParams = {}

  // Validate query
  if (params.query !== undefined) {
    validated.query = sanitizeString(params.query, 500)
  }

  // Validate page (0-indexed, capped at MAX_PAGE)
  if (params.page !== undefined) {
    const page = Math.floor(Number(params.page))
    if (isNaN(page) || page < 0) {
      validated.page = 0
    } else if (page > MAX_PAGE) {
      validated.page = MAX_PAGE
    } else {
      validated.page = page
    }
  }

  // Validate category (must be from allowed list)
  if (params.category !== undefined) {
    const sanitized = sanitizeString(params.category)
    if (THEMUSE_CATEGORIES.includes(sanitized as typeof THEMUSE_CATEGORIES[number])) {
      validated.category = sanitized
    }
  }

  // Validate level (must be from allowed list)
  if (params.level !== undefined) {
    if (THEMUSE_LEVELS.includes(params.level as typeof THEMUSE_LEVELS[number])) {
      validated.level = params.level
    }
  }

  // Validate location
  if (params.location !== undefined) {
    validated.location = sanitizeString(params.location, 200)
  }

  // Validate company
  if (params.company !== undefined) {
    validated.company = sanitizeString(params.company, 200)
  }

  // Validate descending
  if (params.descending !== undefined) {
    validated.descending = Boolean(params.descending)
  }

  return validated
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Search for jobs using The Muse API
 */
export async function searchJobs(params: TheMuseSearchParams): Promise<TheMuseJob[]> {
  // Validate and sanitize input parameters
  const validatedParams = validateSearchParams(params)

  // Get API key (optional but increases rate limit)
  const apiKey = process.env.THEMUSE_API_KEY

  // Build URL
  const url = new URL(THEMUSE_BASE_URL)

  // Add API key if available
  if (apiKey) {
    url.searchParams.set('api_key', apiKey)
  }

  // Page is required
  url.searchParams.set('page', String(validatedParams.page || 0))

  // Add optional filters
  if (validatedParams.category) {
    url.searchParams.set('category', validatedParams.category)
  }

  if (validatedParams.level) {
    url.searchParams.set('level', validatedParams.level)
  }

  if (validatedParams.location) {
    url.searchParams.set('location', validatedParams.location)
  }

  if (validatedParams.company) {
    url.searchParams.set('company', validatedParams.company)
  }

  if (validatedParams.descending !== undefined) {
    url.searchParams.set('descending', String(validatedParams.descending))
  }

  try {
    const response = await fetchWithRetry(url.toString())

    if (!response.ok) {
      const errorBody = await response.text()
      throw new TheMuseApiError(
        `The Muse API error: ${response.status} - ${errorBody}`,
        response.status
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new TheMuseApiError('Invalid JSON response from The Muse API', 500)
    }

    const validatedResponse = validateResponse(data)

    // If query provided, filter results client-side (The Muse doesn't have text search)
    if (validatedParams.query) {
      const queryLower = validatedParams.query.toLowerCase()
      return validatedResponse.results.filter(job => {
        const titleMatch = job.name.toLowerCase().includes(queryLower)
        const descMatch = job.contents.toLowerCase().includes(queryLower)
        const categoryMatch = job.categories.some(c => c.name.toLowerCase().includes(queryLower))
        return titleMatch || descMatch || categoryMatch
      })
    }

    return validatedResponse.results
  } catch (error) {
    if (error instanceof TheMuseApiError) {
      throw error
    }

    throw new TheMuseApiError(
      `Unexpected error from The Muse API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    )
  }
}

/**
 * Get details for a specific job
 */
export async function getJobDetails(jobId: number): Promise<TheMuseJob | null> {
  if (!jobId || jobId <= 0) {
    return null
  }

  const apiKey = process.env.THEMUSE_API_KEY
  const url = new URL(`https://www.themuse.com/api/public/jobs/${jobId}`)

  if (apiKey) {
    url.searchParams.set('api_key', apiKey)
  }

  try {
    const response = await fetchWithRetry(url.toString())

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return validateJob(data)
  } catch {
    return null
  }
}

// =============================================================================
// MAPPING FUNCTION
// =============================================================================

import type { Job } from '@/lib/supabase/types'


/**
 * Maps a The Muse job to the internal Job schema
 */
export function mapTheMuseJobToJob(museJob: TheMuseJob, userId: string): Partial<Job> {
  // Extract location
  const locations = museJob.locations.map(l => l.name).filter(Boolean)
  const location = locations.join('; ') || 'United States'

  // Determine remote status
  const locationLower = location.toLowerCase()
  const isRemote =
    locationLower.includes('remote') ||
    locationLower.includes('flexible') ||
    locationLower.includes('anywhere')

  let remoteType: 'fully_remote' | 'hybrid' | 'onsite' | null = null
  if (isRemote) {
    if (locationLower.includes('hybrid') || locationLower.includes('flexible')) {
      remoteType = 'hybrid'
    } else {
      remoteType = 'fully_remote'
    }
  } else {
    remoteType = 'onsite'
  }

  // Map level to job type
  let jobType = 'FULLTIME'
  const levels = museJob.levels.map(l => l.name.toLowerCase())
  if (levels.includes('internship')) {
    jobType = 'INTERN'
  }

  // Get category for industry
  const category = museJob.categories[0]?.name || null

  // Format description with proper structure
  const description = formatDescription(museJob.contents)

  // Parse publication date
  let createdAt = new Date().toISOString()
  if (museJob.publication_date) {
    try {
      const parsed = new Date(museJob.publication_date)
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
    external_id: String(museJob.id),
    source: SOURCE_NAME,
    title: museJob.name,
    company: museJob.company.name,
    company_logo_url: null,
    location: location,
    salary_min: null, // The Muse doesn't provide salary info
    salary_max: null,
    salary_currency: null,
    job_type: jobType,
    remote: isRemote,
    remote_type: remoteType,
    industry_category: category,
    description: description,
    application_url: museJob.refs.landing_page,
    status: 'discovered',
    created_at: createdAt,
    job_posted_at: createdAt,
    match_score: null,
    platform_detected: null,
    auto_apply_status: 'manual'
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Search for jobs across multiple categories
 */
export async function searchJobsMultiCategory(
  params: Omit<TheMuseSearchParams, 'category'>,
  categories: string[]
): Promise<TheMuseJob[]> {
  const validCategories = categories.filter(c =>
    THEMUSE_CATEGORIES.includes(c as typeof THEMUSE_CATEGORIES[number])
  )

  if (validCategories.length === 0) {
    // Search without category filter
    return searchJobs(params)
  }

  const results = await Promise.allSettled(
    validCategories.map(category =>
      searchJobs({ ...params, category })
    )
  )

  const allJobs: TheMuseJob[] = []
  const seenIds = new Set<number>()

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const job of result.value) {
        if (!seenIds.has(job.id)) {
          seenIds.add(job.id)
          allJobs.push(job)
        }
      }
    } else {
      console.warn('The Muse search failed for one category:', result.reason)
    }
  }

  return allJobs
}
