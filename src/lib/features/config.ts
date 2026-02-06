import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'

/**
 * Feature identifiers for gated functionality
 */
export type Feature =
  | 'ai_assistant'
  | 'email_alerts'
  | 'ai_cover_letters'
  | 'advanced_filters'
  | 'priority_support'
  | 'dedicated_support'
  | 'ai_learning'
  | 'cv_generator'
  | 'unlimited_ai'
  | 'daily_emails'
  | 'favorites'

/**
 * Minimum plan required to access each feature
 * 3-tier model: free, pro, or ultra
 * - Pro: Basic AI features with limits, daily emails, favorites
 * - Ultra: Unlimited AI, daily emails, priority support
 */
export const FEATURE_REQUIREMENTS: Record<Feature, SubscriptionPlan> = {
  ai_assistant: 'pro',
  email_alerts: 'pro', // Daily for Pro and Ultra
  ai_cover_letters: 'pro',
  advanced_filters: 'pro',
  ai_learning: 'pro',
  cv_generator: 'pro',
  favorites: 'pro',
  // Ultra-only features
  priority_support: 'ultra',
  dedicated_support: 'ultra',
  unlimited_ai: 'ultra',
  daily_emails: 'ultra',
}

/**
 * Tester equivalent plan - testers get ultra-level access
 */
export const TESTER_EQUIVALENT_PLAN: SubscriptionPlan = 'ultra'

/**
 * Feature display information for upgrade prompts
 */
export const FEATURE_INFO: Record<Feature, { name: string; description: string }> = {
  ai_assistant: {
    name: 'AI Assistant',
    description: 'Get AI-powered help crafting applications, cover letters, and preparing for interviews',
  },
  email_alerts: {
    name: 'Email Alerts',
    description: 'Get notified when new jobs match your criteria',
  },
  ai_cover_letters: {
    name: 'AI Cover Letters',
    description: 'Generate personalized cover letters tailored to each job',
  },
  advanced_filters: {
    name: 'Advanced Filters',
    description: 'Filter by seniority, industry, company size, time zones & more',
  },
  priority_support: {
    name: 'Priority Support',
    description: 'Get faster response times from our support team',
  },
  dedicated_support: {
    name: 'Dedicated Support',
    description: 'Direct access to a dedicated support representative',
  },
  ai_learning: {
    name: 'AI Learning',
    description: 'AI learns your job preferences from your favorites and interactions for better recommendations',
  },
  cv_generator: {
    name: 'CV Generator',
    description: 'Generate professional CVs tailored to specific jobs',
  },
  unlimited_ai: {
    name: 'Unlimited AI',
    description: 'No daily limits on AI responses, cover letters, or CV generations',
  },
  daily_emails: {
    name: 'Daily Email Alerts',
    description: 'Receive daily job match notifications',
  },
  favorites: {
    name: 'Favorite Jobs',
    description: 'Save jobs to your favorites for quick access',
  },
}

/**
 * Plan hierarchy for comparison (3-tier model)
 * Legacy plans are mapped: starter/basic -> free, mega -> ultra
 */
const PLAN_HIERARCHY: AllSubscriptionPlans[] = ['free', 'starter', 'basic', 'pro', 'ultra', 'mega']

/**
 * Current subscription plan hierarchy (excludes legacy plans)
 * Used for subscription upgrades/downgrades
 * Exported for use by subscription APIs and UI components
 */
export const SUBSCRIPTION_PLAN_HIERARCHY: SubscriptionPlan[] = ['free', 'pro', 'ultra']

/**
 * Check if changing from currentPlan to targetPlan is a downgrade
 * Uses the 3-tier model: free < pro < ultra
 *
 * @param currentPlan - User's current subscription plan
 * @param targetPlan - The plan user wants to change to
 * @returns true if this is a downgrade, false otherwise
 */
export function isDowngrade(currentPlan: string, targetPlan: string): boolean {
  const currentIndex = SUBSCRIPTION_PLAN_HIERARCHY.indexOf(currentPlan as SubscriptionPlan)
  const targetIndex = SUBSCRIPTION_PLAN_HIERARCHY.indexOf(targetPlan as SubscriptionPlan)

  // If either plan not found, not a downgrade
  if (currentIndex === -1 || targetIndex === -1) return false

  return targetIndex < currentIndex
}

/**
 * Check if a plan can access a feature
 * Returns false for unknown plans (fail-safe)
 *
 * @param plan - The user's subscription plan (including legacy plans)
 * @param feature - The feature to check access for
 * @param isTester - Optional: if true, user is a tester with pro-equivalent access
 */
export function canAccessFeature(
  plan: AllSubscriptionPlans,
  feature: Feature,
  isTester?: boolean
): boolean {
  // Testers get ultra-level access to all features
  // (but NOT admin access - that's separate)
  const effectivePlan = isTester ? TESTER_EQUIVALENT_PLAN : plan

  const requiredPlan = FEATURE_REQUIREMENTS[feature]
  const planIndex = PLAN_HIERARCHY.indexOf(effectivePlan)
  const requiredIndex = PLAN_HIERARCHY.indexOf(requiredPlan)

  // If plan not found in hierarchy, deny access (fail-safe)
  // Note: Don't log the actual plan value to avoid echoing potentially untrusted input
  if (planIndex === -1) {
    console.warn('Unknown plan in canAccessFeature - denying access')
    return false
  }

  // If required plan not found (shouldn't happen), deny access
  if (requiredIndex === -1) {
    console.warn('Unknown required plan for feature in canAccessFeature - denying access')
    return false
  }

  return planIndex >= requiredIndex
}

/**
 * Get the effective plan for a user, accounting for tester status
 * Testers get treated as pro-tier for feature access
 */
export function getEffectivePlan(
  plan: AllSubscriptionPlans,
  isTester?: boolean
): AllSubscriptionPlans {
  return isTester ? TESTER_EQUIVALENT_PLAN : plan
}

/**
 * Get all features available to a plan
 *
 * @param plan - The user's subscription plan
 * @param isTester - Optional: if true, user is a tester with pro-equivalent access
 */
export function getFeaturesForPlan(plan: AllSubscriptionPlans, isTester?: boolean): Feature[] {
  return (Object.keys(FEATURE_REQUIREMENTS) as Feature[]).filter(feature =>
    canAccessFeature(plan, feature, isTester)
  )
}

/**
 * Get the minimum plan needed to unlock a feature
 */
export function getRequiredPlan(feature: Feature): SubscriptionPlan {
  return FEATURE_REQUIREMENTS[feature]
}

/**
 * Format plan name for display
 */
export function formatPlanName(plan: AllSubscriptionPlans): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}
