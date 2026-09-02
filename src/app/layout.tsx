import type { Metadata } from "next"
import { Fraunces, Inter } from "next/font/google"
import "./globals.css"
import { geist, geistMono } from "@/components/landing/fonts"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { CookieConsentBanner } from "@/components/cookie-consent"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL('https://jobsilver.com'),
  title: "JobSilver: Wake Up to Jobs Worth Your Time",
  description: "Get fresh job matches based on your preferences each day. Draft cover letters, prepare application answers, and generate a tailored CV before you apply.",
  verification: {
    google: "1qgCg2Uu7ARLa6sFjDGGTrK_-bw1tZKUxNXrzP-CYBU",
  },
  openGraph: {
    title: "JobSilver: Wake Up to Jobs Worth Your Time",
    description: "Get fresh job matches based on your preferences each day. Draft cover letters, prepare application answers, and generate a tailored CV before you apply.",
    siteName: "JobSilver",
    type: "website",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JobSilver: Wake Up to Jobs Worth Your Time',
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Dawn is a light-only product. Hard-lock to light so any
                // previously persisted 'dark' preference can never win.
                try {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  localStorage.setItem('jobsilver-theme', 'light');
                } catch (e) {
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} ${inter.variable} ${fraunces.variable} min-h-screen bg-background antialiased`}>
        <ThemeProvider defaultTheme="light">
          {children}
          <Toaster />
          <CookieConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  )
}
