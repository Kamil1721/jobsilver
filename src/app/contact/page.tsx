import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Mail, MessageSquare, Clock } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Contact Us | Job Silver',
  description: 'Get in touch with the Job Silver team for support, feedback, or inquiries',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="absolute inset-0 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/[0.04]" />
        <div className="relative max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center group">
            <Image
              src="/logo-dark.svg"
              alt="Job Silver"
              width={140}
              height={28}
              className="h-7 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Contact Us
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Have a question, feedback, or need help? We&apos;d love to hear from you.
            </p>
          </div>

          {/* Contact Card */}
          <div className="max-w-xl mx-auto">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              {/* Email */}
              <div className="flex items-start gap-4 mb-8">
                <div className="p-3 bg-teal-900/30 rounded-xl">
                  <Mail className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Email Us</h3>
                  <p className="text-zinc-400 text-sm mb-3">
                    For support, feedback, or general inquiries
                  </p>
                  <a
                    href="mailto:jobsilver50@gmail.com"
                    className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 font-medium transition-colors"
                  >
                    jobsilver50@gmail.com
                  </a>
                </div>
              </div>

              {/* Response Time */}
              <div className="flex items-start gap-4 mb-8">
                <div className="p-3 bg-zinc-800 rounded-xl">
                  <Clock className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Response Time</h3>
                  <p className="text-zinc-400 text-sm">
                    We typically respond within 24-48 hours during business days.
                  </p>
                </div>
              </div>

              {/* What to Include */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-zinc-800 rounded-xl">
                  <MessageSquare className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">When Contacting Us</h3>
                  <p className="text-zinc-400 text-sm mb-3">
                    To help us assist you faster, please include:
                  </p>
                  <ul className="text-zinc-400 text-sm space-y-1">
                    <li>• Your account email (if applicable)</li>
                    <li>• A clear description of your question or issue</li>
                    <li>• Screenshots if reporting a bug</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-8 text-center">
              <p className="text-zinc-500 text-sm">
                Before reaching out, you might find answers in our{' '}
                <Link href="/terms" className="text-teal-400 hover:text-teal-300">
                  Terms of Service
                </Link>{' '}
                or{' '}
                <Link href="/privacy" className="text-teal-400 hover:text-teal-300">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
