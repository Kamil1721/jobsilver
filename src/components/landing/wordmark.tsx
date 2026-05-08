import Link from "next/link"
import { cn } from "@/lib/utils"

interface WordmarkProps {
  size?: "sm" | "md" | "lg"
  asLink?: boolean
  className?: string
}

const sizeClasses: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-[19px] md:text-[21px]",
  md: "text-3xl md:text-[34px]",
  lg: "text-5xl md:text-6xl",
}

export function Wordmark({ size = "sm", asLink = true, className = "" }: WordmarkProps) {
  const isDisplay = size === "lg"

  const inner = (
    <span
      className={cn(
        "font-serif font-semibold tracking-[-0.025em] leading-none select-none",
        sizeClasses[size],
        className,
      )}
      aria-label="JobSilver"
    >
      <span
        className={cn(isDisplay && "bg-clip-text text-transparent")}
        style={
          isDisplay
            ? {
                backgroundImage: "var(--silver-face)",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }
            : { color: "var(--silver-1)" }
        }
      >
        Job
      </span>
      <span
        className="italic font-normal"
        style={{
          color: isDisplay ? "var(--silver-1)" : "var(--fg-2)",
        }}
      >
        Silver
      </span>
    </span>
  )

  if (asLink) {
    return (
      <Link
        href="/"
        className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--copper)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] rounded-sm"
      >
        {inner}
      </Link>
    )
  }
  return inner
}
