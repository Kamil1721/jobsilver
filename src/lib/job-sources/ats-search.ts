/**
 * Unified ATS Search Module
 *
 * Coordinates job search across Greenhouse, Lever, and Ashby job boards.
 * Jobs from these sources come with application questions pre-loaded,
 * eliminating the need for separate scraping.
 */

import type { Job, ScrapedQuestion, FormStructure, PlatformType } from '@/lib/supabase/types'

// Greenhouse
import {
  searchGreenhouseJobs,
  fetchGreenhouseJobWithQuestions,
  parseGreenhouseUrl,
  mapGreenhouseQuestions,
} from '@/lib/api/greenhouse'

// Lever
import {
  searchLeverJobs,
  generateLeverQuestions,
  parseLeverUrl,
} from '@/lib/api/lever'

// Ashby
import {
  searchAshbyJobs,
  mapAshbyFormFields,
  generateStandardAshbyQuestions,
  parseAshbyUrl,
} from '@/lib/api/ashby'

// Company lists
import {
  getGreenhouseBoards,
  getLeverCompanies,
  getAshbyBoards,
  findCompanyByName,
  ATS_STATS,
} from '@/lib/api/ats-companies'

// =============================================================================
// TYPES
// =============================================================================

export interface ATSJob extends Partial<Job> {
  questions?: ScrapedQuestion[]
  ats_source: 'greenhouse' | 'lever' | 'ashby'
  ats_job_id: string
}

export interface ATSSearchResult {
  jobs: ATSJob[]
  sourceStats: {
    greenhouse: { count: number; success: boolean; error?: string }
    lever: { count: number; success: boolean; error?: string }
    ashby: { count: number; success: boolean; error?: string }
  }
  totalJobs: number
  companiesSearched: number
}

export interface ATSSearchOptions {
  query?: string
  limit?: number
  enableGreenhouse?: boolean
  enableLever?: boolean
  enableAshby?: boolean
  remoteOnly?: boolean
  categories?: string[]
}

// =============================================================================
// UNIFIED SEARCH
// =============================================================================

/**
 * Search jobs across all ATS platforms
 *
 * Unlike JSearch, jobs from these sources:
 * - Have direct application URLs (no aggregator redirects)
 * - Include application questions from API (no scraping needed)
 * - Are always from real company job boards
 */
