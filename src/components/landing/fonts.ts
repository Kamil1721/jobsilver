// Landing v2 fonts (Night/Dawn redesign).
//
// The design contract mandates Geist for all display/body and Geist Mono for
// data/ledger details, and bans Inter/Fraunces on this page. Geist is NOT
// available in `next/font/google` on Next 14.2.x (it only ships there from
// Next 15+), so we self-host the real Geist variable fonts that come bundled
// with the official `geist` npm package via `next/font/local`. This keeps the
// exact CSS variable names the contract specifies (`--font-geist`,
// `--font-geist-mono`), self-hosts the fonts (no runtime Google fetch), and
// exposes `display: "swap"`.
import localFont from "next/font/local";

export const geist = localFont({
  src: "../../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});

export const geistMono = localFont({
  src: "../../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
  adjustFontFallback: false,
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Roboto Mono",
    "Menlo",
    "Monaco",
    "Liberation Mono",
    "DejaVu Sans Mono",
    "Courier New",
    "monospace",
  ],
});
