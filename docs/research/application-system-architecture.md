# Research Brief: JobSilver Application System Architecture

## Summary

The JobSilver application is a comprehensive job discovery and auto-apply platform built with Next.js, Supabase, and Stripe. It features a tiered subscription model (free/starter/pro/ultra), three auto-apply modes (full_auto/assisted/manual), and a sophisticated quota system that tracks both job discovery and application submissions daily. Jobs flow through a state machine from discovery to application via scraping, question extraction, and form submission.

## Recommended Approach

The architecture is well-designed with clear separation of concerns. For future development:
1. Use the existing tier constants in `src/lib/stripe/plans.ts` for quota enforcement
2. Follow the auto_apply_status state machine for job processing
3. Leverage the existing quota reservation functions for atomicity
4. The tester system provides a good model for special access bypasses

---

## 1. User Tiers / Subscription Plans

### Plan Types
Defined in `src\lib\supabase\types.ts`:
```typescript
type SubscriptionPlan = 'free' | 'starter' | 'basic' | 'pro' | 'ultra' | 'mega'
```

**Note:** `basic` and `mega` are legacy plans kept for backwards compatibility.

### Plan Limits
Defined in `src\lib\stripe\plans.ts`:

| Plan | Daily Jobs | Daily Applications | Saved Jobs | Weekly Price | Monthly Price | Trial Days |
|------|------------|-------------------|------------|--------------|---------------|------------|
| **free** | 5 | 1 | 10 | $0 | $0 | 0 |
| **starter** | 10 | 10 | 50 | $4.99 | $14.99 | 0 |
| **pro** | 25 | 25 | 200 | $9.99 | $29.99 | 3 |
| **ultra** | 50 | 50 | 1000 | $19.99 | $59.99 | 0 |
| basic (legacy) | 10 | 10 | 50 | $4.99 | $14.99 | 0 |
| mega (legacy) | 50 | 50 | 1000 | $19.99 | $59.99 | 0 |

### Plan Hierarchy
```typescript
const PLAN_HIERARCHY: SubscriptionPlan[] = ['free', 'starter', 'basic', 'pro', 'ultra', 'mega']
```

### Feature Requirements by Plan
Defined in `src\lib\features\config.ts`:

| Feature | Minimum Plan |
|---------|-------------|
| auto_apply | free (1/day) |
| email_alerts | starter |
| ai_cover_letters | pro |
| advanced_filters | pro |
| priority_support | pro |
| ai_learning | pro |
| dedicated_support | ultra |

### Tester System
- Testers get **Ultra-level access** to all features without being admins
- Defined in `supabase\migrations\20260125000000_add_tester_system.sql`
- Testers are tracked via `is_tester` boolean on profiles
- Invite codes stored in `tester_invites` table (one-time use, optional expiry)

### Profile Fields for Subscription
```typescript
// In profiles table
subscription_plan: SubscriptionPlan
subscription_started_at: string | null
is_admin: boolean
is_tester: boolean
has_selected_plan: boolean
```

---

## 2. Auto-Apply Modes

### Mode Types
Defined in `src\lib\supabase\types.ts`:
```typescript
type AutoApplyMode = 'full_auto' | 'assisted' | 'manual'
```

### Mode Behaviors

| Mode | Behavior | Quota Reserved When |
|------|----------|---------------------|
| **full_auto** | Automatically fills and submits applications | At processing time |
| **assisted** | Fills forms, sets status to `form_filled`, waits for user confirmation | At user confirmation |
| **manual** | No automation, user handles everything | N/A |

**Default Mode:** `assisted` (safer for new users)

### Mode Processing Flow

**Full Auto Mode:**
1. Get eligible jobs with `ready_to_apply` status
2. Reserve quota upfront for all jobs to process
3. Generate answers from profile + AI
4. Create `application_queue` entry with status `pending`
5. Update job to `submitting` status
6. Worker processes queue and submits

**Assisted Mode:**
1. Get eligible jobs with `ready_to_apply` status
2. NO quota reservation yet
3. Generate/pre-fill answers
4. Create `application_queue` entry but don't submit
5. Update job to `form_filled` status
6. User reviews and calls `/api/jobs/[id]/submit`
7. Quota reserved at confirmation time
8. Job moves to `submitting` -> worker submits

