/**
 * Preference Learning Engine
 *
 * Analyzes user behavior and builds preference profiles based on
 * job interactions. Uses weighted scoring with recency decay to
 * compute user preferences for AI-driven job recommendations.
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { Job, InteractionType, ConfidenceLevel } from '@/lib/supabase/types'

// Re-export types from supabase types
export type { InteractionType, ConfidenceLevel }

// ============================================
// TYPES
// ============================================

export interface WeightedInteraction {
  interactionType: InteractionType
  weight: number
  decayedWeight: number
  jobId: string
  createdAt: Date
}

export interface ExtractedFeatures {
  industries: Map<string, number>
  companySizes: Map<string, number>
  remoteTypes: Map<string, number>
  salaries: { min: number[]; max: number[]; currencies: string[] }
  keywords: Map<string, number>
  jobTypes: Map<string, number>
  locations: Map<string, number>
  companies: Map<string, number>
  titles: Map<string, number>
}

export interface AggregatedPreferences {
  preferredIndustries: string[]
  preferredCompanySizes: string[]
  preferredJobTypes: string[]
  learnedSalaryMin: number | null
  learnedSalaryMax: number | null
  salaryImportance: number
  remotePreference: number
  preferredLocations: string[]
  keywordAffinities: Record<string, number>
  preferredCompanies: string[]
  avoidedCompanies: string[]
  titlePatterns: string[]
  seniorityPreference: 'entry' | 'associate' | 'mid-senior' | 'director' | null
}

export interface ValidatedPreferences extends AggregatedPreferences {
  confidenceLevel: ConfidenceLevel
  interactionCount: number
  favoriteCount: number
}

// Database row type for user_interactions
interface UserInteractionRow {
  id: string
  user_id: string
  job_id: string | null
  interaction_type: string
  duration_seconds: number | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Weights for different interaction types.
 * Positive values indicate preference, negative values indicate aversion.
 */
export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  favorite: 1.0,
  apply: 0.8,
  save: 0.5,
  view_details: 0.3,
  view: 0.1,
  discard: -0.5,
  skip: -0.2,
  unfavorite: -0.8,
}

/**
 * Thresholds for confidence levels based on data volume.
 */
export const CONFIDENCE_THRESHOLDS = {
  none: { minFavorites: 0, minInteractions: 0 },
  low: { minFavorites: 3, minInteractions: 10 },
  medium: { minFavorites: 8, minInteractions: 30 },
  high: { minFavorites: 15, minInteractions: 75 },
}

/**
 * Safety bounds to prevent overfitting and ensure diversity.
 */
export const SAFETY_BOUNDS = {
  maxSingleJobInfluence: 0.15,
  minUniqueCompanies: 3,
  minUniqueIndustries: 2,
  maxNegativeKeywords: 20,
  maxAvoidedCompanies: 50,
  decayHalfLifeDays: 30,
  maxPreferredItems: 10,
}

/**
 * Common tech keywords to extract from job descriptions.
 */
const TECH_KEYWORDS = [
  'react', 'typescript', 'python', 'java', 'javascript', 'node', 'nodejs',
  'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'sql', 'postgresql',
  'mongodb', 'redis', 'graphql', 'rest', 'api', 'frontend', 'backend',
  'fullstack', 'full-stack', 'devops', 'machine learning', 'ml', 'ai',
  'data science', 'mobile', 'ios', 'android', 'flutter', 'react native',
  'vue', 'vuejs', 'angular', 'nextjs', 'next.js', 'golang', 'go', 'rust',
  'scala', 'kotlin', 'swift', 'ruby', 'rails', 'django', 'flask', 'fastapi',
  'spring', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'microservices',
  'serverless', 'lambda', 'elasticsearch', 'kafka', 'rabbitmq', 'spark',
  'hadoop', 'tableau', 'power bi', 'agile', 'scrum', 'product', 'design',
  'ux', 'ui', 'figma', 'security', 'blockchain', 'web3', 'crypto',
]

/**
 * Seniority keywords for detection.
 */
