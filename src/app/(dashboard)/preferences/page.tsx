"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Redirect /preferences to /profile?tab=preferences
 * This page exists to handle direct navigation to /preferences
 */
export default function PreferencesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/profile?tab=preferences")
  }, [router])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        <p className="text-sm text-zinc-500">Redirecting to preferences...</p>
      </div>
    </div>
  )
}
