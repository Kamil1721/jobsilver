import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Frequently asked questions | JobSilver",
  description: "Find answers about JobSilver accounts, job matching, application preparation, plans, and privacy.",
}

export default function FaqLayout({ children }: { children: ReactNode }) {
  return children
}
