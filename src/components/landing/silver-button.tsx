import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Size = "sm" | "md" | "lg"

interface SilverButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  size?: Size
  className?: string
  variant?: "silver" | "ghost"
  type?: "button" | "submit"
  ariaLabel?: string
}

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-5 py-3 text-sm",
  lg: "px-7 py-4 text-base",
}

const silverBoxShadow = [
  "inset 0 1px 0 rgba(255,255,255,0.7)",
  "inset 0 -1px 0 rgba(0,0,0,0.18)",
  "0 8px 20px rgba(0,0,0,0.4)",
].join(", ")

export function SilverButton({
  children,
  href,
  onClick,
  size = "md",
  className = "",
  variant = "silver",
  type = "button",
  ariaLabel,
}: SilverButtonProps) {
  const isGhost = variant === "ghost"

  const surface = (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium",
        "transition-transform duration-150 active:scale-[0.985]",
        sizeStyles[size],
        className,
      )}
      style={
        isGhost
          ? {
              background: "transparent",
              color: "var(--fg-1)",
              boxShadow: "inset 0 0 0 1px var(--line-3)",
            }
          : {
              background: "var(--silver-face-button)",
              color: "var(--fg-on-silver)",
              boxShadow: silverBoxShadow,
            }
      }
    >
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
        {surface}
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
      {surface}
    </button>
  )
}
