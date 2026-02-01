import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import type { GeneratedQueries, QueryGenerationInput } from '@/lib/ai/query-generator'

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Compute a hash of the profile data that affects query generation.
 * If this hash changes, cached queries should be invalidated.
 */
export function computeProfileHash(input: QueryGenerationInput): string {
  const hashInput = JSON.stringify({
    skills: input.cvSkills.slice(0, 10).sort(),
    titles: input.cvExperienceTitles.slice(0, 3),
    current: input.currentJobTitle,
    summary: input.experienceSummary?.slice(0, 100),
    targets: input.targetJobTitles.sort(),
    industries: input.targetIndustries.sort(),
    seniority: input.seniorityLevels.sort(),
    jobTypes: input.jobTypes.sort(),
    exclude: input.excludeKeywords.slice(0, 5).sort(),
  })

  return createHash('sha256').update(hashInput).digest('hex').slice(0, 16)
}

/**
 * Get cached queries for a user if they exist and are still valid.
 * Returns null if cache miss or expired.
 */
export async function getCachedQueries(
  userId: string,
  currentHash: string
): Promise<GeneratedQueries | null> {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('generated_queries, queries_profile_hash, queries_generated_at')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.log('No cached queries found for user')
      return null
    }

    // Check if hash matches
    if (profile.queries_profile_hash !== currentHash) {
      console.log('Profile hash changed, invalidating cache')
      return null
    }

    // Check if cache is expired
    if (profile.queries_generated_at) {
      const generatedAt = new Date(profile.queries_generated_at).getTime()
      const now = Date.now()
      if (now - generatedAt > CACHE_TTL_MS) {
        console.log('Cached queries expired')
        return null
      }
    }

    // Return cached queries
    if (profile.generated_queries) {
      console.log('Using cached queries')
      return profile.generated_queries as GeneratedQueries
    }

    return null
  } catch (error) {
    console.error('Error getting cached queries:', error)
    return null
  }
}

/**
 * Store generated queries in the user's profile for caching.
 */
export async function setCachedQueries(
  userId: string,
  queries: GeneratedQueries,
  hash: string
): Promise<void> {
  try {
    const supabase = await createClient()

    // Update the metadata with the hash
    const queriesWithHash: GeneratedQueries = {
      ...queries,
      metadata: {
        ...queries.metadata,
        profileHash: hash,
      },
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        generated_queries: queriesWithHash,
        queries_profile_hash: hash,
        queries_generated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('Error caching queries:', error)
    } else {
      console.log('Queries cached successfully')
    }
  } catch (error) {
    console.error('Error setting cached queries:', error)
  }
}

/**
 * Invalidate cached queries for a user (e.g., when profile is updated).
 */
export async function invalidateCachedQueries(userId: string): Promise<void> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('profiles')
      .update({
        generated_queries: null,
        queries_profile_hash: null,
        queries_generated_at: null,
      })
      .eq('id', userId)

    if (error) {
      console.error('Error invalidating cache:', error)
    } else {
      console.log('Cache invalidated for user')
    }
  } catch (error) {
    console.error('Error invalidating cached queries:', error)
  }
}