const SENIORITY_KEYWORDS = {
  entry: ['junior', 'entry', 'graduate', 'intern', 'trainee', 'associate'],
  associate: ['associate', 'mid', 'intermediate'],
  'mid-senior': ['senior', 'sr', 'lead', 'principal', 'staff'],
  director: ['director', 'vp', 'head of', 'chief', 'cto', 'ceo', 'manager'],
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Main function to compute and store user preferences based on their interactions.
 */
export async function computeUserPreferences(userId: string): Promise<void> {
  try {
    // Get weighted interactions with recency decay
    const interactions = await getWeightedInteractions(userId)

    if (interactions.length === 0) {
      // No interactions yet - create default preferences with 'none' confidence
      await upsertUserPreferences(userId, {
        preferredIndustries: [],
        preferredCompanySizes: [],
        preferredJobTypes: [],
        learnedSalaryMin: null,
        learnedSalaryMax: null,
        salaryImportance: 0.5,
        remotePreference: 0.5,
        preferredLocations: [],
        keywordAffinities: {},
        preferredCompanies: [],
        avoidedCompanies: [],
        titlePatterns: [],
        seniorityPreference: null,
        confidenceLevel: 'none',
        interactionCount: 0,
        favoriteCount: 0,
      })
      return
    }

    // Extract features from interacted jobs
    const features = await extractJobFeatures(interactions)

    // Aggregate into preferences with weights
    const aggregated = aggregatePreferences(features)

    // Compute confidence level
    const favoriteCount = interactions.filter(
      i => i.interactionType === 'favorite' || i.interactionType === 'apply'
    ).length
    const confidenceLevel = computeConfidence(favoriteCount, interactions.length)

    // Apply safety bounds and validation
    const validated = validateAndBoundPreferences({
      ...aggregated,
      confidenceLevel,
      interactionCount: interactions.length,
      favoriteCount,
    })

    // Store computed preferences
    await upsertUserPreferences(userId, validated)

    console.log(`[PreferenceLearning] Computed preferences for user ${userId}:`, {
      confidence: validated.confidenceLevel,
      interactions: validated.interactionCount,
      favorites: validated.favoriteCount,
    })
  } catch (error) {
    console.error(`[PreferenceLearning] Error computing preferences for user ${userId}:`, error)
    throw error
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate recency decay factor using half-life formula.
 */
function calculateDecay(createdAt: Date): number {
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.pow(0.5, ageInDays / SAFETY_BOUNDS.decayHalfLifeDays)
}

/**
 * Get all user interactions with weights and recency decay applied.
 */
async function getWeightedInteractions(userId: string): Promise<WeightedInteraction[]> {
  const supabase = createServiceClient()

  // Get all interactions from the last 90 days (3 half-lives)
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)

  const { data: interactions, error } = await supabase
    .from('user_interactions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', cutoffDate.toISOString())
    .not('job_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[PreferenceLearning] Error fetching interactions:', error)
    throw error
  }

  if (!interactions || interactions.length === 0) {
    return []
  }

  return (interactions as UserInteractionRow[])
    .filter(interaction => interaction.job_id !== null)
    .map(interaction => {
      const interactionType = interaction.interaction_type as InteractionType
      const weight = INTERACTION_WEIGHTS[interactionType] || 0
      const createdAt = new Date(interaction.created_at)
      const decay = calculateDecay(createdAt)

      return {
        interactionType,
        weight,
        decayedWeight: weight * decay,
        jobId: interaction.job_id!,
        createdAt,
      }
    })
}

/**
 * Extract features from jobs the user interacted with.
 */
async function extractJobFeatures(
  interactions: WeightedInteraction[]
): Promise<ExtractedFeatures> {
  const supabase = createServiceClient()

  // Get unique job IDs
  const jobIds = Array.from(new Set(interactions.map(i => i.jobId)))

  // Fetch job details
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .in('id', jobIds)

  if (error) {
    console.error('[PreferenceLearning] Error fetching jobs:', error)
    throw error
  }

  // Create job lookup map
  const jobMap = new Map((jobs || []).map(job => [job.id, job]))

  // Create interaction weight lookup (aggregate if multiple interactions)
  const jobWeights = new Map<string, number>()
  for (const interaction of interactions) {
    const current = jobWeights.get(interaction.jobId) || 0
    jobWeights.set(interaction.jobId, current + interaction.decayedWeight)
  }

  // Initialize feature maps
  const features: ExtractedFeatures = {
    industries: new Map(),
    companySizes: new Map(),
    remoteTypes: new Map(),
    salaries: { min: [], max: [], currencies: [] },
    keywords: new Map(),
    jobTypes: new Map(),
    locations: new Map(),
    companies: new Map(),
    titles: new Map(),
  }

  // Process each job
  for (const [jobId, weight] of Array.from(jobWeights.entries())) {
    const job = jobMap.get(jobId)
    if (!job) continue

    // Industry
    if (job.industry_category) {
      const current = features.industries.get(job.industry_category) || 0
      features.industries.set(job.industry_category, current + weight)
    }

    // Company size (inferred from company name - heuristic)
    const companySize = inferCompanySize(job.company || '')
    if (companySize) {
      const current = features.companySizes.get(companySize) || 0
      features.companySizes.set(companySize, current + weight)
    }

    // Remote type
    if (job.remote_type) {
      const current = features.remoteTypes.get(job.remote_type) || 0
      features.remoteTypes.set(job.remote_type, current + weight)
    } else if (job.remote) {
      const remoteKey = 'fully_remote'
      const current = features.remoteTypes.get(remoteKey) || 0
      features.remoteTypes.set(remoteKey, current + weight)
    } else {
      const remoteKey = 'onsite'
      const current = features.remoteTypes.get(remoteKey) || 0
      features.remoteTypes.set(remoteKey, current + weight)
    }

    // Salary (only for positive interactions)
    if (weight > 0) {
      if (job.salary_min) features.salaries.min.push(job.salary_min)
      if (job.salary_max) features.salaries.max.push(job.salary_max)
      if (job.salary_currency) features.salaries.currencies.push(job.salary_currency)
    }

    // Keywords from title and description
    const extractedKeywords = extractKeywords(job.title || '', job.description || '')
    for (const keyword of extractedKeywords) {
      const current = features.keywords.get(keyword) || 0
      features.keywords.set(keyword, current + weight)
    }

    // Job type
    if (job.job_type) {
      const current = features.jobTypes.get(job.job_type) || 0
      features.jobTypes.set(job.job_type, current + weight)
    }

    // Location
    if (job.location) {
      const current = features.locations.get(job.location) || 0
      features.locations.set(job.location, current + weight)
    }

    // Company
    if (job.company) {
      const current = features.companies.get(job.company) || 0
      features.companies.set(job.company, current + weight)
    }

    // Title patterns
    if (job.title) {
      const current = features.titles.get(job.title) || 0
      features.titles.set(job.title, current + weight)
    }
  }

  return features
}

/**
 * Extract tech keywords from job title and description.
 */
function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase()
  return TECH_KEYWORDS.filter(kw => text.includes(kw))
}

