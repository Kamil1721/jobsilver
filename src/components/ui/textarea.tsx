import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200",
          // Light mode styles
          "bg-white border-zinc-200 text-zinc-900",
          "placeholder:text-zinc-400",
          "hover:border-zinc-300",
          "focus:outline-none focus:ring-2 focus:ring-zinc-200 focus:ring-offset-0 focus:border-zinc-400",
          // Dark mode styles
          "dark:bg-white/[0.02] dark:border-white/[0.06] dark:text-white",
          "dark:placeholder:text-zinc-500",
          "dark:hover:border-white/[0.10]",
          "dark:focus:ring-white/[0.08] dark:focus:border-white/[0.12]",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
