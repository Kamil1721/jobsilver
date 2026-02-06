/**
 * Preference Scoring Module
 *
 * Scores jobs based on learned user preferences from their interaction history.
 * Integrates with the CV match score for enhanced personalization.
 */

import type { Job, UserPreferences, ConfidenceLevel, JobFilters } from '@/lib/supabase/types'

// Type alias for backwards compatibility
type UserLearnedPreferences = UserPreferences

// ============================================
// TYPES
// ============================================

export interface PreferenceScoreResult {
  score: number // 0-1 scale
  reasons: string[] // Human-readable explanations
  breakdown: {
    industryMatch: number // 0-1
    salaryMatch: number // 0-1
    remoteMatch: number // 0-1
    keywordMatch: number // 0-1
    companyMatch: number // 0-1
  }
}

export interface FinalScoreResult {
  finalScore: number
  reasons: string[]
  isExploration?: boolean
  preferenceInfluence: number
}

// ============================================
// CONSTANTS
// ============================================

// Confidence level to influence factor mapping
// Higher confidence = more weight given to preferences
const CONFIDENCE_INFLUENCE: Record<ConfidenceLevel, number> = {
  none: 0,
  low: 0.2,
  medium: 0.5,
  high: 0.8,
}

// Default weights for each preference category (soft preferences for ranking)
const CATEGORY_WEIGHTS = {
  industry: 0.18,      // Soft - boost matching industries
  salary: 0.18,        // Soft - boost matching salary
  remote: 0.14,        // Soft - rank remote types (within allowed)
  keyword: 0.14,       // Soft - boost include_keywords matches
  company: 0.10,       // Soft - boost preferred companies
  companySize: 0.10,   // Soft - boost matching sizes
  seniority: 0.08,     // Soft - boost matching seniority
  location: 0.08,      // Soft - boost preferred locations
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
}

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Score how well a job's industry matches user preferences
 * preferred_industries is Record<string, number> where higher numbers = more preferred
 */
function scoreIndustryMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const preferredIndustries = preferences.preferred_industries || {}
  const industryKeys = Object.keys(preferredIndustries)
  if (industryKeys.length === 0) {
    return { score: 0.5, reason: null } // Neutral if no preference
  }

  const jobIndustry = job.industry_category?.toLowerCase() || ''
  const jobDescription = (job.description || '').toLowerCase()
  const jobTitle = (job.title || '').toLowerCase()
  const combinedText = `${jobIndustry} ${jobTitle} ${jobDescription}`

  // Find best matching industry and its score
  let bestMatch = { industry: '', weight: 0 }
  for (const industry of industryKeys) {
    const industryLower = industry.toLowerCase()
    if (combinedText.includes(industryLower)) {
      const weight = preferredIndustries[industry] || 0
      if (weight > bestMatch.weight) {
        bestMatch = { industry, weight }
      }
    }
  }

  if (bestMatch.weight > 0) {
    // Scale weight to 0-1 score (assuming weights are 0-1 or normalize if higher)
    const normalizedWeight = Math.min(1, bestMatch.weight)
    return {
      score: 0.5 + normalizedWeight * 0.45, // 0.5-0.95 range
      reason: `Matches preferred industry: ${bestMatch.industry}`,
    }
  }

  // Partial match through keywords
  let partialMatchScore = 0
  let partialMatchIndustry = ''
  for (const industry of industryKeys) {
    const keywords = industry.toLowerCase().split(/\s+/)
    const matchedKeywords = keywords.filter(kw => combinedText.includes(kw))
    if (matchedKeywords.length > 0) {
      const keywordScore = matchedKeywords.length / keywords.length
      if (keywordScore > partialMatchScore) {
        partialMatchScore = keywordScore
        partialMatchIndustry = industry
      }
    }
  }

  if (partialMatchScore > 0.5) {
    return {
      score: 0.5 + partialMatchScore * 0.2,
      reason: `Partial match: ${partialMatchIndustry}`,
    }
  }

  return { score: 0.4, reason: null }
}

