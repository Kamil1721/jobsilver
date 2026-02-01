/**
 * Unified Job Source Registry
 *
 * Orchestrates multiple job APIs, handles rate limiting, and deduplicates results.
 */

import type { Job } from '@/lib/supabase/types'

// Import all job sources
import {
  searchJobs as searchFantasticJobs,
  mapFantasticJobToJob,
  FantasticJobsJob,
  FantasticJobsSearchParams,
  SOURCE_NAME as FANTASTICJOBS_SOURCE,
} from '@/lib/api/fantasticjobs'

import {
  searchJobs as searchAdzunaJobs,
  mapAdzunaJobToJob,
  AdzunaJob,
  AdzunaSearchParams,
  ADZUNA_COUNTRIES,
  getCountryCode,
  SOURCE_NAME as ADZUNA_SOURCE
} from '@/lib/api/adzuna'

import {
  searchJobs as searchTheMuseJobs,
  mapTheMuseJobToJob,
  TheMuseJob,
  TheMuseSearchParams,
  SOURCE_NAME as THEMUSE_SOURCE
} from '@/lib/api/themuse'

import {
  searchJobs as searchRemotiveJobs,
  mapRemotiveJobToJob,
  RemotiveJob,
  RemotiveSearchParams,
  SOURCE_NAME as REMOTIVE_SOURCE
} from '@/lib/api/remotive'

import {
  searchJobs as searchArbeitnowJobs,
  mapArbeitnowJobToJob,
  ArbeitnowJob,
  ArbeitnowSearchParams,
  SOURCE_NAME as ARBEITNOW_SOURCE
} from '@/lib/api/arbeitnow'

// Import ATS direct sources
import {
  searchGreenhouseJobs,
  SOURCE_NAME as GREENHOUSE_SOURCE,
} from '@/lib/api/greenhouse'

import {
  searchLeverJobs,
  SOURCE_NAME as LEVER_SOURCE,
} from '@/lib/api/lever'

import {
  searchAshbyJobs,
  SOURCE_NAME as ASHBY_SOURCE,
} from '@/lib/api/ashby'

import {
  getGreenhouseBoards,
  getLeverCompanies,
  getAshbyBoards,
} from '@/lib/api/ats-companies'

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedSearchParams {
  query: string
  location?: string
  countries?: string[]
  remote?: boolean
  hybrid?: boolean
  jobTypes?: string[]
  industries?: string[]
  page?: number
  limit?: number
}

export interface JobSourceConfig {
  id: string
  name: string
  enabled: boolean
  regions: string[]
  supportsRemote: boolean
  priority: number // Lower = higher priority for deduplication
}

export interface SearchResult {
  jobs: Partial<Job>[]
  sources: {
    [key: string]: {
      count: number
      success: boolean
      error?: string
    }
  }
  total: number
  deduplicated: number
}

// =============================================================================
// SOURCE CONFIGURATIONS
// =============================================================================

export const JOB_SOURCES: JobSourceConfig[] = [
  // Direct ATS APIs - highest priority (direct application URLs, questions from API)
  {
    id: 'greenhouse',
    name: 'Greenhouse (Direct)',
    enabled: true,
    regions: ['global'],
    supportsRemote: true,
    priority: 0 // Highest priority - direct ATS with questions
  },
  {
    id: 'lever',
    name: 'Lever (Direct)',
    enabled: true,
    regions: ['global'],
    supportsRemote: true,
    priority: 0 // Highest priority - direct ATS with questions
  },
  {
    id: 'ashby',
    name: 'Ashby (Direct)',
    enabled: true,
    regions: ['global'],
    supportsRemote: true,
    priority: 0 // Highest priority - direct ATS with questions
  },
  // fantastic.jobs - primary source with 10M+ jobs
  {
    id: 'fantasticjobs',
    name: 'fantastic.jobs',
    enabled: true,
    regions: ['global'],
    supportsRemote: true,
    priority: 1
  },
  {
    id: ADZUNA_SOURCE,
    name: 'Adzuna',
    enabled: true,
    regions: [...ADZUNA_COUNTRIES],
    supportsRemote: true,
    priority: 2
  },
  {
    id: THEMUSE_SOURCE,
    name: 'The Muse',
    enabled: true,
    regions: ['us'],
    supportsRemote: true,
    priority: 3
  },
  {
    id: REMOTIVE_SOURCE,
    name: 'Remotive',
    enabled: true,
    regions: ['global'],
    supportsRemote: true,
    priority: 4
  },
  {
    id: ARBEITNOW_SOURCE,
    name: 'Arbeitnow',
    enabled: true,
    regions: ['eu', 'de', 'at', 'ch'],
    supportsRemote: true,
    priority: 5
  }
]

