/**
 * Remotive Job Search API Integration
 *
 * API Documentation: https://remotive.com/api-documentation
 * Coverage: Global remote jobs, primarily tech
 * Authentication: No API key required (public API)
 */

import { formatDescription } from '@/lib/utils/format-description'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo: string | null
  company_logo_url: string | null
  category: string
  tags: string[]
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

export interface RemotiveResponse {
  'job-count': number
  jobs: RemotiveJob[]
}

export interface RemotiveSearchParams {
  query?: string
  category?: string
  companyName?: string
  limit?: number
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class RemotiveApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'RemotiveApiError'
  }
}

export class RemotiveTimeoutError extends RemotiveApiError {
  constructor(timeoutMs: number) {
    super(`Remotive API request timed out after ${timeoutMs}ms`, 0)
    this.name = 'RemotiveTimeoutError'
  }
}

export class RemotiveRateLimitError extends RemotiveApiError {
  constructor(
    public retryAfterSeconds: number
  ) {
    super('Remotive API rate limit exceeded', 429)
    this.name = 'RemotiveRateLimitError'
  }
}

export class RemotiveValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RemotiveValidationError'
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REMOTIVE_BASE_URL = 'https://remotive.com/api/remote-jobs'
const REMOTIVE_TIMEOUT_MS = 30000
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000

export const REMOTIVE_CATEGORIES = [
  'software-dev',
  'customer-service',
  'design',
  'marketing',
  'sales',
  'product',
  'business',
  'data',
  'devops',
  'finance',
  'hr',
  'qa',
  'writing',
  'all-others'
] as const

export type RemotiveCategory = typeof REMOTIVE_CATEGORIES[number]

export const SOURCE_NAME = 'remotive'
export const SOURCE_LABEL = 'Remotive'

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
  const timeoutId = setTimeout(() => controller.abort(), REMOTIVE_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    // Handle rate limiting (HTTP 429)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      if (attempt < MAX_RETRIES) {
        const waitTime = Math.min(retryAfter * 1000, 60000) // Cap at 60 seconds
        console.warn(`Remotive rate limited, retrying after ${waitTime/1000}s (attempt ${attempt}/${MAX_RETRIES})`)
        await sleep(waitTime)
        return fetchWithRetry(url, attempt + 1)
      }
      throw new RemotiveRateLimitError(retryAfter)
    }

    // Handle other errors with retry
    if (!response.ok && attempt < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Remotive API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new RemotiveTimeoutError(REMOTIVE_TIMEOUT_MS)
    }

    if (attempt < MAX_RETRIES && !(error instanceof RemotiveRateLimitError)) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Remotive network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    throw error
  }
}

function validateResponse(data: unknown): RemotiveResponse {
  if (!data || typeof data !== 'object') {
    throw new RemotiveApiError('Invalid response format from Remotive API', 500)
  }

  const response = data as Record<string, unknown>

  if (!Array.isArray(response.jobs)) {
    throw new RemotiveApiError('Missing jobs array in Remotive response', 500)
  }

  return {
    'job-count': typeof response['job-count'] === 'number' ? response['job-count'] : response.jobs.length,
    jobs: response.jobs.slice(0, 200).map(validateJob) // Limit to 200
  }
}

