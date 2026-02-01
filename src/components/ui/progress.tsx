"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        // Light mode
        "bg-zinc-200",
        // Dark mode
        "dark:bg-white/[0.05]",
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      {...props}
    >
      <div
        className={cn(
          "h-full transition-all duration-200",
          // Light mode
          "bg-zinc-900",
          // Dark mode - metallic
          "dark:bg-gradient-to-r dark:from-zinc-400 dark:via-zinc-300 dark:to-zinc-400"
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
)
Progress.displayName = "Progress"

export { Progress }
