import type { JobFilters, ScreeningAnswers } from '@/lib/supabase/types'

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Legacy alias for backward compatibility
export type FilterValidationError = ValidationError
export type FilterValidationResult = ValidationResult

/**
 * Validates that mandatory filters are set before allowing job search.
 * Mandatory filters:
 * - Job Titles (1-5 non-empty strings)
 * - Work Location Type (remote OR onsite/hybrid must be selected)
 * - Job Types (at least 1)
 */
export function validateMandatoryFilters(filters: JobFilters | null): FilterValidationResult {
  const errors: FilterValidationError[] = []

  if (!filters) {
    return {
      isValid: false,
      errors: [{ field: 'filters', message: 'No filters configured. Please complete setup.' }]
    }
  }

  // 1. Job Titles - at least one required, max 5, non-empty strings
  const validJobTitles = (filters.job_titles || [])
    .map(t => t.trim())
    .filter(t => t.length > 0)

  if (validJobTitles.length === 0) {
    errors.push({
      field: 'job_titles',
      message: 'At least one job title is required'
    })
  } else if (validJobTitles.length > 5) {
    errors.push({
      field: 'job_titles',
      message: 'Maximum 5 job titles allowed'
    })
  }

  // 2. Work Location Type - at least one must be selected
  // Check both new work_arrangements and legacy fields for backward compatibility
  const hasWorkArrangements = filters.work_arrangements && filters.work_arrangements.length > 0
  const hasLegacyLocation = filters.remote_jobs || filters.onsite_hybrid

  if (!hasWorkArrangements && !hasLegacyLocation) {
    errors.push({
      field: 'work_location',
      message: 'Select at least one work arrangement (On-site, Hybrid, or Remote)'
    })
  }

  // 3. Job Types - at least one required
  if (!filters.job_types || filters.job_types.length === 0) {
    errors.push({
      field: 'job_types',
      message: 'Select at least one job type (Full-time, Part-time, etc.)'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Check if a specific mandatory filter is valid
 */
export function isMandatoryFilterValid(filters: JobFilters | null, field: 'job_titles' | 'work_location' | 'job_types'): boolean {
  if (!filters) return false

  switch (field) {
    case 'job_titles': {
      const validTitles = (filters.job_titles || []).filter(t => t.trim().length > 0)
      return validTitles.length > 0 && validTitles.length <= 5
    }
    case 'work_location': {
      const hasWorkArrangements = filters.work_arrangements && filters.work_arrangements.length > 0
      return hasWorkArrangements || filters.remote_jobs || filters.onsite_hybrid
    }
    case 'job_types':
      return filters.job_types && filters.job_types.length > 0
    default: {
      // TypeScript exhaustive check
      const _exhaustiveCheck: never = field
      return false
    }
  }
}

// =============================================================================
// SCREENING ANSWERS VALIDATION
// =============================================================================

/**
 * Mandatory screening fields required to apply for jobs:
 * - First name
 * - Last name
 * - Country
 * - City
 * - Work authorization (at least 1 country)
 *
 * Note: CV is validated separately in the CV step
 */
export function validateScreeningAnswers(screening: ScreeningAnswers | null): ValidationResult {
  const errors: ValidationError[] = []

  if (!screening) {
    return {
      isValid: false,
      errors: [{ field: 'screening', message: 'Profile not configured. Please complete setup.' }]
    }
  }

  // 1. First name - required
  if (!screening.first_name || screening.first_name.trim().length === 0) {
    errors.push({
      field: 'first_name',
      message: 'First name is required'
    })
  }

  // 2. Last name - required
  if (!screening.last_name || screening.last_name.trim().length === 0) {
    errors.push({
      field: 'last_name',
      message: 'Last name is required'
    })
  }

  // 3. Country - required
  if (!screening.country || screening.country.trim().length === 0) {
    errors.push({
      field: 'country',
      message: 'Country is required'
    })
  }

  // 4. City - required
  if (!screening.city || screening.city.trim().length === 0) {
    errors.push({
      field: 'city',
      message: 'City is required'
    })
  }

  // 5. Work authorization - at least 1 country required
  if (!screening.work_authorization_countries || screening.work_authorization_countries.length === 0) {
    errors.push({
      field: 'work_authorization_countries',
      message: 'Select at least one country where you are authorized to work'
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Check if a specific mandatory screening field is valid
 */
export function isMandatoryScreeningFieldValid(
  screening: ScreeningAnswers | null,
  field: 'first_name' | 'last_name' | 'country' | 'city' | 'work_authorization_countries'
): boolean {
  if (!screening) return false

  switch (field) {
    case 'first_name':
      return !!screening.first_name && screening.first_name.trim().length > 0
    case 'last_name':
      return !!screening.last_name && screening.last_name.trim().length > 0
    case 'country':
      return !!screening.country && screening.country.trim().length > 0
    case 'city':
      return !!screening.city && screening.city.trim().length > 0
    case 'work_authorization_countries':
      return !!screening.work_authorization_countries && screening.work_authorization_countries.length > 0
    default: {
      const _exhaustiveCheck: never = field
      return false
    }
  }
}

/**
 * Get list of missing mandatory screening fields (for UI hints)
 */
export function getMissingScreeningFields(screening: ScreeningAnswers | null): string[] {
  const missing: string[] = []

  if (!screening) {
    return ['First Name', 'Last Name', 'Country', 'City', 'Work Authorization']
  }

  if (!isMandatoryScreeningFieldValid(screening, 'first_name')) {
    missing.push('First Name')
  }
  if (!isMandatoryScreeningFieldValid(screening, 'last_name')) {
    missing.push('Last Name')
  }
  if (!isMandatoryScreeningFieldValid(screening, 'country')) {
    missing.push('Country')
  }
  if (!isMandatoryScreeningFieldValid(screening, 'city')) {
    missing.push('City')
  }
  if (!isMandatoryScreeningFieldValid(screening, 'work_authorization_countries')) {
    missing.push('Work Authorization')
  }

  return missing
}