// =============================================================================
// DEDUPLICATION
// =============================================================================

/**
 * Normalize location string for fingerprinting
 * Handles variations like "London, UK", "London, United Kingdom", "London, ON, Canada"
 */
function normalizeLocation(location: string): string {
  if (!location) return ''

  const lower = location.toLowerCase().trim()

  // Split by comma and take meaningful parts
  const parts = lower.split(',').map(p => p.trim()).filter(Boolean)

  // If remote, just use "remote"
  if (parts[0] === 'remote' || lower.includes('remote')) {
    return 'remote'
  }

  // For short locations (1-2 parts), use as-is
  if (parts.length <= 2) {
    return parts.join('|')
  }

  // For longer locations, use first and last parts (city + country)
  // This handles "London, England, UK" → "london|uk"
  // And "New York, NY, USA" → "new york|usa"
  return `${parts[0]}|${parts[parts.length - 1]}`
}

/**
 * Normalize title for better matching
 * Removes common variations like Sr./Senior, Jr./Junior, etc.
 */
function normalizeTitle(title: string): string {
  if (!title) return ''

  return title
    .toLowerCase()
    .trim()
    // Normalize senior variations
    .replace(/\bsenior\b/g, 'sr')
    .replace(/\bsr\.\b/g, 'sr')
    // Normalize junior variations
    .replace(/\bjunior\b/g, 'jr')
    .replace(/\bjr\.\b/g, 'jr')
    // Normalize lead/principal
    .replace(/\blead\b/g, 'lead')
    .replace(/\bprincipal\b/g, 'principal')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
}

/**
 * Create a fingerprint for job deduplication
 * Jobs are considered duplicates if they have the same normalized title + company + location
 */
function createJobFingerprint(job: Partial<Job>): string {
  const title = normalizeTitle(job.title || '')
  const company = (job.company || '').toLowerCase().trim()
  const location = normalizeLocation(job.location || '')

  return `${title}|${company}|${location}`
}

/**
 * Deduplicate jobs, keeping the one from the highest priority source
 */
export function deduplicateJobs(
  jobs: Partial<Job>[],
  sourcePriority: string[] = JOB_SOURCES.map(s => s.id)
): Partial<Job>[] {
  const seen = new Map<string, Partial<Job>>()
  const sourceOrder = new Map(sourcePriority.map((s, i) => [s, i]))

  for (const job of jobs) {
    const fingerprint = createJobFingerprint(job)
    const existing = seen.get(fingerprint)

    if (!existing) {
      seen.set(fingerprint, job)
    } else {
      // Keep the job from higher priority source (lower index)
      const existingPriority = sourceOrder.get(existing.source || '') ?? 999
      const newPriority = sourceOrder.get(job.source || '') ?? 999

      if (newPriority < existingPriority) {
        seen.set(fingerprint, job)
      }
    }
  }

  return Array.from(seen.values())
}

// =============================================================================
// UNIFIED SEARCH
// =============================================================================

/**
 * Search across all enabled job sources
 */
