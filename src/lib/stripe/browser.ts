import { loadStripe } from '@stripe/stripe-js'
import type { Stripe } from '@stripe/stripe-js'

// Singleton pattern for Stripe instance
let stripePromise: Promise<Stripe | null> | null = null

/**
 * Get Stripe instance for client-side operations
 * Uses singleton pattern to avoid multiple loadStripe calls
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

export type BillingCycle = 'weekly' | 'monthly'

/**
 * Create checkout session and redirect
 */
export async function createCheckoutSession(plan: string, billingCycle: BillingCycle = 'monthly'): Promise<string> {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan, billingCycle }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error?.message || 'Failed to create checkout session')
  }

  // Redirect to checkout or portal URL
  if (result.data?.url) {
    window.location.href = result.data.url
    return result.data.url
  }

  throw new Error('No checkout URL returned')
}

/**
 * Open billing portal for subscription management
 */
export async function openBillingPortal(returnUrl?: string): Promise<void> {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ returnUrl }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error?.message || 'Failed to open billing portal')
  }

  if (result.data?.url) {
    window.location.href = result.data.url
  } else {
    throw new Error('No portal URL returned')
  }
}

/**
 * Fetch current subscription status
 */
export async function getSubscriptionStatus() {
  const response = await fetch('/api/stripe/subscription')

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error?.message || 'Failed to fetch subscription')
  }

  return result.data
}
