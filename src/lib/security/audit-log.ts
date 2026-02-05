/**
 * Security Audit Logging
 *
 * Provides structured logging for security-sensitive operations.
 * Logs are designed to be easily searchable and can be forwarded to
 * external logging services (Datadog, Logtail, etc.) via Vercel Log Drains.
 */

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_reset'
  | 'auth.tester_invite_redeemed'
  | 'admin.user_viewed'
  | 'admin.user_updated'
  | 'admin.user_deleted'
  | 'admin.tester_invite_created'
  | 'admin.settings_changed'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.payment_failed'
  | 'account.deleted'
  | 'account.profile_updated'
  | 'data.exported'
  | 'security.rate_limit_exceeded'
  | 'security.invalid_token'
  | 'security.unauthorized_access'
  | 'security.suspicious_activity'

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AuditLogEntry {
  /** Type of security event */
  event: AuditEventType
  /** Severity level */
  severity: AuditSeverity
  /** User ID who performed the action (if authenticated) */
  userId?: string
  /** Target user ID (for admin actions on other users) */
  targetUserId?: string
  /** IP address of the request */
  ip?: string
  /** User agent string */
  userAgent?: string
  /** Additional context about the event */
  details?: Record<string, unknown>
  /** Timestamp in ISO format */
  timestamp: string
  /** Request ID for correlation */
  requestId?: string
}

/**
 * Redact sensitive data from log entries
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'credit_card',
    'ssn',
    'api_key',
  ]

  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      redacted[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Log a security audit event
 *
 * In production, these logs should be forwarded to a log aggregation service
 * for monitoring and alerting.
 */
export function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    requestId: entry.requestId || generateRequestId(),
    details: entry.details ? redactSensitiveData(entry.details) : undefined,
  }

  // Format for structured logging (JSON)
  // This format is compatible with most log aggregation services
  const logPrefix = `[AUDIT:${fullEntry.severity.toUpperCase()}]`

  // Use appropriate log level based on severity
  switch (fullEntry.severity) {
    case 'critical':
    case 'error':
      console.error(logPrefix, JSON.stringify(fullEntry))
      break
    case 'warning':
      console.warn(logPrefix, JSON.stringify(fullEntry))
      break
    default:
      console.log(logPrefix, JSON.stringify(fullEntry))
  }
}

/**
 * Log an authentication event
 */
export function logAuthEvent(
  event: Extract<AuditEventType, `auth.${string}`>,
  options: {
    userId?: string
    ip?: string
    userAgent?: string
    success?: boolean
    reason?: string
  }
): void {
  auditLog({
    event,
    severity: options.success === false ? 'warning' : 'info',
    userId: options.userId,
    ip: options.ip,
    userAgent: options.userAgent,
    details: {
      success: options.success,
      reason: options.reason,
    },
  })
}

/**
 * Log an admin action
 */
export function logAdminAction(
  event: Extract<AuditEventType, `admin.${string}`>,
  options: {
    adminUserId: string
    targetUserId?: string
    ip?: string
    action: string
    details?: Record<string, unknown>
  }
): void {
  auditLog({
    event,
    severity: 'info',
    userId: options.adminUserId,
    targetUserId: options.targetUserId,
    ip: options.ip,
    details: {
      action: options.action,
      ...options.details,
    },
  })
}

/**
 * Log a security incident
 */
export function logSecurityIncident(
  event: Extract<AuditEventType, `security.${string}`>,
  options: {
    userId?: string
    ip?: string
    userAgent?: string
    reason: string
    details?: Record<string, unknown>
  }
): void {
  auditLog({
    event,
    severity: event === 'security.suspicious_activity' ? 'critical' : 'warning',
    userId: options.userId,
    ip: options.ip,
    userAgent: options.userAgent,
    details: {
      reason: options.reason,
      ...options.details,
    },
  })
}

/**
 * Log a subscription event
 */
export function logSubscriptionEvent(
  event: Extract<AuditEventType, `subscription.${string}`>,
  options: {
    userId: string
    subscriptionId?: string
    plan?: string
    details?: Record<string, unknown>
  }
): void {
  auditLog({
    event,
    severity: event === 'subscription.payment_failed' ? 'warning' : 'info',
    userId: options.userId,
    details: {
      subscriptionId: options.subscriptionId,
      plan: options.plan,
      ...options.details,
    },
  })
}

/**
 * Log an account event
 */
export function logAccountEvent(
  event: Extract<AuditEventType, `account.${string}`>,
  options: {
    userId: string
    ip?: string
    details?: Record<string, unknown>
  }
): void {
  auditLog({
    event,
    severity: event === 'account.deleted' ? 'warning' : 'info',
    userId: options.userId,
    ip: options.ip,
    details: options.details,
  })
}

/**
 * Create an audit context from a request for easy logging
 */
export function createAuditContext(request: Request): {
  ip: string
  userAgent: string
  requestId: string
} {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId: generateRequestId(),
  }
}

// ============================================
// DATABASE AUDIT LOGGING
// ============================================

import type { AuditLogAction, AuditLogTargetType } from '@/lib/supabase/types'

/**
 * Log an admin action to the database for persistent audit trail.
 * This is in addition to the console logging above.
 *
 * @param supabase - Supabase client (server-side)
 * @param options - Audit log options
 */
export async function logAdminActionToDb(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => PromiseLike<{ error: unknown | null }> } },
  options: {
    adminId: string
    adminEmail: string
    action: AuditLogAction
    targetType?: AuditLogTargetType
    targetId?: string
    details?: Record<string, unknown>
    ipAddress?: string
  }
): Promise<void> {
  try {
    const result = await supabase.from('admin_audit_logs').insert({
      admin_id: options.adminId,
      admin_email: options.adminEmail,
      action: options.action,
      target_type: options.targetType || null,
      target_id: options.targetId || null,
      details: options.details ? redactSensitiveData(options.details) : null,
      ip_address: options.ipAddress || null,
    })

    if (result?.error) {
      // Don't fail the main operation if audit logging fails
      // but do log the error for monitoring
      console.error('[AUDIT:ERROR] Failed to write audit log to database:', result.error)
    }
  } catch (err) {
    console.error('[AUDIT:ERROR] Exception writing audit log:', err)
  }
}
