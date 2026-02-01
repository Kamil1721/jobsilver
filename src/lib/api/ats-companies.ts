/**
 * Curated List of Companies Using Greenhouse, Lever, and Ashby
 *
 * This provides direct access to job listings from popular tech companies
 * without relying on aggregators like JSearch.
 *
 * How to find board tokens:
 * - Greenhouse: Visit boards.greenhouse.io/{company} - the URL slug is the token
 * - Lever: Visit jobs.lever.co/{company} - the URL slug is the company ID
 * - Ashby: Visit jobs.ashbyhq.com/{company} - the URL slug is the board name
 */

// =============================================================================
// GREENHOUSE COMPANIES
// =============================================================================

export interface GreenhouseCompany {
  token: string       // URL slug for API calls
  name: string        // Display name
  category?: string   // Industry category
  remote?: boolean    // Whether they typically have remote positions
}

export const GREENHOUSE_BOARDS: GreenhouseCompany[] = [
  // Tech Giants
  { token: 'reddit', name: 'Reddit', category: 'Technology', remote: true },
  { token: 'stripe', name: 'Stripe', category: 'FinTech', remote: true },
  { token: 'airbnb', name: 'Airbnb', category: 'Technology', remote: true },
  { token: 'figma', name: 'Figma', category: 'Technology', remote: true },
  { token: 'notion', name: 'Notion', category: 'Technology', remote: true },
  { token: 'discord', name: 'Discord', category: 'Technology', remote: true },
  { token: 'instacart', name: 'Instacart', category: 'Technology', remote: true },
  { token: 'doordash', name: 'DoorDash', category: 'Technology', remote: true },
  { token: 'coinbase', name: 'Coinbase', category: 'FinTech', remote: true },
  { token: 'plaid', name: 'Plaid', category: 'FinTech', remote: true },

  // Growing Tech Companies
  { token: 'squareup', name: 'Square', category: 'FinTech', remote: true },
  { token: 'datadog', name: 'Datadog', category: 'Technology', remote: true },
  { token: 'cloudflare', name: 'Cloudflare', category: 'Technology', remote: true },
  { token: 'mongodb', name: 'MongoDB', category: 'Technology', remote: true },
  { token: 'hashicorp', name: 'HashiCorp', category: 'Technology', remote: true },
  { token: 'gitlab', name: 'GitLab', category: 'Technology', remote: true },
  { token: 'elastic', name: 'Elastic', category: 'Technology', remote: true },
  { token: 'twilio', name: 'Twilio', category: 'Technology', remote: true },
  { token: 'zoom', name: 'Zoom', category: 'Technology', remote: true },
  { token: 'hubspot', name: 'HubSpot', category: 'Technology', remote: true },

  // Startups & Scale-ups
  { token: 'rippling', name: 'Rippling', category: 'HR Tech', remote: true },
  { token: 'airtable', name: 'Airtable', category: 'Technology', remote: true },
  { token: 'ramp', name: 'Ramp', category: 'FinTech', remote: true },
  { token: 'brex', name: 'Brex', category: 'FinTech', remote: true },
  { token: 'deel', name: 'Deel', category: 'HR Tech', remote: true },
  { token: 'vanta', name: 'Vanta', category: 'Security', remote: true },
  { token: 'anduril', name: 'Anduril', category: 'Defense Tech' },
  { token: 'gusto', name: 'Gusto', category: 'HR Tech', remote: true },
  { token: 'miro', name: 'Miro', category: 'Technology', remote: true },
  { token: 'canva', name: 'Canva', category: 'Technology', remote: true },

  // E-commerce & Retail Tech
  { token: 'shopify', name: 'Shopify', category: 'E-commerce', remote: true },
  { token: 'affirm', name: 'Affirm', category: 'FinTech', remote: true },
  { token: 'klarna', name: 'Klarna', category: 'FinTech', remote: true },

  // Health Tech
  { token: 'tempus', name: 'Tempus', category: 'Health Tech' },
  { token: 'ro', name: 'Ro', category: 'Health Tech', remote: true },
  { token: 'hinge', name: 'Hinge Health', category: 'Health Tech', remote: true },

  // DevTools & Infrastructure
  { token: 'vercel', name: 'Vercel', category: 'Developer Tools', remote: true },
  { token: 'retool', name: 'Retool', category: 'Developer Tools', remote: true },
  { token: 'supabase', name: 'Supabase', category: 'Developer Tools', remote: true },
  { token: 'planetscale', name: 'PlanetScale', category: 'Developer Tools', remote: true },
  { token: 'airbyte', name: 'Airbyte', category: 'Developer Tools', remote: true },

  // AI Companies
  { token: 'openai', name: 'OpenAI', category: 'AI', remote: true },
  { token: 'anthropic', name: 'Anthropic', category: 'AI', remote: true },
  { token: 'cohere', name: 'Cohere', category: 'AI', remote: true },
  { token: 'scale', name: 'Scale AI', category: 'AI', remote: true },
  { token: 'huggingface', name: 'Hugging Face', category: 'AI', remote: true },
  { token: 'midjourney', name: 'Midjourney', category: 'AI', remote: true },
  { token: 'stability', name: 'Stability AI', category: 'AI', remote: true },

  // More Companies
  { token: 'flexport', name: 'Flexport', category: 'Logistics' },
  { token: 'databricks', name: 'Databricks', category: 'Technology', remote: true },
  { token: 'snowflake', name: 'Snowflake', category: 'Technology', remote: true },
  { token: 'asana', name: 'Asana', category: 'Technology', remote: true },
  { token: 'amplitude', name: 'Amplitude', category: 'Technology', remote: true },
]

