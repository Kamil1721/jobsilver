"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { motion, MotionConfig } from "framer-motion"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Nav } from "@/components/landing/nav"
import { CtaButton } from "@/components/landing/cta-button"
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
        answer: "JobSilver works in a mobile browser on any device. Add it to your home screen for quick access.",
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
        question: "How can I improve my matches?",
        answer: "Refine your job titles, locations, or salary range in Settings. Pro and Ultra matching also learns from your activity over time.",
      },
      {
        question: "How are companies included in discovery?",
        answer: "Job discovery uses your role preferences, location, and other criteria across many companies. This can surface relevant roles beyond the companies already on your list.",
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
        answer: "Yes. Drag job cards between columns, or use the menu on each card to change its status.",
      },
      {
        question: "How do I remove a job from my board?",
        answer: "Open the menu on any job card and select \"Discard\". The job stays hidden and remains excluded from future daily discovery counts.",
      },
    ],
  },
  {
    id: "applying",
    title: "Applying to Jobs",
    questions: [
      {
        question: "How does JobSilver help with applications?",
        answer: "JobSilver helps you discover roles and prepare tailored application materials. When you are ready, open the employer's site to review and submit.",
      },
      {
        question: "How do I apply to a job?",
        answer: "Choose \"Apply\" on a job card to open the employer's application page in a new tab. Review and submit there, then move the job to your \"Applied\" column to track it.",
      },
      {
        question: "Can I review my materials before submitting?",
        answer: "Yes. JobSilver prepares drafts for you to review and edit. Once they are ready, finish and submit the application on the employer's site.",
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
        answer: "Yes. The floating chat button is available to everyone for general questions about JobSilver. Job-specific help with cover letters and CV generation is included with Pro and Ultra.",
      },
      {
        question: "How do I access job-specific AI help?",
        answer: "On any job detail page, Pro and Ultra users see an embedded AI chat that has context about that specific job. This allows the AI to write tailored cover letters and application responses. Free users see an option to upgrade.",
      },
      {
        question: "Can I upload screenshots of application forms?",
        answer: "Yes, with Pro and Ultra. Attach images to a chat message and the AI will analyze the form fields to help you draft responses.",
      },
      {
        question: "Are my AI conversations private?",
        answer: "Yes. Your conversations are stored securely for your account, and only you can access them.",
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
        answer: "Go to Pricing and select your plan. Pro ($3.99/week or $12.99/month) includes a 3-day free trial. Ultra ($6.99/week or $19.99/month) starts immediately and includes unlimited AI access.",
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
        question: "Who can access my account data?",
        answer: "Your account data is private to you. JobSilver uses it to improve your job matches and AI assistance.",
      },
      {
        question: "How is my CV stored?",
        answer: "Your CV is securely encrypted and stored in our database. Only you can access it through your authenticated account.",
      },
      {
        question: "Can I download my data?",
        answer: "Yes. Go to Dashboard → Profile and click \"Download My Data\". You'll receive a JSON file containing your profile, job preferences, saved jobs, favorites, AI chat history, and learned preferences. You can export your data once per hour.",
      },
    ],
  },
]

