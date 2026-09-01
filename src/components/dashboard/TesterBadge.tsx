"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { FlaskConical, Sparkles } from "lucide-react"
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
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        variant === "default"
          ? "px-2.5 py-1 rounded-lg text-xs bg-[var(--coral-soft)] text-[var(--coral)] border border-[var(--coral)]/20"
          : "px-1.5 py-0.5 rounded text-[10px] bg-[var(--coral-soft)] text-[var(--coral)]",
        className
      )}
    >
      <FlaskConical className={cn(variant === "default" ? "w-3.5 h-3.5" : "w-2.5 h-2.5")} />
      <span>Tester</span>
      {variant === "default" && (
        <Sparkles className="w-3 h-3 text-[var(--coral)]" />
      )}
    </motion.div>
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
