"use client"

import * as React from "react"
import { useRef, Suspense, lazy } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import {
  ArrowRight,
  Clock,
  Brain,
  Send,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PublicFooter } from "@/components/public-footer"

// Lazy load the video players to avoid blocking initial render
const HeroVideoPlayer = lazy(() => import('@/components/video/HeroVideoPlayer'))
const FeatureVideoPlayer = lazy(() => import('@/components/video/FeatureVideoPlayer'))

// Problem → Solution cards
const problemSolutions = [
  {
    icon: Clock,
    problem: "Spending hours searching job boards",
    solution: "Get up to 35 curated job matches delivered daily — no endless scrolling",
  },
  {
    icon: Brain,
    problem: "Writing applications from scratch",
    solution: "AI helps craft cover letters, CVs, and application answers (unlimited with Ultra)",
  },
  {
    icon: Send,
    problem: "Losing track of applications",
    solution: "Visual Kanban board tracks every job from discovery to offer",
  },
]

// Simplified steps
const steps = [
  {
    number: "01",
    title: "Set Up Your Profile",
    description: "Upload your CV and set your preferences. Free: 3 jobs/day, Pro: 15, Ultra: 35.",
  },
  {
    number: "02",
    title: "Get Daily Matches",
    description: "Fresh curated jobs arrive daily. Apply directly on company sites — we never auto-apply.",
  },
  {
    number: "03",
    title: "Win with AI",
    description: "Get AI help with cover letters, CVs, and interview prep. Pro has daily limits, Ultra is unlimited.",
  },
]

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Gradient orbs */}
        <motion.div
          style={{ y: backgroundY }}
          className="absolute top-[-20%] left-[10%] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-zinc-800/30 via-zinc-900/20 to-transparent blur-[120px]"
        />
        <motion.div
          style={{ y: backgroundY }}
          className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-zinc-700/20 via-transparent to-transparent blur-[100px]"
        />

        {/* Metallic grid */}
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
        <div className="relative max-w-7xl mx-auto grid grid-cols-3 h-16 items-center px-6">
          {/* Left - Logo */}
          <Link href="/" className="flex items-center group justify-self-start">
            <Image
              src="/logo-dark.svg"
              alt="JobSilver"
              width={160}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Center - Nav links */}
          <div className="hidden md:flex items-center justify-center gap-8">
            <a
              href="#why-jobsilver"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
            >
              Why JobSilver
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
            >
              How It Works
            </a>
            <a
              href="/pricing"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
            >
              Pricing
            </a>
            <a
              href="/faq"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
            >
              FAQ
            </a>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3 justify-self-end">
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
            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05] mb-6"
            >
              <span className="text-white">Your dream job,</span>
              <br />
              <span className="bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                delivered daily
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-lg md:text-xl text-zinc-500 max-w-xl mx-auto mb-12 leading-relaxed"
            >
              Get up to 35 curated job matches per day. Unlock AI assistance for cover letters,
              CVs, and more. Start free, upgrade when ready.
            </motion.p>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Link href="/pricing">
                <button className="group relative px-8 py-4 rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700 transition-all duration-500 group-hover:scale-105" />
                  <div className="absolute inset-[1px] bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[14px]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/5" />
                  <span className="relative z-10 text-zinc-200 group-hover:text-white font-medium flex items-center gap-2 transition-colors">
                    Start Free — No Card Required
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Animated Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-20 md:mt-28 relative"
          >
            <div className="relative mx-auto max-w-5xl">
              {/* Glow effect behind */}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-800/20 via-zinc-700/10 to-transparent blur-3xl -z-10 scale-110" />

              {/* Remotion Video Player with fallback */}
              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-black/50">
                {/* Shine effect */}
                <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

                <Suspense
                  fallback={
                    <div className="aspect-video bg-[#0a0a0b] animate-pulse">
                      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
                        <div className="flex gap-2">
                          <div className="w-3 h-3 rounded-full bg-zinc-700" />
                          <div className="w-3 h-3 rounded-full bg-zinc-700" />
                          <div className="w-3 h-3 rounded-full bg-zinc-700" />
                        </div>
                      </div>
                      <div className="p-8 grid grid-cols-3 gap-4 h-full">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-zinc-900/50 rounded-xl border border-white/[0.04]" />
                        ))}
                      </div>
                    </div>
                  }
                >
                  <HeroVideoPlayer />
                </Suspense>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem → Solution Section */}
      <section id="why-jobsilver" className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            title="Simple pricing, powerful results"
            subtitle="Free gets you started. Pro adds AI. Ultra unlocks everything."
          />

          <div className="mt-16 grid md:grid-cols-3 gap-5">
            {problemSolutions.map((item, index) => (
              <ProblemSolutionCard key={item.problem} item={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative py-24 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-900/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6">
          <SectionHeader
            title="Three steps to your next role"
            subtitle="Get started in minutes and let our AI do the heavy lifting"
          />

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <StepCard key={step.number} step={step} index={index} totalSteps={steps.length} />
            ))}
          </div>
        </div>
      </section>

      {/* AI-Powered Applications Demo Section */}
      <section id="see-it-in-action" className="relative py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            title="AI-Powered Applications"
            subtitle="Watch how our AI assistant helps you craft perfect applications"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mt-16 relative mx-auto max-w-5xl"
          >
            {/* Glow effect behind */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-800/20 via-zinc-700/10 to-transparent blur-3xl -z-10 scale-110" />

            {/* Video container */}
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm shadow-2xl shadow-black/50">
              {/* Shine effect */}
              <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

              <Suspense
                fallback={
                  <div className="aspect-[5/3] bg-[#0a0a0b] animate-pulse flex items-center justify-center">
                    <div className="text-zinc-600 text-sm">Loading demo...</div>
                  </div>
                }
              >
                <FeatureVideoPlayer feature="application-flow" />
              </Suspense>
            </div>

            {/* Caption */}
            <p className="mt-6 text-center text-sm text-zinc-500">
              Get AI-powered summaries, tailored cover letters, and interview prep for every application
            </p>
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
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 via-zinc-900/80 to-zinc-900" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            <div className="absolute inset-[1px] rounded-3xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent" />

            {/* Shine effect */}
            <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-3xl md:text-4xl font-semibold text-white mb-4"
              >
                Start free. Upgrade when ready.
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-zinc-400 text-lg mb-10 max-w-md mx-auto"
              >
                Free: 3 jobs/day. Pro: 15 jobs + AI from $3.99/week. Ultra: 35 jobs + unlimited AI.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/pricing">
                  <button className="group relative px-8 py-4 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-105" />
                    <span className="relative z-10 text-zinc-900 font-medium flex items-center gap-2">
                      Get Started Free
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </button>
                </Link>

                <Link href="/pricing">
                  <button className="px-8 py-4 rounded-2xl text-zinc-400 hover:text-white transition-colors duration-300">
                    View Pricing
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

// Section Header Component
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="text-center max-w-2xl mx-auto"
    >
      <h2 className="text-2xl md:text-4xl font-semibold text-white mb-4">{title}</h2>
      <p className="text-zinc-500 text-lg">{subtitle}</p>
    </motion.div>
  )
}

