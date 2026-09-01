"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Zap, Clock } from "lucide-react"
import type { QuotaStatus } from "@/lib/supabase/types"

interface QuotaDisplayProps {
  quota: QuotaStatus | null
  className?: string
}

export function QuotaDisplay({ quota, className }: QuotaDisplayProps) {
  if (!quota) return null

  const used = quota.jobs_fetched_today
  const limit = quota.limit
  const remaining = quota.remaining
  const percentUsed = Math.round((used / limit) * 100)
  const isExhausted = remaining === 0

  // Calculate time until reset (next midnight UTC)
  const getTimeUntilReset = () => {
    if (!quota.resets_at) {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setUTCHours(24, 0, 0, 0)
      const diff = tomorrow.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return `${hours}h ${minutes}m`
    }
    const resetDate = new Date(quota.resets_at)
    const now = new Date()
    const diff = resetDate.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-lg border",
        isExhausted
          ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
          : remaining <= 5
          ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20"
          : "bg-card dark:bg-white/[0.03] border-border dark:border-white/[0.06]",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Zap
          className={cn(
            "w-4 h-4",
            isExhausted
              ? "text-red-500 dark:text-red-400"
              : remaining <= 5
              ? "text-amber-500 dark:text-amber-400"
              : "text-muted-foreground dark:text-zinc-400"
          )}
        />
        <span className={cn(
          "text-sm font-medium whitespace-nowrap",
          isExhausted
            ? "text-red-600 dark:text-red-400"
            : remaining <= 5
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground dark:text-zinc-300"
        )}>
          {remaining}/{limit}
        </span>
      </div>

      <div className="hidden sm:block flex-1 max-w-[80px]">
        <Progress
          value={percentUsed}
          className={cn(
            "h-1.5 bg-muted dark:bg-white/[0.05]",
            isExhausted
              ? "[&>div]:bg-red-500 dark:[&>div]:bg-red-400"
              : remaining <= 5
              ? "[&>div]:bg-amber-500 dark:[&>div]:bg-amber-400"
              : "[&>div]:bg-[var(--coral)] dark:[&>div]:bg-zinc-400"
          )}
        />
      </div>

      {isExhausted && (
        <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
          <Clock className="w-3 h-3" />
          <span>{getTimeUntilReset()}</span>
        </div>
      )}
    </div>
  )
}
