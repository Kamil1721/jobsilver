"use client"

import Link from 'next/link'
import Image from 'next/image'
import * as React from 'react'
import { useTheme } from '@/lib/contexts/theme-context'

interface PublicFooterProps {
  onboarding?: boolean
}

export function PublicFooter({ onboarding = false }: PublicFooterProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Use a consistent logo source for SSR, then switch after mount
  const logoSrc = mounted
    ? (resolvedTheme === 'light' ? '/logo-light.svg' : '/logo-dark.svg')
    : '/logo-dark.svg'

  // During onboarding, only show legal links (Privacy, Terms) that open in new tabs
  // This prevents users from navigating away while still allowing them to review legal policies
  if (onboarding) {
    return (
      <footer className="border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <Image
                src={logoSrc}
                alt="Job Silver"
                width={120}
                height={24}
                className="h-5 w-auto opacity-60"
              />
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Privacy
              </a>
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Terms
              </a>
            </div>

            <p className="text-sm text-muted-foreground">
              © 2026 Job Silver
            </p>
          </div>
        </div>
      </footer>
    )
  }

  // Full footer for public pages
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center">
            <Image
              src={logoSrc}
              alt="Job Silver"
              width={140}
              height={28}
              className="h-6 w-auto opacity-60 hover:opacity-80 transition-opacity"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2026 Job Silver
          </p>
        </div>
      </div>
    </footer>
  )
}
