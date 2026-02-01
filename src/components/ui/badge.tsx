import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-900 text-white dark:bg-white dark:text-zinc-900",
        secondary:
          "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/[0.06] dark:bg-white/[0.05] dark:text-zinc-300",
        destructive:
          "border-transparent bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        outline:
          "text-zinc-700 border-zinc-200 dark:text-zinc-300 dark:border-white/[0.08]",
        success:
          "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        warning:
          "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        info:
          "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
        // Metallic badge for premium/special items
        metallic:
          "border-white/[0.08] bg-gradient-to-r from-zinc-800/50 via-zinc-700/50 to-zinc-800/50 text-zinc-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
