"use client"

import { motion, MotionConfig } from "framer-motion"
import { useProgressiveReveal } from "./use-progressive-reveal"

const ease = [0.16, 1, 0.3, 1] as const

export function Features() {
  const reveal = useProgressiveReveal()

  return (
    <section
      id="features"
      aria-labelledby="features-h"
      className="bg-[var(--dawn-bg)]"
    >
      <MotionConfig reducedMotion="user">
        <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
          <motion.div
            key={`intro-${reveal.motionKey}`}
            initial={reveal.enabled ? { opacity: 0, y: 14 } : false}
            whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease }}
            className="max-w-[58ch]"
          >
            <h2
              id="features-h"
              className="max-w-[16ch] text-balance text-[clamp(32px,4vw,48px)] font-semibold leading-[1.04] tracking-[-0.025em] text-[var(--dawn-ink)]"
            >
              Ready for the work that comes next.
            </h2>
            <p className="mt-5 max-w-[54ch] text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.62] text-[var(--dawn-ink-2)]">
              The shortlist stays tied to the original posting, and your
              application materials stay tied to the role you choose.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-5 lg:grid-cols-[1.28fr_0.72fr] lg:items-stretch">
            <motion.article
              key={`sources-${reveal.motionKey}`}
              initial={reveal.enabled ? { opacity: 0, y: 16 } : false}
              whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.58, ease }}
              className="overflow-hidden rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-cream)]"
            >
              <div className="grid h-full gap-8 p-6 sm:p-8 md:grid-cols-[0.9fr_1.1fr] md:items-end lg:p-10">
                <div>
                  <p className="text-[12px] font-semibold text-[var(--coral-lo)]">
                    Direct sources
                  </p>
                  <h3 className="mt-3 max-w-[13ch] text-balance text-[clamp(25px,3vw,34px)] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--dawn-ink)]">
                    Read the role where it was posted.
                  </h3>
                  <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.62] text-[var(--dawn-ink-2)]">
                    JobSilver pulls roles from Greenhouse, Lever, Ashby, and
                    other job sources. Each shortlist item keeps a path back to
                    the employer&apos;s listing.
                  </p>
                </div>

                <div className="rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-5 shadow-[0_16px_40px_-32px_rgba(31,27,24,0.35)] sm:p-6">
                  <div className="flex items-center justify-between border-b border-[var(--dawn-line)] pb-4">
                    <p className="text-[13px] font-semibold text-[var(--dawn-ink)]">
                      Source check
                    </p>
                    <span className="inline-flex items-center gap-2 text-[12px] text-[var(--dawn-ink-2)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--coral)]" aria-hidden="true" />
                      Current posting
                    </span>
                  </div>
                  <dl className="mt-2 divide-y divide-[var(--dawn-line)] text-[13px]">
                    {[
                      ["Source", "Employer job board"],
                      ["Role details", "Kept with the listing"],
                      ["Next step", "Open employer site"],
                    ].map(([term, description]) => (
                      <div key={term} className="flex items-start justify-between gap-5 py-3.5">
                        <dt className="text-[var(--dawn-ink-2)]">{term}</dt>
                        <dd className="text-right font-medium text-[var(--dawn-ink)]">
                          {description}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </motion.article>

            <motion.article
              key={`tools-${reveal.motionKey}`}
              initial={reveal.enabled ? { opacity: 0, y: 16 } : false}
              whileInView={reveal.enabled ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.58, ease, delay: 0.08 }}
              className="flex flex-col rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-6 shadow-[0_18px_50px_-38px_rgba(31,27,24,0.32)] sm:p-8 lg:p-9"
            >
              <p className="text-[12px] font-semibold text-[var(--coral-lo)]">
                Pro application tools
              </p>
              <h3 className="mt-3 max-w-[13ch] text-balance text-[clamp(25px,3vw,34px)] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--dawn-ink)]">
                Start with a tailored draft.
              </h3>
              <p className="mt-4 text-[15px] leading-[1.62] text-[var(--dawn-ink-2)]">
                Draft a cover letter, prepare application answers, or generate a
                role-specific CV. You can review and edit each result before you
                use it.
              </p>

              <div className="mt-8 rounded-[14px] bg-[var(--dawn-cream)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dawn-ink-2)]">
                  Prepared for this role
                </p>
                <ul className="mt-3 space-y-2.5">
                  {["Cover letter draft", "Application answer help", "Tailored CV"].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-[13px] font-medium text-[var(--dawn-ink)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--coral)]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          </div>
        </div>
      </MotionConfig>
    </section>
  )
}
