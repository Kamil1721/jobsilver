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
      "When you reach your daily AI job match or auto-application limit, you can still browse and manually apply to jobs. Your limits reset at midnight UTC. Upgrade to a higher plan for increased limits.",
  },
  {
    question: "Can I change my plan at any time?",
    answer:
      "Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll have immediate access to new features. When downgrading, your current plan benefits remain until the end of your billing period.",
  },
  {
    question: "How does yearly billing work?",
    answer:
      "Yearly billing gives you 2 months free compared to monthly billing. You'll be charged once per year, and you can cancel anytime. If you cancel, you'll retain access until the end of your billing period.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express, Discover) through our secure payment processor, Stripe. All transactions are encrypted and PCI-compliant.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "The Free plan lets you explore core features without any commitment. When you upgrade to a paid plan, you can start using premium features immediately. We offer a 14-day money-back guarantee if you're not satisfied.",
  },
  {
    question: "How do auto-applications work?",
    answer:
      "Auto-applications use your profile information and saved answers to automatically fill out job applications on supported platforms. You review and approve applications before they're submitted, maintaining full control over your job search.",
  },
  {
    question: "What's included in Priority Support?",
    answer:
      "Priority Support includes faster response times (within 4 hours during business hours), direct access to our support team via chat, and priority bug fixes. Ultra plan members get dedicated support with a named account manager.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Yes, we offer a 14-day money-back guarantee for all paid plans. If you're not satisfied within the first 14 days, contact us for a full refund. After 14 days, you can cancel anytime but refunds are not provided for the remaining period.",
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
