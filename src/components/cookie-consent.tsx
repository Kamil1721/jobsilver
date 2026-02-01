'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, ChevronDown, ChevronUp } from 'lucide-react'

const COOKIE_CONSENT_KEY = 'jobsilver-cookie-consent'

type ConsentStatus = 'pending' | 'accepted' | 'declined'

interface CookieConsent {
  status: ConsentStatus
  timestamp: string
  version: string
}

const CONSENT_VERSION = '1.0'

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)

    if (stored) {
      try {
        const consent: CookieConsent = JSON.parse(stored)
        if (consent.version !== CONSENT_VERSION) {
          setShowBanner(true)
        }
      } catch {
        setShowBanner(true)
      }
    } else {
      const timer = setTimeout(() => setShowBanner(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    const consent: CookieConsent = {
      status: 'accepted',
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    closeBanner()
  }

  const handleEssentialOnly = () => {
    const consent: CookieConsent = {
      status: 'declined',
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    }
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
    closeBanner()
  }

  const closeBanner = () => {
    setIsClosing(true)
    setTimeout(() => {
      setShowBanner(false)
      setIsClosing(false)
    }, 300)
  }

  if (!showBanner) return null

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-lg z-50 transition-all duration-300 ${
        isClosing ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Main content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-900/40 rounded-lg flex-shrink-0">
              <Cookie className="w-4 h-4 text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white mb-1">Cookie Settings</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We use <span className="text-zinc-300">essential cookies only</span> for
                authentication and security. No tracking or advertising cookies.{' '}
                <Link href="/privacy" className="text-teal-400 hover:text-teal-300 underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAccept}
              className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleEssentialOnly}
              className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg border border-zinc-700 transition-colors"
            >
              Essential Only
            </button>
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full justify-center"
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                View cookie details
              </>
            )}
          </button>
        </div>

        {/* Expandable details */}
        {showDetails && (
          <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-zinc-300 mb-2">Cookies we use:</h5>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    <code className="text-teal-400/80">sb-*-auth-token</code>
                  </span>
                  <span className="text-zinc-500">Authentication</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">
                    <code className="text-teal-400/80">sb-*-code-verifier</code>
                  </span>
                  <span className="text-zinc-500">OAuth security</span>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                These are Supabase authentication cookies required for the app to function.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Hook to check cookie consent status
 */
export function useCookieConsent(): ConsentStatus {
  const [status, setStatus] = useState<ConsentStatus>('pending')

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (stored) {
      try {
        const consent: CookieConsent = JSON.parse(stored)
        setStatus(consent.status)
      } catch {
        setStatus('pending')
      }
    }
  }, [])

  return status
}
