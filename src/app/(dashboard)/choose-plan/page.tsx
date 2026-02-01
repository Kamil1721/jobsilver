"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, ArrowRight, Sparkles, Check, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { PricingCard, PRICING_PLANS } from "@/components/pricing/PricingCard"
import { PricingToggle, type BillingCycle } from "@/components/pricing/PricingToggle"

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  // Check for canceled checkout
  React.useEffect(() => {
    if (searchParams.get("subscription") === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No worries! You can try again or continue with the free plan.",
      })
    }
  }, [searchParams, toast])

  // Only fetch current plan if user is revisiting (has already selected a plan)
  // For new users in onboarding, we don't show "Current Plan" badge
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
      // (i.e., they're revisiting to change/upgrade their plan)
      if (profile?.has_selected_plan) {
        setCurrentPlan(profile.subscription_plan || "free")
      } else {
        // New user in onboarding - don't mark any plan as "current"
        setCurrentPlan("")
      }
    }

    fetchPlanStatus()
  }, [supabase])

  const handlePlanSelect = async (planId: string, cycle: BillingCycle) => {
    setIsLoading(true)
    setLoadingPlan(planId)

    try {
      if (planId === "free") {
        // Select free plan
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

      // For paid plans, redirect to Stripe checkout
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
      }
    } catch (error) {
      console.error("Plan selection error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process your selection",
      })
      setIsLoading(false)
      setLoadingPlan(null)
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
            Discover jobs for free, or unlock unlimited AI assistance with Pro.
          </p>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <PricingToggle
              billingCycle={billingCycle}
              onToggle={setBillingCycle}
            />
          </div>
        </motion.div>

        {/* Pricing Cards - 2-column grid for 2-tier model */}
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
    </div>
  )
}