const faqItemKey = (categoryId: string, question: string) =>
  `${categoryId}:${question}`

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

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

  const toggleItem = (categoryId: string, question: string) => {
    const key = faqItemKey(categoryId, question)
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalQuestions = FAQ_CATEGORIES.reduce(
    (sum, cat) => sum + cat.questions.length,
    0
  )

  // Derived (read-only) count of questions matching the current search
  const matchCount = useMemo(
    () =>
      filteredCategories.reduce((sum, cat) => sum + cat.questions.length, 0),
    [filteredCategories]
  )

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "var(--dawn-bg)", color: "var(--dawn-ink)" }}
    >
      <Nav />

      <MotionConfig reducedMotion="user">
        <main className="pt-16">
          {/* Hero */}
          <section
            className="mx-auto px-[var(--dawn-gutter)] pb-12 pt-[clamp(56px,9vw,104px)]"
            style={{ maxWidth: "var(--dawn-content)" }}
          >
            <div className="max-w-[720px]">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[var(--coral-lo)]"
              >
                FAQ
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.05 }}
                className="mt-4 text-[clamp(34px,5vw,58px)] font-semibold leading-[1.03] tracking-[-0.02em] text-[var(--dawn-ink)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Questions, answered
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="mt-5 max-w-[58ch] text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]"
              >
                Everything worth knowing about how JobSilver finds, tracks, and helps you land
                the right role. Still stuck?{" "}
                <Link
                  href="/contact"
                  className="rounded-sm font-medium text-[var(--coral-lo)] underline decoration-[var(--coral)]/40 underline-offset-4 transition-colors hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
                >
                  Talk to us
                </Link>
                .
              </motion.p>

              {/* Search */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.15 }}
                className="mt-8 max-w-[520px]"
              >
                <div className="group relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[18px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--dawn-ink-3)] transition-colors duration-200 group-focus-within:text-[var(--coral-lo)]"
                  />
                  <input
                    type="text"
                    aria-label="Search frequently asked questions"
                    placeholder={`Search ${totalQuestions} questions`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-[52px] w-full rounded-full border border-[var(--dawn-line-2)] bg-[var(--dawn-surface)] py-3 pl-[46px] pr-5 text-[15px] text-[var(--dawn-ink)] shadow-[0_2px_12px_-6px_rgba(31,27,24,0.14),0_1px_2px_rgba(31,27,24,0.04)] transition-[box-shadow,border-color] duration-200 placeholder:text-[var(--dawn-ink-3)] hover:border-[var(--dawn-ink-3)] focus:border-[var(--coral)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
                  />
                </div>
                {searchQuery.trim() ? (
                  <p
                    aria-live="polite"
                    className="mt-3 pl-1 text-[13px] tabular-nums text-[var(--dawn-ink-2)]"
                  >
                    {matchCount === 0
                      ? "No matches. Try another word."
                      : `${matchCount} ${matchCount === 1 ? "result" : "results"} for “${searchQuery}”`}
                  </p>
                ) : null}
              </motion.div>
            </div>
          </section>

          {/* Categories */}
          <section
            className="mx-auto px-[var(--dawn-gutter)] pb-[clamp(72px,9vw,120px)]"
            style={{ maxWidth: "var(--dawn-content)" }}
          >
            <div className="max-w-[820px]">
              {filteredCategories.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-[16px] border border-[var(--dawn-line)] bg-[var(--dawn-surface)] px-6 py-16 text-center shadow-[0_1px_2px_rgba(31,27,24,0.04)]"
                >
                  <p className="text-[16px] text-[var(--dawn-ink-2)]">
                    Nothing matched &ldquo;{searchQuery}&rdquo;. Try a different word.
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] font-medium text-[var(--coral-lo)] underline decoration-[var(--coral)]/40 underline-offset-4 transition-colors hover:decoration-[var(--coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dawn-bg)]"
                  >
                    Clear search
                  </button>
                </motion.div>
              ) : (
                <div className="space-y-14">
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

          {/* CTA */}
          <section
            className="px-[var(--dawn-gutter)] pb-[clamp(72px,9vw,120px)]"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55 }}
              className="mx-auto rounded-[24px] border border-[var(--dawn-line)] px-[clamp(28px,5vw,64px)] py-[clamp(48px,7vw,80px)] text-center"
              style={{ maxWidth: "var(--dawn-content)", background: "var(--dawn-cream)" }}
            >
              <h2
                className="text-[clamp(28px,3.6vw,42px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--dawn-ink)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Still have questions?
              </h2>
              <p className="mx-auto mt-4 max-w-[46ch] text-[clamp(16px,1.1vw,18px)] leading-[1.6] text-[var(--dawn-ink-2)]">
                We read every message and reply like humans, because we are. Reach out and
                we&apos;ll help you get set up.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <CtaButton href="/contact" variant="coral" size="lg">
                  Contact support
                </CtaButton>
                <CtaButton href="/pricing" variant="ghost" size="lg">
                  View pricing
                </CtaButton>
              </div>
            </motion.div>
          </section>
        </main>
      </MotionConfig>

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
  onToggle: (categoryId: string, question: string) => void
  searchQuery: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: Math.min(categoryIndex * 0.06, 0.24) }}
    >
      {/* Category Header */}
      <div className="mb-6 flex items-baseline gap-3 border-b border-[var(--dawn-line)] pb-3">
        <span className="text-[12px] font-medium tabular-nums text-[var(--dawn-ink-3)]">
          {String(categoryIndex + 1).padStart(2, "0")}
        </span>
        <h2 className="text-[18px] font-semibold leading-[1.15] tracking-[-0.01em] text-[var(--dawn-ink)] md:text-[20px]">
          {category.title}
        </h2>
        <span className="ml-auto shrink-0 self-center text-[12px] tabular-nums text-[var(--dawn-ink-3)]">
          {category.questions.length}
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {category.questions.map((item) => (
          <FAQItem
            key={item.question}
            question={item.question}
            answer={item.answer}
            isOpen={openItems[faqItemKey(category.id, item.question)] || false}
            onToggle={() => onToggle(category.id, item.question)}
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
  const answerId = React.useId()
  const triggerId = `${answerId}-trigger`

  // Highlight matching text
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="rounded bg-[var(--coral-soft)] px-0.5 text-[var(--coral-lo)]">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[14px] border transition-[border-color,background-color,box-shadow] duration-200",
        isOpen
          ? "border-[var(--coral)] bg-[var(--dawn-surface)] shadow-[0_10px_28px_-18px_rgba(240,96,58,0.35),0_1px_2px_rgba(31,27,24,0.05)]"
          : "border-[var(--dawn-line)] bg-[var(--dawn-surface)] shadow-[0_1px_2px_rgba(31,27,24,0.04)] hover:border-[var(--dawn-line-2)]"
      )}
    >
      {/* Coral edge — appears only while open, keeping the accent precious */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] origin-top bg-[var(--coral)] transition-transform duration-300",
          isOpen ? "scale-y-100" : "scale-y-0"
        )}
      />
      <button
        id={triggerId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-[14px] px-5 py-4 text-left transition-colors duration-200 hover:bg-[rgba(240,96,58,0.035)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--coral)] active:bg-[rgba(240,96,58,0.07)] md:py-5"
      >
        <span className="pr-2 text-[15px] font-medium text-[var(--dawn-ink)] md:text-[16px]">
          {highlightText(question)}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200",
            isOpen ? "bg-[var(--coral-soft)]" : "bg-[var(--dawn-cream)]"
          )}
        >
          <ChevronDown
            className={cn(
              "h-[16px] w-[16px] transition-transform duration-300",
              isOpen ? "rotate-180 text-[var(--coral-lo)]" : "text-[var(--dawn-ink-3)]"
            )}
          />
        </span>
      </button>

      <motion.div
        id={answerId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isOpen}
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="overflow-hidden"
      >
        <p className="max-w-[65ch] px-5 pb-5 pl-6 text-[14px] leading-[1.6] text-[var(--dawn-ink-2)] md:text-[15px]">
          {highlightText(answer)}
        </p>
      </motion.div>
    </div>
  )
}
