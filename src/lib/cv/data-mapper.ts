/**
 * CV Data Mapper
 * Maps ParsedCV format (from cv_parsed_data after CV upload) to ScreeningAnswers format
 * for use in CV generation.
 */

import type { ScreeningAnswers } from '@/lib/supabase/types'

// ParsedCV format from cv-parser.ts (stored in cv_parsed_data)
export interface ParsedCV {
  skills: string[]
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    degree: string
    institution: string
    year: string
  }[]
  summary: string
  contact: {
    name: string
    email: string
    phone: string
    location: string
  }
}

export interface MappingResult {
  screeningAnswers: Partial<ScreeningAnswers>
  isComplete: boolean
  missingFields: string[]
}

/**
 * Parse duration strings like "Jan 2020 - Present" to start/end dates in YYYY-MM format
 */
function parseDuration(duration: string): { start_date: string; end_date: string | null } {
  // Default to current year if parsing fails
  const currentYear = new Date().getFullYear()
  const fallback = { start_date: `${currentYear}-01`, end_date: null }

  if (!duration) return fallback

  // Match patterns like "Jan 2020 - Present", "January 2020 - December 2023", "2020 - 2023"
  const months: Record<string, string> = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09', 'sept': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12',
  }

  // Split by common separators
  const parts = duration.toLowerCase().split(/\s*[-–—to]\s*/)

  if (parts.length < 1) return fallback

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr) return null

    // Check for "present", "current", "now"
    if (/present|current|now|ongoing/i.test(dateStr)) {
      return null
    }

    // Try to extract month and year
    const monthMatch = dateStr.match(/([a-z]+)/i)
    const yearMatch = dateStr.match(/(\d{4})/)

    if (yearMatch) {
      const year = yearMatch[1]
      if (monthMatch) {
        const monthKey = monthMatch[1].toLowerCase()
        const month = months[monthKey] || '01'
        return `${year}-${month}`
      }
      return `${year}-01`
    }

    return null
  }

  const startDate = parseDate(parts[0]) || `${currentYear}-01`
  const endDate = parts.length > 1 ? parseDate(parts[1]) : null

  return { start_date: startDate, end_date: endDate }
}

/**
 * Split full name into first and last name
 */
function splitName(fullName: string): { first_name: string; last_name: string } {
  if (!fullName) return { first_name: '', last_name: '' }

  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '' }
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  }
}

/**
 * Convert description paragraph to bullet point highlights
 */
function descriptionToHighlights(description: string): string[] {
  if (!description) return []

  // If it already contains bullet points or newlines, split on those
  if (description.includes('\n') || description.includes('•') || description.includes('-')) {
    return description
      .split(/[\n•\-]/)
      .map(s => s.trim())
      .filter(s => s.length > 10) // Filter out very short fragments
      .slice(0, 4) // Max 4 highlights
  }

  // Otherwise, try to split on sentence boundaries
  const sentences = description
    .split(/[.;]/)
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .slice(0, 4)

  return sentences.length > 0 ? sentences : [description.trim()].filter(Boolean)
}

/**
 * Parse phone number into country code and number
 */
function parsePhone(phone: string): { phone_country_code: string; phone_number: string } {
  if (!phone) return { phone_country_code: '+1', phone_number: '' }

  // Clean up the phone number
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Check for country code
  if (cleaned.startsWith('+')) {
    // Try to extract country code (1-3 digits after +)
    const match = cleaned.match(/^\+(\d{1,3})(.*)$/)
    if (match) {
      return {
        phone_country_code: `+${match[1]}`,
        phone_number: match[2],
      }
    }
  }

  // Default to US if no country code
  return { phone_country_code: '+1', phone_number: cleaned }
}

/**
 * Parse location string into city and country
 */
function parseLocation(location: string): { city: string; country: string } {
  if (!location) return { city: '', country: '' }

  // Common patterns: "City, State, Country", "City, Country", "City"
  const parts = location.split(',').map(p => p.trim())

  if (parts.length >= 2) {
    return {
      city: parts[0],
      country: parts[parts.length - 1],
    }
  }

  return { city: parts[0] || '', country: '' }
}

/**
 * Map ParsedCV to ScreeningAnswers format
 */
export function mapParsedCVToScreeningAnswers(parsedCV: ParsedCV): MappingResult {
  const missingFields: string[] = []

  // Map contact info
  const { first_name, last_name } = splitName(parsedCV.contact?.name || '')
  const { phone_country_code, phone_number } = parsePhone(parsedCV.contact?.phone || '')
  const { city, country } = parseLocation(parsedCV.contact?.location || '')

  // Validate required fields
  if (!first_name) missingFields.push('first_name')
  if (!last_name) missingFields.push('last_name')

  // Map work history
  const work_history = (parsedCV.experience || []).map(exp => {
    const { start_date, end_date } = parseDuration(exp.duration)
    return {
      company: exp.company || '',
      position: exp.title || '',
      start_date,
      end_date,
      location: '', // ParsedCV doesn't have work location per entry
      highlights: descriptionToHighlights(exp.description),
    }
  })

  if (work_history.length === 0 || !work_history.some(w => w.company && w.position && w.start_date)) {
    missingFields.push('work_history')
  }

  // Map education
  const education = (parsedCV.education || []).map(edu => ({
    institution: edu.institution || '',
    degree: edu.degree || '',
    area: '', // ParsedCV doesn't have field of study, we'll try to extract from degree
    graduation_year: edu.year || '',
    location: '',
    highlights: [] as string[],
  }))

  // Try to extract area from degree (e.g., "Bachelor of Science in Computer Science")
  education.forEach(edu => {
    const match = edu.degree.match(/in\s+(.+)$/i)
    if (match) {
      edu.area = match[1].trim()
      edu.degree = edu.degree.replace(/\s+in\s+.+$/i, '').trim()
    }
  })

  if (education.length === 0 || !education.some(e => e.institution && e.degree && e.graduation_year)) {
    missingFields.push('education')
  }

  const screeningAnswers: Partial<ScreeningAnswers> = {
    first_name,
    last_name,
    phone_country_code,
    phone_number,
    city,
    country,
    experience_summary: parsedCV.summary || '',
    work_history,
    education,
    skills: parsedCV.skills || [],
  }

  return {
    screeningAnswers,
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Check if parsed CV data has enough information for quick generation
 */
export function hasEnoughDataForQuickGenerate(parsedCV: ParsedCV | null): boolean {
  if (!parsedCV) return false

  // Need at least one work experience with company, title, and duration
  const hasWork = (parsedCV.experience || []).some(
    exp => exp.company && exp.title && exp.duration
  )

  // Need at least one education entry
  const hasEducation = (parsedCV.education || []).some(
    edu => edu.institution && edu.degree && edu.year
  )

  return hasWork && hasEducation
}
