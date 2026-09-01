/**
 * Multi-Source Job Search Helper
 *
 * Integrates with the existing search route to add jobs from multiple sources.
 * Uses fantastic.jobs as the primary source.
 */

import type { Job, JobFilters } from '@/lib/supabase/types'
import {
  searchAllSources,
  JOB_SOURCES,
  deduplicateJobs,
  getCountryCode
} from './index'

// =============================================================================
// TYPES
// =============================================================================

export interface MultiSourceSearchResult {
  jobs: Partial<Job>[]
  sourceStats: {
    [source: string]: {
      count: number
      success: boolean
      error?: string
    }
  }
  totalBeforeDedup: number
  totalAfterDedup: number
}

// =============================================================================
// MAIN SEARCH FUNCTION
// =============================================================================

/**
 * Search multiple job sources based on user filters
 *
 * @param filters User's job filters from profile
 * @param userId User ID for job mapping
 * @param options Additional options
 */
export async function searchMultipleSources(
  filters: JobFilters | null,
  userId: string,
  options: {
    manualQuery?: string
    enabledSources?: string[]
    limit?: number
  } = {}
): Promise<MultiSourceSearchResult> {
  // Build unified search params from filters
  const query = buildSearchQuery(filters, options.manualQuery)
  const countries = getCountriesFromFilters(filters)
  const remote = filters?.remote_jobs ?? true
  const hybrid = filters?.onsite_hybrid ?? false

  // Determine which sources to enable based on filters
  const enabledSources = options.enabledSources || determineSourcesFromFilters(filters, countries)

  console.log('Multi-source search params:', {
    query,
    countries,
    remote,
    hybrid,
    enabledSources,
    limit: options.limit
  })

  // Execute search across all sources
  const result = await searchAllSources(
    {
      query,
      countries,
      remote,
      hybrid,
      jobTypes: filters?.job_types,
      industries: filters?.industries,
      limit: options.limit || 100
    },
    userId,
    enabledSources
  )

  return {
    jobs: result.jobs,
    sourceStats: result.sources,
    totalBeforeDedup: result.total,
    totalAfterDedup: result.jobs.length
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build a search query from filters
 */
function buildSearchQuery(filters: JobFilters | null, manualQuery?: string): string {
  if (manualQuery) {
    return manualQuery
  }

  if (!filters) {
    return 'job'
  }

  const parts: string[] = []

  // Add job titles
  if (filters.job_titles?.length > 0) {
    parts.push(filters.job_titles[0]) // Use primary job title
  }

  // Add include keywords
  if (filters.include_keywords?.length > 0) {
    parts.push(...filters.include_keywords.slice(0, 3))
  }

  // Fallback
  if (parts.length === 0) {
    parts.push('job')
  }

  return parts.join(' ')
}

/**
 * Extract countries from filters
 */
function getCountriesFromFilters(filters: JobFilters | null): string[] {
  if (!filters) return []

  const countries: string[] = []

  // Add remote countries
  if (filters.remote_countries?.length > 0) {
    countries.push(...filters.remote_countries)
  }

  // Add onsite locations (extract country from location string)
  if (filters.onsite_locations?.length > 0) {
    for (const location of filters.onsite_locations) {
      // Try to extract country from location string
      const parts = location.split(',').map(p => p.trim())
      const lastPart = parts[parts.length - 1]
      if (lastPart) {
        countries.push(lastPart)
      }
    }
  }

  return Array.from(new Set(countries)) // Remove duplicates
}

/**
 * Determine which sources to enable based on user filters
 */
function determineSourcesFromFilters(filters: JobFilters | null, countries: string[]): string[] {
  const sources: string[] = []

  // Always include fantastic.jobs as primary source
  sources.push('fantasticjobs')

  // Always include Remotive for remote jobs (free, no rate limits)
  if (!filters || filters.remote_jobs) {
    sources.push('remotive')
  }

  // Include Arbeitnow for European jobs
  if (!filters || filters.remote_jobs) {
    sources.push('arbeitnow')
  }

  // Include The Muse for US jobs
  const hasUS = countries.some(c =>
    c.toLowerCase() === 'us' ||
    c.toLowerCase() === 'usa' ||
    c.toLowerCase() === 'united states'
  )
  if (!filters || hasUS || countries.length === 0) {
    sources.push('themuse')
  }

  // Include Adzuna for supported countries
  const adzunaCountries = countries
    .map(c => getCountryCode(c))
    .filter(Boolean)

  if (adzunaCountries.length > 0 || countries.length === 0) {
    sources.push('adzuna')
  }

  return sources
}

/**
 * Merge multi-source jobs with existing jobs
 */
export function mergeWithFantasticJobsResults(
  fantasticJobsJobs: Partial<Job>[],
  multiSourceJobs: Partial<Job>[]
): Partial<Job>[] {
  const allJobs = [...fantasticJobsJobs, ...multiSourceJobs]
  return deduplicateJobs(allJobs)
}

/**
 * Get available sources for a user's configuration
 */
export function getAvailableSources(filters: JobFilters | null): typeof JOB_SOURCES {
  const countries = getCountriesFromFilters(filters)
  const enabledIds = determineSourcesFromFilters(filters, countries)

  return JOB_SOURCES.filter(source =>
    source.enabled && enabledIds.includes(source.id)
  )
}

/**
 * Check if multi-source search is available (at least one source configured)
 */
export function isMultiSourceAvailable(): boolean {
  // Check if RapidAPI key is configured (required for fantastic.jobs)
  const hasRapidAPI = !!process.env.RAPIDAPI_KEY
  const hasAdzuna = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
  const hasTheMuse = !!process.env.THEMUSE_API_KEY
  // Remotive and Arbeitnow don't need API keys

  return hasRapidAPI || hasAdzuna || hasTheMuse || true // Remotive/Arbeitnow always available
}
