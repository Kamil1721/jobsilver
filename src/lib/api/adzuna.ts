/**
 * Adzuna Job Search API Integration
 *
 * Supports 16 countries: UK, US, DE, FR, AU, NZ, CA, IN, PL, BR, AT, ZA, BE, CH, IT, ES
 * API Documentation: https://developer.adzuna.com/
 */

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface AdzunaJob {
  id: string
  title: string
  company: {
    display_name: string
  }
  location: {
    display_name: string
    area: string[]
  }
  description: string
  redirect_url: string
  created: string
  salary_min?: number
  salary_max?: number
  salary_is_predicted?: string
  contract_type?: string
  contract_time?: string
  category?: {
    label: string
    tag: string
  }
  // Internal field: populated during multi-country search to track origin
  _country?: AdzunaCountry
}

export interface AdzunaResponse {
  results: AdzunaJob[]
  count: number
  mean?: number
}

export interface AdzunaSearchParams {
  query: string
  country: string
  location?: string
  page?: number
  resultsPerPage?: number
  maxDaysOld?: number
  salaryMin?: number
  salaryMax?: number
  fullTime?: boolean
  partTime?: boolean
  contract?: boolean
  permanent?: boolean
  sortBy?: 'date' | 'salary' | 'relevance'
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class AdzunaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public requestId?: string
  ) {
    super(message)
    this.name = 'AdzunaApiError'
  }
}

export class AdzunaRateLimitError extends AdzunaApiError {
  constructor(
    public retryAfterSeconds: number,
    requestId?: string
  ) {
    super('Adzuna API rate limit exceeded', 429, requestId)
    this.name = 'AdzunaRateLimitError'
  }
}

export class AdzunaTimeoutError extends AdzunaApiError {
  constructor(timeoutMs: number) {
    super(`Adzuna API request timed out after ${timeoutMs}ms`, 0)
    this.name = 'AdzunaTimeoutError'
  }
}

export class AdzunaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdzunaValidationError'
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const ADZUNA_COUNTRIES = [
  'gb', 'us', 'de', 'fr', 'au', 'nz', 'ca', 'in', 'pl', 'br', 'at', 'za', 'be', 'ch', 'it', 'es'
] as const

export type AdzunaCountry = typeof ADZUNA_COUNTRIES[number]

// Country to ISO 4217 currency code mapping
export const ADZUNA_COUNTRY_CURRENCY: Record<AdzunaCountry, string> = {
  'gb': 'GBP',  // British Pound
  'us': 'USD',  // US Dollar
  'de': 'EUR',  // Euro
  'fr': 'EUR',  // Euro
  'au': 'AUD',  // Australian Dollar
  'nz': 'NZD',  // New Zealand Dollar
  'ca': 'CAD',  // Canadian Dollar
  'in': 'INR',  // Indian Rupee
  'pl': 'PLN',  // Polish Złoty
  'br': 'BRL',  // Brazilian Real
  'at': 'EUR',  // Euro (Austria)
  'za': 'ZAR',  // South African Rand
  'be': 'EUR',  // Euro (Belgium)
  'ch': 'CHF',  // Swiss Franc
  'it': 'EUR',  // Euro (Italy)
  'es': 'EUR',  // Euro (Spain)
}

/**
 * Get currency code for a country
 */
export function getCurrencyForCountry(country: AdzunaCountry): string {
  return ADZUNA_COUNTRY_CURRENCY[country] || 'USD'
}

const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs'
const ADZUNA_TIMEOUT_MS = 30000
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000
const MAX_QUERY_LENGTH = 500
const MAX_LOCATION_LENGTH = 100
const MAX_PAGE = 100
const MAX_RESULTS_PER_PAGE = 50

