import type { Metadata } from 'next'
import Link from 'next/link'
import { Nav } from '@/components/landing/nav'
import { PublicFooter } from '@/components/public-footer'
import { LegalHeader } from '@/components/legal/legal-header'

export const metadata: Metadata = {
  title: 'Terms of Service | JobSilver',
  description: 'Terms of Service for JobSilver, a job search and application preparation service',
}

// Long-form legal typography, tuned to the Dawn system. The Tailwind
// `@tailwindcss/typography` plugin is NOT installed in this repo, so the old
// `prose prose-invert` classes were inert; this descendant-variant recipe gives
// the same editorial look with full Dawn-token control. Colours/sizes for the
// flowing prose live here; the callout boxes and tables set their own colours
// via inline `style` so they always win the cascade over these descendant rules.
const CONTENT =
  'mt-12 text-[clamp(15px,1.05vw,17px)] leading-[1.75] text-[var(--dawn-ink-2)] [text-wrap:pretty] ' +
  // HARD RULE: clamp()-sized display headings MUST carry an explicit line-height,
  // or two-line headings overlap. h2 -> leading-[1.1]; text-wrap:balance evens the
  // last line so multi-word section titles do not orphan a single word.
  '[&_h2]:mt-16 [&_h2]:mb-5 [&_h2]:pb-3 [&_h2]:border-b [&_h2]:border-[var(--dawn-line)] [&_h2]:text-[clamp(22px,2.4vw,30px)] [&_h2]:font-semibold [&_h2]:leading-[1.1] [&_h2]:tracking-[-0.015em] [&_h2]:[text-wrap:balance] [&_h2]:scroll-mt-28 [&_h2]:text-[var(--dawn-ink)] ' +
  // Rhythm: the very first section heading sits right under the metadata line,
  // so drop its top margin (the container already carries mt-12) to avoid a
  // doubled gap. Child-combinator selector outranks the [&_h2] descendant rule.
  '[&>section:first-child>h2]:mt-0 ' +
  '[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:leading-[1.3] [&_h3]:tracking-[-0.01em] [&_h3]:[text-wrap:balance] [&_h3]:scroll-mt-28 [&_h3]:text-[var(--dawn-ink)] ' +
  '[&_p]:my-4 ' +
  '[&_ul]:my-5 [&_ul]:space-y-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-[var(--dawn-ink-3)] ' +
  '[&_li]:pl-1.5 [&_li]:leading-[1.7] ' +
  '[&_strong]:font-semibold [&_strong]:text-[var(--dawn-ink)] ' +
  '[&_a]:font-medium [&_a]:text-[var(--coral-lo)] [&_a]:underline [&_a]:decoration-[var(--dawn-line-2)] [&_a]:underline-offset-[3px] [&_a]:transition-colors [&_a:hover]:text-[var(--coral)] [&_a:hover]:decoration-[var(--coral)] [&_a]:rounded-[3px] [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-[var(--coral)] [&_a]:focus-visible:ring-offset-2 [&_a]:focus-visible:ring-offset-[var(--dawn-bg)]'

export default function TermsOfServicePage() {
  const lastUpdated = 'February 5, 2026'
  const effectiveDate = 'February 5, 2026'

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--dawn-bg)', color: 'var(--dawn-ink)' }}
    >
      <Nav />

      <main className="pt-20">
        <div
          className="mx-auto px-[var(--dawn-gutter)]"
          style={{ maxWidth: 'var(--dawn-content)' }}
        >
          <article className="mx-auto max-w-[75ch] py-[clamp(48px,7vw,96px)]">
            <LegalHeader
              eyebrow="Legal"
              title="Terms of Service"
              lastUpdated={lastUpdated}
              effectiveDate={effectiveDate}
            />

            <div className={CONTENT}>
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
                  <li><strong>Job Discovery:</strong> Aggregated job listings from fantastic.jobs API and direct ATS integrations (Greenhouse, Lever, Ashby)</li>
                  <li><strong>Job Tracking:</strong> A visual kanban board to organize and track job applications</li>
                  <li><strong>AI Assistant:</strong> Draft application answers and cover letters, and prepare for interviews</li>
                  <li><strong>CV Management:</strong> Upload, parse, and generate tailored CVs/resumes</li>
                  <li><strong>Personalized Recommendations:</strong> AI-learned preferences based on your interactions (optional)</li>
                </ul>

                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] border-l-2 border-l-[var(--coral)] p-5 pl-6"
                  style={{ background: 'var(--coral-soft)' }}
                >
                  <p className="font-semibold" style={{ color: 'var(--coral-lo)', marginTop: 0 }}>
                    Important: Manual Application Process
                  </p>
                  <p className="text-[14px]" style={{ color: 'var(--dawn-ink-2)', marginBottom: 0 }}>
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

                <h3>7.4 Data Retention and Automatic Cleanup</h3>
                <p>
                  To maintain platform performance and keep your job board relevant, we automatically
                  remove job listings that are older than 60 days from their discovery date. This helps
                  ensure you see fresh, active opportunities.
                </p>
                <p>
                  <strong>Important:</strong> Jobs you have favorited are <strong>never</strong> automatically
                  deleted and will remain in your account indefinitely. We recommend favoriting any jobs
                  you want to keep for long-term reference.
                </p>
                <p>
                  Your CV, profile information, preferences, and chat history are retained until you
                  choose to delete your account.
                </p>
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
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-6 text-[14px] leading-[1.65] tracking-[0.015em]"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <p className="font-semibold uppercase tracking-[0.03em]" style={{ color: 'var(--dawn-ink)', marginTop: 0 }}>
                    THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
                    EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                  </p>
                  <p style={{ color: 'var(--dawn-ink-2)' }}>WE DO NOT WARRANT THAT:</p>
                  <ul className="mt-2 space-y-1.5" style={{ color: 'var(--dawn-ink-2)' }}>
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
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-6 text-[14px] leading-[1.65] tracking-[0.015em]"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <p style={{ color: 'var(--dawn-ink-2)', marginTop: 0 }}>
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, JOB SILVER AND ITS OFFICERS, DIRECTORS,
                    EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                    CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
                    DATA, OR EMPLOYMENT OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.
                  </p>
                  <p style={{ color: 'var(--dawn-ink-2)', marginBottom: 0 }}>
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
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-5"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <p style={{ color: 'var(--dawn-ink)', margin: 0 }}>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:jobsilver50@gmail.com">jobsilver50@gmail.com</a>
                  </p>
                </div>
              </section>
            </div>
          </article>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
