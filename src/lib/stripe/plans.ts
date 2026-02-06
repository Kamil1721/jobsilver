import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'

/**
 * Plan limits and features configuration for 3-tier pricing model (February 2026)
 *
 * Current Model:
 * - Free: 3 jobs/day, no AI access
 * - Pro: 15 jobs/day, limited AI (30/day), 5 cover letters/day, 3 CV gen/day, $3.99/wk or $12.99/mo, 3-day trial
 * - Ultra: 35 jobs/day, unlimited AI access, $6.99/wk or $19.99/mo, no trial
 *
 * Note: Jobs auto-clear after 60 days, so saved job limits are rarely hit.
 */
export interface PlanLimits {
  // Job discovery limits (primary metric)
  jobsPerDay: number

  // AI access (boolean - whether user has any AI access)
  hasAIAccess: boolean

  // AI usage limits per day (-1 = unlimited, 0 = no access)
  aiResponsesPerDay: number
  coverLettersPerDay: number
  cvGenerationsPerDay: number

  // Legacy fields (for backwards compatibility with existing UI)
  cvOptimization: boolean
  aiLearning: boolean
  savedJobs: number // -1 = unlimited

  // Email notification frequency
  emailFrequency: 'none' | 'daily'

  // Features list for display
  features: string[]

  // Pricing
  weeklyPrice: number
  monthlyPrice: number
  trialDays: number
}

// AI resource types for quota tracking
export type AIResource = 'aiResponses' | 'coverLetters' | 'cvGenerations'

// 3-tier pricing structure (February 2026)
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    jobsPerDay: 3,
    hasAIAccess: false,
    aiResponsesPerDay: 0,
    coverLettersPerDay: 0,
    cvGenerationsPerDay: 0,
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
    emailFrequency: 'none',
    features: [
      '3 jobs discovered per day',
      'Kanban job tracking board',
      'Save up to 50 jobs',
      'Basic job match scores',
      'Manual apply to external sites',
    ],
    weeklyPrice: 0,
    monthlyPrice: 0,
    trialDays: 0,
  },
  pro: {
    jobsPerDay: 15,
    hasAIAccess: true,
    aiResponsesPerDay: 30,
    coverLettersPerDay: 5,
    cvGenerationsPerDay: 3,
    cvOptimization: true,
    aiLearning: true,
    savedJobs: 200,
    emailFrequency: 'daily',
    features: [
      '15 jobs discovered per day',
      '30 AI responses per day',
      '5 cover letters per day',
      '3 CV generations per day',
      'Save up to 200 jobs',
      'Favorite jobs',
      'Daily email alerts',
      '3-day free trial',
    ],
    weeklyPrice: 3.99,
    monthlyPrice: 12.99,
    trialDays: 3,
  },
  ultra: {
    jobsPerDay: 35,
    hasAIAccess: true,
    aiResponsesPerDay: -1, // Unlimited
    coverLettersPerDay: -1, // Unlimited
    cvGenerationsPerDay: -1, // Unlimited
    cvOptimization: true,
    aiLearning: true,
    savedJobs: -1, // Unlimited
    emailFrequency: 'daily',
    features: [
      '35 jobs discovered per day',
      'Unlimited AI chat assistance',
      'Unlimited cover letters',
      'Unlimited CV generations',
      'Unlimited saved jobs',
      'Favorite jobs',
      'Daily email alerts',
      'Priority support',
    ],
    weeklyPrice: 6.99,
    monthlyPrice: 19.99,
    trialDays: 0, // No trial for Ultra
  },
}