export const SOURCE_NAME = 'adzuna'
export const SOURCE_LABEL = 'Adzuna'

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateSearchParams(params: AdzunaSearchParams): void {
  // Validate query
  if (!params.query || typeof params.query !== 'string') {
    throw new AdzunaValidationError('Search query is required')
  }
  if (params.query.length > MAX_QUERY_LENGTH) {
    throw new AdzunaValidationError(`Search query must be ${MAX_QUERY_LENGTH} characters or less`)
  }

  // Validate country
  if (!params.country || !ADZUNA_COUNTRIES.includes(params.country.toLowerCase() as AdzunaCountry)) {
    throw new AdzunaValidationError(
      `Invalid country code: ${params.country}. Valid codes: ${ADZUNA_COUNTRIES.join(', ')}`
    )
  }

  // Validate location
  if (params.location && params.location.length > MAX_LOCATION_LENGTH) {
    throw new AdzunaValidationError(`Location must be ${MAX_LOCATION_LENGTH} characters or less`)
  }

  // Validate page
  if (params.page !== undefined) {
    if (!Number.isInteger(params.page) || params.page < 1 || params.page > MAX_PAGE) {
      throw new AdzunaValidationError(`Page must be an integer between 1 and ${MAX_PAGE}`)
    }
  }

  // Validate results per page
  if (params.resultsPerPage !== undefined) {
    if (!Number.isInteger(params.resultsPerPage) || params.resultsPerPage < 1 || params.resultsPerPage > MAX_RESULTS_PER_PAGE) {
      throw new AdzunaValidationError(`Results per page must be an integer between 1 and ${MAX_RESULTS_PER_PAGE}`)
    }
  }

  // Validate salary range
  if (params.salaryMin !== undefined) {
    if (params.salaryMin < 0) {
      throw new AdzunaValidationError('salaryMin cannot be negative')
    }
  }
  if (params.salaryMax !== undefined) {
    if (params.salaryMax < 0) {
      throw new AdzunaValidationError('salaryMax cannot be negative')
    }
  }
  if (params.salaryMin !== undefined && params.salaryMax !== undefined) {
    if (params.salaryMin > params.salaryMax) {
      throw new AdzunaValidationError('salaryMin cannot exceed salaryMax')
    }
  }

  // Validate max days old
  if (params.maxDaysOld !== undefined) {
    if (!Number.isInteger(params.maxDaysOld) || params.maxDaysOld < 1 || params.maxDaysOld > 30) {
      throw new AdzunaValidationError('maxDaysOld must be an integer between 1 and 30')
    }
  }
}

function validateAdzunaResponse(data: unknown): AdzunaResponse {
  if (!data || typeof data !== 'object') {
    throw new AdzunaApiError('Invalid response format from Adzuna API', 500)
  }

  const response = data as Record<string, unknown>

  if (!Array.isArray(response.results)) {
    throw new AdzunaApiError('Missing results array in Adzuna response', 500)
  }

  if (typeof response.count !== 'number') {
    throw new AdzunaApiError('Missing count in Adzuna response', 500)
  }

  // Validate and sanitize each job, limit to prevent memory issues
  const limitedResults = response.results.slice(0, 100).map(validateAndSanitizeJob)

  return {
    results: limitedResults,
    count: response.count,
    mean: typeof response.mean === 'number' ? response.mean : undefined
  }
}