/**
 * Score how well a job's salary matches user preferences
 */
function scoreSalaryMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const prefMin = preferences.preferred_salary_min
  const prefMax = preferences.preferred_salary_max

  // If no salary preferences or job doesn't have salary, return neutral
  if ((prefMin === null && prefMax === null) || (!job.salary_min && !job.salary_max)) {
    return { score: 0.5, reason: null }
  }

  // Use job's salary range midpoint for comparison
  const jobSalaryMid = (job.salary_min || 0) + (job.salary_max || job.salary_min || 0)
  const jobSalary = jobSalaryMid / 2 || job.salary_min || job.salary_max || 0

  // Calculate how well the job salary fits the preference range
  if (prefMin !== null && prefMax !== null) {
    const prefMid = (prefMin + prefMax) / 2
    const prefRange = prefMax - prefMin

    if (jobSalary >= prefMin && jobSalary <= prefMax) {
      // Perfect fit within range
      return {
        score: 0.95,
        reason: 'Salary within preferred range',
      }
    } else if (jobSalary > prefMax) {
      // Above preferred - might still be good
      const overshoot = (jobSalary - prefMax) / prefRange
      if (overshoot < 0.3) {
        return {
          score: 0.8,
          reason: 'Salary above preferred range',
        }
      }
      return { score: 0.6, reason: null }
    } else {
      // Below preferred
      const undershoot = (prefMin - jobSalary) / prefRange
      if (undershoot < 0.2) {
        return {
          score: 0.7,
          reason: 'Salary slightly below preferred',
        }
      } else if (undershoot < 0.5) {
        return {
          score: 0.4,
          reason: 'Salary below preferred range',
        }
      }
      return {
        score: 0.2,
        reason: 'Salary significantly below preference',
      }
    }
  }

  // Only min preference
  if (prefMin !== null) {
    if (jobSalary >= prefMin) {
      return {
        score: 0.9,
        reason: 'Salary meets minimum preference',
      }
    }
    const shortfall = (prefMin - jobSalary) / prefMin
    return {
      score: Math.max(0.2, 0.8 - shortfall),
      reason: shortfall > 0.2 ? 'Salary below minimum preference' : null,
    }
  }

  return { score: 0.5, reason: null }
}

/**
 * Score how well a job's remote policy matches user preferences
 * remote_preference is Record<string, number> with keys like 'fully_remote', 'hybrid', 'onsite'
 */
function scoreRemoteMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const remotePref = preferences.remote_preference || {}

  if (Object.keys(remotePref).length === 0) {
    return { score: 0.5, reason: null }
  }

  // Determine job's remote type
  let jobRemoteType: string
  if (job.remote_type === 'fully_remote') {
    jobRemoteType = 'fully_remote'
  } else if (job.remote_type === 'hybrid') {
    jobRemoteType = 'hybrid'
  } else {
    jobRemoteType = 'onsite'
  }

  // Get the preference weight for this job's remote type
  const prefWeight = remotePref[jobRemoteType] ?? 0

  // Normalize to 0-1 (assuming weights can be positive or negative)
  // Higher weight = more preferred
  const maxWeight = Math.max(...Object.values(remotePref), 0)
  const minWeight = Math.min(...Object.values(remotePref), 0)

  if (maxWeight === minWeight) {
    return { score: 0.5, reason: null }
  }

  const normalizedScore = (prefWeight - minWeight) / (maxWeight - minWeight)

  // Generate reason based on preference strength
  let reason: string | null = null
  if (normalizedScore > 0.8) {
    reason = `Matches ${jobRemoteType.replace('_', ' ')} preference`
  } else if (normalizedScore < 0.3) {
    const bestType = Object.entries(remotePref)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'remote'
    reason = `Prefers ${bestType.replace('_', ' ')} work`
  }

  return { score: 0.3 + normalizedScore * 0.6, reason } // Score range 0.3-0.9
}