// =============================================================================
// LEVER COMPANIES
// =============================================================================

export interface LeverCompany {
  slug: string        // URL slug for API calls
  name: string        // Display name
  category?: string   // Industry category
  remote?: boolean    // Whether they typically have remote positions
}

export const LEVER_COMPANIES: LeverCompany[] = [
  // Major Tech
  { slug: 'netflix', name: 'Netflix', category: 'Entertainment', remote: true },
  { slug: 'spotify', name: 'Spotify', category: 'Entertainment', remote: true },
  { slug: 'twitch', name: 'Twitch', category: 'Entertainment', remote: true },
  { slug: 'robinhood', name: 'Robinhood', category: 'FinTech', remote: true },
  { slug: 'lyft', name: 'Lyft', category: 'Transportation', remote: true },

  // Tech Companies
  { slug: 'coursera', name: 'Coursera', category: 'EdTech', remote: true },
  { slug: 'udemy', name: 'Udemy', category: 'EdTech', remote: true },
  { slug: 'dropbox', name: 'Dropbox', category: 'Technology', remote: true },
  { slug: 'pinterest', name: 'Pinterest', category: 'Technology', remote: true },
  { slug: 'yelp', name: 'Yelp', category: 'Technology', remote: true },

  // Fintech
  { slug: 'chime', name: 'Chime', category: 'FinTech', remote: true },
  { slug: 'marqeta', name: 'Marqeta', category: 'FinTech', remote: true },
  { slug: 'mercury', name: 'Mercury', category: 'FinTech', remote: true },
  { slug: 'checkout', name: 'Checkout.com', category: 'FinTech', remote: true },

  // Developer Tools
  { slug: 'postman', name: 'Postman', category: 'Developer Tools', remote: true },
  { slug: 'sentry', name: 'Sentry', category: 'Developer Tools', remote: true },
  { slug: 'grafana', name: 'Grafana Labs', category: 'Developer Tools', remote: true },
  { slug: 'snyk', name: 'Snyk', category: 'Security', remote: true },
  { slug: 'launchdarkly', name: 'LaunchDarkly', category: 'Developer Tools', remote: true },

  // Growing Startups
  { slug: 'notion', name: 'Notion (Lever)', category: 'Technology', remote: true },
  { slug: 'webflow', name: 'Webflow', category: 'Technology', remote: true },
  { slug: 'coda', name: 'Coda', category: 'Technology', remote: true },
  { slug: 'loom', name: 'Loom', category: 'Technology', remote: true },
  { slug: 'zapier', name: 'Zapier', category: 'Technology', remote: true },

  // AI & ML
  { slug: 'replicate', name: 'Replicate', category: 'AI', remote: true },
  { slug: 'deepmind', name: 'DeepMind', category: 'AI', remote: true },

  // More Companies
  { slug: 'flexera', name: 'Flexera', category: 'Technology', remote: true },
  { slug: 'docusign', name: 'DocuSign', category: 'Technology', remote: true },
  { slug: 'okta', name: 'Okta', category: 'Security', remote: true },
  { slug: 'crowdstrike', name: 'CrowdStrike', category: 'Security', remote: true },
]

// =============================================================================
// ASHBY COMPANIES
// =============================================================================

export interface AshbyCompany {
  name: string        // Board name (URL slug) for API calls
  displayName: string // Display name
  category?: string   // Industry category
  remote?: boolean    // Whether they typically have remote positions
}

