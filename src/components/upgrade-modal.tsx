"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSubscription } from "@/contexts/SubscriptionContext"
import { type Feature } from "@/lib/features/config"
import { PLAN_LIMITS } from "@/lib/stripe/plans"
import type { AllSubscriptionPlans } from "@/lib/supabase/types"
import {
  Lock,
  Sparkles,
  Check,
  ArrowRight,
  Loader2,
  Rocket,
  Crown,
} from "lucide-react"

interface UpgradeModalEventDetail {
  feature: Feature
  requiredPlan: AllSubscriptionPlans
  featureName: string
  featureDescription: string
}

export function UpgradeModal() {
  const [open, setOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<UpgradeModalEventDetail | null>(null)
  const [billingCycle, setBillingCycle] = React.useState<'weekly' | 'monthly'>('monthly')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const { plan: currentPlan } = useSubscription()

  // Listen for upgrade modal events
  React.useEffect(() => {
    const handleShowUpgradeModal = (event: Event) => {
      const customEvent = event as CustomEvent<UpgradeModalEventDetail>
      setDetail(customEvent.detail)
      setOpen(true)
    }

    window.addEventListener('show-upgrade-modal', handleShowUpgradeModal)
    return () => {
      window.removeEventListener('show-upgrade-modal', handleShowUpgradeModal)
    }
  }, [])

  // Determine target plan based on current plan and required plan
  // Free → Pro, Pro → Ultra, or directly to required plan
  const targetPlan = React.useMemo(() => {
    if (!detail) return 'pro'

    // If the required plan is 'ultra', upgrade to ultra
    if (detail.requiredPlan === 'ultra') return 'ultra'

    // For Pro users, suggest Ultra upgrade (especially for AI limits)
    if (currentPlan === 'pro') return 'ultra'

    // Default: Free → Pro
    return 'pro'
  }, [detail, currentPlan])

  const handleUpgrade = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: targetPlan,
          billingCycle,
        }),
      })

      const data = await response.json()

      if (data.data?.url) {
        window.location.href = data.data.url
      } else if (data.error) {
        console.error('Checkout error:', data.error)
        setError(data.error.message || 'Failed to start checkout. Please try again.')
      } else {
        setError('Unexpected response from server. Please try again.')
      }
    } catch (err) {
      console.error('Failed to start checkout:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Clear error when modal closes
  React.useEffect(() => {
    if (!open) {
      setError(null)
    }
  }, [open])

  if (!detail) return null

  const planLimits = targetPlan === 'ultra' ? PLAN_LIMITS.ultra : PLAN_LIMITS.pro
  const isUltra = targetPlan === 'ultra'
  const PlanIcon = isUltra ? Crown : Rocket

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Unlock {detail.featureName}</DialogTitle>
              <Badge variant="outline" className="mt-1">
                {isUltra ? 'Ultra' : 'Pro'} Plan Required
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-base pt-2">
            {detail.featureDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Plan Details */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2 mb-3">
              <PlanIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              <span className="font-semibold text-lg">{isUltra ? 'Ultra' : 'Pro'} Plan</span>
              {!isUltra && (
                <Badge className="ml-auto bg-emerald-500 text-white text-xs">
                  3-Day Free Trial
                </Badge>
              )}
            </div>

            {/* Jobs per day - PRIMARY METRIC */}
            <div className="mb-4 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Jobs discovered</span>
                <span className="text-xl font-bold">{planLimits.jobsPerDay}/day</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isUltra
                    ? 'Unlimited AI assistance'
                    : `${planLimits.aiResponsesPerDay} AI responses/day`}
                </span>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2">
              {planLimits.features.slice(0, 5).map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1">
            <button
              onClick={() => setBillingCycle('weekly')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                billingCycle === 'weekly'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Weekly: ${planLimits.weeklyPrice}
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Monthly: ${planLimits.monthlyPrice}
              <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">Save 25%</span>
            </button>
          </div>

          {/* Current Plan Notice */}
          {currentPlan === 'free' && (
            <p className="text-xs text-center text-zinc-500">
              You&apos;re currently on the Free plan (3 jobs/day, no AI)
            </p>
          )}
          {currentPlan === 'pro' && (
            <p className="text-xs text-center text-zinc-500">
              You&apos;re currently on Pro (15 jobs/day, limited AI)
            </p>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-zinc-600 to-zinc-700 hover:from-zinc-700 hover:to-zinc-800"
              onClick={handleUpgrade}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              {isUltra ? 'Upgrade to Ultra' : 'Start Free Trial'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
