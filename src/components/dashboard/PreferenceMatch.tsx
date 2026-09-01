"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, ChevronDown, Target, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PreferenceMatchProps {
  reasons: string[]
  score: number // 0-1 preference match score
  size?: "sm" | "md" | "lg"
  showReasons?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    badge: "h-5 px-1.5 text-[10px]",
    icon: "w-2.5 h-2.5",
    gap: "gap-0.5",
  },
  md: {
    badge: "h-6 px-2 text-xs",
    icon: "w-3 h-3",
    gap: "gap-1",
  },
  lg: {
    badge: "h-7 px-2.5 text-sm",
    icon: "w-3.5 h-3.5",
    gap: "gap-1.5",
  },
}

// Score-based color theming
function getScoreTheme(score: number) {
  const percentage = Math.round(score * 100)

  if (percentage >= 85) {
    return {
      bg: "bg-[var(--coral-soft)]",
      border: "border-[var(--coral-soft)]",
      text: "text-[var(--coral-lo)]",
      glow: "shadow-[var(--coral-soft)]",
      label: "Excellent match",
    }
  } else if (percentage >= 70) {
    return {
      bg: "bg-teal-500/10 dark:bg-teal-500/15",
      border: "border-teal-500/20 dark:border-teal-500/30",
      text: "text-teal-700 dark:text-teal-400",
      glow: "shadow-teal-500/10",
      label: "Great match",
    }
  } else if (percentage >= 55) {
    return {
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/20 dark:border-amber-500/30",
      text: "text-amber-700 dark:text-amber-400",
      glow: "shadow-amber-500/10",
      label: "Good match",
    }
  } else {
    return {
      bg: "bg-muted dark:bg-zinc-500/15",
      border: "border-border dark:border-zinc-500/30",
      text: "text-muted-foreground dark:text-zinc-400",
      glow: "shadow-zinc-500/10",
      label: "Partial match",
    }
  }
}

export function PreferenceMatch({
  reasons,
  score,
  size = "md",
  showReasons = false,
  className,
}: PreferenceMatchProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const config = sizeConfig[size]
  const theme = getScoreTheme(score)
  const percentage = Math.round(score * 100)

  const badgeContent = (
    <motion.div
      className={cn(
        "relative flex items-center rounded-full border font-medium cursor-pointer transition-all duration-200",
        config.badge,
        config.gap,
        theme.bg,
        theme.border,
        theme.text,
        "hover:shadow-md",
        theme.glow,
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        if (showReasons && reasons.length > 0) {
          setIsExpanded(!isExpanded)
        }
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Sparkles className={cn(config.icon, "flex-shrink-0")} />
      <span className="font-semibold tabular-nums">{percentage}%</span>
      {showReasons && reasons.length > 0 && (
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className={cn(config.icon, "flex-shrink-0 opacity-60")} />
        </motion.div>
      )}
    </motion.div>
  )

  // If showing inline expanded reasons
  if (showReasons) {
    return (
      <div className="relative">
        {badgeContent}
        <AnimatePresence>
          {isExpanded && reasons.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "absolute top-full left-0 mt-1 z-50 min-w-[200px] p-2 rounded-lg border shadow-lg",
                "bg-popover dark:bg-zinc-900",
                "border-border dark:border-white/[0.08]"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Target className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground dark:text-zinc-400 uppercase tracking-wider">
                  {theme.label}
                </span>
              </div>
              <ul className="space-y-1">
                {reasons.map((reason, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground dark:text-zinc-300"
                  >
                    <Check className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-500" />
                    <span>{reason}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Tooltip version for compact display
  if (reasons.length === 0) {
    return badgeContent
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[250px] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className={cn("w-3.5 h-3.5", theme.text)} />
              <span className={cn("text-xs font-semibold", theme.text)}>
                {percentage}% Match - {theme.label}
              </span>
            </div>
            <ul className="space-y-1">
              {reasons.map((reason, index) => (
                <li
                  key={index}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground dark:text-zinc-300"
                >
                  <Check className="w-3 h-3 flex-shrink-0 mt-0.5 text-emerald-500" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default PreferenceMatch