function validateAndSanitizeJob(job: unknown): AdzunaJob {
  if (!job || typeof job !== 'object') {
    throw new AdzunaApiError('Invalid job object in response', 500)
  }

  const j = job as Record<string, unknown>

  // Extract company safely
  const company = j.company as Record<string, unknown> | undefined
  const companyName = company?.display_name

  // Extract location safely
  const location = j.location as Record<string, unknown> | undefined
  const locationName = location?.display_name
  const locationArea = Array.isArray(location?.area) ? location.area as string[] : []

  // Extract category safely
  const category = j.category as Record<string, unknown> | undefined

  return {
    id: String(j.id || ''),
    title: String(j.title || 'Untitled Position'),
    company: {
      display_name: String(companyName || 'Unknown Company')
    },
    location: {
      display_name: String(locationName || ''),
      area: locationArea
    },
    description: String(j.description || '').slice(0, 50000), // Limit description length
    redirect_url: String(j.redirect_url || ''),
    created: String(j.created || new Date().toISOString()),
    salary_min: typeof j.salary_min === 'number' && j.salary_min >= 0 ? j.salary_min : undefined,
    salary_max: typeof j.salary_max === 'number' && j.salary_max >= 0 ? j.salary_max : undefined,
    salary_is_predicted: typeof j.salary_is_predicted === 'string' ? j.salary_is_predicted : undefined,
    contract_type: typeof j.contract_type === 'string' ? j.contract_type : undefined,
    contract_time: typeof j.contract_time === 'string' ? j.contract_time : undefined,
    category: category ? {
      label: String(category.label || ''),
      tag: String(category.tag || '')
    } : undefined
  }
}

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
  const timeoutId = setTimeout(() => controller.abort(), ADZUNA_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10)
      if (attempt < MAX_RETRIES) {
        console.warn(`Adzuna rate limited, retrying after ${retryAfter}s (attempt ${attempt}/${MAX_RETRIES})`)
        await sleep(retryAfter * 1000)
        return fetchWithRetry(url, attempt + 1)
      }
      throw new AdzunaRateLimitError(retryAfter)
    }

    // Handle other errors with retry
    if (!response.ok && attempt < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Adzuna API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdzunaTimeoutError(ADZUNA_TIMEOUT_MS)
    }

    // Retry on network errors
    if (attempt < MAX_RETRIES && !(error instanceof AdzunaRateLimitError)) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`Adzuna network error, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(delay)
      return fetchWithRetry(url, attempt + 1)
    }

    throw error
  }
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Search for jobs using the Adzuna API
 */
export async function searchJobs(params: AdzunaSearchParams): Promise<AdzunaJob[]> {
  // Validate environment variables
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    throw new AdzunaApiError(
      'Adzuna API credentials not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.',
      500
    )
  }

  // Validate parameters
  validateSearchParams(params)

  // Build URL
  const country = params.country.toLowerCase()
  const page = params.page || 1
  const url = new URL(`${ADZUNA_BASE_URL}/${country}/search/${page}`)

  // Add authentication
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)

  // Add search parameters
  url.searchParams.set('what', params.query)
  url.searchParams.set('results_per_page', String(params.resultsPerPage || 20))

  if (params.location) {
    url.searchParams.set('where', params.location)
  }

  if (params.maxDaysOld) {
    url.searchParams.set('max_days_old', String(params.maxDaysOld))
  }

  if (params.salaryMin) {
    url.searchParams.set('salary_min', String(params.salaryMin))
  }

  if (params.salaryMax) {
    url.searchParams.set('salary_max', String(params.salaryMax))
  }

  // Job type filters
  if (params.fullTime) {
    url.searchParams.set('full_time', '1')
  }

  if (params.partTime) {
    url.searchParams.set('part_time', '1')
  }

  if (params.contract) {
    url.searchParams.set('contract', '1')
  }

  if (params.permanent) {
    url.searchParams.set('permanent', '1')
  }

  // Sort order
  if (params.sortBy) {
    url.searchParams.set('sort_by', params.sortBy)
  }

  try {
    const response = await fetchWithRetry(url.toString())

    if (!response.ok) {
      throw new AdzunaApiError(
        `Adzuna API error: ${response.status} ${response.statusText}`,
        response.status
      )
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new AdzunaApiError('Invalid JSON response from Adzuna API', 500)
    }

    const validatedResponse = validateAdzunaResponse(data)
    return validatedResponse.results
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof AdzunaApiError) {
      throw error
    }

    // Wrap unexpected errors
    throw new AdzunaApiError(
      `Unexpected error from Adzuna API: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    )
  }
}

/**
 * Get details for a specific job (Adzuna doesn't have a dedicated endpoint,
 * but we can search by ID if needed)
 */
