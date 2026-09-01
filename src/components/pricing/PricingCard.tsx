"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Check, X, Sparkles, Zap, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { BillingCycle } from "./PricingToggle"

export interface PricingFeature {
  name: string
  included: boolean
  highlight?: boolean
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  weeklyPrice: number
  monthlyPrice: number
  features: PricingFeature[]
  cta: string
  highlighted?: boolean
  badge?: string
  icon: React.ElementType
  jobsPerDay: number
  hasAI: boolean
  aiResponsesPerDay?: number | null // -1 = unlimited, null = no access
  coverLettersPerDay?: number | null
  cvGenerationsPerDay?: number | null
  hasTrial?: boolean
  trialDays?: number
}

interface PricingCardProps {
  plan: PricingPlan
  billingCycle: BillingCycle
  onSelect: (planId: string, billingCycle: BillingCycle) => void
  isLoading?: boolean
  isCurrentPlan?: boolean
  index: number
}

export function PricingCard({
  plan,
  billingCycle,
  onSelect,
  isLoading,
  isCurrentPlan,
  index,
}: PricingCardProps) {
  const price = billingCycle === "weekly" ? plan.weeklyPrice : plan.monthlyPrice
  const periodLabel = billingCycle === "weekly" ? "/week" : "/month"
  const Icon = plan.icon

  // Calculate monthly equivalent for weekly
  const monthlyEquivalent = billingCycle === "weekly" && plan.weeklyPrice > 0
    ? (plan.weeklyPrice * 4).toFixed(2)
    : null

  // Calculate savings for monthly vs weekly
  const monthlySavings = plan.weeklyPrice > 0 && plan.monthlyPrice > 0
    ? ((plan.weeklyPrice * 4) - plan.monthlyPrice).toFixed(2)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className={cn(
        "relative flex flex-col rounded-2xl border transition-all duration-300",
        plan.highlighted
          ? "border-[var(--coral)] ring-1 ring-[var(--coral)] bg-gradient-to-b from-[var(--coral-soft)] to-transparent shadow-lg shadow-[rgba(240,96,58,0.12)]"
          : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50",
        "group"
      )}
    >
      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--coral)] text-[var(--coral-ink)] text-xs font-semibold shadow-lg shadow-[rgba(240,96,58,0.25)]">
            <Sparkles className="w-3.5 h-3.5" />
            {plan.badge}
          </div>
        </div>
      )}

      <div className="p-6 pb-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {/* Current Plan Badge - positioned inline with plan name */}
              {isCurrentPlan && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral-soft)] border border-[var(--coral)]/30 text-[var(--coral)] text-xs font-medium">
                  <Check className="w-3 h-3" />
                  Current
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          </div>
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200",
              plan.highlighted
                ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tight">
              {price === 0 ? "Free" : `$${price}`}
            </span>
            {price > 0 && (
              <span className="text-muted-foreground text-sm">{periodLabel}</span>
            )}
          </div>

          {/* Monthly equivalent or savings */}
          {billingCycle === "weekly" && monthlyEquivalent && (
            <p className="text-xs text-muted-foreground mt-1">
              ${monthlyEquivalent}/month if paid weekly
            </p>
          )}
          {billingCycle === "monthly" && monthlySavings && parseFloat(monthlySavings) > 0 && (
            <p className="text-xs text-[var(--coral)] mt-1">
              Save ${monthlySavings}/mo vs weekly
            </p>
          )}

          {/* Trial badge - only for plans with trial */}
          {plan.hasTrial && plan.trialDays && price > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--coral-soft)] border border-[var(--coral)]/30">
              <span className="text-xs font-medium text-[var(--coral)]">
                {plan.trialDays}-day free trial
              </span>
            </div>
          )}
        </div>

        {/* Jobs per day - PRIMARY METRIC in 3-tier model */}
        <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="text-center">
            <span className="text-2xl font-bold text-foreground">
              {plan.jobsPerDay}
            </span>
            <span className="text-sm text-muted-foreground ml-1">
              jobs/day
            </span>
          </div>
          <p className="text-xs text-center mt-1">
            {plan.hasAI ? (
              plan.aiResponsesPerDay === -1 ? (
                <span className="flex items-center justify-center gap-1.5 text-[var(--coral)]">
                  <Sparkles className="w-3 h-3" />
                  Unlimited AI assistance
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {plan.aiResponsesPerDay} AI responses/day
                </span>
              )
            ) : (
              <span className="text-muted-foreground">AI features require Pro</span>
            )}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex-1 p-6 pt-0">
        <div className="border-t border-border/50 pt-4">
          <ul className="space-y-2.5">
            {plan.features.map((feature, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-3 text-sm",
                  !feature.included && "opacity-50"
                )}
              >
                {feature.included ? (
                  <div
                    className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--coral-soft)] text-[var(--coral-lo)]"
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                ) : (
                  <div className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                    <X className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                )}
                <span
                  className={cn(
                    feature.highlight && feature.included && "text-foreground font-medium"
                  )}
                >
                  {feature.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA */}
      <div className="p-6 pt-0">
        <Button
          onClick={() => onSelect(plan.id, billingCycle)}
          disabled={isLoading || isCurrentPlan}
          className={cn(
            "w-full h-11 font-medium transition-all duration-200",
            plan.highlighted
              ? "bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] shadow-lg shadow-[rgba(240,96,58,0.20)]"
              : "bg-muted/50 hover:bg-muted text-foreground border border-border/50 hover:border-border"
          )}
          variant={plan.highlighted ? "default" : "outline"}
        >
          {isCurrentPlan
            ? "Current Plan"
            : isLoading
            ? "Loading..."
            : plan.hasTrial && price > 0
            ? `Start ${plan.trialDays}-Day Free Trial`
            : plan.cta
          }
        </Button>
      </div>
    </motion.div>
  )
}

