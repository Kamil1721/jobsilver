"use client"

import { useState } from "react"
import { motion, MotionConfig } from "framer-motion"
import { CtaButton } from "./cta-button"
import { useProgressiveReveal } from "./use-progressive-reveal"

type Billing = "weekly" | "monthly"

interface Plan {
  id: "free" | "pro" | "ultra"
  name: string
  tagline: string
  weekly: number
  monthly: number
  recommended: boolean
  features: string[]
  cta: { label: string; variant: "coral" | "ghost" }
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "A focused place to start your search.",
    weekly: 0,
    monthly: 0,
    recommended: false,
    features: [
      "3 jobs discovered per day",
      "Basic match scores",
      "Kanban tracking board",
      "Save up to 50 jobs",
      "Open roles on employer sites",
    ],
    cta: { label: "Start free", variant: "ghost" },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "More daily matches, plus tailored application tools.",
    weekly: 3.99,
    monthly: 12.99,
    recommended: true,
    features: [
      "15 jobs discovered per day",
      "30 AI responses per day",
      "5 cover letters per day",
      "3 CV generations per day",
      "Daily email alerts",
      "3-day free trial",
    ],
    cta: {
      label: "Start 3-day trial",
      variant: "coral",
    },
  },
  {
    id: "ultra",
    name: "Ultra",
    tagline: "A broader search with unlimited AI support.",
    weekly: 6.99,
    monthly: 19.99,
    recommended: false,
    features: [
      "35 jobs discovered per day",
      "Unlimited AI chat assistance",
      "Unlimited cover letters",
      "Unlimited CV generations",
      "Unlimited saved jobs",
      "Daily email alerts",
      "Priority support",
    ],
    cta: {
      label: "Choose Ultra",
      variant: "ghost",
    },
  },
]

const ease = [0.16, 1, 0.3, 1] as const

function formatPrice(value: number): string {
  return value === 0 ? "$0" : `$${value.toFixed(2)}`
}

function CheckGlyph() {
  return (
    <span
      aria-hidden="true"
      className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--coral-soft)] text-[10px] font-bold leading-none text-[var(--coral-lo)]"
    >
      ✓
    </span>
  )
}

function PlanCard({
  plan,
  billing,
  reveal,
}: {
  plan: Plan
  billing: Billing
  reveal: ReturnType<typeof useProgressiveReveal>
}) {
  const isFree = plan.weekly === 0
  const price = billing === "weekly" ? plan.weekly : plan.monthly
  const unit = billing === "weekly" ? "/ week" : "/ month"
  const checkoutPath = `/checkout-redirect?plan=${plan.id}&cycle=${billing}`
  const ctaHref = isFree
    ? "/login"
    : `/login?next=${encodeURIComponent(checkoutPath)}`
  const alternate =
    billing === "weekly"
      ? `${formatPrice(plan.monthly)} billed monthly`
      : `${formatPrice(plan.weekly)} billed weekly`

  return (
    <motion.article
      key={`${plan.id}-${reveal.motionKey}`}
      initial={reveal.enabled ? { opacity: 0, y: 16 } : false}
      whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease }}
      className={`relative flex h-full flex-col rounded-[20px] border bg-[var(--dawn-surface)] p-6 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none sm:p-7 ${
        plan.recommended
          ? "border-[var(--coral)] shadow-[0_24px_60px_-38px_rgba(201,68,37,0.5)]"
          : "border-[var(--dawn-line)] shadow-[0_12px_34px_-30px_rgba(31,27,24,0.35)]"
      }`}
    >
      {plan.recommended ? (
        <span className="absolute right-5 top-5 rounded-full bg-[var(--coral)] px-3 py-1.5 text-[11px] font-semibold text-[var(--coral-ink)]">
          Most popular
        </span>
      ) : null}

      <h3 className="pr-24 text-[20px] font-semibold tracking-[-0.015em] text-[var(--dawn-ink)]">
        {plan.name}
      </h3>
      <p className="mt-2 min-h-[48px] text-[15px] leading-[1.55] text-[var(--dawn-ink-2)]">
        {plan.tagline}
      </p>

      <div className="mt-6 border-y border-[var(--dawn-line)] py-6">
        <motion.div
          key={`${plan.id}-${billing}-${reveal.motionKey}`}
          initial={reveal.enabled ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[clamp(34px,3.6vw,44px)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--dawn-ink)]">
              {formatPrice(price)}
            </span>
            <span className="text-[14px] text-[var(--dawn-ink-2)]">
              {isFree ? "/ forever" : unit}
            </span>
          </div>
          <p className="mt-2 min-h-5 text-[13px] text-[var(--dawn-ink-2)]">
            {isFree ? "No card required" : `or ${alternate}`}
          </p>
        </motion.div>
      </div>

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckGlyph />
            <span className="text-[14px] leading-[1.55] text-[var(--dawn-ink-2)]">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8 [&>a]:w-full">
        <CtaButton href={ctaHref} variant={plan.cta.variant} size="md">
          {plan.cta.label}
        </CtaButton>
      </div>
    </motion.article>
  )
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("weekly")
  const reveal = useProgressiveReveal()

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-h"
      className="overflow-hidden bg-[var(--dawn-cream)]"
    >
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <motion.div
              key={`intro-${reveal.motionKey}`}
              initial={reveal.enabled ? { opacity: 0, y: 14 } : false}
              whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease }}
              className="max-w-[58ch]"
            >
              <h2
                id="pricing-h"
                className="max-w-[15ch] text-balance text-[clamp(32px,4vw,48px)] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--dawn-ink)]"
              >
                Start free. Add more when you need it.
              </h2>
              <p className="mt-5 max-w-[54ch] text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.62] text-[var(--dawn-ink-2)]">
                Choose weekly billing for a shorter search or monthly billing for
                a longer run. You can cancel at any time.
              </p>
            </motion.div>

            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-1"
            >
              {(["weekly", "monthly"] as const).map((period) => {
                const active = billing === period
                return (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setBilling(period)}
                    className={`relative min-h-11 rounded-full px-5 text-[14px] font-semibold capitalize transition-colors duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-cream)] motion-reduce:transition-none ${
                      active
                        ? "bg-[var(--coral)] text-[var(--coral-ink)]"
                        : "text-[var(--dawn-ink-2)] hover:bg-[var(--dawn-cream)] hover:text-[var(--dawn-ink)]"
                    }`}
                  >
                    {period}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-11 grid items-stretch gap-5 md:grid-cols-3 lg:grid-cols-[0.9fr_1.12fr_0.98fr]">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billing={billing}
                reveal={reveal}
              />
            ))}
          </div>

          <p className="mt-10 text-[13px] leading-[1.6] text-[var(--dawn-ink-2)]">
            Free needs no card. Stripe handles billing, and you can cancel anytime.
          </p>
        </div>
      </MotionConfig>
    </section>
  )
}
