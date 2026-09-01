import type { AllSubscriptionPlans } from '@/lib/supabase/types'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getPlanLimits,
  hasAIAccess as checkPlanAIAccess,
  type AIResource,
  getResourceLimit,
  formatQuotaDisplay,
} from '@/lib/stripe/plans'

/**
 * AI feature types for usage tracking
 * Maps to database columns and plan limits
 */
export type AIFeature = 'ai_responses' | 'cover_letters' | 'cv_generations'

/**
 * Result from checking if a user can use AI
 * In 3-tier model:
 * - Free users: NO AI access
 * - Pro users: Limited AI access (30 responses/day, 5 cover letters/day, 3 CV generations/day)
 * - Ultra users: UNLIMITED AI access
 */
export interface CanUseAIResult {
  allowed: boolean
  remaining?: number // -1 = unlimited, undefined if not allowed
  message?: string // User-friendly message if not allowed
  suggestUpgrade?: 'pro' | 'ultra' // Which plan to suggest upgrading to
}

/**
 * Result from checking if a user can use an AI feature (legacy)
 */
export interface CanUseFeatureResult {
  allowed: boolean
  remaining: number // -1 = unlimited
  limit: number // -1 = unlimited
  used: number
  message?: string // User-friendly message if not allowed
}

/**
 * Daily usage stats for a user
 */
export interface DailyUsageStats {
  aiResponsesUsed: number
  coverLettersGenerated: number
  cvOptimizationsUsed: number
  date: string // ISO date string
}

/**
 * Generic Supabase client interface for this module
 * This is needed because the codebase uses untyped Supabase clients
 */
interface SupabaseClientLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: unknown; error: { code?: string; message: string } | null }>
        eq(column: string, value: string): {
          single(): Promise<{ data: unknown; error: { code?: string; message: string } | null }>
        }
      }
    }
    upsert(
      data: Record<string, unknown>,
      options?: { onConflict?: string }
    ): Promise<{ error: { message: string } | null }>
  }
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

/**
 * Convert AI feature to AIResource type for plan limits
 */
function featureToResource(feature: AIFeature): AIResource {
  switch (feature) {
    case 'ai_responses':
      return 'aiResponses'
    case 'cover_letters':
      return 'coverLetters'
    case 'cv_generations':
      return 'cvGenerations'
    default:
      throw new Error(`Unknown AI feature: ${feature}`)
  }
}

/**
 * Get the user's subscription plan from their profile
 */
async function getUserPlan(
  userId: string,
  supabase: SupabaseClientLike
): Promise<{ plan: AllSubscriptionPlans; isTester: boolean }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_plan, is_tester')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('Error fetching user plan:', error)
    return { plan: 'free', isTester: false }
  }

  const profileData = profile as { subscription_plan?: string; is_tester?: boolean }

  return {
    plan: (profileData.subscription_plan || 'free') as AllSubscriptionPlans,
    isTester: profileData.is_tester || false,
  }
}

/**
 * Get the effective plan for a user, accounting for tester status
 * Testers get ultra-level access (unlimited AI)
 */
function getEffectivePlan(plan: AllSubscriptionPlans, isTester: boolean): AllSubscriptionPlans {
  return isTester ? 'ultra' : plan
}

/**
 * PRIMARY FUNCTION: Check if a user can use AI features
 *
 * In the 3-tier model:
 * - Free users: NO AI access
 * - Pro users: Limited AI access (30 responses/day)
 * - Ultra users: UNLIMITED AI access
 * - Testers: Ultra-level access
 */
