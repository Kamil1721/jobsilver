"use client"

import { useReducedMotion } from "framer-motion"
import { useHydrated } from "@/hooks/use-hydrated"

/**
 * Keeps server-rendered marketing content visible until hydration succeeds.
 * The changing key lets Motion apply its reveal pose only after the client is
 * ready, while reduced-motion and failed/no-JS clients retain the static view.
 */
export function useProgressiveReveal() {
  const hasHydrated = useHydrated()
  const shouldReduceMotion = useReducedMotion()

  const enabled = hasHydrated && shouldReduceMotion === false

  return {
    enabled,
    motionKey: enabled ? "animated" : "static",
  } as const
}
