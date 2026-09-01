"use client"

import * as React from "react"

export interface AIUsageData {
  aiResponses: {
    used: number
    limit: number
    unlimited: boolean
  }
  coverLetters: {
    used: number
    limit: number
    unlimited: boolean
  }
  cvOptimization: boolean
  aiLearning: boolean
  plan: string
  isTester: boolean
  nearLimits: {
    aiResponses: boolean
    coverLetters: boolean
  }
  resetsAt: string // ISO date string (tomorrow midnight)
}

interface UseAIUsageResult {
  usage: AIUsageData | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  canUseAI: boolean
  canGenerateCoverLetter: boolean
  aiResponsesRemaining: number | "unlimited"
  coverLettersRemaining: number | "unlimited"
}

/**
 * Get tomorrow's midnight as ISO string (when usage resets)
 */
function getTomorrowMidnight(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

/**
 * Transform API response to the expected frontend format
 */
interface APIResponse {
  data: {
    usage: {
      aiResponsesUsed: number
      coverLettersGenerated: number
      cvOptimizationsUsed: number
      date: string
    }
    limits: {
      aiResponses: { used: number; limit: number; limitDisplay: string }
      coverLetters: { used: number; limit: number; limitDisplay: string }
      cvOptimization: { enabled: boolean }
      aiLearning: { enabled: boolean }
    }
    plan: string
    isTester: boolean
    nearLimits: {
      aiResponses: boolean
      coverLetters: boolean
    }
  }
}

function transformAPIResponse(response: APIResponse): AIUsageData {
  const { data } = response
  return {
    aiResponses: {
      used: data.limits.aiResponses.used,
      limit: data.limits.aiResponses.limit,
      unlimited: data.limits.aiResponses.limit === -1,
    },
    coverLetters: {
      used: data.limits.coverLetters.used,
      limit: data.limits.coverLetters.limit,
      unlimited: data.limits.coverLetters.limit === -1,
    },
    cvOptimization: data.limits.cvOptimization.enabled,
    aiLearning: data.limits.aiLearning.enabled,
    plan: data.plan,
    isTester: data.isTester,
    nearLimits: data.nearLimits,
    resetsAt: getTomorrowMidnight(),
  }
}

export function useAIUsage(): UseAIUsageResult {
  const [usage, setUsage] = React.useState<AIUsageData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchUsage = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("/api/ai/usage")
      if (!response.ok) {
        throw new Error("Failed to fetch usage")
      }
      const apiResponse: APIResponse = await response.json()
      const transformedData = transformAPIResponse(apiResponse)
      setUsage(transformedData)
    } catch (err) {
      setError("Could not load AI usage data")
      console.error("Failed to fetch AI usage:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchUsage()
    })
    // Refresh usage every 60 seconds
    const interval = setInterval(fetchUsage, 60000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [fetchUsage])

  // Compute derived values
  const canUseAI = React.useMemo(() => {
    if (!usage) return false
    if (usage.aiResponses.unlimited) return true
    return usage.aiResponses.used < usage.aiResponses.limit
  }, [usage])

  const canGenerateCoverLetter = React.useMemo(() => {
    if (!usage) return false
    if (usage.coverLetters.unlimited) return true
    return usage.coverLetters.used < usage.coverLetters.limit
  }, [usage])

  const aiResponsesRemaining = React.useMemo(() => {
    if (!usage) return 0
    if (usage.aiResponses.unlimited) return "unlimited"
    return Math.max(0, usage.aiResponses.limit - usage.aiResponses.used)
  }, [usage])

  const coverLettersRemaining = React.useMemo(() => {
    if (!usage) return 0
    if (usage.coverLetters.unlimited) return "unlimited"
    return Math.max(0, usage.coverLetters.limit - usage.coverLetters.used)
  }, [usage])

  return {
    usage,
    isLoading,
    error,
    refresh: fetchUsage,
    canUseAI,
    canGenerateCoverLetter,
    aiResponsesRemaining,
    coverLettersRemaining,
  }
}
