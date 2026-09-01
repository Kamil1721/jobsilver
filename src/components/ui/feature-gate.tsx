"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { formatPlanName, type Feature } from "@/lib/features/config"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

interface FeatureGateProps {
  /** The feature to gate */
  feature: Feature
  /** How to display locked content */
  mode?: 'overlay' | 'blur' | 'disable' | 'hide' | 'button'
  /** Children to render (the gated content) */
  children: React.ReactNode
  /** Optional custom fallback for 'hide' mode */
  fallback?: React.ReactNode
  /** Optional className for the wrapper */
  className?: string
  /** Label for button mode (required when mode='button') */
  buttonLabel?: string
  /** Button variant for button mode */
  buttonVariant?: 'outline' | 'default' | 'secondary' | 'ghost' | 'link' | 'destructive'
  /** Button size for button mode */
  buttonSize?: 'sm' | 'default' | 'lg' | 'icon'
  /** Additional className for the button in button mode */
  buttonClassName?: string
}

/**
 * Feature gate component that restricts access to premium features
 * based on the user's subscription plan.
 *
 * Modes:
 * - `overlay` - Shows content with a "Pro" badge, click opens upgrade modal
 * - `blur` - Blurs content with lock icon overlay
 * - `disable` - Dims content and disables all interactions
 * - `hide` - Completely hides the content
 * - `button` - Replaces children with a locked button (requires buttonLabel prop)
 */
export function FeatureGate({
  feature,
  mode = 'overlay',
  children,
  fallback,
  className,
  buttonLabel,
  buttonVariant,
  buttonSize,
  buttonClassName,
}: FeatureGateProps) {
  const { hasAccess, requiredPlan, isLoading, showUpgradeModal } = useFeatureAccess(feature)

  // While loading, show content normally to avoid flash of locked state for paid users
  if (isLoading) {
    return <>{children}</>
  }

  // User has access, render normally
  if (hasAccess) {
    return <>{children}</>
  }

  // User doesn't have access - render based on mode
  switch (mode) {
    case 'hide':
      return fallback ? <>{fallback}</> : null

    case 'overlay':
      return (
        <div className={cn("relative", className)}>
          {/* Render children with pointer-events disabled to prevent interactions */}
          <div className="pointer-events-none">
            {children}
          </div>
          {/* Invisible overlay to capture clicks and show upgrade modal */}
          <div
            className="absolute inset-0 cursor-pointer z-[5]"
            onClick={showUpgradeModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                showUpgradeModal()
              }
            }}
          />
          {/* Overlay badge */}
          <div className="absolute top-2 right-2 z-10">
            <Badge
              variant="outline"
              className="bg-card/90 dark:bg-zinc-900/90 backdrop-blur-sm cursor-pointer hover:bg-card dark:hover:bg-zinc-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                showUpgradeModal()
              }}
            >
              <Lock className="w-3 h-3 mr-1" />
              {formatPlanName(requiredPlan)}
            </Badge>
          </div>
        </div>
      )

    case 'blur':
      return (
        <div className={cn("relative", className)}>
          <div className="blur-sm pointer-events-none select-none">
            {children}
          </div>
          {/* Lock overlay */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-card/50 dark:bg-black/50 backdrop-blur-sm cursor-pointer z-10"
            onClick={showUpgradeModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                showUpgradeModal()
              }
            }}
          >
            <div className="w-12 h-12 rounded-full bg-muted dark:bg-zinc-700 flex items-center justify-center mb-2">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <Badge variant="outline">
              {formatPlanName(requiredPlan)} Required
            </Badge>
          </div>
        </div>
      )

    case 'disable':
      return (
        <div
          className={cn(
            "relative opacity-50 pointer-events-none select-none",
            className
          )}
        >
          {children}
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="secondary">
              <Lock className="w-3 h-3 mr-1" />
              {formatPlanName(requiredPlan)}
            </Badge>
          </div>
        </div>
      )

    case 'button':
      return (
        <Button
          variant={buttonVariant || 'outline'}
          size={buttonSize || 'default'}
          className={cn("gap-1.5", buttonClassName, className)}
          onClick={showUpgradeModal}
        >
          <Lock className="w-3 h-3 opacity-60" />
          {buttonLabel}
          <Badge
            variant="outline"
            className="ml-1 text-[9px] px-1 py-0 h-4 bg-[var(--coral-soft)] text-[var(--coral-lo)] border-[var(--coral)]/30"
          >
            {formatPlanName(requiredPlan)}
          </Badge>
        </Button>
      )

    default:
      return <>{children}</>
  }
}

/**
 * Simple locked badge that can be used inline
 */
interface LockedBadgeProps {
  feature: Feature
  className?: string
}

export function LockedBadge({ feature, className }: LockedBadgeProps) {
  const { hasAccess, requiredPlan, isLoading, showUpgradeModal } = useFeatureAccess(feature)

  // If user has access, don't show badge
  if (hasAccess) return null

  // Show loading state briefly, then show badge
  // For locked features, we DO want to show the badge even during loading
  // because free users should see the upgrade prompt
  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "cursor-pointer opacity-50",
          className
        )}
      >
        <Lock className="w-3 h-3 mr-1" />
        Pro
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer hover:bg-accent dark:hover:bg-zinc-800 transition-colors",
        className
      )}
      onClick={showUpgradeModal}
    >
      <Lock className="w-3 h-3 mr-1" />
      {formatPlanName(requiredPlan)}
    </Badge>
  )
}
