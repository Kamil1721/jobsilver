"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Check, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PricingCard, PRICING_PLANS } from "@/components/pricing/PricingCard"
import { PricingToggle, type BillingCycle } from "@/components/pricing/PricingToggle"
import { PlanChangeDialog, type DowngradeReason } from "@/components/plan-change-dialog"
import { isDowngrade } from "@/lib/features/config"
import type { SubscriptionPlan } from "@/lib/supabase/types"

// Timeout for API requests (30 seconds)
const API_TIMEOUT_MS = 30000

/**
 * Generate a unique idempotency key for API requests
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// Loading fallback for Suspense
function ChoosePlanLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-zinc-400 animate-spin" />
      </div>
    </div>
  )
}

export default function ChoosePlanPage() {
  return (
    <Suspense fallback={<ChoosePlanLoading />}>
      <ChoosePlanPageContent />
    </Suspense>
  )
}

function ChoosePlanPageContent() {
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly")
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = React.useState<string>("free")
  const [periodEndDate, setPeriodEndDate] = React.useState<string | null>(null)

  // Downgrade dialog state
  const [showDowngradeDialog, setShowDowngradeDialog] = React.useState(false)
  const [pendingPlan, setPendingPlan] = React.useState<{ planId: string; cycle: BillingCycle } | null>(null)
  const [isDowngrading, setIsDowngrading] = React.useState(false)

  // Ref for abort controller to cancel in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  // Cleanup abort controller on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Check for canceled checkout
  React.useEffect(() => {
    if (searchParams.get("subscription") === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No worries! You can try again or continue with the free plan.",
      })
    }
  }, [searchParams, toast])

  // Fetch current plan and subscription period end
  React.useEffect(() => {
    const fetchPlanStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, has_selected_plan")
        .eq("id", user.id)
        .single()

      // Only show current plan badge if user has already selected a plan before
      if (profile?.has_selected_plan) {
        setCurrentPlan(profile.subscription_plan || "free")

        // Fetch subscription period end date for paid plans
        if (profile.subscription_plan && profile.subscription_plan !== 'free') {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("current_period_end")
            .eq("user_id", user.id)
            .single()

          if (subscription?.current_period_end) {
            setPeriodEndDate(subscription.current_period_end)
          }
        }
      } else {
        // New user in onboarding - don't mark any plan as "current"
        setCurrentPlan("")
      }
    }

    fetchPlanStatus()
  }, [supabase])

  /**
   * Handle plan selection - checks for downgrades
   */
  const handlePlanSelect = async (planId: string, cycle: BillingCycle) => {
    // Check if this is a downgrade for existing paid users
    if (currentPlan && currentPlan !== "" && isDowngrade(currentPlan, planId)) {
      // Show downgrade confirmation dialog
      setPendingPlan({ planId, cycle })
      setShowDowngradeDialog(true)
      return
    }

    // Not a downgrade - proceed with normal flow
    await processUpgradeOrSelect(planId, cycle)
  }

  /**
   * Process upgrade or new plan selection (no confirmation needed)
   */
  const processUpgradeOrSelect = async (planId: string, cycle: BillingCycle) => {
    setIsLoading(true)
    setLoadingPlan(planId)

    try {
      if (planId === "free") {
        // Select free plan (for new users only - downgrades go through handleDowngradeConfirm)
        const response = await fetch("/api/plan/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "free" }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error?.message || "Failed to select plan")
        }

        toast({
          title: "Free plan selected",
          description: "Let's set up your job preferences!",
        })

        router.push("/setup")
        return
      }

      // For paid plans (upgrades), check if user already has a subscription
      if (currentPlan && currentPlan !== 'free') {
        // Existing paid user upgrading - redirect to Stripe billing portal
        const response = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ returnUrl: "/choose-plan" }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to access billing portal")
        }

        if (data.data?.url) {
          window.location.href = data.data.url
        } else {
          // P2-3 FIX: Handle missing URL explicitly
          throw new Error("No redirect URL received from billing portal")
        }
      } else {
        // New subscription - redirect to Stripe checkout
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: planId,
            billingCycle: cycle,
            successUrl: `${window.location.origin}/setup?subscription=success`,
            cancelUrl: `${window.location.origin}/choose-plan?subscription=canceled`,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to create checkout session")
        }

        if (data.data?.url) {
          window.location.href = data.data.url
        } else {
          // P2-3 FIX: Handle missing URL explicitly
          throw new Error("No checkout URL received")
        }
      }
    } catch (error) {
      // P3-2 FIX: Sanitize error logging
      console.error("Plan selection error:", error instanceof Error ? error.message : "Unknown error")
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process your selection",
      })
    } finally {
      // P2-1 FIX: Always reset loading state
      setIsLoading(false)
      setLoadingPlan(null)
    }
  }

  /**
   * Handle downgrade confirmation from dialog
   * Includes timeout handling and abort controller for resilience
   */
  const handleDowngradeConfirm = async (reason: DowngradeReason) => {
    if (!pendingPlan) return

    setIsDowngrading(true)

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller with timeout
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort()
    }, API_TIMEOUT_MS)

    try {
      // Generate idempotency key for this request
      const idempotencyKey = generateIdempotencyKey()

      const response = await fetch("/api/subscription/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlan: pendingPlan.planId,
          reason: reason,
          idempotencyKey,
        }),
        signal: abortController.signal,
      })

      clearTimeout(timeoutId)

      // Handle response.json() safely
      let data: { data?: { message?: string }; error?: { message?: string } }
      try {
        data = await response.json()
      } catch {
        throw new Error("Invalid response from server")
      }

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to process downgrade")
      }

      // Close dialog and show success
      setShowDowngradeDialog(false)
      setPendingPlan(null)

      toast({
        title: "Downgrade scheduled",
        description: data.data?.message || `Your subscription will be canceled at the end of your billing period.`,
      })

      // Redirect to profile page
      router.push("/profile")
    } catch (error) {
      // Check if this was an abort due to timeout
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          variant: "destructive",
          title: "Request timed out",
          description: "The request took too long. Please try again.",
        })
      } else {
        // P3-2 FIX: Sanitize error logging
        console.error("Downgrade error:", error instanceof Error ? error.message : "Unknown error")
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to process downgrade",
        })
      }
    } finally {
      clearTimeout(timeoutId)
      setIsDowngrading(false)
      abortControllerRef.current = null
    }
  }

  /**
   * Handle dialog close (cancel downgrade)
   */
  const handleDialogClose = (open: boolean) => {
    if (!open && !isDowngrading) {
      setShowDowngradeDialog(false)
      setPendingPlan(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-zinc-200/30 via-zinc-300/20 to-transparent dark:from-zinc-800/30 dark:via-zinc-900/20 blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-zinc-200/20 dark:from-zinc-700/20 via-transparent to-transparent blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] mb-6">
            <Sparkles className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Choose Your Plan
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            Discover jobs for free. Upgrade to Pro for AI assistance, or Ultra for unlimited power.
          </p>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <PricingToggle
              billingCycle={billingCycle}
              onToggle={setBillingCycle}
            />
          </div>
        </motion.div>

        {/* Pricing Cards - 3-column grid for 3-tier model */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PRICING_PLANS.map((plan, index) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              onSelect={handlePlanSelect}
              isLoading={isLoading && loadingPlan === plan.id}
              isCurrentPlan={currentPlan === plan.id}
              index={index}
            />
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>No credit card for free</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Secure payment via Stripe</span>
            </div>
          </div>
        </motion.div>

        {/* Help text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Not sure which plan is right for you?{" "}
            <button
              onClick={() => handlePlanSelect("free", billingCycle)}
              disabled={isLoading}
              className="text-zinc-700 dark:text-zinc-300 hover:underline font-medium inline-flex items-center gap-1"
            >
              Start free and upgrade anytime
              <ArrowRight className="w-3 h-3" />
            </button>
          </p>
        </motion.div>

        {/* Cancel/Back button - only show for existing users changing their plan */}
        {currentPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mt-6"
          >
            <button
              onClick={() => router.push("/profile")}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Cancel
            </button>
          </motion.div>
        )}
      </div>

      {/* Downgrade Confirmation Dialog */}
      {pendingPlan && (
        <PlanChangeDialog
          open={showDowngradeDialog}
          onOpenChange={handleDialogClose}
          currentPlan={currentPlan as SubscriptionPlan}
          targetPlan={pendingPlan.planId as SubscriptionPlan}
          periodEndDate={periodEndDate}
          onConfirm={handleDowngradeConfirm}
          isLoading={isDowngrading}
        />
      )}
    </div>
  )
}