export async function canUseAI(
  userId: string,
  supabase: SupabaseClientLike,
  feature: AIFeature = 'ai_responses'
): Promise<CanUseAIResult> {
  // Get user's plan
  const { plan, isTester } = await getUserPlan(userId, supabase)
  const effectivePlan = getEffectivePlan(plan, isTester)

  // Check if plan has AI access
  const hasAccess = checkPlanAIAccess(effectivePlan)

  if (!hasAccess) {
    return {
      allowed: false,
      message: 'AI features require a Pro subscription. Upgrade to get AI assistance, cover letters, and CV generation.',
      suggestUpgrade: 'pro',
    }
  }

  const resource = featureToResource(feature)
  const limit = getResourceLimit(effectivePlan, resource)

  // Check if unlimited (-1)
  if (limit === -1) {
    return {
      allowed: true,
      remaining: -1,
    }
  }

  // Get current usage
  const usage = await getDailyUsage(userId, supabase)
  let used: number

  switch (feature) {
    case 'ai_responses':
      used = usage.aiResponsesUsed
      break
    case 'cover_letters':
      used = usage.coverLettersGenerated
      break
    case 'cv_generations':
      used = usage.cvOptimizationsUsed
      break
    default:
      used = 0
  }

  const remaining = Math.max(0, limit - used)

  // Check if over limit
  if (used >= limit) {
    const featureNames: Record<AIFeature, string> = {
      ai_responses: 'AI responses',
      cover_letters: 'cover letters',
      cv_generations: 'CV generations',
    }

    return {
      allowed: false,
      remaining: 0,
      message: `You've used all ${limit} ${featureNames[feature]} for today. Upgrade to Ultra for unlimited access.`,
      suggestUpgrade: 'ultra',
    }
  }

  return {
    allowed: true,
    remaining,
  }
}

/**
 * Get today's AI usage for a user (for analytics/display purposes)
 */
export async function getDailyUsage(
  userId: string,
  supabase: SupabaseClientLike
): Promise<DailyUsageStats> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('user_ai_usage')
    .select('ai_responses_used, cover_letters_generated, cv_optimizations_used, date')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is fine
    console.error('Error fetching daily AI usage:', error)
  }

  const usageData = data as {
    ai_responses_used?: number
    cover_letters_generated?: number
    cv_optimizations_used?: number
  } | null

  return {
    aiResponsesUsed: usageData?.ai_responses_used || 0,
    coverLettersGenerated: usageData?.cover_letters_generated || 0,
    cvOptimizationsUsed: usageData?.cv_optimizations_used || 0,
    date: today,
  }
}

/**
 * Check if a user can use an AI feature based on their plan and current usage
 *
 * In 3-tier model:
 * - Free users: blocked (allowed: false)
 * - Pro users: limited access with daily quotas
 * - Ultra users: unlimited access
 */
export async function checkCanUseFeature(
  userId: string,
  feature: AIFeature,
  supabase: SupabaseClientLike
): Promise<CanUseFeatureResult> {
  // Get user's plan
  const { plan, isTester } = await getUserPlan(userId, supabase)
  const effectivePlan = getEffectivePlan(plan, isTester)

  // Get plan limits
  const planLimits = getPlanLimits(effectivePlan)

  // Check AI access first
  if (!planLimits.hasAIAccess) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      message: 'AI features require a Pro subscription. Upgrade to get AI assistance.',
    }
  }

  // Get the limit for this feature
  const resource = featureToResource(feature)
  const limit = getResourceLimit(effectivePlan, resource)

  // Get current usage
  const usage = await getDailyUsage(userId, supabase)
  let used: number

  switch (feature) {
    case 'ai_responses':
      used = usage.aiResponsesUsed
      break
    case 'cover_letters':
      used = usage.coverLettersGenerated
      break
    case 'cv_generations':
      used = usage.cvOptimizationsUsed
      break
    default:
      used = 0
  }

  // Check if unlimited (-1)
  if (limit === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      used,
    }
  }

  // Check if over limit
  const remaining = Math.max(0, limit - used)

  if (used >= limit) {
    const featureNames: Record<AIFeature, string> = {
      ai_responses: 'AI responses',
      cover_letters: 'cover letters',
      cv_generations: 'CV generations',
    }

    return {
      allowed: false,
      remaining: 0,
      limit,
      used,
      message: `You've used all ${limit} ${featureNames[feature]} for today. Upgrade to Ultra for unlimited access.`,
    }
  }

  return {
    allowed: true,
    remaining,
    limit,
    used,
  }
}

/**
 * Increment AI usage for a feature
 * Uses atomic database function to prevent race conditions
 * Returns the new count after increment
 *
 * Note: In 3-tier model, this is used for both quota enforcement (Pro) and analytics (Ultra)
 */
