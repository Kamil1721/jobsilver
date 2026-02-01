/**
 * Security Utilities Index
 *
 * Centralized exports for security-related functionality:
 * - Input validation with Zod
 * - UUID validation
 * - Rate limiting
 * - Search sanitization
 */

// Validation utilities
export {
  // UUID validation
  isValidUUID,
  validateUUID,
  uuidSchema,

  // Search sanitization
  sanitizeSearchPattern,
  sanitizeSearchInput,

  // Zod schemas for API validation
  paginationSchema,
  adminUsersQuerySchema,
  adminUserUpdateSchema,
  adminUserDeleteSchema,
  apiUsageActionSchema,

  // Request parsing helpers
  parseRequestBody,
  parseQueryParams,

  // Types
  type ValidationErrorResponse,
} from './validation'

// Rate limiting utilities
export {
  // Core rate limiting
  checkRateLimit,
  getRateLimitHeaders,
  getClientIdentifier,

  // Configuration
  RATE_LIMITS,

  // Utility functions
  resetRateLimit,
  getRateLimitStatus,

  // Types
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit'