export async function getJobDetails(jobId: string, country: string = 'gb'): Promise<AdzunaJob | null> {
  // Validate job ID
  if (!jobId || jobId.length > 50) {
    return null
  }

  // Validate country
  if (!ADZUNA_COUNTRIES.includes(country.toLowerCase() as AdzunaCountry)) {
    return null
  }

  try {
    // Adzuna doesn't have a direct job details endpoint
    // The redirect_url in search results is the job detail page
    // For now, return null - jobs should be fetched via search
    return null
  } catch {
    return null
  }
}

// =============================================================================
// DESCRIPTION FORMATTING
// =============================================================================

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
}

/**
 * Common section headers in job descriptions that indicate paragraph breaks
 */
const SECTION_HEADERS = [
  /^(about\s+(the\s+)?(company|us|role|position|job|team|opportunity))/i,
  /^(what\s+(you('ll|'ll|will)|we)\s+(do|offer|provide|need|expect|look|are looking))/i,
  /^(your\s+(role|responsibilities|qualifications|experience|skills|profile))/i,
  /^(key\s+(responsibilities|requirements|qualifications|skills|duties))/i,
  /^(responsibilities|requirements|qualifications|skills|benefits|perks)/i,
  /^(we('re|'re| are)\s+(looking|seeking|hiring))/i,
  /^(the\s+(role|position|job|opportunity))/i,
  /^(who\s+(you\s+are|we('re|'re| are)\s+looking))/i,
  /^(nice\s+to\s+have|must\s+have|bonus\s+points)/i,
  /^(how\s+to\s+apply|application\s+process)/i,
  /^(our\s+(mission|vision|values|culture|team|company))/i,
  /^(why\s+(join|work|us|this))/i,
]

/**
 * Check if a text line is likely a section header
 */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length > 80) return false // Headers are typically short
  return SECTION_HEADERS.some(pattern => pattern.test(trimmed))
}

/**
 * Split unstructured text into paragraphs based on sentence boundaries
 * Used when description has no newlines or structure
 */
function splitIntoSmartParagraphs(text: string): string {
  // If text already has some structure (newlines, HTML), don't process
  if (text.includes('\n') || text.includes('<p>') || text.includes('<br')) {
    return text
  }

  // Split on sentence endings followed by capital letter (new sentence)
  // But preserve acronyms like "U.S." or "e.g."
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/)

  if (sentences.length < 3) {
    return text // Not enough sentences to split
  }

  const paragraphs: string[] = []
  let currentParagraph: string[] = []
  let sentenceCount = 0

  for (const sentence of sentences) {
    // Check if this sentence starts a new section
    if (isSectionHeader(sentence)) {
      // Save current paragraph
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '))
      }
      // Start new paragraph with this header
      currentParagraph = [sentence]
      sentenceCount = 1
    } else {
      currentParagraph.push(sentence)
      sentenceCount++

      // Group 3-4 sentences per paragraph for readability
      if (sentenceCount >= 4) {
        paragraphs.push(currentParagraph.join(' '))
        currentParagraph = []
        sentenceCount = 0
      }
    }
  }

  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '))
  }

  return paragraphs.join('\n\n')
}

/**
 * Format a job description for better readability
 * - Decodes HTML entities
 * - Splits unstructured text into paragraphs
 * - Converts bullet point patterns to proper lists
 * - Preserves paragraph breaks
 * - Cleans up excessive whitespace
 */
