import { sendEmail, EMAIL_CONFIG, type EmailResult } from '../client'
import { baseTemplate } from '../base-template'

export interface JobMatch {
  id: string
  title: string
  company: string
  location?: string
  matchScore?: number
  remote?: boolean
}

export interface JobMatchesEmailParams {
  to: string
  userName: string
  matchCount: number
  topMatches: JobMatch[]
  date?: string
}

/**
 * Send daily job matches summary email
 */
export async function sendJobMatchesEmail({
  to,
  userName,
  matchCount,
  topMatches,
  date,
}: JobMatchesEmailParams): Promise<EmailResult> {
  const { appName, appUrl } = EMAIL_CONFIG
  const firstName = userName.split(' ')[0] || 'there'
  const formattedDate = date || new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const jobsList = topMatches
    .slice(0, 5)
    .map((job) => {
      // Use emerald for high scores (80+), amber for medium (60-79), zinc for lower
      let matchBadgeClass = 'badge-info'
      if (job.matchScore && job.matchScore >= 80) {
        matchBadgeClass = 'badge-success'
      } else if (job.matchScore && job.matchScore >= 60) {
        matchBadgeClass = 'badge-warning'
      }

      const matchBadge = job.matchScore
        ? `<span class="badge ${matchBadgeClass}">${job.matchScore}% match</span>`
        : ''
      const remoteBadge = job.remote
        ? `<span class="badge badge-info">Remote</span>`
        : ''

      return `
        <div class="list-item">
          <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: #fafafa;">${job.title}</strong>
              <p style="margin: 4px 0 0 0; color: #71717a; font-size: 14px;">
                ${job.company}${job.location ? ` &bull; ${job.location}` : ''}
              </p>
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              ${matchBadge}
              ${remoteBadge}
            </div>
          </div>
        </div>
      `
    })
    .join('')

  const content = `
    <h2>Your Daily Job Matches</h2>

    <p>Hi ${firstName},</p>

    <p>
      Great news! We found <strong>${matchCount} new job${matchCount !== 1 ? 's' : ''}</strong>
      that match your preferences.
    </p>

    <p style="color: #71717a; font-size: 14px;">${formattedDate}</p>

    <div class="card">
      <div class="card-title">Top Matches</div>
      ${jobsList}
    </div>

    ${matchCount > 5 ? `
    <p style="color: #71717a; font-size: 14px; text-align: center;">
      And ${matchCount - 5} more jobs waiting for you...
    </p>
    ` : ''}

    <p style="text-align: center; margin: 32px 0;">
      <a href="${appUrl}/dashboard" class="button">View All Jobs</a>
    </p>

    <div class="tip-box">
      <p>
        <strong>Tip:</strong> Review your matches early! Popular positions fill up quickly.
      </p>
    </div>
  `

  return sendEmail({
    to,
    subject: `${matchCount} new job match${matchCount !== 1 ? 'es' : ''} for you`,
    html: baseTemplate({
      title: 'Your Daily Job Matches',
      preheader: `We found ${matchCount} new jobs matching your preferences. Check them out!`,
      content,
    }),
  })
}