export async function incrementUsage(
  userId: string,
  feature: AIFeature,
  _supabase: SupabaseClientLike,
  increment: number = 1
): Promise<number> {
  // Map feature name to database column
  // Note: 'cv_generations' maps to 'cv_optimizations' column in DB for backwards compatibility
  const dbFeature = feature === 'cv_generations' ? 'cv_optimizations' : feature

  // Use the atomic increment_ai_usage database function
  // This prevents race conditions from concurrent requests
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_feature: dbFeature, // 'ai_responses', 'cover_letters', or 'cv_optimizations'
    p_increment: increment,
  })

  if (error) {
    console.error('Error incrementing AI usage:', error)
    throw new Error(`Failed to update AI usage: ${error.message}`)
  }

  // The function returns the new count
  return (data as number) || 0
}

/**
 * Get usage stats with plan limits for display
 */
export async function getUsageWithLimits(
  userId: string,
  supabase: SupabaseClientLike
): Promise<{
  usage: DailyUsageStats
  limits: {
    aiResponses: { used: number; limit: number; limitDisplay: string }
    coverLetters: { used: number; limit: number; limitDisplay: string }
    cvGenerations: { used: number; limit: number; limitDisplay: string }
    cvOptimization: { enabled: boolean }
    aiLearning: { enabled: boolean }
  }
  plan: AllSubscriptionPlans
  isTester: boolean
  hasAIAccess: boolean
}> {
  const { plan, isTester } = await getUserPlan(userId, supabase)
  const effectivePlan = getEffectivePlan(plan, isTester)
  const usage = await getDailyUsage(userId, supabase)
  const planLimits = getPlanLimits(effectivePlan)

  return {
    usage,
    limits: {
      aiResponses: {
        used: usage.aiResponsesUsed,
        limit: planLimits.aiResponsesPerDay,
        limitDisplay: planLimits.hasAIAccess
          ? formatQuotaDisplay(planLimits.aiResponsesPerDay)
          : 'No access',
      },
      coverLetters: {
        used: usage.coverLettersGenerated,
        limit: planLimits.coverLettersPerDay,
        limitDisplay: planLimits.hasAIAccess
          ? formatQuotaDisplay(planLimits.coverLettersPerDay)
          : 'No access',
      },
      cvGenerations: {
        used: usage.cvOptimizationsUsed,
        limit: planLimits.cvGenerationsPerDay,
        limitDisplay: planLimits.hasAIAccess
          ? formatQuotaDisplay(planLimits.cvGenerationsPerDay)
          : 'No access',
      },
      cvOptimization: {
        enabled: planLimits.cvOptimization,
      },
      aiLearning: {
        enabled: planLimits.aiLearning,
      },
    },
    plan: plan as AllSubscriptionPlans,
    isTester,
    hasAIAccess: planLimits.hasAIAccess,
  }
}

/**
 * Check if user is close to their limit (80%+)
 * In 3-tier model:
 * - Free users: always "at limit" (no access)
 * - Pro users: check against daily limits
 * - Ultra users: never near limit (unlimited)
 */
export async function checkNearLimits(
  userId: string,
  supabase: SupabaseClientLike
): Promise<{
  aiResponses: boolean
  coverLetters: boolean
  cvGenerations: boolean
}> {
  const { limits, hasAIAccess } = await getUsageWithLimits(userId, supabase)

  // Free users have no access, technically always "at limit"
  if (!hasAIAccess) {
    return {
      aiResponses: true,
      coverLetters: true,
      cvGenerations: true,
    }
  }

  // Check each resource
  const checkNearLimit = (used: number, limit: number): boolean => {
    // Unlimited (-1) is never near limit
    if (limit === -1) return false
    // At 80%+ of limit
    return used >= limit * 0.8
  }

  return {
    aiResponses: checkNearLimit(limits.aiResponses.used, limits.aiResponses.limit),
    coverLetters: checkNearLimit(limits.coverLetters.used, limits.coverLetters.limit),
    cvGenerations: checkNearLimit(limits.cvGenerations.used, limits.cvGenerations.limit),
  }
}