export const ASHBY_BOARDS: AshbyCompany[] = [
  // FinTech (verified active)
  { name: 'ramp', displayName: 'Ramp', category: 'FinTech', remote: true },

  // DevTools & Infrastructure
  { name: 'linear', displayName: 'Linear', category: 'Developer Tools', remote: true },
  { name: 'vercel', displayName: 'Vercel (Ashby)', category: 'Developer Tools', remote: true },
  { name: 'railway', displayName: 'Railway', category: 'Developer Tools', remote: true },
  { name: 'render', displayName: 'Render', category: 'Developer Tools', remote: true },
  { name: 'fly', displayName: 'Fly.io', category: 'Developer Tools', remote: true },
  { name: 'deno', displayName: 'Deno', category: 'Developer Tools', remote: true },
  { name: 'bun', displayName: 'Bun', category: 'Developer Tools', remote: true },

  // AI Companies
  { name: 'perplexity', displayName: 'Perplexity AI', category: 'AI', remote: true },
  { name: 'mistral', displayName: 'Mistral AI', category: 'AI', remote: true },
  { name: 'together', displayName: 'Together AI', category: 'AI', remote: true },
  { name: 'cursor', displayName: 'Cursor', category: 'AI', remote: true },

  // Growing Startups
  { name: 'cal', displayName: 'Cal.com', category: 'Technology', remote: true },
  { name: 'resend', displayName: 'Resend', category: 'Developer Tools', remote: true },
  { name: 'clerk', displayName: 'Clerk', category: 'Developer Tools', remote: true },
  { name: 'axiom', displayName: 'Axiom', category: 'Developer Tools', remote: true },
  { name: 'neon', displayName: 'Neon', category: 'Developer Tools', remote: true },
  { name: 'turso', displayName: 'Turso', category: 'Developer Tools', remote: true },

  // Other Tech Companies
  { name: 'buildkite', displayName: 'Buildkite', category: 'Developer Tools', remote: true },
  { name: 'zed', displayName: 'Zed', category: 'Developer Tools', remote: true },
  { name: 'posthog', displayName: 'PostHog', category: 'Developer Tools', remote: true },
  { name: 'planetscale', displayName: 'PlanetScale (Ashby)', category: 'Developer Tools', remote: true },
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all companies from all ATS platforms
 */
export function getAllATSCompanies(): Array<{
  ats: 'greenhouse' | 'lever' | 'ashby'
  identifier: string
  name: string
  category?: string
  remote?: boolean
}> {
  const companies: Array<{
    ats: 'greenhouse' | 'lever' | 'ashby'
    identifier: string
    name: string
    category?: string
    remote?: boolean
  }> = []

  for (const gh of GREENHOUSE_BOARDS) {
    companies.push({
      ats: 'greenhouse',
      identifier: gh.token,
      name: gh.name,
      category: gh.category,
      remote: gh.remote,
    })
  }

  for (const lv of LEVER_COMPANIES) {
    companies.push({
      ats: 'lever',
      identifier: lv.slug,
      name: lv.name,
      category: lv.category,
      remote: lv.remote,
    })
  }

  for (const ab of ASHBY_BOARDS) {
    companies.push({
      ats: 'ashby',
      identifier: ab.name,
      name: ab.displayName,
      category: ab.category,
      remote: ab.remote,
    })
  }

  return companies
}

/**
 * Get companies by category
 */
export function getCompaniesByCategory(category: string): typeof GREENHOUSE_BOARDS {
  const companies = []

  for (const gh of GREENHOUSE_BOARDS) {
    if (gh.category?.toLowerCase() === category.toLowerCase()) {
      companies.push(gh)
    }
  }

  return companies
}

/**
 * Get companies with remote positions
 */
export function getRemoteCompanies(): typeof GREENHOUSE_BOARDS {
  return GREENHOUSE_BOARDS.filter(c => c.remote)
}

/**
 * Get Greenhouse boards list for API
 */
export function getGreenhouseBoards(): Array<{ token: string; name: string }> {
  return GREENHOUSE_BOARDS.map(c => ({ token: c.token, name: c.name }))
}

/**
 * Get Lever companies list for API
 */
export function getLeverCompanies(): Array<{ slug: string; name: string }> {
  return LEVER_COMPANIES.map(c => ({ slug: c.slug, name: c.name }))
}

/**
 * Get Ashby boards list for API
 */
export function getAshbyBoards(): Array<{ name: string; displayName: string }> {
  return ASHBY_BOARDS.map(c => ({ name: c.name, displayName: c.displayName }))
}

/**
 * Find a company by name across all ATS platforms
 */
export function findCompanyByName(searchName: string): {
  ats: 'greenhouse' | 'lever' | 'ashby'
  company: GreenhouseCompany | LeverCompany | AshbyCompany
} | null {
  const searchLower = searchName.toLowerCase()

  // Search Greenhouse
  const ghMatch = GREENHOUSE_BOARDS.find(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.token.toLowerCase().includes(searchLower)
  )
  if (ghMatch) return { ats: 'greenhouse', company: ghMatch }

  // Search Lever
  const lvMatch = LEVER_COMPANIES.find(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.slug.toLowerCase().includes(searchLower)
  )
  if (lvMatch) return { ats: 'lever', company: lvMatch }

  // Search Ashby
  const abMatch = ASHBY_BOARDS.find(c =>
    c.displayName.toLowerCase().includes(searchLower) ||
    c.name.toLowerCase().includes(searchLower)
  )
  if (abMatch) return { ats: 'ashby', company: abMatch }

  return null
}

// =============================================================================
// STATISTICS
// =============================================================================

export const ATS_STATS = {
  greenhouse: GREENHOUSE_BOARDS.length,
  lever: LEVER_COMPANIES.length,
  ashby: ASHBY_BOARDS.length,
  total: GREENHOUSE_BOARDS.length + LEVER_COMPANIES.length + ASHBY_BOARDS.length,
}
