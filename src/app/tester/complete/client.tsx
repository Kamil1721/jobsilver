"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion, MotionConfig } from "framer-motion"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export default function TesterCompleteClient() {
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = React.useState("")
  const router = useRouter()

  React.useEffect(() => {
    const applyTesterStatus = async () => {
      const inviteCode = localStorage.getItem("tester_invite_code")

      if (!inviteCode) {
        setStatus("error")
        setErrorMessage("No invite code found. Please return to the tester page and enter your invite code.")
        return
      }

      try {
        const response = await fetch("/api/auth/tester-auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode }),
        })

        const data = await response.json()

        if (!response.ok) {
          setStatus("error")
          setErrorMessage(data.error || "Failed to apply tester status")
          return
        }

        // Clear the stored invite code
        localStorage.removeItem("tester_invite_code")
        setStatus("success")

        // Redirect to dashboard after a brief success message
        setTimeout(() => {
          router.push("/dashboard?tester=activated")
        }, 1500)
      } catch {
        setStatus("error")
        setErrorMessage("An unexpected error occurred. Please try again.")
      }
    }

    applyTesterStatus()
  }, [router])

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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-9 text-center shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
        >
          {status === "loading" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--coral-soft)]"
              >
                <Loader2 className="h-7 w-7 animate-spin text-[var(--coral)]" aria-hidden="true" />
              </motion.div>
              <h1 className="text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--dawn-ink)]">
                Activating tester access
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
                Hang tight while we set up your account.
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.45, duration: 0.6 }}
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--coral-soft)]"
              >
                <CheckCircle2 className="h-7 w-7 text-[var(--coral-lo)]" aria-hidden="true" />
              </motion.div>
              <h1 className="text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--dawn-ink)]">
                Welcome, tester
              </h1>
              <p className="mt-2 text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
                Taking you to your dashboard.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--dawn-line-2)] bg-[var(--dawn-cream)]"
              >
                <XCircle className="h-7 w-7 text-[var(--dawn-ink-2)]" aria-hidden="true" />
              </motion.div>
              <h1 className="text-balance text-[22px] font-semibold leading-[1.18] tracking-[-0.02em] text-[var(--dawn-ink)]">
                Activation didn&rsquo;t go through
              </h1>
              <p className="mx-auto mt-2 max-w-[38ch] text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
                {errorMessage}
              </p>
              <button
                onClick={() => router.push("/tester")}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--coral)] px-6 text-[14px] font-medium text-[var(--coral-ink)] transition-[background-color,transform] duration-200 hover:bg-[var(--coral-hi)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-surface)]"
              >
                Return to tester page
              </button>
            </>
          )}
        </motion.div>
      </MotionConfig>
    </div>
  )
}