/**
 * Infer company size from company name (heuristic).
 * This is a simple heuristic - in production, you'd use a company database.
 */
function inferCompanySize(companyName: string): string | null {
  const name = companyName.toLowerCase()

  // Known large companies
  const largeCompanies = [
    'google', 'microsoft', 'amazon', 'apple', 'meta', 'facebook', 'netflix',
    'salesforce', 'oracle', 'ibm', 'intel', 'cisco', 'adobe', 'vmware',
    'paypal', 'uber', 'lyft', 'airbnb', 'stripe', 'shopify', 'spotify',
  ]

  if (largeCompanies.some(lc => name.includes(lc))) {
    return 'enterprise'
  }

  // Check for startup indicators
  if (name.includes('startup') || name.includes('labs') || name.includes('ventures')) {
    return 'startup'
  }

  // Default - we don't have enough info
  return null
}

/**
 * Infer seniority from job title.
 */
function inferSeniority(titles: Map<string, number>): 'entry' | 'associate' | 'mid-senior' | 'director' | null {
  const seniorityScores: Record<string, number> = {
    entry: 0,
    associate: 0,
    'mid-senior': 0,
    director: 0,
  }

  for (const [title, weight] of Array.from(titles.entries())) {
    if (weight <= 0) continue

    const lowerTitle = title.toLowerCase()

    for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
      if (keywords.some(kw => lowerTitle.includes(kw))) {
        seniorityScores[level] += weight
      }
    }
  }

  // Find the highest scoring level
  let maxLevel: string | null = null
  let maxScore = 0

  for (const [level, score] of Object.entries(seniorityScores)) {
    if (score > maxScore) {
      maxScore = score
      maxLevel = level
    }
  }

  // Only return if there's a clear preference (score > 0.5)
  if (maxScore > 0.5) {
    return maxLevel as 'entry' | 'associate' | 'mid-senior' | 'director'
  }

  return null
}

/**
 * Aggregate extracted features into preference weights.
 */
