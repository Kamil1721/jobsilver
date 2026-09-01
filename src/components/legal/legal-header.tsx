"use client"

import { motion, MotionConfig } from "framer-motion"
import { geist } from "@/components/landing/fonts"

/**
 * LegalHeader — the calm, editorial title block for the Dawn legal pages
 * (Terms, Privacy). It is the ONLY animated element on these long-form
 * documents: a single gentle rise + fade on load. The body copy stays static
 * on purpose — reveal-on-scroll across a multi-page legal doc reads as jank,
 * not polish.
 *
 * This is a small client island so the page files themselves can remain server
 * components and keep their `export const metadata` (a `"use client"` file may
 * not export metadata in Next 14). Every motion prop is specified
 * unconditionally — no branching on client-only values — so SSR and hydration
 * markup match, and MotionConfig reducedMotion="user" strips the movement for
 * users who ask for less motion.
 */
export function LegalHeader({
  eyebrow,
  title,
  lastUpdated,
  effectiveDate,
}: {
  eyebrow: string
  title: string
  lastUpdated: string
  effectiveDate: string
}) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
        className={geist.className}
      >
        <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-[clamp(34px,5vw,58px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]">
          {title}
        </h1>
        <p className="mt-5 text-[14px] text-[var(--dawn-ink-2)]">
          Last updated {lastUpdated}
          <span aria-hidden="true" className="mx-2 text-[var(--dawn-ink-3)]">
            &middot;
          </span>
          Effective {effectiveDate}
        </p>
      </motion.header>
    </MotionConfig>
  )
}
