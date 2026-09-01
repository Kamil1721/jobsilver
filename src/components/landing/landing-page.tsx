"use client"

import { geist, geistMono } from "./fonts"
import { Nav } from "./nav"
import { DawnHero } from "./dawn-hero"
import { HowItWorks } from "./dawn-how-it-works"
import { MorningPayoff } from "./dawn-morning"
import { Features } from "./dawn-features"
import { Pricing } from "./dawn-pricing"
import { Footer } from "./dawn-footer"

/**
 * "Dawn" landing page — warm-white shell assembling the full section flow:
 * Nav → hero → how-it-works → morning payoff → features → pricing → footer.
 */
export function LandingPage() {
  return (
    <div
      data-landing="dawn"
      className={`${geist.variable} ${geistMono.variable} relative min-h-screen overflow-x-hidden`}
      style={{
        background: "var(--dawn-bg)",
        color: "var(--dawn-ink)",
        fontFamily: "var(--font-geist), system-ui, sans-serif",
      }}
    >
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-[calc(100%+16px)] rounded-full bg-[var(--dawn-ink)] px-5 py-3 text-[14px] font-semibold leading-none text-[var(--dawn-bg)] shadow-[0_12px_30px_-16px_rgba(31,27,24,0.55)] transition-transform duration-200 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none"
      >
        Skip to main content
      </a>
      <Nav />
      <main id="main-content" tabIndex={-1} className="relative z-10">
        <DawnHero />
        <HowItWorks />
        <MorningPayoff />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  )
}
