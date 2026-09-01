import type { ReactNode } from "react"
import Link from "next/link"

type Variant = "coral" | "ghost"
type Size = "md" | "lg"

interface CtaButtonProps {
  href: string
  children: ReactNode
  variant?: Variant
  size?: Size
  className?: string
}

const sizeClasses: Record<Size, string> = {
  md: "min-h-11 px-5 text-[14px]",
  lg: "min-h-[52px] px-7 text-[15px] sm:px-8",
}

const variantClasses: Record<Variant, string> = {
  coral:
    "border border-[var(--coral)] bg-[var(--coral)] text-[var(--coral-ink)] hover:border-[var(--coral-hi)] hover:bg-[var(--coral-hi)] active:border-[var(--coral-active)] active:bg-[var(--coral-active)]",
  ghost:
    "border border-[var(--dawn-line-2)] bg-transparent text-[var(--dawn-ink)] hover:border-[var(--coral)] hover:bg-[var(--coral-soft)] active:bg-[var(--coral-soft-2)]",
}

export function CtaButton({
  href,
  children,
  variant = "coral",
  size = "md",
  className = "",
}: CtaButtonProps) {
  const classes = `inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold leading-none tracking-[-0.01em] transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`

  if (href.startsWith("/#")) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <Link
      href={href}
      className={classes}
    >
      {children}
    </Link>
  )
}
