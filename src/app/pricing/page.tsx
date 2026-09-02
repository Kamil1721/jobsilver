"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  motion,
  MotionConfig,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion"
import { ArrowRight, Check, X, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/landing/nav"
import { CtaButton } from "@/components/landing/cta-button"
import { PublicFooter } from "@/components/public-footer"
import { createCheckoutSession } from "@/lib/stripe/browser"
import { useToast } from "@/hooks/use-toast"

// Types
type BillingCycle = "weekly" | "monthly"
type AuthStatus = "checking" | "anonymous" | "authenticated"

interface SubscriptionProbeData {
  authenticated: boolean
  plan?: string
  isTester?: boolean
  isAdmin?: boolean
  subscription?: {
    status?: string
  } | null
}

interface PricingFeature {
  name: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  description: string
  weeklyPrice: number
  monthlyPrice: number
  features: PricingFeature[]
  cta: string
  popular?: boolean
  badge?: string
  tier: "free" | "pro" | "ultra"
  jobsPerDay: number
  hasAI: boolean
  aiResponsesPerDay?: number | null // -1 = unlimited, null = no access
  coverLettersPerDay?: number | null
  cvGenerationsPerDay?: number | null
  hasTrial?: boolean
}

// 3-tier pricing plans (February 2026)
// Free: 3 jobs/day, NO AI
// Pro: 15 jobs/day, limited AI (30 responses, 5 cover letters, 3 CV gen per day)
// Ultra: 35 jobs/day, UNLIMITED AI, priority support
const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with job discovery",
    weeklyPrice: 0,
    monthlyPrice: 0,
    tier: "free",
    cta: "Get Started",
    jobsPerDay: 3,
    hasAI: false,
    aiResponsesPerDay: null,
    coverLettersPerDay: null,
    cvGenerationsPerDay: null,
    hasTrial: false,
    features: [
      { name: "3 jobs discovered per day", included: true },
      { name: "Kanban job tracking board", included: true },
      { name: "Save up to 50 jobs", included: true },
      { name: "Basic job match scores", included: true },
      { name: "AI chat assistance", included: false },
      { name: "Cover letter generation", included: false },
      { name: "CV generation", included: false },
      { name: "Advanced filters", included: false },
      { name: "Favorite jobs", included: false },
      { name: "Email alerts", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "AI assistance with daily limits",
    weeklyPrice: 3.99,
    monthlyPrice: 12.99,
    tier: "pro",
    popular: true,
    badge: "3-Day Free Trial",
    cta: "Start Free Trial",
    jobsPerDay: 15,
    hasAI: true,
    aiResponsesPerDay: 30,
    coverLettersPerDay: 5,
    cvGenerationsPerDay: 3,
    hasTrial: true,
    features: [
      { name: "15 jobs discovered per day", included: true },
      { name: "30 AI responses per day", included: true },
      { name: "5 cover letters per day", included: true },
      { name: "3 CV generations per day", included: true },
      { name: "Save up to 200 jobs", included: true },
      { name: "Advanced filters", included: true },
      { name: "Favorite jobs", included: true },
      { name: "Daily email alerts", included: true },
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "Unlimited AI for power users",
    weeklyPrice: 6.99,
    monthlyPrice: 19.99,
    tier: "ultra",
    cta: "Subscribe",
    jobsPerDay: 35,
    hasAI: true,
    aiResponsesPerDay: -1, // unlimited
    coverLettersPerDay: -1,
    cvGenerationsPerDay: -1,
    hasTrial: false,
    features: [
      { name: "35 jobs discovered per day", included: true },
      { name: "Unlimited AI chat assistance", included: true },
      { name: "Unlimited cover letters", included: true },
      { name: "Unlimited CV generations", included: true },
      { name: "Unlimited saved jobs", included: true },
      { name: "Advanced filters", included: true },
      { name: "Favorite jobs", included: true },
      { name: "Daily email alerts", included: true },
      { name: "Priority support", included: true },
    ],
  },
]

// FAQ Data
const FAQ_ITEMS = [
  {
    question: "How does the 3-day free trial work?",
    answer: "Pro starts with three free days. Billing begins after the trial on your selected cycle, and you can cancel before then. Ultra billing starts immediately.",
  },
  {
    question: "What's the difference between the plans?",
    answer: "Free gives you 3 jobs/day with basic tracking. Pro ($3.99/week or $12.99/month) unlocks 15 jobs/day plus limited AI: 30 chat responses, 5 cover letters, and 3 CV generations per day. Ultra ($6.99/week or $19.99/month) gives you 35 jobs/day with unlimited AI and priority support.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. Cancel your subscription anytime from your dashboard. You'll retain access until the end of your current billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards through Stripe. Stripe processes your encrypted payment information outside JobSilver's servers.",
  },
  {
    question: "How does the AI assistant help?",
    answer: "The assistant helps draft answers to application questions, cover letters for specific roles, and tailored CVs. Pro users get daily limits (30 AI responses, 5 cover letters, 3 CVs), while Ultra users get unlimited access.",
  },
  {
    question: "What counts as a 'discovered job'?",
    answer: "Each day, new jobs matching your preferences are added to your board. Only newly discovered jobs count toward the daily limit. Free includes 3 per day, Pro 15, and Ultra 35.",
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

function getCheckoutLoginPath(planId: string, cycle: BillingCycle) {
  const checkoutPath = `/checkout-redirect?plan=${planId}&cycle=${cycle}`
  return `/login?next=${encodeURIComponent(checkoutPath)}`
}

// Loading fallback — Dawn light
function PricingLoading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--dawn-bg)" }}
    >
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--dawn-line-2)]" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--coral)] animate-spin" />
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <PricingPageContent />
    </Suspense>
  )
}

function PricingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>("monthly")
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = React.useState<string | null>(null)
  const [authStatus, setAuthStatus] = React.useState<AuthStatus>("checking")
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)
  const accountStateProbe = React.useRef<Promise<SubscriptionProbeData> | null>(null)
  const shouldReduceMotion = useReducedMotion() ?? false

  const { scrollYProgress } = useScroll()

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"])

  React.useEffect(() => {
    const subscription = searchParams.get("subscription")
    if (subscription === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "Subscribe whenever you're ready.",
      })
    }
  }, [searchParams, toast])

  React.useEffect(() => {
    let canceled = false

    async function loadAccountState() {
      try {
        accountStateProbe.current ??= fetch(
          "/api/stripe/subscription?optionalAuth=1"
        ).then(async (response) => {
          const result = await response.json()

          if (!response.ok) {
            throw new Error(
              result.error?.message || "Failed to check account status"
            )
          }

          return result.data as SubscriptionProbeData
        })

        const data = await accountStateProbe.current

        if (canceled) return

        if (!data.authenticated) {
          setAuthStatus("anonymous")
          setCurrentPlan(null)
          return
        }

        setAuthStatus("authenticated")
        const subscriptionStatus = data.subscription?.status
        const hasCurrentAccess =
          data.plan === "free" ||
          data.isTester === true ||
          data.isAdmin === true ||
          subscriptionStatus === "active" ||
          subscriptionStatus === "trialing"

        if (data.plan && hasCurrentAccess) {
          setCurrentPlan(data.plan)
        }
      } catch {
        if (!canceled) {
          setAuthStatus("anonymous")
          setCurrentPlan(null)
        }
      }
    }

    void loadAccountState()

    return () => {
      canceled = true
    }
  }, [])

  const handleSelectPlan = async (planId: string, cycle: BillingCycle) => {
    if (planId === "free") {
      router.push("/login")
      return
    }

    if (authStatus === "checking") return

    if (authStatus === "anonymous") {
      router.push(getCheckoutLoginPath(planId, cycle))
      return
    }

    setLoadingPlan(planId)

    try {
      await createCheckoutSession(planId, cycle)
    } catch (error) {
      if (error instanceof Error && error.message.includes("Authentication")) {
        router.push(getCheckoutLoginPath(planId, cycle))
        return
      }

      console.error("Checkout error:", error)

      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="min-h-screen overflow-x-hidden"
        style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
      >
        <Nav />

        <main className="pt-20">
          {/* Hero */}
          <section className="relative overflow-hidden">
            {/* Soft warm parallax wash — decorative only */}
            <motion.div
              aria-hidden="true"
              style={shouldReduceMotion ? undefined : { y: backgroundY }}
              className="pointer-events-none absolute -top-24 right-[-8%] h-[520px] w-[520px] rounded-full opacity-60 blur-[120px]"
            >
              <div
                className="h-full w-full rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, var(--coral-soft), transparent 72%)",
                }}
              />
            </motion.div>

            <div className="relative mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] pb-[clamp(40px,5vw,72px)] pt-[clamp(56px,7vw,104px)]">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="max-w-[62ch]"
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
                  Pricing
                </p>

                <h1 className="mt-3 text-balance text-[clamp(34px,5vw,58px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]">
                  Simple pricing for a short, focused job hunt.
                </h1>

                <p className="mt-5 max-w-[60ch] text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]">
                  Discover more roles and let AI carry the busywork. Start free, upgrade
                  only when it earns its keep, and cancel the moment you sign the offer.
                </p>

                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--dawn-line)] bg-[var(--dawn-surface)] px-3.5 py-2 shadow-[0_1px_2px_rgba(31,27,24,0.04)]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--coral)]" aria-hidden="true" />
                  <span className="text-[13px] font-medium text-[var(--dawn-ink-2)]">
                    Pro includes a 3-day free trial
                  </span>
                </div>
              </motion.div>

              {/* Billing toggle */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                className="mt-9"
              >
                <BillingToggle cycle={billingCycle} onChange={setBillingCycle} />
              </motion.div>
            </div>
          </section>

          {/* Plan cards */}
          <section className="relative">
            <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] pb-[clamp(48px,6vw,88px)]">
              <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
                {PLANS.map((plan, index) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    billingCycle={billingCycle}
                    onSelect={handleSelectPlan}
                    isLoading={loadingPlan === plan.id}
                    isCurrentPlan={
                      authStatus === "authenticated" && currentPlan === plan.id
                    }
                    isAuthChecking={authStatus === "checking"}
                    index={index}
                  />
                ))}
              </div>

              <p className="mt-10 text-[13px] text-[var(--dawn-ink-2)]">
                The Free plan needs no card. Stripe handles billing, and you can cancel anytime.
              </p>
            </div>
          </section>

          {/* Features Comparison */}
          <ComparisonTable />

          {/* FAQ Section */}
          <section
            className="relative"
            style={{ background: "var(--dawn-cream)" }}
          >
            <div className="mx-auto max-w-[760px] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
              <SectionHeader
                eyebrow="Questions"
                title="Answers before you commit"
                subtitle="Everything you need to know about plans and billing."
              />

              <div className="mt-12 flex flex-col gap-3">
                {FAQ_ITEMS.map((item, index) => (
                  <FAQItem
                    key={index}
                    question={item.question}
                    answer={item.answer}
                    isOpen={openFaq === index}
                    onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative">
            <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className="relative overflow-hidden rounded-[24px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] px-[clamp(24px,5vw,72px)] py-[clamp(48px,6vw,80px)] text-center shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: "var(--coral)" }}
                />
                <h2 className="mx-auto max-w-[20ch] text-balance text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--dawn-ink)]">
                  Ready to land your next role faster?
                </h2>
                <p className="mx-auto mt-4 max-w-[46ch] text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]">
                  Start free with 3 jobs a day. Move up to Pro for AI assistance, or Ultra
                  for unlimited AI assistance and saved jobs.
                </p>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleSelectPlan("pro", billingCycle)}
                    disabled={
                      loadingPlan !== null ||
                      authStatus === "checking" ||
                      (authStatus === "authenticated" && currentPlan === "pro")
                    }
                    aria-busy={
                      loadingPlan === "pro" || authStatus === "checking"
                    }
                    className={cn(
                      "inline-flex min-h-[52px] items-center justify-center whitespace-nowrap rounded-full border border-[var(--coral)] bg-[var(--coral)] px-7 text-[15px] font-semibold leading-none tracking-[-0.01em] text-[var(--coral-ink)] transition-[background-color,border-color,color,transform] duration-200 hover:border-[var(--coral-hi)] hover:bg-[var(--coral-hi)] active:translate-y-px active:border-[var(--coral-active)] active:bg-[var(--coral-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] motion-reduce:transition-none sm:px-8",
                      (loadingPlan !== null ||
                        authStatus === "checking" ||
                        (authStatus === "authenticated" && currentPlan === "pro")) &&
                        "cursor-not-allowed opacity-60"
                    )}
                  >
                    {authStatus === "checking" ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Checking account…
                      </>
                    ) : loadingPlan === "pro" ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Processing…
                      </>
                    ) : authStatus === "authenticated" && currentPlan === "pro" ? (
                      "Current plan"
                    ) : (
                      <>
                        Start free trial
                        <ArrowRight
                          className="ml-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                  <CtaButton href="/#features" variant="ghost" size="lg">
                    Learn more
                  </CtaButton>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <PublicFooter />
      </div>
    </MotionConfig>
  )
}

