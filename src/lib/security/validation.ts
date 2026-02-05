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

/**
 * Sanitize user input for use in AI prompts
 * Prevents prompt injection by removing control characters and suspicious patterns
 */
export function sanitizeForPrompt(input: string | null | undefined, maxLength: number = 2000): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .slice(0, maxLength)
    // Remove newlines and carriage returns that could break prompt structure
    .replace(/[\r\n]+/g, ' ')
    // Remove potential prompt injection patterns
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '')
    // Remove markdown/code block attempts
    .replace(/```/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sanitize AI output for YAML/LaTeX compatibility
 * Converts Unicode characters that break Python YAML parsing or LaTeX rendering
 */
export function sanitizeAIOutput(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return ''
  return text
    // Smart single quotes → straight quote
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Smart double quotes → straight quote
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Em-dashes, en-dashes → hyphen
    .replace(/[\u2013\u2014\u2015]/g, '-')
    // Ellipsis → three dots
    .replace(/\u2026/g, '...')
    // Bullet points → hyphen
    .replace(/[\u2022\u2023\u2043]/g, '-')
    // Non-breaking space → regular space
    .replace(/\u00A0/g, ' ')
    // LaTeX special characters → space (safer than escaping)
    .replace(/[&%$#_{}~^\\]/g, ' ')
    // Other non-ASCII → attempt NFD normalization or remove
    .replace(/[^\x00-\x7F]/g, char => {
      const normalized = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // If normalization produces ASCII, use it; otherwise remove
      return /^[\x00-\x7F]*$/.test(normalized) ? normalized : ''
    })
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
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
 *
 * SECURITY: subscription_plan and is_admin are intentionally NOT allowed here.
 * - subscription_plan changes ONLY via Stripe webhooks (prevents billing bypass)
 * - is_admin changes ONLY via ADMIN_EMAILS env var (prevents privilege escalation)
 * - is_tester is the only safe field for admin UI modification
 */
export const adminUserUpdateSchema = z.object({
  user_id: uuidSchema,
  is_tester: z.boolean().optional(),
}).refine(
  data => data.is_tester !== undefined,
  { message: 'is_tester field must be provided' }
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

// ============================================
// CV Generation Validation Schemas
// ============================================

/**
 * Work history entry schema
 */
export const workHistoryEntrySchema = z.object({
  company: z.string().min(1).max(200),
  position: z.string().min(1).max(200),
  start_date: z.string().max(20),
  end_date: z.string().max(20).nullable().optional(),
  location: z.string().max(200).optional(),
  highlights: z.array(z.string().max(500)).max(10).default([]),
})

/**
 * Education entry schema
 */
export const educationEntrySchema = z.object({
  institution: z.string().min(1).max(200),
  degree: z.string().min(1).max(200),
  area: z.string().min(1).max(200),
  graduation_year: z.string().max(10),
  location: z.string().max(200).optional(),
  highlights: z.array(z.string().max(500)).max(5).optional(),
})

/**
 * Screening answers schema for CV generation
 */
export const screeningAnswersSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone_country_code: z.string().max(10).optional(),
  phone_number: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  state_region: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  linkedin_url: z.string().url().max(500).optional().or(z.literal('')),
  experience_summary: z.string().max(2000).optional(),
  work_history: z.array(workHistoryEntrySchema).min(1).max(10),
  education: z.array(educationEntrySchema).min(1).max(5),
  skills: z.array(z.string().max(100)).max(50).default([]),
})

/**
 * Job context schema for CV tailoring
 */
export const jobContextSchema = z.object({
  id: uuidSchema,
  title: z.string().max(300),
  company: z.string().max(300),
  description: z.string().max(10000).optional(),
})

/**
 * CV generation request schema
 */
export const cvGenerateRequestSchema = z.object({
  screeningAnswers: screeningAnswersSchema.optional(),
  jobContext: jobContextSchema.optional(),
  quickGenerate: z.boolean().optional(),
  aiTailor: z.boolean().optional(),
})
