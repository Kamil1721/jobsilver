"use client"

import * as React from "react"
import { ArrowRight } from "lucide-react"
import { CopperButton } from "./copper-button"
import { SilverButton } from "./silver-button"
import { LiquidChromeText } from "./liquid-chrome-text"

export function Hero() {
  return (
    <section
      className="relative z-10"
      style={{
        paddingTop: "clamp(140px, 16vw, 200px)",
        paddingBottom: "var(--section-y)",
      }}
    >
      <div
        className="mx-auto px-6 md:px-10"
        style={{ maxWidth: "var(--content-w-wide)" }}
      >
        <div
          className="mx-auto flex flex-col items-center text-center"
          style={{ maxWidth: "880px" }}
        >
          {/* Eyebrow */}
          <div
            className="mb-9 inline-flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-3)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: "var(--copper-hi)",
                boxShadow: "0 0 12px var(--copper-glow)",
              }}
              aria-hidden="true"
            />
            <span>Live · Curated daily · Senior knowledge work</span>
          </div>

          {/* Headline — Fraunces with horizontal liquid-chrome sweep */}
          <h1
            className="font-serif font-semibold text-balance"
            style={{
              fontSize: "clamp(48px, 7.4vw, 112px)",
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              fontVariationSettings: "'opsz' 144",
            }}
          >
            <LiquidChromeText>
              Thirty-five jobs a day,
            </LiquidChromeText>
            <br />
            <LiquidChromeText>
              picked for you while you sleep.
            </LiquidChromeText>
          </h1>

          {/* Lede */}
          <p
            className="mt-8 text-pretty"
            style={{
              color: "var(--fg-2)",
              maxWidth: "640px",
              fontSize: "clamp(17px, 1.45vw, 19px)",
              lineHeight: 1.55,
            }}
          >
            JobSilver curates senior roles every morning, drafts the cover
            letter, and tracks the application. You apply on the company&apos;s
            own site. We never auto-apply.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <CopperButton href="/login" size="lg">
              Start free trial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CopperButton>
            <SilverButton href="/pricing" size="lg" variant="ghost">
              See pricing
            </SilverButton>
          </div>

          {/* Microtrust */}
          <p
            className="mt-7 text-[12px]"
            style={{ color: "var(--fg-3)" }}
          >
            Free tier requires no card. Three-day Pro trial, then $3.99/week.
            Cancel anytime from your dashboard.
          </p>
        </div>
      </div>
    </section>
  )
}
