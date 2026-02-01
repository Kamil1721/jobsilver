# Research Brief: Scaling Company Database from 91 to 500+

## Summary

The current JobSilver system has 91 curated companies across Greenhouse (52), Lever (28), and Ashby (22). Research reveals multiple viable strategies to expand to 500+ companies, ranging from free community-driven sources (GitHub repositories with 300+ companies each) to commercial APIs (BuiltWith, Wappalyzer tracking 11,000+ Greenhouse users). The recommended approach combines harvesting from existing open-source aggregators with implementing a user-submission system.

## Recommended Approach

**Hybrid Strategy: Community Sources + User Submissions**

1. **Immediate wins (Week 1)**: Harvest from existing GitHub repositories and public lists
2. **Medium-term (Week 2-3)**: Implement user-submitted companies feature
3. **Long-term (Month 2+)**: Consider commercial data providers for enterprise scale

Rationale: Free community sources can immediately 5x the database, while user submissions create a sustainable growth engine without ongoing costs.

## Key Resources

### Free Company Discovery Sources

| Source | Coverage | Access |
|--------|----------|--------|
| [crypto-jobs-fyi/crawler](https://github.com/crypto-jobs-fyi/crawler/blob/main/companies.json) | 300+ companies (crypto/AI focus) with Greenhouse, Lever, Ashby URLs | Free JSON download |
| [Feashliaa/job-board-aggregator](https://github.com/Feashliaa/job-board-aggregator) | 4,000+ companies, 50,000+ positions | Open source |
| [adgramigna/job-board-scraper](https://github.com/adgramigna/job-board-scraper) | Greenhouse, Lever, Ashby, Rippling | Live at levergreen.dev |
| [Y Combinator Work at a Startup](https://www.workatastartup.com/) | 1,000+ YC startups | Public listings |
| [Wellfound (AngelList)](https://wellfound.com) | 10M+ startup candidates, thousands of companies | Free access |

### Commercial Data Providers

| Provider | Coverage | Pricing |
|----------|----------|---------|
| [BuiltWith](https://trends.builtwith.com/websitelist/Greenhouse) | Tracks all websites using Greenhouse/Lever | $295+/month |
| [Wappalyzer](https://www.wappalyzer.com/technologies/recruitment-staffing/lever/) | Technology detection for ATS | $250+/month |
| [Toolsberry](https://www.toolsberry.com/companies-using-greenhouse/) | Segmented customer lists | Contact for pricing |
| [Enlyft](https://enlyft.com/tech/products/greenhouse) | 11,529 Greenhouse companies with API | Enterprise pricing |
| [Landbase](https://data.landbase.com/technology/greenhouse/) | 11,529 verified companies | Contact for pricing |
| [Fantastic.jobs](https://fantastic.jobs/api) | 140k+ career sites, 41 ATS platforms | $200-4,000/month |

### ATS Public APIs (No Auth Required)

| ATS | API Endpoint | Documentation |
|-----|--------------|---------------|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs` | [Job Board API](https://developers.greenhouse.io/job-board.html) |
| Lever | `GET https://api.lever.co/v0/postings/{company}` | [Postings API](https://github.com/lever/postings-api) |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{name}` | [Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api) |

## Implementation Notes

### Strategy 1: Harvest from GitHub Repositories (Immediate)

**Companies JSON format from crypto-jobs-fyi:**
```json
{
  "name": "Anthropic",
  "jobs_url": "https://job-boards.greenhouse.io/anthropic",
  "scraper": "GREENHOUSE",
  "website": "https://anthropic.com",
  "category": "ai",
  "enabled": true
}
```

**Action items:**
1. Download companies.json from crypto-jobs-fyi/crawler
2. Parse and validate each company's job board URL
3. Add verified companies to ats-companies.ts
4. Deduplicate against existing 91 companies

**Expected yield:** 200-300 unique new companies

### Strategy 2: Scrape Y Combinator and Wellfound Listings

**Y Combinator companies:**
- Most YC startups use Greenhouse, Lever, or Ashby
- [Employbl](https://www.employbl.com/company-collections/y-combinator) lists 100+ YC companies
- Work at a Startup has 1,000+ startups

**Discovery method:**
1. Get company name from YC listing
2. Try common URL patterns:
   - `boards.greenhouse.io/{company}`
   - `jobs.lever.co/{company}`
   - `jobs.ashbyhq.com/{company}`
3. Validate with API call (200 = valid board)

### Strategy 3: User-Submitted Companies

**Implementation design:**
```typescript
interface UserSubmittedCompany {
  id: string
  companyName: string
  boardUrl: string           // e.g., jobs.lever.co/acme
  atsType: 'greenhouse' | 'lever' | 'ashby'
  submittedBy: string        // user_id
  submittedAt: Date
  verified: boolean          // API validation passed
  upvotes: number            // community validation
  lastJobCount: number       // jobs found on last check
}
```

**Validation flow:**
1. User submits URL (e.g., `jobs.lever.co/newcompany`)
2. System parses ATS type and company identifier
3. API call to validate board exists and has jobs
4. If valid, add to database with `verified: true`
5. Periodic re-validation to remove defunct boards

**UI location:** Add "Submit a Company" button on dashboard

### Strategy 4: Automated Discovery via Web Scraping

**Apify actors available:**
- [Greenhouse Jobs API](https://apify.com/fantastic-jobs/greenhouse-jobs-api) - Multi-company search
- [Ashby Jobs API](https://apify.com/fantastic-jobs/ashby-jobs-api) - Multi-company search
- [Career Scraper](https://apify.com/canadesk/career-scraper) - Detects ATS type automatically

**Cost:** Apify free tier: 30 actor runs/month

### Strategy 5: Technology Detection (Premium)

**Wappalyzer approach:**
1. Use browser extension (free) to detect ATS on company careers pages
2. Build list manually while browsing
3. Or pay $250+/month for bulk access

**BuiltWith approach:**
1. Lists API provides all websites using specific technology
2. Can export Greenhouse/Lever/Ashby customer lists
3. $295+/month for basic access

## Programmatic Discovery Patterns

### Pattern 1: Board Token Validation

```typescript
async function validateGreenhouseBoard(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`
    )
    if (!res.ok) return false
    const data = await res.json()
    return data.jobs && data.jobs.length > 0
  } catch {
    return false
  }
}
```

### Pattern 2: Brute-Force Discovery (NOT RECOMMENDED)

While technically possible to iterate through common company names, this approach:
- Has very low hit rate
- Could trigger rate limiting
- Is inefficient compared to harvesting known sources

### Pattern 3: Careers Page Detection

```typescript
// When user pastes any careers page URL
async function detectATS(url: string): Promise<{
  type: 'greenhouse' | 'lever' | 'ashby' | 'unknown'
  identifier: string
}> {
  if (url.includes('boards.greenhouse.io')) {
    return { type: 'greenhouse', identifier: url.split('/')[3] }
  }
  if (url.includes('jobs.lever.co')) {
    return { type: 'lever', identifier: url.split('/')[3] }
  }
  if (url.includes('jobs.ashbyhq.com')) {
    return { type: 'ashby', identifier: url.split('/')[3] }
  }
  // Could also check page content for ATS signatures
  return { type: 'unknown', identifier: '' }
}
```

## Scaling Roadmap

| Phase | Target | Method | Timeline |
|-------|--------|--------|----------|
| 1 | 91 -> 300 | GitHub harvesting | Week 1 |
| 2 | 300 -> 400 | YC/Wellfound mining | Week 2 |
| 3 | 400 -> 500 | User submissions | Week 3-4 |
| 4 | 500 -> 1000+ | Community growth + commercial data | Month 2+ |

## Open Questions

1. **Rate limiting:** Do Greenhouse/Lever/Ashby APIs have undocumented rate limits that could affect bulk validation?
2. **Board token changes:** How often do companies change their board tokens? Need monitoring?
3. **Regional coverage:** Current list is US-centric. Should we prioritize EU/APAC companies?
4. **Category enrichment:** Should we add more metadata (company size, funding stage, tech stack)?
5. **Legal considerations:** Are there terms of service issues with aggregating from these ATS platforms?

## Data Quality Considerations

- **Deduplication:** Some companies appear on multiple ATS (e.g., Vercel on both Greenhouse and Ashby)
- **Defunct boards:** Companies may close or change ATS providers - need periodic revalidation
- **Job freshness:** Empty boards should be deprioritized or hidden
- **Company verification:** Validate company names match actual job board content

## Quick Wins Summary

1. **Download crypto-jobs-fyi companies.json** - Adds 200+ companies immediately
2. **Parse levergreen.dev data** - Another 100+ unique companies
3. **Add "Submit Company" feature** - Enables organic growth
4. **Set up monthly revalidation** - Keeps list fresh

## Sources

- [Greenhouse Job Board API Documentation](https://developers.greenhouse.io/job-board.html)
- [Lever Postings API GitHub](https://github.com/lever/postings-api)
- [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [crypto-jobs-fyi/crawler Repository](https://github.com/crypto-jobs-fyi/crawler)
- [Feashliaa/job-board-aggregator](https://github.com/Feashliaa/job-board-aggregator)
- [adgramigna/job-board-scraper](https://github.com/adgramigna/job-board-scraper)
- [BuiltWith Greenhouse List](https://trends.builtwith.com/websitelist/Greenhouse)
- [Enlyft Greenhouse Statistics](https://enlyft.com/tech/products/greenhouse)
- [Landbase Greenhouse Companies](https://data.landbase.com/technology/greenhouse/)
- [Fantastic.jobs ATS API](https://fantastic.jobs/api)
- [Y Combinator Work at a Startup](https://www.workatastartup.com/)
- [Wellfound (AngelList Talent)](https://wellfound.com)
