"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createCheckoutSession, BillingCycle } from "@/lib/stripe/browser"

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-4" />
        <p className="text-zinc-400">Redirecting to checkout...</p>
      </div>
    </div>
  )
}

function CheckoutRedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)
  const hasTriggered = React.useRef(false)

  React.useEffect(() => {
    // Prevent double-triggering
    if (hasTriggered.current) return
    hasTriggered.current = true

    async function triggerCheckout() {
      // Get checkout params from URL
      const plan = searchParams.get("plan")
      const cycle = (searchParams.get("cycle") as BillingCycle) || "monthly"

      if (!plan) {
        // No plan specified, redirect to pricing
        router.push("/pricing")
        return
      }

      try {
        // Trigger checkout - this will redirect to Stripe
        await createCheckoutSession(plan, cycle)
      } catch (err) {
        console.error("Checkout redirect error:", err)
        setError(err instanceof Error ? err.message : "Failed to start checkout")
      }
    }

    triggerCheckout()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/pricing")}
            className="text-zinc-400 hover:text-white underline"
          >
            Return to pricing
          </button>
        </div>
      </div>
    )
  }

  return <LoadingSpinner />
}

export default function CheckoutRedirectPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutRedirectContent />
    </Suspense>
  )
}
