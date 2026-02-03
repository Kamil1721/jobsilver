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

    <p>
      Your account is all set up and ready to go. Head over to your dashboard to start discovering job opportunities matched to your profile.
    </p>

    <p style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}/dashboard" class="button">Go to Dashboard</a>
    </p>

    <p>
      Good luck with your job search!<br>
      <strong>The ${appName} Team</strong>
    </p>
  `

  return sendEmail({
    to,
    subject: `Welcome to ${appName}!`,
    html: baseTemplate({
      title: `Welcome to ${appName}`,
      preheader: `Hi ${escapeHtml(firstName)}, thanks for joining! Your account is ready.`,
      content,
      showUnsubscribe: false, // Don't show unsubscribe for welcome email
    }),
  })
}
