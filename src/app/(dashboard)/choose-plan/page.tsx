"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { ArrowRight, Sparkles, Check, ArrowLeft, CircleAlert, RefreshCcw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PricingCard, PRICING_PLANS } from "@/components/pricing/PricingCard"
import { PricingToggle, type BillingCycle } from "@/components/pricing/PricingToggle"
import { PlanChangeDialog, type DowngradeReason } from "@/components/plan-change-dialog"
import { isDowngrade } from "@/lib/features/config"
import type { SubscriptionPlan } from "@/lib/supabase/types"
import styles from "./dawn-plan.module.css"

// Timeout for API requests (30 seconds)
const API_TIMEOUT_MS = 30000

type PlanApiResponse = {
  data?: {
    message?: string
    url?: string
  }
  error?: {
    message?: string
  }
}

async function readPlanApiResponse(response: Response): Promise<PlanApiResponse> {
  try {
    const payload: unknown = await response.json()
    return payload && typeof payload === "object" ? payload as PlanApiResponse : {}
  } catch {
    return {}
  }
}

/**
 * Generate a unique idempotency key for API requests
 */
function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// Loading fallback for Suspense
function ChoosePlanLoading() {
  return (
    <div className={`${styles.shell} flex items-center justify-center`}>
      <div className="w-full max-w-sm space-y-4 px-6" role="status" aria-label="Loading plans">
        <div className="h-4 w-24 animate-pulse rounded bg-[var(--coral-soft)]" />
        <div className="h-10 w-4/5 animate-pulse rounded-lg bg-[var(--dawn-cream)]" />
        <div className="h-32 w-full animate-pulse rounded-2xl border border-[var(--dawn-line)] bg-[var(--dawn-surface)]" />
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
  const [currentPlan, setCurrentPlan] = React.useState<string>("")
  const [periodEndDate, setPeriodEndDate] = React.useState<string | null>(null)
  const [planLoadState, setPlanLoadState] = React.useState<"loading" | "ready" | "error">("loading")
  const [planLoadAttempt, setPlanLoadAttempt] = React.useState(0)

  // Downgrade dialog state
  const [showDowngradeDialog, setShowDowngradeDialog] = React.useState(false)
  const [pendingPlan, setPendingPlan] = React.useState<{ planId: string; cycle: BillingCycle } | null>(null)
  const [isDowngrading, setIsDowngrading] = React.useState(false)

  // Ref for abort controller to cancel in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = React.useMemo(() => createClient(), [])

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
    let isMounted = true

    const fetchPlanStatus = async () => {
      setPlanLoadState("loading")

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!isMounted) return
      if (authError || !user) {
        setPlanLoadState("error")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_plan, has_selected_plan")
        .eq("id", user.id)
        .maybeSingle()

      if (!isMounted) return
      if (profileError) {
        console.error("Plan profile load error:", profileError.message)
        setPlanLoadState("error")
        return
      }

      // Only show current plan badge if user has already selected a plan before
      if (profile?.has_selected_plan) {
        setCurrentPlan(profile.subscription_plan || "free")

        // Fetch subscription period end date for paid plans
        if (profile.subscription_plan && profile.subscription_plan !== 'free') {
          const { data: subscription, error: subscriptionError } = await supabase
            .from("subscriptions")
            .select("current_period_end")
            .eq("user_id", user.id)
            .maybeSingle()

          if (!isMounted) return
          if (subscriptionError) {
            console.error("Subscription status load error:", subscriptionError.message)
            setPlanLoadState("error")
            return
          }

          if (subscription?.current_period_end) {
            setPeriodEndDate(subscription.current_period_end)
          }
        }
      } else {
        // New user in onboarding - don't mark any plan as "current"
        setCurrentPlan("")
      }

      setPlanLoadState("ready")
    }

    void fetchPlanStatus()

    return () => {
      isMounted = false
    }
  }, [planLoadAttempt, supabase])

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
          const data = await readPlanApiResponse(response)
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

        const data = await readPlanApiResponse(response)

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

        const data = await readPlanApiResponse(response)

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

      const data = await readPlanApiResponse(response)

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

  if (planLoadState === "loading") {
    return <ChoosePlanLoading />
  }

  if (planLoadState === "error") {
    return (
      <MotionConfig reducedMotion="user">
        <main className={`${styles.shell} flex items-center justify-center px-6 py-16`}>
          <div
            role="alert"
            className="w-full max-w-xl rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-8 text-center shadow-[0_18px_50px_-32px_rgba(31,27,24,0.24)]"
          >
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--coral-soft)] text-[var(--coral-lo)]">
              <CircleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">
              Your plan details are temporarily unavailable
            </h1>
            <p className="mx-auto mt-3 max-w-[48ch] text-sm leading-6 text-[var(--dawn-ink-2)]">
              We couldn’t confirm your current plan, so plan changes are paused to protect your account. Check your connection and retry.
            </p>
            <button
              type="button"
              onClick={() => setPlanLoadAttempt((attempt) => attempt + 1)}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--coral)] px-6 text-sm font-semibold text-[var(--coral-ink)] transition-colors hover:bg-[var(--coral-hi)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Retry loading
            </button>
          </div>
        </main>
      </MotionConfig>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className={styles.shell}>
      <div className={styles.content}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12 grid items-end gap-8 md:grid-cols-[1fr_auto]"
        >
          <div>
            <div className="mb-5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Plans &amp; pricing
            </div>
            <h1 className="max-w-[13ch] text-balance text-[clamp(2.35rem,6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--dawn-ink)]">
              Choose the pace of your search.
            </h1>
            <p className="mt-5 max-w-[58ch] text-pretty text-[clamp(1rem,1.4vw,1.125rem)] leading-7 text-[var(--dawn-ink-2)]">
              Start with a focused daily shortlist, then add more matches and AI support when you need them.
            </p>
          </div>
          <div className="flex md:justify-end">
            <PricingToggle
              billingCycle={billingCycle}
              onToggle={setBillingCycle}
            />
          </div>
        </motion.div>

        {/* Pricing Cards - 3-column grid for 3-tier model */}
        <div className={`${styles.plans} mx-auto mb-12 grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3`}>
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
          className="border-y border-[var(--dawn-line)] py-5"
        >
          <div className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-[var(--dawn-ink-2)] md:justify-center">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[var(--coral-lo)]" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[var(--coral-lo)]" />
              <span>No credit card for free</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[var(--coral-lo)]" />
              <span>Secure payment via Stripe</span>
            </div>
          </div>
        </motion.div>

        {/* Help text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-7 text-left md:text-center"
        >
          <p className="text-sm text-muted-foreground">
            Not sure which plan is right for you?{" "}
            <button
              onClick={() => handlePlanSelect("free", billingCycle)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 font-medium text-[var(--coral-lo)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2"
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
            className="mt-5 text-left md:text-center"
          >
            <button
              onClick={() => router.push("/profile")}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[var(--dawn-ink-2)] transition-colors hover:bg-[var(--dawn-cream)] hover:text-[var(--dawn-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 active:translate-y-px"
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
    </main>
    </MotionConfig>
  )
}
