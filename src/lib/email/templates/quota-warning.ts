import { sendEmail, EMAIL_CONFIG, type EmailResult } from '../client'
import { baseTemplate } from '../base-template'

export interface QuotaWarningEmailParams {
  to: string
  userName: string
  remaining: number
  limit: number
  currentPlan: string
}

/**
 * Send quota warning email when user is approaching daily limit
 */
export async function sendQuotaWarningEmail({
  to,
  userName,
  remaining,
  limit,
  currentPlan,
}: QuotaWarningEmailParams): Promise<EmailResult> {
  const { appName, appUrl } = EMAIL_CONFIG
  const firstName = userName.split(' ')[0] || 'there'
  const percentUsed = Math.round(((limit - remaining) / limit) * 100)
  const isLow = remaining <= 5
  const isCritical = remaining === 0

  // Dark theme urgency styling
  const urgencyClass = isCritical
    ? 'background-color: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);'
    : isLow
    ? 'background-color: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);'
    : 'background-color: rgba(113, 113, 122, 0.1); color: #a1a1aa; border: 1px solid rgba(113, 113, 122, 0.2);'

  const content = `
    <h2>Daily Quota ${isCritical ? 'Reached' : 'Warning'}</h2>

    <p>Hi ${firstName},</p>

    ${isCritical ? `
    <p>
      You've used all your daily job quota. Don't worry - it will reset at midnight UTC.
    </p>
    ` : `
    <p>
      You're approaching your daily job quota limit. Here's your current usage:
    </p>
    `}

    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="color: #71717a;">Daily Usage</span>
        <strong style="color: #fafafa;">${limit - remaining} / ${limit} jobs</strong>
      </div>

      <!-- Progress bar -->
      <div style="background-color: #27272a; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: ${isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#52525b'}; height: 100%; width: ${percentUsed}%;"></div>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 8px;">
        <span style="font-size: 12px; color: #71717a;">${percentUsed}% used</span>
        <span style="font-size: 12px; ${urgencyClass} padding: 2px 8px; border-radius: 6px;">
          ${remaining} remaining
        </span>
      </div>
    </div>

    <div style="background-color: #18181b; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">
        Current Plan
      </p>
      <p style="margin: 0; color: #fafafa; font-weight: 600;">
        ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} - ${limit} jobs/day
      </p>
    </div>

    ${currentPlan === 'free' ? `
    <div class="tip-box">
      <p style="margin: 0 0 8px 0; font-weight: 600;">
        Need more jobs?
      </p>
      <p style="margin: 0; font-size: 14px;">
        Upgrade your plan to get more daily job matches and unlock additional AI assistant features.
      </p>
    </div>

    <p style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}/settings/billing" class="button">View Plans</a>
    </p>
    ` : `
    <p style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}/dashboard" class="button">View Dashboard</a>
    </p>
    `}

    <p style="color: #71717a; font-size: 14px;">
      Your quota resets daily at midnight UTC. Make sure to review your curated jobs before then!
    </p>
  `

  const subject = isCritical
    ? `Daily quota reached - Resets at midnight UTC`
    : isLow
    ? `Only ${remaining} jobs left in your daily quota`
    : `${percentUsed}% of your daily job quota used`

  return sendEmail({
    to,
    subject,
    html: baseTemplate({
      title: 'Daily Quota Update',
      preheader: subject,
      content,
    }),
  })
}
