import type { Metadata } from 'next'
import { Nav } from '@/components/landing/nav'
import { PublicFooter } from '@/components/public-footer'
import { LegalHeader } from '@/components/legal/legal-header'

export const metadata: Metadata = {
  title: 'Privacy Policy | Job Silver',
  description: 'Privacy Policy for Job Silver - Learn how we collect, use, and protect your personal data',
}

// Long-form legal typography, tuned to the Dawn system. The
// `@tailwindcss/typography` plugin is NOT installed in this repo, so the old
// `prose prose-invert` classes were inert; this descendant-variant recipe gives
// the same editorial look with full Dawn-token control. Colours/sizes for the
// flowing prose live here; the callout boxes and the provider table set their
// own colours via inline `style` so they always win the cascade over these
// descendant rules.
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
  // h4 as a quiet uppercase micro-label so nested groups (e.g. "Account Information")
  // read as a distinct tier below h3 without borrowing the coral eyebrow.
  '[&_h4]:mt-8 [&_h4]:mb-3 [&_h4]:text-[13px] [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.07em] [&_h4]:leading-[1.4] [&_h4]:text-[var(--dawn-ink-2)] ' +
  '[&_p]:my-4 ' +
  '[&_ul]:my-5 [&_ul]:space-y-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-[var(--dawn-ink-3)] ' +
  '[&_li]:pl-1.5 [&_li]:leading-[1.7] ' +
  '[&_strong]:font-semibold [&_strong]:text-[var(--dawn-ink)] ' +
  '[&_a]:font-medium [&_a]:text-[var(--coral-lo)] [&_a]:underline [&_a]:decoration-[var(--dawn-line-2)] [&_a]:underline-offset-[3px] [&_a]:transition-colors [&_a:hover]:text-[var(--coral)] [&_a:hover]:decoration-[var(--coral)] [&_a]:rounded-[3px] [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-[var(--coral)] [&_a]:focus-visible:ring-offset-2 [&_a]:focus-visible:ring-offset-[var(--dawn-bg)]'

// Dawn-styled table cells. Explicit inline styles so nothing leaks from / into
// the CONTENT descendant variants.
const TH_STYLE = {
  background: 'var(--dawn-cream)',
  color: 'var(--dawn-ink)',
  borderColor: 'var(--dawn-line-2)',
} as const

