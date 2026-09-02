"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MessageSquare, FileEdit, ArrowUpRight } from "lucide-react"
import { AssistantIdentity } from "./assistant-identity"

interface AIUsage {
  aiResponses: {
    used: number
    limit: number
    unlimited: boolean
  }
  coverLetters: {
    used: number
    limit: number
    unlimited: boolean
  }
  resetsAt: string // ISO date string
}

interface UsageIndicatorProps {
  className?: string
  variant?: "compact" | "full"
}

export function UsageIndicator({ className, variant = "compact" }: UsageIndicatorProps) {
  const [usage, setUsage] = React.useState<AIUsage | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchUsage() {
      try {
        const response = await fetch("/api/ai/usage")
        if (!response.ok) {
          throw new Error("Failed to fetch usage")
        }
        // /api/ai/usage returns { data: { limits: { aiResponses: { used, limit }, ... } } }
        // — map that envelope into this component's shape (limit === -1 means unlimited).
        const payload = await response.json()
        const limits = payload?.data?.limits
        if (!limits?.aiResponses || !limits?.coverLetters) {
          throw new Error("Unexpected usage payload shape")
        }
        const endOfDay = new Date()
        endOfDay.setHours(24, 0, 0, 0) // daily quotas reset at local midnight
        setUsage({
          aiResponses: {
            used: limits.aiResponses.used,
            limit: limits.aiResponses.limit,
            unlimited: limits.aiResponses.limit === -1,
          },
          coverLetters: {
            used: limits.coverLetters.used,
            limit: limits.coverLetters.limit,
            unlimited: limits.coverLetters.limit === -1,
          },
          resetsAt: endOfDay.toISOString(),
        })
      } catch (err) {
        setError("Could not load usage")
        console.error("Failed to fetch AI usage:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsage()
    // Refresh usage every 30 seconds
    const interval = setInterval(fetchUsage, 30000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-8 w-32 bg-muted rounded-lg" />
      </div>
    )
  }

  if (error || !usage) {
    return null // Silently fail
  }

  const isLowOnResponses = !usage.aiResponses.unlimited && usage.aiResponses.used >= usage.aiResponses.limit * 0.8
  const isLowOnCoverLetters = !usage.coverLetters.unlimited && usage.coverLetters.used >= usage.coverLetters.limit * 0.8
  const isOutOfResponses = !usage.aiResponses.unlimited && usage.aiResponses.used >= usage.aiResponses.limit
  const isOutOfCoverLetters = !usage.coverLetters.unlimited && usage.coverLetters.used >= usage.coverLetters.limit

  // Calculate time until reset
  const getTimeUntilReset = () => {
    const now = new Date()
    const reset = new Date(usage.resetsAt)
    const diff = reset.getTime() - now.getTime()

    if (diff <= 0) return "soon"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-help",
                "bg-card border border-border",
                "hover:bg-muted transition-colors duration-200",
                (isLowOnResponses || isLowOnCoverLetters) && "border-amber-500/30",
                (isOutOfResponses || isOutOfCoverLetters) && "border-red-500/30",
                className
              )}
            >
              <AssistantIdentity
                size={14}
                variant="folio"
                className={cn(
                  "ring-1",
                  isOutOfResponses
                    ? "ring-red-600/50"
                    : isLowOnResponses
                      ? "ring-amber-600/50"
                      : "ring-border"
                )}
              />
              <span className={cn(
                "text-xs font-medium",
                isOutOfResponses ? "text-red-600" : isLowOnResponses ? "text-amber-600" : "text-muted-foreground"
              )}>
                {usage.aiResponses.unlimited ? (
                  <span className="text-[hsl(var(--status-offer))]">Unlimited</span>
                ) : (
                  `${usage.aiResponses.limit - usage.aiResponses.used} left`
                )}
              </span>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64 p-3">
            <UsageDetails usage={usage} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl p-4",
        "bg-card",
        "border border-border",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AssistantIdentity size={16} variant="folio" />
          <h3 className="text-sm font-medium text-foreground">AI Usage</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          Resets in {getTimeUntilReset()}
        </span>
      </div>

      <UsageDetails usage={usage} showUpgradeLink />
    </motion.div>
  )
}

function UsageDetails({ usage, showUpgradeLink = false }: { usage: AIUsage; showUpgradeLink?: boolean }) {
  const aiRemaining = usage.aiResponses.unlimited
    ? "Unlimited"
    : `${usage.aiResponses.limit - usage.aiResponses.used}`
  const coverLettersRemaining = usage.coverLetters.unlimited
    ? "Unlimited"
    : `${usage.coverLetters.limit - usage.coverLetters.used}`

  const aiPercentage = usage.aiResponses.unlimited
    ? 0
    : Math.round((usage.aiResponses.used / usage.aiResponses.limit) * 100)
  const coverLetterPercentage = usage.coverLetters.unlimited
    ? 0
    : Math.round((usage.coverLetters.used / usage.coverLetters.limit) * 100)

  const isLowOnResponses = !usage.aiResponses.unlimited && usage.aiResponses.used >= usage.aiResponses.limit * 0.8
  const isLowOnCoverLetters = !usage.coverLetters.unlimited && usage.coverLetters.used >= usage.coverLetters.limit * 0.8
  const shouldShowUpgrade = !usage.aiResponses.unlimited && (isLowOnResponses || isLowOnCoverLetters)

  return (
    <div className="space-y-3">
      {/* AI Responses */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            AI Responses
          </span>
          <span className={cn(
            "font-medium",
            usage.aiResponses.unlimited
              ? "text-[hsl(var(--status-offer))]"
              : isLowOnResponses
                ? "text-amber-500"
                : "text-foreground"
          )}>
            {aiRemaining} remaining
          </span>
        </div>
        {!usage.aiResponses.unlimited && (
          <Progress
            value={100 - aiPercentage}
            className={cn(
              "h-1.5",
              isLowOnResponses && "[&>div]:bg-amber-500"
            )}
          />
        )}
      </div>

      {/* Cover Letters */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <FileEdit className="w-3 h-3" />
            Cover Letters
          </span>
          <span className={cn(
            "font-medium",
            usage.coverLetters.unlimited
              ? "text-[hsl(var(--status-offer))]"
              : isLowOnCoverLetters
                ? "text-amber-500"
                : "text-foreground"
          )}>
            {coverLettersRemaining} remaining
          </span>
        </div>
        {!usage.coverLetters.unlimited && (
          <Progress
            value={100 - coverLetterPercentage}
            className={cn(
              "h-1.5",
              isLowOnCoverLetters && "[&>div]:bg-amber-500"
            )}
          />
        )}
      </div>

      {/* Upgrade prompt */}
      {showUpgradeLink && shouldShowUpgrade && (
        <Link
          href="/pricing"
          className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border text-xs font-medium text-[var(--coral)] hover:text-[var(--coral-lo)] transition-colors"
        >
          Upgrade for more
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

export default UsageIndicator
