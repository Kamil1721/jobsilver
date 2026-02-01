import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'

/**
 * Plan limits and features configuration for 2-tier pricing model (January 2026)
 *
 * New Model:
 * - Free: 3 jobs discovered per day, NO AI access
 * - Pro: 50 jobs discovered per day, UNLIMITED AI access, $4.99/week or $14.99/month
 *
 * Key Changes:
 * - Limit is now by jobs discovered (not AI responses)
 * - AI access is boolean (not quota-based)
 * - Pro has 3-day free trial
 */
export interface PlanLimits {
  // Job discovery limits (primary metric)
  jobsPerDay: number

  // AI access (boolean - not quota-based)
  hasAIAccess: boolean

  // Legacy fields (for backwards compatibility with existing UI)
  aiResponsesPerDay: number // -1 = unlimited
  coverLettersPerDay: number // -1 = unlimited
  cvOptimization: boolean
  aiLearning: boolean
  savedJobs: number

  // Features list for display
  features: string[]

  // Pricing
  weeklyPrice: number
  monthlyPrice: number
  trialDays: number
}

// AI resource types for legacy quota tracking (kept for backwards compatibility)
export type AIResource = 'aiResponses' | 'coverLetters' | 'cvOptimizations'

// New 2-tier pricing structure
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    jobsPerDay: 3,
    hasAIAccess: false,
    aiResponsesPerDay: 0,
    coverLettersPerDay: 0,
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
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
    jobsPerDay: 50,
    hasAIAccess: true,
    aiResponsesPerDay: -1, // Unlimited
    coverLettersPerDay: -1, // Unlimited
    cvOptimization: true,
    aiLearning: true,
    savedJobs: 1000,
    features: [
      '50 jobs discovered per day',
      'Unlimited AI chat assistance',
      'Unlimited cover letters',
      'CV optimization suggestions',
      'AI learns your preferences',
      'Advanced match analysis',
      'Priority support',
      'Save up to 1,000 jobs',
    ],
    weeklyPrice: 4.99,
    monthlyPrice: 14.99,
    trialDays: 3,
  },
}

// Legacy plan mappings for backwards compatibility
// Maps old plans to their equivalent in the new 2-tier model
export const LEGACY_PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    jobsPerDay: 3, // Downgraded to free equivalent
    hasAIAccess: false,
    aiResponsesPerDay: 0,
    coverLettersPerDay: 0,
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
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
    cvOptimization: false,
    aiLearning: false,
    savedJobs: 50,
    features: ['Same as Free - plan discontinued'],
    weeklyPrice: 0,
    monthlyPrice: 0,
    trialDays: 0,
  },
  ultra: {
    jobsPerDay: 50, // Maps to pro
    hasAIAccess: true,
    aiResponsesPerDay: -1,
    coverLettersPerDay: -1,
    cvOptimization: true,
    aiLearning: true,
    savedJobs: 1000,
    features: ['Same as Pro'],
    weeklyPrice: 4.99,
    monthlyPrice: 14.99,
    trialDays: 0,
  },
  mega: {
    jobsPerDay: 50, // Maps to pro
    hasAIAccess: true,
    aiResponsesPerDay: -1,
    coverLettersPerDay: -1,
    cvOptimization: true,
    aiLearning: true,
    savedJobs: 1000,
    features: ['Same as Pro'],
    weeklyPrice: 4.99,
    monthlyPrice: 14.99,
    trialDays: 0,
  },
}

/**
 * Get plan limits for any plan (current or legacy)
 */
export function getPlanLimits(plan: AllSubscriptionPlans): PlanLimits {
  // Check current plans first
  if (plan === 'free' || plan === 'pro') {
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
  // In the 2-tier model, pro is higher than free
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
    case 'cvOptimizations':
      // CV optimizations are boolean access, not quota-based
      return limits.cvOptimization ? -1 : 0
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
    case 'cvOptimizations':
      // CV optimizations are boolean access, not quota-based
      return !limits.cvOptimization
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
    case 'cvOptimizations':
      return limits.cvOptimization ? -1 : 0
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
 * Get the upgrade plan (always Pro now)
 */
export function getUpgradePlan(currentPlan: AllSubscriptionPlans): SubscriptionPlan | null {
  // In 2-tier model, free upgrades to pro, pro has no upgrade
  if (currentPlan === 'free' || currentPlan === 'starter' || currentPlan === 'basic') {
    return 'pro'
  }
  return null // pro, ultra, mega have no upgrade
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
    // Legacy plans mapping:
    case 'starter':
    case 'basic':
      return 'free' // Downgrade to free
    case 'ultra':
    case 'mega':
      return 'pro' // Equivalent to pro
    default:
      return 'free'
  }
}
