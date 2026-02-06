"use client"

import * as React from "react"
import { Suspense, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import {
  ArrowRight,
  Check,
  X,
  Sparkles,
  Loader2,
  Zap,
  Rocket,
  Crown,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PublicFooter } from "@/components/public-footer"
import { createCheckoutSession } from "@/lib/stripe/browser"
import { useToast } from "@/hooks/use-toast"

// Types
type BillingCycle = "weekly" | "monthly"

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
    answer: "The Pro plan includes a 3-day free trial. Start instantly, no charge for 3 days. Cancel anytime before the trial ends and you won't be billed. After the trial, you'll be charged based on your selected billing cycle. Note: Ultra has no trial and charges immediately.",
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
    answer: "We accept all major credit cards through Stripe. Your payment information is encrypted and never stored on our servers.",
  },
  {
    question: "How does the AI assistant help?",
    answer: "Our AI assistant helps you craft compelling answers to application questions, writes personalized cover letters tailored to each role, and generates optimized CVs. Pro users get daily limits (30 AI responses, 5 cover letters, 3 CVs), while Ultra users get unlimited access.",
  },
  {
    question: "What counts as a 'discovered job'?",
    answer: "Each day, new jobs matching your preferences are automatically discovered and added to your board. Each new job counts toward your daily limit. Jobs you've already seen don't count again. Free: 3/day, Pro: 15/day, Ultra: 35/day.",
  },
]

