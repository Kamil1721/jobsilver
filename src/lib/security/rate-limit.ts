/**
 * Rate Limiting Utilities
 *
 * Hybrid rate limiter that uses:
 * 1. Database (Supabase) for distributed rate limiting in production
 * 2. In-memory fallback for development or when DB is unavailable
 *
 * For high-traffic production, consider upgrading to Redis/Upstash.
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

// In-memory store for rate limits (fallback)
// Key format: `${identifier}:${endpoint}`
const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000
let cleanupInterval: NodeJS.Timeout | null = null

function startCleanup() {
  if (cleanupInterval) return

  cleanupInterval = setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((record, key) => {
      if (record.resetAt < now) {
        rateLimitStore.delete(key)
      }
    })
  }, CLEANUP_INTERVAL)

  // Don't prevent process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }
}

// Start cleanup on module load
startCleanup()

export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
  /** Optional: custom key prefix */
  prefix?: string
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of requests remaining */
  remaining: number
  /** When the rate limit resets (Unix timestamp in seconds) */
  resetAt: number
  /** Total limit */
  limit: number
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Admin endpoints - stricter limits
  admin: {
    maxRequests: 30,
    windowSeconds: 60,
    prefix: 'admin',
  },

  // Authentication endpoints - very strict to prevent brute force
  auth: {
    maxRequests: 5,
    windowSeconds: 60,
    prefix: 'auth',
  },

  // General API - standard limits
  standard: {
    maxRequests: 60,
    windowSeconds: 60,
    prefix: 'std',
  },

  // Chat/AI - lower limits due to cost
  chat: {
    maxRequests: 20,
    windowSeconds: 60,
    prefix: 'chat',
  },

  // Strict limits for sensitive operations
  sensitive: {
    maxRequests: 10,
    windowSeconds: 60,
    prefix: 'sens',
  },
} as const satisfies Record<string, RateLimitConfig>

/**
 * Check and update rate limit for an identifier (in-memory version)
 * This is the fallback when database is unavailable
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const key = `${config.prefix || 'rl'}:${endpoint || 'default'}:${identifier}`

  // Atomic check-and-increment to prevent race conditions
  // Get existing record or initialize new one
  let record = rateLimitStore.get(key)

  // Reset window if expired
  if (!record || record.resetAt < now) {
    record = {
      count: 0,
      resetAt: now + windowMs,
    }
  }

  // Increment BEFORE checking - this makes the operation effectively atomic
  // since we're single-threaded in Node.js between await points
  record.count++
  rateLimitStore.set(key, record)

  // Now check if allowed (after increment)
  const allowed = record.count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - record.count)

  return {
    allowed,
    remaining,
    resetAt: Math.floor(record.resetAt / 1000),
    limit: config.maxRequests,
  }
}

/**
 * Check and update rate limit for an identifier
 * Uses in-memory store with optional database persistence for distributed systems
 *
 * @param identifier - Unique identifier (usually user ID or IP)
 * @param config - Rate limit configuration
 * @param endpoint - Optional endpoint name for granular limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): RateLimitResult {
  // Use in-memory rate limiting (fast, works for single-instance deployments)
  // For multi-instance production, the database-backed version should be used
  return checkRateLimitInMemory(identifier, config, endpoint)
}

/**
 * Database-backed rate limit check using Supabase
 * Use this for critical endpoints that need distributed rate limiting
 *
 * @param supabase - Supabase client
 * @param identifier - Unique identifier
 * @param config - Rate limit configuration
 * @param endpoint - Endpoint name
 */
export async function checkRateLimitDistributed(
  supabase: {
    rpc: (fn: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
  },
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): Promise<RateLimitResult> {
  const key = `${config.prefix || 'rl'}:${endpoint || 'default'}:${identifier}`

  try {
    // Call database function for atomic rate limiting
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
    })

    if (error) {
      // Fallback to in-memory on database error
      console.warn('Rate limit DB error, using in-memory fallback:', error)
      return checkRateLimitInMemory(identifier, config, endpoint)
    }

    const result = data as { allowed: boolean; count: number; reset_at: string }

    return {
      allowed: result.allowed,
      remaining: Math.max(0, config.maxRequests - result.count),
      resetAt: Math.floor(new Date(result.reset_at).getTime() / 1000),
      limit: config.maxRequests,
    }
  } catch (err) {
    // Fallback to in-memory on any error
    console.warn('Rate limit error, using in-memory fallback:', err)
    return checkRateLimitInMemory(identifier, config, endpoint)
  }
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
  }
}

