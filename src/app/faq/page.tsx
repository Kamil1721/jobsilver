"use client"

import * as React from "react"
import { useRef, useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useScroll, useTransform, useInView } from "framer-motion"
import { ChevronDown, Search, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { PublicFooter } from "@/components/public-footer"

// FAQ Data organized by category
const FAQ_CATEGORIES = [
  {
    id: "getting-started",
    title: "Getting Started",
    questions: [
      {
        question: "How do I create an account?",
        answer: "Sign up with your email or Google account. During setup, you can upload your CV for better job matches. The setup wizard will guide you through setting your job preferences.",
      },
      {
        question: "Is there a mobile app?",
        answer: "Not yet — but our website is fully mobile-friendly and works great on any device. You can add it to your home screen for quick access.",
      },
      {
        question: "What browsers are supported?",
        answer: "JobSilver works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser up to date for the best experience.",
      },
      {
        question: "How do I set up my job preferences?",
        answer: "After logging in, use the setup wizard to configure your preferences. You can set your desired job titles, locations, salary range, and remote work preference. These can be updated anytime in Settings.",
      },
    ],
  },
  {
    id: "job-discovery",
    title: "Job Discovery",
    questions: [
      {
        question: "Where do the jobs come from?",
        answer: "We aggregate jobs from multiple sources including Greenhouse, Lever, and Ashby ATS systems, as well as job APIs. This gives you access to thousands of opportunities from companies of all sizes.",
      },
      {
        question: "How often are new jobs added?",
        answer: "Fresh jobs are discovered daily. Your daily discovery limit refreshes each day at midnight UTC, so you'll always have new opportunities to explore.",
      },
      {
        question: "Why am I seeing jobs that don't match my preferences?",
        answer: "Try refining your preferences in Settings — adjust your job titles, locations, or salary range. Pro and Ultra users benefit from AI that learns from your activity and improves matches over time.",
      },
      {
        question: "Can I search for specific companies?",
        answer: "Company search isn't available yet — job discovery is based on your role preferences, location, and other criteria rather than specific company names. This helps surface opportunities you might otherwise miss.",
      },
    ],
  },
  {
    id: "kanban-tracking",
    title: "Kanban Board & Tracking",
    questions: [
      {
        question: "How do I track my applications?",
        answer: "Use the Kanban board to move jobs through your pipeline. Drag jobs between columns as your application progresses from discovery to offer.",
      },
      {
        question: "What do the three columns mean?",
        answer: "New Matches contains jobs matching your preferences that you haven't acted on yet. Applied is for jobs where you've submitted an application. Offers is for jobs where you've received an offer.",
      },
      {
        question: "Can I move jobs between columns?",
        answer: "Yes — simply drag and drop job cards between columns, or use the menu on each card to change its status.",
      },
      {
        question: "How do I remove a job from my board?",
        answer: "Click the menu (three dots) on any job card and select \"Discard\". The job will be hidden from your board but won't count against your daily discovery limit again.",
      },
    ],
  },
  {
    id: "applying",
    title: "Applying to Jobs",
    questions: [
      {
        question: "Does JobSilver apply to jobs for me?",
        answer: "No. JobSilver helps you discover and prepare for applications, but you always apply directly on the company's website. We never auto-apply on your behalf — this ensures your applications are personal and high-quality.",
      },
      {
        question: "How do I apply to a job?",
        answer: "Click \"Apply\" on any job card to open the company's application page in a new tab. After you've submitted your application there, move the job to your \"Applied\" column to track it.",
      },
      {
        question: "Why manual apply instead of auto-apply?",
        answer: "Manual applications are more personal and have higher success rates. Our AI helps you craft compelling applications that stand out — you just submit them yourself. Quality over quantity.",
      },
    ],
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    questions: [
      {
        question: "What can the AI assistant do?",
        answer: "The AI assistant can write personalized cover letters, help answer application questions, generate optimized CVs for specific roles, analyze job fit, and help you prepare for interviews. Pro users get 30 AI responses, 5 cover letters, and 3 CV generations per day. Ultra users get unlimited AI access.",
      },
      {
        question: "Is the AI chat available to Free users?",
        answer: "Yes — the floating chat button (bottom corner of the screen) is available to everyone. Free users can ask general questions about using JobSilver. Job-specific AI help like cover letters and CV generation requires a Pro or Ultra subscription.",
      },
      {
        question: "How do I access job-specific AI help?",
        answer: "On any job detail page, Pro and Ultra users see an embedded AI chat that has context about that specific job. This allows the AI to write tailored cover letters and application responses. Free users see an option to upgrade.",
      },
      {
        question: "Can I upload screenshots of application forms?",
        answer: "Yes (Pro and Ultra) — you can attach images to your chat messages and the AI will analyze the form fields to help you craft responses. Great for complex application questions.",
      },
      {
        question: "Are my AI conversations private?",
        answer: "Absolutely. Your conversations are stored securely and only you can access them. We never share your data with employers or third parties.",
      },
      {
        question: "What's the difference between the chat button and job page chat?",
        answer: "The floating chat button (bottom corner) helps with general questions and is available to all users. The job page chat (Pro and Ultra) is embedded on job detail pages and has full context about that specific job, enabling tailored assistance.",
      },
    ],
  },
  {
    id: "cv-cover-letters",
    title: "CV & Cover Letters",
    questions: [
      {
        question: "What file formats are supported for CV upload?",
        answer: "You can upload PDF, DOCX, or TXT files. PDF is recommended for best parsing accuracy.",
      },
      {
        question: "How does CV parsing work?",
        answer: "Our AI extracts your skills, work experience, education, and other details from your uploaded CV. This information improves job matching and helps the AI provide more relevant assistance.",
      },
      {
        question: "Can I edit my parsed CV?",
        answer: "You can re-upload a new version of your CV anytime. The system will re-parse it and update your profile accordingly.",
      },
      {
        question: "How are cover letters generated?",
        answer: "Our AI creates personalized cover letters by combining your CV details with the specific job description. Each letter is unique and highlights the most relevant aspects of your experience for that role.",
      },
    ],
  },
  {
    id: "account-billing",
    title: "Account & Billing",
    questions: [
      {
        question: "How do I upgrade to Pro or Ultra?",
        answer: "Go to Pricing and select your plan. Pro ($3.99/week or $12.99/month) includes a 3-day free trial. Ultra ($6.99/week or $19.99/month) has no trial but offers unlimited AI access.",
      },
      {
        question: "How do I cancel my subscription?",
        answer: "Go to Dashboard → Settings → Manage Subscription → Cancel. You'll keep your Pro or Ultra access until the end of your current billing period.",
      },
      {
        question: "Can I get a refund?",
        answer: "We generally don't provide refunds for partial subscription periods. However, if you have exceptional circumstances, contact us via our Contact page and we'll review your request on a case-by-case basis.",
      },
      {
        question: "How do I delete my account?",
        answer: "Go to Dashboard → Settings → Delete Account. This permanently removes all your data including saved jobs, preferences, and CV. This action cannot be undone.",
      },
      {
        question: "What happens to my data when I cancel?",
        answer: "Your preferences, CV, and favorited jobs remain in your account until you actively delete it. Non-favorited jobs older than 60 days are automatically cleaned up to keep your board fresh. You can continue using Free tier features after canceling.",
      },
    ],
  },
  {
    id: "privacy-security",
    title: "Privacy & Security",
    questions: [
      {
        question: "Is my data shared with employers?",
        answer: "No. Your data is never shared with employers, recruiters, or any third parties. We only use your information to improve your job matches and AI assistance.",
      },
      {
        question: "How is my CV stored?",
        answer: "Your CV is securely encrypted and stored in our database. Only you can access it through your authenticated account.",
      },
      {
        question: "Can I download my data?",
        answer: "Yes — go to Dashboard → Profile and click \"Download My Data\". You'll receive a JSON file containing your profile, job preferences, saved jobs, favorites, AI chat history, and learned preferences. You can export your data once per hour.",
      },
    ],
  },
]

export default function FAQPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])

  // Filter questions based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_CATEGORIES

    const query = searchQuery.toLowerCase()
    return FAQ_CATEGORIES.map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(query) ||
          q.answer.toLowerCase().includes(query)
      ),
    })).filter((category) => category.questions.length > 0)
  }, [searchQuery])

  const toggleItem = (categoryId: string, questionIndex: number) => {
    const key = `${categoryId}-${questionIndex}`
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalQuestions = FAQ_CATEGORIES.reduce(
    (sum, cat) => sum + cat.questions.length,
    0
  )

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden"
    >
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
            backgroundSize: "60px 60px",
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
            {[
              { label: "Features", href: "/#why-jobsilver" },
              { label: "How It Works", href: "/#how-it-works" },
              { label: "Pricing", href: "/pricing" },
              { label: "FAQ", href: "/faq" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "text-sm transition-colors duration-300",
                  item.label === "FAQ"
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {item.label}
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
      <section className="relative pt-32 pb-12 md:pt-44 md:pb-16">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="text-center"
          >
            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-6"
            >
              <span className="text-white">Frequently Asked</span>
              <br />
              <span className="bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                Questions
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-lg text-zinc-500 max-w-xl mx-auto mb-10"
            >
              Everything you need to know about JobSilver.
              <br className="hidden sm:block" />
              Can&apos;t find what you&apos;re looking for?{" "}
              <Link href="/contact" className="text-zinc-300 hover:text-white underline underline-offset-4">
                Contact us
              </Link>
              .
            </motion.p>

            {/* Search Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="max-w-md mx-auto"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="text"
                  placeholder={`Search ${totalQuestions} questions...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-zinc-500 focus:outline-none focus:border-white/[0.16] focus:bg-white/[0.05] transition-all duration-300"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="relative py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-6">
          {filteredCategories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-zinc-500 text-lg mb-4">
                No questions found for &quot;{searchQuery}&quot;
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors"
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            <div className="space-y-12">
              {filteredCategories.map((category, categoryIndex) => (
                <FAQCategory
                  key={category.id}
                  category={category}
                  categoryIndex={categoryIndex}
                  openItems={openItems}
                  onToggle={toggleItem}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}
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
                Still have questions?
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-zinc-400 text-lg mb-10 max-w-md mx-auto"
              >
                Can&apos;t find what you&apos;re looking for? Our support team is here to help.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link href="/contact">
                  <button className="group relative px-8 py-4 rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-white transition-transform duration-300 group-hover:scale-105" />
                    <span className="relative z-10 text-zinc-900 font-medium flex items-center gap-2">
                      Contact Support
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

// FAQ Category Component
function FAQCategory({
  category,
  categoryIndex,
  openItems,
  onToggle,
  searchQuery,
}: {
  category: (typeof FAQ_CATEGORIES)[0]
  categoryIndex: number
  openItems: Record<string, boolean>
  onToggle: (categoryId: string, questionIndex: number) => void
  searchQuery: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-50px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
    >
      {/* Category Header */}
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-sm text-zinc-400">
          {category.questions.length}
        </span>
        {category.title}
      </h2>

      {/* Questions */}
      <div className="space-y-3">
        {category.questions.map((item, questionIndex) => (
          <FAQItem
            key={questionIndex}
            question={item.question}
            answer={item.answer}
            isOpen={openItems[`${category.id}-${questionIndex}`] || false}
            onToggle={() => onToggle(category.id, questionIndex)}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </motion.div>
  )
}

// FAQ Item Component
function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  searchQuery,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  searchQuery: string
}) {
  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-zinc-700/50 text-white rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.04] bg-white/[0.01]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors duration-300"
      >
        <span className="font-medium text-white pr-4">
          {highlightText(question)}
        </span>
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
          {highlightText(answer)}
        </p>
      </motion.div>
    </div>
  )
}
