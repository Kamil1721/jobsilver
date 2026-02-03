import { Resend } from 'resend'

// Initialize Resend client
// Will be null if RESEND_API_KEY is not set (for development)
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'noreply@example.com',
  replyTo: process.env.EMAIL_REPLY_TO || undefined,
  appName: 'Job Silver',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  unsubscribeUrl: process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=preferences`
    : 'http://localhost:3000/profile?tab=preferences',
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Retry a function with exponential backoff
 * Delays: 1s, 2s, 4s between retries
 */
async function sendWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (i < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
  }
  throw lastError
}

/**
 * Send an email using Resend
 * Handles errors gracefully and logs for debugging
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend client not initialized - RESEND_API_KEY not set')
    console.log('Would send email:', { to, subject })
    return {
      success: false,
      error: 'Email service not configured'
    }
  }

  try {
    const { data, error } = await sendWithRetry(async () => {
      return resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || stripHtml(html),
        replyTo: replyTo || EMAIL_CONFIG.replyTo,
      })
    })

    if (error) {
      console.error('Resend API error:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('Email sent successfully:', data?.id)
    return {
      success: true,
      messageId: data?.id
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to send email after retries:', message)
    return {
      success: false,
      error: message
    }
  }
}

/**
 * Strip HTML tags for plain text version
 * Preserves some formatting like line breaks and basic structure
 */
function stripHtml(html: string): string {
  return html
    // Remove style and script blocks
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Add line breaks before block elements
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&bull;/g, '\u2022')
    // Normalize whitespace (but preserve line breaks)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export { resend }
