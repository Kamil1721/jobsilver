import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

// fantastic.jobs API - Primary job search source (replaces JSearch)
import {
  searchJobs as searchFantasticJobs,
  mapFantasticJobToJob,
  FantasticJobsJob,
  validateRemoteType,
  validateJobLocation,
  isSpamJob,
  isJobFresh,
  isWorldwideRemote,
  mapJobTypeToEmploymentType,
  mapSeniorityToExperienceLevel,
  mapRemoteToWorkArrangement,
  mapWorkArrangementsToFilter,
  mapIndustriesToTaxonomyFilter,
  RemoteType,
  matchesIndustry,
  getCompanySizeCategory,
} from '@/lib/api/fantasticjobs'

// Timezone mapping utilities
import { getJobTimezones, hasFlexibleTimezone } from '@/lib/utils/timezone-mapping'

import { calculateJobMatch } from '@/lib/ai/matching'
import {
  buildQueryInput,
  generateSearchQueries,
  getQueriesForAPI,
  type GeneratedQueries,
} from '@/lib/ai/query-generator'
import { computeProfileHash, getCachedQueries, setCachedQueries } from '@/lib/cache/query-cache'
import type { JobFilters, Job, ScreeningAnswers } from '@/lib/supabase/types'
import { validateMandatoryFilters } from '@/lib/filter-validation'
// Platform detection helper - inlined from removed auto-apply module
function detectPlatform(url: string): string {
  if (!url) return 'unknown'
  const lower = url.toLowerCase()
  if (lower.includes('greenhouse.io') || lower.includes('boards.greenhouse')) return 'greenhouse'
  if (lower.includes('lever.co') || lower.includes('jobs.lever')) return 'lever'
  if (lower.includes('ashbyhq.com') || lower.includes('jobs.ashby')) return 'ashby'
  if (lower.includes('teamtailor.com')) return 'teamtailor'
  if (lower.includes('workday.com')) return 'workday'
  if (lower.includes('bamboohr.com')) return 'bamboohr'
  if (lower.includes('linkedin.com')) return 'linkedin'
  if (lower.includes('indeed.com')) return 'indeed'
  return 'other'
}
import type { ParsedCV } from '@/lib/ai/cv-parser'

// ATS Direct Integration - Greenhouse, Lever, Ashby
import { searchATSJobs } from '@/lib/job-sources/ats-search'

// Preference Scoring - AI Learning integration
import {
  getUserLearnedPreferences,
  mergeExplicitWithLearnedPreferences,
  computeFinalJobScore,
  injectDiversity,
} from '@/lib/ai/preference-scoring'
import { canAccessFeature } from '@/lib/features/config'
import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'

// Plan-based quota limits (2-tier model: free=3 jobs/day, pro=50 jobs/day)
import { getDailyJobLimit } from '@/lib/stripe/plans'

// =============================================================================
// QUOTA MANAGEMENT
// =============================================================================

interface QuotaResult {
  allowed: boolean
  remaining: number
  limit: number
  jobsFetched: number
}

/**
 * Get plan-based daily job limit for a user
 * 2-tier model: free=3 jobs/day, pro=50 jobs/day
 */
function getPlanJobLimit(plan: AllSubscriptionPlans): number {
  return getDailyJobLimit(plan)
}

/**
 * Check and update user's daily job quota
 * 2-tier model: free=3 jobs/day, pro=50 jobs/day
 */
