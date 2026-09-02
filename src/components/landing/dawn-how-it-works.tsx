"use client"

import { motion, MotionConfig } from "framer-motion"
import { geist } from "./fonts"
import { useProgressiveReveal } from "./use-progressive-reveal"

const steps = [
  {
    number: "01",
    timing: "Set up once",
    title: "Choose what fits",
    body: "Add the roles, locations, seniority, and salary range you want JobSilver to use.",
  },
  {
    number: "02",
    timing: "Each morning",
    title: "Review your morning shortlist",
    body: "Fresh roles arrive in one focused view so you can decide which postings are worth opening.",
  },
  {
    number: "03",
    timing: "When one stands out",
    title: "Prepare the application",
    body: "Tailor your CV and cover letter, review the result, then finish on the employer's site.",
  },
]

const ease = [0.16, 1, 0.3, 1] as const
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
}

export function HowItWorks() {
  const reveal = useProgressiveReveal()

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-h"
      className={`${geist.className} bg-[var(--dawn-bg)] scroll-mt-24`}
    >
      <MotionConfig reducedMotion="user">
        <div className="mx-auto grid max-w-[var(--dawn-content)] gap-12 px-[var(--dawn-gutter)] py-[var(--dawn-section)] lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <motion.div
            key={`intro-${reveal.motionKey}`}
            initial={reveal.enabled ? "hidden" : false}
            whileInView={reveal.enabled ? "show" : undefined}
            viewport={{ once: true, margin: "-80px" }}
            className="max-w-[46ch]"
          >
            <motion.p
              variants={item}
              className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]"
            >
              How it works
            </motion.p>
            <motion.h2
              id="how-it-works-h"
              variants={item}
              className="mt-3 max-w-[13ch] text-balance text-[clamp(32px,4vw,48px)] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--dawn-ink)]"
            >
              A smaller job search, every day.
            </motion.h2>
            <motion.p
              variants={item}
              className="mt-5 max-w-[44ch] text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.62] text-[var(--dawn-ink-2)]"
            >
              JobSilver checks direct company sources overnight and turns the
              results into a shortlist you can review over coffee.
            </motion.p>
          </motion.div>

          <motion.ol
            key={`steps-${reveal.motionKey}`}
            initial={reveal.enabled ? "hidden" : false}
            whileInView={reveal.enabled ? "show" : undefined}
            viewport={{ once: true, margin: "-80px" }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09 } },
            }}
            className="border-t border-[var(--dawn-line-2)]"
          >
            {steps.map((step) => (
              <motion.li
                key={step.number}
                variants={item}
                className="grid gap-3 border-b border-[var(--dawn-line)] py-7 sm:grid-cols-[72px_150px_1fr] sm:gap-5 sm:py-8"
              >
                <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--coral-lo)]">
                  {step.number}
                </span>
                <p className="text-[13px] font-medium leading-[1.5] text-[var(--dawn-ink-2)]">
                  {step.timing}
                </p>
                <div>
                  <h3 className="text-[19px] font-semibold tracking-[-0.015em] text-[var(--dawn-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
                    {step.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </MotionConfig>
    </section>
  )
}
