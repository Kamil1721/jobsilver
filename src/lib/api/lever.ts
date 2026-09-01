/**
 * Lever Postings API Client
 *
 * Public API for accessing jobs from Lever job boards.
 * Docs: https://github.com/lever/postings-api
 *
 * Key benefits:
 * - Direct URLs to real application forms
 * - Full job descriptions from API
 * - Structured job data with categories, locations, etc.
 * - No authentication required - public API
 */

import { formatDescription } from '@/lib/utils/format-description'
import type { Job, ScrapedQuestion } from '@/lib/supabase/types'

const LEVER_API = 'https://api.lever.co/v0/postings'

// =============================================================================
// TYPES - Lever API Response Types
// =============================================================================

export interface LeverCategory {
  commitment?: string // Full-time, Part-time, etc.
  department?: string
  location?: string
  team?: string
}

export interface LeverList {
  text: string
  content: string // HTML content
}

export interface LeverPosting {
  id: string
  text: string // Job title
  hostedUrl: string // Apply URL (hosted by Lever)
  applyUrl: string // Direct apply URL
  createdAt: number // Unix timestamp ms
  updatedAt?: number
  categories: LeverCategory
  description?: string // Plain text description
  descriptionPlain?: string
  lists: LeverList[] // Responsibilities, Requirements, etc.
  additional?: string // Additional info
  additionalPlain?: string
  workplaceType?: 'on-site' | 'remote' | 'hybrid' | 'unspecified'
  salaryDescription?: string
  salaryDescriptionHtml?: string
  salaryRange?: {
    currency: string
    interval: 'per-year-salary' | 'per-hour-wage'
    min: number
    max: number
  }
}

export interface LeverApplicationForm {
  id: string
  fields: LeverFormField[]
  customQuestions?: LeverCustomQuestion[]
}

export interface LeverFormField {
  id: string
  type: string
  text: string
  required: boolean
}

