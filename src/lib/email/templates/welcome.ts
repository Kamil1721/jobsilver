import { sendEmail, EMAIL_CONFIG, type EmailResult } from '../client'
import { baseTemplate } from '../base-template'
import { escapeHtml } from '../utils'

export interface WelcomeEmailParams {
  to: string
  userName: string
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail({
  to,
  userName,
}: WelcomeEmailParams): Promise<EmailResult> {
  const { appName, appUrl } = EMAIL_CONFIG
  const firstName = userName.split(' ')[0] || 'there'

  const content = `
    <h2>Welcome to ${appName}!</h2>

    <p>Hi ${escapeHtml(firstName)},</p>

    <p>
      Thanks for joining ${appName}! We're excited to help you land your dream job.
    </p>

    <p>Here's what you can do next:</p>

    <div class="card">
      <div class="list-item">
        <strong style="color: #fafafa;">1. Complete your profile</strong>
        <p style="margin: 8px 0 0 0; color: #71717a; font-size: 14px;">
          Upload your CV and set your job preferences so we can find the best matches for you.
        </p>
      </div>
      <div class="list-item">
        <strong style="color: #fafafa;">2. Set up job filters</strong>
        <p style="margin: 8px 0 0 0; color: #71717a; font-size: 14px;">
          Tell us what kind of jobs you're looking for - remote, hybrid, full-time, contract, and more.
        </p>
      </div>
      <div class="list-item">
        <strong style="color: #fafafa;">3. Enable auto-curation</strong>
        <p style="margin: 8px 0 0 0; color: #71717a; font-size: 14px;">
          Turn on production mode to receive personalized job matches every day.
        </p>
      </div>
    </div>

    <p style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}/setup" class="button">Complete Your Setup</a>
    </p>

    <p>
      If you have any questions, feel free to reply to this email or use the feedback button in the app.
    </p>

    <p>
      Good luck with your job search!<br>
      <strong>The ${appName} Team</strong>
    </p>
  `

  return sendEmail({
    to,
    subject: `Welcome to ${appName}! Let's find your dream job`,
    html: baseTemplate({
      title: `Welcome to ${appName}`,
      preheader: `Hi ${escapeHtml(firstName)}, thanks for joining! Here's how to get started...`,
      content,
      showUnsubscribe: false, // Don't show unsubscribe for welcome email
    }),
  })
}