// Problem Solution Card
function ProblemSolutionCard({
  item,
  index
}: {
  item: typeof problemSolutions[0]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="group relative rounded-2xl overflow-hidden"
    >
      {/* Card background */}
      <div className="absolute inset-0 bg-zinc-900/50 group-hover:bg-zinc-900/70 transition-all duration-500" />

      {/* Border gradient */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 via-white/[0.02] to-transparent p-px opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-[1px] rounded-2xl bg-zinc-900" />
      </div>

      <div className="relative z-10 p-6 md:p-7">
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300",
          "bg-white/[0.03] text-zinc-500 group-hover:bg-white/[0.06] group-hover:text-zinc-300"
        )}>
          <item.icon className="w-6 h-6" />
        </div>

        {/* Problem (crossed out) */}
        <p className="text-zinc-600 text-sm mb-3 line-through decoration-zinc-700">
          {item.problem}
        </p>

        {/* Solution */}
        <p className="text-white font-medium leading-relaxed">
          {item.solution}
        </p>
      </div>
    </motion.div>
  )
}

// Step Card
function StepCard({
  step,
  index,
  totalSteps
}: {
  step: typeof steps[0]
  index: number
  totalSteps: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="relative text-center"
    >
      {/* Connector line */}
      {index < totalSteps - 1 && (
        <div className="hidden md:block absolute top-8 left-[calc(50%+3rem)] w-[calc(100%-6rem)] h-px bg-gradient-to-r from-zinc-700/50 to-transparent" />
      )}

      {/* Step number */}
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900/80 border border-white/[0.08] mb-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/[0.02]" />
        <span className="text-2xl font-semibold bg-gradient-to-b from-zinc-300 to-zinc-500 bg-clip-text text-transparent relative z-10">
          {step.number}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>
    </motion.div>
  )
}