import { Crown } from "lucide-react"

/**
 * 3-Tier Pricing Structure (February 2026)
 *
 * Free: 3 jobs/day, NO AI access
 * Pro: 15 jobs/day, limited AI (30 responses, 5 cover letters, 3 CV gen per day)
 * Ultra: 35 jobs/day, UNLIMITED AI, priority support
 *
 * Pro has 3-day free trial, pricing: $3.99/week or $12.99/month
 * Ultra has NO trial (immediate charge), pricing: $6.99/week or $19.99/month
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with job discovery",
    weeklyPrice: 0,
    monthlyPrice: 0,
    jobsPerDay: 3,
    hasAI: false,
    aiResponsesPerDay: null,
    coverLettersPerDay: null,
    cvGenerationsPerDay: null,
    icon: Zap,
    cta: "Start Free",
    features: [
      { name: "3 jobs discovered per day", included: true },
      { name: "Kanban job tracking board", included: true },
      { name: "Save up to 50 jobs", included: true },
      { name: "Basic job match scores", included: true },
      { name: "Advanced filters", included: false },
      { name: "AI chat assistance", included: false },
      { name: "Cover letter generation", included: false },
      { name: "CV generation", included: false },
      { name: "Favorite jobs", included: false },
      { name: "Email alerts", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "AI assistance with daily limits",
    weeklyPrice: 3.99,
    monthlyPrice: 12.99,
    jobsPerDay: 15,
    hasAI: true,
    aiResponsesPerDay: 30,
    coverLettersPerDay: 5,
    cvGenerationsPerDay: 3,
    icon: Rocket,
    cta: "Subscribe",
    highlighted: true,
    badge: "3-Day Free Trial",
    hasTrial: true,
    trialDays: 3,
    features: [
      { name: "15 jobs discovered per day", included: true },
      { name: "30 AI responses per day", included: true },
      { name: "5 cover letters per day", included: true },
      { name: "3 CV generations per day", included: true },
      { name: "Save up to 200 jobs", included: true },
      { name: "Advanced filters", included: true },
      { name: "Favorite jobs", included: true },
      { name: "Daily email alerts", included: true },
      { name: "Priority support", included: false },
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "Unlimited AI for power users",
    weeklyPrice: 6.99,
    monthlyPrice: 19.99,
    jobsPerDay: 35,
    hasAI: true,
    aiResponsesPerDay: -1, // unlimited
    coverLettersPerDay: -1,
    cvGenerationsPerDay: -1,
    icon: Crown,
    cta: "Subscribe",
    hasTrial: false,
    features: [
      { name: "35 jobs discovered per day", included: true },
      { name: "Unlimited AI chat assistance", included: true, highlight: true },
      { name: "Unlimited cover letters", included: true, highlight: true },
      { name: "Unlimited CV generations", included: true, highlight: true },
      { name: "Unlimited saved jobs", included: true },
      { name: "Advanced filters", included: true },
      { name: "Favorite jobs", included: true },
      { name: "Daily email alerts", included: true },
      { name: "Priority support", included: true, highlight: true },
    ],
  },
]
