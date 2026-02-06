"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "What happens when I reach my daily limit?",
    answer:
      "When you reach your daily job discovery or AI usage limit, you can still browse and track your existing jobs. Your limits reset at midnight UTC. Free users can upgrade to Pro for more jobs and AI access, or Ultra for unlimited AI.",
  },
  {
    question: "Can I change my plan at any time?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll have immediate access to new features. When downgrading, your current plan benefits remain until the end of your billing period.",
  },
  {
    question: "What's the difference between weekly and monthly billing?",
    answer:
      "Monthly billing saves you about 25% compared to paying weekly. For example, Pro is $3.99/week or $12.99/month (vs $15.96 if paid weekly). You can switch billing cycles when your current period ends.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe. All transactions are encrypted and PCI-compliant.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "The Pro plan includes a 3-day free trial. Start instantly with full Pro features, and you won't be charged if you cancel within 3 days. Note: Ultra has no trial and charges immediately upon subscription.",
  },
  {
    question: "What's included in each plan?",
    answer:
      "Free: 3 jobs/day, Kanban tracking, basic match scores. Pro ($3.99/wk or $12.99/mo): 15 jobs/day, 30 AI responses, 5 cover letters, 3 CVs per day, daily alerts. Ultra ($6.99/wk or $19.99/mo): 35 jobs/day, unlimited AI, daily alerts, priority support.",
  },
  {
    question: "What's included in Priority Support?",
    answer:
      "Priority Support (Ultra plan only) includes faster response times during business hours and prioritized bug fixes. Contact our support team at jobsilver50@gmail.com.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can cancel your subscription anytime from your dashboard settings. You'll retain access to your current plan's features until the end of your billing period. No questions asked.",
  },
]

function FAQItemComponent({ item, index }: { item: FAQItem; index: number }) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "border-b border-border/50 last:border-b-0",
        "group"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start justify-between py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-base font-medium pr-4 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-200">
          {item.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 mt-0.5"
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors duration-200" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-muted-foreground text-sm leading-relaxed pr-8">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function PricingFAQ() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-500/20 bg-zinc-500/5 mb-6">
            <HelpCircle className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
              Frequently Asked Questions
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Got questions? We have answers
          </h2>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about our pricing and features
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/50 bg-card/30 p-6 md:p-8"
        >
          {FAQ_ITEMS.map((item, index) => (
            <FAQItemComponent key={index} item={item} index={index} />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Still have questions?{" "}
          <a
            href="mailto:jobsilver50@gmail.com"
            className="text-zinc-600 dark:text-zinc-400 hover:underline font-medium"
          >
            Contact our support team
          </a>
        </motion.p>
      </div>
    </section>
  )
}
