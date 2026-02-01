/**
 * fantastic.jobs API Client (Active Jobs DB)
 *
 * Primary job data source providing access to 10M+ jobs from 130,000+ career sites.
 * Uses RapidAPI for authentication.
 *
 * API Documentation: https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/active-jobs-db
 */

import { formatDescription } from '@/lib/utils/format-description'
import { createClient as createServerClient } from '@/lib/supabase/server'

// =============================================================================
// API USAGE TRACKING
// =============================================================================

export interface ApiUsageInfo {
  rateLimitLimit: number | null
  rateLimitRemaining: number | null
  rateLimitReset: Date | null
  jobsReturned: number
  responseStatus: number
  responseTimeMs: number
}

/**
 * Log API request and update monthly usage stats
 */
async function logApiUsage(
  endpoint: string,
  params: Record<string, string>,
  usageInfo: ApiUsageInfo,
  userId?: string
): Promise<void> {
  try {
    const supabase = await createServerClient()
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Get current plan from environment or default to basic
    const rapidapiPlan = process.env.RAPIDAPI_PLAN || 'basic'

    // Plan limits
    const planLimits: Record<string, { jobs: number; requests: number }> = {
      basic: { jobs: 250, requests: 25 },
      pro: { jobs: 5000, requests: 2500 },
      ultra: { jobs: 20000, requests: 20000 },
      mega: { jobs: 50000, requests: 50000 },
    }

    const limits = planLimits[rapidapiPlan] || planLimits.basic

    // 1. Log individual request (for debugging)
    await supabase.from('api_request_log').insert({
      endpoint,
      params: params as unknown as Record<string, unknown>,
      jobs_returned: usageInfo.jobsReturned,
      response_status: usageInfo.responseStatus,
      rate_limit_limit: usageInfo.rateLimitLimit,
      rate_limit_remaining: usageInfo.rateLimitRemaining,
      rate_limit_reset: usageInfo.rateLimitReset?.toISOString() || null,
      response_time_ms: usageInfo.responseTimeMs,
      triggered_by_user_id: userId || null,
    })

    // 2. Update monthly usage stats (upsert)
    const { data: existing } = await supabase
      .from('api_usage')
      .select('id, jobs_fetched, requests_made')
      .eq('month_year', currentMonth)
      .single()

    if (existing) {
      // Update existing record
      await supabase
        .from('api_usage')
        .update({
          jobs_fetched: existing.jobs_fetched + usageInfo.jobsReturned,
          requests_made: existing.requests_made + 1,
          rate_limit_remaining: usageInfo.rateLimitRemaining,
          rate_limit_reset: usageInfo.rateLimitReset?.toISOString() || null,
          rapidapi_plan: rapidapiPlan,
          jobs_limit: limits.jobs,
          requests_limit: limits.requests,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Insert new record for the month
      await supabase.from('api_usage').insert({
        month_year: currentMonth,
        jobs_fetched: usageInfo.jobsReturned,
        requests_made: 1,
        jobs_limit: limits.jobs,
        requests_limit: limits.requests,
        rapidapi_plan: rapidapiPlan,
        rate_limit_remaining: usageInfo.rateLimitRemaining,
        rate_limit_reset: usageInfo.rateLimitReset?.toISOString() || null,
      })
    }

    console.log(`[API Usage] Month: ${currentMonth}, Jobs: +${usageInfo.jobsReturned}, Remaining: ${usageInfo.rateLimitRemaining}`)
  } catch (error) {
    // Don't fail the main request if logging fails
    console.error('Error logging API usage:', error)
  }
}

/**
 * Parse RapidAPI rate limit headers
 */
function parseRateLimitHeaders(response: Response): Partial<ApiUsageInfo> {
  return {
    rateLimitLimit: parseInt(response.headers.get('X-RateLimit-Limit') || response.headers.get('x-ratelimit-requests-limit') || '') || null,
    rateLimitRemaining: parseInt(response.headers.get('X-RateLimit-Remaining') || response.headers.get('x-ratelimit-requests-remaining') || '') || null,
    rateLimitReset: response.headers.get('X-RateLimit-Reset')
      ? new Date(parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000)
      : null,
  }
}

// =============================================================================
// TYPES
// =============================================================================

export type WorkArrangementFilter = 'On-site' | 'Hybrid' | 'Remote OK' | 'Remote Solely'
export type EmploymentTypeFilter = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' | 'TEMPORARY' | 'VOLUNTEER'
export type SeniorityFilter = 'Entry level' | 'Associate' | 'Mid-Senior level' | 'Director' | 'Executive'

export interface FantasticJobsSearchParams {
  limit?: number                                // Max 100 per request
  offset?: number                               // Pagination offset
  title_filter?: string                         // Job title search (supports OR, AND, quoted phrases)
  location_filter?: string                      // Location filter (use full country names)
  organization_filter?: string                  // Company name filter (exact match, case sensitive)
  description_filter?: string                   // Description search
  ai_work_arrangement_filter?: string           // Comma-separated: On-site,Hybrid,Remote OK,Remote Solely
  ai_employment_type_filter?: string            // Comma-separated: FULL_TIME,PART_TIME,CONTRACTOR,INTERN,etc.
  ai_experience_level_filter?: string           // Comma-separated: 0-2,2-5,5-10,10+
  ai_taxonomies_a_filter?: string               // Comma-separated industry categories: Healthcare,Sales,Technology etc.
  ai_has_salary?: boolean                       // Only jobs with salary info
  ai_visa_sponsorship_filter?: boolean          // Only jobs mentioning visa sponsorship
  include_ai?: boolean                          // Include AI-enriched fields
  include_li?: boolean                          // Include LinkedIn company fields
  remote?: boolean                              // true for remote only, false for non-remote
  description_type?: 'text' | 'html'            // Include description in output
  source?: string                               // Filter by ATS source (comma-separated)
}

// API response job structure
export interface FantasticJobsJob {
  // Core fields (from API)
  id: string
  title: string
  organization: string                          // Company name
  organization_url?: string | null
  organization_logo?: string | null
  url: string                                   // Application URL
  date_posted: string
  date_created?: string
  date_validthrough?: string | null

  // Location fields
  locations_raw?: unknown[]
  locations_derived?: Array<{ city?: string; admin?: string; country?: string }>
  cities_derived?: string[]
  regions_derived?: string[]
  countries_derived?: string[]
  remote_derived?: boolean
  location_type?: string                        // 'TELECOMMUTE' for remote

  // Description (when description_type is set)
  description_text?: string
  description_html?: string

  // Salary (raw Google Jobs format)
  salary_raw?: {
    currency?: string
    value?: { value?: number; minValue?: number; maxValue?: number }
    unitText?: string
  } | null

  // Employment type
  employment_type?: string[]

  // Source info
  source?: string
  source_type?: string
  source_domain?: string

  // AI-enriched fields (when include_ai=true)
  ai_salary_currency?: string | null
  ai_salary_value?: number | null
  ai_salary_minvalue?: number | null
  ai_salary_maxvalue?: number | null
  ai_salary_unittext?: string | null
  ai_benefits?: string[] | null
  ai_experience_level?: string | null           // 0-2, 2-5, 5-10, 10+
  ai_work_arrangement?: WorkArrangementFilter | null
  ai_work_arrangement_office_days?: number | null
  ai_remote_location?: string[] | null
  ai_key_skills?: string[] | null
  ai_employment_type?: string[] | null          // FULL_TIME, PART_TIME, etc.
  ai_visa_sponsorship?: boolean | null
  ai_job_language?: string | null
  ai_core_responsibilities?: string | null
  ai_requirements_summary?: string | null
  ai_taxonomies_a?: string[] | null

  // LinkedIn company fields (when include_li=true)
  linkedin_org_employees?: number | null
  linkedin_org_url?: string | null
  linkedin_org_industry?: string | null
  linkedin_org_slug?: string | null
}

// The API returns an array directly, not wrapped in an object
export type FantasticJobsResponse = FantasticJobsJob[]

// Remote type for validation (same as JSearch)
export type RemoteType = 'fully_remote' | 'hybrid' | 'onsite'

// =============================================================================
// API CLIENT
// =============================================================================

const RAPIDAPI_HOST = 'active-jobs-db.p.rapidapi.com'

/**
 * Search jobs using the fantastic.jobs API (Active Jobs DB)
 * Uses the /active-ats-7d endpoint for jobs from the last 7 days
 */
export async function searchJobs(
  params: FantasticJobsSearchParams,
  userId?: string
): Promise<FantasticJobsJob[]> {
  console.log('=== fantastic.jobs searchJobs called ===')

  const apiKey = process.env.RAPIDAPI_KEY

  if (!apiKey) {
    console.error('CRITICAL: RAPIDAPI_KEY environment variable is not set!')
    console.error('Please add RAPIDAPI_KEY to your Vercel environment variables.')
    throw new Error('RAPIDAPI_KEY is not configured - add it to Vercel environment variables')
  }

  console.log('RAPIDAPI_KEY is configured, proceeding with search...')

  // Build query parameters
  const queryParams = new URLSearchParams()

  // Always include description as HTML for proper formatting
  queryParams.set('description_type', params.description_type || 'html')

  // Always include AI fields and LinkedIn company data
  queryParams.set('include_ai', 'true')
  queryParams.set('include_li', 'true')

  if (params.limit) {
    queryParams.set('limit', String(Math.min(params.limit, 100)))
  }
  if (params.offset) {
    queryParams.set('offset', String(params.offset))
  }
  if (params.title_filter) {
    queryParams.set('title_filter', params.title_filter)
  }
  if (params.location_filter) {
    queryParams.set('location_filter', params.location_filter)
  }
  if (params.organization_filter) {
    queryParams.set('organization_filter', params.organization_filter)
  }
  if (params.description_filter) {
    queryParams.set('description_filter', params.description_filter)
  }
  if (params.ai_work_arrangement_filter) {
    queryParams.set('ai_work_arrangement_filter', params.ai_work_arrangement_filter)
  }
  if (params.ai_employment_type_filter) {
    queryParams.set('ai_employment_type_filter', params.ai_employment_type_filter)
  }
  if (params.ai_experience_level_filter) {
    queryParams.set('ai_experience_level_filter', params.ai_experience_level_filter)
  }
  if (params.ai_taxonomies_a_filter) {
    queryParams.set('ai_taxonomies_a_filter', params.ai_taxonomies_a_filter)
  }
  if (params.ai_has_salary !== undefined) {
    queryParams.set('ai_has_salary', String(params.ai_has_salary))
  }
  if (params.ai_visa_sponsorship_filter !== undefined) {
    queryParams.set('ai_visa_sponsorship_filter', String(params.ai_visa_sponsorship_filter))
  }
  if (params.remote !== undefined) {
    queryParams.set('remote', String(params.remote))
  }
  if (params.source) {
    queryParams.set('source', params.source)
  }
  if (params.include_li) {
    queryParams.set('include_li', 'true')
  }

  // Add timeout for API requests (30 seconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  const startTime = Date.now()

  try {
    // Use /active-ats-7d endpoint for 7-day jobs (available on Basic plan)
    const endpoint = '/active-ats-7d'
    const url = `https://${RAPIDAPI_HOST}${endpoint}?${queryParams.toString()}`
    console.log(`Calling fantastic.jobs API: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseTimeMs = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()

      // Still log failed requests for tracking
      const rateLimitInfo = parseRateLimitHeaders(response)
      await logApiUsage(
        endpoint,
        Object.fromEntries(queryParams.entries()),
        {
          ...rateLimitInfo,
          jobsReturned: 0,
          responseStatus: response.status,
          responseTimeMs,
          rateLimitLimit: rateLimitInfo.rateLimitLimit ?? null,
          rateLimitRemaining: rateLimitInfo.rateLimitRemaining ?? null,
          rateLimitReset: rateLimitInfo.rateLimitReset ?? null,
        },
        userId
      )

      throw new Error(`fantastic.jobs API error: ${response.status} - ${errorText}`)
    }

    // Parse rate limit headers
    const rateLimitInfo = parseRateLimitHeaders(response)

    // API returns array directly
    const data: FantasticJobsResponse = await response.json()
    const jobsReturned = data?.length || 0
    console.log(`fantastic.jobs API returned ${jobsReturned} jobs`)

    // Log API usage (async, don't wait)
    logApiUsage(
      endpoint,
      Object.fromEntries(queryParams.entries()),
      {
        ...rateLimitInfo,
        jobsReturned,
        responseStatus: response.status,
        responseTimeMs,
        rateLimitLimit: rateLimitInfo.rateLimitLimit ?? null,
        rateLimitRemaining: rateLimitInfo.rateLimitRemaining ?? null,
        rateLimitReset: rateLimitInfo.rateLimitReset ?? null,
      },
      userId
    ).catch(err => console.error('Error logging API usage:', err))

    return data || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('fantastic.jobs API request timed out')
    }
    throw error
  }
}

/**
 * Get expired jobs (jobs that are no longer available)
 * Use this for daily sync to mark jobs as inactive
 */
export async function getExpiredJobs(since?: string): Promise<string[]> {
  const apiKey = process.env.RAPIDAPI_KEY

  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY is not configured')
  }

  const queryParams = new URLSearchParams()
  if (since) {
    queryParams.set('since', since)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(
      `https://${RAPIDAPI_HOST}/expired?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`fantastic.jobs API error: ${response.status}`)
    }

    const data = await response.json()
    return data.expired_job_ids || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('fantastic.jobs API request timed out')
    }
    throw error
  }
}

// =============================================================================
// MAPPERS
// =============================================================================

/**
 * Map fantastic.jobs job to our Job type
 */
export function mapFantasticJobToJob(fjJob: FantasticJobsJob, userId: string) {
  // Determine remote type from AI-enriched field or remote_derived
  let remoteType: RemoteType = 'onsite'
  if (fjJob.ai_work_arrangement) {
    switch (fjJob.ai_work_arrangement) {
      case 'Remote Solely':
        remoteType = 'fully_remote'
        break
      case 'Remote OK':
      case 'Hybrid':
        remoteType = 'hybrid'
        break
      case 'On-site':
        remoteType = 'onsite'
        break
    }
  } else if (fjJob.remote_derived || fjJob.location_type === 'TELECOMMUTE') {
    remoteType = 'fully_remote'
  }

  // Determine if remote from various fields
  const isRemote = remoteType === 'fully_remote' || remoteType === 'hybrid'

  // Map employment type (API returns array)
  const employmentTypeArray = fjJob.ai_employment_type || fjJob.employment_type
  let jobType = Array.isArray(employmentTypeArray) ? employmentTypeArray[0] : (employmentTypeArray || 'FULL_TIME')
  const jobTypeMap: Record<string, string> = {
    'FULL_TIME': 'fulltime',
    'PART_TIME': 'part-time',
    'CONTRACTOR': 'contractor',
    'INTERN': 'internship',
    'TEMPORARY': 'contractor',
    'VOLUNTEER': 'internship',
  }
  jobType = jobTypeMap[jobType] || jobType

  // Build location string from derived fields
  let location = 'Remote'
  if (fjJob.locations_derived && fjJob.locations_derived.length > 0) {
    const loc = fjJob.locations_derived[0]
    const parts = [loc.city, loc.admin, loc.country].filter(Boolean)
    location = parts.join(', ') || 'Remote'
  } else if (fjJob.countries_derived && fjJob.countries_derived.length > 0) {
    location = fjJob.countries_derived[0]
  }

  // Extract salary from AI fields or salary_raw
  let salaryMin: number | null = null
  let salaryMax: number | null = null
  let salaryCurrency = 'USD'

  if (fjJob.ai_salary_minvalue || fjJob.ai_salary_maxvalue || fjJob.ai_salary_value) {
    salaryMin = fjJob.ai_salary_minvalue || fjJob.ai_salary_value || null
    salaryMax = fjJob.ai_salary_maxvalue || fjJob.ai_salary_value || null
    salaryCurrency = fjJob.ai_salary_currency || 'USD'
  } else if (fjJob.salary_raw?.value) {
    salaryMin = fjJob.salary_raw.value.minValue || fjJob.salary_raw.value.value || null
    salaryMax = fjJob.salary_raw.value.maxValue || fjJob.salary_raw.value.value || null
    salaryCurrency = fjJob.salary_raw.currency || 'USD'
  }

  // Get description (prefer HTML for proper formatting)
  const description = fjJob.description_html || fjJob.description_text || ''

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: fjJob.id,
    source: 'fantasticjobs',
    ats_source: 'fantasticjobs' as const,
    title: fjJob.title,
    company: fjJob.organization,
    company_logo_url: fjJob.organization_logo || null,
    location: location,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    job_type: jobType,
    remote: isRemote,
    remote_type: remoteType,
    description: formatDescription(description),
    application_url: fjJob.url,
    status: 'discovered' as const,
    job_posted_at: fjJob.date_posted || new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

// =============================================================================
// FILTER MAPPING
// =============================================================================

/**
 * Map user's job type filter to fantastic.jobs employment type filter
 * Returns comma-separated string for API (supports multiple values)
 */
export function mapJobTypeToEmploymentType(
  jobTypes: string[] | undefined
): string | undefined {
  if (!jobTypes || jobTypes.length === 0) return undefined

  const typeMap: Record<string, string> = {
    'fulltime': 'FULL_TIME',
    'part-time': 'PART_TIME',
    'contractor': 'CONTRACTOR',
    'internship': 'INTERN',
  }

  // Map all job types and join with comma (no spaces)
  const mapped = jobTypes
    .map(type => typeMap[type])
    .filter(Boolean)

  return mapped.length > 0 ? mapped.join(',') : undefined
}

/**
 * Map user's seniority levels to fantastic.jobs experience level filter
 * Returns comma-separated string for API
 */
export function mapSeniorityToExperienceLevel(
  seniorityLevels: string[] | undefined
): string | undefined {
  if (!seniorityLevels || seniorityLevels.length === 0) return undefined

  // Map our seniority to API's experience level (years)
  const levelMap: Record<string, string> = {
    'entry': '0-2',
    'associate': '0-2',
    'mid-senior': '2-5',
    'senior': '5-10',
    'director': '10+',
    'executive': '10+',
  }

  const mapped = seniorityLevels
    .map(level => levelMap[level])
    .filter(Boolean)

  // Deduplicate
  const unique = Array.from(new Set(mapped))
  return unique.length > 0 ? unique.join(',') : undefined
}

/**
 * Map user's remote preference to work arrangement filter
 * Returns comma-separated string for API
 */
export function mapRemoteToWorkArrangement(
  remoteJobs: boolean | undefined,
  onsiteHybrid: boolean | undefined
): string | undefined {
  if (remoteJobs && !onsiteHybrid) {
    return 'Remote Solely'
  }
  if (remoteJobs && onsiteHybrid) {
    // Include all remote-friendly options
    return 'Remote Solely,Remote OK,Hybrid'
  }
  if (onsiteHybrid && !remoteJobs) {
    return 'Hybrid,On-site'
  }
  return undefined // No filter - return all
}

/**
 * Map user's work arrangements array to fantastic.jobs API filter
 * Uses the new granular work_arrangements field from JobFilters
 */
export function mapWorkArrangementsToFilter(
  workArrangements: string[] | undefined
): string | undefined {
  if (!workArrangements || workArrangements.length === 0) {
    return undefined // No filter - return all
  }

  // Map our internal values to API values
  const apiValueMap: Record<string, string> = {
    'on_site': 'On-site',
    'hybrid': 'Hybrid',
    'remote_ok': 'Remote OK',
    'remote_only': 'Remote Solely',
  }

  const mapped = workArrangements
    .map(a => apiValueMap[a])
    .filter(Boolean)

  return mapped.length > 0 ? mapped.join(',') : undefined
}

/**
 * Map user's selected industries to fantastic.jobs API taxonomy filter
 * Returns comma-separated string for ai_taxonomies_a_filter
 */
export function mapIndustriesToTaxonomyFilter(
  industries: string[] | undefined
): string | undefined {
  if (!industries || industries.length === 0) {
    return undefined // No filter - return all industries
  }

  // Industries with & need to be double-quoted for the API
  const formatted = industries.map(industry => {
    if (industry.includes('&')) {
      return `"${industry}"`
    }
    return industry
  })

  return formatted.join(',')
}

// Keep the old function name for backward compatibility
export const mapSeniorityToFilter = mapSeniorityToExperienceLevel

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate remote type from job data
 */
export function validateRemoteType(job: FantasticJobsJob): RemoteType {
  // If we have AI-enriched work arrangement, use it
  if (job.ai_work_arrangement) {
    switch (job.ai_work_arrangement) {
      case 'Remote Solely':
        return 'fully_remote'
      case 'Hybrid':
      case 'Remote OK':
        return 'hybrid'
      case 'On-site':
        return 'onsite'
    }
  }

  // Check remote_derived flag
  if (job.remote_derived || job.location_type === 'TELECOMMUTE') {
    return 'fully_remote'
  }

  // Fallback: analyze description
  const description = (job.description_text || '').toLowerCase()
  const title = (job.title || '').toLowerCase()
  const locationStr = job.countries_derived?.[0]?.toLowerCase() || ''

  // Hybrid indicators
  const hybridPatterns = [
    /hybrid/i,
    /\d+\s*days?\s*(in|at|per|a)\s*(the\s+)?office/i,
    /flexible\s*(work|location|remote)/i,
    /remote\s*(optional|available|possible|friendly)/i,
    /partially\s*remote/i,
  ]

  // Fully remote indicators
  const fullyRemotePatterns = [
    /100%\s*remote/i,
    /fully\s*remote/i,
    /completely\s*remote/i,
    /remote\s*first/i,
    /work\s*from\s*anywhere/i,
    /remote\s*solely/i,
  ]

  const text = `${title} ${description} ${locationStr}`

  const isFullyRemote = fullyRemotePatterns.some(p => p.test(text))
  const isHybrid = hybridPatterns.some(p => p.test(text))

  if (isFullyRemote && !isHybrid) {
    return 'fully_remote'
  }

  if (isHybrid || locationStr.includes('remote')) {
    return 'hybrid'
  }

  return 'onsite'
}

/**
 * Check if job matches user's countries (for location filtering)
 */
export function validateJobLocation(job: FantasticJobsJob, userCountries: string[]): boolean {
  if (!userCountries || userCountries.length === 0) {
    return true // No filter = accept all
  }

  // Use countries_derived from the API
  const jobCountries = job.countries_derived || []

  // Country aliases for normalization
  const countryAliases: Record<string, string[]> = {
    'united states': ['us', 'usa', 'united states of america', 'america'],
    'united kingdom': ['uk', 'gb', 'great britain', 'england', 'britain'],
    'germany': ['de', 'deutschland'],
    'poland': ['pl', 'polska'],
    'france': ['fr'],
    'spain': ['es'],
    'italy': ['it'],
    'netherlands': ['nl', 'holland'],
    'canada': ['ca'],
    'australia': ['au', 'aus'],
  }

  const normalizedUserCountries = userCountries.map(c => c.toLowerCase().trim())

  // Check each job country against user countries
  for (const jobCountry of jobCountries) {
    const normalizedJobCountry = jobCountry.toLowerCase()

    for (const userCountry of normalizedUserCountries) {
      // Direct match
      if (normalizedJobCountry.includes(userCountry) || userCountry.includes(normalizedJobCountry)) {
        return true
      }

      // Check aliases
      const aliases = countryAliases[userCountry] || []
      if (aliases.some(alias => normalizedJobCountry.includes(alias))) {
        return true
      }

      // Reverse alias check
      for (const [canonical, aliasList] of Object.entries(countryAliases)) {
        if (aliasList.includes(userCountry) && normalizedJobCountry.includes(canonical)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if job is worldwide remote (no location restrictions)
 */
export function isWorldwideRemote(job: FantasticJobsJob): boolean {
  const description = (job.description_text || '').toLowerCase()
  const countries = job.countries_derived || []

  const worldwidePatterns = [
    /work\s*from\s*anywhere/i,
    /location\s*independent/i,
    /global\s*remote/i,
    /worldwide\s*remote/i,
    /remote\s*worldwide/i,
    /anywhere\s*in\s*the\s*world/i,
    /fully\s*distributed/i,
  ]

  const restrictedPatterns = [
    /remote\s*(only\s*)?(in|within)\s*(the\s+)?(us|usa|uk|eu)/i,
    /must\s*be\s*(located|based)\s*(in|within)/i,
  ]

  // Check if AI remote location is empty (meaning worldwide)
  const hasNoLocationRestriction = !job.ai_remote_location || job.ai_remote_location.length === 0

  const hasWorldwide = worldwidePatterns.some(p => p.test(description))
  const hasRestriction = restrictedPatterns.some(p => p.test(description))

  return (hasWorldwide || hasNoLocationRestriction) && !hasRestriction
}

/**
 * Basic spam detection
 */
export function isSpamJob(job: FantasticJobsJob): boolean {
  const title = (job.title || '').toLowerCase()
  const description = (job.description_text || '').toLowerCase().slice(0, 5000)
  const company = (job.organization || '').toLowerCase()

  const spamPatterns = [
    /make\s{0,5}\$?\d+k?\+?\s{0,5}(?:per|a|\/)\s{0,5}(?:day|week|hour)/i,
    /earn\s{0,5}\$?\d{4,}\s{0,5}(?:per|a|\/)\s{0,5}(?:day|week)/i,
    /easy\s{0,5}money/i,
    /get\s{0,5}paid\s{0,5}daily/i,
    /\$\d{3,}\/day/i,
  ]

  const hasSpamPattern = spamPatterns.some(p => p.test(title) || p.test(description))
  const hasNoCompany = !company || company === 'confidential'
  const hasVeryShortDescription = description.length < 100

  let spamScore = 0
  if (hasSpamPattern) spamScore += 3
  if (hasNoCompany && hasVeryShortDescription) spamScore += 2

  return spamScore >= 3
}

/**
 * Check if job is fresh (not too old)
 */
export function isJobFresh(job: FantasticJobsJob, maxAgeDays: number = 14): boolean {
  if (!job.date_posted) {
    return true // Keep if no date available
  }

  const postedDate = new Date(job.date_posted)
  const daysSincePosted = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24)

  return daysSincePosted <= maxAgeDays
}

// =============================================================================
// INDUSTRY MAPPING
// =============================================================================

/**
 * Map user-friendly industry names to keywords found in ai_taxonomies_a and linkedin_org_industry
 */
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Technology': ['technology', 'software', 'information technology', 'computer', 'it services', 'tech'],
  'Finance & Banking': ['financial', 'banking', 'investment', 'insurance', 'fintech', 'finance'],
  'Healthcare': ['healthcare', 'medical', 'hospital', 'pharmaceutical', 'biotech', 'health'],
  'E-commerce': ['e-commerce', 'ecommerce', 'retail', 'marketplace', 'online retail'],
  'SaaS': ['saas', 'software as a service', 'cloud software', 'b2b software'],
  'Consulting': ['consulting', 'professional services', 'advisory', 'management consulting'],
  'Manufacturing': ['manufacturing', 'industrial', 'production', 'factory'],
  'Education': ['education', 'edtech', 'learning', 'training', 'academic'],
  'Media & Entertainment': ['media', 'entertainment', 'gaming', 'publishing', 'broadcast'],
  'Real Estate': ['real estate', 'property', 'construction', 'housing'],
  'Transportation': ['transportation', 'logistics', 'shipping', 'automotive', 'mobility'],
  'Energy': ['energy', 'oil', 'gas', 'renewable', 'utilities', 'cleantech'],
  'Non-profit': ['non-profit', 'nonprofit', 'ngo', 'charity', 'foundation'],
  'Government': ['government', 'public sector', 'federal', 'municipal', 'civic'],
}

/**
 * Check if a job matches any of the selected industries
 */
export function matchesIndustry(job: FantasticJobsJob, industries: string[]): boolean {
  if (!industries || industries.length === 0) return true

  const taxonomies = (job.ai_taxonomies_a || []).map(t => t.toLowerCase())
  const linkedinIndustry = (job.linkedin_org_industry || '').toLowerCase()

  for (const industry of industries) {
    const keywords = INDUSTRY_KEYWORDS[industry] || []
    for (const keyword of keywords) {
      if (taxonomies.some(t => t.includes(keyword)) || linkedinIndustry.includes(keyword)) {
        return true
      }
    }
  }
  return false
}

// =============================================================================
// COMPANY SIZE MAPPING
// =============================================================================

export const COMPANY_SIZE_RANGES = {
  startup: { min: 1, max: 50 },
  small: { min: 51, max: 200 },
  medium: { min: 201, max: 1000 },
  large: { min: 1001, max: 5000 },
  enterprise: { min: 5001, max: Infinity },
}

/**
 * Get company size category from employee count
 */
export function getCompanySizeCategory(employees: number | null): string | null {
  if (!employees) return null
  for (const [category, range] of Object.entries(COMPANY_SIZE_RANGES)) {
    if (employees >= range.min && employees <= range.max) return category
  }
  return null
}

// =============================================================================
// EXPORTS
// =============================================================================

export const SOURCE_NAME = 'fantasticjobs'
