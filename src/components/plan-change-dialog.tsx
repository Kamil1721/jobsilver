"use client"

import * as React from "react"
import { Loader2, AlertTriangle, X, Check } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import type { SubscriptionPlan } from "@/lib/supabase/types"
import { getPlanLimits, formatPlanName } from "@/lib/stripe/plans"

// Downgrade reason options
export const DOWNGRADE_REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using it enough" },
  { value: "found_alternative", label: "Found an alternative" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "temporary_break", label: "Taking a temporary break" },
  { value: "other", label: "Other" },
] as const

export type DowngradeReason = (typeof DOWNGRADE_REASONS)[number]["value"]

// Feature comparison data for display
const PLAN_FEATURE_DISPLAY = {
  ultra: {
    jobsPerDay: "35 jobs/day",
    aiResponses: "Unlimited AI responses",
    coverLetters: "Unlimited cover letters",
    cvGenerations: "Unlimited CV generations",
    savedJobs: "Unlimited saved jobs",
    favorites: "Favorite jobs",
    emailAlerts: "Daily email alerts",
    prioritySupport: "Priority support",
  },
  pro: {
    jobsPerDay: "15 jobs/day",
    aiResponses: "30 AI responses/day",
    coverLetters: "5 cover letters/day",
    cvGenerations: "3 CV generations/day",
    savedJobs: "200 saved jobs",
    favorites: "Favorite jobs",
    emailAlerts: "Daily email alerts",
    prioritySupport: null,
  },
  free: {
    jobsPerDay: "3 jobs/day",
    aiResponses: null,
    coverLetters: null,
    cvGenerations: null,
    savedJobs: "50 saved jobs",
    favorites: null,
    emailAlerts: null,
    prioritySupport: null,
  },
} as const

interface PlanChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: SubscriptionPlan
  targetPlan: SubscriptionPlan
  periodEndDate?: string | null
  onConfirm: (reason: DowngradeReason) => void
  isLoading?: boolean
}

// Map legacy plans to their modern equivalents for feature display
type PlanFeatureKey = keyof typeof PLAN_FEATURE_DISPLAY

function mapPlanToFeatureKey(plan: string): PlanFeatureKey | null {
  // Current plans
  if (plan === 'ultra' || plan === 'pro' || plan === 'free') {
    return plan as PlanFeatureKey
  }
  // Legacy plans mapping
  if (plan === 'mega') return 'ultra'
  if (plan === 'starter' || plan === 'basic') return 'free'
  return null
}

/**
 * Get list of features the user will lose when downgrading
 * P2-2 FIX: Handles legacy plans gracefully
 */
function getLostFeatures(
  currentPlan: SubscriptionPlan,
  targetPlan: SubscriptionPlan
): string[] {
  // Map plans to feature keys (handles legacy plans)
  const currentKey = mapPlanToFeatureKey(currentPlan)
  const targetKey = mapPlanToFeatureKey(targetPlan)

  // P2-2 FIX: Return empty array if plans not found (legacy plan edge case)
  if (!currentKey || !targetKey) {
    return []
  }

  const current = PLAN_FEATURE_DISPLAY[currentKey]
  const target = PLAN_FEATURE_DISPLAY[targetKey]
  const lost: string[] = []

  // Compare each feature
  for (const [key, value] of Object.entries(current)) {
    const targetValue = target[key as keyof typeof target]

    // Feature is lost if current has it but target doesn't
    if (value !== null && targetValue === null) {
      lost.push(value)
    }
    // Feature is downgraded (different non-null values)
    else if (value !== null && targetValue !== null && value !== targetValue) {
      // Show both old and new for comparison
      lost.push(`${value} (reduced to ${targetValue})`)
    }
  }

  return lost
}

/**
 * Format the period end date for display
 */
function formatPeriodEndDate(dateString: string | null | undefined): string {
  if (!dateString) return "the end of your billing period"

  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return "the end of your billing period"
  }
}

export function PlanChangeDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  periodEndDate,
  onConfirm,
  isLoading = false,
}: PlanChangeDialogProps) {
  const [selectedReason, setSelectedReason] = React.useState<DowngradeReason | "">("")

  // Reset reason when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedReason("")
    }
  }, [open])

  const lostFeatures = getLostFeatures(currentPlan, targetPlan)
  const formattedEndDate = formatPeriodEndDate(periodEndDate)

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">
              Downgrade to {formatPlanName(targetPlan)}?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              {/* Access period info */}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                You&apos;ll keep {formatPlanName(currentPlan)} access until{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formattedEndDate}
                </span>
                .
              </p>

              {/* Features being lost */}
              {lostFeatures.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    After that, you&apos;ll lose access to:
                  </p>
                  <ul className="space-y-1.5">
                    {lostFeatures.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <X className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data preservation notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Your saved jobs and favorites will be preserved.
                </p>
              </div>

              {/* Reason selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Help us improve: Why are you downgrading?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedReason}
                  onValueChange={(value) => setSelectedReason(value as DowngradeReason)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOWNGRADE_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Continue with Downgrade"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