/**
 * Score how well job keywords match user's keyword weights
 * keyword_weights is Record<string, number> where positive = preferred, negative = avoided
 */
function scoreKeywordMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const weights = preferences.keyword_weights || {}
  const keywordKeys = Object.keys(weights)

  if (keywordKeys.length === 0) {
    return { score: 0.5, reason: null }
  }

  const jobText = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase()
  const jobKeywords = new Set(extractKeywords(jobText))

  let positiveScore = 0
  let negativeScore = 0
  let positiveMatches: string[] = []
  let negativeMatches: string[] = []

  for (const keyword of keywordKeys) {
    const weight = weights[keyword] as number
    if (jobKeywords.has(keyword.toLowerCase()) || jobText.includes(keyword.toLowerCase())) {
      if (weight > 0) {
        positiveScore += weight
        positiveMatches.push(keyword)
      } else if (weight < 0) {
        negativeScore += Math.abs(weight)
        negativeMatches.push(keyword)
      }
    }
  }

  // Normalize scores
  const maxPossiblePositive = keywordKeys.filter(k => (weights[k] as number) > 0).length
  const maxPossibleNegative = keywordKeys.filter(k => (weights[k] as number) < 0).length

  const normalizedPositive = maxPossiblePositive > 0 ? positiveScore / maxPossiblePositive : 0
  const normalizedNegative = maxPossibleNegative > 0 ? negativeScore / maxPossibleNegative : 0

  // Net score: positive matches boost, negative matches reduce
  const netScore = 0.5 + normalizedPositive * 0.4 - normalizedNegative * 0.4
  const finalScore = Math.max(0, Math.min(1, netScore))

  let reason: string | null = null
  if (positiveMatches.length > 0 && negativeMatches.length === 0) {
    reason = `Contains preferred keywords: ${positiveMatches.slice(0, 3).join(', ')}`
  } else if (negativeMatches.length > 0 && positiveMatches.length === 0) {
    reason = `Contains avoided keywords: ${negativeMatches.slice(0, 3).join(', ')}`
  } else if (positiveMatches.length > 0 && negativeMatches.length > 0) {
    reason = 'Mixed keyword match'
  }

  return { score: finalScore, reason }
}

/**
 * Score how well a job's company matches user preferences
 * preferred_companies is Record<string, number>, avoided_companies is string[]
 */
function scoreCompanyMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const preferredCompanies = preferences.preferred_companies || {}
  const avoidedCompanies = preferences.avoided_companies || []
  const preferredKeys = Object.keys(preferredCompanies)

  if (preferredKeys.length === 0 && avoidedCompanies.length === 0) {
    return { score: 0.5, reason: null }
  }

  const jobCompany = (job.company || '').toLowerCase()

  // Check avoided companies first
  for (const avoided of avoidedCompanies) {
    if (jobCompany.includes(avoided.toLowerCase())) {
      return {
        score: 0.1,
        reason: `Company typically avoided: ${job.company}`,
      }
    }
  }

  // Check preferred companies with weights
  for (const preferred of preferredKeys) {
    if (jobCompany.includes(preferred.toLowerCase())) {
      const weight = preferredCompanies[preferred] || 0
      // Scale weight to 0.7-0.95 range
      const normalizedScore = 0.7 + Math.min(1, Math.max(0, weight)) * 0.25
      return {
        score: normalizedScore,
        reason: `Preferred company: ${job.company}`,
      }
    }
  }

  return { score: 0.5, reason: null }
}

/**
 * Score how well a job's company size matches user preferences
 * preferred_company_sizes is Record<string, number> where higher numbers = more preferred
 */
function scoreCompanySizeMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const preferredSizes = preferences.preferred_company_sizes || {}
  const sizeKeys = Object.keys(preferredSizes)

  if (sizeKeys.length === 0) {
    return { score: 0.5, reason: null } // Neutral if no preference
  }

  // Get job's company size - use industry_category or extract from description
  const jobCompanySize = (job as Job & { company_size?: string }).company_size?.toLowerCase()
  const description = (job.description || '').toLowerCase()

  // Size categories mapping
  const sizePatterns: Record<string, string[]> = {
    'startup': ['startup', '1-10', '1-50', 'early stage', 'seed', 'series a'],
    'small': ['small', '11-50', '50-200', 'sme', 'small company'],
    'medium': ['medium', '201-500', '500-1000', 'mid-size', 'mid size'],
    'large': ['large', '1001-5000', '5000+', 'enterprise', 'fortune', 'multinational'],
  }

  // Try to detect job's company size
  let detectedSize: string | null = null
  for (const [size, patterns] of Object.entries(sizePatterns)) {
    if (jobCompanySize && patterns.some(p => jobCompanySize.includes(p))) {
      detectedSize = size
      break
    }
    if (patterns.some(p => description.includes(p))) {
      detectedSize = size
      break
    }
  }

  // If we couldn't detect size, return neutral
  if (!detectedSize) {
    return { score: 0.5, reason: null }
  }

  // Check if detected size matches preferences
  for (const preferredSize of sizeKeys) {
    if (detectedSize === preferredSize.toLowerCase() ||
        preferredSize.toLowerCase().includes(detectedSize)) {
      const weight = preferredSizes[preferredSize] || 0
      const normalizedWeight = Math.min(1, weight)
      return {
        score: 0.5 + normalizedWeight * 0.45,
        reason: `Matches preferred company size: ${preferredSize}`,
      }
    }
  }

  return { score: 0.4, reason: null }
}

/**
 * Score how well a job's seniority matches user preferences
 * Uses job title keywords to detect seniority
 */
function scoreSeniorityMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  // Get preferred job types which may contain seniority info
  const preferredJobTypes = preferences.preferred_job_types || {}
  const typeKeys = Object.keys(preferredJobTypes)

  if (typeKeys.length === 0) {
    return { score: 0.5, reason: null }
  }

  const jobTitle = (job.title || '').toLowerCase()
  const description = (job.description || '').toLowerCase().slice(0, 3000)

  // Seniority detection patterns
  const seniorityPatterns: Record<string, string[]> = {
    'entry': ['entry level', 'entry-level', 'junior', 'graduate', 'trainee', 'intern', 'associate'],
    'mid': ['mid-level', 'mid level', 'intermediate', '2-5 years', '3-5 years'],
    'senior': ['senior', 'sr.', 'sr ', 'lead', 'principal', 'staff', '5+ years', '7+ years'],
    'director': ['director', 'head of', 'vp', 'vice president', 'chief', 'executive', 'manager'],
  }

  // Detect job's seniority
  let detectedSeniority: string | null = null
  for (const [level, patterns] of Object.entries(seniorityPatterns)) {
    if (patterns.some(p => jobTitle.includes(p) || description.includes(p))) {
      detectedSeniority = level
      break
    }
  }

  if (!detectedSeniority) {
    return { score: 0.5, reason: null }
  }

  // Check if detected seniority matches preferences
  for (const preferredType of typeKeys) {
    const lowerType = preferredType.toLowerCase()
    if (lowerType.includes(detectedSeniority) ||
        detectedSeniority.includes(lowerType.split('-')[0])) {
      const weight = preferredJobTypes[preferredType] || 0
      const normalizedWeight = Math.min(1, weight)
      return {
        score: 0.5 + normalizedWeight * 0.4,
        reason: `Matches preferred seniority: ${detectedSeniority}`,
      }
    }
  }

  return { score: 0.45, reason: null }
}

/**
 * Score how well a job's location matches user preferred locations
 * preferred_locations is Record<string, number>
 */
