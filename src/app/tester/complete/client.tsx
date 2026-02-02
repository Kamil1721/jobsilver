"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
      } catch (error) {
        setStatus("error")
        setErrorMessage("An unexpected error occurred. Please try again.")
      }
    }

    applyTesterStatus()
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Activating Tester Access</h1>
            <p className="text-zinc-400">Please wait while we set up your account...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Welcome, Tester!</h1>
            <p className="text-zinc-400">Redirecting to your dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Activation Failed</h1>
            <p className="text-zinc-400 mb-4">{errorMessage}</p>
            <button
              onClick={() => router.push("/tester")}
              className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors"
            >
              Return to Tester Page
            </button>
          </>
        )}
      </div>
    </div>
  )
}
