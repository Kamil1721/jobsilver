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

/**
 * Minimum plan required to access each feature
 * 2-tier model: free or pro
 * - AI features require pro plan
 * - Free users get job discovery only (no AI)
 */
export const FEATURE_REQUIREMENTS: Record<Feature, SubscriptionPlan> = {
  ai_assistant: 'pro',
  email_alerts: 'pro',
  ai_cover_letters: 'pro',
  advanced_filters: 'pro',
  priority_support: 'pro',
  dedicated_support: 'pro',
  ai_learning: 'pro',
  cv_generator: 'pro',
}

/**
 * Tester equivalent plan - testers get pro-level access
 */
export const TESTER_EQUIVALENT_PLAN: SubscriptionPlan = 'pro'

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
}

/**
 * Plan hierarchy for comparison (2-tier model)
 * Legacy plans are mapped: starter/basic -> free, ultra/mega -> pro
 */
const PLAN_HIERARCHY: AllSubscriptionPlans[] = ['free', 'starter', 'basic', 'pro', 'ultra', 'mega']

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
  // Testers get pro-level access to all features
  // (but NOT admin access - that's separate)
  const effectivePlan = isTester ? TESTER_EQUIVALENT_PLAN : plan

  const requiredPlan = FEATURE_REQUIREMENTS[feature]
  const planIndex = PLAN_HIERARCHY.indexOf(effectivePlan)
  const requiredIndex = PLAN_HIERARCHY.indexOf(requiredPlan)

  // If plan not found in hierarchy, deny access (fail-safe)
  if (planIndex === -1) {
    console.warn(`Unknown plan "${effectivePlan}" in canAccessFeature - denying access`)
    return false
  }

  // If required plan not found (shouldn't happen), deny access
  if (requiredIndex === -1) {
    console.warn(`Unknown required plan "${requiredPlan}" for feature "${feature}" - denying access`)
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
