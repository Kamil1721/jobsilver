import type { SubscriptionPlan, AllSubscriptionPlans } from '@/lib/supabase/types'
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
export type AIFeature = 'ai_responses' | 'cover_letters' | 'cv_optimizations'

/**
 * Result from checking if a user can use AI
 * In 2-tier model: Free users have NO AI access, Pro users have UNLIMITED
 */
export interface CanUseAIResult {
  allowed: boolean
  message?: string // User-friendly message if not allowed
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
    case 'cv_optimizations':
      return 'cvOptimizations'
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
 * Testers get pro-level access (was ultra in old model)
 */
function getEffectivePlan(plan: AllSubscriptionPlans, isTester: boolean): AllSubscriptionPlans {
  return isTester ? 'pro' : plan
}

/**
 * PRIMARY FUNCTION: Check if a user can use AI features
 *
 * In the 2-tier model:
 * - Free users: NO AI access
 * - Pro users: UNLIMITED AI access
 * - Testers: Pro-level access
 */
export async function canUseAI(
  userId: string,
  supabase: SupabaseClientLike
): Promise<CanUseAIResult> {
  // Get user's plan
  const { plan, isTester } = await getUserPlan(userId, supabase)
  const effectivePlan = getEffectivePlan(plan, isTester)

  // Check if plan has AI access
  const hasAccess = checkPlanAIAccess(effectivePlan)

  if (!hasAccess) {
    return {
      allowed: false,
      message: 'AI features require a Pro subscription. Upgrade to get unlimited AI assistance, cover letters, and CV optimization.',
    }
  }

  return {
    allowed: true,
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
 * LEGACY FUNCTION: Check if a user can use an AI feature based on their plan and current usage
 * Kept for backwards compatibility with existing code
 *
 * In 2-tier model: Free users are blocked (allowed: false), Pro users always allowed
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

  // Check AI access first (primary check in 2-tier model)
  if (!planLimits.hasAIAccess) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      message: 'AI features require a Pro subscription. Upgrade to get unlimited AI assistance.',
    }
  }

  // Get the limit for this feature
  const resource = featureToResource(feature)
  const limit = getResourceLimit(effectivePlan, resource)

  // CV optimizations are boolean access (not quota-based)
  if (feature === 'cv_optimizations') {
    const allowed = planLimits.cvOptimization

    return {
      allowed,
      remaining: allowed ? -1 : 0,
      limit: allowed ? -1 : 0,
      used: 0,
      message: allowed
        ? undefined
        : 'CV optimization is available on Pro plan. Upgrade to access this feature.',
    }
  }

  // Get current usage (for analytics, not blocking in Pro)
  const usage = await getDailyUsage(userId, supabase)
  let used: number

  switch (feature) {
    case 'ai_responses':
      used = usage.aiResponsesUsed
      break
    case 'cover_letters':
      used = usage.coverLettersGenerated
      break
    default:
      used = 0
  }

  // Pro users have unlimited access (-1)
  // In 2-tier model, if you have AI access, it's unlimited
  return {
    allowed: true,
    remaining: -1,
    limit: -1,
    used,
  }
}

/**
 * Increment AI usage for a feature
 * Uses atomic database function to prevent race conditions
 * Returns the new count after increment
 *
 * Note: In 2-tier model, this is for analytics only (Pro users are unlimited)
 */
export async function incrementUsage(
  userId: string,
  feature: AIFeature,
  supabase: SupabaseClientLike,
  increment: number = 1
): Promise<number> {
  // Use the atomic increment_ai_usage database function
  // This prevents race conditions from concurrent requests
  const { data, error } = await supabase.rpc('increment_ai_usage', {
    p_user_id: userId,
    p_feature: feature, // 'ai_responses', 'cover_letters', or 'cv_optimizations'
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
 * In 2-tier model: Always returns false for Pro users (unlimited)
 */
export async function checkNearLimits(
  userId: string,
  supabase: SupabaseClientLike
): Promise<{
  aiResponses: boolean
  coverLetters: boolean
}> {
  const { usage, limits, hasAIAccess } = await getUsageWithLimits(userId, supabase)

  // Pro users (with AI access) have unlimited, never near limit
  if (hasAIAccess) {
    return {
      aiResponses: false,
      coverLetters: false,
    }
  }

  // Free users have no access, technically always "at limit"
  return {
    aiResponses: true,
    coverLetters: true,
  }
}
