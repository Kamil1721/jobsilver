# Requirements Specification: Adzuna API Integration

## Summary

This document specifies the requirements for implementing `adzuna.ts` to integrate the Adzuna Job Search API into the JobSilver application. The implementation must follow the established pattern in `jsearch.ts` while adapting to Adzuna's specific API structure and response format.

## Recommended Approach

Implement a new module at `src/lib/api/adzuna.ts` that mirrors the structure of `jsearch.ts`, including:
1. Type definitions for Adzuna API responses
2. A `searchJobs` function with parameters matching user preferences
3. A mapping function to convert Adzuna jobs to the internal Job schema
4. Validation/filtering utilities (reuse from jsearch.ts where possible)

The Adzuna API is well-documented and provides comprehensive job data across 12 countries, making it an excellent complement to JSearch for European markets.

## Key Resources

- [Adzuna Developer Portal](https://developer.adzuna.com/): Official API documentation and registration
- [Search Endpoint Docs](https://developer.adzuna.com/docs/search): Detailed search API parameters
- [Interactive Documentation](https://developer.adzuna.com/activedocs): Live API testing playground
- [Adzuna MCP Server](https://github.com/folathecoder/adzuna-job-search-mcp): Reference implementation showing country codes and parameters

---

## 1. API Overview

### Base URL
```
https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
```

### Authentication
Two query parameters required on every request:
- `app_id`: Application ID
- `app_key`: Application key

### Environment Variables (Already Configured)
```env
ADZUNA_APP_ID=24985e52
ADZUNA_APP_KEY=dcff54244fe71c31833c4a2dac03b005
```

---

## 2. Supported Countries

The Adzuna API supports 12 countries with ISO 3166 alpha-2 codes:

| Code | Country | Currency |
|------|---------|----------|
| `gb` | United Kingdom | GBP |
| `us` | United States | USD |
| `de` | Germany | EUR |
| `fr` | France | EUR |
| `au` | Australia | AUD |
| `nz` | New Zealand | NZD |
| `ca` | Canada | CAD |
| `in` | India | INR |
| `pl` | Poland | PLN |
| `br` | Brazil | BRL |
| `at` | Austria | EUR |
| `za` | South Africa | ZAR |

---

## 3. Search Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `app_id` | string | API application ID |
| `app_key` | string | API application key |

### Optional Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `what` | string | Keywords to search for (job title, skills) |
| `what_and` | string | All words must be present |
| `what_or` | string | Any of these words |
| `what_exclude` | string | Keywords to exclude from results |
| `where` | string | Location (city, region, postal code) |
| `results_per_page` | integer | Number of results per page (max 50) |
| `page` | integer | Page number (starts at 1, in URL path) |
| `salary_min` | integer | Minimum annual salary |
| `salary_max` | integer | Maximum annual salary |
| `full_time` | 1 | Filter for full-time positions |
| `part_time` | 1 | Filter for part-time positions |
| `contract` | 1 | Filter for contract positions |
| `permanent` | 1 | Filter for permanent positions |
| `category` | string | Job category tag (e.g., "it-jobs") |
| `sort_by` | string | Sort order: "date", "salary", or "relevance" |
| `max_days_old` | integer | Maximum listing age in days |

---

## 4. Response Format

### Response Structure

```typescript
interface AdzunaResponse {
  results: AdzunaJob[]
  count: number  // Total results available
  mean: number   // Mean salary (when applicable)
}
```

### Job Object Structure

```typescript
interface AdzunaJob {
  id: string
  title: string
  description: string  // Note: Only a snippet is provided
  redirect_url: string
  created: string  // ISO timestamp, e.g., "2013-11-08T18:07:39Z"

  company: {
    display_name: string
  }

  location: {
    display_name: string  // e.g., "Marlow, Buckinghamshire"
    area: string[]  // Hierarchy: ["UK", "South East England", "Buckinghamshire", "Marlow"]
  }

  latitude?: number
  longitude?: number

  salary_min?: number
  salary_max?: number
  salary_is_predicted?: boolean  // Flag for predicted vs actual salary

  contract_type?: string  // e.g., "permanent"
  contract_time?: string  // e.g., "full_time"

  category: {
    label: string  // e.g., "IT Jobs"
    tag: string    // e.g., "it-jobs"
  }

  __CLASS__?: string  // Internal: "Adzuna::API::Response::Job"
}
```

---

## 5. Required Implementation

### 5.1 Type Definitions

```typescript
// File: src/lib/api/adzuna.ts

export interface AdzunaJob {
  id: string
  title: string
  description: string
  redirect_url: string
  created: string
  company: {
    display_name: string
  }
  location: {
    display_name: string
    area: string[]
  }
  latitude?: number
  longitude?: number
  salary_min?: number
  salary_max?: number
  salary_is_predicted?: boolean
  contract_type?: string
  contract_time?: string
  category: {
    label: string
    tag: string
  }
}

export interface AdzunaResponse {
  results: AdzunaJob[]
  count: number
  mean?: number
}

export interface AdzunaSearchParams {
  query: string              // Maps to 'what' parameter
  country: string            // Country code (e.g., 'gb', 'us')
  location?: string          // Maps to 'where' parameter
  page?: number              // Page number (default: 1)
  results_per_page?: number  // Results per page (max: 50, default: 20)
  salary_min?: number        // Minimum annual salary
  salary_max?: number        // Maximum annual salary
  full_time?: boolean        // Filter full-time jobs
  part_time?: boolean        // Filter part-time jobs
  contract?: boolean         // Filter contract jobs
  permanent?: boolean        // Filter permanent jobs
  category?: string          // Job category tag
  sort_by?: 'date' | 'salary' | 'relevance'
  max_days_old?: number      // Maximum listing age in days
  what_exclude?: string      // Keywords to exclude
}
```

### 5.2 Supported Country Codes Constant

```typescript
export const ADZUNA_COUNTRIES: Record<string, { name: string; currency: string }> = {
  gb: { name: 'United Kingdom', currency: 'GBP' },
  us: { name: 'United States', currency: 'USD' },
  de: { name: 'Germany', currency: 'EUR' },
  fr: { name: 'France', currency: 'EUR' },
  au: { name: 'Australia', currency: 'AUD' },
  nz: { name: 'New Zealand', currency: 'NZD' },
  ca: { name: 'Canada', currency: 'CAD' },
  in: { name: 'India', currency: 'INR' },
  pl: { name: 'Poland', currency: 'PLN' },
  br: { name: 'Brazil', currency: 'BRL' },
  at: { name: 'Austria', currency: 'EUR' },
  za: { name: 'South Africa', currency: 'ZAR' },
}
```

### 5.3 Search Function

```typescript
export async function searchAdzunaJobs(params: AdzunaSearchParams): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY is not configured')
  }

  // Validate country code
  if (!ADZUNA_COUNTRIES[params.country]) {
    throw new Error(`Unsupported country code: ${params.country}`)
  }

  const page = params.page || 1
  const baseUrl = `https://api.adzuna.com/v1/api/jobs/${params.country}/search/${page}`

  const queryParams = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(params.results_per_page || 20),
  })

  // Add search keywords
  if (params.query) {
    queryParams.set('what', params.query)
  }

  // Add location
  if (params.location) {
    queryParams.set('where', params.location)
  }

  // Add salary filters
  if (params.salary_min) {
    queryParams.set('salary_min', String(params.salary_min))
  }
  if (params.salary_max) {
    queryParams.set('salary_max', String(params.salary_max))
  }

  // Add job type filters (Adzuna uses 1 for true)
  if (params.full_time) {
    queryParams.set('full_time', '1')
  }
  if (params.part_time) {
    queryParams.set('part_time', '1')
  }
  if (params.contract) {
    queryParams.set('contract', '1')
  }
  if (params.permanent) {
    queryParams.set('permanent', '1')
  }

  // Add category filter
  if (params.category) {
    queryParams.set('category', params.category)
  }

  // Add sorting
  if (params.sort_by) {
    queryParams.set('sort_by', params.sort_by)
  }

  // Add max age filter
  if (params.max_days_old) {
    queryParams.set('max_days_old', String(params.max_days_old))
  }

  // Add exclusion keywords
  if (params.what_exclude) {
    queryParams.set('what_exclude', params.what_exclude)
  }

  // Add timeout (30 seconds)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(
      `${baseUrl}?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Adzuna API error: ${response.status}`)
    }

    const data: AdzunaResponse = await response.json()
    return data.results || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Adzuna API request timed out')
    }
    throw error
  }
}
```

### 5.4 Mapping Function

```typescript
export function mapAdzunaJobToJob(adzunaJob: AdzunaJob, userId: string, country: string) {
  // Extract location from area hierarchy or display_name
  const locationParts = adzunaJob.location?.area || []
  const locationString = adzunaJob.location?.display_name || locationParts.slice(1).reverse().join(', ')

  // Map contract_time to job_type
  let jobType = 'unknown'
  if (adzunaJob.contract_time === 'full_time') {
    jobType = 'FULLTIME'
  } else if (adzunaJob.contract_time === 'part_time') {
    jobType = 'PARTTIME'
  } else if (adzunaJob.contract_type === 'contract') {
    jobType = 'CONTRACTOR'
  }

  // Detect if remote based on description/title
  const isRemote = /remote|work from home|wfh|telecommute/i.test(
    `${adzunaJob.title} ${adzunaJob.description}`
  )

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    external_id: adzunaJob.id,
    source: 'adzuna',
    title: adzunaJob.title,
    company: adzunaJob.company?.display_name || 'Unknown Company',
    company_logo_url: null,  // Adzuna does not provide company logos
    location: locationString,
    salary_min: adzunaJob.salary_min || null,
    salary_max: adzunaJob.salary_max || null,
    job_type: jobType,
    remote: isRemote,
    description: adzunaJob.description,  // Note: Adzuna only provides a snippet
    application_url: adzunaJob.redirect_url,
    status: 'discovered' as const,
    created_at: adzunaJob.created || new Date().toISOString(),
  }
}
```

---

## 6. Field Mapping: Adzuna to Job Schema

| Adzuna Field | Job Schema Field | Notes |
|--------------|------------------|-------|
| `id` | `external_id` | Unique identifier from Adzuna |
| `title` | `title` | Direct mapping |
| `company.display_name` | `company` | Extracted from nested object |
| N/A | `company_logo_url` | Adzuna does not provide logos - set to null |
| `location.display_name` | `location` | Or constructed from `area` array |
| `salary_min` | `salary_min` | May be predicted (check `salary_is_predicted`) |
| `salary_max` | `salary_max` | May be predicted (check `salary_is_predicted`) |
| `contract_time` | `job_type` | Map: full_time->FULLTIME, part_time->PARTTIME |
| Analyzed from text | `remote` | Parse from title/description for remote keywords |
| `description` | `description` | **Note: Only a snippet provided** |
| `redirect_url` | `application_url` | URL to job listing |
| `created` | `created_at` | ISO timestamp |
| N/A | `source` | Set to 'adzuna' |
| N/A | `status` | Set to 'discovered' |

---

## 7. Implementation Notes

### 7.1 Key Differences from JSearch

1. **Country Code Required**: Adzuna requires a country code in the URL path, whereas JSearch uses a single global endpoint.

2. **Description is Truncated**: Adzuna only provides a description snippet, not the full job description. Consider noting this limitation in the UI.

3. **No Company Logos**: Adzuna does not provide company logo URLs. The `company_logo_url` should be set to null.

4. **Salary May Be Predicted**: Adzuna has a `salary_is_predicted` flag. Consider storing this or filtering predicted salaries.

5. **Page in URL Path**: The page number is part of the URL path (`/search/{page}`) rather than a query parameter.

6. **Boolean Parameters Use '1'**: Job type filters (full_time, part_time, etc.) use '1' instead of 'true'.

### 7.2 Validation Functions to Reuse

The following functions from `jsearch.ts` can be imported and reused:
- `validateRemoteType()` - Works on description text analysis
- `validateJobLocation()` - Works with country name normalization
- `isSpamJob()` - Works on title/description analysis
- `isJobFresh()` - Needs adaptation for ISO timestamp vs Unix timestamp
- `matchesUserTimeZones()` - Works on description analysis
- `matchesUserLanguages()` - Works on description analysis

### 7.3 Adapter for isJobFresh

```typescript
// Adzuna uses ISO timestamp strings instead of Unix timestamps
export function isAdzunaJobFresh(job: AdzunaJob, maxAgeDays: number = 14): boolean {
  if (!job.created) {
    return true // Keep if no date available
  }

  const postedDate = new Date(job.created)
  const daysSincePosted = (Date.now() - postedDate.getTime()) / (1000 * 60 * 60 * 24)

  return daysSincePosted <= maxAgeDays
}
```

---

## 8. Error Handling

### Expected Error Scenarios

| Scenario | Error Message |
|----------|---------------|
| Missing API credentials | "ADZUNA_APP_ID or ADZUNA_APP_KEY is not configured" |
| Invalid country code | "Unsupported country code: {code}" |
| API timeout | "Adzuna API request timed out" |
| HTTP error | "Adzuna API error: {status}" |

### Rate Limiting

Adzuna documentation does not specify rate limits. Implement conservative request intervals (e.g., 1 request per second) when making bulk queries.

---

## 9. Testing Recommendations

1. **Unit Tests**: Test mapping function with sample Adzuna responses
2. **Integration Tests**: Test API calls with valid credentials
3. **Country Code Validation**: Test all 12 supported country codes
4. **Edge Cases**:
   - Jobs without salary information
   - Jobs with predicted vs actual salary
   - Jobs without company name
   - Empty search results

---

## 10. Open Questions

1. **Rate Limits**: Official rate limit documentation not found. Need to test empirically or contact Adzuna support.

2. **Full Description Access**: Adzuna only provides a description snippet. Need to determine if this is acceptable or if users need to click through to see full details.

3. **Category Tags**: Should the application fetch available categories via `get_categories` endpoint for filtering UI?

4. **Salary Currency**: Salaries are in local currency per country. Need to decide if currency conversion or display is required.

---

## Document Information

**Created**: 2026-01-16
**Author**: Research Agent
**Status**: Complete - Ready for Implementation
**Related Files**:
- `src/lib/api/jsearch.ts` - Reference implementation
- `src/lib/supabase/types.ts` - Job schema definition
- `.env.local` - Environment variables (already configured)
