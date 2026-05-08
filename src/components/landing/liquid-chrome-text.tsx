import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface LiquidChromeTextProps {
  children: ReactNode
  className?: string
  as?: "span" | "div"
}

export function LiquidChromeText({
  children,
  className = "",
  as: Tag = "span",
}: LiquidChromeTextProps) {
  return (
    <Tag className={cn("js-chrome-sweep-text", className)}>
      {children}
    </Tag>
  )
}
