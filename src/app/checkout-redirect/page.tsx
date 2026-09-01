"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { Loader2 } from "lucide-react"
import { createCheckoutSession, BillingCycle } from "@/lib/stripe/browser"

function LoadingSpinner() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-[var(--dawn-gutter)]"
      style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
    >
      {/* Soft coral wash — same system as the tester page, decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, var(--coral-soft) 0%, rgba(252,233,226,0) 70%)",
        }}
      />

      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.6, delay: 0.05 }}
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--coral-soft)]"
          >
            <Loader2 className="h-7 w-7 animate-spin text-[var(--coral)]" aria-hidden="true" />
          </motion.div>
          <h1 className="text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--dawn-ink)]">
            Taking you to checkout&hellip;
          </h1>
          <p className="mt-2 text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
            One moment while we open a secure Stripe session.
          </p>
        </motion.div>
      </MotionConfig>
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
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-[var(--dawn-gutter)]"
        style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
      >
        {/* Soft coral wash — same system as the tester page, decorative only */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, var(--coral-soft) 0%, rgba(252,233,226,0) 70%)",
          }}
        />

        <div className="w-full max-w-sm rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-9 text-center shadow-[0_1px_2px_rgba(31,27,24,0.04)]">
          <h1 className="text-balance text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--dawn-ink)]">
            We couldn&rsquo;t start checkout
          </h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
            {error}
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--coral)] px-6 text-[14px] font-medium text-[var(--coral-ink)] transition-[background-color,transform] duration-200 hover:bg-[var(--coral-hi)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
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