function validateJob(job: unknown): RemotiveJob {
  if (!job || typeof job !== 'object') {
    throw new RemotiveApiError('Invalid job object in response', 500)
  }

  const j = job as Record<string, unknown>

  return {
    id: typeof j.id === 'number' ? j.id : 0,
    url: String(j.url || ''),
    title: String(j.title || 'Untitled Position'),
    company_name: String(j.company_name || 'Unknown Company'),
    company_logo: typeof j.company_logo === 'string' ? j.company_logo : null,
    company_logo_url: typeof j.company_logo_url === 'string' ? j.company_logo_url : null,
    category: String(j.category || ''),
    tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
    job_type: String(j.job_type || 'full_time'),
    publication_date: String(j.publication_date || new Date().toISOString()),
    candidate_required_location: String(j.candidate_required_location || 'Worldwide'),
    salary: String(j.salary || ''),
    description: String(j.description || '').slice(0, 50000)
  }
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Search for jobs using the Remotive API
 * Note: Remotive's API is simple - it returns all jobs matching optional filters
 */
export async function searchJobs(params: RemotiveSearchParams = {}): Promise<RemotiveJob[]> {
  // Build URL
  const url = new URL(REMOTIVE_BASE_URL)

  // Add optional filters
  if (params.category && REMOTIVE_CATEGORIES.includes(params.category as RemotiveCategory)) {
    url.searchParams.set('category', params.category)
  }

  if (params.companyName) {
    url.searchParams.set('company_name', params.companyName)
  }

  if (params.limit && params.limit > 0) {
    url.searchParams.set('limit', String(Math.min(params.limit, 200)))
  }

  // If search query provided, we'll filter client-side
  if (params.query) {
    url.searchParams.set('search', params.query)
  }

  try {
    const response = await fetchWithRetry(url.toString())

    if (!response.ok) {
      throw new RemotiveApiError(
        `Remotive API error: ${response.status} ${response.statusText}`,
        response.status
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new RemotiveApiError('Invalid JSON response from Remotive API', 500)
    }

    const validatedResponse = validateResponse(data)
    let jobs = validatedResponse.jobs

    // Additional client-side filtering for query
    if (params.query) {
      const queryLower = params.query.toLowerCase()
      jobs = jobs.filter(job => {
        const titleMatch = job.title.toLowerCase().includes(queryLower)
        const companyMatch = job.company_name.toLowerCase().includes(queryLower)
        const descMatch = job.description.toLowerCase().includes(queryLower)
        const tagMatch = job.tags.some(t => t.toLowerCase().includes(queryLower))
        return titleMatch || companyMatch || descMatch || tagMatch
      })
    }

    return jobs
  } catch (error) {
    if (error instanceof RemotiveApiError) {
      throw error
    }

    throw new RemotiveApiError(
      `Unexpected error from Remotive API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    )
  }
}

/**
 * Get all available categories
 */
export async function getCategories(): Promise<string[]> {
  // Remotive doesn't have a categories endpoint, return hardcoded list
  return [...REMOTIVE_CATEGORIES]
}

// =============================================================================
// MAPPING FUNCTION
// =============================================================================

import type { Job } from '@/lib/supabase/types'

/**
 * Parse salary string to extract min/max values
 */
function parseSalary(salaryStr: string): { min: number | null; max: number | null } {
  if (!salaryStr) return { min: null, max: null }

  // Try to extract numbers from salary string
  // Common formats: "$60k - $80k", "60000-80000", "$60,000 - $80,000"
  const numbers = salaryStr.match(/[\d,]+(?:\.\d+)?/g)

  if (!numbers || numbers.length === 0) {
    return { min: null, max: null }
  }

  const parsed = numbers.map(n => {
    let num = parseFloat(n.replace(/,/g, ''))
    // Convert "k" notation (60 -> 60000)
    if (salaryStr.toLowerCase().includes('k') && num < 1000) {
      num *= 1000
    }
    return num
  })

  if (parsed.length === 1) {
    return { min: parsed[0], max: parsed[0] }
  }

  return {
    min: Math.min(...parsed),
    max: Math.max(...parsed)
  }
}

/**
 * Maps a Remotive job to the internal Job schema
 */
export function mapRemotiveJobToJob(remotiveJob: RemotiveJob, userId: string): Partial<Job> {
  // All Remotive jobs are remote by definition
  const isRemote = true

  // Determine remote type from location requirement
  const locationLower = remotiveJob.candidate_required_location.toLowerCase()
  let remoteType: 'fully_remote' | 'hybrid' | 'onsite' = 'fully_remote'

  if (locationLower.includes('hybrid')) {
    remoteType = 'hybrid'
  }

  // Map job_type
  let jobType = 'FULLTIME'
  const jobTypeLower = remotiveJob.job_type.toLowerCase()
  if (jobTypeLower.includes('part') || jobTypeLower === 'part_time') {
    jobType = 'PARTTIME'
  } else if (jobTypeLower.includes('contract') || jobTypeLower === 'contract') {
    jobType = 'CONTRACTOR'
  } else if (jobTypeLower.includes('intern')) {
    jobType = 'INTERN'
  }

  // Parse salary
  const { min: salaryMin, max: salaryMax } = parseSalary(remotiveJob.salary)

  // Format description with proper structure
  const description = formatDescription(remotiveJob.description)

  // Parse publication date
  let createdAt = new Date().toISOString()
  if (remotiveJob.publication_date) {
    try {
      const parsed = new Date(remotiveJob.publication_date)
      if (!isNaN(parsed.getTime())) {
        createdAt = parsed.toISOString()
      }
    } catch {
      // Keep default
    }
  }

  // Get company logo
  const logoUrl = remotiveJob.company_logo_url || remotiveJob.company_logo || null

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: String(remotiveJob.id),
    source: SOURCE_NAME,
    title: remotiveJob.title,
    company: remotiveJob.company_name,
    company_logo_url: logoUrl,
    location: remotiveJob.candidate_required_location || 'Remote - Worldwide',
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: 'USD', // Remotive jobs typically list salaries in USD
    job_type: jobType,
    remote: isRemote,
    remote_type: remoteType,
    industry_category: remotiveJob.category || null,
    description: description,
    application_url: remotiveJob.url,
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
  params: Omit<RemotiveSearchParams, 'category'>,
  categories: RemotiveCategory[]
): Promise<RemotiveJob[]> {
  if (categories.length === 0) {
    // Search without category filter
    return searchJobs(params)
  }

  const results = await Promise.allSettled(
    categories.map(category =>
      searchJobs({ ...params, category })
    )
  )

  const allJobs: RemotiveJob[] = []
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
      console.warn('Remotive search failed for one category:', result.reason)
    }
  }

  return allJobs
}

/**
 * Parse candidate_required_location to extract location restrictions
 * Returns an object with flags for worldwide, region-specific, and country-specific requirements
 */
export function parseLocationRequirement(locationStr: string): {
  isWorldwide: boolean
  isEuropeOnly: boolean
  isUSOnly: boolean
  allowedCountries: string[]
  restrictedRegion: string | null
} {
  const lower = locationStr.toLowerCase()

  // Worldwide indicators
  const isWorldwide = /worldwide|anywhere|global|remote|no restriction/i.test(lower)

  // Europe-only indicators
  const isEuropeOnly = /europe(\s+only)?|eu(\s+only)?|european/i.test(lower) && !isWorldwide

  // US-only indicators
  const isUSOnly = /(usa?|united states|north america)(\s+only)?/i.test(lower) &&
                   !isWorldwide &&
                   !lower.includes('except')

  // Extract specific countries mentioned
  const countryPatterns: Record<string, RegExp> = {
    'poland': /poland|polish|polska/i,
    'germany': /germany|german|deutschland/i,
    'uk': /\buk\b|united kingdom|britain|england/i,
    'usa': /\busa?\b|united states|america/i,
    'canada': /canada|canadian/i,
    'france': /france|french/i,
    'netherlands': /netherlands|dutch|holland/i,
    'spain': /spain|spanish/i,
    'italy': /italy|italian/i,
    'australia': /australia|australian/i,
  }

  const allowedCountries: string[] = []
  for (const [country, pattern] of Object.entries(countryPatterns)) {
    if (pattern.test(locationStr)) {
      allowedCountries.push(country)
    }
  }

  // Determine restricted region
  let restrictedRegion: string | null = null
  if (isEuropeOnly) restrictedRegion = 'europe'
  else if (isUSOnly) restrictedRegion = 'usa'

  return {
    isWorldwide,
    isEuropeOnly,
    isUSOnly,
    allowedCountries,
    restrictedRegion
  }
}

/**
 * Check if a Remotive job is available in a specific country
 */
export function isJobAvailableInCountry(job: RemotiveJob, country: string): boolean {
  const locationReq = parseLocationRequirement(job.candidate_required_location)
  const countryLower = country.toLowerCase()

  // Worldwide jobs are available everywhere
  if (locationReq.isWorldwide) return true

  // Check if specific country is allowed
  if (locationReq.allowedCountries.some(c =>
    c.toLowerCase() === countryLower ||
    countryLower.includes(c.toLowerCase())
  )) {
    return true
  }

  // Check regional compatibility
  const europeanCountries = ['poland', 'germany', 'france', 'uk', 'netherlands', 'spain', 'italy',
    'belgium', 'austria', 'switzerland', 'portugal', 'ireland', 'sweden', 'denmark', 'norway',
    'finland', 'czech', 'hungary', 'romania']

  if (locationReq.isEuropeOnly && europeanCountries.some(ec => countryLower.includes(ec))) {
    return true
  }

  const northAmericanCountries = ['usa', 'us', 'united states', 'canada']
  if (locationReq.isUSOnly && northAmericanCountries.some(na => countryLower.includes(na))) {
    return true
  }

  return false
}

/**
 * Map Remotive category to user-friendly name
 */
export function getCategoryLabel(category: RemotiveCategory): string {
  const labels: Record<RemotiveCategory, string> = {
    'software-dev': 'Software Development',
    'customer-service': 'Customer Service',
    'design': 'Design',
    'marketing': 'Marketing',
    'sales': 'Sales',
    'product': 'Product',
    'business': 'Business',
    'data': 'Data',
    'devops': 'DevOps / Sysadmin',
    'finance': 'Finance / Legal',
    'hr': 'Human Resources',
    'qa': 'QA',
    'writing': 'Writing',
    'all-others': 'All Others'
  }
  return labels[category] || category
}
