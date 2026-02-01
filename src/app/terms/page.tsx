import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Terms of Service | Job Silver',
  description: 'Terms of Service for Job Silver - AI-powered job search management platform',
}

export default function TermsOfServicePage() {
  const lastUpdated = 'January 30, 2026'
  const effectiveDate = 'January 30, 2026'

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
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-zinc-500">
              Last Updated: {lastUpdated} | Effective Date: {effectiveDate}
            </p>
          </div>

          {/* Content */}
          <div className="prose prose-invert prose-zinc max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-zinc-800
            prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-4
            prose-p:text-zinc-400 prose-p:leading-relaxed
            prose-li:text-zinc-400
            prose-strong:text-white prose-strong:font-medium
            prose-a:text-teal-400 prose-a:no-underline hover:prose-a:text-teal-300
          ">
            {/* Introduction */}
            <section>
              <h2>1. Introduction and Acceptance</h2>
              <p>
                Welcome to Job Silver (&quot;Service,&quot; &quot;Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Job Silver
                website, applications, and services.
              </p>
              <p>
                By creating an account, accessing, or using our Service, you agree to be bound by these
                Terms and our <Link href="/privacy">Privacy Policy</Link>.
                If you do not agree to these Terms, you may not use our Service.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of material
                changes by posting the updated Terms on our website and updating the &quot;Last Updated&quot; date.
                Your continued use of the Service after such changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Eligibility */}
            <section>
              <h2>2. Eligibility</h2>
              <p>To use Job Silver, you must:</p>
              <ul>
                <li>Be at least 18 years of age or the age of majority in your jurisdiction</li>
                <li>Have the legal capacity to enter into a binding agreement</li>
                <li>Not be prohibited from using the Service under applicable laws</li>
                <li>Provide accurate and complete registration information</li>
              </ul>
              <p>
                By using the Service, you represent and warrant that you meet all eligibility requirements.
              </p>
            </section>

            {/* Account Registration */}
            <section>
              <h2>3. Account Registration and Security</h2>
              <p>To access certain features, you must create an account. You agree to:</p>
              <ul>
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Keep your password secure and confidential</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that contain inaccurate information
                or violate these Terms.
              </p>
            </section>

            {/* Service Description */}
            <section>
              <h2>4. Service Description</h2>
              <p>Job Silver is a job search management platform that provides:</p>
              <ul>
                <li><strong>Job Discovery:</strong> Aggregated job listings from multiple sources including Adzuna, Remotive, TheMuse, and Arbeitnow</li>
                <li><strong>Job Tracking:</strong> A visual kanban board to organize and track job applications</li>
                <li><strong>AI Assistant:</strong> AI-powered features to help craft application answers, generate cover letters, and analyze job fit</li>
                <li><strong>CV Management:</strong> Upload, parse, and generate optimized CVs/resumes</li>
                <li><strong>Personalized Recommendations:</strong> AI-learned preferences based on your interactions (optional)</li>
              </ul>

              <div className="my-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-amber-400 font-medium mb-2">Important: Manual Application Process</p>
                <p className="text-amber-400/80 text-sm">
                  Job Silver is a job search <strong>management</strong> tool. We do <strong>NOT</strong> automatically
                  apply to jobs on your behalf. When you click &quot;Apply,&quot; you will be redirected to the
                  employer&apos;s external job posting where you must complete the application yourself.
                  You are solely responsible for all applications you submit.
                </p>
              </div>
            </section>

            {/* AI Features */}
            <section>
              <h2>5. AI-Powered Features</h2>
              <p>Our Service uses artificial intelligence (AI) to provide certain features. By using these features, you acknowledge and agree that:</p>
              <ul>
                <li>
                  <strong>AI Limitations:</strong> AI-generated content (cover letters, application answers, CV suggestions)
                  is provided as a starting point and may contain errors, inaccuracies, or inappropriate content.
                  You are responsible for reviewing and editing all AI-generated content before use.
                </li>
                <li>
                  <strong>No Guarantee:</strong> We do not guarantee that AI suggestions will result in job offers,
                  interviews, or any particular outcome.
                </li>
                <li>
                  <strong>Data Processing:</strong> To provide AI features, certain data (including your profile information,
                  CV content, and job details) is processed by third-party AI providers. See our{' '}
                  <Link href="/privacy">Privacy Policy</Link> for details.
                </li>
                <li>
                  <strong>Human Review:</strong> You must review all AI-generated content for accuracy, appropriateness,
                  and compliance with the specific job requirements before submission.
                </li>
              </ul>
            </section>

            {/* Subscriptions */}
            <section>
              <h2>6. Subscriptions and Payments</h2>

              <h3>6.1 Subscription Plans</h3>
              <p>
                Job Silver offers both free and paid subscription plans. Paid plans provide additional features
                and higher usage limits. Current plans and pricing are available on our{' '}
                <Link href="/pricing">Pricing page</Link>.
              </p>

              <h3>6.2 Billing</h3>
              <ul>
                <li>Paid subscriptions are billed in advance on a weekly or monthly basis, depending on your selected plan</li>
                <li>All payments are processed securely through Stripe. We do not store your full payment card details</li>
                <li>Prices are listed in USD and may be subject to applicable taxes</li>
                <li>You authorize us to charge your payment method for recurring subscription fees</li>
              </ul>

              <h3>6.3 Cancellation and Refunds</h3>
              <ul>
                <li>You may cancel your subscription at any time through your account settings or Stripe Customer Portal</li>
                <li>Upon cancellation, you will retain access to paid features until the end of your current billing period</li>
                <li>We generally do not provide refunds for partial subscription periods. However, refund requests may be considered on a case-by-case basis for exceptional circumstances</li>
                <li>Free trial periods, if offered, will convert to paid subscriptions unless cancelled before the trial ends</li>
              </ul>

              <h3>6.4 Price Changes</h3>
              <p>
                We reserve the right to modify subscription prices. We will provide at least 30 days&apos; notice
                before any price increase takes effect. Price changes will apply to the next billing cycle
                following the notice period.
              </p>
            </section>

            {/* User Content */}
            <section>
              <h2>7. User Content and Data</h2>

              <h3>7.1 Your Content</h3>
              <p>
                You retain ownership of all content you upload to the Service, including your CV/resume,
                profile information, and any text you provide (&quot;User Content&quot;). By uploading User Content,
                you grant us a limited, non-exclusive license to use, process, and store this content
                solely for the purpose of providing the Service to you.
              </p>

              <h3>7.2 Content Accuracy</h3>
              <p>You represent and warrant that:</p>
              <ul>
                <li>All information you provide is accurate, truthful, and not misleading</li>
                <li>You have the right to share any content you upload</li>
                <li>Your content does not infringe any third-party rights</li>
                <li>Your CV and profile information accurately represent your qualifications and experience</li>
              </ul>

              <h3>7.3 Prohibited Content</h3>
              <p>You may not upload content that:</p>
              <ul>
                <li>Is false, fraudulent, or intentionally misleading</li>
                <li>Infringes intellectual property rights of others</li>
                <li>Contains malware, viruses, or harmful code</li>
                <li>Violates any applicable law or regulation</li>
                <li>Contains sensitive personal information of others without consent</li>
              </ul>
            </section>

            {/* Acceptable Use */}
            <section>
              <h2>8. Acceptable Use Policy</h2>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
                <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
                <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Circumvent any usage limits or security features</li>
                <li>Share your account credentials with others or allow others to access your account</li>
                <li>Use the Service to spam employers or submit fraudulent applications</li>
                <li>Impersonate any person or entity</li>
                <li>Resell or redistribute the Service without authorization</li>
                <li>Use AI features to generate content for purposes other than your own job search</li>
              </ul>
            </section>

            {/* Third-Party Services */}
            <section>
              <h2>9. Third-Party Services and Job Listings</h2>

              <h3>9.1 Job Listings</h3>
              <p>Job listings displayed on Job Silver are aggregated from third-party sources. We do not:</p>
              <ul>
                <li>Guarantee the accuracy, completeness, or availability of any job listing</li>
                <li>Endorse any employer or job opportunity</li>
                <li>Have control over employer hiring decisions</li>
                <li>Verify the legitimacy of all job postings</li>
              </ul>
              <p>
                You are responsible for verifying the legitimacy of any job opportunity before applying
                or sharing personal information with potential employers.
              </p>

              <h3>9.2 External Links</h3>
              <p>
                The Service contains links to third-party websites and services. We are not responsible
                for the content, privacy practices, or terms of any third-party sites. Your use of
                third-party services is at your own risk.
              </p>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2>10. Intellectual Property</h2>
              <p>
                The Service, including its design, features, and content (excluding User Content),
                is owned by Job Silver and protected by copyright, trademark, and other intellectual
                property laws. You may not:
              </p>
              <ul>
                <li>Copy, modify, or distribute the Service or its content</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Remove any copyright or proprietary notices</li>
                <li>Use our trademarks without written permission</li>
              </ul>
            </section>

            {/* Disclaimers */}
            <section>
              <h2>11. Disclaimers</h2>
              <div className="p-4 bg-zinc-800/50 rounded-lg text-sm">
                <p className="uppercase font-medium text-zinc-300 mb-4">
                  THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                  EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p className="text-zinc-400 mb-2">WE DO NOT WARRANT THAT:</p>
                <ul className="text-zinc-400 space-y-1">
                  <li>THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE</li>
                  <li>RESULTS OBTAINED FROM THE SERVICE WILL BE ACCURATE OR RELIABLE</li>
                  <li>ANY ERRORS WILL BE CORRECTED</li>
                  <li>YOU WILL OBTAIN EMPLOYMENT THROUGH USE OF THE SERVICE</li>
                  <li>AI-GENERATED CONTENT WILL BE ACCURATE, APPROPRIATE, OR EFFECTIVE</li>
                </ul>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2>12. Limitation of Liability</h2>
              <div className="p-4 bg-zinc-800/50 rounded-lg text-sm text-zinc-400">
                <p className="mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, JOB SILVER AND ITS OFFICERS, DIRECTORS,
                  EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
                  DATA, OR EMPLOYMENT OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.
                </p>
                <p>
                  OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE
                  SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING
                  THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
                </p>
              </div>
            </section>

            {/* Indemnification */}
            <section>
              <h2>13. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless Job Silver and its officers, directors,
                employees, and agents from any claims, damages, losses, or expenses (including reasonable
                attorney&apos;s fees) arising from:
              </p>
              <ul>
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your User Content</li>
                <li>Your violation of any third-party rights</li>
                <li>Any application you submit to employers</li>
              </ul>
            </section>

            {/* Termination */}
            <section>
              <h2>14. Termination</h2>

              <h3>14.1 Termination by You</h3>
              <p>
                You may terminate your account at any time by using the account deletion feature in your
                profile settings. Upon deletion, your data will be permanently removed in accordance with
                our <Link href="/privacy">Privacy Policy</Link>.
              </p>

              <h3>14.2 Termination by Us</h3>
              <p>
                We may suspend or terminate your account at any time, with or without cause, including if we
                reasonably believe you have violated these Terms. We will attempt to provide notice when
                practicable, but are not obligated to do so.
              </p>

              <h3>14.3 Effect of Termination</h3>
              <p>
                Upon termination, your right to use the Service will immediately cease. Sections of these
                Terms that by their nature should survive termination will remain in effect.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2>15. Governing Law and Disputes</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
                in which Job Silver is registered, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from these Terms or the Service shall first be attempted to be resolved
                through good-faith negotiation. If negotiation fails, disputes shall be resolved through
                binding arbitration or in the courts of competent jurisdiction.
              </p>
            </section>

            {/* General */}
            <section>
              <h2>16. General Provisions</h2>
              <ul>
                <li>
                  <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy,
                  constitute the entire agreement between you and Job Silver.
                </li>
                <li>
                  <strong>Severability:</strong> If any provision of these Terms is found unenforceable,
                  the remaining provisions will continue in effect.
                </li>
                <li>
                  <strong>Waiver:</strong> Our failure to enforce any right or provision shall not
                  constitute a waiver of such right or provision.
                </li>
                <li>
                  <strong>Assignment:</strong> You may not assign these Terms without our consent.
                  We may assign these Terms without restriction.
                </li>
                <li>
                  <strong>Notices:</strong> We may provide notices via email, in-app notifications,
                  or posting on our website.
                </li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2>17. Contact Us</h2>
              <p>If you have any questions about these Terms, please contact us at:</p>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-white"><strong>Email:</strong> jobsilver50@gmail.com</p>
              </div>
            </section>
          </div>

        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
