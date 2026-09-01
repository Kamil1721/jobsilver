import type { Metadata } from 'next'
import { Nav } from '@/components/landing/nav'
import { PublicFooter } from '@/components/public-footer'
import { ContactContent } from './contact-content'

export const metadata: Metadata = {
  title: 'Contact Us | Job Silver',
  description: 'Get in touch with the Job Silver team for support, feedback, or inquiries',
}

export default function ContactPage() {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--dawn-bg)', color: 'var(--dawn-ink)' }}
    >
      <Nav />
      <main className="pt-16">
        <ContactContent />
      </main>
      <PublicFooter />
    </div>
  )
}
