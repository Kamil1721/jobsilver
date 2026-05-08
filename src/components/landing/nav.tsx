"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Wordmark } from "./wordmark"
import { CopperButton } from "./copper-button"

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      aria-label="Primary"
      className="fixed top-0 left-0 right-0 z-40 h-16"
      style={{
        background: "rgba(10, 10, 10, 0.6)",
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        borderBottom: scrolled ? "1px solid var(--line-1)" : "1px solid transparent",
        transition: "border-bottom-color 360ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <div
        className="mx-auto flex h-full items-center justify-between px-6 md:px-10"
        style={{ maxWidth: "var(--content-w)" }}
      >
        <div className="flex items-center gap-9">
          <Wordmark size="sm" />
          <div
            className="hidden md:flex items-center gap-7 text-[14px]"
            style={{ color: "var(--fg-2)" }}
          >
            <Link
              href="/pricing"
              className="transition-colors duration-200 hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className="transition-colors duration-200 hover:text-white"
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="transition-colors duration-200 hover:text-white"
            >
              Contact
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-3 py-1.5 text-[13px] transition-colors duration-200 hover:text-white"
            style={{ color: "var(--fg-2)" }}
          >
            Sign in
          </Link>
          <CopperButton href="/login" size="sm" pulseOnMount={false}>
            Start free
          </CopperButton>
        </div>
      </div>
    </nav>
  )
}
