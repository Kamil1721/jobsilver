import { Resend } from 'resend'
import { escapeHtml } from './utils'

const resend = new Resend(process.env.RESEND_API_KEY)

interface CronAlertParams {
  cronName: string
  error: string
  details?: Record<string, unknown>
  timestamp: string
}

/**
 * Send an alert email to admin when a cron job fails
 */
export async function sendCronFailureAlert({
  cronName,
  error,
  details,
  timestamp,
}: CronAlertParams): Promise<{ success: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL
  const fromEmail = process.env.EMAIL_FROM || 'noreply@jobsilver.com'

  if (!adminEmail) {
    console.warn('[Cron Alert] ADMIN_EMAIL not configured, skipping alert')
    return { success: false, error: 'ADMIN_EMAIL not configured' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[Cron Alert] RESEND_API_KEY not configured, skipping alert')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    // Escape all user-controllable data to prevent XSS
    const safeError = escapeHtml(error)
    const safeCronName = escapeHtml(cronName)
    const detailsHtml = details
      ? `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">${escapeHtml(JSON.stringify(details, null, 2))}</pre>`
      : ''

    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `🚨 Cron Job Failed: ${safeCronName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Cron Job Failure Alert</h2>

          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Cron Job:</strong> ${safeCronName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
            <p style="margin: 0;"><strong>Error:</strong> ${safeError}</p>
          </div>

          ${detailsHtml ? `<h3>Details:</h3>${detailsHtml}` : ''}

          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />

          <p style="color: #666; font-size: 14px;">
            Check the Vercel logs for more details:<br />
            <a href="https://vercel.com/dashboard">Vercel Dashboard</a>
          </p>

          <p style="color: #666; font-size: 14px;">
            Health check endpoint:<br />
            <code>/api/cron/health</code>
          </p>
        </div>
      `,
    })

    console.log(`[Cron Alert] Sent failure alert for ${cronName} to ${adminEmail}`)
    return { success: true }
  } catch (err) {
    console.error('[Cron Alert] Failed to send alert:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Send a daily summary of curation results to admin
 */
export async function sendCurationSummary({
  totalUsers,
  usersProcessed,
  usersFailed,
  totalJobsCurated,
  errors,
  durationMs,
}: {
  totalUsers: number
  usersProcessed: number
  usersFailed: number
  totalJobsCurated: number
  errors: string[]
  durationMs: number
}): Promise<{ success: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL
  const fromEmail = process.env.EMAIL_FROM || 'noreply@jobsilver.com'

  if (!adminEmail || !process.env.RESEND_API_KEY) {
    return { success: false, error: 'Email not configured' }
  }

  // Only send summary if there were issues or it's a significant run
  if (usersFailed === 0 && errors.length === 0 && totalJobsCurated === 0) {
    return { success: true } // Skip sending for uneventful runs
  }

  const hasErrors = usersFailed > 0 || errors.length > 0
  const emoji = hasErrors ? '⚠️' : '✅'
  const subject = hasErrors
    ? `⚠️ Daily Curation: ${usersFailed} failures`
    : `✅ Daily Curation: ${totalJobsCurated} jobs curated`

  try {
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${emoji} Daily Curation Summary</h2>

          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Total Users:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${totalUsers}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Processed:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #16a34a;">${usersProcessed}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Failed:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: ${usersFailed > 0 ? '#dc2626' : '#666'};">${usersFailed}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Jobs Curated:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${totalJobsCurated}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${(durationMs / 1000).toFixed(1)}s</td>
              </tr>
            </table>
          </div>

          ${errors.length > 0 ? `
            <h3 style="color: #dc2626;">Errors:</h3>
            <ul style="background: #fef2f2; border-radius: 8px; padding: 16px 16px 16px 32px; margin: 16px 0;">
              ${errors.map(e => `<li style="margin: 4px 0;">${escapeHtml(e)}</li>`).join('')}
            </ul>
          ` : ''}

          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            <a href="/api/cron/health">Check cron health</a>
          </p>
        </div>
      `,
    })

    return { success: true }
  } catch (err) {
    console.error('[Cron Alert] Failed to send summary:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
