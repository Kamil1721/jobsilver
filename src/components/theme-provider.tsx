"use client"

import * as React from "react"
import { ThemeContext, type Theme } from "@/lib/contexts/theme-context"

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  storageKey = "jobsilver-theme",
}: ThemeProviderProps) {
  // Dawn is a light-only product. The theme is hard-locked to "light":
  // any previously persisted "dark"/"system" preference is ignored and
  // overwritten so the whole app always renders the warm-white theme.
  const [theme] = React.useState<Theme>("light")
  const [resolvedTheme] = React.useState<"light" | "dark">("light")

  // Force the document to light on mount and overwrite any stored preference.
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
    root.style.colorScheme = "light"
    try {
      localStorage.setItem(storageKey, "light")
    } catch {
      /* ignore */
    }
  }, [storageKey])

  // Kept for API compatibility with existing callers (ThemeToggle, sign-out).
  // In the light-only product this is intentionally a no-op that re-asserts light.
  const setTheme = React.useCallback((_newTheme: Theme) => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
    root.style.colorScheme = "light"
    try {
      localStorage.setItem(storageKey, "light")
    } catch {
      /* ignore */
    }
  }, [storageKey])

  // Prevent flash by not rendering until mounted
  // The server will render with the default theme class
  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