---

## 3. Application Flow

### Job Discovery -> Applied State Machine

```
discovered -> saved -> [auto-apply flow] -> applied -> interviewing -> offer
                |                              |
                +----> discarded <-------------+
```

### Auto-Apply Status State Machine
Defined in `src\lib\supabase\types.ts`:

```
                                    [No URL]
                                       |
                                       v
[New Job] ----+----> not_available (cannot auto-apply)
              |
              |     [Non-supported platform]
              +----> manual (requires external application)
              |
              |     [Supported ATS]
              +----> scraping ---+---> ready_to_apply --+---> [full_auto] ---> submitting --> applied
                     |          |                      |
                     v          |                      +---> [assisted] ----> form_filled --> [user confirms] --> submitting --> applied
              scrape_failed     |
                     |          |
                     v          v
              login_required  failed
              (hidden)       (retry possible)
```

### Status Descriptions

| Status | Description |
|--------|-------------|
| `not_started` | Initial state |
| `not_available` | No application URL - cannot auto-apply |
| `manual` | Non-supported platform - user must apply externally |
| `scraping` | Question extraction in progress |
| `ready_to_apply` | Questions scraped, ready for form filling |
| `form_filled` | Assisted mode: form pre-filled, awaiting user confirmation |
| `submitting` | Application being submitted |
| `applied` | Successfully submitted |
| `failed` | Submission failed (retryable) |
| `login_required` | Page requires auth - hidden from user |
| `scrape_failed` | Scraper couldn't extract questions - hidden from user |

### Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/jobs/search` | Discover jobs from fantastic.jobs + ATS APIs |
| `POST /api/auto-apply/process` | Process jobs through auto-apply pipeline |
| `POST /api/apply/instant` | Queue job for instant application |
| `POST /api/jobs/[id]/submit` | User confirms assisted-mode application |
| `GET /api/apply/status/[queueId]` | Check application queue status |

### Scraping Flow

1. **Job Discovered** -> `auto_apply_status = 'scraping'`
2. **Create `scraped_questions` record** with `scrape_status = 'pending'`
3. **Worker/droplet** picks up pending records
4. **Playwright scrapes** application page
5. **Extract form fields**: text, textarea, select, checkbox, radio, file, date, number, email, phone, url
6. **Store questions** in `scraped_questions.questions` array
7. **Update statuses**:
   - Success: `scrape_status = 'success'`, `auto_apply_status = 'ready_to_apply'`
   - Failed: `scrape_status = 'failed'`, `auto_apply_status = 'scrape_failed'` or `login_required`

### Question Structure
```typescript
interface ScrapedQuestion {
  id: string
  label: string
  type: ScrapedQuestionType  // text, textarea, select, checkbox, etc.
  required: boolean
  placeholder?: string
  options?: string[]  // For select/radio
  validation?: { pattern?: string; minLength?: number; maxLength?: number }
  selector: string  // CSS selector for form filling
  page?: number
  section?: string
}
```

---

## 4. Quotas System

### Daily Quota Tracking
Table: `user_job_quotas`

| Column | Type | Purpose |
|--------|------|---------|
| user_id | UUID | User reference |
| date | DATE | Current date (quotas reset daily) |
| jobs_fetched | INTEGER | Jobs discovered today |
| jobs_limit | INTEGER | Max jobs per day (plan-based) |
| applications_used | INTEGER | Auto-applies used today |
| applications_limit | INTEGER | Max auto-applies per day (plan-based) |

### Quota Functions

**Atomic Reservation** (PostgreSQL function):
```sql
-- supabase\migrations\20260125000000_add_applications_quota_tracking.sql
CREATE FUNCTION check_and_reserve_application_quota(
  p_user_id UUID,
  p_applications_needed INTEGER DEFAULT 1
) RETURNS INTEGER
```
Returns number of applications that can be made (0 to p_applications_needed).

### Quota Enforcement Points

1. **Job Search** (`/api/jobs/search`):
   - Checks `jobs_fetched` vs `jobs_limit`
   - Updates quota after fetching
   - Returns 429 if exceeded