export async function searchATSJobs(
  userId: string,
  options: ATSSearchOptions = {}
): Promise<ATSSearchResult> {
  const {
    query,
    limit = 50,
    enableGreenhouse = true,
    enableLever = true,
    enableAshby = true,
  } = options

  const result: ATSSearchResult = {
    jobs: [],
    sourceStats: {
      greenhouse: { count: 0, success: false },
      lever: { count: 0, success: false },
      ashby: { count: 0, success: false },
    },
    totalJobs: 0,
    companiesSearched: 0,
  }

  const searchPromises: Promise<void>[] = []

  // Calculate limits per source (distribute evenly)
  const enabledSources = [enableGreenhouse, enableLever, enableAshby].filter(Boolean).length
  const perSourceLimit = Math.ceil(limit / enabledSources)

  // Search Greenhouse
  if (enableGreenhouse) {
    const boards = getGreenhouseBoards()
    result.companiesSearched += boards.length

    searchPromises.push(
      (async () => {
        try {
          const jobs = await searchGreenhouseJobs(boards, userId, {
            query,
            limit: perSourceLimit,
          })

          for (const job of jobs) {
            result.jobs.push({
              ...job,
              ats_source: 'greenhouse',
              ats_job_id: (job as ATSJob).ats_job_id || extractJobIdFromExternalId(job.external_id, 'greenhouse'),
            } as ATSJob)
          }

          result.sourceStats.greenhouse = {
            count: jobs.length,
            success: true,
          }
        } catch (error) {
          result.sourceStats.greenhouse = {
            count: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
          console.error('Greenhouse search failed:', error)
        }
      })()
    )
  }

  // Search Lever
  if (enableLever) {
    const companies = getLeverCompanies()
    result.companiesSearched += companies.length

    searchPromises.push(
      (async () => {
        try {
          const jobs = await searchLeverJobs(companies, userId, {
            query,
            limit: perSourceLimit,
          })

          for (const job of jobs) {
            result.jobs.push({
              ...job,
              ats_source: 'lever',
              ats_job_id: (job as ATSJob).ats_job_id || extractJobIdFromExternalId(job.external_id, 'lever'),
            } as ATSJob)
          }

          result.sourceStats.lever = {
            count: jobs.length,
            success: true,
          }
        } catch (error) {
          result.sourceStats.lever = {
            count: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
          console.error('Lever search failed:', error)
        }
      })()
    )
  }

  // Search Ashby
  if (enableAshby) {
    const boards = getAshbyBoards()
    result.companiesSearched += boards.length

    searchPromises.push(
      (async () => {
        try {
          const jobs = await searchAshbyJobs(boards, userId, {
            query,
            limit: perSourceLimit,
          })

          for (const job of jobs) {
            result.jobs.push({
              ...job,
              ats_source: 'ashby',
              ats_job_id: (job as ATSJob).ats_job_id || extractJobIdFromExternalId(job.external_id, 'ashby'),
            } as ATSJob)
          }

          result.sourceStats.ashby = {
            count: jobs.length,
            success: true,
          }
        } catch (error) {
          result.sourceStats.ashby = {
            count: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
          console.error('Ashby search failed:', error)
        }
      })()
    )
  }

  // Execute all searches in parallel
  await Promise.all(searchPromises)

  // Sort by posted date (newest first)
  result.jobs.sort((a, b) => {
    const dateA = new Date(a.job_posted_at || a.created_at || 0).getTime()
    const dateB = new Date(b.job_posted_at || b.created_at || 0).getTime()
    return dateB - dateA
  })

  // Apply overall limit
  result.jobs = result.jobs.slice(0, limit)
  result.totalJobs = result.jobs.length

  return result
}

// =============================================================================
// FETCH QUESTIONS FOR EXISTING JOB
// =============================================================================

/**
 * Fetch application questions for a job using its URL
 * This is useful when we have a job from JSearch that points to an ATS
 */
export async function fetchQuestionsForJob(
  applicationUrl: string,
  userId: string
): Promise<{
  questions: ScrapedQuestion[]
  formStructure: FormStructure
  source: 'api'
} | null> {
  // Try Greenhouse
  const ghParsed = parseGreenhouseUrl(applicationUrl)
  if (ghParsed) {
    const companyInfo = findCompanyByName(ghParsed.boardToken)
    // Get company name - prefer displayName for Ashby, use name for others
    const company = companyInfo?.company
    const companyName = company
      ? ('displayName' in company ? company.displayName : company.name)
      : ghParsed.boardToken

    const result = await fetchGreenhouseJobWithQuestions(
      ghParsed.boardToken,
      ghParsed.jobId,
      userId,
      companyName
    )

    if (result) {
      return {
        questions: result.questions,
        formStructure: {
          platform: 'greenhouse',
          total_pages: 1,
          has_cv_upload: result.questions.some(q => q.type === 'file'),
          has_cover_letter: result.questions.some(q =>
            q.label.toLowerCase().includes('cover letter')
          ),
          requires_login: false,
          application_type: 'direct',
        },
        source: 'api',
      }
    }
  }

  // Try Lever
  const lvParsed = parseLeverUrl(applicationUrl)
  if (lvParsed) {
    // Lever has standard form structure
    return {
      questions: generateLeverQuestions(),
      formStructure: {
        platform: 'lever',
        total_pages: 1,
        has_cv_upload: true,
        has_cover_letter: false,
        requires_login: false,
        application_type: 'direct',
      },
      source: 'api',
    }
  }

  // Try Ashby
  const abParsed = parseAshbyUrl(applicationUrl)
  if (abParsed) {
    // Use standard Ashby questions
    return {
      questions: generateStandardAshbyQuestions(),
      formStructure: {
        platform: 'ashby',
        total_pages: 1,
        has_cv_upload: true,
        has_cover_letter: false,
        requires_login: false,
        application_type: 'direct',
      },
      source: 'api',
    }
  }

  return null
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract job ID from external_id format
 */
function extractJobIdFromExternalId(externalId: string | null | undefined, ats: string): string {
  if (!externalId) return ''

  // Format is {ats}_{company}_{jobId}
  const parts = externalId.split('_')
  if (parts.length >= 3 && parts[0] === ats) {
    return parts.slice(2).join('_')
  }

  return externalId
}

/**
 * Detect if a URL is from a supported ATS
 */
export function detectATSFromUrl(url: string): 'greenhouse' | 'lever' | 'ashby' | null {
  if (parseGreenhouseUrl(url)) return 'greenhouse'
  if (parseLeverUrl(url)) return 'lever'
  if (parseAshbyUrl(url)) return 'ashby'
  return null
}

/**
 * Check if questions can be fetched from ATS API instead of scraping
 */
export function canFetchQuestionsFromAPI(applicationUrl: string): boolean {
  return detectATSFromUrl(applicationUrl) !== null
}

/**
 * Get ATS search statistics
 */
export function getATSStats() {
  return {
    ...ATS_STATS,
    description: `${ATS_STATS.total} companies across ${ATS_STATS.greenhouse} Greenhouse, ${ATS_STATS.lever} Lever, and ${ATS_STATS.ashby} Ashby boards`,
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Re-export company lists
  getGreenhouseBoards,
  getLeverCompanies,
  getAshbyBoards,
  findCompanyByName,

  // Re-export URL parsers
  parseGreenhouseUrl,
  parseLeverUrl,
  parseAshbyUrl,

  // Re-export question generators
  mapGreenhouseQuestions,
  generateLeverQuestions,
  mapAshbyFormFields,
  generateStandardAshbyQuestions,
}
