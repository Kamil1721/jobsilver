import { createHash } from 'node:crypto'

import type { AtsPlatform } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Classify a job URL by its ATS platform. Returns 'other' for unparseable URLs. */
export function detectAts(url: string): AtsPlatform {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'other'
  }

  const host = parsed.hostname.toLowerCase()
  if (host.includes('greenhouse.io')) return 'greenhouse'
  if (host.includes('lever.co')) return 'lever'
  if (host.includes('ashbyhq.com')) return 'ashby'
  return 'other'
}

/**
 * Parse a Greenhouse job URL into its board token and job id.
 * Expected path shape: /{boardToken}/jobs/{jobId}
 */
export function parseGreenhouseUrl(url: string): { boardToken: string; jobId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  // Path segments, ignoring empty entries from leading/trailing slashes.
  const segments = parsed.pathname.split('/').filter(Boolean)
  const jobsIndex = segments.indexOf('jobs')

  if (jobsIndex < 1 || jobsIndex + 1 >= segments.length) {
    return null
  }

  const boardToken = segments[jobsIndex - 1]
  const jobId = segments[jobsIndex + 1]

  if (!boardToken || !jobId) {
    return null
  }

  return { boardToken, jobId }
}

/**
 * Parse a Lever job URL into its site and posting id.
 * Expected path shape: /{site}/{postingId} where postingId is a UUID.
 */
export function parseLeverUrl(url: string): { site: string; postingId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const site = segments[0]
  const postingId = segments[1]

  if (!site || !UUID_RE.test(postingId)) {
    return null
  }

  return { site, postingId }
}

/**
 * Parse an Ashby job URL into its job board name and job posting id.
 * Expected path shape: /{jobBoardName}/{jobPostingId} where jobPostingId is a UUID.
 */
export function parseAshbyUrl(url: string): { jobBoardName: string; jobPostingId: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return null
  }

  const jobBoardName = segments[0]
  const jobPostingId = segments[1]

  if (!jobBoardName || !UUID_RE.test(jobPostingId)) {
    return null
  }

  return { jobBoardName, jobPostingId }
}

/**
 * Normalize a posting URL (lowercase host, strip query/hash and trailing
 * path slash) and return a SHA-256 hex digest. The same posting URL with or
 * without a query string yields the same key.
 */
export function computePostingKey(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Fall back to hashing the raw string for unparseable input.
    return createHash('sha256').update(url).digest('hex')
  }

  const host = parsed.hostname.toLowerCase()
  const path = parsed.pathname.replace(/\/+$/, '')
  const normalized = `${parsed.protocol}//${host}${path}`

  return createHash('sha256').update(normalized).digest('hex')
}
