import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Sign in or create an account | JobSilver",
  description: "Sign in to JobSilver or create an account to manage your job search.",
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
