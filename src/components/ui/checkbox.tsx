"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-5 w-5 shrink-0 rounded border-2 transition-all duration-200",
      "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Light mode
      "border-input data-[state=checked]:bg-[var(--coral)] data-[state=checked]:border-[var(--coral)] data-[state=checked]:text-[var(--coral-ink)]",
      "focus-visible:ring-[var(--coral)]",
      // Dark mode - inverted (white check on dark)
      "dark:border-white/20 dark:data-[state=checked]:bg-white dark:data-[state=checked]:border-white dark:data-[state=checked]:text-zinc-900",
      "dark:focus-visible:ring-white/20",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