// Loading fallback
function PricingLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-zinc-400 animate-spin" />
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
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [openFaq, setOpenFaq] = React.useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])

  React.useEffect(() => {
    const subscription = searchParams.get("subscription")
    if (subscription === "canceled") {
      toast({
        title: "Checkout canceled",
        description: "No worries! Subscribe whenever you're ready.",
      })
    }
  }, [searchParams, toast])

  React.useEffect(() => {
    async function fetchSubscription() {
      try {
        const response = await fetch("/api/stripe/subscription")
        if (response.ok) {
          const data = await response.json()
          setIsLoggedIn(true)
          if (data.data?.plan && data.data?.status === 'active') {
            setCurrentPlan(data.data.plan)
          }
        }
      } catch {
        setIsLoggedIn(false)
        setCurrentPlan(null)
      }
    }
    fetchSubscription()
  }, [])

  const handleSelectPlan = async (planId: string, cycle: BillingCycle) => {
    if (planId === "free") {
      router.push("/login")
      return
    }

    setLoadingPlan(planId)

    try {
      await createCheckoutSession(planId, cycle)
    } catch (error) {
      console.error("Checkout error:", error)

      if (error instanceof Error && error.message.includes("Authentication")) {
        // Redirect to login with checkout intent in URL
        router.push(`/login?next=${encodeURIComponent(`/checkout-redirect?plan=${planId}&cycle=${cycle}`)}`)
        return
      }

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
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          style={{ y: backgroundY }}
          className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-zinc-800/30 via-zinc-900/20 to-transparent blur-[120px]"
        />
        <motion.div
          style={{ y: backgroundY }}
          className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-zinc-700/20 via-transparent to-transparent blur-[100px]"
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.04]" />
        <div className="relative max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center group">
            <Image
              src="/logo-dark.svg"
              alt="JobSilver"
              width={160}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {["Features", "How It Works", "Pricing", "FAQ"].map((item) => (
              <Link
                key={item}
                href={item === "Pricing" ? "/pricing" : item === "FAQ" ? "/faq" : `/#${item.toLowerCase().replace(/ /g, "-")}`}
                className={cn(
                  "text-sm transition-colors duration-300",
                  item === "Pricing"
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors duration-300"
            >
              Sign In
            </Link>
            <Link href="/login">
              <button className="relative px-5 py-2.5 text-sm font-medium rounded-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700 transition-all duration-500 group-hover:scale-105" />
                <div className="absolute inset-[1px] bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[10px]" />
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5" />
                <span className="relative z-10 text-zinc-200 group-hover:text-white transition-colors">
                  Get Started
                </span>
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-44 md:pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Pro plan includes 3-day free trial
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05] mb-6"
            >
              <span className="text-white">Simple pricing,</span>
              <br />
              <span className="bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                powerful results
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-zinc-500 max-w-xl mx-auto mb-12 leading-relaxed"
            >
              Discover more jobs and let AI supercharge your applications.
              Choose the plan that fits your job search.
            </motion.p>

            {/* Billing Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <BillingToggle cycle={billingCycle} onChange={setBillingCycle} />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards - 3 cards */}
      <section className="relative py-8 md:py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6 md:gap-6 items-stretch">
            {PLANS.map((plan, index) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                onSelect={handleSelectPlan}
                isLoading={loadingPlan === plan.id}
                isCurrentPlan={isLoggedIn && currentPlan === plan.id}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <ComparisonTable billingCycle={billingCycle} />

      {/* FAQ Section */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-6">
          <SectionHeader
            title="Questions & Answers"
            subtitle="Everything you need to know"
          />

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-16 space-y-3"
          >
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
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 via-zinc-900/80 to-zinc-900" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            <div className="absolute inset-[1px] rounded-3xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-3xl md:text-4xl font-semibold text-white mb-4"
              >
                Ready to land your next role faster?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-zinc-400 text-lg mb-10 max-w-md mx-auto"
              >
                Start free with 3 jobs per day. Upgrade to Pro for AI assistance, or Ultra for unlimited power.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/login">
                  <button className="group relative px-8 py-4 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-105" />
                    <span className="relative z-10 text-zinc-900 font-medium flex items-center gap-2">
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </button>
                </Link>

                <Link href="/#features">
                  <button className="px-8 py-4 rounded-2xl text-zinc-400 hover:text-white transition-colors duration-300">
                    Learn More
                  </button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}

// Billing Toggle Component
function BillingToggle({
  cycle,
  onChange
}: {
  cycle: BillingCycle
  onChange: (cycle: BillingCycle) => void
}) {
  return (
    <div className="inline-flex items-center p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      {(["weekly", "monthly"] as const).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "relative px-6 py-2.5 text-sm font-medium rounded-xl transition-all duration-300",
            cycle === option
              ? "text-white"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {cycle === option && (
            <motion.div
              layoutId="billing-indicator"
              className="absolute inset-0 bg-white/[0.08] rounded-xl border border-white/[0.08]"
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />
          )}
          <span className="relative z-10 capitalize">{option}</span>
          {option === "monthly" && (
            <span className="relative z-10 ml-2 text-xs text-emerald-500">Save 25%</span>
          )}
        </button>
      ))}
    </div>
  )
}

// Pricing Card Component
function PricingCard({
  plan,
  billingCycle,
  onSelect,
  isLoading,
  isCurrentPlan,
  index,
}: {
  plan: Plan
  billingCycle: BillingCycle
  onSelect: (planId: string, cycle: BillingCycle) => void
  isLoading: boolean
  isCurrentPlan: boolean
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  const price = billingCycle === "weekly" ? plan.weeklyPrice : plan.monthlyPrice
  const period = billingCycle === "weekly" ? "/week" : "/month"

  const Icon = plan.tier === "free" ? Zap : plan.tier === "ultra" ? Crown : Rocket

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn(
        "relative group rounded-2xl overflow-hidden h-full",
        plan.popular && "md:-mt-4 md:mb-4"
      )}
    >
      {/* Card background */}
      <div className={cn(
        "absolute inset-0 transition-all duration-500",
        plan.popular
          ? "bg-gradient-to-b from-zinc-800/80 via-zinc-900/90 to-zinc-900"
          : "bg-zinc-900/50 group-hover:bg-zinc-900/70"
      )} />

      {/* Border gradient */}
      <div className={cn(
        "absolute inset-0 rounded-2xl transition-opacity duration-500",
        plan.popular
          ? "bg-gradient-to-b from-white/20 via-white/5 to-transparent p-px opacity-100"
          : "bg-gradient-to-b from-white/10 via-white/[0.02] to-transparent p-px opacity-0 group-hover:opacity-100"
      )}>
        <div className="absolute inset-[1px] rounded-2xl bg-zinc-900" />
      </div>

      {/* Shine effect for popular */}
      {plan.popular && (
        <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      )}

      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
          <div className="px-4 py-1.5 rounded-b-xl bg-gradient-to-r from-white/10 via-white/20 to-white/10 border-x border-b border-white/10">
            <span className="text-xs font-semibold tracking-wide text-white">
              {plan.badge}
            </span>
          </div>
        </div>
      )}

      {/* Current plan indicator */}
      {isCurrentPlan && (
        <div className="absolute top-3 right-3 z-20">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Current</span>
          </div>
        </div>
      )}

      <div className="relative z-10 p-6 md:p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 h-12">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="text-sm text-zinc-500 truncate">{plan.description}</p>
          </div>
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0 ml-4",
            plan.popular
              ? "bg-white/10 text-white"
              : "bg-white/[0.03] text-zinc-500 group-hover:bg-white/[0.06] group-hover:text-zinc-300"
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-semibold tracking-tight text-white">
              {price === 0 ? "Free" : `$${price}`}
            </span>
            {price > 0 && (
              <span className="text-sm text-zinc-500">{period}</span>
            )}
          </div>
          {billingCycle === "monthly" && plan.weeklyPrice > 0 && (
            <p className="text-xs text-emerald-500/80 mt-1">
              Save ${((plan.weeklyPrice * 4) - plan.monthlyPrice).toFixed(0)}/mo vs weekly
            </p>
          )}
        </div>

        {/* Jobs per day indicator - PRIMARY METRIC */}
        <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Jobs discovered</span>
            <span className="text-2xl font-bold text-white">
              {plan.jobsPerDay}/day
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {plan.hasAI ? (
              plan.aiResponsesPerDay === -1 ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Unlimited AI assistance</span>
                </span>
              ) : (
                <span className="text-zinc-400">
                  {plan.aiResponsesPerDay} AI responses/day
                </span>
              )
            ) : (
              "AI features require Pro or Ultra"
            )}
          </p>
        </div>

        {/* Features */}
        <ul className="space-y-3 flex-grow">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              {feature.included ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-3 h-3 text-zinc-600" strokeWidth={3} />
                </div>
              )}
              <span className={cn(
                "text-sm",
                feature.included ? "text-zinc-300" : "text-zinc-600"
              )}>
                {feature.name}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          onClick={() => onSelect(plan.id, billingCycle)}
          disabled={isLoading || isCurrentPlan}
          className={cn(
            "relative w-full py-4 rounded-xl font-medium text-sm transition-all duration-300 overflow-hidden group/btn mt-8",
            plan.popular
              ? "bg-white text-zinc-900 hover:bg-zinc-100"
              : "bg-white/[0.05] text-white border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]",
            (isLoading || isCurrentPlan) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </span>
          ) : isCurrentPlan ? (
            "Current Plan"
          ) : (
            <span className="flex items-center justify-center gap-2">
              {plan.cta}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </span>
          )}
        </button>
      </div>
    </motion.div>
  )
}

