"use client"

import { Suspense, lazy } from "react"

// Reference the existing production AI-Powered Applications demo so the
// new landing page surfaces it without re-implementing the animation.
// FeatureVideoPlayer already handles SSR, prefers-reduced-motion, and
// the static aspect-ratio fallback.
const FeatureVideoPlayer = lazy(
  () => import("@/components/video/FeatureVideoPlayer"),
)

export function AIDemoEmbed() {
  return (
    <Suspense
      fallback={
        <div
          className="aspect-[5/3] w-full"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--line-1)",
            borderRadius: 14,
          }}
          aria-label="Loading product demo"
        />
      }
    >
      <FeatureVideoPlayer feature="application-flow" />
    </Suspense>
  )
}
