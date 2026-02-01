import Link from 'next/link'
import Image from 'next/image'

export function PublicFooter() {
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
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Privacy
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