// Section Header Component
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="text-center"
    >
      <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3">{title}</h2>
      <p className="text-zinc-500">{subtitle}</p>
    </motion.div>
  )
}

// Comparison Table - 3 columns
function ComparisonTable({ billingCycle }: { billingCycle: BillingCycle }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  const rows = [
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
    <section className="relative py-24 md:py-32" ref={ref}>
      <div className="max-w-4xl mx-auto px-6">
        <SectionHeader
          title="Compare plans"
          subtitle="Find the right fit for your job search"
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 rounded-2xl overflow-hidden border border-white/[0.04] bg-white/[0.01]"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="text-left p-5 text-sm font-medium text-zinc-500 min-w-[160px]">
                    Feature
                  </th>
                  {PLANS.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        "p-5 text-center text-sm font-semibold min-w-[120px]",
                        plan.popular ? "text-white bg-white/[0.02]" : "text-zinc-300"
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <motion.tr
                    key={row.feature}
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + rowIndex * 0.05 }}
                    className="border-b border-white/[0.02] last:border-0"
                  >
                    <td className="p-5 text-sm text-zinc-400">
                      {row.feature}
                    </td>
                    {row.values.map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          "p-5 text-center text-sm",
                          PLANS[i]?.popular && "bg-white/[0.02]"
                        )}
                      >
                        {typeof value === "boolean" ? (
                          value ? (
                            <div className="flex justify-center">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <Check className="w-3 h-3 text-emerald-400" />
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600">&mdash;</span>
                          )
                        ) : (
                          <span className="font-medium text-zinc-300">{value}</span>
                        )}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// FAQ Item Component
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
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.01]"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors duration-300"
      >
        <span className="font-medium text-white pr-4">{question}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-zinc-500 flex-shrink-0 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed">
          {answer}
        </p>
      </motion.div>
    </motion.div>
  )
}
