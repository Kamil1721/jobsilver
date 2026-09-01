import Link from "next/link"
import { geist } from "./fonts"

const columns = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
]

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"

export function Footer() {
  return (
    <footer className={`${geist.className} border-t border-[var(--dawn-line)] bg-[var(--dawn-bg)]`}>
      <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[clamp(64px,8vw,112px)]">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr] md:gap-8">
          <div className="max-w-[44ch]">
            <Link
              href="/"
              className={`inline-flex min-h-11 items-center rounded-md text-[19px] font-semibold tracking-[-0.025em] text-[var(--dawn-ink)] ${focusRing}`}
            >
              JobSilver
            </Link>
            <p className="mt-3 text-[16px] leading-[1.62] text-[var(--dawn-ink-2)]">
              A focused morning shortlist, plus help preparing the applications
              you choose.
            </p>
            <p className="mt-3 text-[13px] leading-[1.6] text-[var(--dawn-ink-2)]">
              Review each role, then finish on the employer&apos;s site.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-[12px] font-semibold text-[var(--dawn-ink)]">
                {column.heading}
              </p>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href === "/#how-it-works" ? (
                      <a
                        href={link.href}
                        className={`inline-flex min-h-11 items-center rounded-md text-[14px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--coral-lo)] active:text-[var(--coral-active)] motion-reduce:transition-none ${focusRing}`}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={`inline-flex min-h-11 items-center rounded-md text-[14px] text-[var(--dawn-ink-2)] transition-colors duration-200 hover:text-[var(--coral-lo)] active:text-[var(--coral-active)] motion-reduce:transition-none ${focusRing}`}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[var(--dawn-line)] pt-7 text-[13px] text-[var(--dawn-ink-2)] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 JobSilver</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className={`inline-flex min-h-11 items-center rounded-md hover:text-[var(--coral-lo)] ${focusRing}`}>
              Sign in
            </Link>
            <Link href="/login" className={`inline-flex min-h-11 items-center rounded-md font-semibold text-[var(--dawn-ink)] hover:text-[var(--coral-lo)] ${focusRing}`}>
              Start free
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
