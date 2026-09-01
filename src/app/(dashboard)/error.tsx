"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RefreshCcw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  React.useEffect(() => {
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background dark:bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground dark:text-white mb-2">
          Something went wrong
        </h1>

        <p className="text-muted-foreground dark:text-zinc-400 mb-6">
          We encountered an error while loading this page. Please try again.
        </p>

        {error.digest && (
          <p className="text-xs text-muted-foreground dark:text-zinc-500 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            variant="default"
            className="gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </Button>

          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