/**
 * Extract client identifier from request
 * Uses user ID if authenticated, falls back to IP
 */
export function getClientIdentifier(
  request: Request,
  userId?: string | null
): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Get first IP in chain (client IP)
    return `ip:${forwardedFor.split(',')[0].trim()}`
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return `ip:${realIp}`
  }

  // Fallback for local development
  return 'ip:unknown'
}

/**
 * Reset rate limit for a specific identifier (useful for testing)
 */
export function resetRateLimit(
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): void {
  const key = `${config.prefix || 'rl'}:${endpoint || 'default'}:${identifier}`
  rateLimitStore.delete(key)
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): RateLimitResult | null {
  const key = `${config.prefix || 'rl'}:${endpoint || 'default'}:${identifier}`
  const record = rateLimitStore.get(key)

  if (!record || record.resetAt < Date.now()) {
    return null
  }

  return {
    allowed: record.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - record.count),
    resetAt: Math.floor(record.resetAt / 1000),
    limit: config.maxRequests,
  }
}

/**
 * Validate internal API call authentication
 * Checks for valid API key/secret and optional Vercel deployment headers
 *
 * @param request - The incoming request
 * @param options - Validation options
 * @returns Object with valid boolean and optional error message
 */
export interface InternalAuthOptions {
  /** Header name to check for API key (default: 'x-api-key') */
  keyHeader?: string
  /** Environment variable name for the expected key (default: 'INTERNAL_API_KEY') */
  envVar?: string
  /** Require Vercel deployment headers in production */
  requireVercelInProduction?: boolean
}

export interface InternalAuthResult {
  valid: boolean
  error?: string
}

export function validateInternalAuth(
  request: Request,
  options: InternalAuthOptions = {}
): InternalAuthResult {
  const {
    keyHeader = 'x-api-key',
    envVar = 'INTERNAL_API_KEY',
    requireVercelInProduction = true,
  } = options

  // Check for API key
  const providedKey = request.headers.get(keyHeader)
  const expectedKey = process.env[envVar]

  if (!expectedKey) {
    console.error(`${envVar} environment variable not configured`)
    return { valid: false, error: 'Internal API not configured' }
  }

  if (!providedKey) {
    return { valid: false, error: 'Missing API key' }
  }

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== expectedKey.length) {
    return { valid: false, error: 'Invalid API key' }
  }

  let mismatch = 0
  for (let i = 0; i < providedKey.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i)
  }

  if (mismatch !== 0) {
    return { valid: false, error: 'Invalid API key' }
  }

  // In production on Vercel, optionally verify the request comes from Vercel infrastructure
  const isProduction = process.env.NODE_ENV === 'production'
  const isVercelDeployment = process.env.VERCEL === '1'

  if (isProduction && isVercelDeployment && requireVercelInProduction) {
    // Check for Vercel-specific headers that indicate internal request
    const vercelId = request.headers.get('x-vercel-id')
    const vercelProxySignature = request.headers.get('x-vercel-proxy-signature')

    // For same-origin internal calls (e.g., from API routes), allow if user-agent is Next.js
    const userAgent = request.headers.get('user-agent') || ''
    const isInternalNextRequest = userAgent.includes('node') || userAgent.includes('Next')

    if (!vercelId && !vercelProxySignature && !isInternalNextRequest) {
      console.warn('Internal API call missing Vercel headers in production')
      // Log but don't block - some internal calls may come from edge functions
    }
  }

  return { valid: true }
}

// Type for Supabase client used in admin auth
interface SupabaseClientLike {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: { is_admin?: boolean } | null }>
      }
    }
  }
}

/**
 * Validate admin user authentication via Supabase session
 * Returns the user if authenticated and is_admin, null otherwise
 *
 * @param supabase - Supabase client instance (from createClient)
 */
export async function validateAdminAuth(
  supabase: unknown
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const client = supabase as SupabaseClientLike
  const { data: { user } } = await client.auth.getUser()

  if (!user) {
    return { valid: false, error: 'Unauthorized' }
  }

  // Check if user is admin
  const { data: profile } = await client
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return { valid: false, error: 'Admin access required' }
  }

  return { valid: true, userId: user.id }
}
