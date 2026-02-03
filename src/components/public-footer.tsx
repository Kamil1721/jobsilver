import Link from 'next/link'
import Image from 'next/image'

interface PublicFooterProps {
  onboarding?: boolean
}

export function PublicFooter({ onboarding = false }: PublicFooterProps) {
  // During onboarding, only show legal links (Privacy, Terms) that open in new tabs
  // This prevents users from navigating away while still allowing them to review legal policies
  if (onboarding) {
    return (
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0a0a0b]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <Image
                src="/logo-dark.svg"
                alt="Job Silver"
                width={120}
                height={24}
                className="h-5 w-auto opacity-60 hidden dark:block"
              />
              <Image
                src="/logo-light.svg"
                alt="Job Silver"
                width={120}
                height={24}
                className="h-5 w-auto opacity-60 dark:hidden"
              />
            </div>

            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Privacy
              </a>
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Terms
              </a>
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-600">
              © {new Date().getFullYear()} Job Silver
            </p>
          </div>
        </div>
      </footer>
    )
  }

  // Full footer for public pages
  return (
    <footer className="border-t border-zinc-800 bg-[#0a0a0b]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo-dark.svg"
              alt="Job Silver"
              width={140}
              height={28}
              className="h-6 w-auto opacity-60 hover:opacity-80 transition-opacity"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-300 transition-colors">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-zinc-300 transition-colors">
              Pricing
            </Link>
            <Link href="/faq" className="hover:text-zinc-300 transition-colors">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-zinc-300 transition-colors">
              Contact
            </Link>
          </div>

          <p className="text-sm text-zinc-600">
            © {new Date().getFullYear()} Job Silver
          </p>
        </div>
      </div>
    </footer>
  )
}