async function checkAndUpdateQuota(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  jobsToAdd: number,
  userPlan: AllSubscriptionPlans = 'free'
): Promise<QuotaResult> {
  const today = new Date().toISOString().split('T')[0]
  const planJobLimit = getPlanJobLimit(userPlan)

  // Get or create today's quota record
  let { data: quota, error } = await supabase
    .from('user_job_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (error && error.code === 'PGRST116') {
    // No record for today, create one with plan-based limits
    const { data: newQuota, error: insertError } = await supabase
      .from('user_job_quotas')
      .insert({
        user_id: userId,
        date: today,
        jobs_fetched: 0,
        jobs_limit: planJobLimit,
        applications_used: 0,
        applications_limit: planJobLimit, // Same as jobs limit in 2-tier model
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating quota record:', insertError)
      // Allow the search to proceed even if quota tracking fails
      return { allowed: true, remaining: planJobLimit, limit: planJobLimit, jobsFetched: 0 }
    }

    quota = newQuota
  }

  if (!quota) {
    // Something went wrong, allow the search
    return { allowed: true, remaining: planJobLimit, limit: planJobLimit, jobsFetched: 0 }
  }

  // Update limit if plan changed (user upgraded/downgraded)
  if (quota.jobs_limit !== planJobLimit) {
    await supabase
      .from('user_job_quotas')
      .update({ jobs_limit: planJobLimit, applications_limit: planJobLimit })
      .eq('id', quota.id)
    quota.jobs_limit = planJobLimit
  }

  const remaining = quota.jobs_limit - quota.jobs_fetched
  const allowed = remaining > 0

  // Calculate how many jobs we can actually fetch
  const actualJobsToAdd = Math.min(jobsToAdd, remaining)

  if (allowed && actualJobsToAdd > 0) {
    // Update the quota
    await supabase
      .from('user_job_quotas')
      .update({ jobs_fetched: quota.jobs_fetched + actualJobsToAdd })
      .eq('id', quota.id)
  }

  return {
    allowed,
    remaining: Math.max(0, remaining - actualJobsToAdd),
    limit: quota.jobs_limit,
    jobsFetched: quota.jobs_fetched + actualJobsToAdd,
  }
}

/**
 * Get current quota status without updating
 * 2-tier model: free=3 jobs/day, pro=50 jobs/day
 */
async function getQuotaStatus(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  userId: string,
  userPlan: AllSubscriptionPlans = 'free'
): Promise<QuotaResult> {
  const today = new Date().toISOString().split('T')[0]
  const planJobLimit = getPlanJobLimit(userPlan)

  const { data: quota } = await supabase
    .from('user_job_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (!quota) {
    return { allowed: true, remaining: planJobLimit, limit: planJobLimit, jobsFetched: 0 }
  }

  // Use plan-based limit (in case plan changed)
  const effectiveLimit = Math.max(quota.jobs_limit, planJobLimit)
  const remaining = effectiveLimit - quota.jobs_fetched
  return {
    allowed: remaining > 0,
    remaining,
    limit: effectiveLimit,
    jobsFetched: quota.jobs_fetched,
  }
}

// =============================================================================
// JOB TYPE FOR PROCESSING
// =============================================================================

interface UnifiedJob {
  source: 'fantasticjobs' | 'greenhouse' | 'lever' | 'ashby'
  mapped: Partial<Job>
  raw: FantasticJobsJob | null // null for ATS jobs
}

// Seniority keywords for post-processing filter
const SENIORITY_KEYWORDS: Record<string, string[]> = {
  entry: ['entry level', 'entry-level', 'junior', 'graduate', 'trainee', 'no experience', 'fresh graduate', '0-1 year', '0-2 year'],
  associate: ['associate', '1-3 year', '2-3 year', 'some experience', 'early career'],
  'mid-senior': ['senior', 'mid-level', 'mid level', 'experienced', '3+ year', '4+ year', '5+ year', 'lead', 'staff'],
  director: ['director', 'head of', 'vp', 'vice president', 'chief', 'principal', 'executive', '10+ year'],
}

// Match threshold mapping
const MATCH_THRESHOLD_MAP: Record<string, number> = {
  high: 25,
  higher: 35,
  highest: 50,
}

const MAX_JOB_AGE_DAYS = 14

// =============================================================================
// EASY APPLY FILTER
// =============================================================================

function isEasyApplyJob(job: UnifiedJob): boolean {
  // All jobs are now supported - no restrictions
  // Return true for any job with an application URL
  const url = job.mapped.application_url || ''
  return url.length > 0
}

export async function POST(request: NextRequest) {
  console.log('=== JOB SEARCH API CALLED ===')
  console.log('RAPIDAPI_KEY configured:', !!process.env.RAPIDAPI_KEY)

  try {
    // Check for internal API key for automated calls (cron jobs, etc.)
    const apiKey = request.headers.get('x-api-key')
    const isInternalCall = apiKey === process.env.INTERNAL_API_KEY && process.env.INTERNAL_API_KEY

    // Use service client for internal calls (bypasses RLS), regular client for user calls
    const supabase = isInternalCall
      ? createServiceClient()
      : await createClient()

    const { data: { user } } = isInternalCall
      ? { data: { user: null } } // Skip auth check for internal calls
      : await supabase.auth.getUser()

    if (!user && !isInternalCall) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting - skip for internal calls
    if (!isInternalCall) {
      const clientId = user?.id || 'anonymous'
      const rateLimit = checkRateLimit(clientId, { maxRequests: 5, windowSeconds: 60, prefix: 'search' }, 'jobs-search')
      if (!rateLimit.allowed) {
        const retryAfter = Math.max(1, rateLimit.resetAt - Math.floor(Date.now() / 1000))
        return NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many search requests. Please wait.' } },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      }
    }

    const body = await request.json()
    const { useProfileFilters = true, manualQuery, userId: bodyUserId } = body

    // Determine the effective user ID (from auth or body for internal calls)
    const effectiveUserId = user?.id || (isInternalCall ? bodyUserId : null)

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized - user ID required' }, { status: 401 })
    }

    // Get user's profile with filters, CV data, screening answers, and subscription plan
    // Fetch this FIRST so we can use plan-based quota limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('cv_parsed_data, job_filters, screening_answers, subscription_plan, is_tester')
      .eq('id', effectiveUserId)
      .single()

    const filters = profile?.job_filters as JobFilters | null
    const cvData = profile?.cv_parsed_data as ParsedCV | null
    const screeningAnswers = profile?.screening_answers as ScreeningAnswers | null
    const userPlan = (profile?.subscription_plan || 'free') as AllSubscriptionPlans
    const isTester = profile?.is_tester || false

    // Check quota before searching (using plan-based limits)
    const quotaStatus = await getQuotaStatus(supabase, effectiveUserId, userPlan)
    if (!quotaStatus.allowed) {
      return NextResponse.json({
        error: 'Daily job quota exceeded',
        quota: {
          remaining: 0,
          limit: quotaStatus.limit,
          resets_at: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        },
      }, { status: 429 })
    }

    // Check if user can use AI learning features (cast to handle legacy plans)
    const canUseAILearning = canAccessFeature(userPlan as 'free' | 'pro', 'ai_learning', isTester)

    console.log('CV Data check:', {
      hasProfile: !!profile,
      hasCvParsedData: !!profile?.cv_parsed_data,
      skillsCount: cvData?.skills?.length ?? 0,
      skills: cvData?.skills?.slice(0, 5) ?? [],
      experienceCount: cvData?.experience?.length ?? 0,
      hasScreeningAnswers: !!screeningAnswers,
      currentJobTitle: screeningAnswers?.current_job_title || 'Not set',
    })

    // ==========================================================================
    // AI QUERY GENERATION
    // ==========================================================================
    let searchQueries: GeneratedQueries | null = null

    if (useProfileFilters && filters) {
      const queryInput = buildQueryInput(cvData, screeningAnswers, filters)
      const profileHash = computeProfileHash(queryInput)

      searchQueries = await getCachedQueries(effectiveUserId, profileHash)

      if (!searchQueries) {
        console.log('Generating new search queries with AI...')
        searchQueries = await generateSearchQueries(queryInput)
        await setCachedQueries(effectiveUserId, searchQueries, profileHash)
        console.log('Generated queries:', {
          primary: searchQueries.primary,
          skillBased: searchQueries.skillBased,
          seniorityVariants: searchQueries.seniorityVariants,
          industrySpecific: searchQueries.industrySpecific,
          reasoning: searchQueries.metadata.reasoning,
        })
      } else {
        console.log('Using cached queries:', {
          primary: searchQueries.primary,
          reasoning: searchQueries.metadata.reasoning,
        })
      }
    }

    // Validate mandatory filters
    if (useProfileFilters) {
      const validation = validateMandatoryFilters(filters)
      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Missing mandatory filters',
          validation_errors: validation.errors,
          redirect_to_setup: true
        }, { status: 400 })
      }
    }

    // ==========================================================================
    // PRE-FETCH DISCARDED/APPLIED JOBS TO EXCLUDE
    // ==========================================================================
    // Fetch jobs user has already discarded or applied to - these should never appear again
    const { data: excludedJobs } = await supabase
      .from('jobs')
      .select('external_id, application_url')
      .eq('user_id', effectiveUserId)
      .in('status', ['discarded', 'applied'])

    const excludedExternalIds = new Set(
      (excludedJobs || []).map(j => j.external_id).filter(Boolean)
    )
    const excludedUrls = new Set(
      (excludedJobs || []).map(j => j.application_url).filter(Boolean)
    )
    console.log(`Pre-filtering: ${excludedExternalIds.size} discarded/applied jobs to exclude`)
    if (excludedExternalIds.size > 0) {
      console.log(`Excluded external_ids (first 5):`, Array.from(excludedExternalIds).slice(0, 5))
    }
    if (excludedUrls.size > 0) {
      console.log(`Excluded URLs (first 3):`, Array.from(excludedUrls).slice(0, 3))
    }

    // Build search parameters
    const allUnifiedJobs: UnifiedJob[] = []
    const searchErrors: string[] = []

    if (useProfileFilters && filters) {
      // Build include keywords
      const includeKeywords = (filters.include_keywords || []).slice(0, 2).join(' ')

      // Get queries from AI or fallback
      let fantasticJobsQueries: string[]

      if (searchQueries) {
        fantasticJobsQueries = getQueriesForAPI(searchQueries, 'fantasticjobs')
        console.log('Using AI-generated queries:', fantasticJobsQueries)
      } else {
        // Build fallback query: prefer industry + job title, fall back to either alone
        const hasJobTitles = filters.job_titles && filters.job_titles.length > 0
        const hasIndustries = filters.industries && filters.industries.length > 0

        let fallbackQuery: string
        if (hasIndustries && hasJobTitles) {
          // Combine: "Retail Sales assistant"
          fallbackQuery = `${filters.industries[0]} ${filters.job_titles[0]}`
        } else if (hasIndustries) {
          // Industry only: "Retail jobs"
          fallbackQuery = `${filters.industries[0]} jobs`
        } else if (hasJobTitles) {
          // Title only
          fallbackQuery = filters.job_titles[0]
        } else {
          fallbackQuery = 'jobs'
        }
        fantasticJobsQueries = [fallbackQuery]
        console.log('Using fallback query:', fallbackQuery)
      }

      // Also add industry-specific search if industry is set but not in queries
      const hasIndustries = filters.industries && filters.industries.length > 0
      if (hasIndustries && fantasticJobsQueries.length < 3) {
        const industryQuery = `${filters.industries[0]} jobs`
        if (!fantasticJobsQueries.includes(industryQuery)) {
          fantasticJobsQueries.push(industryQuery)
          console.log('Added industry-based query:', industryQuery)
        }
      }

      const baseQuery = fantasticJobsQueries[0] || 'jobs'

      // ==========================================================================
      // FANTASTIC.JOBS API SEARCH
      // ==========================================================================
      console.log('=== Starting fantastic.jobs Search ===')
      console.log(`Primary Query: "${baseQuery}"`)
      console.log(`All Queries: ${fantasticJobsQueries.join(', ')}`)
      console.log(`Work Arrangements: ${filters.work_arrangements?.join(', ') || 'legacy mode'}`)
      console.log(`Industries: ${filters.industries?.join(', ') || 'All'}`)
      console.log(`Remote: ${filters.remote_jobs}, Onsite: ${filters.onsite_hybrid}`)
      console.log(`Countries: ${filters.remote_countries?.join(', ') || 'None specified'}`)
      console.log(`Quota remaining: ${quotaStatus.remaining} jobs`)

      // Map filters to fantastic.jobs API parameters
      const employmentType = mapJobTypeToEmploymentType(filters.job_types)
      const experienceLevel = mapSeniorityToExperienceLevel(filters.seniority_levels)

      // Use new work_arrangements if available, fall back to legacy fields
      const workArrangement = filters.work_arrangements && filters.work_arrangements.length > 0
        ? mapWorkArrangementsToFilter(filters.work_arrangements)
        : mapRemoteToWorkArrangement(filters.remote_jobs, filters.onsite_hybrid)

      // Map industries to taxonomy filter
      const taxonomyFilter = mapIndustriesToTaxonomyFilter(filters.industries)

      console.log('Mapped filters:', { employmentType, experienceLevel, workArrangement, taxonomyFilter })

      // Helper function to delay between API calls (avoid per-second rate limits)
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      const API_CALL_DELAY_MS = 1200 // 1.2 seconds between calls to stay under rate limit

      // Determine primary location for API filtering
      // Use onsite_locations first (for on-site/hybrid), then remote_countries
      const primaryLocations = [
        ...(filters.onsite_locations || []),
        ...(filters.remote_countries || []),
      ].filter(Boolean)
      const primaryLocation = primaryLocations[0] || null

      console.log(`Primary location filter: ${primaryLocation || 'None (global search)'}`)

      // Search with each AI-generated query SEQUENTIALLY to avoid rate limits
      for (const query of fantasticJobsQueries.slice(0, 3)) { // Limit to 3 queries to conserve quota
        try {
          const searchTitle = includeKeywords ? `${query} ${includeKeywords}` : query
          console.log(`Calling fantastic.jobs API with title: "${searchTitle}"${primaryLocation ? `, location: "${primaryLocation}"` : ''}`)

          const jobs = await searchFantasticJobs({
            title_filter: searchTitle,
            location_filter: primaryLocation || undefined, // Filter by location at API level
            limit: Math.min(50, quotaStatus.remaining), // Respect quota
            ai_work_arrangement_filter: workArrangement,
            ai_employment_type_filter: employmentType,
            ai_experience_level_filter: experienceLevel,
            ai_taxonomies_a_filter: taxonomyFilter,
          })

          console.log(`fantastic.jobs API returned ${jobs.length} jobs for "${searchTitle}"`)

          for (const job of jobs) {
            allUnifiedJobs.push({
              source: 'fantasticjobs',
              mapped: mapFantasticJobToJob(job, effectiveUserId),
              raw: job,
            })
          }

          // Delay before next API call to avoid rate limits
          await delay(API_CALL_DELAY_MS)
        } catch (error) {
          const errorMsg = `fantastic.jobs "${query}": ${error instanceof Error ? error.message : String(error)}`
          console.error(errorMsg)
          searchErrors.push(errorMsg)
          // Still delay even on error to avoid hammering the API
          await delay(API_CALL_DELAY_MS)
        }
      }

      // If user wants location-specific jobs, add location searches (also sequential)
      if (filters.remote_countries && filters.remote_countries.length > 0) {
        for (const location of filters.remote_countries.slice(0, 2)) {
          try {
            const jobs = await searchFantasticJobs({
              title_filter: baseQuery,
              location_filter: location,
              limit: 30,
              ai_work_arrangement_filter: workArrangement,
              ai_employment_type_filter: employmentType,
              ai_taxonomies_a_filter: taxonomyFilter,
            })

            console.log(`fantastic.jobs (${location}): ${jobs.length} jobs`)

            for (const job of jobs) {
              allUnifiedJobs.push({
                source: 'fantasticjobs',
                mapped: mapFantasticJobToJob(job, effectiveUserId),
                raw: job,
              })
            }

            await delay(API_CALL_DELAY_MS)
          } catch (error) {
            console.error(`fantastic.jobs location search error:`, error)
            await delay(API_CALL_DELAY_MS)
          }
        }
      }

      console.log(`=== fantastic.jobs Search Complete: ${allUnifiedJobs.length} total jobs ===`)

      // ==========================================================================
      // ATS Direct APIs - Greenhouse, Lever, Ashby
      // ==========================================================================
      try {
        console.log('=== Starting ATS Direct Search ===')
        const primaryQueryRaw = searchQueries?.primary || fantasticJobsQueries[0] || 'software engineer'
        const primaryQuery = Array.isArray(primaryQueryRaw) ? primaryQueryRaw[0] : primaryQueryRaw
        const atsResult = await searchATSJobs(effectiveUserId, {
          query: primaryQuery,
          limit: 50,
        })

        for (const atsJob of atsResult.jobs) {
          const source = (atsJob.ats_source || atsJob.platform_detected || 'greenhouse') as 'greenhouse' | 'lever' | 'ashby'
          allUnifiedJobs.push({
            source,
            mapped: atsJob,
            raw: null,
          })
        }
        console.log(`=== ATS Search Complete: ${atsResult.totalJobs} jobs from Greenhouse/Lever/Ashby ===`)
      } catch (atsError) {
        console.error('ATS search error:', atsError)
        searchErrors.push(`ATS search: ${atsError instanceof Error ? atsError.message : String(atsError)}`)
      }

    } else if (manualQuery) {
      // Manual query search
      try {
        const jobs = await searchFantasticJobs({
          title_filter: manualQuery,
          limit: quotaStatus.remaining,
        })
        for (const job of jobs) {
          allUnifiedJobs.push({
            source: 'fantasticjobs',
            mapped: mapFantasticJobToJob(job, effectiveUserId),
            raw: job,
          })
        }
        console.log(`fantastic.jobs manual search "${manualQuery}": ${jobs.length} jobs`)
      } catch (error) {
        console.error('fantastic.jobs manual search error:', error)
      }
    }

    // Deduplicate jobs by external_id + source
    const uniqueJobsMap = new Map<string, UnifiedJob>()
    for (const job of allUnifiedJobs) {
      const key = `${job.source}:${job.mapped.external_id}`
      if (!uniqueJobsMap.has(key)) {
        uniqueJobsMap.set(key, job)
      }
    }
    const uniqueJobs = Array.from(uniqueJobsMap.values())

    console.log(`Found ${uniqueJobs.length} unique jobs before filtering (from ${allUnifiedJobs.length} total)`)

    // ==========================================================================
    // VALIDATION & FILTERING
    // ==========================================================================

    let filteredJobs = uniqueJobs

    // 0. EXCLUDE PREVIOUSLY DISCARDED/APPLIED JOBS (100% blocking - never show again)
    const preExcludedCount = filteredJobs.length
    filteredJobs = filteredJobs.filter(job => {
      const externalId = job.mapped.external_id
      const appUrl = job.mapped.application_url
      // Exclude if external_id or application_url matches a discarded/applied job
      if (externalId && excludedExternalIds.has(externalId)) return false
      if (appUrl && excludedUrls.has(appUrl)) return false
      return true
    })
    console.log(`Discarded/applied filter: ${preExcludedCount} -> ${filteredJobs.length} jobs`)

    // 1. SPAM FILTER
    const preSpamCount = filteredJobs.length
    filteredJobs = filteredJobs.filter(job => {
      if (!job.raw) return true // ATS jobs are curated
      return !isSpamJob(job.raw)
    })
    console.log(`Spam filter: ${preSpamCount} -> ${filteredJobs.length} jobs`)

    // 2. FRESHNESS FILTER
    const preFreshnessCount = filteredJobs.length
    filteredJobs = filteredJobs.filter(job => {
      if (!job.raw) {
        if (job.mapped.job_posted_at) {
          const postedDate = new Date(job.mapped.job_posted_at)
          const maxAge = MAX_JOB_AGE_DAYS * 24 * 60 * 60 * 1000
          return Date.now() - postedDate.getTime() < maxAge
        }
        return true
      }
      return isJobFresh(job.raw, MAX_JOB_AGE_DAYS)
    })
    console.log(`Freshness filter: ${preFreshnessCount} -> ${filteredJobs.length} jobs`)

    // 3. REMOTE TYPE VALIDATION
    if (filters) {
      const preRemoteCount = filteredJobs.length
      filteredJobs = filteredJobs.filter(job => {
        const remoteType = job.mapped.remote_type

        if (filters.remote_jobs && !filters.onsite_hybrid) {
          return remoteType === 'fully_remote'
        }

        if (filters.onsite_hybrid && !filters.remote_jobs) {
          return remoteType === 'hybrid' || remoteType === 'onsite'
        }

        return true
      })
      console.log(`Remote type filter: ${preRemoteCount} -> ${filteredJobs.length} jobs`)
    }

    // 3.5. WORK ARRANGEMENTS FILTER (100% blocking)
    if (filters?.work_arrangements && filters.work_arrangements.length > 0) {
      const preWorkArrCount = filteredJobs.length
      const workArrangements = filters.work_arrangements // capture for closure
      filteredJobs = filteredJobs.filter(job => {
        const remoteType = job.mapped.remote_type

        // Map remote_type to work_arrangement
        // 'fully_remote' -> 'remote_only' or 'remote_ok'
        // 'hybrid' -> 'hybrid'
        // 'onsite' -> 'on_site'
        if (remoteType === 'fully_remote') {
          return workArrangements.includes('remote_only') ||
                 workArrangements.includes('remote_ok')
        }
        if (remoteType === 'hybrid') {
          return workArrangements.includes('hybrid')
        }
        // onsite
        return workArrangements.includes('on_site')
      })
      console.log(`Work arrangements filter: ${preWorkArrCount} -> ${filteredJobs.length} jobs`)
    }

    // 3.6. JOB TYPES FILTER (100% blocking)
    if (filters?.job_types && filters.job_types.length > 0) {
      const preJobTypeCount = filteredJobs.length
      filteredJobs = filteredJobs.filter(job => {
        const jobType = job.mapped.job_type || 'fulltime'
        return filters.job_types.includes(jobType as typeof filters.job_types[number])
      })
      console.log(`Job types filter: ${preJobTypeCount} -> ${filteredJobs.length} jobs`)
    }

    // 4. LOCATION VALIDATION - Strict filtering for both remote AND on-site jobs
    if (filters) {
      const preLocationCount = filteredJobs.length
      const userCountriesList = [
        ...(filters.remote_countries || []),
        ...(filters.onsite_locations || []),
      ]

      // Check if user wants on-site/hybrid work (requires stricter location filtering)
      const wantsOnsiteWork = filters.work_arrangements?.includes('on_site') ||
                              filters.work_arrangements?.includes('hybrid') ||
                              filters.onsite_hybrid === true

      if (userCountriesList.length > 0) {
        let worldwideBypassCount = 0
        let locationMatchCount = 0
        let descriptionMatchCount = 0
        let rejectedCount = 0
        let rejectedWrongCountry = 0

        const countryPatterns = userCountriesList.map(country => {
          const lower = country.toLowerCase()
          if (lower === 'poland' || lower.includes('poland')) return ['poland', 'polish', 'pl', 'polska', 'krakow', 'kraków', 'warsaw', 'warszawa', 'wroclaw', 'gdansk', 'poznan', 'katowice']
          if (lower === 'germany' || lower.includes('germany')) return ['germany', 'german', 'de', 'deutschland', 'berlin', 'munich', 'münchen', 'frankfurt', 'hamburg']
          if (lower === 'uk' || lower === 'united kingdom' || lower.includes('kingdom')) return ['uk', 'united kingdom', 'britain', 'england', 'gb', 'london', 'manchester', 'birmingham']
          if (lower === 'us' || lower === 'usa' || lower === 'united states' || lower.includes('states')) return ['us', 'usa', 'united states', 'america', 'american']
          return [lower]
        }).flat()

        const europeanCountries = ['poland', 'germany', 'france', 'uk', 'united kingdom', 'netherlands',
          'belgium', 'austria', 'switzerland', 'italy', 'spain', 'portugal', 'ireland', 'sweden',
          'denmark', 'norway', 'finland', 'czech', 'hungary', 'romania', 'croatia', 'slovakia']
        const hasEuropeanCountry = userCountriesList.some(c =>
          europeanCountries.some(ec => c.toLowerCase().includes(ec))
        )

        // Build patterns for countries to reject (countries user did NOT select)
        const allCountryPatterns: Array<{ pattern: RegExp; countries: string[] }> = [
          { pattern: /\b(united states|usa|u\.s\.a\.|america|american|florida|california|texas|new york|chicago|los angeles|seattle|boston|denver|austin|orlando|miami)\b/i, countries: ['united states', 'usa', 'us', 'america'] },
          { pattern: /\b(ukraine|ukrainian|kyiv|kiev)\b/i, countries: ['ukraine'] },
          { pattern: /\b(brazil|brazilian|brasil|sao paulo|rio)\b/i, countries: ['brazil', 'brasil'] },
          { pattern: /\b(argentina|argentinian|buenos aires)\b/i, countries: ['argentina'] },
          { pattern: /\b(colombia|colombian|bogota|medellin)\b/i, countries: ['colombia'] },
          { pattern: /\b(lebanon|lebanese|beirut)\b/i, countries: ['lebanon'] },
          { pattern: /\b(mexico|mexican|mexico city|guadalajara)\b/i, countries: ['mexico'] },
          { pattern: /\b(india|indian|bangalore|mumbai|delhi|hyderabad)\b/i, countries: ['india'] },
          { pattern: /\b(philippines|filipino|manila|cebu)\b/i, countries: ['philippines'] },
          { pattern: /\b(canada|canadian|toronto|vancouver|montreal)\b/i, countries: ['canada'] },
          { pattern: /\b(australia|australian|sydney|melbourne|brisbane)\b/i, countries: ['australia'] },
        ]

        // Only reject countries the user did NOT select
        const userCountriesLower = userCountriesList.map(c => c.toLowerCase())
        const excludedCountryPatterns = allCountryPatterns
          .filter(cp => !cp.countries.some(c => userCountriesLower.some(uc => uc.includes(c) || c.includes(uc))))
          .map(cp => cp.pattern)

        filteredJobs = filteredJobs.filter(job => {
          const remoteType = job.mapped.remote_type
          const description = (job.mapped.description || '').toLowerCase()
          const location = (job.mapped.location || '').toLowerCase()
          const title = (job.mapped.title || '').toLowerCase()

          // Check if job explicitly mentions a country the user did NOT select
          const hasExcludedCountry = excludedCountryPatterns.some(pattern =>
            pattern.test(location) || pattern.test(title)
          )

          // For ON-SITE or HYBRID jobs: always reject excluded countries
          // (an on-site job in Florida is useless for someone in Poland)
          if (hasExcludedCountry && (remoteType === 'onsite' || remoteType === 'hybrid')) {
            rejectedWrongCountry++
            return false
          }

          // For ON-SITE or HYBRID jobs, require explicit location match
          if (wantsOnsiteWork && (remoteType === 'onsite' || remoteType === 'hybrid' || !remoteType)) {
            const locationMatches = countryPatterns.some(pattern => {
              const regex = new RegExp(`\\b${pattern}\\b`, 'i')
              return regex.test(location) || regex.test(description.slice(0, 2000))
            })

            if (locationMatches) {
              locationMatchCount++
              return true
            }

            // If user wants on-site and job is on-site but doesn't match location, reject
            if (remoteType === 'onsite' || remoteType === 'hybrid') {
              rejectedCount++
              return false
            }
          }

          // Only include worldwide remote jobs if user explicitly enabled it (default: false)
          const includeWorldwide = filters.include_worldwide_remote === true

          if (includeWorldwide && remoteType === 'fully_remote') {
            const worldwideIndicators = [
              'worldwide', 'work from anywhere', 'global remote', 'anywhere in the world',
              'remote - worldwide', 'remote worldwide', 'fully remote worldwide',
              'location: anywhere', 'location: worldwide', 'remote (anywhere)',
            ]

            if (job.raw && isWorldwideRemote(job.raw)) {
              worldwideBypassCount++
              return true
            }

            if (worldwideIndicators.some(ind =>
              description.includes(ind) || location.includes(ind) || title.includes(ind)
            )) {
              worldwideBypassCount++
              return true
            }

            if (hasEuropeanCountry) {
              const euIndicators = [
                'europe', 'european', 'eu remote', 'emea', 'remote europe', 'remote eu',
                'eu-based', 'european union', 'eu timezone', 'cet', 'cest', 'remote - europe',
              ]
              if (euIndicators.some(ind => description.includes(ind) || location.includes(ind))) {
                worldwideBypassCount++
                return true
              }
            }
          }

          // Check direct location match
          const locationMatches = countryPatterns.some(pattern => {
            const regex = new RegExp(`\\b${pattern}\\b`, 'i')
            return regex.test(location)
          })

          if (locationMatches) {
            locationMatchCount++
            return true
          }

          // For fully remote jobs with remote enabled, check description
          if (remoteType === 'fully_remote' && filters.remote_jobs) {
            const descriptionMentionsCountry = countryPatterns.some(pattern => {
              const regex = new RegExp(`\\b${pattern}\\b`, 'i')
              return regex.test(description)
            })

            if (descriptionMentionsCountry) {
              descriptionMatchCount++
              return true
            }
          }

          rejectedCount++
          return false
        })
        console.log(`Location filter (STRICT): ${preLocationCount} -> ${filteredJobs.length} jobs`)
        console.log(`  - Worldwide remote: ${worldwideBypassCount}`)
        console.log(`  - Location matched: ${locationMatchCount}`)
        console.log(`  - Description mentioned country: ${descriptionMatchCount}`)
        console.log(`  - Rejected (wrong country): ${rejectedWrongCountry}`)
        console.log(`  - Rejected (no match): ${rejectedCount}`)
      }
    }

    // 5. EXCLUDE KEYWORDS FILTER
    if (filters && filters.exclude_keywords && filters.exclude_keywords.length > 0) {
      const preExcludeCount = filteredJobs.length
      const excludeKeywords = filters.exclude_keywords
        .slice(0, 50)
        .map(k => k.toLowerCase().trim().slice(0, 100))
        .filter(k => k.length > 0)

      filteredJobs = filteredJobs.filter(job => {
        const title = (job.mapped.title || '').toLowerCase()
        const description = (job.mapped.description || '').toLowerCase()
        return !excludeKeywords.some(kw => title.includes(kw) || description.includes(kw))
      })
      console.log(`Exclude keywords filter: ${preExcludeCount} -> ${filteredJobs.length} jobs`)
    }

    // 6. EXCLUDE COMPANIES FILTER
    if (filters && filters.exclude_companies && filters.exclude_companies.length > 0) {
      const preExcludeCompCount = filteredJobs.length
      const excludeCompanies = filters.exclude_companies.map(c => c.toLowerCase())
      filteredJobs = filteredJobs.filter(job =>
        !excludeCompanies.some(exc => job.mapped.company?.toLowerCase().includes(exc))
      )
      console.log(`Exclude companies filter: ${preExcludeCompCount} -> ${filteredJobs.length} jobs`)
    }

    // 7. JOB LANGUAGE FILTER (optional - only if user selected languages)
    if (filters?.job_languages && filters.job_languages.length > 0) {
      const preLanguageCount = filteredJobs.length
      filteredJobs = filteredJobs.filter(job => {
        // Get job language from AI field
        const jobLang = (job.raw?.ai_job_language || 'english').toLowerCase()
        // Check if job language matches any of user's selected languages
        return filters.job_languages.some(lang =>
          jobLang.includes(lang.toLowerCase())
        )
      })
      console.log(`Language filter: ${preLanguageCount} -> ${filteredJobs.length} jobs (selected: ${filters.job_languages.join(', ')})`)
    }

    // 8. INDUSTRIES - Changed from HARD filter to SOFT scoring (Jan 2026)
    // Industry is now used in search query and as a scoring boost, not a hard filter
    // This allows users to see all relevant jobs while industry matches rank higher
    // The scoring boost is applied in the AI scoring section below
    if (filters?.industries && filters.industries.length > 0) {
      console.log(`Industry preference (SOFT): ${filters.industries.join(', ')} - will boost matching jobs in scoring`)
    }

    // 9. COMPANY SIZE FILTER (optional - only if user selected sizes)
    if (filters?.company_size && filters.company_size.length > 0) {
      const preSizeCount = filteredJobs.length
      filteredJobs = filteredJobs.filter(job => {
        const employees = job.raw?.linkedin_org_employees
        // Don't filter out jobs without size data (be permissive)
        if (!employees) return true

        const category = getCompanySizeCategory(employees)
        return category ? filters.company_size.includes(category as typeof filters.company_size[number]) : true
      })
      console.log(`Company size filter: ${preSizeCount} -> ${filteredJobs.length} jobs (selected: ${filters.company_size.join(', ')})`)
    }

    // 10. TIME ZONE FILTER (optional - only if user selected timezones)
    if (filters?.time_zones && filters.time_zones.length > 0) {
      const preTimezoneCount = filteredJobs.length
      filteredJobs = filteredJobs.filter(job => {
        // Check for flexible timezone jobs if user opted in
        if (filters.include_flexible_timezone) {
          const desc = job.mapped?.description || ''
          if (hasFlexibleTimezone(desc)) return true
        }

        // Map job's countries to timezones and check overlap
        const jobCountries = job.raw?.countries_derived || []
        const jobTimezones = getJobTimezones(jobCountries)

        // If no country data, don't filter out (be permissive)
        if (jobTimezones.length === 0) return true

        // Check if any job timezone matches user's selected timezones
        return jobTimezones.some(jtz =>
          filters.time_zones.some(utz =>
            jtz.includes(utz.split(' (')[0]) || utz.includes(jtz.split(' (')[0])
          )
        )
      })
      console.log(`Timezone filter: ${preTimezoneCount} -> ${filteredJobs.length} jobs (selected: ${filters.time_zones.length} zones)`)
    }

    // 11. SALARY FILTER
    if (filters?.salary_min || filters?.salary_max) {
      const preSalaryCount = filteredJobs.length
      const userCurrency = (filters.salary_currency || 'USD').toUpperCase()

      filteredJobs = filteredJobs.filter(job => {
        if (!job.mapped.salary_min && !job.mapped.salary_max) {
          return true
        }

        if (filters.salary_min && job.mapped.salary_max) {
          if (job.mapped.salary_max < filters.salary_min) {
            return false
          }
        }

        if (filters.salary_max && job.mapped.salary_min) {
          if (job.mapped.salary_min > filters.salary_max) {
            return false
          }
        }

        return true
      })
      console.log(`Salary filter: ${preSalaryCount} -> ${filteredJobs.length} jobs (user: ${filters.salary_min || 0}-${filters.salary_max || '∞'} ${userCurrency})`)
    }

    // 12. SENIORITY FILTER (post-processing)
    if (filters?.seniority_levels && filters.seniority_levels.length > 0) {
      const preSeniorityCount = filteredJobs.length

      filteredJobs = filteredJobs.filter(job => {
        const title = (job.mapped.title || '').toLowerCase()
        const description = (job.mapped.description || '').toLowerCase().slice(0, 5000)
        const text = `${title} ${description}`

        for (const level of filters.seniority_levels) {
          const keywords = SENIORITY_KEYWORDS[level] || []
          const hasMatch = keywords.some(kw => text.includes(kw.toLowerCase()))
          if (hasMatch) {
            return true
          }
        }

        const hasAnySeniorityKeyword = Object.values(SENIORITY_KEYWORDS)
          .flat()
          .some(kw => text.includes(kw.toLowerCase()))

        return !hasAnySeniorityKeyword
      })
      console.log(`Seniority filter: ${preSeniorityCount} -> ${filteredJobs.length} jobs (levels: ${filters.seniority_levels.join(', ')})`)
    }

    // 13. EASY APPLY FILTER - Only keep jobs from supported ATS platforms
    const preEasyApplyCount = filteredJobs.length
    filteredJobs = filteredJobs.filter(isEasyApplyJob)
    console.log(`Easy Apply filter: ${preEasyApplyCount} -> ${filteredJobs.length} jobs`)

    // Track total jobs found BEFORE quota limiting (for upgrade teaser)
    const totalJobsFoundBeforeQuota = filteredJobs.length

    // Apply quota limit
    const quotaLimitedJobs = filteredJobs.slice(0, quotaStatus.remaining)
    const hiddenJobsCount = Math.max(0, totalJobsFoundBeforeQuota - quotaLimitedJobs.length)
    console.log(`Quota limited: ${filteredJobs.length} -> ${quotaLimitedJobs.length} jobs (remaining: ${quotaStatus.remaining})`)
    if (hiddenJobsCount > 0) {
      console.log(`Hidden jobs (upgrade to view): ${hiddenJobsCount}`)
    }

    // Update quota with actual jobs fetched (using plan-based limits)
    const updatedQuota = await checkAndUpdateQuota(supabase, effectiveUserId, quotaLimitedJobs.length, userPlan)

    // ==========================================================================
    // AI SCORING
    // ==========================================================================

    const AI_BATCH_SIZE = 5
    const jobsWithScores: Array<{
      match_score: number
      match_reasoning: string
      remote_type: RemoteType
      job_posted_at: string | null
      source: string
      [key: string]: unknown
    }> = []

    for (let i = 0; i < quotaLimitedJobs.length; i += AI_BATCH_SIZE) {
      const batch = quotaLimitedJobs.slice(i, i + AI_BATCH_SIZE)

      const batchResults = await Promise.all(
        batch.map(async (unifiedJob) => {
          const mappedJob = unifiedJob.mapped

          let matchScore = 50
          let matchReasoning = 'Upload your CV for personalized job matching'

          const hasCvContent = cvData && (cvData.skills?.length > 0 || cvData.experience?.length > 0)
          const hasScreeningContent = screeningAnswers?.experience_summary || screeningAnswers?.current_job_title

          if (hasCvContent || hasScreeningContent) {
            try {
              const matchResult = await calculateJobMatch(
                mappedJob as Job,
                cvData || { skills: [], experience: [], education: [], summary: '' },
                screeningAnswers || undefined,
                filters ? { job_titles: filters.job_titles, seniority_levels: filters.seniority_levels } : undefined
              )
              matchScore = matchResult.score
              matchReasoning = matchResult.reasoning
              console.log(`AI Score for "${mappedJob.title}" (${unifiedJob.source}): ${matchScore}%`)
            } catch (error) {
              console.error('Error calculating match:', error)
            }
          }

          // Apply soft scoring boosts for industry and job title preferences
          let scoreBoost = 0
          const jobTitle = (mappedJob.title || '').toLowerCase()

          // Industry match boost (+10 points)
          if (filters?.industries && filters.industries.length > 0 && unifiedJob.raw) {
            const industryMatches = matchesIndustry(unifiedJob.raw, filters.industries)
            if (industryMatches) {
              scoreBoost += 10
              console.log(`  +10 industry boost for "${mappedJob.title}"`)
            }
          }

          // Job title match boost (+15 points for exact match, +8 for partial)
          if (filters?.job_titles && filters.job_titles.length > 0) {
            const exactMatch = filters.job_titles.some(t =>
              jobTitle === t.toLowerCase()
            )
            const partialMatch = filters.job_titles.some(t =>
              jobTitle.includes(t.toLowerCase()) || t.toLowerCase().includes(jobTitle)
            )
            if (exactMatch) {
              scoreBoost += 15
              console.log(`  +15 exact title boost for "${mappedJob.title}"`)
            } else if (partialMatch) {
              scoreBoost += 8
              console.log(`  +8 partial title boost for "${mappedJob.title}"`)
            }
          }

          // Apply boost (cap at 100)
          matchScore = Math.min(100, matchScore + scoreBoost)

          return {
            ...mappedJob,
            match_score: matchScore,
            match_reasoning: matchReasoning,
            remote_type: mappedJob.remote_type as RemoteType,
            job_posted_at: mappedJob.job_posted_at || null,
            source: unifiedJob.source,
          }
        })
      )

      jobsWithScores.push(...batchResults)
    }

    // Sort by match score
    jobsWithScores.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))

    // Apply match threshold filter
    let finalJobs = jobsWithScores
    const hasProfileData = (cvData && (cvData.skills?.length > 0 || cvData.experience?.length > 0)) ||
                           (screeningAnswers?.experience_summary || screeningAnswers?.current_job_title)
    if (filters?.match_threshold && hasProfileData) {
      const minScore = MATCH_THRESHOLD_MAP[filters.match_threshold] ?? 35
      const preThresholdCount = finalJobs.length
      if (minScore > 0) {
        const filteredByThreshold = jobsWithScores.filter(job => (job.match_score || 0) >= minScore)
        if (filteredByThreshold.length === 0 && jobsWithScores.length > 0) {
          console.log(`Match threshold filter: 0 jobs passed. Falling back to top ${Math.min(5, jobsWithScores.length)} by score.`)
          finalJobs = jobsWithScores.slice(0, 5)
        } else {
          finalJobs = filteredByThreshold
        }
      }
      console.log(`Match threshold filter (${filters.match_threshold}): ${preThresholdCount} -> ${finalJobs.length} jobs (min: ${minScore}%)`)
    } else if (!hasProfileData) {
      console.log('Match threshold filter: SKIPPED (no profile data - all jobs shown)')
    }

    console.log(`Final job count: ${finalJobs.length}`)

    // ==========================================================================
    // PREFERENCE SCORING (Pro/Ultra only)
    // ==========================================================================

    let preferenceScoredJobs = finalJobs
    let preferenceStats = {
      enabled: false,
      confidence: 'none' as string,
      diversityCount: 0,
    }

    if (canUseAILearning) {
      try {
        // Check if user has use_for_recommendations enabled
        const { data: learningSettings } = await supabase
          .from('user_learning_settings')
          .select('use_for_recommendations')
          .eq('user_id', effectiveUserId)
          .single()

        // Default to true if no settings exist
        if (learningSettings?.use_for_recommendations === false) {
          console.log('Preference scoring: SKIPPED (disabled in user settings)')
        } else {
          // Fetch user's learned preferences and merge with explicit filter preferences
          const learnedPreferences = await getUserLearnedPreferences(effectiveUserId)
          const mergedPreferences = mergeExplicitWithLearnedPreferences(learnedPreferences, filters)

        if (mergedPreferences && mergedPreferences.confidence_level !== 'none') {
          console.log(`=== Applying Preference Scoring (confidence: ${mergedPreferences.confidence_level}) ===`)
          preferenceStats.enabled = true
          preferenceStats.confidence = mergedPreferences.confidence_level

          // Apply preference scoring to each job
          const scoredWithPreferences = await Promise.all(
            finalJobs.map(async (job) => {
              const { finalScore, reasons, preferenceInfluence } = await computeFinalJobScore(
                job as unknown as Job,
                job.match_score || 50,
                mergedPreferences
              )
              return {
                ...job,
                enhanced_score: finalScore,
                preference_reasons: reasons,
                preference_influence: preferenceInfluence,
              }
            })
          )

          // Sort by enhanced score instead of match score
          scoredWithPreferences.sort((a, b) => (b.enhanced_score || 0) - (a.enhanced_score || 0))

          // Inject diversity to prevent filter bubbles (20% exploration jobs)
          const jobsAsJobs = finalJobs.map(j => j as unknown as Job)
          const scoredAsJobs = scoredWithPreferences as unknown as Array<Job & { enhanced_score?: number; preference_reasons?: string[] }>
          const diverseJobs = injectDiversity(scoredAsJobs, jobsAsJobs)

          // Count exploration jobs
          const explorationCount = diverseJobs.filter(j => j.is_exploration).length
          preferenceStats.diversityCount = explorationCount

          // Map back to the expected type
          preferenceScoredJobs = diverseJobs.map(j => ({
            ...j,
            match_score: (j as { enhanced_score?: number }).enhanced_score || j.match_score || 50,
          })) as unknown as typeof finalJobs

          console.log(`Preference scoring applied: ${scoredWithPreferences.length} scored, ${explorationCount} exploration jobs`)
        } else {
          console.log('Preference scoring: SKIPPED (no preferences or low confidence)')
        }
        } // Close use_for_recommendations check
      } catch (prefError) {
        console.error('Preference scoring error:', prefError)
        // Continue without preference scoring on error
      }
    } else {
      console.log('Preference scoring: SKIPPED (requires Pro/Ultra plan)')
    }

    // Use preference-scored jobs for saving
    // IMPORTANT: Deduplicate by application_url WITHIN the batch to prevent duplicates
    const urlSeenInBatch = new Set<string>()
    const jobsToSave = preferenceScoredJobs.filter(job => {
      const url = job.application_url as string
      if (!url) return true // Keep jobs without URL
      if (urlSeenInBatch.has(url)) {
        console.log(`Skipping duplicate in batch: ${job.title} (same URL)`)
        return false
      }
      urlSeenInBatch.add(url)
      return true
    })

    console.log(`Deduplicated batch: ${preferenceScoredJobs.length} -> ${jobsToSave.length} jobs`)

    // ==========================================================================
    // SAVE TO DATABASE
    // ==========================================================================

    const jobsBySource = new Map<string, typeof jobsToSave>()
    for (const job of jobsToSave) {
      const source = job.source as string
      if (!jobsBySource.has(source)) {
        jobsBySource.set(source, [])
      }
      jobsBySource.get(source)!.push(job)
    }

    console.log(`Processing ${jobsToSave.length} jobs across sources:`, Array.from(jobsBySource.keys()).join(', '))

    const allExternalIds = jobsToSave.map(job => job.external_id).filter(Boolean) as string[]
    const allApplicationUrls = jobsToSave.map(job => job.application_url).filter(Boolean) as string[]

    // Check for existing jobs by external_id OR application_url to prevent duplicates
    // Use separate queries to avoid SQL injection via string interpolation
    const existingJobMap = new Map<string, string>()
    const existingUrlMap = new Map<string, string>()

    // Query by external_ids (using Supabase's .in() which properly escapes values)
    if (allExternalIds.length > 0) {
      const { data: existingByExternalId } = await supabase
        .from('jobs')
        .select('external_id, source, status, application_url')
        .eq('user_id', effectiveUserId)
        .in('external_id', allExternalIds)

      for (const j of existingByExternalId || []) {
        existingJobMap.set(`${j.source}:${j.external_id}`, j.status)
        if (j.application_url) {
          existingUrlMap.set(j.application_url, j.status)
        }
      }
    }

    // Query by application_urls (using Supabase's .in() which properly escapes values)
    if (allApplicationUrls.length > 0) {
      const { data: existingByUrl } = await supabase
        .from('jobs')
        .select('external_id, source, status, application_url')
        .eq('user_id', effectiveUserId)
        .in('application_url', allApplicationUrls)

      for (const j of existingByUrl || []) {
        if (!existingJobMap.has(`${j.source}:${j.external_id}`)) {
          existingJobMap.set(`${j.source}:${j.external_id}`, j.status)
        }
        if (j.application_url && !existingUrlMap.has(j.application_url)) {
          existingUrlMap.set(j.application_url, j.status)
        }
      }
    }

    console.log(`Duplicate check: found ${existingJobMap.size} existing jobs (${existingUrlMap.size} unique URLs)`)

    for (const job of jobsToSave) {
      const source = job.source as string
      const externalId = job.external_id as string
      const applicationUrl = job.application_url as string
      const mapKey = `${source}:${externalId}`
      const existingStatus = existingJobMap.get(mapKey) || existingUrlMap.get(applicationUrl)

      // Skip jobs that user has already applied to or discarded - never re-add these
      if (existingStatus === 'applied' || existingStatus === 'discarded') {
        console.log(`Skipping duplicate job (${existingStatus}): ${job.title}`)
        continue
      }

      // Also skip if we already have a job with this URL (stronger duplicate prevention)
      if (applicationUrl && existingUrlMap.has(applicationUrl)) {
        console.log(`Skipping duplicate job (same URL exists): ${job.title}`)
        continue
      }

      if (!existingStatus) {
        const hasApplicationUrl = !!job.application_url
        const platform = hasApplicationUrl ? detectPlatform(job.application_url as string) : 'unknown'

        // Extract only valid database columns (exclude preference scoring fields)
        const {
          enhanced_score: _enhanced,
          preference_reasons: _prefReasons,
          preference_influence: _prefInfluence,
          is_exploration: _isExploration,
          ...jobDataForDb
        } = job as typeof job & {
          enhanced_score?: number
          preference_reasons?: string[]
          preference_influence?: number
          is_exploration?: boolean
        }

        // All jobs are manual apply now (no auto-apply)
        const { error: insertError } = await supabase.from('jobs').insert({
          ...jobDataForDb,
          match_reasoning: undefined,
          platform_detected: platform,
          auto_apply_status: 'manual',
        })

        if (insertError) {
          console.error('Insert error:', insertError)
        }
      } else if (existingStatus === 'discovered') {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            match_score: job.match_score,
            description: job.description,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
          })
          .eq('user_id', effectiveUserId)
          .eq('external_id', externalId)
          .eq('source', source)
        if (updateError) {
          console.error('Update error:', updateError)
        }
      }
    }

    // Query back saved jobs
    const { data: savedJobs, error: queryError } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', effectiveUserId)
      .in('external_id', allExternalIds)
      .eq('status', 'discovered')

    if (queryError) {
      console.error('Query error:', queryError)
    }
    console.log(`Retrieved ${savedJobs?.length || 0} discovered jobs from database`)

    const jobsWithCorrectIds = (savedJobs || []).map(savedJob => {
      const matchedJob = jobsToSave.find(j =>
        j.external_id === savedJob.external_id && j.source === savedJob.source
      ) as { match_score?: number; match_reasoning?: string; preference_reasons?: string[]; is_exploration?: boolean } | undefined
      return {
        ...savedJob,
        match_score: matchedJob?.match_score ?? savedJob.match_score,
        match_reasoning: matchedJob?.match_reasoning,
        preference_reasons: matchedJob?.preference_reasons || [],
        is_exploration: matchedJob?.is_exploration || false,
      }
    }).sort((a, b) => (b.match_score || 0) - (a.match_score || 0))

    const sourceStats: Record<string, number> = {}
    for (const job of jobsWithCorrectIds) {
      sourceStats[job.source] = (sourceStats[job.source] || 0) + 1
    }

    console.log(`Returning ${jobsWithCorrectIds.length} jobs to frontend`)
    console.log('Jobs by source:', sourceStats)

    // Build upgrade teaser for free users with hidden jobs
    const upgradeTeaser = hiddenJobsCount > 0 ? {
      hidden_jobs_count: hiddenJobsCount,
      message: `Found ${hiddenJobsCount} more job${hiddenJobsCount === 1 ? '' : 's'} matching your criteria. Upgrade to Pro to view all jobs.`,
      total_found: totalJobsFoundBeforeQuota,
      shown: jobsWithCorrectIds.length,
    } : null

    // Save upgrade teaser to profile for display on dashboard load
    if (upgradeTeaser) {
      await supabase
        .from('profiles')
        .update({ upgrade_teaser: upgradeTeaser })
        .eq('id', effectiveUserId)
      console.log('Saved upgrade teaser to profile:', upgradeTeaser)
    } else {
      // Clear the teaser if no hidden jobs
      await supabase
        .from('profiles')
        .update({ upgrade_teaser: null })
        .eq('id', effectiveUserId)
    }

    return NextResponse.json({
      jobs: jobsWithCorrectIds,
      total: jobsWithCorrectIds.length,
      cv_uploaded: hasProfileData,
      quota: {
        remaining: updatedQuota.remaining,
        limit: updatedQuota.limit,
        jobs_fetched_today: updatedQuota.jobsFetched,
      },
      // Show upgrade teaser for free users when more jobs are available
      upgrade_teaser: upgradeTeaser,
      filters_applied: useProfileFilters && filters ? {
        job_titles: filters.job_titles,
        industries: filters.industries,
        work_arrangements: filters.work_arrangements,
        remote: filters.remote_jobs,
        onsite: filters.onsite_hybrid,
        remote_countries: filters.remote_countries,
        onsite_locations: filters.onsite_locations,
        match_threshold: filters.match_threshold,
      } : null,
      ai_queries: searchQueries ? {
        primary: searchQueries.primary,
        skillBased: searchQueries.skillBased,
        seniorityVariants: searchQueries.seniorityVariants,
        industrySpecific: searchQueries.industrySpecific,
        reasoning: searchQueries.metadata.reasoning,
        cached: !!searchQueries.metadata.profileHash && searchQueries.metadata.profileHash !== 'fallback',
      } : null,
      validation_stats: {
        total_fetched: uniqueJobs.length,
        after_filtering: filteredJobs.length,
        final_count: jobsToSave.length,
        sources: sourceStats,
        errors: searchErrors.length > 0 ? searchErrors : undefined,
      },
      preference_scoring: preferenceStats.enabled ? {
        enabled: true,
        confidence: preferenceStats.confidence,
        exploration_jobs: preferenceStats.diversityCount,
      } : {
        enabled: false,
        reason: canUseAILearning ? 'No learned preferences yet' : 'Requires Pro/Ultra plan',
      },
    })
  } catch (error) {
    console.error('Job search error:', error)
    return NextResponse.json(
      { error: 'Failed to search jobs' },
      { status: 500 }
    )
  }
}