export default function PrivacyPolicyPage() {
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
              title="Privacy Policy"
              lastUpdated={lastUpdated}
              effectiveDate={effectiveDate}
            />

            <div className={CONTENT}>
              {/* Introduction */}
              <section>
                <h2>1. Introduction</h2>
                <p>
                  Job Silver (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy.
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your personal
                  information when you use our job search management platform (&quot;Service&quot;).
                </p>
                <p>
                  By using Job Silver, you consent to the data practices described in this policy.
                  If you do not agree with our practices, please do not use our Service.
                </p>
              </section>

              {/* Information We Collect */}
              <section>
                <h2>2. Information We Collect</h2>

                <h3>2.1 Information You Provide Directly</h3>

                <h4>Account Information</h4>
                <ul>
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Password (stored securely hashed)</li>
                  <li>Phone number (optional)</li>
                  <li>Location/city (optional)</li>
                </ul>

                <h4>Profile and Professional Information</h4>
                <ul>
                  <li>Current job title and experience summary</li>
                  <li>Work history and employment dates</li>
                  <li>Education history</li>
                  <li>Skills and qualifications</li>
                  <li>LinkedIn profile URL (optional)</li>
                  <li>Professional certifications</li>
                </ul>

                <h4>Job Search Preferences</h4>
                <ul>
                  <li>Desired job titles and industries</li>
                  <li>Preferred work arrangement (remote, hybrid, on-site)</li>
                  <li>Salary expectations (current and expected)</li>
                  <li>Work authorization status and visa sponsorship needs</li>
                  <li>Availability and start date preferences</li>
                  <li>Willingness to travel or relocate</li>
                  <li>Languages spoken</li>
                </ul>

                <h4>CV/Resume Data</h4>
                <ul>
                  <li>Uploaded CV/resume files (PDF, DOCX, TXT)</li>
                  <li>Extracted text content from your CV</li>
                  <li>Parsed structured data (skills, experience, education)</li>
                </ul>

                <h4>Optional Demographic Information</h4>
                <p>You may optionally provide the following information, which some employers request:</p>
                <ul>
                  <li>Date of birth (to verify age eligibility)</li>
                  <li>Gender</li>
                  <li>Nationality</li>
                  <li>Disability status</li>
                  <li>Veteran/military service status</li>
                  <li>Ethnicity</li>
                </ul>
                <p className="text-[14px]" style={{ color: 'var(--dawn-ink-2)' }}>
                  This information is entirely optional and is only used to help pre-fill application
                  forms when employers request it. We do not use this data for any other purpose.
                </p>

                <h3>2.2 Information Collected Automatically</h3>

                <h4>Usage Data</h4>
                <ul>
                  <li>Jobs you view, save, favorite, or discard</li>
                  <li>Applications you track through our platform</li>
                  <li>AI assistant conversations and queries</li>
                  <li>Feature usage patterns</li>
                  <li>Daily AI usage counts (for quota enforcement)</li>
                </ul>

                <h4>Technical Data</h4>
                <ul>
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Operating system</li>
                  <li>Access times and dates</li>
                </ul>

                <h3>2.3 Information from Third Parties</h3>
                <p>If you sign in using Google OAuth, we receive:</p>
                <ul>
                  <li>Your Google email address</li>
                  <li>Your name as set in your Google account</li>
                  <li>Your Google profile picture (if available)</li>
                </ul>
              </section>

              {/* How We Use Your Information */}
              <section>
                <h2>3. How We Use Your Information</h2>
                <p>We use your personal information for the following purposes:</p>

                <h3>3.1 Providing the Service</h3>
                <ul>
                  <li>Create and manage your account</li>
                  <li>Display personalized job recommendations based on your preferences</li>
                  <li>Track your job applications and their status</li>
                  <li>Parse and analyze your CV to extract relevant information</li>
                  <li>Generate AI-powered cover letters and application content</li>
                  <li>Provide AI assistant responses to your queries</li>
                </ul>

                <h3>3.2 Personalization and Improvement</h3>
                <ul>
                  <li>Learn your job preferences based on your interactions (if enabled)</li>
                  <li>Improve job matching algorithms</li>
                  <li>Enhance our AI features and recommendations</li>
                  <li>Analyze usage patterns to improve the Service</li>
                </ul>

                <h3>3.3 Communication</h3>
                <ul>
                  <li>Send email notifications about new job matches (if enabled)</li>
                  <li>Notify you about AI usage quota warnings (if enabled)</li>
                  <li>Send important service announcements and updates</li>
                  <li>Respond to your support inquiries</li>
                </ul>

                <h3>3.4 Billing and Payments</h3>
                <ul>
                  <li>Process subscription payments through Stripe</li>
                  <li>Manage your subscription status</li>
                  <li>Send billing-related communications</li>
                </ul>

                <h3>3.5 Security and Compliance</h3>
                <ul>
                  <li>Detect and prevent fraud or abuse</li>
                  <li>Enforce our Terms of Service</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              {/* Data Sharing */}
              <section>
                <h2>4. How We Share Your Information</h2>
                <p>We do not sell your personal information. We share data only as described below:</p>

                <h3>4.1 Third-Party Service Providers</h3>
                <p>We use the following third-party services to operate Job Silver:</p>

                <div
                  role="region"
                  aria-label="Third-party service providers"
                  tabIndex={0}
                  className="my-8 overflow-x-auto rounded-[16px] border border-[var(--dawn-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                >
                  <table className="w-full border-collapse text-[14px]">
                    <thead>
                      <tr>
                        <th className="border-b px-4 py-3 text-left font-semibold" style={TH_STYLE}>Provider</th>
                        <th className="border-b px-4 py-3 text-left font-semibold" style={TH_STYLE}>Purpose</th>
                        <th className="border-b px-4 py-3 text-left font-semibold" style={TH_STYLE}>Data Shared</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-b px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)', borderColor: 'var(--dawn-line)' }}>Supabase</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Database, Authentication, File Storage</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>All user data, CVs, profile information</td>
                      </tr>
                      <tr>
                        <td className="border-b px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)', borderColor: 'var(--dawn-line)' }}>OpenAI</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>AI Features (chat, CV parsing, cover letters)</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Profile data, CV content, job details, chat messages</td>
                      </tr>
                      <tr>
                        <td className="border-b px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)', borderColor: 'var(--dawn-line)' }}>Stripe</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Payment Processing</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Email, subscription details (Stripe handles payment card data)</td>
                      </tr>
                      <tr>
                        <td className="border-b px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)', borderColor: 'var(--dawn-line)' }}>Resend</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Email Delivery</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Email address, notification content</td>
                      </tr>
                      <tr>
                        <td className="border-b px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)', borderColor: 'var(--dawn-line)' }}>Vercel</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Hosting and Infrastructure</td>
                        <td className="border-b px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)', borderColor: 'var(--dawn-line)' }}>Server logs, IP addresses</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 align-top font-semibold" style={{ color: 'var(--dawn-ink)' }}>Google</td>
                        <td className="px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)' }}>OAuth Authentication</td>
                        <td className="px-4 py-3 align-top" style={{ color: 'var(--dawn-ink-2)' }}>Authentication tokens (Google provides your email/name to us)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3>4.2 Job Listing Providers</h3>
                <p>We aggregate job listings from the following sources:</p>
                <ul>
                  <li>fantastic.jobs (via RapidAPI)</li>
                  <li>Greenhouse (direct ATS integration)</li>
                  <li>Lever (direct ATS integration)</li>
                  <li>Ashby (direct ATS integration)</li>
                </ul>
                <p>
                  <strong>We do not share your personal information with these job listing providers.</strong> We
                  only send search queries (job titles, locations) to retrieve relevant listings. Your profile
                  data is never transmitted to these services.
                </p>

                <h3>4.3 AI Processing Disclosure</h3>
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-6"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <p className="font-semibold" style={{ color: 'var(--coral-lo)', marginTop: 0 }}>
                    Important: AI Data Processing
                  </p>
                  <p className="text-[14px]" style={{ color: 'var(--dawn-ink-2)' }}>
                    To provide AI-powered features, the following data may be sent to OpenAI&apos;s servers for processing:
                  </p>
                  <ul className="text-[14px]" style={{ color: 'var(--dawn-ink-2)' }}>
                    <li>Your profile information (name, job title, experience, skills)</li>
                    <li>CV/resume content</li>
                    <li>Job descriptions you&apos;re viewing</li>
                    <li>Your chat messages and questions</li>
                    <li>Images you upload for analysis (e.g., application screenshots)</li>
                    <li>Your job preferences and salary expectations</li>
                  </ul>
                  <p className="text-[14px]" style={{ color: 'var(--dawn-ink-2)', marginBottom: 0 }}>
                    OpenAI processes this data according to their Privacy Policy. We use the API tier which does not use your data to train OpenAI&apos;s models.
                  </p>
                </div>

                <h3>4.4 Legal Requirements</h3>
                <p>
                  We may disclose your information if required by law, court order, or government request,
                  or if we believe disclosure is necessary to:
                </p>
                <ul>
                  <li>Comply with legal obligations</li>
                  <li>Protect our rights or property</li>
                  <li>Prevent fraud or security threats</li>
                  <li>Protect the safety of users or the public</li>
                </ul>

                <h3>4.5 Business Transfers</h3>
                <p>
                  If Job Silver is involved in a merger, acquisition, or sale of assets, your information
                  may be transferred as part of that transaction. We will notify you of any such change
                  and any choices you may have.
                </p>
              </section>

              {/* Data Storage and Security */}
              <section>
                <h2>5. Data Storage and Security</h2>

                <h3>5.1 Where Your Data is Stored</h3>
                <p>Your data is stored on servers operated by our service providers:</p>
                <ul>
                  <li><strong>Supabase:</strong> Database and file storage (region depends on project configuration)</li>
                  <li><strong>Vercel:</strong> Application hosting (global edge network)</li>
                  <li><strong>Stripe:</strong> Payment data (US-based with global processing)</li>
                </ul>
                <p>
                  If you are located outside of these regions, your data may be transferred internationally.
                  By using our Service, you consent to such transfers.
                </p>

                <h3>5.2 Security Measures</h3>
                <p>We implement appropriate technical and organizational measures to protect your data:</p>
                <ul>
                  <li>All data transmitted via HTTPS/TLS encryption</li>
                  <li>Passwords are hashed using industry-standard algorithms</li>
                  <li>Row Level Security (RLS) ensures users can only access their own data</li>
                  <li>API rate limiting to prevent abuse</li>
                  <li>Regular security updates and monitoring</li>
                  <li>CV files stored in private buckets with signed URL access</li>
                </ul>
                <p>
                  However, no method of transmission over the Internet is 100% secure. While we strive
                  to protect your personal information, we cannot guarantee absolute security.
                </p>
              </section>

              {/* Data Retention */}
              <section>
                <h2>6. Data Retention</h2>
                <p>
                  We retain your personal information for as long as necessary to provide the Service
                  and fulfill the purposes described in this policy:
                </p>
                <ul>
                  <li>
                    <strong>Active Accounts:</strong> Data is retained while your account remains active.
                  </li>
                  <li>
                    <strong>Job Listings:</strong> To keep your board relevant, job listings older than 60 days
                    are automatically removed. Favorited jobs are exempt and remain until you delete them.
                  </li>
                  <li>
                    <strong>Deleted Accounts:</strong> When you delete your account, we permanently delete
                    your data within 30 days, except where retention is required by law.
                  </li>
                  <li>
                    <strong>Billing Records:</strong> We retain transaction records as required for tax
                    and legal compliance (typically 7 years).
                  </li>
                  <li>
                    <strong>Anonymized Data:</strong> We may retain anonymized, aggregated data that
                    cannot identify you for analytics and improvement purposes.
                  </li>
                </ul>
              </section>

              {/* Your Rights */}
              <section>
                <h2>7. Your Rights and Choices</h2>
                <p>
                  Depending on your location, you may have the following rights regarding your personal data:
                </p>

                <h3>7.1 Access and Portability</h3>
                <p>
                  You can access most of your data directly through your profile settings. You may request
                  a copy of your data by contacting us.
                </p>

                <h3>7.2 Correction</h3>
                <p>
                  You can update your profile information at any time through your account settings.
                </p>

                <h3>7.3 Deletion</h3>
                <p>You can delete your account through the profile settings. This will permanently remove:</p>
                <ul>
                  <li>Your profile and all personal information</li>
                  <li>Your uploaded CVs and cover letters</li>
                  <li>Your saved jobs and application history</li>
                  <li>Your AI usage history and preferences</li>
                  <li>Your subscription (will be cancelled)</li>
                </ul>

                <h3>7.4 Notification Preferences</h3>
                <p>You can control email notifications in your profile preferences:</p>
                <ul>
                  <li>New job match notifications</li>
                  <li>AI usage quota warnings</li>
                </ul>
                <p>
                  You cannot opt out of essential service communications (e.g., security alerts, billing issues).
                </p>

                <h3>7.5 AI Learning Preferences</h3>
                <p>
                  If you have a Pro subscription, you can disable personalized AI learning
                  in your settings. This will stop us from using your interaction data to personalize
                  recommendations.
                </p>

                <h3>7.6 GDPR Rights (EEA Residents)</h3>
                <p>If you are in the European Economic Area, you have additional rights under GDPR:</p>
                <ul>
                  <li>Right to object to processing</li>
                  <li>Right to restrict processing</li>
                  <li>Right to data portability</li>
                  <li>Right to withdraw consent</li>
                  <li>Right to lodge a complaint with a supervisory authority</li>
                </ul>

                <h3>7.7 California Rights (CCPA)</h3>
                <p>If you are a California resident, you have the right to:</p>
                <ul>
                  <li>Know what personal information we collect</li>
                  <li>Request deletion of your personal information</li>
                  <li>Opt-out of the sale of personal information (we do not sell personal information)</li>
                  <li>Non-discrimination for exercising your rights</li>
                </ul>
              </section>

              {/* Cookies */}
              <section>
                <h2>8. Cookies and Tracking</h2>

                <h3>8.1 Essential Cookies</h3>
                <p>We use essential cookies for:</p>
                <ul>
                  <li><strong>Authentication:</strong> Session cookies to keep you logged in (Supabase auth cookies)</li>
                  <li><strong>Security:</strong> CSRF protection tokens</li>
                </ul>
                <p>
                  These cookies are necessary for the Service to function and cannot be disabled.
                </p>

                <h3>8.2 Analytics</h3>
                <p>
                  We currently do not use third-party analytics cookies (such as Google Analytics).
                  We may add analytics in the future, and this policy will be updated accordingly.
                </p>

                <h3>8.3 Do Not Track</h3>
                <p>
                  We do not currently respond to &quot;Do Not Track&quot; browser signals, as there is no
                  industry-standard interpretation of this signal.
                </p>
              </section>

              {/* Children */}
              <section>
                <h2>9. Children&apos;s Privacy</h2>
                <p>
                  Job Silver is not intended for use by anyone under 18 years of age. We do not knowingly
                  collect personal information from children under 18. If we become aware that we have
                  collected data from a child under 18, we will take steps to delete such information.
                </p>
                <p>
                  If you are a parent or guardian and believe your child has provided us with personal
                  information, please contact us immediately.
                </p>
              </section>

              {/* International */}
              <section>
                <h2>10. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your own.
                  These countries may have different data protection laws. When we transfer data internationally,
                  we ensure appropriate safeguards are in place:
                </p>
                <ul>
                  <li>Use of service providers that comply with GDPR or equivalent standards</li>
                  <li>Standard contractual clauses where applicable</li>
                  <li>Data processing agreements with all processors</li>
                </ul>
              </section>

              {/* Changes */}
              <section>
                <h2>11. Changes to This Policy</h2>
                <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
                <ul>
                  <li>Posting the updated policy on our website</li>
                  <li>Updating the &quot;Last Updated&quot; date</li>
                  <li>Sending an email notification for significant changes (if you have an account)</li>
                </ul>
                <p>
                  We encourage you to review this policy periodically. Your continued use of the Service
                  after changes constitutes acceptance of the updated policy.
                </p>
              </section>

              {/* Contact */}
              <section>
                <h2>12. Contact Us</h2>
                <p>
                  If you have any questions about this Privacy Policy, your data, or wish to exercise
                  your rights, please contact us at:
                </p>
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-5"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <p style={{ color: 'var(--dawn-ink)', margin: 0 }}>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:jobsilver50@gmail.com">jobsilver50@gmail.com</a>
                  </p>
                </div>
                <p>
                  We will respond to your request within 30 days (or sooner as required by applicable law).
                </p>
              </section>

              {/* Summary */}
              <section>
                <h2>13. Summary of Key Points</h2>
                <div
                  className="my-8 rounded-[16px] border border-[var(--dawn-line)] p-6"
                  style={{ background: 'var(--dawn-cream)' }}
                >
                  <ul style={{ listStyle: 'none', paddingLeft: 0 }} className="space-y-3">
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>We collect</strong> information you provide (profile, CV, preferences) and usage data.</span>
                    </li>
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>We use</strong> your data to provide job search features, AI assistance, and personalization.</span>
                    </li>
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>We share</strong> data with service providers (Supabase, OpenAI, Stripe) but never sell it.</span>
                    </li>
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>AI features</strong> send your data to OpenAI for processing - this is disclosed transparently.</span>
                    </li>
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>You control</strong> your data - you can access, update, or delete it anytime.</span>
                    </li>
                    <li className="flex items-start gap-3" style={{ paddingLeft: 0 }}>
                      <span aria-hidden="true" className="font-bold leading-[1.7]" style={{ color: 'var(--coral-lo)' }}>&#10003;</span>
                      <span style={{ color: 'var(--dawn-ink-2)' }}><strong>We protect</strong> your data with encryption, access controls, and security best practices.</span>
                    </li>
                  </ul>
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
