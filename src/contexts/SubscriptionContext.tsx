"use client"

import * as React from "react"
import type { AllSubscriptionPlans } from "@/lib/supabase/types"
import type { PlanLimits } from "@/lib/stripe/plans"

interface SubscriptionData {
  plan: AllSubscriptionPlans
  limits: PlanLimits
  isTester: boolean
  isAdmin: boolean
  subscription: {
    status: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
    trialEnd: string | null
  } | null
  usage: {
    jobsFetchedToday: number
  }
  startedAt: string | null
}

interface SubscriptionContextValue {
  plan: AllSubscriptionPlans
  limits: PlanLimits | null
  isTester: boolean
  isAdmin: boolean
  subscription: SubscriptionData['subscription']
  usage: SubscriptionData['usage'] | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const SubscriptionContext = React.createContext<SubscriptionContextValue | undefined>(undefined)

const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes - reduced polling frequency for efficiency

interface SubscriptionProviderProps {
  children: React.ReactNode
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [data, setData] = React.useState<SubscriptionData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchSubscription = React.useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/subscription')

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated, use free plan
          setData(null)
          return
        }
        throw new Error('Failed to fetch subscription')
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error.message || 'Failed to fetch subscription')
      }

      setData(result.data)
      setError(null)
    } catch (err) {
      console.error('Subscription fetch error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      // Fall back to free plan on error
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch on mount
  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void fetchSubscription()
    })
    return () => {
      cancelled = true
    }
  }, [fetchSubscription])

  // Auto-refresh subscription data only when page is visible
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(fetchSubscription, AUTO_REFRESH_INTERVAL)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refetch when user returns to tab, then start polling
        fetchSubscription()
        startPolling()
      } else {
        // Stop polling when page is hidden
        stopPolling()
      }
    }

    // Start polling if page is visible
    if (document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchSubscription])

  // Listen for subscription updates (e.g., after successful checkout)
  React.useEffect(() => {
    const handleSubscriptionUpdate = () => {
      fetchSubscription()
    }

    window.addEventListener('subscription-updated', handleSubscriptionUpdate)
    return () => {
      window.removeEventListener('subscription-updated', handleSubscriptionUpdate)
    }
  }, [fetchSubscription])

  const value: SubscriptionContextValue = {
    plan: data?.plan || 'free',
    limits: data?.limits || null,
    isTester: data?.isTester || false,
    isAdmin: data?.isAdmin || false,
    subscription: data?.subscription || null,
    usage: data?.usage || null,
    isLoading,
    error,
    refetch: fetchSubscription,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = React.useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider')
  }
  return context
}
