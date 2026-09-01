"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { Mail, Clock, MessageSquare } from "lucide-react"
import { motion, MotionConfig } from "framer-motion"
import { CtaButton } from "@/components/landing/cta-button"

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export function ContactContent() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        className="px-[var(--dawn-gutter)]"
        style={{ paddingTop: "clamp(56px,7vw,96px)", paddingBottom: "var(--dawn-section)" }}
      >
        <div className="mx-auto" style={{ maxWidth: "var(--dawn-content)" }}>
          {/* Header */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[720px]"
          >
            <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
              Contact
            </p>
            <h1
              className="mt-4 text-[clamp(34px,5vw,58px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]"
              style={{ textWrap: "balance" } as CSSProperties}
            >
              Talk to a human.
            </h1>
            <p className="mt-5 text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)] max-w-[60ch]">
              A question, some feedback, or something that broke? Write to us and a real
              person will read it. No ticket queues, no bots.
            </p>
          </motion.div>

          {/* Contact card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 max-w-[720px] overflow-hidden rounded-[20px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_20px_44px_-28px_rgba(31,27,24,0.20),0_1px_2px_rgba(31,27,24,0.04)]"
          >
            {/* Email — the primary action */}
            <div
              className="p-8 sm:p-10"
              style={{
                background:
                  "linear-gradient(180deg, var(--coral-soft) -30%, transparent 46%)",
              }}
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] shadow-[0_6px_16px_-8px_rgba(240,96,58,0.6)]"
                  style={{ background: "var(--coral)" }}
                >
                  <Mail className="h-5 w-5" style={{ color: "var(--coral-ink)" }} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--dawn-ink)]">
                    Email us
                  </h2>
                  <p className="mt-1 text-[15px] leading-[1.55] text-[var(--dawn-ink-2)]">
                    For support, feedback, or general inquiries.
                  </p>
                  <a
                    href="mailto:jobsilver50@gmail.com"
                    className="mt-3 inline-flex min-h-[44px] items-center rounded-md text-[16px] font-medium text-[var(--coral-lo)] underline decoration-[var(--coral-soft)] decoration-2 underline-offset-[5px] transition-colors duration-200 hover:text-[var(--coral)] hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
                  >
                    jobsilver50@gmail.com
                  </a>
                  <div className="mt-5">
                    <CtaButton href="mailto:jobsilver50@gmail.com" variant="coral" size="md">
                      Write to us
                    </CtaButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px w-full" style={{ background: "var(--dawn-line)" }} />

            {/* Response time */}
            <div className="p-8 sm:p-10">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--dawn-line)]"
                  style={{ background: "var(--dawn-cream)" }}
                >
                  <Clock className="h-5 w-5 text-[var(--dawn-ink-2)]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--dawn-ink)]">
                    Response time
                  </h2>
                  <p className="mt-1 text-[15px] leading-[1.55] text-[var(--dawn-ink-2)]">
                    We typically respond within 24&ndash;48 hours during business days.
                  </p>
                </div>
              </div>
            </div>

            <div className="h-px w-full" style={{ background: "var(--dawn-line)" }} />

            {/* What to include */}
            <div className="p-8 sm:p-10">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--dawn-line)]"
                  style={{ background: "var(--dawn-cream)" }}
                >
                  <MessageSquare className="h-5 w-5 text-[var(--dawn-ink-2)]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--dawn-ink)]">
                    When contacting us
                  </h2>
                  <p className="mt-1 text-[15px] leading-[1.55] text-[var(--dawn-ink-2)]">
                    To help us assist you faster, please include:
                  </p>
                  <ul className="mt-3 space-y-2 text-[15px] leading-[1.55] text-[var(--dawn-ink-2)]">
                    {[
                      "Your account email (if applicable)",
                      "A clear description of your question or issue",
                      "Screenshots if reporting a bug",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="mt-[9px] h-[6px] w-[6px] shrink-0 rounded-full"
                          style={{ background: "var(--coral)" }}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footnote — terms / privacy */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-[720px] text-[14px] leading-[1.6] text-[var(--dawn-ink-3)]"
          >
            Before reaching out, you might find answers in our{" "}
            <Link
              href="/terms"
              className="rounded-sm text-[var(--coral-lo)] underline decoration-[var(--coral-soft)] decoration-2 underline-offset-2 transition-colors duration-200 hover:text-[var(--coral)] hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
            >
              Terms of Service
            </Link>{" "}
            or{" "}
            <Link
              href="/privacy"
              className="rounded-sm text-[var(--coral-lo)] underline decoration-[var(--coral-soft)] decoration-2 underline-offset-2 transition-colors duration-200 hover:text-[var(--coral)] hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
            >
              Privacy Policy
            </Link>
            .
          </motion.p>
        </div>
      </section>
    </MotionConfig>
  )
}