// Legacy plan mappings for backwards compatibility
// Maps old plans to their equivalent in the new 3-tier model
export const LEGACY_PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    jobsPerDay: 3, // Downgraded to free equivalent
    hasAIAccess: false,
    aiResponsesPerDay: 0,
    coverLettersPerDay: 0,
    cvGenerationsPerDay: 0,
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
    emailFrequency: 'none',
    features: ['Same as Free - plan discontinued'],
    weeklyPrice: 0,
    monthlyPrice: 0,
    trialDays: 0,
  },
  basic: {
    jobsPerDay: 3, // Downgraded to free equivalent
    hasAIAccess: false,
    aiResponsesPerDay: 0,
    coverLettersPerDay: 0,
    cvGenerationsPerDay: 0,
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
    emailFrequency: 'none',
    features: ['Same as Free - plan discontinued'],
    weeklyPrice: 0,
    monthlyPrice: 0,
    trialDays: 0,
  },
  mega: {
    jobsPerDay: 35, // Maps to ultra
    hasAIAccess: true,
    aiResponsesPerDay: -1,
    coverLettersPerDay: -1,
    cvGenerationsPerDay: -1,
    cvOptimization: true,
    aiLearning: true,
    savedJobs: -1,
    emailFrequency: 'daily',
    features: ['Same as Ultra'],
    weeklyPrice: 6.99,
    monthlyPrice: 19.99,
    trialDays: 0,
  },
}

/**
 * Get plan limits for any plan (current or legacy)
 */
export function getPlanLimits(plan: AllSubscriptionPlans): PlanLimits {
  // Check current plans first
  if (plan === 'free' || plan === 'pro' || plan === 'ultra') {
    return PLAN_LIMITS[plan]
  }
  // Fall back to legacy mappings
  return LEGACY_PLAN_LIMITS[plan] || PLAN_LIMITS.free
}

/**
 * Check if a user's plan allows a specific feature
 */
export function canUsePlan(
  currentPlan: AllSubscriptionPlans,
  requiredPlan: AllSubscriptionPlans
): boolean {
  // In the 3-tier model: free < pro < ultra
  // Legacy plans: starter/basic -> free, mega -> ultra
  const planOrder: AllSubscriptionPlans[] = ['free', 'starter', 'basic', 'pro', 'ultra', 'mega']
  const currentIndex = planOrder.indexOf(currentPlan)
  const requiredIndex = planOrder.indexOf(requiredPlan)
  return currentIndex >= requiredIndex
}

/**
 * Check if plan has AI access (new primary check)
 */
export function hasAIAccess(plan: AllSubscriptionPlans): boolean {
  const limits = getPlanLimits(plan)
  return limits.hasAIAccess
}

/**
 * Get daily job discovery limit for a plan
 */
export function getDailyJobLimit(plan: AllSubscriptionPlans): number {
  const limits = getPlanLimits(plan)
  return limits.jobsPerDay
}

/**
 * Get remaining quota for a specific AI resource
 * Returns -1 if unlimited, 0 if no access
 */
export function getRemainingQuota(
  plan: AllSubscriptionPlans,
  resource: AIResource,
  used: number
): number {
  const limits = getPlanLimits(plan)

  // If no AI access, return 0
  if (!limits.hasAIAccess) {
    return 0
  }

  let limit: number
  switch (resource) {
    case 'aiResponses':
      limit = limits.aiResponsesPerDay
      break
    case 'coverLetters':
      limit = limits.coverLettersPerDay
      break
    case 'cvGenerations':
      limit = limits.cvGenerationsPerDay
      break
    default:
      return 0
  }

  // -1 means unlimited
  if (limit === -1) {
    return -1
  }

  return Math.max(0, limit - used)
}

/**
 * Check if user has exceeded their plan limit for an AI resource
 */
export function isOverLimit(
  plan: AllSubscriptionPlans,
  resource: AIResource,
  used: number
): boolean {
  const limits = getPlanLimits(plan)

  // If no AI access, always over limit
  if (!limits.hasAIAccess) {
    return true
  }

  let limit: number
  switch (resource) {
    case 'aiResponses':
      limit = limits.aiResponsesPerDay
      break
    case 'coverLetters':
      limit = limits.coverLettersPerDay
      break
    case 'cvGenerations':
      limit = limits.cvGenerationsPerDay
      break
    default:
      return true
  }

  // -1 means unlimited, never over limit
  if (limit === -1) {
    return false
  }

  return used >= limit
}

/**
 * Get the limit value for a specific AI resource
 * Returns -1 if unlimited, 0 if no access
 */
export function getResourceLimit(
  plan: AllSubscriptionPlans,
  resource: AIResource
): number {
  const limits = getPlanLimits(plan)

  // If no AI access, return 0
  if (!limits.hasAIAccess) {
    return 0
  }

  switch (resource) {
    case 'aiResponses':
      return limits.aiResponsesPerDay
    case 'coverLetters':
      return limits.coverLettersPerDay
    case 'cvGenerations':
      return limits.cvGenerationsPerDay
    default:
      return 0
  }
}

