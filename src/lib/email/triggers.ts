import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from './templates/welcome'
import { sendJobMatchesEmail, type JobMatch } from './templates/job-matches'
import { sendQuotaWarningEmail } from './templates/quota-warning'
import type { SubscriptionPlan } from '@/lib/supabase/types'

// Define notification types
export type NotificationType =
  | 'welcome'
  | 'job_matches'
  | 'quota_warning'

export interface NotificationResult {
  success: boolean
  notificationId?: string
  error?: string
}

/**
 * Log notification to database
 */
async function logNotification(
  userId: string,
  type: NotificationType,
  status: 'sent' | 'failed',
  error?: string
): Promise<string | null> {
  try {
    const supabase = createServiceClient()

    const { data, error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        status,
        error: error || null,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('Failed to log notification:', dbError)
      return null
    }

    return data?.id || null
  } catch (err) {
    console.error('Error logging notification:', err)
    return null
  }
}

/**
 * Get user profile and check if notifications are enabled
 */
async function getUserForNotification(userId: string): Promise<{
  email: string | null
  full_name: string | null
  email_notifications: boolean
  notification_preferences: Record<string, boolean> | null
  subscription_plan: SubscriptionPlan
} | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('email, full_name, email_notifications, notification_preferences, subscription_plan')
    .eq('id', userId)
    .single()

  if (error || !data?.email) {
    console.error('Failed to fetch user for notification:', error)
    return null
  }

  return {
    email: data.email,
    full_name: data.full_name,
    email_notifications: data.email_notifications ?? true,
    notification_preferences: data.notification_preferences as Record<string, boolean> | null,
    subscription_plan: data.subscription_plan,
  }
}

/**
 * Check if user has enabled a specific notification type
 */
function isNotificationEnabled(
  user: Awaited<ReturnType<typeof getUserForNotification>>,
  type: NotificationType
): boolean {
  if (!user) return false

  // Check global email notifications setting
  if (!user.email_notifications) return false

  // Check specific preference if available
  if (user.notification_preferences && typeof user.notification_preferences[type] === 'boolean') {
    return user.notification_preferences[type]
  }

  // Default to enabled
  return true
}

/**
 * Send welcome email notification
 */
export async function notifyWelcome(
  userId: string
): Promise<NotificationResult> {
  const user = await getUserForNotification(userId)

  if (!user?.email) {
    return { success: false, error: 'User not found or missing email' }
  }

  // Always send welcome email regardless of notification preferences
  const result = await sendWelcomeEmail({
    to: user.email,
    userName: user.full_name || 'there',
  })

  const notificationId = await logNotification(
    userId,
    'welcome',
    result.success ? 'sent' : 'failed',
    result.error
  )

  return {
    success: result.success,
    notificationId: notificationId || undefined,
    error: result.error,
  }
}

/**
 * Send new job matches notification
 */
export async function notifyNewMatches(
  userId: string,
  matchCount: number,
  topMatches: JobMatch[]
): Promise<NotificationResult> {
  const user = await getUserForNotification(userId)

  if (!user?.email) {
    return { success: false, error: 'User not found or missing email' }
  }

  if (!isNotificationEnabled(user, 'job_matches')) {
    return { success: false, error: 'Job match notifications disabled' }
  }

  // Don't send if no matches
  if (matchCount === 0) {
    return { success: false, error: 'No matches to notify about' }
  }

  const result = await sendJobMatchesEmail({
    to: user.email,
    userName: user.full_name || 'there',
    matchCount,
    topMatches,
  })

  const notificationId = await logNotification(
    userId,
    'job_matches',
    result.success ? 'sent' : 'failed',
    result.error
  )

  return {
    success: result.success,
    notificationId: notificationId || undefined,
    error: result.error,
  }
}

/**
 * Send quota warning notification
 */
export async function notifyQuotaWarning(
  userId: string,
  remaining: number,
  limit: number
): Promise<NotificationResult> {
  const user = await getUserForNotification(userId)

  if (!user?.email) {
    return { success: false, error: 'User not found or missing email' }
  }

  if (!isNotificationEnabled(user, 'quota_warning')) {
    return { success: false, error: 'Quota warning notifications disabled' }
  }

  // Only notify at specific thresholds: 20%, 10%, 5%, 0%
  const percentRemaining = (remaining / limit) * 100
  const thresholds = [0, 5, 10, 20]
  const shouldNotify = thresholds.some(
    (threshold) => percentRemaining <= threshold && percentRemaining + (1 / limit) * 100 > threshold
  )

  if (!shouldNotify && remaining > 0) {
    return { success: false, error: 'Not at notification threshold' }
  }

  const result = await sendQuotaWarningEmail({
    to: user.email,
    userName: user.full_name || 'there',
    remaining,
    limit,
    currentPlan: user.subscription_plan,
  })

  const notificationId = await logNotification(
    userId,
    'quota_warning',
    result.success ? 'sent' : 'failed',
    result.error
  )

  return {
    success: result.success,
    notificationId: notificationId || undefined,
    error: result.error,
  }
}
