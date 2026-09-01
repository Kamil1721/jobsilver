import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Pricing | JobSilver",
  description: "Compare JobSilver plans and choose the features that fit your job search.",
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
