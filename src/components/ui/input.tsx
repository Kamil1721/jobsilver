import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200",
          // Light mode styles
          "bg-card border-input text-foreground",
          "placeholder:text-muted-foreground",
          "hover:border-input",
          "focus:outline-none focus:ring-2 focus:ring-[var(--coral)] focus:ring-offset-0 focus:border-[var(--coral)]",
          // Dark mode styles
          "dark:bg-white/[0.02] dark:border-white/[0.06] dark:text-white",
          "dark:placeholder:text-zinc-500",
          "dark:hover:border-white/[0.10]",
          "dark:focus:ring-white/[0.08] dark:focus:border-white/[0.12]",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