// Billing Toggle Component — Dawn coral pill
function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle
  onChange: (cycle: BillingCycle) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-[var(--dawn-line)] bg-[var(--dawn-surface)] p-1 shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
      >
        {(["weekly", "monthly"] as const).map((option) => {
          const active = cycle === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                "relative inline-flex min-h-[44px] items-center rounded-full px-5 text-[14px] font-semibold capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]",
                active
                  ? "text-[var(--coral-ink)]"
                  : "text-[var(--dawn-ink-2)] hover:text-[var(--dawn-ink)]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="billing-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[var(--coral)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{option}</span>
            </button>
          )
        })}
      </div>
      <span className="rounded-full bg-[var(--coral-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--coral-lo)]">
        Monthly saves ~25%
      </span>
    </div>
  )
}

// Pricing Card Component — Dawn
function PricingCard({
  plan,
  billingCycle,
  onSelect,
  isLoading,
  isCurrentPlan,
  isAuthChecking,
  index,
}: {
  plan: Plan
  billingCycle: BillingCycle
  onSelect: (planId: string, cycle: BillingCycle) => void
  isLoading: boolean
  isCurrentPlan: boolean
  isAuthChecking: boolean
  index: number
}) {
  const price = billingCycle === "weekly" ? plan.weeklyPrice : plan.monthlyPrice
  const period = billingCycle === "weekly" ? "/ week" : "/ month"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: EASE }}
      className={cn(
        "relative flex h-full flex-col rounded-[16px] border bg-[var(--dawn-surface)] p-6 transition-shadow duration-300",
        plan.popular
          ? "border-[var(--coral)] shadow-[0_20px_50px_-16px_rgba(240,96,58,0.30)] hover:shadow-[0_28px_62px_-16px_rgba(240,96,58,0.40)]"
          : "border-[var(--dawn-line)] shadow-[0_1px_2px_rgba(31,27,24,0.04)] hover:shadow-[0_14px_36px_-12px_rgba(31,27,24,0.12)]"
      )}
    >
      {/* Most popular pill */}
      {plan.popular && (
        <div className="absolute -top-3 left-6">
          <span className="inline-flex items-center rounded-full bg-[var(--coral)] px-3 py-1 text-[12px] font-semibold uppercase leading-none tracking-[0.06em] text-[var(--coral-ink)]">
            Most popular
          </span>
        </div>
      )}

      {/* Current plan indicator */}
      {isCurrentPlan && (
        <div className="absolute right-4 top-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--coral-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--coral-lo)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            Current
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--dawn-ink)]">
          {plan.name}
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.5] text-[var(--dawn-ink-2)]">
          {plan.description}
        </p>
      </div>

      <div className="mt-6 h-px w-full bg-[var(--dawn-line)]" />

      {/* Price */}
      <div className="mt-6 min-h-[68px]">
        <motion.div
          key={billingCycle}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-[clamp(30px,3.4vw,40px)] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--dawn-ink)]">
              {price === 0 ? "Free" : `$${price}`}
            </span>
            {price > 0 && (
              <span className="text-[14px] text-[var(--dawn-ink-2)]">{period}</span>
            )}
          </div>
          {billingCycle === "monthly" && plan.weeklyPrice > 0 ? (
            <p className="mt-2 text-[13px] font-medium text-[var(--coral-lo)]">
              Save ${((plan.weeklyPrice * 4) - plan.monthlyPrice).toFixed(0)}/mo vs weekly
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--dawn-ink-2)]">
              {price === 0 ? "No card required" : "Billed " + billingCycle}
            </p>
          )}
        </motion.div>
      </div>

      {/* Jobs per day — primary metric */}
      <div className="mt-6 rounded-[12px] border border-[var(--dawn-line)] bg-[var(--dawn-cream)] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--dawn-ink-2)]">Jobs discovered</span>
          <span className="text-[22px] font-semibold tracking-[-0.01em] text-[var(--dawn-ink)]">
            {plan.jobsPerDay}/day
          </span>
        </div>
        <div className="mt-2 text-[13px]">
          {plan.hasAI ? (
            plan.aiResponsesPerDay === -1 ? (
              <span className="font-medium text-[var(--coral-lo)]">
                Unlimited AI assistance
              </span>
            ) : (
              <span className="text-[var(--dawn-ink-2)]">
                {plan.aiResponsesPerDay} AI responses / day
              </span>
            )
          ) : (
            <span className="text-[var(--dawn-ink-2)]">AI features require Pro or Ultra</span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="mt-6 flex flex-grow flex-col gap-3">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5">
            {feature.included ? (
              <span
                className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--coral-soft)]"
                aria-hidden="true"
              >
                <Check className="h-3 w-3 text-[var(--coral-lo)]" strokeWidth={3} />
              </span>
            ) : (
              <span
                className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[var(--dawn-line-2)]"
                aria-hidden="true"
              >
                <X className="h-2.5 w-2.5 text-[var(--dawn-ink-3)]" strokeWidth={3} />
              </span>
            )}
            <span
              className={cn(
                "text-[15px] leading-[1.5]",
                feature.included ? "text-[var(--dawn-ink-2)]" : "text-[var(--dawn-ink-2)] line-through decoration-[var(--dawn-line-2)]"
              )}
            >
              {feature.name}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA — triggers Stripe checkout / login redirect via handler */}
      <div className="mt-auto pt-7">
        <button
          type="button"
          onClick={() => onSelect(plan.id, billingCycle)}
          disabled={
            isLoading || isCurrentPlan || (plan.id !== "free" && isAuthChecking)
          }
          aria-busy={
            isLoading || (plan.id !== "free" && isAuthChecking)
          }
          className={cn(
            "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-6 text-[14px] font-medium leading-none tracking-[-0.01em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)] active:scale-[0.985]",
            plan.popular
              ? "bg-[var(--coral)] text-[var(--coral-ink)] hover:bg-[var(--coral-hi)]"
              : "border border-[var(--dawn-line-2)] bg-transparent text-[var(--dawn-ink)] hover:border-[var(--coral)] hover:text-[var(--coral-lo)]",
            (isLoading || isCurrentPlan || (plan.id !== "free" && isAuthChecking)) &&
              "cursor-not-allowed opacity-60"
          )}
        >
          {plan.id !== "free" && isAuthChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking account…
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Processing…
            </>
          ) : isCurrentPlan ? (
            "Current plan"
          ) : (
            <>
              {plan.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}

// Section Header Component — Dawn
function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="max-w-[52ch]"
    >
      {eyebrow && (
        <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 text-balance text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--dawn-ink)]">
        {title}
      </h2>
      <p className="mt-4 max-w-[46ch] text-pretty text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]">
        {subtitle}
      </p>
    </motion.div>
  )
}