export async function searchAllSources(
  params: UnifiedSearchParams,
  userId: string,
  enabledSources?: string[]
): Promise<SearchResult> {
  const results: SearchResult = {
    jobs: [],
    sources: {},
    total: 0,
    deduplicated: 0
  }

  // Determine which sources to use
  const sourcesToUse = JOB_SOURCES.filter(source => {
    if (!source.enabled) return false
    if (enabledSources && !enabledSources.includes(source.id)) return false

    // Check if source supports the requested regions
    if (params.countries && params.countries.length > 0) {
      const hasGlobal = source.regions.includes('global')
      const hasMatchingRegion = params.countries.some(country => {
        const code = getCountryCode(country)
        return code && source.regions.includes(code)
      })
      if (!hasGlobal && !hasMatchingRegion) return false
    }

    return true
  })

  // Search each source in parallel
  const searchPromises = sourcesToUse.map(async (source) => {
    try {
      const jobs = await searchSource(source.id, params, userId)
      results.sources[source.id] = {
        count: jobs.length,
        success: true
      }
      return jobs
    } catch (error) {
      console.error(`Error searching ${source.name}:`, error)
      results.sources[source.id] = {
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      return []
    }
  })

  const allResults = await Promise.all(searchPromises)
  const allJobs = allResults.flat()

  results.total = allJobs.length

  // Deduplicate
  results.jobs = deduplicateJobs(allJobs)
  results.deduplicated = results.total - results.jobs.length

  // Sort by posted date (newest first)
  results.jobs.sort((a, b) => {
    const dateA = new Date(a.job_posted_at || a.created_at || 0).getTime()
    const dateB = new Date(b.job_posted_at || b.created_at || 0).getTime()
    return dateB - dateA
  })

  // Apply limit if specified
  if (params.limit && params.limit > 0) {
    results.jobs = results.jobs.slice(0, params.limit)
  }

  return results
}

/**
 * Search a specific source and map results to unified format
 */
async function searchSource(
  sourceId: string,
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  switch (sourceId) {
    // Direct ATS sources (priority 0 - best quality)
    case GREENHOUSE_SOURCE:
      return searchGreenhouse(params, userId)

    case LEVER_SOURCE:
      return searchLever(params, userId)

    case ASHBY_SOURCE:
      return searchAshby(params, userId)

    // fantastic.jobs - primary source
    case 'fantasticjobs':
      return searchFantasticJobsSource(params, userId)

    // Additional aggregator sources
    case ADZUNA_SOURCE:
      return searchAdzuna(params, userId)

    case THEMUSE_SOURCE:
      return searchTheMuse(params, userId)

    case REMOTIVE_SOURCE:
      return searchRemotive(params, userId)

    case ARBEITNOW_SOURCE:
      return searchArbeitnow(params, userId)

    default:
      console.warn(`Unknown source: ${sourceId}`)
      return []
  }
}

// =============================================================================
// SOURCE-SPECIFIC SEARCH FUNCTIONS
// =============================================================================

async function searchFantasticJobsSource(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const searchParams: FantasticJobsSearchParams = {
    title_filter: params.query,
    limit: Math.min(params.limit || 50, 100),
    include_ai: true,
  }

  // Add location filter
  if (params.location) {
    searchParams.location_filter = params.location
  }

  // Add remote filter
  if (params.remote) {
    searchParams.ai_work_arrangement_filter = 'Remote Solely'
  } else if (params.hybrid) {
    searchParams.ai_work_arrangement_filter = 'Hybrid'
  }

  // Map job types
  if (params.jobTypes?.length) {
    const typeMap: Record<string, 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN'> = {
      'fulltime': 'FULL_TIME',
      'part-time': 'PART_TIME',
      'contractor': 'CONTRACTOR',
      'internship': 'INTERN',
    }
    for (const type of params.jobTypes) {
      if (typeMap[type.toLowerCase()]) {
        searchParams.ai_employment_type_filter = typeMap[type.toLowerCase()]
        break
      }
    }
  }

  const jobs = await searchFantasticJobs(searchParams)
  return jobs.map(job => mapFantasticJobToJob(job, userId))
}

async function searchAdzuna(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  // Determine countries to search
  const countries = params.countries?.map(c => getCountryCode(c)).filter(Boolean) || ['gb']

  // Search first available country
  const country = countries[0] || 'gb'

  const searchParams: AdzunaSearchParams = {
    query: params.query,
    country: country,
    location: params.location,
    resultsPerPage: Math.min(params.limit || 50, 50),
    page: params.page || 1,
    maxDaysOld: 14 // Last 2 weeks
  }

  // Add job type filters
  if (params.jobTypes?.includes('fulltime')) {
    searchParams.fullTime = true
  }
  if (params.jobTypes?.includes('part-time')) {
    searchParams.partTime = true
  }
  if (params.jobTypes?.includes('contractor')) {
    searchParams.contract = true
  }

  const jobs = await searchAdzunaJobs(searchParams)
  return jobs.map(job => mapAdzunaJobToJob(job, userId))
}

