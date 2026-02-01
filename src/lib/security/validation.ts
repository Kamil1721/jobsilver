/**
 * Security Validation Utilities
 *
 * Provides centralized validation for:
 * - UUID format validation
 * - Input sanitization
 * - Request body validation with Zod
 */

import { z } from 'zod'

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false
  return UUID_REGEX.test(id)
}

/**
 * Zod schema for UUID validation
 */
export const uuidSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format')

/**
 * Validates a UUID and returns a typed result
 */
export function validateUUID(id: string | null | undefined): { valid: true; id: string } | { valid: false; error: string } {
  if (!id) {
    return { valid: false, error: 'ID is required' }
  }
  if (!isValidUUID(id)) {
    return { valid: false, error: 'Invalid UUID format' }
  }
  return { valid: true, id }
}

/**
 * Sanitize string for use in database patterns (LIKE/ILIKE)
 * Escapes special characters that could be used for SQL injection via pattern matching
 */
export function sanitizeSearchPattern(input: string): string {
  if (!input || typeof input !== 'string') return ''

  // Escape SQL LIKE special characters
  return input
    .replace(/\\/g, '\\\\')  // Escape backslash first
    .replace(/%/g, '\\%')     // Escape percent
    .replace(/_/g, '\\_')     // Escape underscore
    .replace(/'/g, "''")      // Escape single quote (SQL standard)
}

/**
 * Sanitize and truncate search input
 */
export function sanitizeSearchInput(input: string | null | undefined, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') return ''

  // Trim whitespace and truncate
  const trimmed = input.trim().slice(0, maxLength)

  // Remove null bytes and control characters
  return trimmed.replace(/[\x00-\x1f\x7f]/g, '')
}

// ============================================
// Zod Schemas for API Validation
// ============================================

/**
 * Common pagination schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Admin users API - GET query params
 */
export const adminUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(100).optional(),
  plan: z.enum(['free', 'starter', 'basic', 'pro', 'ultra', 'mega', '']).optional(),
})

/**
 * Admin users API - PATCH body
 */
export const adminUserUpdateSchema = z.object({
  user_id: uuidSchema,
  subscription_plan: z.enum(['free', 'starter', 'basic', 'pro', 'ultra', 'mega']).optional(),
  is_admin: z.boolean().optional(),
  is_tester: z.boolean().optional(),
}).refine(
  data => data.subscription_plan !== undefined || data.is_admin !== undefined || data.is_tester !== undefined,
  { message: 'At least one field (subscription_plan, is_admin, or is_tester) must be provided' }
)

/**
 * Admin users API - DELETE body
 */
export const adminUserDeleteSchema = z.object({
  user_id: uuidSchema,
})

/**
 * API usage reset schema
 */
export const apiUsageActionSchema = z.object({
  action: z.enum(['reset_current_month', 'clear_request_log']),
})

/**
 * Generic error response type
 */
export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR'
    message: string
    details?: z.ZodIssue[]
  }
}

/**
 * Parse and validate request body with Zod schema
 * Returns parsed data or error response
 */
export async function parseRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: ValidationErrorResponse }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      return {
        success: false,
        error: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.issues,
          },
        },
      }
    }

    return { success: true, data: result.data }
  } catch {
    return {
      success: false,
      error: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid JSON in request body',
        },
      },
    }
  }
}

/**
 * Parse query parameters with Zod schema
 */
export function parseQueryParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: ValidationErrorResponse } {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  const result = schema.safeParse(params)

  if (!result.success) {
    return {
      success: false,
      error: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: result.error.issues,
        },
      },
    }
  }

  return { success: true, data: result.data }
}