2. **Auto-Apply Process** (`/api/auto-apply/process`):
   - Full-auto: Reserves quota upfront
   - Assisted: No reservation until confirmation

3. **User Submit** (`/api/jobs/[id]/submit`):
   - Reserves 1 application quota
   - Returns 429 with quota info if exceeded

### Quota Reset
- Quotas reset at **midnight** (date-based partitioning)
- New records created automatically for each day

---

## 5. Supported ATS Platforms

Defined in `src\lib\auto-apply\platform-detector.ts`:

### Fully Supported (Scrapable)
- Greenhouse, Lever, Ashby
- Workday, SmartRecruiters, Rippling
- iCIMS, Taleo, Workable
- TeamTailor, BambooHR, JazzHR
- Jobvite, Personio, Recruitee
- Breezy HR, Freshteam, GoHire
- Comeet, Pinpoint, Polymer
- SAP SuccessFactors, Dayforce
- Paylocity, Paycom, ADP, Zoho Recruit
- Generic ATS (URLs with /jobs/, /careers/, /apply)

### API-Enabled (Questions from API)
- Greenhouse
- Lever
- Ashby

### NOT Supported (Require Login)
- LinkedIn
- Indeed
- Glassdoor

### Aggregators (Redirect Elsewhere)
- Jobgether, Remotive, WeWorkRemotely, FlexJobs
- Remote.co, RemoteOK, AngelList, Dice, Monster, ZipRecruiter

---

## 6. Database Tables Summary

### Core Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User data, preferences, subscription info |
| `jobs` | Job listings per user |
| `user_job_quotas` | Daily quota tracking |
| `application_history` | Submitted applications log |
| `saved_answers` | Reusable answers for common questions |

### Auto-Apply Tables
| Table | Purpose |
|-------|---------|
| `scraped_questions` | Extracted form fields per job |
| `application_queue` | Pending/processing submissions |
| `platform_credentials` | Encrypted ATS credentials (future use) |
| `scraper_failures` | Failed scrape attempts for debugging |

### Subscription Tables
| Table | Purpose |
|-------|---------|
| `customers` | Stripe customer mapping |
| `subscriptions` | Stripe subscription details |
| `tester_invites` | Tester invite codes |

---

## Key Resources

- **Plan Limits**: `src\lib\stripe\plans.ts`
- **Feature Config**: `src\lib\features\config.ts`
- **Type Definitions**: `src\lib\supabase\types.ts`
- **Auto-Apply Process**: `src\app\api\auto-apply\process\route.ts`
- **Job Search**: `src\app\api\jobs\search\route.ts`
- **Platform Detector**: `src\lib\auto-apply\platform-detector.ts`
- **Quota Migration**: `supabase\migrations\20260125000000_add_applications_quota_tracking.sql`
- **Auto-Apply Mode Migration**: `supabase\migrations\20260125000000_add_auto_apply_mode.sql`
- **Tester System Migration**: `supabase\migrations\20260125000000_add_tester_system.sql`

---

## Implementation Notes

1. **Quota Enforcement**: Always use `getDailyJobQuota()` and `getDailyApplicationQuota()` from plans.ts rather than hardcoding values

2. **Tester Bypass**: Use `canAccessFeature(plan, feature, isTester)` which automatically grants ultra-level access to testers

3. **Mode Safety**: Default to `assisted` mode - it's safer as users review before submission

4. **Status Visibility**: Jobs with `login_required` or `scrape_failed` are hidden from users - use `getVisibleJobStatusFilter()` when querying

5. **Cover Letter Generation**: Auto-generated using GPT-4o-mini, creates .docx files stored as base64 in answers

6. **Stripe Webhooks**: Handle all subscription lifecycle events - plan changes update quotas immediately

---

## Open Questions

1. **Worker Implementation**: The actual form submission worker (droplet) code is not in the codebase - needs separate deployment
2. **Session Management**: Platform credentials table exists but session reuse logic not implemented
3. **Retry Strategy**: Max retries defined in scraped_questions but retry scheduling logic unclear
4. **Multi-instance Deduplication**: Stripe webhook idempotency uses in-memory cache - may need Redis for multi-instance deployments