async function searchTheMuse(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const searchParams: TheMuseSearchParams = {
    query: params.query,
    page: (params.page || 1) - 1, // The Muse uses 0-indexed pages
    location: params.location
  }

  // Map job types to The Muse levels
  if (params.jobTypes?.includes('internship')) {
    searchParams.level = 'Internship'
  }

  const jobs = await searchTheMuseJobs(searchParams)
  return jobs.map(job => mapTheMuseJobToJob(job, userId))
}

async function searchRemotive(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const searchParams: RemotiveSearchParams = {
    query: params.query,
    limit: params.limit || 50
  }

  // Map industries to Remotive categories
  if (params.industries?.length) {
    const categoryMap: Record<string, string> = {
      'technology': 'software-dev',
      'software': 'software-dev',
      'marketing': 'marketing',
      'sales': 'sales',
      'design': 'design',
      'customer service': 'customer-service',
      'data': 'data',
      'devops': 'devops',
      'finance': 'finance',
      'hr': 'hr'
    }

    for (const industry of params.industries) {
      const category = categoryMap[industry.toLowerCase()]
      if (category) {
        searchParams.category = category
        break
      }
    }
  }

  const jobs = await searchRemotiveJobs(searchParams)
  return jobs.map(job => mapRemotiveJobToJob(job, userId))
}

async function searchArbeitnow(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const searchParams: ArbeitnowSearchParams = {
    query: params.query,
    page: params.page || 1,
    remote: params.remote
  }

  const jobs = await searchArbeitnowJobs(searchParams)
  return jobs.map(job => mapArbeitnowJobToJob(job, userId))
}

// =============================================================================
// DIRECT ATS SOURCE SEARCH FUNCTIONS
// These sources provide direct application URLs and questions from API
// =============================================================================

async function searchGreenhouse(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const boards = getGreenhouseBoards()

  // Search with query filter
  const jobs = await searchGreenhouseJobs(boards, userId, {
    query: params.query,
    limit: params.limit || 50,
  })

  // Filter by remote if specified
  if (params.remote) {
    return jobs.filter(j => j.remote === true)
  }

  return jobs
}

async function searchLever(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const companies = getLeverCompanies()

  // Search with query filter
  const jobs = await searchLeverJobs(companies, userId, {
    query: params.query,
    limit: params.limit || 50,
  })

  // Filter by remote if specified
  if (params.remote) {
    return jobs.filter(j => j.remote === true)
  }

  return jobs
}

async function searchAshby(
  params: UnifiedSearchParams,
  userId: string
): Promise<Partial<Job>[]> {
  const boards = getAshbyBoards()

  // Search with query filter
  const jobs = await searchAshbyJobs(boards, userId, {
    query: params.query,
    limit: params.limit || 50,
  })

  // Filter by remote if specified
  if (params.remote) {
    return jobs.filter(j => j.remote === true)
  }

  return jobs
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Re-export individual sources for direct access
  searchFantasticJobs,
  searchAdzunaJobs,
  searchTheMuseJobs,
  searchRemotiveJobs,
  searchArbeitnowJobs,
  searchGreenhouseJobs,
  searchLeverJobs,
  searchAshbyJobs,

  // Re-export mappers
  mapFantasticJobToJob,
  mapAdzunaJobToJob,
  mapTheMuseJobToJob,
  mapRemotiveJobToJob,
  mapArbeitnowJobToJob,

  // Re-export source names
  FANTASTICJOBS_SOURCE,
  ADZUNA_SOURCE,
  THEMUSE_SOURCE,
  REMOTIVE_SOURCE,
  ARBEITNOW_SOURCE,
  GREENHOUSE_SOURCE,
  LEVER_SOURCE,
  ASHBY_SOURCE,

  // Re-export company list helpers
  getGreenhouseBoards,
  getLeverCompanies,
  getAshbyBoards,

  // Re-export country helpers
  ADZUNA_COUNTRIES,
  getCountryCode
}