function formatDescription(rawDescription: string): string {
  if (!rawDescription) return ''

  let text = decodeHtmlEntities(rawDescription)

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Handle unstructured descriptions (no newlines, all one paragraph)
  // This is common with Adzuna jobs
  text = splitIntoSmartParagraphs(text)

  // Insert paragraph breaks after section headers
  const lines = text.split('\n')
  const processedForHeaders: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (isSectionHeader(trimmed) && trimmed.length < 60) {
      // Add extra newline before headers (except first line)
      if (i > 0 && processedForHeaders.length > 0) {
        processedForHeaders.push('')
      }
      // Make headers bold
      processedForHeaders.push(`<strong>${trimmed}</strong>`)
    } else {
      processedForHeaders.push(line)
    }
  }
  text = processedForHeaders.join('\n')

  // Convert common bullet patterns to HTML list items
  // Patterns: •, -, *, ·, ●, ○, ▪, ▸, →, >
  const bulletPatterns = /^[\s]*[•\-\*·●○▪▸→>]\s*/gm
  const hasBullets = bulletPatterns.test(text)

  if (hasBullets) {
    // Split into lines and process
    const bulletLines = text.split('\n')
    let inList = false
    const processedLines: string[] = []

    for (const line of bulletLines) {
      const trimmedLine = line.trim()
      const isBullet = /^[•\-\*·●○▪▸→>]\s*/.test(trimmedLine)

      if (isBullet) {
        if (!inList) {
          processedLines.push('<ul>')
          inList = true
        }
        const content = trimmedLine.replace(/^[•\-\*·●○▪▸→>]\s*/, '')
        processedLines.push(`<li>${content}</li>`)
      } else {
        if (inList && trimmedLine === '') {
          processedLines.push('</ul>')
          inList = false
        } else if (inList && trimmedLine !== '') {
          // Non-bullet line while in list - close list first
          processedLines.push('</ul>')
          inList = false
          processedLines.push(trimmedLine)
        } else {
          processedLines.push(trimmedLine)
        }
      }
    }

    if (inList) {
      processedLines.push('</ul>')
    }

    text = processedLines.join('\n')
  }

  // Convert numbered lists (1. 2. 3. or 1) 2) 3))
  text = text.replace(/^(\d+)[.)]\s+(.+)$/gm, '<li>$2</li>')

  // Wrap consecutive <li> items in <ol> if they look like numbered lists
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    if (!match.includes('<ul>')) {
      return `<ol>${match}</ol>`
    }
    return match
  })

  // Convert double newlines to paragraph breaks
  text = text.replace(/\n\n+/g, '</p><p>')

  // Convert single newlines to <br> (but not inside lists)
  text = text.replace(/\n(?![<])/g, '<br>')

  // Wrap in paragraph tags if not already structured
  if (!text.startsWith('<')) {
    text = `<p>${text}</p>`
  }

  // Clean up empty paragraphs and excessive breaks
  text = text.replace(/<p>\s*<\/p>/g, '')
  text = text.replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>')
  text = text.replace(/<p>\s*<br\s*\/?>\s*/g, '<p>')
  text = text.replace(/\s*<br\s*\/?>\s*<\/p>/g, '</p>')

  return text.trim()
}

// =============================================================================
// MAPPING FUNCTION
// =============================================================================

import type { Job } from '@/lib/supabase/types'

/**
 * Maps an Adzuna job to the internal Job schema
 */