// Comparison Table — Dawn, 3 columns, Pro column coral-tinted
function ComparisonTable() {
  const rows: { feature: string; values: (string | boolean)[] }[] = [
    { feature: "Jobs discovered/day", values: ["3", "15", "35"] },
    { feature: "AI chat assistance", values: [false, "30/day", "Unlimited"] },
    { feature: "Cover letters", values: [false, "5/day", "Unlimited"] },
    { feature: "CV generations", values: [false, "3/day", "Unlimited"] },
    { feature: "Saved jobs", values: ["50", "200", "Unlimited"] },
    { feature: "Advanced filters", values: [false, true, true] },
    { feature: "Favorite jobs", values: [false, true, true] },
    { feature: "Email alerts", values: [false, "Daily", "Daily"] },
    { feature: "3-day free trial", values: [false, true, false] },
    { feature: "Weekly price", values: ["Free", "$3.99", "$6.99"] },
    { feature: "Monthly price", values: ["Free", "$12.99", "$19.99"] },
    { feature: "Priority support", values: [false, false, true] },
  ]

  return (
    <section className="relative">
      <div className="mx-auto max-w-[var(--dawn-content)] px-[var(--dawn-gutter)] py-[var(--dawn-section)]">
        <SectionHeader
          eyebrow="Compare"
          title="Every plan, side by side"
          subtitle="Find the right fit for the pace of your search."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="mt-12 overflow-hidden rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
        >
          <div
            role="region"
            aria-label="Plan comparison table"
            tabIndex={0}
            className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--coral)]"
          >
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--dawn-line)]">
                  <th className="min-w-[170px] p-5 text-left text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--dawn-ink-3)]">
                    Feature
                  </th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        "min-w-[120px] p-5 text-center text-[15px] font-semibold text-[var(--dawn-ink)]",
                        plan.popular && "bg-[var(--coral-soft)]"
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {plan.name}
                        {plan.popular && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--coral-lo)]">
                            Popular
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-[var(--dawn-line)] last:border-0"
                  >
                    <td className="p-5 text-[14px] text-[var(--dawn-ink-2)]">
                      {row.feature}
                    </td>
                    {row.values.map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          "p-5 text-center text-[14px]",
                          PLANS[i]?.popular && "bg-[var(--coral-soft)]"
                        )}
                      >
                        {typeof value === "boolean" ? (
                          value ? (
                            <span className="inline-flex justify-center">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--coral-soft)]"
                                aria-hidden="true"
                              >
                                <Check className="h-3 w-3 text-[var(--coral-lo)]" strokeWidth={3} />
                              </span>
                              <span className="sr-only">Included</span>
                            </span>
                          ) : (
                            <>
                              <span className="text-[var(--dawn-ink-3)]" aria-hidden="true">–</span>
                              <span className="sr-only">Not included</span>
                            </>
                          )
                        ) : (
                          <span className="font-medium text-[var(--dawn-ink)]">{value}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// FAQ Item Component — Dawn
function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  const answerId = `pricing-faq-answer-${index}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: EASE }}
      className="overflow-hidden rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="flex min-h-[44px] w-full items-center justify-between gap-4 p-5 text-left transition-colors duration-200 hover:bg-[var(--dawn-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-inset"
      >
        <span className="text-[16px] font-semibold text-[var(--dawn-ink)]">{question}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--coral-lo)] transition-transform duration-300",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      <motion.div
        id={answerId}
        aria-hidden={!isOpen}
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-[15px] leading-[1.6] text-[var(--dawn-ink-2)]">
          {answer}
        </p>
      </motion.div>
    </motion.div>
  )
}
