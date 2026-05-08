"use client"

import * as React from "react"
import { motion } from "framer-motion"

const steps = [
  {
    n: "01",
    title: "Tell us what you actually want",
    body: "Title, level, salary floor, the things you refuse. Two minutes of setup. Then we leave you alone until there is something worth your time.",
  },
  {
    n: "02",
    title: "We show up before the inbox does",
    body: "Up to thirty-five fresh matches a day, scored against your profile and pulled from boards and the long-tail places they don't list on.",
  },
  {
    n: "03",
    title: "Apply on their site, not ours",
    body: "The cover letter writes itself, then you fix the parts that aren't you. You click the company's apply button. We never auto-apply.",
  },
]

export function ThreeSteps() {
  return (
    <section
      id="how-it-works"
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
            How it works
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
            Boring on purpose.<br />
            <span className="italic" style={{ color: "var(--fg-2)" }}>
              Effective on purpose.
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
            Three steps, none of which involve you scrolling LinkedIn at
            eleven on a Sunday.
          </p>
        </div>

        <div className="mt-20 grid gap-12 md:grid-cols-3 md:gap-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.6,
                delay: i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-center md:text-left"
            >
              <span
                className="block font-serif font-medium leading-none"
                style={{
                  fontSize: "clamp(56px, 6vw, 96px)",
                  letterSpacing: "-0.04em",
                  color: "var(--silver-1)",
                  fontVariantNumeric: "tabular-nums",
                  fontVariationSettings: "'opsz' 144",
                }}
              >
                {step.n}
              </span>
              <h3
                className="mt-5 font-serif font-semibold text-balance"
                style={{
                  fontSize: "22px",
                  lineHeight: 1.25,
                  letterSpacing: "-0.015em",
                  color: "var(--fg-1)",
                }}
              >
                {step.title}
              </h3>
              <p
                className="mt-3 text-pretty"
                style={{
                  color: "var(--fg-2)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  maxWidth: "32ch",
                  marginInline: "auto",
                }}
              >
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
