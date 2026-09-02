"use client"

import { motion, MotionConfig } from "framer-motion"
import { CtaButton } from "./cta-button"
import { geist } from "./fonts"
import { useProgressiveReveal } from "./use-progressive-reveal"

const sources = ["Greenhouse", "Lever", "Ashby", "Other sources"]
const preferences = ["Product design", "Remote", "Senior level"]
const shortlist = [
  {
    rank: "01",
    role: "Product designer",
    details: ["Remote", "Greenhouse", "Posted today"],
  },
  {
    rank: "02",
    role: "Frontend engineer",
    details: ["Hybrid", "Lever", "Posted today"],
  },
  {
    rank: "03",
    role: "Growth marketer",
    details: ["London", "Ashby", "Posted yesterday"],
  },
]

const ease = [0.16, 1, 0.3, 1] as const

export function MorningPayoff() {
  const reveal = useProgressiveReveal()

  return (
    <section
      id="sample-shortlist"
      aria-labelledby="sample-shortlist-h"
      className={`${geist.className} scroll-mt-20 overflow-hidden bg-[var(--dawn-cream)]`}
    >
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
            <motion.div
              key={`intro-${reveal.motionKey}`}
              initial={reveal.enabled ? { opacity: 0, y: 14 } : false}
              whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, ease }}
              className="max-w-[48ch]"
            >
              <h2
                id="sample-shortlist-h"
                className="max-w-[12ch] text-balance text-[clamp(32px,4vw,48px)] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--dawn-ink)]"
              >
                The noise resolves before breakfast.
              </h2>
              <p className="mt-5 text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.62] text-[var(--dawn-ink-2)]">
                JobSilver puts fresh roles from direct job sources in one
                focused view. Each role keeps a clear path back to the original
                posting.
              </p>
              <div className="mt-7">
                <CtaButton href="/login" variant="ghost" size="md">
                  Build my shortlist
                </CtaButton>
              </div>
            </motion.div>

            <motion.div
              key={`shortlist-${reveal.motionKey}`}
              initial={reveal.enabled ? { opacity: 0, y: 18 } : false}
              whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.65, ease, delay: 0.05 }}
              className="min-w-0"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(150px,0.68fr)_40px_minmax(0,1.7fr)] lg:items-stretch">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-center">
                  <div className="col-span-2 rounded-[14px] border border-[var(--dawn-line)] bg-[color-mix(in_srgb,var(--dawn-surface)_62%,transparent)] p-4 lg:col-span-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dawn-ink-2)]">
                      Live sources
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:items-start">
                      {sources.map((source) => (
                        <li
                          key={source}
                          className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--dawn-ink)]"
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-[var(--coral)]"
                          />
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="col-span-2 rounded-[14px] border border-[var(--dawn-line)] bg-[color-mix(in_srgb,var(--dawn-surface)_62%,transparent)] p-4 lg:col-span-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dawn-ink-2)]">
                      Selected preferences
                    </p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {preferences.map((preference) => (
                        <li
                          key={preference}
                          className="rounded-full bg-[var(--dawn-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--dawn-ink-2)]"
                        >
                          {preference}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div aria-hidden="true" className="relative min-h-8 lg:min-h-0">
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--dawn-line-2)] lg:left-0 lg:top-1/2 lg:h-px lg:w-full lg:-translate-x-0 lg:-translate-y-1/2" />
                  <motion.span
                    initial={reveal.enabled ? { scale: 0 } : false}
                    whileInView={reveal.enabled ? { scale: 1 } : undefined}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, ease, delay: 0.35 }}
                    className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--dawn-cream)] bg-[var(--coral)]"
                  />
                </div>

                <article className="overflow-hidden rounded-[20px] border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] shadow-[0_24px_60px_-36px_rgba(31,27,24,0.35)]">
                  <header className="flex items-start justify-between gap-4 border-b border-[var(--dawn-line)] px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--coral-lo)]">
                        Sample shortlist
                      </p>
                      <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[var(--dawn-ink)]">
                        Worth a closer look
                      </h3>
                    </div>
                    <p className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--dawn-ink-2)]">
                      07:30
                    </p>
                  </header>

                  <ol>
                    {shortlist.map((job, index) => (
                      <motion.li
                        key={job.role}
                        initial={reveal.enabled ? { opacity: 0, x: -10 } : false}
                        whileInView={reveal.enabled ? { opacity: 1, x: 0 } : undefined}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, ease, delay: 0.18 + index * 0.08 }}
                        className="grid grid-cols-[36px_1fr] gap-3 border-b border-[var(--dawn-line)] px-5 py-5 last:border-b-0 sm:grid-cols-[44px_1fr] sm:px-6"
                      >
                        <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--coral-lo)]">
                          {job.rank}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--dawn-ink)] sm:text-[17px]">
                            {job.role}
                          </h4>
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {job.details.map((detail) => (
                              <li
                                key={detail}
                                className="rounded-full bg-[var(--dawn-cream)] px-2.5 py-1 text-[11px] font-medium text-[var(--dawn-ink-2)]"
                              >
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </article>
              </div>
              <p className="mt-4 text-right text-[12px] leading-[1.5] text-[var(--dawn-ink-2)]">
                Illustrative roles shown for product preview.
              </p>
            </motion.div>
          </div>
        </div>
      </MotionConfig>
    </section>
  )
}