function scoreLocationMatch(
  job: Job,
  preferences: UserLearnedPreferences
): { score: number; reason: string | null } {
  const preferredLocations = preferences.preferred_locations || {}
  const locationKeys = Object.keys(preferredLocations)

  if (locationKeys.length === 0) {
    return { score: 0.5, reason: null }
  }

  const jobLocation = (job.location || '').toLowerCase()
  const isRemote = job.remote_type === 'fully_remote'

  // Check for location matches
  for (const location of locationKeys) {
    const locationLower = location.toLowerCase()
    if (jobLocation.includes(locationLower) ||
        locationLower.includes(jobLocation.split(',')[0])) {
      const weight = preferredLocations[location] || 0
      const normalizedWeight = Math.min(1, weight)
      return {
        score: 0.5 + normalizedWeight * 0.45,
        reason: `Matches preferred location: ${location}`,
      }
    }
  }

  // Remote jobs get neutral score if no specific location preference matched
  if (isRemote) {
    return { score: 0.5, reason: null }
  }

  return { score: 0.4, reason: null }
}

// ============================================
// MAIN SCORING FUNCTIONS
// ============================================

/**
 * Compute a preference-based score for a job
 *
 * @param job - The job to score
 * @param preferences - User's learned preferences
 * @returns PreferenceScoreResult with overall score, reasons, and breakdown
 */
export async function computePreferenceScore(
  job: Job,
  preferences: UserLearnedPreferences
): Promise<PreferenceScoreResult> {
  const industryResult = scoreIndustryMatch(job, preferences)
  const salaryResult = scoreSalaryMatch(job, preferences)
  const remoteResult = scoreRemoteMatch(job, preferences)
  const keywordResult = scoreKeywordMatch(job, preferences)
  const companyResult = scoreCompanyMatch(job, preferences)
  const companySizeResult = scoreCompanySizeMatch(job, preferences)
  const seniorityResult = scoreSeniorityMatch(job, preferences)
  const locationResult = scoreLocationMatch(job, preferences)

  // Calculate weighted score with all categories
  const weightedScore =
    industryResult.score * CATEGORY_WEIGHTS.industry +
    salaryResult.score * CATEGORY_WEIGHTS.salary +
    remoteResult.score * CATEGORY_WEIGHTS.remote +
    keywordResult.score * CATEGORY_WEIGHTS.keyword +
    companyResult.score * CATEGORY_WEIGHTS.company +
    companySizeResult.score * CATEGORY_WEIGHTS.companySize +
    seniorityResult.score * CATEGORY_WEIGHTS.seniority +
    locationResult.score * CATEGORY_WEIGHTS.location

  // Collect non-null reasons
  const reasons: string[] = []
  if (industryResult.reason) reasons.push(industryResult.reason)
  if (salaryResult.reason) reasons.push(salaryResult.reason)
  if (remoteResult.reason) reasons.push(remoteResult.reason)
  if (keywordResult.reason) reasons.push(keywordResult.reason)
  if (companyResult.reason) reasons.push(companyResult.reason)
  if (companySizeResult.reason) reasons.push(companySizeResult.reason)
  if (seniorityResult.reason) reasons.push(seniorityResult.reason)
  if (locationResult.reason) reasons.push(locationResult.reason)

  return {
    score: weightedScore,
    reasons,
    breakdown: {
      industryMatch: industryResult.score,
      salaryMatch: salaryResult.score,
      remoteMatch: remoteResult.score,
      keywordMatch: keywordResult.score,
      companyMatch: companyResult.score,
    },
  }
}

/**
 * Compute the final job score combining CV match and preference scores
 *
 * @param job - The job to score
 * @param cvMatchScore - CV-based match score (0-100)
 * @param preferences - User's learned preferences (or null if not available)
 * @returns FinalScoreResult with combined score and explanations
 */
