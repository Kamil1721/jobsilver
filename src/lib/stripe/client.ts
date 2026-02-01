import Stripe from 'stripe'

export type BillingCycle = 'weekly' | 'monthly'

// Lazy-loaded Stripe client (prevents build-time errors when env vars aren't set)
let _stripe: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not configured')
    }
    _stripe = new Stripe(secretKey, {
      typescript: true,
    })
  }
  return _stripe
}

// Legacy export for backwards compatibility - use getStripeClient() for new code
export const stripe = {
  get webhooks() {
    return getStripeClient().webhooks
  },
  get subscriptions() {
    return getStripeClient().subscriptions
  },
  get customers() {
    return getStripeClient().customers
  },
  get checkout() {
    return getStripeClient().checkout
  },
  get billingPortal() {
    return getStripeClient().billingPortal
  },
}

// Plan configuration with billing cycle support
// 2-tier model: Only Pro plan available for purchase
// Environment variables: STRIPE_PRICE_PRO_WEEKLY, STRIPE_PRICE_PRO_MONTHLY
export interface PlanPriceIds {
  weekly: string
  monthly: string
}

export const PLAN_PRICE_IDS: Record<string, PlanPriceIds> = {
  pro: {
    weekly: process.env.STRIPE_PRICE_PRO_WEEKLY || '',
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.STRIPE_PRICE_PRO || '',
  },
  // Legacy mappings - redirect to pro
  starter: {
    weekly: process.env.STRIPE_PRICE_PRO_WEEKLY || '',
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  },
  ultra: {
    weekly: process.env.STRIPE_PRICE_PRO_WEEKLY || '',
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
  },
}

// Get price ID for a specific plan and billing cycle
export function getPriceId(plan: string, billingCycle: BillingCycle): string | null {
  // Map legacy plans to pro
  const effectivePlan = plan === 'starter' || plan === 'ultra' || plan === 'mega' ? 'pro' : plan
  const planPrices = PLAN_PRICE_IDS[effectivePlan]
  if (!planPrices) return null
  return planPrices[billingCycle] || null
}

// Price ID to Plan mapping (reverse lookup)
export function getPlanFromPriceId(priceId: string): { plan: string; billingCycle: BillingCycle } | null {
  for (const [plan, prices] of Object.entries(PLAN_PRICE_IDS)) {
    for (const [cycle, id] of Object.entries(prices)) {
      if (id === priceId) {
        return { plan, billingCycle: cycle as BillingCycle }
      }
    }
  }
  return null
}

// Validate plan name - only 'pro' is valid in the 2-tier model
export function isValidPlan(plan: string): plan is 'pro' {
  return plan === 'pro'
}

// Validate billing cycle
export function isValidBillingCycle(cycle: string): cycle is BillingCycle {
  return ['weekly', 'monthly'].includes(cycle)
}
