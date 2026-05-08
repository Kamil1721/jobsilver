"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Check, CreditCard, Lock } from "lucide-react"
import { CopperButton } from "./copper-button"
import { SilverButton } from "./silver-button"

interface Tier {
  id: "free" | "pro" | "ultra"
  name: string
  price: string
  unit: string
  features: string[]
  cta: string
  ctaHref: string
  isRecommended?: boolean
}

const tiers: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    unit: "forever",
    features: [
      "5 jobs / day",
      "Basic tracking",
      "No AI",
      "Weekly email digest",
    ],
    cta: "Start free",
    ctaHref: "/login",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$3.99",
    unit: "/ week",
    features: [
      "15 jobs / day",
      "30 AI replies / day",
      "5 cover letters / day",
      "3 CV generations / day",
      "Advanced filters",
      "Three-day free trial",
    ],
    cta: "Try Pro free",
    ctaHref: "/login?plan=pro",
    isRecommended: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    price: "$6.99",
    unit: "/ week",
    features: [
      "35 jobs / day",
      "Unlimited AI",
      "Unlimited cover letters & CVs",
      "Priority support",
    ],
    cta: "Go Ultra",
    ctaHref: "/login?plan=ultra",
  },
]

export function PricingPreview() {
  return (
    <section
      id="pricing"
      className="relative z-10"
      style={{ paddingTop: "var(--section-y)", paddingBottom: "var(--section-y)" }}
    >
      <div
        className="mx-auto px-6 md:px-10"
        style={{ maxWidth: "var(--content-w)" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span
            className="block text-[12px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-3)" }}
          >
            Three plans
          </span>
          <h2
            className="mt-5 font-serif font-semibold text-balance"
            style={{
              fontSize: "clamp(36px, 5vw, 72px)",
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              color: "var(--fg-1)",
              fontVariationSettings: "'opsz' 96",
            }}
          >
            Pay weekly. Leave when<br />
            <span className="italic" style={{ color: "var(--fg-2)" }}>
              you&apos;re done.
            </span>
          </h2>
          <p
            className="mx-auto mt-5 text-pretty"
            style={{
              color: "var(--fg-2)",
              maxWidth: "560px",
              fontSize: "17px",
              lineHeight: 1.55,
            }}
          >
            The middle plan is what most people pick. We charge weekly
            because the job hunt is short, intense, and over.
          </p>
        </div>

        <div className="mt-20 grid gap-5 md:grid-cols-3 md:items-end md:gap-6">
          {tiers.map((tier, i) => (
            <PricingCard key={tier.id} tier={tier} index={i} />
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[13px]"
          style={{ color: "var(--fg-2)" }}
        >
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            Cancel anytime
          </span>
          <Dot />
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            No credit card to start
          </span>
          <Dot />
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4" strokeWidth={1.6} aria-hidden="true" />
            Secure payment via Stripe
          </span>
        </div>
      </div>
    </section>
  )
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1 w-1 rounded-full"
      style={{ background: "var(--fg-4)" }}
    />
  )
}

function PricingCard({ tier, index }: { tier: Tier; index: number }) {
  const isPro = tier.id === "pro"

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative flex flex-col overflow-hidden"
      style={
        isPro
          ? {
              background: "var(--silver-face-card)",
              borderRadius: 14,
              padding: "28px 26px 24px",
              minHeight: "380px",
              color: "var(--fg-on-silver)",
              boxShadow: [
                "inset 0 1px 0 rgba(255,255,255,0.85)",
                "inset 0 -1px 0 rgba(0,0,0,0.18)",
                "0 0 0 1px rgba(0,0,0,0.08)",
                "0 30px 60px rgba(0,0,0,0.5)",
              ].join(", "),
              transform: "translateY(-12px)",
            }
          : {
              background: tier.id === "free" ? "#0E0E11" : "var(--bg-raised)",
              borderRadius: 14,
              padding: "26px 24px 22px",
              minHeight: "344px",
              color: "var(--fg-1)",
              boxShadow: [
                "inset 0 1px 0 rgba(255,255,255,0.04)",
                "0 0 0 1px var(--line-1)",
                "0 16px 36px rgba(0,0,0,0.45)",
              ].join(", "),
            }
      }
    >
      {/* Hairline copper top-edge for Free; nothing for Ultra */}
      {tier.id === "free" && (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(184,115,51,0) 8%, rgba(210,144,74,0.85) 50%, rgba(184,115,51,0) 92%, transparent 100%)",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
          }}
        />
      )}

      {/* Recommended mark — Pro only */}
      {isPro && (
        <span
          className="absolute right-6 top-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em]"
          style={{ color: "rgba(24,24,27,0.55)" }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-px w-4"
            style={{ background: "#6E4220" }}
          />
          Recommended
        </span>
      )}

      {/* Eyebrow */}
      <span
        className="text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: isPro ? "rgba(24,24,27,0.55)" : "var(--fg-3)" }}
      >
        {tier.name}
      </span>

      {/* Price — solid tone only, never the 6-stop curve */}
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="font-serif font-medium leading-none"
          style={{
            fontSize: "clamp(48px, 5vw, 64px)",
            letterSpacing: "-0.035em",
            color: isPro ? "var(--copper-lo)" : "var(--silver-1)",
            fontVariantNumeric: "tabular-nums",
            fontVariationSettings: "'opsz' 144",
          }}
        >
          {tier.price}
        </span>
        <span
          className="text-[13px]"
          style={{
            color: isPro ? "rgba(24,24,27,0.55)" : "var(--fg-3)",
          }}
        >
          {tier.unit}
        </span>
      </div>

      {/* Feature list — clean k/v alignment, hairline rules */}
      <ul
        className="mt-6 flex-1 space-y-0"
        style={{
          fontSize: "13.5px",
          lineHeight: 1.5,
          color: isPro ? "rgba(24,24,27,0.78)" : "var(--fg-2)",
        }}
      >
        {tier.features.map((feat, idx) => (
          <li
            key={feat}
            className="flex items-start py-2"
            style={{
              borderTop:
                idx === 0
                  ? "none"
                  : `1px solid ${isPro ? "rgba(24,24,27,0.10)" : "var(--line-1)"}`,
            }}
          >
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      {/* CTA — copper-face for Pro, silver-face-button for Ultra, ghost for Free */}
      <div className="mt-7 flex justify-center">
        {tier.id === "pro" ? (
          <CopperButton href={tier.ctaHref} size="md" pulseOnMount={false} className="w-full justify-center">
            {tier.cta}
          </CopperButton>
        ) : tier.id === "ultra" ? (
          <SilverButton href={tier.ctaHref} size="md" variant="silver" className="w-full">
            {tier.cta}
          </SilverButton>
        ) : (
          <SilverButton href={tier.ctaHref} size="md" variant="ghost" className="w-full">
            {tier.cta}
          </SilverButton>
        )}
      </div>
    </motion.article>
  )
}