export interface LeverCustomQuestion {
  id: string
  type: 'text' | 'textarea' | 'dropdown' | 'multiple-choice' | 'file'
  text: string
  required: boolean
  options?: string[]
  description?: string
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch all postings from a company's Lever job board
 * @param company - The company's Lever slug (URL identifier)
 * @param mode - Response mode: 'json' (default) or 'html'
 */
export async function fetchLeverPostings(
  company: string,
  mode: 'json' | 'html' = 'json'
): Promise<LeverPosting[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const url = new URL(`${LEVER_API}/${company}`)
    url.searchParams.set('mode', mode)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`Lever company not found: ${company}`)
        return []
      }
      throw new Error(`Lever API error: ${res.status}`)
    }

    const data = await res.json()
    return data || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Lever API timeout for company: ${company}`)
    }
    throw error
  }
}

/**
 * Get a specific posting by ID
 * @param company - The company's Lever slug
 * @param postingId - The posting ID
 */
export async function getLeverPosting(
  company: string,
  postingId: string
): Promise<LeverPosting | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(`${LEVER_API}/${company}/${postingId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 404) {
        return null
      }
      throw new Error(`Lever API error: ${res.status}`)
    }

    return await res.json()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Lever posting timeout: ${company}/${postingId}`)
    }
    throw error
  }
}

/**
 * Fetch postings grouped by department/team
 * Useful for displaying a company's entire job board
 */
export async function fetchLeverPostingsByGroup(
  company: string,
  groupBy: 'department' | 'team' | 'location' = 'department'
): Promise<Record<string, LeverPosting[]>> {
  const postings = await fetchLeverPostings(company)

  const grouped: Record<string, LeverPosting[]> = {}

  for (const posting of postings) {
    let key: string

    switch (groupBy) {
      case 'department':
        key = posting.categories.department || 'Other'
        break
      case 'team':
        key = posting.categories.team || 'Other'
        break
      case 'location':
        key = posting.categories.location || 'Other'
        break
    }

    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(posting)
  }

  return grouped
}

// =============================================================================
// MAPPING FUNCTIONS
// =============================================================================

/**
 * Determine remote type from Lever posting
 */
function detectRemoteType(posting: LeverPosting): 'fully_remote' | 'hybrid' | 'onsite' {
  // Use Lever's explicit workplaceType if available
  if (posting.workplaceType) {
    switch (posting.workplaceType) {
      case 'remote':
        return 'fully_remote'
      case 'hybrid':
        return 'hybrid'
      case 'on-site':
        return 'onsite'
    }
  }

  // Fall back to location analysis
  const location = (posting.categories.location || '').toLowerCase()
  const title = posting.text.toLowerCase()
  const description = (posting.descriptionPlain || posting.description || '').toLowerCase()
  const text = `${location} ${title} ${description}`

  const remotePatterns = [
    /\bremote\b/i,
    /work from anywhere/i,
    /fully distributed/i,
  ]

  const hybridPatterns = [
    /hybrid/i,
    /\d+\s*days?\s*(in|at)\s*(the\s+)?office/i,
  ]

  const isRemote = remotePatterns.some(p => p.test(text))
  const isHybrid = hybridPatterns.some(p => p.test(text))

  if (isHybrid) return 'hybrid'
  if (isRemote) return 'fully_remote'
  return 'onsite'
}

/**
 * Build full description from Lever posting's lists
 */
function buildDescription(posting: LeverPosting): string {
  const parts: string[] = []

  // Main description
  if (posting.descriptionPlain) {
    parts.push(posting.descriptionPlain)
  } else if (posting.description) {
    parts.push(formatDescription(posting.description))
  }

  // Lists (Responsibilities, Requirements, etc.)
  for (const list of posting.lists || []) {
    if (list.text && list.content) {
      parts.push(`\n${list.text}:\n${formatDescription(list.content)}`)
    }
  }

  // Additional info
  if (posting.additionalPlain) {
    parts.push(`\n${posting.additionalPlain}`)
  } else if (posting.additional) {
    parts.push(`\n${formatDescription(posting.additional)}`)
  }

  return parts.join('\n\n').trim()
}

/**
 * Parse salary from Lever posting
 */
function parseSalary(posting: LeverPosting): {
  min: number | null
  max: number | null
  currency: string | null
} {
  if (posting.salaryRange) {
    // Handle hourly vs annual
    let min = posting.salaryRange.min
    let max = posting.salaryRange.max

    if (posting.salaryRange.interval === 'per-hour-wage') {
      // Convert hourly to annual (assume 2080 hours/year)
      min = min * 2080
      max = max * 2080
    }

    return {
      min,
      max,
      currency: posting.salaryRange.currency || 'USD',
    }
  }

  return { min: null, max: null, currency: null }
}

/**
 * Map job type from Lever commitment
 */
function mapJobType(commitment?: string): string {
  if (!commitment) return 'FULLTIME'

  const lower = commitment.toLowerCase()
  if (lower.includes('full')) return 'FULLTIME'
  if (lower.includes('part')) return 'PARTTIME'
  if (lower.includes('contract') || lower.includes('freelance')) return 'CONTRACTOR'
  if (lower.includes('intern')) return 'INTERN'

  return 'FULLTIME'
}

/**
 * Map a Lever posting to our unified Job format
 */
export function mapLeverPostingToJob(
  posting: LeverPosting,
  userId: string,
  companyName: string,
  companySlug: string
): Partial<Job> {
  const salary = parseSalary(posting)
  const remoteType = detectRemoteType(posting)

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: `lever_${companySlug}_${posting.id}`,
    source: 'lever',
    title: posting.text,
    company: companyName,
    company_logo_url: null,
    location: posting.categories.location || 'Not specified',
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    job_type: mapJobType(posting.categories.commitment),
    remote: remoteType !== 'onsite',
    remote_type: remoteType,
    industry_category: posting.categories.department || null,
    description: buildDescription(posting),
    application_url: posting.hostedUrl || posting.applyUrl,
    status: 'discovered' as const,
    job_posted_at: new Date(posting.createdAt).toISOString(),
    created_at: new Date().toISOString(),
    platform_detected: 'lever',
    // Store ATS-specific data
    ats_source: 'lever',
    ats_job_id: posting.id,
  } as Partial<Job> & { ats_source: string; ats_job_id: string }
}

/**
 * Generate standard Lever form questions
 * Lever has a consistent form structure across all postings
 */
export function generateLeverQuestions(): ScrapedQuestion[] {
  return [
    {
      id: 'lever_name',
      label: 'Full name',
      type: 'text',
      required: true,
      selector: 'input[name="name"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'lever_email',
      label: 'Email',
      type: 'email',
      required: true,
      selector: 'input[name="email"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'lever_phone',
      label: 'Phone',
      type: 'phone',
      required: false,
      selector: 'input[name="phone"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'lever_org',
      label: 'Current company',
      type: 'text',
      required: false,
      selector: 'input[name="org"]',
      page: 1,
      section: 'basic',
    },
    {
      id: 'lever_resume',
      label: 'Resume/CV',
      type: 'file',
      required: true,
      selector: 'input[type="file"][name="resume"]',
      page: 1,
      section: 'documents',
    },
    {
      id: 'lever_urls_linkedin',
      label: 'LinkedIn URL',
      type: 'url',
      required: false,
      selector: 'input[name="urls[LinkedIn]"]',
      page: 1,
      section: 'links',
    },
    {
      id: 'lever_urls_github',
      label: 'GitHub URL',
      type: 'url',
      required: false,
      selector: 'input[name="urls[GitHub]"]',
      page: 1,
      section: 'links',
    },
    {
      id: 'lever_urls_portfolio',
      label: 'Portfolio URL',
      type: 'url',
      required: false,
      selector: 'input[name="urls[Portfolio]"]',
      page: 1,
      section: 'links',
    },
    {
      id: 'lever_comments',
      label: 'Additional information',
      type: 'textarea',
      required: false,
      selector: 'textarea[name="comments"]',
      page: 1,
      section: 'additional',
    },
  ]
}

/**
 * Search jobs across multiple Lever companies
 */
export async function searchLeverJobs(
  companies: Array<{ slug: string; name: string }>,
  userId: string,
  options: {
    query?: string
    limit?: number
  } = {}
): Promise<Array<Partial<Job> & { questions?: ScrapedQuestion[] }>> {
  const { query, limit = 100 } = options
  const queryLower = query?.toLowerCase()

  // Fetch postings from all companies in parallel
  const companyResults = await Promise.allSettled(
    companies.map(async (company) => {
      const postings = await fetchLeverPostings(company.slug)
      return { company, postings }
    })
  )

  const allJobs: Array<Partial<Job> & { questions?: ScrapedQuestion[] }> = []

  for (const result of companyResults) {
    if (result.status === 'fulfilled') {
      const { company, postings } = result.value

      for (const posting of postings) {
        // Optional: filter by query if provided
        if (queryLower) {
          const titleMatch = posting.text.toLowerCase().includes(queryLower)
          const descMatch = (posting.descriptionPlain || posting.description || '').toLowerCase().includes(queryLower)
          if (!titleMatch && !descMatch) {
            continue
          }
        }

        // Map to our format
        const mappedJob = mapLeverPostingToJob(posting, userId, company.name, company.slug)

        // Add standard Lever questions
        const questions = generateLeverQuestions()
        allJobs.push({ ...mappedJob, questions })

        // Check limit
        if (allJobs.length >= limit) {
          break
        }
      }
    } else {
      console.error(`Failed to fetch Lever postings for company:`, result.reason)
    }

    if (allJobs.length >= limit) {
      break
    }
  }

  return allJobs.slice(0, limit)
}

/**
 * Extract company slug and posting ID from a Lever URL
 * Supports:
 * - jobs.lever.co/{company}/{id}
 * - {company}.lever.co/{id}
 */
export function parseLeverUrl(url: string): { companySlug: string; postingId: string } | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const pathname = urlObj.pathname

    // jobs.lever.co/{company}/{id}
    if (hostname === 'jobs.lever.co') {
      const match = pathname.match(/^\/([^/]+)\/([a-f0-9-]+)/)
      if (match) {
        return { companySlug: match[1], postingId: match[2] }
      }
    }

    // {company}.lever.co/{id}
    if (hostname.endsWith('.lever.co')) {
      const companySlug = hostname.replace('.lever.co', '')
      const match = pathname.match(/^\/([a-f0-9-]+)/)
      if (match) {
        return { companySlug, postingId: match[1] }
      }
    }

    return null
  } catch {
    return null
  }
}

export const SOURCE_NAME = 'lever'