function aggregatePreferences(features: ExtractedFeatures): AggregatedPreferences {
  // Get top items from a weighted map
  const getTopItems = (map: Map<string, number>, count: number): string[] => {
    return Array.from(map.entries())
      .filter(([_, weight]) => weight > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([key]) => key)
  }

  // Get items with negative weights (avoided)
  const getAvoidedItems = (map: Map<string, number>, count: number): string[] => {
    return Array.from(map.entries())
      .filter(([_, weight]) => weight < -0.3)
      .sort(([, a], [, b]) => a - b)
      .slice(0, count)
      .map(([key]) => key)
  }

  // Normalize keyword affinities
  const normalizeKeywordAffinities = (map: Map<string, number>): Record<string, number> => {
    const obj: Record<string, number> = {}
    const maxAbs = Math.max(...Array.from(map.values()).map(Math.abs), 0.1)

    for (const [key, value] of Array.from(map.entries())) {
      // Normalize to [-1, 1] range
      obj[key] = Math.max(-1, Math.min(1, value / maxAbs))
    }
    return obj
  }

  // Calculate salary preferences (median of positive interactions)
  const calcMedian = (arr: number[]): number | null => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  // Calculate remote preference as a score between 0 and 1
  const calcRemotePreference = (map: Map<string, number>): number => {
    const remoteScore = (map.get('fully_remote') || 0) + (map.get('hybrid') || 0) * 0.5
    const onsiteScore = map.get('onsite') || 0
    const total = remoteScore + onsiteScore

    if (total === 0) return 0.5
    return Math.max(0, Math.min(1, (remoteScore + 0.5) / (total + 1)))
  }

  // Calculate salary importance based on interaction patterns
  const calcSalaryImportance = (salaries: ExtractedFeatures['salaries']): number => {
    // If user interacted with many jobs with salary info, salary is likely important
    const salaryCount = salaries.min.length + salaries.max.length
    // Scale from 0.3 to 0.9 based on proportion of salary data
    return Math.min(0.9, 0.3 + (salaryCount / 20) * 0.6)
  }

  // Extract title patterns (simplified - just get top titles)
  const titlePatterns = getTopItems(features.titles, 5)

  return {
    preferredIndustries: getTopItems(features.industries, SAFETY_BOUNDS.maxPreferredItems),
    preferredCompanySizes: getTopItems(features.companySizes, 5),
    preferredJobTypes: getTopItems(features.jobTypes, 4),
    learnedSalaryMin: calcMedian(features.salaries.min),
    learnedSalaryMax: calcMedian(features.salaries.max),
    salaryImportance: calcSalaryImportance(features.salaries),
    remotePreference: calcRemotePreference(features.remoteTypes),
    preferredLocations: getTopItems(features.locations, SAFETY_BOUNDS.maxPreferredItems),
    keywordAffinities: normalizeKeywordAffinities(features.keywords),
    preferredCompanies: getTopItems(features.companies, SAFETY_BOUNDS.maxPreferredItems),
    avoidedCompanies: getAvoidedItems(features.companies, SAFETY_BOUNDS.maxAvoidedCompanies),
    titlePatterns,
    seniorityPreference: inferSeniority(features.titles),
  }
}

/**
 * Compute confidence level based on data volume.
 */
function computeConfidence(favoriteCount: number, interactionCount: number): ConfidenceLevel {
  if (
    favoriteCount >= CONFIDENCE_THRESHOLDS.high.minFavorites &&
    interactionCount >= CONFIDENCE_THRESHOLDS.high.minInteractions
  ) {
    return 'high'
  }

  if (
    favoriteCount >= CONFIDENCE_THRESHOLDS.medium.minFavorites &&
    interactionCount >= CONFIDENCE_THRESHOLDS.medium.minInteractions
  ) {
    return 'medium'
  }

  if (
    favoriteCount >= CONFIDENCE_THRESHOLDS.low.minFavorites &&
    interactionCount >= CONFIDENCE_THRESHOLDS.low.minInteractions
  ) {
    return 'low'
  }

  return 'none'
}

/**
 * Apply safety bounds and validation to preferences.
 */
