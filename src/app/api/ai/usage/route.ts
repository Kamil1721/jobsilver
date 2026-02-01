import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsageWithLimits, checkNearLimits } from '@/lib/ai/usage-tracker'

// Force dynamic rendering since this route uses cookies for auth
export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/usage
 *
 * Returns the current user's daily AI usage statistics with plan limits.
 *
 * Response:
 * {
 *   data: {
 *     usage: {
 *       aiResponsesUsed: number,
 *       coverLettersGenerated: number,
 *       cvOptimizationsUsed: number,
 *       date: string
 *     },
 *     limits: {
 *       aiResponses: { used: number, limit: number, limitDisplay: string },
 *       coverLetters: { used: number, limit: number, limitDisplay: string },
 *       cvOptimization: { enabled: boolean },
 *       aiLearning: { enabled: boolean }
 *     },
 *     plan: string,
 *     isTester: boolean,
 *     nearLimits: {
 *       aiResponses: boolean,
 *       coverLetters: boolean
 *     }
 *   }
 * }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Get usage with limits
    const usageData = await getUsageWithLimits(user.id, supabase as unknown as Parameters<typeof getUsageWithLimits>[1])

    // Check if user is near any limits (80%+)
    const nearLimits = await checkNearLimits(user.id, supabase as unknown as Parameters<typeof checkNearLimits>[1])

    return NextResponse.json({
      data: {
        ...usageData,
        nearLimits,
      },
    })
  } catch (error) {
    console.error('Error fetching AI usage:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch AI usage data' } },
      { status: 500 }
    )
  }
}
