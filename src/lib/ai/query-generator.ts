import OpenAI from 'openai'
import type { JobFilters, ScreeningAnswers } from '@/lib/supabase/types'
import type { ParsedCV } from './cv-parser'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratedQueries {
  primary: string[]           // 4 main job title variations
  skillBased: string[]        // 3 skill-anchored queries
  seniorityVariants: string[] // 2 adjacent-level titles
  industrySpecific: string[]  // 2-3 industry-specific roles
  metadata: {
    generatedAt: string
    profileHash: string
    reasoning: string
  }
}

export interface QueryGenerationInput {
  // From CV parsed data
  cvSkills: string[]
  cvExperienceTitles: string[]  // Past job titles from CV
  cvYearsExperience: number     // Calculated from CV durations

  // From Screening Answers
  currentJobTitle: string
  experienceSummary: string     // User's own description
  spokenLanguages: string[]
  workAuthorizationCountries: string[]
  requiresVisa: boolean

  // From Job Filters
  targetJobTitles: string[]     // User's explicit preferences
  targetIndustries: string[]
  seniorityLevels: string[]
  jobTypes: string[]            // fulltime, contractor, internship
  excludeKeywords: string[]     // Roles to AVOID
  jobLanguages: string[]        // For non-English markets
  remoteCountries: string[]     // Market context
  onsiteLocations: string[]     // Market context
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate years of experience from CV duration strings
 */
export function calculateYearsExperience(experience: { duration: string }[]): number {
  let totalMonths = 0

  for (const exp of experience) {
    // Parse durations like "Jan 2020 - Present", "2019 - 2022", "3 years"
    const duration = exp.duration.toLowerCase()

    // Check for "present" or "current" -> calculate from start to now
    if (duration.includes('present') || duration.includes('current')) {
      const yearMatch = duration.match(/(\d{4})/)
      if (yearMatch) {
        const startYear = parseInt(yearMatch[1])
        totalMonths += (new Date().getFullYear() - startYear) * 12
      }
    } else {
      // Look for year ranges like "2019 - 2022"
      const years = duration.match(/(\d{4})/g)
      if (years && years.length >= 2) {
        totalMonths += (parseInt(years[1]) - parseInt(years[0])) * 12
      }
    }
  }

  return Math.round(totalMonths / 12)
}

/**
 * Extract market from location preferences
 */
export function determineMarket(remoteCountries: string[], onsiteLocations: string[]): string {
  const locations = [...remoteCountries, ...onsiteLocations]

  if (locations.some(l => /poland|pl/i.test(l))) return 'Poland/EU'
  if (locations.some(l => /uk|united kingdom|britain/i.test(l))) return 'UK'
  if (locations.some(l => /us|usa|united states|america/i.test(l))) return 'US'
  if (locations.some(l => /germany|de/i.test(l))) return 'Germany/EU'
  if (locations.some(l => /remote|worldwide/i.test(l))) return 'Remote-Global'

  return 'Global'
}

/**
 * Build input object from all available data
 */
export function buildQueryInput(
  cvData: ParsedCV | null,
  screening: ScreeningAnswers | null,
  filters: JobFilters | null
): QueryGenerationInput {
  return {
    cvSkills: cvData?.skills?.slice(0, 15) || [],
    cvExperienceTitles: cvData?.experience?.map(e => e.title).slice(0, 5) || [],
    cvYearsExperience: cvData?.experience ? calculateYearsExperience(cvData.experience) : 0,

    currentJobTitle: screening?.current_job_title || '',
    experienceSummary: screening?.experience_summary || '',
    spokenLanguages: screening?.spoken_languages || [],
    workAuthorizationCountries: screening?.work_authorization_countries || [],
    requiresVisa: screening?.requires_visa_sponsorship || false,

    targetJobTitles: filters?.job_titles || [],
    targetIndustries: filters?.industries || [],
    seniorityLevels: filters?.seniority_levels || [],
    jobTypes: filters?.job_types || [],
    excludeKeywords: filters?.exclude_keywords || [],
    jobLanguages: filters?.job_languages || [],
    remoteCountries: filters?.remote_countries || [],
    onsiteLocations: filters?.onsite_locations || [],
  }
}

// =============================================================================
// AI QUERY GENERATION
// =============================================================================

/**
 * Generate search queries using AI based on user profile
 */
export async function generateSearchQueries(input: QueryGenerationInput): Promise<GeneratedQueries> {
  const market = determineMarket(input.remoteCountries, input.onsiteLocations)

  const prompt = `You are an expert job search strategist specializing in tech roles. Generate optimized search queries that maximize relevant job matches while minimizing noise.

## CANDIDATE PROFILE

**Current Role:** ${input.currentJobTitle || 'Not specified'}
**Experience Level:** ${input.cvYearsExperience} years
**Experience Summary:** ${input.experienceSummary || 'Not provided'}

**Core Skills:** ${input.cvSkills.join(', ') || 'Not specified'}
**Past Job Titles:** ${input.cvExperienceTitles.join(', ') || 'Not specified'}
**Target Roles (preferences):** ${input.targetJobTitles.join(', ') || 'Not specified'}

**Target Industries:** ${input.targetIndustries.join(', ') || 'Any'}
**Target Seniority:** ${input.seniorityLevels.join(', ') || 'Any'}
**Job Types:** ${input.jobTypes.join(', ') || 'Any'}

**Location/Market:** ${market}
**Job Languages:** ${input.jobLanguages.join(', ') || 'English'}
**Work Authorization:** ${input.workAuthorizationCountries.join(', ') || 'Not specified'}
**Requires Visa Sponsorship:** ${input.requiresVisa ? 'Yes' : 'No'}

**Roles to EXCLUDE:** ${input.excludeKeywords.join(', ') || 'None'}

## QUERY GENERATION RULES

### Include:
1. **Title variations** - Different names for equivalent roles (e.g., "ML Engineer" = "Machine Learning Developer" = "AI Engineer")
2. **Seniority adjacent** - One level up/down from target (Senior -> Lead, Mid -> Senior)
3. **Skill-anchored titles** - Roles defined by primary skills (e.g., "Python Developer" for Python-heavy experience)
4. **Industry-specific variants** - How the role is named in target industries (e.g., "Quant Developer" in finance)
5. **Modern/emerging titles** - Current market terminology (e.g., "GenAI Engineer", "LLM Developer")
6. **Job type variants** - If contractor: include "Consultant", "Freelance". If internship: include "Graduate", "Junior"
7. **Past experience leverage** - Roles similar to their previous job titles

### Avoid:
- Single generic words ("Engineer", "Developer" alone)
- Roles in the EXCLUDE list
- Outdated titles unlikely to appear in current listings
- Queries returning 90%+ irrelevant results
- Roles requiring work authorization user doesn't have (if visa required, avoid government/defense roles)

### Format constraints:
- 1-4 words per query
- Use terminology common in ${market} job market
- If job_languages includes non-English, include native-language job titles

## RESPONSE FORMAT
Return valid JSON only:
{
  "primary": ["<4 main title variations, ordered by expected relevance>"],
  "skillBased": ["<3 queries anchored to top technical skills>"],
  "seniorityVariants": ["<2 adjacent-level titles>"],
  "industrySpecific": ["<2-3 titles specific to target industries>"],
  "reasoning": "<2-3 sentences explaining query strategy and any tradeoffs>"
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(content)

    return {
      primary: parsed.primary || [],
      skillBased: parsed.skillBased || [],
      seniorityVariants: parsed.seniorityVariants || [],
      industrySpecific: parsed.industrySpecific || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        profileHash: '', // Will be set by caching layer
        reasoning: parsed.reasoning || '',
      },
    }
  } catch (error) {
    console.error('Error generating search queries:', error)
    // Return fallback queries
    return buildFallbackQueries(input)
  }
}

// =============================================================================
// FALLBACK QUERY BUILDER
// =============================================================================

/**
 * Build fallback queries from raw data if AI generation fails
 */
export function buildFallbackQueries(input: QueryGenerationInput): GeneratedQueries {
  const queries: string[] = []

  // 1. User's explicit target titles (highest priority)
  queries.push(...input.targetJobTitles.slice(0, 3))

  // 2. Current job title
  if (input.currentJobTitle) {
    queries.push(input.currentJobTitle)
  }

  // 3. Past job titles from CV
  queries.push(...input.cvExperienceTitles.slice(0, 2))

  // 4. Top skills as queries
  const skillQueries = input.cvSkills.slice(0, 3).map(s => `${s} Developer`)

  // 5. Ultimate fallback
  if (queries.length === 0) {
    queries.push('Software Engineer')
  }

  // Deduplicate queries
  const uniqueQueries = Array.from(new Set(queries))

  return {
    primary: uniqueQueries.slice(0, 4),
    skillBased: skillQueries,
    seniorityVariants: [],
    industrySpecific: input.targetIndustries.slice(0, 2),
    metadata: {
      generatedAt: new Date().toISOString(),
      profileHash: 'fallback',
      reasoning: 'AI generation failed - using profile data directly',
    },
  }
}

// =============================================================================
// UTILITY: GET ALL QUERIES AS FLAT ARRAY
// =============================================================================

/**
 * Get all generated queries as a flat array for searching
 */
export function getAllQueries(queries: GeneratedQueries): string[] {
  return [
    ...queries.primary,
    ...queries.skillBased,
    ...queries.seniorityVariants,
    ...queries.industrySpecific,
  ].filter(q => q && q.trim().length > 0)
}

/**
 * Get queries distributed for different APIs
 * Each API gets a subset of queries for maximum coverage
 */
export function getQueriesForAPI(
  queries: GeneratedQueries,
  api: 'fantasticjobs' | 'adzuna' | 'remotive' | 'arbeitnow' | 'themuse'
): string[] {
  switch (api) {
    case 'fantasticjobs':
      // Primary source with best coverage - use primary + skill queries
      return [...queries.primary.slice(0, 3), ...queries.skillBased.slice(0, 1)]
    case 'adzuna':
      // Mix for variety
      return [queries.primary[0], queries.industrySpecific[0]].filter(Boolean)
    case 'remotive':
      // Tech-focused, skills work well
      return queries.skillBased.slice(0, 2)
    case 'arbeitnow':
      // EU focus, seniority matters
      return queries.seniorityVariants.slice(0, 1).length > 0
        ? queries.seniorityVariants.slice(0, 1)
        : queries.primary.slice(0, 1)
    case 'themuse':
      // US focus, single query
      return queries.primary.slice(0, 1)
    default:
      return queries.primary.slice(0, 1)
  }
}
