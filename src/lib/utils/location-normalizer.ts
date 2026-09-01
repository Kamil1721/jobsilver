/**
 * Location normalization utilities
 * Handles case, special characters, and common city name variants
 */

// Common city name mappings (local name → English/standard name)
const CITY_ALIASES: Record<string, string> = {
  // Poland
  'krakow': 'Krakow',
  'kraków': 'Krakow',
  'cracow': 'Krakow',
  'warszawa': 'Warsaw',
  'warsaw': 'Warsaw',
  'wroclaw': 'Wroclaw',
  'wrocław': 'Wroclaw',
  'lodz': 'Lodz',
  'łódź': 'Lodz',
  'gdansk': 'Gdansk',
  'gdańsk': 'Gdansk',
  'poznan': 'Poznan',
  'poznań': 'Poznan',
  'katowice': 'Katowice',
  'szczecin': 'Szczecin',
  'bydgoszcz': 'Bydgoszcz',
  'lublin': 'Lublin',

  // Germany
  'munchen': 'Munich',
  'münchen': 'Munich',
  'munich': 'Munich',
  'koln': 'Cologne',
  'köln': 'Cologne',
  'cologne': 'Cologne',
  'frankfurt': 'Frankfurt',
  'berlin': 'Berlin',
  'hamburg': 'Hamburg',
  'dusseldorf': 'Dusseldorf',
  'düsseldorf': 'Dusseldorf',
  'nurnberg': 'Nuremberg',
  'nürnberg': 'Nuremberg',
  'nuremberg': 'Nuremberg',

  // UK
  'london': 'London',
  'manchester': 'Manchester',
  'birmingham': 'Birmingham',
  'edinburgh': 'Edinburgh',
  'glasgow': 'Glasgow',
  'leeds': 'Leeds',
  'liverpool': 'Liverpool',
  'bristol': 'Bristol',

  // USA
  'new york': 'New York',
  'nyc': 'New York',
  'los angeles': 'Los Angeles',
  'la': 'Los Angeles',
  'san francisco': 'San Francisco',
  'sf': 'San Francisco',
  'chicago': 'Chicago',
  'seattle': 'Seattle',
  'boston': 'Boston',
  'austin': 'Austin',
  'denver': 'Denver',

  // Netherlands
  'amsterdam': 'Amsterdam',
  'den haag': 'The Hague',
  'the hague': 'The Hague',
  'rotterdam': 'Rotterdam',

  // Spain
  'barcelona': 'Barcelona',
  'madrid': 'Madrid',

  // France
  'paris': 'Paris',
  'lyon': 'Lyon',
  'marseille': 'Marseille',

  // Italy
  'milano': 'Milan',
  'milan': 'Milan',
  'roma': 'Rome',
  'rome': 'Rome',

  // Czech Republic
  'praha': 'Prague',
  'prague': 'Prague',
  'brno': 'Brno',

  // Other European
  'wien': 'Vienna',
  'vienna': 'Vienna',
  'lisboa': 'Lisbon',
  'lisbon': 'Lisbon',
  'kobenhavn': 'Copenhagen',
  'copenhagen': 'Copenhagen',
  'stockholm': 'Stockholm',
  'oslo': 'Oslo',
  'helsinki': 'Helsinki',
  'dublin': 'Dublin',
  'brussels': 'Brussels',
  'bruxelles': 'Brussels',
  'zurich': 'Zurich',
  'zürich': 'Zurich',
  'geneva': 'Geneva',
  'geneve': 'Geneva',
  'genève': 'Geneva',
}

// Country name normalization
const COUNTRY_ALIASES: Record<string, string> = {
  'usa': 'United States',
  'us': 'United States',
  'united states of america': 'United States',
  'uk': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'deutschland': 'Germany',
  'polska': 'Poland',
  'nederland': 'Netherlands',
  'holland': 'Netherlands',
  'espana': 'Spain',
  'españa': 'Spain',
  'italia': 'Italy',
  'france': 'France',
  'schweiz': 'Switzerland',
  'suisse': 'Switzerland',
  'österreich': 'Austria',
  'osterreich': 'Austria',
  'cesko': 'Czech Republic',
  'czechia': 'Czech Republic',
  'sverige': 'Sweden',
  'norge': 'Norway',
  'suomi': 'Finland',
  'danmark': 'Denmark',
  'ireland': 'Ireland',
  'eire': 'Ireland',
  'belgique': 'Belgium',
  'belgie': 'Belgium',
  'portugal': 'Portugal',
}

/**
 * Convert string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Normalize a city name
 * - Handles case
 * - Converts special characters to ASCII equivalents
 * - Maps common aliases to standard names
 */
export function normalizeCity(city: string): string {
  if (!city) return ''

  const trimmed = city.trim()
  const lower = trimmed.toLowerCase()

  // Check for known alias
  if (CITY_ALIASES[lower]) {
    return CITY_ALIASES[lower]
  }

  // Otherwise, just title case it
  return toTitleCase(trimmed)
}

/**
 * Normalize a country name
 */
export function normalizeCountry(country: string): string {
  if (!country) return ''

  const trimmed = country.trim()
  const lower = trimmed.toLowerCase()

  // Check for known alias
  if (COUNTRY_ALIASES[lower]) {
    return COUNTRY_ALIASES[lower]
  }

  // Otherwise, just title case it
  return toTitleCase(trimmed)
}

/**
 * Normalize a full location string (e.g., "krakow, poland" → "Krakow, Poland")
 */
export function normalizeLocation(location: string): string {
  if (!location) return ''

  const parts = location.split(',').map(p => p.trim())

  if (parts.length === 2) {
    // Assume "City, Country" format
    const city = normalizeCity(parts[0])
    const country = normalizeCountry(parts[1])
    return `${city}, ${country}`
  } else if (parts.length === 1) {
    // Could be just a city or country
    // Try city first, then country
    const normalized = normalizeCity(parts[0]) || normalizeCountry(parts[0])
    return normalized || toTitleCase(parts[0])
  }

  // For other formats, just title case each part
  return parts.map(p => toTitleCase(p)).join(', ')
}

/**
 * Get search variants for a city (for job search matching)
 * Returns array of strings to search for
 */
export function getCitySearchVariants(city: string): string[] {
  const normalized = normalizeCity(city)
  const variants = new Set<string>([normalized])

  // Add the original if different
  if (city.trim() !== normalized) {
    variants.add(city.trim())
  }

  // Find all aliases that map to this normalized city
  for (const [alias, standard] of Object.entries(CITY_ALIASES)) {
    if (standard === normalized) {
      variants.add(toTitleCase(alias))
    }
  }

  return Array.from(variants)
}