function validateAndBoundPreferences(
  prefs: ValidatedPreferences
): ValidatedPreferences {
  // Limit the influence of any single keyword
  const boundedKeywords: Record<string, number> = {}
  for (const [keyword, weight] of Object.entries(prefs.keywordAffinities)) {
    boundedKeywords[keyword] = Math.max(-1, Math.min(1, weight))
  }

  // Limit negative keywords count
  const negativeKeywords = Object.entries(boundedKeywords)
    .filter(([_, weight]) => weight < 0)
    .sort(([, a], [, b]) => a - b)
    .slice(0, SAFETY_BOUNDS.maxNegativeKeywords)

  const positiveKeywords = Object.entries(boundedKeywords)
    .filter(([_, weight]) => weight >= 0)

  const finalKeywords: Record<string, number> = {}
  for (const [keyword, weight] of [...positiveKeywords, ...negativeKeywords]) {
    finalKeywords[keyword] = weight
  }

  return {
    ...prefs,
    keywordAffinities: finalKeywords,
    avoidedCompanies: prefs.avoidedCompanies.slice(0, SAFETY_BOUNDS.maxAvoidedCompanies),
    preferredCompanies: prefs.preferredCompanies.slice(0, SAFETY_BOUNDS.maxPreferredItems),
    preferredIndustries: prefs.preferredIndustries.slice(0, SAFETY_BOUNDS.maxPreferredItems),
    preferredLocations: prefs.preferredLocations.slice(0, SAFETY_BOUNDS.maxPreferredItems),
  }
}

/**
 * Upsert user preferences to the database.
 */
async function upsertUserPreferences(
  userId: string,
  prefs: ValidatedPreferences
): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('user_ai_preferences')
    .upsert(
      {
        user_id: userId,
        // Convert arrays to weighted JSONB objects (equal weights for learned items)
        preferred_industries: Object.fromEntries(
          prefs.preferredIndustries.map((item, idx) => [item, 1 - idx * 0.05])
        ),
        preferred_company_sizes: Object.fromEntries(
          prefs.preferredCompanySizes.map((item, idx) => [item, 1 - idx * 0.1])
        ),
        preferred_job_types: Object.fromEntries(
          prefs.preferredJobTypes.map((item, idx) => [item, 1 - idx * 0.1])
        ),
        preferred_salary_min: prefs.learnedSalaryMin,
        preferred_salary_max: prefs.learnedSalaryMax,
        // Store remote preference as JSONB with type weights
        remote_preference: {
          preference_score: prefs.remotePreference,
          fully_remote: prefs.remotePreference > 0.7 ? 1 : prefs.remotePreference > 0.4 ? 0.5 : 0,
          hybrid: prefs.remotePreference > 0.3 && prefs.remotePreference < 0.7 ? 0.5 : 0,
          onsite: prefs.remotePreference < 0.4 ? 1 : prefs.remotePreference < 0.6 ? 0.3 : 0,
        },
        preferred_locations: Object.fromEntries(
          prefs.preferredLocations.map((item, idx) => [item, 1 - idx * 0.05])
        ),
        keyword_weights: prefs.keywordAffinities,
        preferred_companies: Object.fromEntries(
          prefs.preferredCompanies.map((item, idx) => [item, 1 - idx * 0.05])
        ),
        avoided_companies: prefs.avoidedCompanies,
        confidence_level: prefs.confidenceLevel,
        last_computed_at: new Date().toISOString(),
        total_interactions: prefs.interactionCount,
        total_favorites: prefs.favoriteCount,
      },
      {
        onConflict: 'user_id',
      }
    )

  if (error) {
    console.error('[PreferenceLearning] Error upserting preferences:', error)
    throw error
  }
}

/**
 * Get user preferences from the database.
 */
export async function getUserPreferences(
  userId: string
): Promise<ValidatedPreferences | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_ai_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No preferences found
      return null
    }
    console.error('[PreferenceLearning] Error fetching preferences:', error)
    throw error
  }

  if (!data) return null

  // Helper to convert JSONB objects to arrays (extract keys)
  const jsonbToArray = (obj: Record<string, number> | null): string[] => {
    if (!obj || typeof obj !== 'object') return []
    return Object.keys(obj)
  }

  // Extract remote preference score from JSONB
  const remotePrefs = data.remote_preference as { preference_score?: number } | null
  const remoteScore = remotePrefs?.preference_score ?? 0.5

  return {
    preferredIndustries: jsonbToArray(data.preferred_industries as Record<string, number>),
    preferredCompanySizes: jsonbToArray(data.preferred_company_sizes as Record<string, number>),
    preferredJobTypes: jsonbToArray(data.preferred_job_types as Record<string, number>),
    learnedSalaryMin: data.preferred_salary_min,
    learnedSalaryMax: data.preferred_salary_max,
    salaryImportance: 0.5, // Default, not stored in new schema
    remotePreference: remoteScore,
    preferredLocations: jsonbToArray(data.preferred_locations as Record<string, number>),
    keywordAffinities: (data.keyword_weights as Record<string, number>) || {},
    preferredCompanies: jsonbToArray(data.preferred_companies as Record<string, number>),
    avoidedCompanies: (data.avoided_companies as string[]) || [],
    titlePatterns: [], // Not stored in new schema
    seniorityPreference: null, // Not stored in new schema
    confidenceLevel: data.confidence_level as ConfidenceLevel,
    interactionCount: data.total_interactions || 0,
    favoriteCount: data.total_favorites || 0,
  }
}

