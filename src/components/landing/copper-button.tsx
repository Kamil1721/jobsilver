"use client"

import * as React from "react"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Size = "sm" | "md" | "lg"

interface CopperButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  size?: Size
  className?: string
  pulseOnMount?: boolean
  type?: "button" | "submit"
  ariaLabel?: string
}

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-5 py-3 text-sm",
  lg: "px-7 py-4 text-base",
}

const copperBoxShadow = [
  "inset 0 1px 0 rgba(255,255,255,0.35)",
  "inset 0 -1px 0 rgba(0,0,0,0.35)",
  "0 0 0 1px rgba(110,66,32,0.55)",
  "0 18px 40px rgba(184,115,51,0.35)",
].join(", ")

export function CopperButton({
  children,
  href,
  onClick,
  size = "md",
  className = "",
  pulseOnMount = true,
  type = "button",
  ariaLabel,
}: CopperButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const surfaceRef = useRef<HTMLSpanElement | null>(null)

  // Magnetic pull (±6px) on cursor proximity
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    if (typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    const PULL = 6
    const PROXIMITY = 90

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.hypot(dx, dy)
      if (dist > PROXIMITY) {
        el.style.setProperty("--js-mx", "0px")
        el.style.setProperty("--js-my", "0px")
        return
      }
      const f = (1 - dist / PROXIMITY) * PULL
      el.style.setProperty("--js-mx", `${(dx / PROXIMITY) * f}px`)
      el.style.setProperty("--js-my", `${(dy / PROXIMITY) * f}px`)
    }
    const reset = () => {
      el.style.setProperty("--js-mx", "0px")
      el.style.setProperty("--js-my", "0px")
    }

    window.addEventListener("mousemove", handleMove, { passive: true })
    window.addEventListener("blur", reset)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("blur", reset)
    }
  }, [])

  // Entry-pulse shimmer once on mount
  useEffect(() => {
    if (!pulseOnMount) return
    const el = surfaceRef.current
    if (!el) return
    el.classList.add("js-shimmer-pulse")
    const t = setTimeout(() => {
      el.classList.remove("js-shimmer-pulse")
    }, 3200)
    return () => clearTimeout(t)
  }, [pulseOnMount])

  const surface = (
    <span
      ref={surfaceRef}
      className={cn(
        "js-shimmer-host inline-flex items-center gap-2 rounded-full font-medium text-white",
        "transition-transform duration-150 active:scale-[0.985]",
        sizeStyles[size],
        className,
      )}
      style={{
        background: "var(--copper-face)",
        textShadow: "0 1px 0 rgba(0,0,0,0.35)",
        boxShadow: copperBoxShadow,
      }}
    >
      {children}
    </span>
  )

  const wrapper = (children: React.ReactNode) => (
    <span ref={wrapperRef} className="js-magnetic inline-block">
      {children}
    </span>
  )

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className="inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--copper)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
      >
        {wrapper(surface)}
      </Link>
    )
  }
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--copper)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] bg-transparent border-0 p-0 cursor-pointer"
    >
      {wrapper(surface)}
    </button>
  )
}
