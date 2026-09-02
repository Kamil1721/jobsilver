"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TesterBadgeProps {
  className?: string
  showTooltip?: boolean
  variant?: "default" | "compact"
}

export function TesterBadge({
  className,
  showTooltip = true,
  variant = "default",
}: TesterBadgeProps) {
  const badge = (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      tabIndex={showTooltip ? 0 : undefined}
      className={cn(
        "inline-flex items-center font-semibold uppercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--coral)]/45 focus-visible:ring-offset-2",
        variant === "default"
          ? "gap-1.5 rounded-md border border-[var(--coral)]/20 bg-[var(--dawn-cream)] px-2.5 py-1 text-[10px] text-[var(--coral-lo)]"
          : "gap-1 rounded-[0.3rem] bg-[var(--coral-soft)] px-1.5 py-0.5 text-[9px] text-[var(--coral-lo)]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0 rounded-full bg-[var(--coral)]",
          variant === "default" ? "h-1.5 w-1.5" : "h-1 w-1"
        )}
      />
      <span>Tester</span>
    </motion.span>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="bg-popover text-popover-foreground border-border max-w-[200px]"
        >
          <p className="text-xs">
            You have early access to new features as a beta tester. Thank you for helping us improve!
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