export async function computeFinalJobScore(
  job: Job,
  cvMatchScore: number,
  preferences: UserLearnedPreferences | null
): Promise<FinalScoreResult> {
  // If no preferences or confidence is 'none', return CV score unchanged
  if (!preferences || preferences.confidence_level === 'none') {
    return {
      finalScore: cvMatchScore,
      reasons: [],
      preferenceInfluence: 0,
    }
  }

  // Get influence factor based on confidence level
  const influence = CONFIDENCE_INFLUENCE[preferences.confidence_level]

  // Compute preference score
  const prefResult = await computePreferenceScore(job, preferences)

  // Convert preference score (0-1) to 0-100 scale
  const prefScore100 = prefResult.score * 100

  // Blend scores: finalScore = cvMatch * (1 - influence) + prefScore * influence
  const finalScore = Math.round(cvMatchScore * (1 - influence) + prefScore100 * influence)

  return {
    finalScore,
    reasons: prefResult.reasons,
    preferenceInfluence: influence,
  }
}

// ============================================
// DIVERSITY INJECTION
// ============================================

const DIVERSITY_PERCENT = 0.2

/**
 * Inject diversity into job results to prevent filter bubbles
 *
 * Takes the top personalized jobs and mixes in some "exploration" jobs
 * that have good CV match but may differ from learned preferences.
 *
 * @param scoredJobs - Jobs sorted by enhanced preference score
 * @param allJobs - All available jobs (before preference scoring)
 * @returns Mixed array with personalized jobs + exploration jobs
 */
