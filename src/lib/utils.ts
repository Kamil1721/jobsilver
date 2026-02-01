import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  'USD': '$',
  'GBP': '£',
  'EUR': '€',
  'PLN': 'zł',
  'AUD': 'A$',
  'CAD': 'C$',
  'NZD': 'NZ$',
  'INR': '₹',
  'BRL': 'R$',
  'ZAR': 'R',
  'CHF': 'CHF',
}

/**
 * Get the currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: string | null): string {
  if (!currency) return '$'
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency
}

/**
 * Format a salary value with the appropriate currency symbol
 */
export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  options?: { abbreviated?: boolean }
): string | null {
  if (!min && !max) return null

  const symbol = getCurrencySymbol(currency)
  const abbreviated = options?.abbreviated ?? false

  const formatValue = (value: number) => {
    if (abbreviated) {
      return `${symbol}${(value / 1000).toFixed(0)}K`
    }
    return `${symbol}${value.toLocaleString()}`
  }

  if (min && max) {
    return `${formatValue(min)} - ${formatValue(max)}`
  } else if (min) {
    return `From ${formatValue(min)}`
  } else if (max) {
    return `Up to ${formatValue(max)}`
  }

  return null
}
