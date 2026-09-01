"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type BillingCycle = "weekly" | "monthly"

interface PricingToggleProps {
  billingCycle: BillingCycle
  onToggle: (cycle: BillingCycle) => void
}

export function PricingToggle({ billingCycle, onToggle }: PricingToggleProps) {
  const options: { value: BillingCycle; label: string; subtext?: string }[] = [
    { value: "weekly", label: "Weekly", subtext: "Flexible" },
    { value: "monthly", label: "Monthly", subtext: "Save ~25%" },
  ]

  return (
    <div className="inline-flex items-center rounded-full bg-muted/50 border border-border/50 p-1.5 gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onToggle(option.value)}
          className={cn(
            "relative px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            billingCycle === option.value
              ? "text-[var(--coral-ink)]"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={`Switch to ${option.label.toLowerCase()} billing`}
        >
          {billingCycle === option.value && (
            <motion.div
              layoutId="billing-toggle"
              className="absolute inset-0 rounded-full bg-[var(--coral)]"
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
            />
          )}
          <span className="relative z-10 flex flex-col items-center">
            <span>{option.label}</span>
            {option.subtext && (
              <span className={cn(
                "text-[10px] mt-0.5",
                billingCycle === option.value
                  ? "text-[var(--coral-ink)]/80"
                  : "text-muted-foreground"
              )}>
                {option.subtext}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
