import Link from "next/link"
import { Wordmark } from "./wordmark"

export function Footer() {
  return (
    <footer
      className="relative z-10"
      style={{
        background: "var(--bg-sunken)",
        borderTop: "1px solid var(--line-1)",
      }}
    >
      <div
        className="mx-auto px-6 md:px-10 py-16 md:py-20"
        style={{ maxWidth: "1080px" }}
      >
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
          <div className="space-y-4">
            <Wordmark size="sm" asLink={false} />
            <p
              className="font-serif text-[19px] italic leading-snug"
              style={{ color: "var(--fg-2)", maxWidth: "32ch" }}
            >
              Made for people who already know LinkedIn is broken.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-4">
              <span
                className="block text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--fg-3)" }}
              >
                Product
              </span>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    href="/pricing"
                    className="transition-colors duration-200 hover:text-white"
                    style={{ color: "var(--fg-2)" }}
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/faq"
                    className="transition-colors duration-200 hover:text-white"
                    style={{ color: "var(--fg-2)" }}
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="transition-colors duration-200 hover:text-white"
                    style={{ color: "var(--fg-2)" }}
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <span
                className="block text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--fg-3)" }}
              >
                Legal
              </span>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    href="/privacy"
                    className="transition-colors duration-200 hover:text-white"
                    style={{ color: "var(--fg-2)" }}
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="transition-colors duration-200 hover:text-white"
                    style={{ color: "var(--fg-2)" }}
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div
          className="mt-14 flex flex-col gap-2 border-t pt-6 text-[12px] md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: "var(--line-1)",
            color: "var(--fg-3)",
          }}
        >
          <span>© {new Date().getFullYear()} JobSilver. All rights reserved.</span>
          <span>Apply on the company site. We never auto-apply.</span>
        </div>
      </div>
    </footer>
  )
}
