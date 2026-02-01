/**
 * Timezone mapping utilities for job filtering
 * Maps countries to timezone ranges for filtering jobs based on user preferences
 */

// Map countries to timezone ranges (matching UI values from step-job-filters.tsx)
export const COUNTRY_TIMEZONE_MAP: Record<string, string[]> = {
  // UTC-12:00 to UTC-8:00 (Pacific)
  'United States': ['UTC-12:00 to UTC-8:00 (Pacific)', 'UTC-7:00 to UTC-5:00 (Americas)'],
  'Canada': ['UTC-12:00 to UTC-8:00 (Pacific)', 'UTC-7:00 to UTC-5:00 (Americas)', 'UTC-4:00 to UTC-1:00 (Atlantic)'],

  // UTC-7:00 to UTC-5:00 (Americas)
  'Mexico': ['UTC-7:00 to UTC-5:00 (Americas)'],
  'Colombia': ['UTC-7:00 to UTC-5:00 (Americas)'],
  'Peru': ['UTC-7:00 to UTC-5:00 (Americas)'],
  'Chile': ['UTC-7:00 to UTC-5:00 (Americas)'],

  // UTC-4:00 to UTC-1:00 (Atlantic)
  'Brazil': ['UTC-4:00 to UTC-1:00 (Atlantic)'],
  'Argentina': ['UTC-4:00 to UTC-1:00 (Atlantic)'],

  // UTC+0:00 to UTC+3:00 (Europe/Africa)
  'United Kingdom': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'UK': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Ireland': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Germany': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'France': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Spain': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Italy': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Netherlands': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Belgium': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Poland': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Sweden': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Norway': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Denmark': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Finland': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Switzerland': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Austria': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Portugal': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Czech Republic': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Czechia': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Romania': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Greece': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Hungary': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'South Africa': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Nigeria': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Kenya': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],
  'Egypt': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],

  // UTC+4:00 to UTC+6:00 (Middle East/Central Asia)
  'UAE': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'United Arab Emirates': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'Saudi Arabia': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'India': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'Pakistan': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'Bangladesh': ['UTC+4:00 to UTC+6:00 (Middle East/Asia)'],
  'Israel': ['UTC+0:00 to UTC+3:00 (Europe/Africa)'],

  // UTC+7:00 to UTC+9:00 (East Asia)
  'Singapore': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Japan': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'South Korea': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Korea': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'China': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Hong Kong': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Taiwan': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Thailand': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Vietnam': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Malaysia': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Indonesia': ['UTC+7:00 to UTC+9:00 (East Asia)'],
  'Philippines': ['UTC+7:00 to UTC+9:00 (East Asia)'],

  // UTC+10:00 to UTC+12:00 (Oceania)
  'Australia': ['UTC+10:00 to UTC+12:00 (Oceania)'],
  'New Zealand': ['UTC+10:00 to UTC+12:00 (Oceania)'],
}

/**
 * Get timezone ranges for a list of countries
 */
export function getJobTimezones(countries: string[]): string[] {
  const timezones = new Set<string>()

  for (const country of countries) {
    // Try exact match first
    let tzs = COUNTRY_TIMEZONE_MAP[country]

    // Try case-insensitive match if no exact match
    if (!tzs) {
      const countryLower = country.toLowerCase()
      for (const [key, value] of Object.entries(COUNTRY_TIMEZONE_MAP)) {
        if (key.toLowerCase() === countryLower) {
          tzs = value
          break
        }
      }
    }

    if (tzs) {
      tzs.forEach(tz => timezones.add(tz))
    }
  }

  return Array.from(timezones)
}

/**
 * Check if job description mentions flexible timezone
 */
export function hasFlexibleTimezone(description: string): boolean {
  const lower = description.toLowerCase()

  const flexiblePatterns = [
    'flexible timezone',
    'flexible time zone',
    'any timezone',
    'any time zone',
    'timezone flexible',
    'time zone flexible',
    'async',
    'asynchronous',
    'work from anywhere',
    'location independent',
    'no timezone restrictions',
    'no time zone restrictions',
    'global team',
    'distributed team',
    'fully distributed',
    'worldwide remote',
    'remote worldwide',
  ]

  return flexiblePatterns.some(pattern => lower.includes(pattern))
}

/**
 * Normalize timezone string for comparison
 * Handles variations like "UTC+0:00 to UTC+3:00" vs "UTC+0:00 to UTC+3:00 (Europe/Africa)"
 */
export function normalizeTimezone(tz: string): string {
  // Extract just the UTC range part (e.g., "UTC+0:00 to UTC+3:00")
  const match = tz.match(/UTC[+-]?\d+:\d+\s+to\s+UTC[+-]?\d+:\d+/i)
  return match ? match[0] : tz
}

/**
 * Check if two timezone strings match (handles partial matches)
 */
export function timezoneMatches(jobTimezone: string, userTimezone: string): boolean {
  const normalizedJob = normalizeTimezone(jobTimezone)
  const normalizedUser = normalizeTimezone(userTimezone)

  return normalizedJob === normalizedUser ||
         jobTimezone.includes(normalizedUser) ||
         userTimezone.includes(normalizedJob)
}
