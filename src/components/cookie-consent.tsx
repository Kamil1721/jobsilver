'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, MotionConfig } from 'framer-motion'
import { Cookie, ChevronDown, ChevronUp } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'jobsilver-cookie-consent'

type ConsentStatus = 'pending' | 'accepted' | 'declined'

interface CookieConsent {
  status: ConsentStatus
  timestamp: string
  version: string
}

const CONSENT_VERSION = '1.0'

// Shared focus ring — Dawn coral, offset against the warm page background.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]'

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)

    const showCurrentBanner = () => {
      queueMicrotask(() => {
        if (!cancelled) setShowBanner(true)
      })
    }

    if (stored) {
      try {
        const consent: CookieConsent = JSON.parse(stored)
        if (consent.version !== CONSENT_VERSION) {
          showCurrentBanner()
        }
      } catch {
        showCurrentBanner()
      }
    } else {
      const timer = setTimeout(() => setShowBanner(true), 1500)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  const saveConsent = (status: 'accepted' | 'declined') => {
    const consent: CookieConsent = {
      status,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    closeBanner()
  }

  const handleAccept = () => saveConsent('accepted')
  const handleEssentialOnly = () => saveConsent('declined')

  const closeBanner = () => {
    setIsClosing(true)
    setTimeout(() => {
      setShowBanner(false)
      setIsClosing(false)
    }, 300)
  }

  if (!showBanner) return null

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={isClosing ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-lg z-50"
      >
        <div
        className="rounded-[16px] border border-[var(--dawn-line)] overflow-hidden shadow-[0_12px_40px_rgba(31,27,24,0.12)]"
        style={{ background: 'var(--dawn-surface)', color: 'var(--dawn-ink)' }}
      >
        {/* Main content */}
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className="p-2 rounded-[10px] flex-shrink-0"
              style={{ background: 'var(--coral-soft)' }}
            >
              <Cookie className="w-4 h-4 text-[var(--coral-lo)]" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--dawn-ink)] mb-1">
                Cookie settings
              </h4>
              <p className="text-[13px] leading-[1.6] text-[var(--dawn-ink-2)]">
                We use{' '}
                <span className="text-[var(--dawn-ink)] font-medium">
                  essential cookies only
                </span>{' '}
                for authentication and security. No tracking or advertising
                cookies.{' '}
                <Link
                  href="/privacy"
                  className={`text-[var(--coral-lo)] font-medium underline underline-offset-2 rounded-[4px] hover:text-[var(--coral)] transition-colors ${focusRing}`}
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Buttons — CtaButton-style skins on real <button> elements so the
              consent handlers (localStorage writes) still fire. */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAccept}
              className={`flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-full text-[14px] font-medium leading-none tracking-[-0.01em] bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)] transition-colors duration-200 ${focusRing}`}
            >
              Accept all
            </button>
            <button
              onClick={handleEssentialOnly}
              className={`flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-full text-[14px] font-medium leading-none tracking-[-0.01em] bg-transparent border border-[var(--dawn-line-2)] text-[var(--dawn-ink)] hover:border-[var(--coral)] hover:text-[var(--coral-lo)] transition-colors duration-200 ${focusRing}`}
            >
              Essential only
            </button>
          </div>

          {/* Toggle details */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            aria-controls="cookie-details"
            className={`flex items-center gap-1 mt-3 min-h-[44px] text-[12px] text-[var(--dawn-ink-3)] hover:text-[var(--dawn-ink-2)] transition-colors w-full justify-center rounded-[6px] ${focusRing}`}
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
                View cookie details
              </>
            )}
          </button>
        </div>

        {/* Expandable details */}
        {showDetails && (
          <div id="cookie-details" className="px-5 pb-5 border-t border-[var(--dawn-line)] pt-4">
            <div
              className="rounded-[12px] p-4 border border-[var(--dawn-line)]"
              style={{ background: 'var(--dawn-cream)' }}
            >
              <h5 className="text-[12px] font-semibold text-[var(--dawn-ink)] mb-2">
                Cookies we use:
              </h5>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--dawn-ink-2)]">
                    <code className="text-[var(--coral-lo)]">sb-*-auth-token</code>
                  </span>
                  <span className="text-[var(--dawn-ink-3)]">Authentication</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--dawn-ink-2)]">
                    <code className="text-[var(--coral-lo)]">sb-*-code-verifier</code>
                  </span>
                  <span className="text-[var(--dawn-ink-3)]">OAuth security</span>
                </div>
              </div>
              <p className="text-[12px] text-[var(--dawn-ink-3)] mt-3 leading-[1.6]">
                These are Supabase authentication cookies required for the app to
                function.
              </p>
            </div>
          </div>
        )}
        </div>
      </motion.div>
    </MotionConfig>
  )
}

/**
 * Hook to check cookie consent status
 */
export function useCookieConsent(): ConsentStatus {
  const [status, setStatus] = useState<ConsentStatus>('pending')

  useEffect(() => {
    let cancelled = false
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored) {
      try {
        const consent: CookieConsent = JSON.parse(stored)
        queueMicrotask(() => {
          if (!cancelled) setStatus(consent.status)
        })
      } catch {
        // The default pending state already represents invalid stored data.
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  return status
}
