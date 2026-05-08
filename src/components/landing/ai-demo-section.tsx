"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { AIDemoEmbed } from "./ai-demo-embed"

export function AIDemoSection() {
  return (
    <section
      id="see-it-in-action"
      className="relative z-10"
      style={{ paddingTop: "var(--section-y)", paddingBottom: "var(--section-y)" }}
    >
      <div
        className="mx-auto px-6 md:px-10"
        style={{ maxWidth: "var(--content-w)" }}
      >
        <div className="grid gap-12 md:grid-cols-[5fr_7fr] md:items-center md:gap-16 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className="block text-[12px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "var(--fg-3)" }}
            >
              The application flow
            </span>
            <h2
              className="mt-5 font-serif font-semibold text-balance"
              style={{
                fontSize: "clamp(32px, 4.4vw, 60px)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
                color: "var(--fg-1)",
                fontVariationSettings: "'opsz' 96",
              }}
            >
              The cover letter writes itself.<br />
              <span className="italic" style={{ color: "var(--fg-2)" }}>
                You fix the parts that aren&apos;t you.
              </span>
            </h2>
            <div
              className="mt-7 space-y-4 text-pretty"
              style={{
                color: "var(--fg-2)",
                fontSize: "17px",
                lineHeight: 1.55,
                maxWidth: "44ch",
              }}
            >
              <p>
                Open a match. Read the role in the language of the company,
                not the recruiter. Generate a draft tailored to your CV, then
                edit until the voice is yours.
              </p>
              <p>
                Pro gets thirty AI replies and five letters a day. Ultra
                takes the cap off entirely.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div
              className="relative overflow-hidden"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--line-1)",
                borderRadius: 14,
                boxShadow: "var(--silver-edge)",
              }}
            >
              <AIDemoEmbed />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
