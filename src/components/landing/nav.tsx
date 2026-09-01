"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useMotionValueEvent, useScroll } from "framer-motion"
import { CtaButton } from "./cta-button"
import { geist } from "./fonts"

const navLink =
  "inline-flex min-h-11 items-center rounded-md text-[14px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--dawn-ink)] active:text-[var(--coral-lo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none"

const signInLink = `${navLink} hidden px-1.5 min-[320px]:inline-flex min-[375px]:px-2 sm:px-3`

const mobileNavLink =
  "inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium text-[var(--dawn-ink-2)] transition-colors duration-200 hover:bg-[var(--dawn-cream)] hover:text-[var(--dawn-ink)] active:bg-[var(--coral-soft)] active:text-[var(--coral-lo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--coral)] motion-reduce:transition-none"

const howItWorksHref = "/#how-it-works"

const isLandingHash = (href: string) =>
  href === howItWorksHref || href === "/#sample-shortlist"

const mobileNavLinks = [
  { label: "How it works", href: howItWorksHref },
  { label: "Sample shortlist", href: "/#sample-shortlist" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
] as const

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    const next = latest > 32
    setScrolled((current) => (current === next ? current : next))
  })

  useEffect(() => {
    if (!menuOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [menuOpen])

  return (
    <nav
      aria-label="Primary"
      className={`${geist.className} fixed inset-x-0 top-0 z-40 h-[68px] border-b backdrop-blur-[14px] transition-[background-color,border-color] duration-300 motion-reduce:transition-none ${
        scrolled
          ? "border-[var(--dawn-line)] bg-[rgb(var(--dawn-bg-rgb)/0.94)]"
          : "border-transparent bg-[rgb(var(--dawn-bg-rgb)/0.78)]"
      }`}
    >
      <div className="mx-auto flex h-full max-w-[var(--dawn-content)] items-center justify-between gap-2 px-3 min-[375px]:gap-3 min-[375px]:px-4 min-[420px]:px-[var(--dawn-gutter)]">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/"
            aria-label="JobSilver home"
            className="inline-flex min-h-11 shrink-0 items-center rounded-md text-[18px] font-semibold leading-none tracking-[-0.025em] text-[var(--dawn-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] sm:text-[19px]"
          >
            <span className="max-[279px]:hidden">JobSilver</span>
            <span aria-hidden="true" className="hidden max-[279px]:inline">
              JS
            </span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a href={howItWorksHref} className={navLink}>
              How it works
            </a>
            <Link href="/pricing" className={navLink}>
              Pricing
            </Link>
            <Link href="/faq" className={navLink}>
              FAQ
            </Link>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 min-[375px]:gap-2 sm:gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-menu"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2.5 text-[13px] font-semibold text-[var(--dawn-ink)] transition-colors duration-200 hover:bg-[var(--dawn-cream)] active:translate-y-px active:bg-[var(--coral-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none md:hidden"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
          <Link
            href="/login"
            className={signInLink}
          >
            Sign in
          </Link>
          <CtaButton
            href="/login"
            variant="coral"
            size="md"
            className="!px-3 min-[280px]:!px-4 min-[420px]:!px-5"
          >
            Start free
          </CtaButton>
        </div>
      </div>

      <div
        id="mobile-primary-menu"
        className={`absolute left-2 right-2 top-[calc(100%+8px)] rounded-[16px] border border-[var(--dawn-line)] bg-[rgb(var(--dawn-bg-rgb)/0.98)] p-2 shadow-[0_20px_48px_-28px_rgba(31,27,24,0.45)] backdrop-blur-[14px] md:hidden ${
          menuOpen ? "block" : "hidden"
        }`}
      >
        <div className="grid grid-cols-1 min-[320px]:grid-cols-2">
          {mobileNavLinks.map((link) => (
            isLandingHash(link.href) ? (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={mobileNavLink}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={mobileNavLink}
              >
                {link.label}
              </Link>
            )
          ))}
        </div>
      </div>
    </nav>
  )
}
