/**
 * Track Interaction and Learn
 *
 * Helper module to track user interactions with jobs and trigger
 * preference recomputation when appropriate.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { computeUserPreferences } from './preference-learning'
import type { InteractionType } from '@/lib/supabase/types'

// Re-export InteractionType for convenience
export type { InteractionType }

// Rate limit preference computation (in-memory)
const lastComputeTime = new Map<string, number>()
const COMPUTE_COOLDOWN_MS = 60 * 1000 // 1 minute

/**
 * Track a user interaction and optionally trigger preference recomputation.
 *
 * @param userId - The user's ID
 * @param jobId - The job's ID
 * @param type - The type of interaction
 * @param metadata - Optional additional metadata
 * @param durationSeconds - Optional duration in seconds (for view interactions)
 * @returns Promise<{ success: boolean; recomputed: boolean }>
 */
export async function trackInteractionAndLearn(
  userId: string,
  jobId: string,
  type: InteractionType,
  metadata?: Record<string, unknown>,
  durationSeconds?: number
): Promise<{ success: boolean; recomputed: boolean }> {
  const supabase = createServiceClient()

  try {
    // 1. Insert the interaction
    const { error: insertError } = await supabase.from('user_interactions').insert({
      user_id: userId,
      job_id: jobId,
      interaction_type: type,
      duration_seconds: durationSeconds || null,
      metadata: metadata || {},
    })

    if (insertError) {
      console.error('[TrackInteraction] Error inserting interaction:', insertError)
      return { success: false, recomputed: false }
    }

    // 2. Determine if we should trigger recomputation
    const shouldRecompute = shouldTriggerRecompute(userId, type)

    if (shouldRecompute) {
      try {
        await computeUserPreferences(userId)
        lastComputeTime.set(userId, Date.now())
        return { success: true, recomputed: true }
      } catch (computeError) {
        // Log but don't fail the interaction
        console.error('[TrackInteraction] Error recomputing preferences:', computeError)
        return { success: true, recomputed: false }
      }
    }

    return { success: true, recomputed: false }
  } catch (error) {
    console.error('[TrackInteraction] Unexpected error:', error)
    return { success: false, recomputed: false }
  }
}

/**
 * Determine if preference recomputation should be triggered.
 */
function shouldTriggerRecompute(userId: string, type: InteractionType): boolean {
  // Only recompute for significant interactions
  const significantInteractions: InteractionType[] = ['favorite', 'apply', 'discard']

  if (!significantInteractions.includes(type)) {
    return false
  }

  // Check cooldown
  const lastCompute = lastComputeTime.get(userId)
  if (lastCompute && Date.now() - lastCompute < COMPUTE_COOLDOWN_MS) {
    return false
  }

  return true
}

/**
 * Track a batch of interactions (useful for bulk operations).
 */
export async function trackInteractionsBatch(
  userId: string,
  interactions: Array<{
    jobId: string
    type: InteractionType
    metadata?: Record<string, unknown>
    durationSeconds?: number
  }>
): Promise<{ success: boolean; count: number }> {
  const supabase = createServiceClient()

  try {
    const records = interactions.map(interaction => ({
      user_id: userId,
      job_id: interaction.jobId,
      interaction_type: interaction.type,
      duration_seconds: interaction.durationSeconds || null,
      metadata: interaction.metadata || {},
    }))

    const { error, count } = await supabase.from('user_interactions').insert(records)

    if (error) {
      console.error('[TrackInteraction] Error inserting batch:', error)
      return { success: false, count: 0 }
    }

    // Trigger recomputation after batch insert
    const hasSignificant = interactions.some(i =>
      ['favorite', 'apply', 'discard'].includes(i.type)
    )

    if (hasSignificant) {
      const lastCompute = lastComputeTime.get(userId)
      if (!lastCompute || Date.now() - lastCompute >= COMPUTE_COOLDOWN_MS) {
        try {
          await computeUserPreferences(userId)
          lastComputeTime.set(userId, Date.now())
        } catch (computeError) {
          console.error('[TrackInteraction] Error recomputing preferences:', computeError)
        }
      }
    }

    return { success: true, count: count || interactions.length }
  } catch (error) {
    console.error('[TrackInteraction] Unexpected error in batch:', error)
    return { success: false, count: 0 }
  }
}

/**
 * Get interaction history for a user and job.
 */
export async function getJobInteractionHistory(
  userId: string,
  jobId: string
): Promise<Array<{ type: InteractionType; createdAt: string; durationSeconds: number | null }>> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_interactions')
    .select('interaction_type, created_at, duration_seconds')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[TrackInteraction] Error fetching history:', error)
    return []
  }

  return (data || []).map(row => ({
    type: row.interaction_type as InteractionType,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
  }))
}

/**
 * Get user's interaction statistics.
 */
export async function getUserInteractionStats(
  userId: string
): Promise<{
  total: number
  byType: Record<InteractionType, number>
  last24Hours: number
  last7Days: number
}> {
  const supabase = createServiceClient()

  // Get all interactions for type breakdown
  const { data: allInteractions, error: allError } = await supabase
    .from('user_interactions')
    .select('interaction_type')
    .eq('user_id', userId)

  if (allError) {
    console.error('[TrackInteraction] Error fetching stats:', allError)
    return {
      total: 0,
      byType: {} as Record<InteractionType, number>,
      last24Hours: 0,
      last7Days: 0,
    }
  }

  // Calculate type breakdown
  const byType: Record<string, number> = {}
  for (const interaction of allInteractions || []) {
    const type = interaction.interaction_type
    byType[type] = (byType[type] || 0) + 1
  }

  // Get 24 hour count
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const { count: last24Hours } = await supabase
    .from('user_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo.toISOString())

  // Get 7 day count
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { count: last7Days } = await supabase
    .from('user_interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())

  return {
    total: allInteractions?.length || 0,
    byType: byType as Record<InteractionType, number>,
    last24Hours: last24Hours || 0,
    last7Days: last7Days || 0,
  }
}

/**
 * Check if a user can trigger preference recomputation (respects rate limit).
 */
export function canRecompute(userId: string): boolean {
  const lastCompute = lastComputeTime.get(userId)
  if (!lastCompute) return true
  return Date.now() - lastCompute >= COMPUTE_COOLDOWN_MS
}

/**
 * Get time until next recomputation is allowed.
 */
export function getRecomputeCooldownRemaining(userId: string): number {
  const lastCompute = lastComputeTime.get(userId)
  if (!lastCompute) return 0
  const remaining = COMPUTE_COOLDOWN_MS - (Date.now() - lastCompute)
  return Math.max(0, remaining)
}

/**
 * Manually trigger preference recomputation (bypasses cooldown).
 * Use with caution - intended for admin or explicit user requests.
 */
export async function forceRecompute(userId: string): Promise<boolean> {
  try {
    await computeUserPreferences(userId)
    lastComputeTime.set(userId, Date.now())
    return true
  } catch (error) {
    console.error('[TrackInteraction] Error forcing recompute:', error)
    return false
  }
}