export function injectDiversity(
  scoredJobs: Array<Job & { enhanced_score?: number; preference_reasons?: string[] }>,
  allJobs: Job[]
): Array<Job & { enhanced_score?: number; preference_reasons?: string[]; is_exploration?: boolean }> {
  if (scoredJobs.length === 0) return []

  const personalizedCount = Math.floor(scoredJobs.length * (1 - DIVERSITY_PERCENT))
  const diversityCount = scoredJobs.length - personalizedCount

  // Take top personalized jobs
  const personalized = scoredJobs.slice(0, personalizedCount)

  // Get IDs of personalized jobs
  const personalizedIds = new Set(personalized.map(j => j.id))

  // Find exploration candidates:
  // - Good CV match (> 50)
  // - Not in personalized set
  // - Shuffled for variety
  const exploreCandidates = allJobs
    .filter(j => (j.match_score || 0) > 50)
    .filter(j => !personalizedIds.has(j.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, diversityCount)
    .map(j => ({
      ...j,
      enhanced_score: j.match_score || 50,
      is_exploration: true,
      preference_reasons: ['Exploration: discover different opportunities'],
    }))

  // Combine personalized + exploration
  return [...personalized, ...exploreCandidates]
}

// ============================================
// PREFERENCE DATA ACCESS
// ============================================

import { createClient } from '@/lib/supabase/server'

/**
 * Fetch user's learned preferences from the database
 *
 * @param userId - User ID to fetch preferences for
 * @returns UserLearnedPreferences or null if not found
 */
export async function getUserLearnedPreferences(
  userId: string
): Promise<UserLearnedPreferences | null> {
  const supabase = await createClient()

  // Query from user_ai_preferences table (matches UserPreferences type)
  const { data, error } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.log(`No learned preferences found for user ${userId}`)
    return null
  }

  // Map database row to interface (UserPreferences type)
  return {
    id: data.id,
    user_id: data.user_id,
    confidence_level: (data.confidence_level || 'none') as ConfidenceLevel,
    preferred_industries: (data.preferred_industries as Record<string, number>) || {},
    preferred_company_sizes: (data.preferred_company_sizes as Record<string, number>) || {},
    preferred_job_types: (data.preferred_job_types as Record<string, number>) || {},
    remote_preference: (data.remote_preference as Record<string, number>) || {},
    preferred_salary_min: data.preferred_salary_min,
    preferred_salary_max: data.preferred_salary_max,
    salary_currency: data.salary_currency,
    keyword_weights: (data.keyword_weights as Record<string, number>) || {},
    preferred_locations: (data.preferred_locations as Record<string, number>) || {},
    preferred_companies: (data.preferred_companies as Record<string, number>) || {},
    avoided_companies: (data.avoided_companies as string[]) || [],
    total_interactions: data.total_interactions || 0,
    total_favorites: data.total_favorites || 0,
    total_applies: data.total_applies || 0,
    total_discards: data.total_discards || 0,
    last_computed_at: data.last_computed_at,
    computation_version: data.computation_version || 1,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ============================================
// MERGE EXPLICIT + LEARNED PREFERENCES
// ============================================

/**
 * Merge explicit job filter preferences with learned AI preferences
 * Explicit preferences are used as baseline when learned data is sparse
 *
 * @param learned - User's learned preferences from AI analysis (or null)
 * @param explicit - User's explicit job filter settings (or null)
 * @returns Merged preferences for scoring
 */
export function mergeExplicitWithLearnedPreferences(
  learned: UserLearnedPreferences | null,
  explicit: JobFilters | null
): UserLearnedPreferences {
  // Start with learned preferences or empty structure
  const merged: UserLearnedPreferences = learned ? { ...learned } : {
    id: '',
    user_id: '',
    confidence_level: 'low' as ConfidenceLevel,
    preferred_industries: {},
    preferred_company_sizes: {},
    preferred_job_types: {},
    remote_preference: {},
    preferred_salary_min: null,
    preferred_salary_max: null,
    salary_currency: null,
    keyword_weights: {},
    preferred_locations: {},
    preferred_companies: {},
    avoided_companies: [],
    total_interactions: 0,
    total_favorites: 0,
    total_applies: 0,
    total_discards: 0,
    last_computed_at: null,
    computation_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (!explicit) return merged

  const DEFAULT_WEIGHT = 0.8

  // Industries (soft preference) - only fill if learned is empty
  if (explicit.industries?.length && Object.keys(merged.preferred_industries).length === 0) {
    merged.preferred_industries = Object.fromEntries(
      explicit.industries.map(i => [i, DEFAULT_WEIGHT])
    )
  }

  // Company size (soft preference) - only fill if learned is empty
  if (explicit.company_size?.length && Object.keys(merged.preferred_company_sizes).length === 0) {
    merged.preferred_company_sizes = Object.fromEntries(
      explicit.company_size.map(s => [s, DEFAULT_WEIGHT])
    )
  }

  // include_keywords -> positive keyword weights
  if (explicit.include_keywords?.length) {
    explicit.include_keywords.forEach(kw => {
      // Only add if not already learned
      if (!merged.keyword_weights[kw]) {
        merged.keyword_weights[kw] = 0.5
      }
    })
  }

  // exclude_keywords -> negative keyword weights
  if (explicit.exclude_keywords?.length) {
    explicit.exclude_keywords.forEach(kw => {
      // Only add if not already learned
      if (!merged.keyword_weights[kw]) {
        merged.keyword_weights[kw] = -0.8
      }
    })
  }

  // Salary (soft preference) - only fill if learned is empty
  if (explicit.salary_min && !merged.preferred_salary_min) {
    merged.preferred_salary_min = explicit.salary_min
  }
  if (explicit.salary_max && !merged.preferred_salary_max) {
    merged.preferred_salary_max = explicit.salary_max
  }
  if (explicit.salary_currency && !merged.salary_currency) {
    merged.salary_currency = explicit.salary_currency
  }

  // Remote/work arrangement preference
  if (explicit.work_arrangements?.length && Object.keys(merged.remote_preference).length === 0) {
    const remotePrefs: Record<string, number> = {}
    if (explicit.work_arrangements.includes('remote_only') ||
        explicit.work_arrangements.includes('remote_ok')) {
      remotePrefs['fully_remote'] = DEFAULT_WEIGHT
    }
    if (explicit.work_arrangements.includes('hybrid')) {
      remotePrefs['hybrid'] = DEFAULT_WEIGHT
    }
    if (explicit.work_arrangements.includes('on_site')) {
      remotePrefs['onsite'] = DEFAULT_WEIGHT
    }
    merged.remote_preference = remotePrefs
  }

  // Location preferences from remote_countries
  if (explicit.remote_countries?.length && Object.keys(merged.preferred_locations).length === 0) {
    merged.preferred_locations = Object.fromEntries(
      explicit.remote_countries.map(loc => [loc, DEFAULT_WEIGHT])
    )
  }

  // Avoided companies
  if (explicit.exclude_companies?.length) {
    const existingAvoided = new Set(merged.avoided_companies || [])
    explicit.exclude_companies.forEach(company => {
      if (!existingAvoided.has(company)) {
        merged.avoided_companies.push(company)
      }
    })
  }

  return merged
}

/**
 * Format preferences for AI chat context
 *
 * @param preferences - User's learned preferences
 * @returns Formatted string for AI system prompt
 */
export function formatPreferencesForAI(preferences: UserLearnedPreferences): string {
  const parts: string[] = []

  // Industries (Record<string, number>)
  const industryKeys = Object.keys(preferences.preferred_industries || {})
  if (industryKeys.length > 0) {
    // Sort by weight and take top industries
    const topIndustries = Object.entries(preferences.preferred_industries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([industry]) => industry)
    parts.push(`Preferred industries: ${topIndustries.join(', ')}`)
  }

  // Salary
  if (preferences.preferred_salary_min || preferences.preferred_salary_max) {
    const currency = preferences.salary_currency || ''
    const salaryStr =
      preferences.preferred_salary_min && preferences.preferred_salary_max
        ? `${currency} ${preferences.preferred_salary_min} - ${preferences.preferred_salary_max}`
        : preferences.preferred_salary_min
          ? `${currency} ${preferences.preferred_salary_min}+`
          : `up to ${currency} ${preferences.preferred_salary_max}`
    parts.push(`Salary preference: ${salaryStr.trim()}`)
  }

  // Remote work (Record<string, number>)
  const remotePref = preferences.remote_preference || {}
  if (Object.keys(remotePref).length > 0) {
    const bestRemoteType = Object.entries(remotePref)
      .sort(([, a], [, b]) => b - a)[0]
    if (bestRemoteType) {
      const [type, weight] = bestRemoteType
      if (weight > 0.5) {
        parts.push(`Prefers ${type.replace('_', ' ')} work`)
      }
    }
  }

  // Keywords (Record<string, number>)
  const positiveKeywords = Object.entries(preferences.keyword_weights || {})
    .filter(([_, score]) => (score as number) > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([kw]) => kw)
    .slice(0, 5)

  const negativeKeywords = Object.entries(preferences.keyword_weights || {})
    .filter(([_, score]) => (score as number) < 0)
    .sort(([, a], [, b]) => (a as number) - (b as number))
    .map(([kw]) => kw)
    .slice(0, 5)

  if (positiveKeywords.length > 0) {
    parts.push(`Responds positively to: ${positiveKeywords.join(', ')}`)
  }

  if (negativeKeywords.length > 0) {
    parts.push(`Tends to avoid: ${negativeKeywords.join(', ')}`)
  }

  // Companies (Record<string, number> for preferred, string[] for avoided)
  const preferredCompanyKeys = Object.keys(preferences.preferred_companies || {})
  if (preferredCompanyKeys.length > 0) {
    const topCompanies = Object.entries(preferences.preferred_companies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([company]) => company)
    parts.push(`Preferred companies: ${topCompanies.join(', ')}`)
  }

  if (preferences.avoided_companies && preferences.avoided_companies.length > 0) {
    parts.push(`Avoided companies: ${preferences.avoided_companies.slice(0, 5).join(', ')}`)
  }

  // Statistics
  parts.push(`Based on ${preferences.total_interactions || 0} job interactions and ${preferences.total_favorites || 0} favorites`)

  return parts.join('\n')
}