export function mapAdzunaJobToJob(adzunaJob: AdzunaJob, userId: string): Partial<Job> {
  // Determine remote status from description and location
  const descriptionLower = adzunaJob.description.toLowerCase()
  const titleLower = adzunaJob.title.toLowerCase()
  const isRemote =
    descriptionLower.includes('remote') ||
    descriptionLower.includes('work from home') ||
    descriptionLower.includes('wfh') ||
    titleLower.includes('remote')

  // Determine remote type
  let remoteType: 'fully_remote' | 'hybrid' | 'onsite' | null = null
  if (isRemote) {
    if (
      descriptionLower.includes('100% remote') ||
      descriptionLower.includes('fully remote') ||
      descriptionLower.includes('work from anywhere')
    ) {
      remoteType = 'fully_remote'
    } else if (
      descriptionLower.includes('hybrid') ||
      /\d+\s*days?\s*(in|at)\s*(the\s+)?office/i.test(adzunaJob.description)
    ) {
      remoteType = 'hybrid'
    } else {
      remoteType = 'fully_remote' // Default remote to fully_remote
    }
  } else {
    remoteType = 'onsite'
  }

  // Map contract_time to job_type
  let jobType = 'FULLTIME'
  if (adzunaJob.contract_time) {
    const contractTime = adzunaJob.contract_time.toLowerCase()
    if (contractTime === 'part_time') {
      jobType = 'PARTTIME'
    } else if (contractTime === 'full_time') {
      jobType = 'FULLTIME'
    }
  }
  if (adzunaJob.contract_type) {
    const contractType = adzunaJob.contract_type.toLowerCase()
    if (contractType === 'contract') {
      jobType = 'CONTRACTOR'
    }
  }

  // Build location string from area array
  const locationParts = adzunaJob.location.area || []
  const location = locationParts.length > 0
    ? locationParts.join(', ')
    : adzunaJob.location.display_name || ''

  // Parse created date
  let createdAt = new Date().toISOString()
  if (adzunaJob.created) {
    try {
      const parsed = new Date(adzunaJob.created)
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
    external_id: String(adzunaJob.id),
    source: SOURCE_NAME,
    title: adzunaJob.title,
    company: adzunaJob.company.display_name,
    company_logo_url: null, // Adzuna doesn't provide logos
    location: location,
    salary_min: adzunaJob.salary_min || null,
    salary_max: adzunaJob.salary_max || null,
    salary_currency: adzunaJob._country ? getCurrencyForCountry(adzunaJob._country) : 'USD',
    job_type: jobType,
    remote: isRemote,
    remote_type: remoteType,
    industry_category: adzunaJob.category?.label || null,
    description: formatDescription(adzunaJob.description),
    application_url: adzunaJob.redirect_url,
    status: 'discovered',
    created_at: createdAt,
    job_posted_at: createdAt,
    match_score: null,
    platform_detected: null,
    auto_apply_status: 'manual'
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR MULTI-COUNTRY SEARCH
// =============================================================================

/**
 * Search across multiple countries in parallel
 */
export async function searchJobsMultiCountry(
  params: Omit<AdzunaSearchParams, 'country'>,
  countries: AdzunaCountry[]
): Promise<AdzunaJob[]> {
  const validCountries = countries.filter(c => ADZUNA_COUNTRIES.includes(c))

  if (validCountries.length === 0) {
    return []
  }

  const results = await Promise.allSettled(
    validCountries.map(async (country) => {
      const jobs = await searchJobs({ ...params, country })
      // Attach the country to each job for currency mapping
      return jobs.map(job => ({ ...job, _country: country }))
    })
  )

  const allJobs: AdzunaJob[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value)
    } else {
      console.warn('Adzuna search failed for one country:', result.reason)
    }
  }

  return allJobs
}

/**
 * Get the country code from a country name
 */
export function getCountryCode(countryName: string): AdzunaCountry | null {
  const countryMap: Record<string, AdzunaCountry> = {
    'united kingdom': 'gb',
    'uk': 'gb',
    'great britain': 'gb',
    'england': 'gb',
    'united states': 'us',
    'usa': 'us',
    'america': 'us',
    'germany': 'de',
    'deutschland': 'de',
    'france': 'fr',
    'australia': 'au',
    'new zealand': 'nz',
    'canada': 'ca',
    'india': 'in',
    'poland': 'pl',
    'polska': 'pl',
    'brazil': 'br',
    'brasil': 'br',
    'austria': 'at',
    'south africa': 'za',
    'belgium': 'be',
    'switzerland': 'ch',
    'italy': 'it',
    'italia': 'it',
    'spain': 'es',
    'espana': 'es'
  }

  const normalized = countryName.toLowerCase().trim()

  // Check direct match
  if (ADZUNA_COUNTRIES.includes(normalized as AdzunaCountry)) {
    return normalized as AdzunaCountry
  }

  // Check country name map
  return countryMap[normalized] || null
}
