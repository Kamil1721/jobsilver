"use client"

import Link from 'next/link'
import { motion, MotionConfig } from 'framer-motion'
import { geist } from './landing/fonts'

/**
 * PublicFooter — the light, warm "Dawn" anchor shared across public pages, the
 * dashboard, and the onboarding flow.
 *
 * Soft cream (var(--dawn-cream)) sitting as a distinct-but-warm band beneath the
 * warm-white page, separated by a single hairline (border-t var(--dawn-line)).
 * Ink wordmark, ink-2 tagline + links, ink-3 column labels. Coral is kept
 * precious — it appears only on focus rings. Matches the landing's dawn-footer
 * look while keeping this component's exact links + props.
 *
 * The brand mark is the clean Geist wordmark "JobSilver" (a Link to "/"), never a
 * boxed logo image — it reads as warm ink on the cream ground and stays
 * consistent with the landing nav wordmark.
 */

interface PublicFooterProps {
  onboarding?: boolean
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-cream)]'

// The wordmark that replaces the old boxed logo image. Geist semibold, tight
// tracking, warm ink — identical language to the landing nav wordmark.
const wordmark = `${geist.className} inline-flex min-h-[44px] items-center rounded-md text-[19px] font-semibold leading-none tracking-[-0.02em] text-[var(--dawn-ink)] transition-opacity duration-200 hover:opacity-80 ${focusRing}`

// Static variant objects (never derived from a client-only hook) so SSR and
// hydration match. Motion is calm: a single gentle rise+fade on enter.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
}

interface FooterLink {
  label: string
  href: string
}

interface LinkColumn {
  heading: string
  links: FooterLink[]
}

// Same link set this footer has always exposed — Home, Pricing, FAQ, Privacy,
// Terms, Contact — grouped into two columns for the Dawn columnar look.
const COLUMNS: LinkColumn[] = [
  {
    heading: 'Explore',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
]

export function PublicFooter({ onboarding = false }: PublicFooterProps) {
  // During onboarding, only show legal links (Privacy, Terms) that open in new
  // tabs. This prevents users from navigating away while still allowing them to
  // review legal policies.
  if (onboarding) {
    return (
      <footer className="border-t border-[var(--dawn-line)] bg-[var(--dawn-cream)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-6 py-9 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <span className={`${geist.className} inline-flex min-h-[44px] items-center text-[19px] font-semibold leading-none tracking-[-0.02em] text-[var(--dawn-ink)]`}>
            JobSilver
          </span>

          <div className="flex items-center gap-7 text-[14px] sm:gap-8">
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[44px] items-center rounded-[6px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--dawn-ink)] ${focusRing}`}
            >
              Privacy
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[44px] items-center rounded-[6px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--dawn-ink)] ${focusRing}`}
            >
              Terms
            </a>
          </div>

          <p className="text-[13px] text-[var(--dawn-ink-2)]">© 2026 Job Silver</p>
        </div>
      </footer>
    )
  }

  // Full footer for public pages + dashboard
  return (
    <MotionConfig reducedMotion="user">
      <footer
        aria-labelledby="public-footer-h"
        className="border-t border-[var(--dawn-line)] bg-[var(--dawn-cream)]"
      >
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto max-w-7xl px-6 py-16 md:py-20"
        >
          <h2 id="public-footer-h" className="sr-only">
            Job Silver footer
          </h2>

          <div className="grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-[1.6fr_1fr_1fr]">
            {/* Left: wordmark + tagline */}
            <motion.div variants={item} className="max-w-[42ch]">
              <Link href="/" className={wordmark}>
                JobSilver
              </Link>
              <p className="mt-5 text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]">
                Wake up to jobs worth your time.
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--dawn-ink-2)]">
                Prepare in JobSilver, then finish and submit on the employer&apos;s site.
              </p>
            </motion.div>

            {/* Right: link columns */}
            {COLUMNS.map((col) => (
              <motion.nav key={col.heading} variants={item} aria-label={col.heading}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[var(--dawn-ink-3)]">
                  {col.heading}
                </p>
                <ul className="mt-4 space-y-0.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className={`inline-flex min-h-[44px] items-center rounded-[6px] text-[15px] leading-[1.55] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--dawn-ink)] ${focusRing}`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.nav>
            ))}
          </div>

          {/* Bottom row */}
          <motion.div
            variants={item}
            className="mt-16 flex flex-col gap-2 border-t border-[var(--dawn-line)] pt-8 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-[13px] text-[var(--dawn-ink-2)]">© 2026 Job Silver</p>
            <p className="text-[13px] text-[var(--dawn-ink-2)]">
              Made for people who&rsquo;d rather sleep on it.
            </p>
          </motion.div>
        </motion.div>
      </footer>
    </MotionConfig>
  )
}
