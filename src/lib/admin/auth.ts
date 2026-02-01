/**
 * Admin Authentication Utilities
 *
 * Admin access is controlled via:
 * 1. Environment variable ADMIN_EMAILS (comma-separated list)
 * 2. is_admin flag in profiles table
 *
 * SECURITY: Admin emails should be configured via environment variables,
 * not hardcoded in source code.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Get admin emails from environment variable
 * Format: ADMIN_EMAILS=admin1@example.com,admin2@example.com
 */
function getAdminEmails(): string[] {
  const adminEmailsEnv = process.env.ADMIN_EMAILS || ''

  if (!adminEmailsEnv) {
    console.warn(
      'SECURITY WARNING: ADMIN_EMAILS environment variable is not set. ' +
      'Admin access will only be determined by is_admin flag in database.'
    )
    return []
  }

  return adminEmailsEnv
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0)
}

export interface AdminAuthResult {
  isAdmin: boolean
  user: {
    id: string
    email: string
  } | null
  error?: string
}

/**
 * Check if an email is in the admin list
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.includes(email.toLowerCase())
}

/**
 * Check if the current user is an admin
 *
 * Admin status is determined by:
 * 1. Email matching one in ADMIN_EMAILS environment variable
 * 2. is_admin = true flag in profiles table
 */
export async function checkAdminAuth(): Promise<AdminAuthResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        isAdmin: false,
        user: null,
        error: 'Unauthorized - not logged in',
      }
    }

    // Check if user is admin by email (from environment variable)
    const emailIsAdmin = isAdminEmail(user.email)

    // Also check the is_admin flag in the database
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, email')
      .eq('id', user.id)
      .single()

    const dbIsAdmin = profile?.is_admin === true

    // User is admin if either condition is met
    const isAdmin = emailIsAdmin || dbIsAdmin

    if (!isAdmin) {
      return {
        isAdmin: false,
        user: {
          id: user.id,
          email: user.email || '',
        },
        error: 'Forbidden - not an admin',
      }
    }

    return {
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email || '',
      },
    }
  } catch (error) {
    console.error('Admin auth check error:', error)
    return {
      isAdmin: false,
      user: null,
      error: 'Internal server error',
    }
  }
}

/**
 * Get admin emails for display (redacted for security)
 * Only shows first 3 characters of each email
 */
export function getRedactedAdminEmails(): string[] {
  const adminEmails = getAdminEmails()
  return adminEmails.map(email => {
    const [localPart, domain] = email.split('@')
    if (!domain) return '***'
    const redactedLocal = localPart.slice(0, 3) + '***'
    return `${redactedLocal}@${domain}`
  })
}
