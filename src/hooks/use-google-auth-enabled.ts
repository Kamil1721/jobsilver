"use client"

import * as React from "react"

interface AuthSettings {
  external?: {
    google?: boolean
  }
}

/** Reads Supabase's public auth settings and hides Google when it is unavailable. */
export function useGoogleAuthEnabled(): boolean {
  const [isEnabled, setIsEnabled] = React.useState(false)

  React.useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return

    const controller = new AbortController()

    async function loadAuthSettings() {
      try {
        const response = await fetch(
          new URL("/auth/v1/settings", supabaseUrl).toString(),
          { signal: controller.signal, cache: "no-store", credentials: "omit" }
        )

        if (!response.ok) return

        const settings = (await response.json()) as AuthSettings
        setIsEnabled(settings.external?.google === true)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setIsEnabled(false)
        }
      }
    }

    void loadAuthSettings()
    return () => controller.abort()
  }, [])

  return isEnabled
}