/**
 * Calculate a preference score for a job based on user preferences.
 * Returns a score between 0 and 1, where 1 is a perfect match.
 */
export function calculatePreferenceScore(
  job: Partial<Job>,
  preferences: ValidatedPreferences
): number {
  // If no confidence, return neutral score
  if (preferences.confidenceLevel === 'none') {
    return 0.5
  }

  let score = 0
  let totalWeight = 0

  // Industry match (weight: 0.15)
  if (job.industry_category && preferences.preferredIndustries.includes(job.industry_category)) {
    score += 0.15
  }
  totalWeight += 0.15

  // Remote preference (weight: 0.15)
  const isRemote = job.remote || job.remote_type === 'fully_remote'
  const isHybrid = job.remote_type === 'hybrid'

  if (preferences.remotePreference > 0.7 && isRemote) {
    score += 0.15
  } else if (preferences.remotePreference > 0.4 && (isRemote || isHybrid)) {
    score += 0.1
  } else if (preferences.remotePreference < 0.3 && !isRemote) {
    score += 0.15
  }
  totalWeight += 0.15

  // Job type match (weight: 0.1)
  if (job.job_type && preferences.preferredJobTypes.includes(job.job_type)) {
    score += 0.1
  }
  totalWeight += 0.1

  // Keyword match (weight: 0.3)
  const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase()
  let keywordScore = 0
  let keywordCount = 0
  for (const [keyword, weight] of Object.entries(preferences.keywordAffinities)) {
    if (jobText.includes(keyword)) {
      keywordScore += weight
      keywordCount++
    }
  }
  if (keywordCount > 0) {
    // Normalize keyword score to [0, 0.3] range
    const normalizedKeywordScore = ((keywordScore / keywordCount) + 1) / 2 * 0.3
    score += normalizedKeywordScore
  }
  totalWeight += 0.3

  // Company match (weight: 0.1)
  if (job.company) {
    if (preferences.avoidedCompanies.includes(job.company)) {
      // Penalty for avoided companies
      score -= 0.2
    } else if (preferences.preferredCompanies.includes(job.company)) {
      score += 0.1
    }
  }
  totalWeight += 0.1

  // Location match (weight: 0.1)
  if (job.location && preferences.preferredLocations.some(loc =>
    job.location!.toLowerCase().includes(loc.toLowerCase()) ||
    loc.toLowerCase().includes(job.location!.toLowerCase())
  )) {
    score += 0.1
  }
  totalWeight += 0.1

  // Salary match (weight: 0.1 * salary_importance)
  if (preferences.learnedSalaryMin || preferences.learnedSalaryMax) {
    const salaryWeight = 0.1 * preferences.salaryImportance

    if (job.salary_max && preferences.learnedSalaryMin) {
      if (job.salary_max >= preferences.learnedSalaryMin) {
        score += salaryWeight
      }
    } else if (job.salary_min && preferences.learnedSalaryMax) {
      if (job.salary_min <= preferences.learnedSalaryMax) {
        score += salaryWeight * 0.5
      }
    }
    totalWeight += salaryWeight
  }

  // Normalize to 0-1 range
  const normalizedScore = Math.max(0, Math.min(1, score / totalWeight))

  // Apply confidence factor
  const confidenceMultiplier =
    preferences.confidenceLevel === 'high'
      ? 1.0
      : preferences.confidenceLevel === 'medium'
        ? 0.8
        : 0.6

  // Blend with neutral score based on confidence
  return 0.5 * (1 - confidenceMultiplier) + normalizedScore * confidenceMultiplier
}