/**
 * Check if a plan has access to a boolean feature
 */
export function hasFeatureAccess(
  plan: AllSubscriptionPlans,
  feature: 'cvOptimization' | 'aiLearning' | 'hasAIAccess'
): boolean {
  const limits = getPlanLimits(plan)
  return limits[feature]
}

/**
 * Get the upgrade plan for the current plan
 * In 3-tier model: free -> pro, pro -> ultra, ultra has no upgrade
 */
export function getUpgradePlan(currentPlan: AllSubscriptionPlans): SubscriptionPlan | null {
  // In 3-tier model: free -> pro, pro -> ultra
  if (currentPlan === 'free' || currentPlan === 'starter' || currentPlan === 'basic') {
    return 'pro'
  }
  if (currentPlan === 'pro') {
    return 'ultra'
  }
  return null // ultra, mega have no upgrade
}

/**
 * Format plan name for display
 */
export function formatPlanName(plan: AllSubscriptionPlans): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

/**
 * Get feature list comparison for upgrade modal
 */
export function getUpgradeFeatures(
  currentPlan: AllSubscriptionPlans,
  targetPlan: SubscriptionPlan
): string[] {
  const current = new Set(getPlanLimits(currentPlan).features || [])
  const target = getPlanLimits(targetPlan).features || []
  return target.filter(feature => !current.has(feature))
}

/**
 * Get daily AI response quota for a plan
 * Returns -1 for unlimited, 0 for no access
 */
export function getDailyAIResponseQuota(plan: AllSubscriptionPlans): number {
  const limits = getPlanLimits(plan)
  return limits.hasAIAccess ? limits.aiResponsesPerDay : 0
}

/**
 * Get daily cover letter quota for a plan
 * Returns -1 for unlimited, 0 for no access
 */
export function getDailyCoverLetterQuota(plan: AllSubscriptionPlans): number {
  const limits = getPlanLimits(plan)
  return limits.hasAIAccess ? limits.coverLettersPerDay : 0
}

/**
 * Get trial days for a plan
 */
export function getTrialDays(plan: AllSubscriptionPlans): number {
  const limits = getPlanLimits(plan)
  return limits.trialDays || 0
}

/**
 * Format quota display value
 * Shows "Unlimited" for -1, "No access" for 0, otherwise the number
 */
export function formatQuotaDisplay(value: number): string {
  if (value === -1) return 'Unlimited'
  if (value === 0) return 'No access'
  return String(value)
}

// ============================================
// LEGACY EXPORTS - For backwards compatibility
// ============================================

/**
 * @deprecated Use getDailyJobLimit instead
 * Legacy function for daily job quota
 */
export function getDailyJobQuota(plan: AllSubscriptionPlans): number {
  return getDailyJobLimit(plan)
}

/**
 * @deprecated Auto-apply feature is removed
 * Legacy function for daily application quota
 */
export function getDailyApplicationQuota(plan: AllSubscriptionPlans): number {
  // Map to job limit for backwards compatibility
  return getDailyJobLimit(plan)
}

/**
 * Map legacy plan to new plan equivalent
 * Used during migration
 */
export function mapLegacyPlan(plan: AllSubscriptionPlans): SubscriptionPlan {
  switch (plan) {
    case 'free':
      return 'free'
    case 'pro':
      return 'pro'
    case 'ultra':
      return 'ultra'
    // Legacy plans mapping:
    case 'starter':
    case 'basic':
      return 'free' // Downgrade to free
    case 'mega':
      return 'ultra' // Equivalent to ultra
    default:
      return 'free'
  }
}

/**
 * Get daily CV generation limit for a plan
 * Returns -1 for unlimited, 0 for no access
 */
export function getDailyCVGenerationQuota(plan: AllSubscriptionPlans): number {
  const limits = getPlanLimits(plan)
  return limits.hasAIAccess ? limits.cvGenerationsPerDay : 0
}

/**
 * Get email notification frequency for a plan
 */
export function getEmailFrequency(plan: AllSubscriptionPlans): 'none' | 'daily' {
  const limits = getPlanLimits(plan)
  return limits.emailFrequency
}
