# JobSilver Changelog

## 2026-01-29 - Major Cleanup: Auto-Apply System Removal

**Task:** Complete removal of deprecated auto-apply functionality

**Purpose:** JobSilver has pivoted from an auto-apply service to a manual apply workflow with AI assistance. This cleanup removes all code related to automated job application submission, question scraping, and the Playwright-based automation worker.

### Architectural Change

**Before:** The app would automatically scrape job application forms, extract questions, generate answers with AI, and submit applications on behalf of users.

**After:** Users search for jobs, save them to their kanban board, click "Apply" to be redirected to the external job posting, and use the AI assistant for help with application questions and cover letters.

### Directories Deleted

| Directory | Description |
|-----------|-------------|
| `automation-worker/` | Playwright-based worker (~50+ files) for scraping ATS sites and auto-submitting applications |
| `src/lib/auto-apply/` | Auto-apply utilities (encryption, login detection, platform detection, scraper failures) |
| `deploy/` | Deployment scripts for the automation worker (DigitalOcean droplet setup, PM2 config) |
| `scripts/` | Test scripts for scraping and auto-apply testing |

### API Routes Deleted

| Route | Purpose |
|-------|---------|
| `/api/jobs/[id]/submit` | Submit auto-filled application |
| `/api/jobs/[id]/application-data` | Get scraped questions and answers |
| `/api/jobs/retry-failed` | Retry failed auto-applications |
| `/api/credentials` | Store LinkedIn/Indeed credentials |
| `/api/preferences/auto-apply-mode` | Set auto-apply mode (full_auto/assisted/manual) |
| `/api/production-mode/toggle` | Toggle auto-apply production mode |
| `/api/cron/recover-stale-jobs` | Recover jobs stuck in scraping/submitting states |
| `/api/admin/test-scraper` | Admin endpoint for testing scrapers |
| `/api/admin/scraper-failures` | Admin endpoint for viewing scraper failures |
| `/api/admin/application-failures` | Admin endpoint for viewing application failures |

### Library Files Deleted

| File | Purpose |
|------|---------|
| `src/lib/admin/test-scraper.ts` | Admin scraper testing utilities |
| `src/lib/admin/sync-scraper.ts` | Scraper synchronization logic |
| `src/lib/admin/dry-run-applier.ts` | Dry-run application testing |
| `src/lib/auto-apply/encryption.ts` | Credential encryption for stored passwords |
| `src/lib/auto-apply/login-detector.ts` | Detect login requirements on ATS pages |
| `src/lib/auto-apply/platform-detector.ts` | Detect ATS platform from URL |
| `src/lib/auto-apply/scraper-failures.ts` | Track and manage scraper failures |

### Other Files Deleted

| File | Purpose |
|------|---------|
| `src/remotion/compositions/features/AutoApplyDemo.tsx` | Remotion video showing auto-apply feature |
| `test-cv.txt` | Test file |
| `nul` | Junk file |

### Files Modified

#### `src/app/(dashboard)/admin/page.tsx`
- **Removed tabs:** "Scrape Fails" and "Apply Fails"
- **Removed state:** `failures`, `failuresTotal`, `failureStats`, `appFailures`, `appFailuresTotal`, `appFailureStats`
- **Removed functions:** `fetchFailures()`, `fetchAppFailures()`, `markAppFailureReviewed()`, `retryAppFailure()`
- **Remaining tabs:** Users, Reports, API Usage, Testers

#### `src/app/api/jobs/curate/route.ts`
- **Removed functions:** `queueJobForScraping()`, `queueJobForAutoApply()`, `handleScrapingFailure()`
- **Simplified job insert:** Always sets `auto_apply_status: 'manual'`

#### `src/app/api/cron/daily-curation/route.ts`
- **Removed functions:** `queueJobForScraping()`, `queueJobForAutoApply()`, `handleScrapingFailure()`
- **Simplified job insert:** Status is always `'discovered'`, no scraping queue

#### `src/app/api/jobs/search/route.ts`
- **Inlined:** `detectPlatform()` function (was imported from deleted module)
- **Simplified:** Removed scraping queue logic, jobs saved with `auto_apply_status: 'manual'`

#### `vercel.json`
- **Removed cron jobs:** `/api/jobs/retry-failed`, `/api/cron/recover-stale-jobs`
- **Remaining cron:** `/api/cron/daily-curation` (6 AM daily)

#### `src/lib/security/validation.ts`
- **Removed schemas:** `scraperFailuresUpdateSchema`, `scraperFailuresDeleteSchema`, `testScraperRequestSchema`

#### `src/lib/security/rate-limit.ts`
- **Removed configs:** `scraping`, `apply` rate limit configurations

#### `src/components/chat/ChatProvider.tsx`
- **Updated:** Page descriptions to remove auto-apply references

#### `src/components/report/ReportProblemDialog.tsx`
- **Updated:** "Incorrect Questions" description (removed "scraped" wording)

#### `src/remotion/Root.tsx` and `src/remotion/compositions/features/index.ts`
- **Removed:** AutoApplyDemo import and composition

#### `src/components/video/FeatureVideoPlayer.tsx`
- **Removed:** 'auto-apply' from FeatureType union

### Database Impact

**No database migrations were run.** The following tables still exist but are no longer written to:
- `scraped_questions` - Question extraction results
- `application_queue` - Jobs queued for auto-submission
- `scraper_failures` - Failed scraping attempts

These can be dropped in a future cleanup migration. The `auto_apply_status` column on `jobs` table remains but is always set to `'manual'`.

### Build Verification
- Build passes with no errors
- All existing functionality preserved:
  - Job search ✓
  - Job detail viewing ✓
  - AI chat assistant ✓
  - Kanban board ✓
  - Admin panel (4 tabs) ✓

---

## 2026-01-28 - Frontend Agent
**Task:** Phase 2-4 Frontend Updates - AI Assistant Pivot

**Purpose:** Update frontend UI components to reflect the pivot from auto-apply to AI assistant focus. Changed messaging, pricing display, and job card interactions.

### Files Modified

#### src/components/landing/landing-page.tsx
- **Hero subheadline:** Changed from "apply automatically" to "helps you craft perfect applications"
- **Step 3 description:** Changed from "Auto-apply to matches" to "Get AI help answering questions, writing cover letters, and tracking your progress"
- **Problem/Solution card (Send):** Changed from tracking auto-apply to AI assistant helping craft answers and cover letters

#### src/app/pricing/page.tsx
- **Removed:** `jobsPerDay` field from Plan interface
- **Updated PLANS data:** All tiers now show AI-focused features:
  - Free: 5 AI responses/day, 1 cover letter/day
  - Starter: 25 AI responses/day, 5 cover letters/day ($2.99/week, $8.99/month)
  - Pro: 100 AI responses/day, 20 cover letters/day ($6.99/week, $19.99/month)
  - Ultra: Unlimited AI responses and cover letters ($12.99/week, $39.99/month)
- **Updated FAQ:** Replaced "How does auto-apply work?" with "How does the AI assistant help?"
- **Updated Comparison Table:** Replaced auto-apply metrics with AI responses/day, Cover letters/day, CV optimization

#### src/components/dashboard/job-card.tsx
- **Added icons:** MessageSquare, FileEdit, Sparkles for AI quick actions
- **Added props:** `onAIHelp`, `onCoverLetter`, `onMatchAnalysis` handlers
- **Added handlers:** `handleApply` (opens job URL), `handleAIHelp`, `handleCoverLetter`, `handleMatchAnalysis`
- **Added AI Quick Actions:** Help, Letter, and Match buttons on hover (for non-applied jobs)
- **Added Apply button:** Green button that opens job URL in new tab
- **Removed:** Auto-apply status indicators for "ready to submit" states

### Files Created

#### src/components/ai-assistant/usage-indicator.tsx
- Displays remaining AI responses and cover letters for the day
- Two variants: `compact` (tooltip-based) and `full` (card-based)
- Shows progress bars and upgrade prompts when usage is low
- Auto-refreshes usage data every 30 seconds
- Color-coded warnings (amber at 80%, red at limit)

#### src/components/ai-assistant/index.ts
- Barrel export for ai-assistant components

#### src/hooks/use-ai-usage.ts
- Hook for fetching and managing AI usage data
- Provides: `usage`, `isLoading`, `error`, `refresh()`
- Computed properties: `canUseAI`, `canGenerateCoverLetter`, `aiResponsesRemaining`, `coverLettersRemaining`
- Auto-refreshes every 60 seconds

**Dependencies added:** None (uses existing packages)

**Notes:**
- Job card now shows AI quick action buttons on hover instead of auto-apply controls
- Apply button opens the external application URL directly
- Usage indicator can be placed in dashboard header or sidebar to show remaining AI quota

---

## 2026-01-28 - Backend Agent
**Task:** Phase 1 Backend Infrastructure - AI Assistant Pivot

**Purpose:** Implement backend infrastructure for pivoting from auto-apply to AI assistant focus. This includes updating plan limits, creating AI usage tracking, and modifying the chat API.

### Files Created

#### supabase/migrations/20260128000000_add_ai_usage_tracking.sql
- Created `user_ai_usage` table for tracking daily AI feature usage
- Columns: `ai_responses_used`, `cover_letters_generated`, `cv_optimizations_used`
- Unique constraint on (user_id, date) for one row per user per day
- RLS policies for secure access (users can only read/write their own data)
- `increment_ai_usage(p_user_id, p_feature, p_increment)` - Atomic function to increment counters
- `get_daily_ai_usage(p_user_id)` - Function to get current day's usage
- Auto-update trigger for `updated_at` timestamp

#### src/lib/ai/usage-tracker.ts
- `checkCanUseFeature(userId, feature, supabase)` - Check if user can use a feature based on plan limits
- `incrementUsage(userId, feature, supabase)` - Increment usage counter atomically
- `getDailyUsage(userId, supabase)` - Get all usage stats for today
- `getUsageWithLimits(userId, supabase)` - Get usage with plan limit information for display
- `checkNearLimits(userId, supabase)` - Check if user is at 80%+ of any limit
- Supports unlimited quotas (-1 value) for Ultra/Mega plans

#### src/app/api/ai/usage/route.ts
- GET endpoint to return user's daily AI usage stats
- Returns usage counts, plan limits, limit display strings, and near-limit warnings
- Includes plan information and tester status

### Files Modified

#### src/lib/stripe/plans.ts
- **Removed:** `jobs`, `applications` fields from `PlanLimits` interface
- **Added:** `aiResponsesPerDay`, `coverLettersPerDay`, `cvOptimization`, `aiLearning` fields
- **Updated pricing:**
  - Free: $0 - 5 AI responses/day, 1 cover letter/day
  - Starter: $2.99/week - 25 AI responses/day, 5 cover letters/day
  - Pro: $6.99/week - 100 AI responses/day, 20 cover letters/day, CV optimization, AI learning
  - Ultra: $12.99/week - Unlimited AI responses/cover letters, all features
- **Updated helper functions:** `getRemainingQuota`, `isOverLimit`, `getResourceLimit`, `hasFeatureAccess`
- **New exports:** `AIResource` type, `getResourceLimit()`, `formatQuotaDisplay()`
- **Legacy plans:** `basic` and `mega` mapped to Starter and Ultra equivalents

#### src/lib/supabase/types.ts
- Added `user_ai_usage` table types to Database interface (Row, Insert, Update)
- Added `UserAIUsage` type alias
- Added `AIUsageStats` interface
- Added `AIUsageWithLimits` interface for frontend display

#### src/app/api/chat/route.ts
- Imported `checkCanUseFeature` and `incrementUsage` from usage tracker
- Added AI response quota check before processing (returns 429 with upgrade message if exceeded)
- Added usage increment after successful response completion
- Error response includes `QUOTA_EXCEEDED` code with remaining/limit/used counts

### Database Migrations
- `20260128000000_add_ai_usage_tracking.sql`

### New Endpoints
- `GET /api/ai/usage` - Get user's daily AI usage statistics

### Breaking Changes
- `PlanLimits` interface no longer has `jobs` and `applications` fields
- `getRemainingQuota` and `isOverLimit` now take `AIResource` type instead of old resource types
- Chat API now enforces AI response quotas (users may see 429 errors if over limit)

### Notes for Next Agent
- Frontend needs to handle the new `QUOTA_EXCEEDED` error response from chat API
- Consider adding a usage display component to show remaining AI responses
- The `user_ai_usage` table resets daily via the date column (no cron job needed)
- Testers automatically get Ultra-level access (unlimited) via `getEffectivePlan`

---

## 2026-01-26 - Backend Agent
**Task:** Enhanced Multi-Step Form Scraper Architecture

**Purpose:** Build a robust scraper that handles multi-step job application forms across 25+ ATS platforms with detailed tracking and failure flagging.

### Files Modified

#### automation-worker/src/scrapers/base.ts
- Added `ScrapeAttemptResult` interface for detailed scraping status tracking:
  - `questions`, `totalPages`, `pagesScraped`
  - `scrapeConfidence`: 'high' | 'medium' | 'low' | 'failed'
  - `failureReason`, `warnings`, `questionsPerPage`
  - `navigationMethod`, `stuckOnPage` for debugging
- Added `ExpectedFormFields` interface for validation checks
- Added `navigateToNextFormPageEnhanced()` method with 30+ button selectors for all major ATS platforms
- Added `isLastFormPageEnhanced()` method with confidence scoring
- Added `getCurrentPageNumber()` method for progress indicator detection
- Added `getProgressIndicatorInfo()` with 3 detection strategies (text pattern, stepper elements, aria progressbar)
- Added `waitForPageTransition()` to detect URL changes, content changes, or field count changes
- Added `scrapeMultiPageFormEnhanced()` with:
  - Page number tracking per question
  - Consecutive empty page detection
  - Stuck page detection (duplicate content)
  - Progress estimate updates
- Added `validateScrapedQuestions()` for quality validation:
  - Checks for contact info, resume upload, cover letter fields
  - Detects meaningless labels (field-1, undefined, hash strings)
  - Detects duplicate labels
  - Validates field type distribution
- Added `buildFormStructure()` to create FormStructure with validation status

#### automation-worker/src/scrapers/generic.ts
- Added `ApplyFlowResult` interface for detailed apply flow tracking
- Added `executeApplyFlow()` method that orchestrates the full apply flow
- Added `handleApplyModal()` method to handle modal dialogs after clicking Apply:
  - Detects modals with login/guest options
  - Clicks guest/continue buttons automatically
  - Reports when login is required
- Added `tryGuestApplyOption()` and `tryGuestApplyInElement()` methods:
  - 20+ selectors for "Apply manually", "Apply as guest", "Continue as guest", etc.
  - Handles various ATS-specific patterns
- Updated `scrapeQuestions()` to use enhanced multi-page scraping:
  - Returns `ScrapeAttemptResult` with detailed status
  - Builds `FormStructure` with validation status and confidence score

#### automation-worker/src/utils/dom-stability.ts
- Added `PageTransitionResult` interface
- Added `detectPageTransition()` function for transition detection
- Added `getFormContentHash()` function for content comparison
- Added `countVisibleFormFields()` function
- Added `capturePageState()` helper function

### New Features
1. **Multi-step form navigation** - Handles up to 15 form pages with various navigation patterns
2. **Stuck detection** - Detects when scraper is stuck on same page content
3. **Progress tracking** - Detects step indicators (Step 2/5, progress bars, steppers)
4. **Guest apply handling** - Automatically finds and clicks "Apply without account" options
5. **Modal handling** - Handles modals that appear after clicking Apply button
6. **Quality validation** - Validates extracted questions for completeness
7. **Confidence scoring** - Returns 0-100 confidence score with validation checks
8. **Detailed warnings** - Collects warnings throughout scraping for debugging

### Supported ATS Platforms (navigation selectors)
- Greenhouse, Lever, Ashby, Rippling
- SmartRecruiters, TeamTailor, BambooHR, JazzHR
- Jobvite, Workable, Breezy, Personio
- Recruitee, Freshteam, and generic career sites

### Breaking Changes
None - existing API unchanged, new fields are optional.

### Notes for Next Agent
- Task #4 (failure flagging system) is now partially addressed via `scrapeConfidence` and `validation_status`
- The UI may need updates to display `validation_status` and `confidence_score` from `FormStructure`
- Consider adding alerts/notifications when `scrapeConfidence` is 'low' or 'failed'

---

## 2026-01-25 - Research Agent
**Task:** Document Complete Application System Architecture
**Output:** `docs/research/application-system-architecture.md`
**Key findings:**
- 6 subscription tiers (free/starter/pro/ultra + legacy basic/mega) with daily quotas from 5/1 (free) to 50/50 (ultra)
- 3 auto-apply modes: full_auto (submit automatically), assisted (user confirms), manual (no automation)
- 10+ auto_apply_status states forming a state machine from discovery to application
- 25+ supported ATS platforms with scraping, 3 with direct API integration (Greenhouse, Lever, Ashby)
- Tester system grants ultra-level access without admin privileges
- Atomic quota reservation via PostgreSQL function for race-condition safety

---

## 2026-01-25 - Frontend Agent

**Task:** Integrate Tester Invite Flow into Signup/Login Pages

**Purpose:** Allow users signing up with an invite code URL (e.g., `/login?invite=ABC123`) to automatically receive tester status after successful authentication.

**Files modified:**

### Login Page
- `src/app/login/page.tsx`:
  - Added `useSearchParams` hook to detect invite code in URL
  - Added invite status state tracking (checked, valid, code, reason)
  - Added `validateInviteCode()` function to validate invite on page load
  - Added `applyTesterInvite()` function to call tester-signup API
  - Modified `handleSignUp` to apply invite after signup (with localStorage fallback for email confirmation flow)
  - Modified `handleLogin` to check for pending invites from URL or localStorage
  - Modified Google OAuth button to pass invite code in redirect URL
  - Added visual banner showing invite status (valid/invalid) with appropriate styling:
    - Valid invites: Violet/purple themed banner with flask icon
    - Invalid invites: Red themed banner with specific reason (already used, expired, revoked)
  - Auto-switches to signup tab when invite code is detected

### Auth Callback Route
- `src/app/auth/callback/route.ts`:
  - Added `invite` query parameter handling
  - Added `applyTesterInvite()` server-side function to apply tester status
  - After OAuth exchange, checks for invite code and applies tester status
  - Redirects to dashboard with `?tester=activated` on success
  - Includes rollback logic if profile update fails

### Dashboard Page
- `src/app/(dashboard)/dashboard/page.tsx`:
  - Added `useSearchParams` import
  - Added useEffect to detect `tester=activated` URL parameter
  - Shows welcome toast when tester status is activated
  - Cleans up URL after showing toast

**User Flows Supported:**

1. **Email/Password Signup with Invite**
   - User visits `/login?invite=ABC123`
   - Sees "Beta Tester Invite" banner
   - Signs up with email/password
   - If email confirmation required: invite stored in localStorage, applied on next login
   - If no confirmation required: invite applied immediately

2. **OAuth Signup with Invite**
   - User visits `/login?invite=ABC123`
   - Sees "Beta Tester Invite" banner
   - Clicks "Continue with Google"
   - Invite code passed to OAuth callback
   - After OAuth success, invite applied server-side
   - Redirected to dashboard with welcome toast

3. **Existing User Login with Invite**
   - User visits `/login?invite=ABC123` with existing account
   - Signs in
   - Invite applied to existing account
   - Shows "Tester access has been applied" toast

**Design Notes:**
- Invite banner uses violet/purple color scheme matching TesterBadge component
- Invalid invite reasons are user-friendly and specific
- Animations use Framer Motion for smooth reveal
- Follows existing metallic dark theme

**Dependencies added:** None

**Breaking changes:** None

**Notes:**
- localStorage is used as fallback for email confirmation flows
- Server-side invite application (in callback) ensures invite works for OAuth flows
- Invalid invite codes don't block signup - users can still create accounts

---

## 2026-01-25 - Backend Agent

**Task:** Apply Priority Security Fixes (P0, P1, P2)

**Purpose:** Address critical and high priority security vulnerabilities identified in security audit.

**Files created:**

### Database Migrations
- `supabase/migrations/20260125100000_atomic_invite_redemption.sql`:
  - Created `redeem_tester_invite(p_invite_code, p_user_id)` PostgreSQL function
  - Uses `SELECT ... FOR UPDATE` row locking to prevent race conditions
  - Returns JSONB with success status and invite details
  - Atomically marks invite as used AND updates user profile
  - Uses `SECURITY DEFINER` to bypass RLS safely
  - Granted execute to `authenticated` and `service_role`

- `supabase/migrations/20260125100001_fix_tester_invites_rls.sql`:
  - Dropped overly permissive "Anyone can validate tester invites by code" policy
  - Validation now handled via `redeem_tester_invite` function with `SECURITY DEFINER`
  - Prevents information disclosure through RLS enumeration

**Files modified:**

### Tester Signup Route (FIX 1: P0, FIX 3: P1)
- `src/app/api/auth/tester-signup/route.ts`:
  - POST handler now uses atomic `redeem_tester_invite` RPC function
  - Removed separate invite lookup and validation queries
  - Prevents race condition where two users could redeem same invite
  - GET handler now returns generic `{ valid: false }` for all failure cases
  - Removed specific reason codes ('revoked', 'already_used', 'expired')
  - Prevents invite code enumeration attacks

### Auto-Apply Process Route (FIX 2: P1)
- `src/app/api/auto-apply/process/route.ts`:
  - Added rate limiting import from `@/lib/security/rate-limit`
  - Added rate limiting check (10 requests per minute per user)
  - Returns 429 with Retry-After header when limit exceeded
  - Prevents abuse of expensive auto-apply processing endpoint

### Feature Configuration (FIX 5: P2)
- `src/lib/features/config.ts`:
  - Changed `auto_apply` feature requirement from `'starter'` to `'free'`
  - Reflects that free users now have 1 auto-apply per day

### Quota Tracking Migration (FIX 6: P2)
- `supabase/migrations/20260125000000_add_applications_quota_tracking.sql`:
  - Fixed `check_and_reserve_application_quota` function
  - Changed default `jobs_limit` from 20 to 5 (free tier default)
  - Added comment explaining free tier defaults

**Security Fixes Summary:**

| ID | Priority | Issue | Fix |
|----|----------|-------|-----|
| FIX 1 | P0 | Race condition in tester invite redemption | Atomic DB function with row locking |
| FIX 2 | P1 | Missing rate limit on auto-apply process | Added 10 req/min limit |
| FIX 3 | P1 | Information disclosure in invite validation | Generic error responses |
| FIX 4 | P1 | Overly permissive RLS on tester_invites | Dropped public SELECT policy |
| FIX 5 | P2 | auto_apply feature gated to starter | Changed to free (1/day available) |
| FIX 6 | P2 | Wrong jobs_limit default in SQL function | Changed 20 to 5 (free tier) |

**Breaking changes:** None

**Notes:**
- All fixes maintain backward compatibility
- Atomic invite redemption prevents double-spend vulnerabilities
- Rate limiting uses in-memory store (suitable for single instance)
- For multi-instance deployments, consider Redis-based rate limiting

---

## 2026-01-25 - Backend Agent

**Task:** Fix Quota Reservation Timing for Assisted Mode

**Purpose:** Ensure quota is only consumed when users actually submit applications, not during form pre-filling in assisted mode.

**Problem:** Quota was being reserved during auto-apply processing for ALL modes, including assisted mode where the user might never confirm the submission. This wasted users' limited daily quota.

**Solution:** Changed quota reservation timing based on auto-apply mode:
- **full_auto**: Reserve quota during processing (submits automatically)
- **assisted**: Reserve quota at user confirmation time (POST /api/jobs/[id]/submit)

**Files modified:**

### Auto-Apply Processing
- `src/app/api/auto-apply/process/route.ts`:
  - Modified `checkAndReserveApplicationQuota` to only run for `full_auto` mode
  - Updated quota status check to be conditional on mode
  - Updated job limit calculation: assisted mode no longer limited by quota during form filling
  - Response now includes `quota_note` field explaining assisted mode quota behavior
  - Made quota object in response nullable for assisted mode

### Job Submit Endpoint
- `src/app/api/jobs/[id]/submit/route.ts`:
  - Added imports for `SubscriptionPlan`, `getDailyApplicationQuota`, `getDailyJobQuota`
  - Added `ApplicationQuotaResult` interface
  - Added `checkAndReserveApplicationQuota()` function for atomic quota reservation
  - Profile query now includes `subscription_plan`
  - Added quota check before creating queue entry
  - Returns 429 with quota details if daily limit exceeded
  - Success response now includes quota information

### Stale Job Recovery Cron
- `src/app/api/cron/recover-stale-jobs/route.ts`:
  - Added `form_filled_jobs_expired` to `RecoverySummary` interface
  - Added new section to handle jobs stuck in `form_filled` status for >7 days
  - Expired form_filled jobs are reset to `ready_to_apply` status
  - Associated pending application_queue entries are deleted (outdated answers)
  - Logs each expired job with company and title for debugging

**Quota Flow by Mode:**

| Mode | Form Filling | User Confirms | Quota Reserved |
|------|--------------|---------------|----------------|
| `full_auto` | System fills | N/A (auto-submits) | At processing time |
| `assisted` | System fills | User clicks Submit | At confirmation time |
| `manual` | N/A | N/A | N/A |

**New Endpoint Behavior:**

`POST /api/jobs/[id]/submit` now returns:
- `429 QUOTA_EXCEEDED` if daily quota is exhausted
- Response includes `quota` object with remaining, limit, used, resets_at

**Stale Job Recovery:**
- Jobs in `form_filled` status for >7 days are reset to `ready_to_apply`
- Outdated pre-filled answers are cleaned up
- User can re-process the job with fresh form filling

**Breaking changes:** None

**Notes:**
- Free tier users (1 auto-apply/day) benefit most from this fix
- Quota is now truly "pay at confirmation" for assisted mode
- Form_filled expiration prevents accumulation of stale pending applications
- All changes are backward compatible with existing frontend

---

## 2026-01-25 - Frontend Agent

**Task:** Update Dashboard for Auto-Apply Modes and Tester Access

**Purpose:** Implement UI changes for the two auto-apply modes and tester access.

**Files created:**

### Dashboard Components
- `src/components/dashboard/AutoApplyModeSelector.tsx`:
  - Mode selector with three options: Full Auto, Assisted, Manual
  - Compact dropdown version for header display
  - Full card-based selector for settings
  - Visual indicators with icons and colors (emerald for auto, cyan for assisted, zinc for manual)
  - Animated mode hints explaining each option
  - Framer Motion animations for smooth transitions

- `src/components/dashboard/AutoApplyQuotaDisplay.tsx`:
  - Quota display for free tier users showing used/limit
  - Progress bar with color-coded status (cyan for normal, amber for low, red for exhausted)
  - Upgrade prompt when quota is exhausted with time until reset
  - Compact badge version for tight spaces
  - Link to pricing page for upgrades

- `src/components/dashboard/TesterBadge.tsx`:
  - Visual badge showing "Tester" status with flask icon
  - Two variants: default (larger with tooltip) and compact (for menus)
  - Tooltip explaining beta tester benefits
  - Violet/purple color scheme to distinguish from other badges

**Files modified:**

### TypeScript Types
- `src/lib/supabase/types.ts`:
  - Added `AutoApplyMode` type: 'full_auto' | 'assisted' | 'manual'
  - Added `AutoApplyQuota` interface with used, limit, resets_at fields

### Job Card Component
- `src/components/dashboard/job-card.tsx`:
  - Added new props: `onReviewSubmit`, `autoApplyMode`
  - Added "Applied" badge with checkmark for applied jobs
  - Added "Ready" badge (animated pulse) for jobs ready to submit in assisted mode
  - Added "Review" button for ready-to-submit jobs in assisted mode
  - Shows applied date and mode (auto vs manual) in job details
  - Conditional rendering of discard button (hidden for applied jobs)

### Kanban Column Component
- `src/components/dashboard/kanban-column.tsx`:
  - Added `onReviewSubmit` and `autoApplyMode` props
  - Passes props to JobCard components

### Dashboard Layout
- `src/app/(dashboard)/layout.tsx`:
  - Added `isTester` state from profile
  - Added TesterBadge import and component
  - Shows TesterBadge in header for tester users (not admins)
  - Shows TesterBadge in user dropdown menu (compact variant)

### Dashboard Page
- `src/app/(dashboard)/dashboard/page.tsx`:
  - Added `isTester` state from profile
  - Added `autoApplyMode` state with database sync
  - Added `autoApplyQuota` state for free users
  - Added `showModeSettings` state for mode selector visibility
  - Updated search bar visibility: shows for admins AND testers
  - Added AutoApplyModeSelector (compact) in stats area
  - Added AutoApplyQuotaDisplay for free tier users
  - Added handleReviewSubmit function for assisted mode
  - Passes autoApplyMode to KanbanColumn components
  - Fetches auto-apply quota from user_job_quotas table

**Design Notes:**
- Auto-apply mode colors: emerald (full auto), cyan (assisted), zinc (manual)
- Tester badge color: violet/purple to stand out
- Quota display uses cyan for normal, amber for warning, red for exhausted
- All animations use Framer Motion for consistency
- Components follow existing metallic/silver theme

**Breaking changes:** None

**Notes:**
- Testers see search button (same visibility as admins) but NOT admin navigation
- Auto-apply mode persists to profiles table when changed
- Free tier quota display only shows for free plan users
- "Review" button navigates to job detail page with ?review=true param
- Applied jobs show timestamp and whether applied via auto or manual

---

## 2026-01-25 - Backend Agent

**Task:** Implement Two Auto-Apply Modes (Full Auto vs Assisted)

**Purpose:** Allow users to choose between automatic submission and review-before-submit workflows

**Files created:**

### Database Migration
- `supabase/migrations/20260125000000_add_auto_apply_mode.sql`:
  - Created `auto_apply_mode_type` ENUM with values: 'full_auto', 'assisted', 'manual'
  - Added `auto_apply_mode` column to profiles table (default: 'assisted' for safety)
  - Added index for efficient queries on auto_apply_mode
  - Updated comments to document 'form_filled' status for jobs

### API Endpoints
- `src/app/api/preferences/auto-apply-mode/route.ts`:
  - `GET` - Retrieve user's current auto-apply mode with descriptions
  - `PUT` - Update user's auto-apply mode preference
  - Rate limited (60 req/min)
  - Returns mode options with labels and descriptions for UI

- `src/app/api/jobs/[id]/submit/route.ts`:
  - `POST` - Submit application for assisted mode (user confirmation)
  - `GET` - Get submission status for a job
  - Validates job is in 'ready_to_apply' or 'form_filled' status
  - Creates application queue entry and updates job to 'submitting'
  - Rate limited (10 req/min for submissions)
  - Records application in history

**Files modified:**

### TypeScript Types
- `src/lib/supabase/types.ts`:
  - Added `auto_apply_mode: AutoApplyMode` to profiles Row, Insert, and Update
  - Added `'form_filled'` to `AutoApplyStatus` type for assisted mode jobs

### Auto-Apply Processing
- `src/app/api/auto-apply/process/route.ts`:
  - Added import for `AutoApplyMode`
  - Profile select now includes `auto_apply_mode`
  - Added early return for 'manual' mode (no processing)
  - Split processing logic based on mode:
    - **full_auto**: Creates queue entry, sets status to 'submitting'
    - **assisted**: Creates queue entry with answers, sets status to 'form_filled'
  - Response includes mode and summary (queued, form_filled, errors counts)

**New endpoints:**
- `GET /api/preferences/auto-apply-mode` - Get current mode
- `PUT /api/preferences/auto-apply-mode` - Update mode
- `POST /api/jobs/[id]/submit` - Confirm submission (assisted mode)
- `GET /api/jobs/[id]/submit` - Get submission status

**Auto-Apply Modes:**

| Mode | Description | Job Status Flow |
|------|-------------|-----------------|
| `full_auto` | System automatically submits | ready_to_apply -> submitting -> applied |
| `assisted` | System fills forms, user confirms | ready_to_apply -> form_filled -> submitting -> applied |
| `manual` | No automatic processing | User handles everything |

**Breaking changes:** None

**Notes:**
- Default mode is 'assisted' for new users (safer, allows review)
- Existing users without mode set will default to 'assisted'
- 'form_filled' jobs show pre-filled answers for user review
- User clicks submit endpoint to confirm and queue for submission
- Full auto mode works exactly as before for users who want it

---

## 2026-01-25 - Backend Agent

**Task:** Implement Tester Role and Link System

**Purpose:** Allow special signup links to grant users full Ultra-level access for testing purposes.

### Database Changes
- `supabase/migrations/20260125000000_add_tester_system.sql`:
  - Added `is_tester` (BOOLEAN default false) to profiles table
  - Added `tester_invite_code` (TEXT nullable) to profiles table
  - Created `tester_invites` table with columns:
    - `id` (UUID, primary key)
    - `invite_code` (TEXT, unique) - the code used in signup URLs
    - `created_by` (UUID, FK to profiles) - admin who created it
    - `used_by` (UUID, FK to profiles, nullable) - who used it
    - `used_at` (TIMESTAMPTZ, nullable)
    - `expires_at` (TIMESTAMPTZ, nullable)
    - `is_active` (BOOLEAN, default true)
    - `created_at`, `updated_at` (TIMESTAMPTZ)
  - Added RLS policies for admin-only management
  - Added service role policy for signup process
  - Added indexes for efficient lookups

### API Endpoints
- `src/app/api/admin/testers/route.ts`:
  - `GET` - List all testers and invite codes (admin only)
  - `POST` - Generate new invite code (admin only, returns signup URL)
  - `PATCH` - Update user's tester status (admin only)
  - `DELETE` - Revoke an invite code (admin only)

- `src/app/api/auth/tester-signup/route.ts`:
  - `GET ?code=XXX` - Validate an invite code (public, for signup page)
  - `POST` - Apply invite code to current user after signup

### TypeScript Types
- `src/lib/supabase/types.ts`:
  - Added `is_tester: boolean` and `tester_invite_code: string | null` to profiles
  - Added `tester_invites` table definition to Database interface
  - Added `TesterInvite` interface
  - Added `TesterInviteWithCreator` interface for admin views

### Feature Access
- `src/lib/features/config.ts`:
  - Added `TESTER_EQUIVALENT_PLAN = 'ultra'` constant
  - Updated `canAccessFeature(plan, feature, isTester?)` to grant testers ultra-level access
  - Added `getEffectivePlan(plan, isTester?)` helper function
  - Updated `getFeaturesForPlan(plan, isTester?)` to support tester status

### Access Rules
- Testers get Ultra-level feature access (all features enabled)
- Testers do NOT have admin access (separate from is_admin flag)
- Testers can access the search button and all job features
- Invite codes are 8-character hex strings (e.g., "A1B2C3D4")
- Signup URL format: `/signup?invite=CODE`

**Breaking changes:** None

**Notes:**
- Invite codes are one-time use
- Admins can revoke invite codes (sets is_active=false)
- Admins can manually grant/remove tester status via PATCH
- Rate limiting applied to all endpoints (stricter for auth/validation)
- Invite code validation prevents enumeration attacks

---

## 2026-01-25 - Backend Agent

**Task:** Update Pricing/Quota System - Free Tier Limits

**Files modified:**

### Pricing Configuration
- `src/lib/stripe/plans.ts`:
  - Updated free tier `jobs` limit: 3 -> 5
  - Updated free tier `applications` limit: 0 -> 1
  - Updated free tier features array to reflect "5 job matches per day" and "1 auto-apply per day"

### Job Search Route
- `src/app/api/jobs/search/route.ts`:
  - Added imports for `PLAN_LIMITS`, `getDailyJobQuota`, `getDailyApplicationQuota` from plans.ts
  - Removed hardcoded `DAILY_JOB_LIMIT = 20` constant
  - Added `getPlanJobLimit()` helper function to get plan-based limits
  - Updated `checkAndUpdateQuota()` to accept `userPlan` parameter and use plan-based limits
  - Updated `getQuotaStatus()` to accept `userPlan` parameter
  - Reordered profile fetch to happen BEFORE quota check (needed plan info first)
  - Quota records now created with plan-based job and application limits
  - Quota limits are auto-updated if user's plan changes

### Auto-Apply Route
- `src/app/api/auto-apply/process/route.ts`:
  - Added imports for `getDailyApplicationQuota`, `getDailyJobQuota` from plans.ts
  - Added `ApplicationQuotaResult` interface for quota tracking
  - Added `checkAndReserveApplicationQuota()` function with atomic reservation support
  - Added `getApplicationQuotaStatus()` function for quota checks
  - Updated profile select to include `subscription_plan`
  - Added quota check before processing jobs (returns 429 if exceeded)
  - Job query now limited by remaining quota
  - Reserved quota before processing jobs
  - Response now includes quota information (remaining, limit, used, resets_at)

### TypeScript Types
- `src/lib/supabase/types.ts`:
  - Added `applications_used: number` to user_job_quotas Row
  - Added `applications_limit: number` to user_job_quotas Row
  - Added corresponding Insert and Update fields

**Database migrations:**
- `20260125000000_add_applications_quota_tracking.sql`:
  - Added `applications_used` column to user_job_quotas (INTEGER DEFAULT 0)
  - Added `applications_limit` column to user_job_quotas (INTEGER DEFAULT 1)
  - Added index for efficient application quota lookups
  - Created `check_and_reserve_application_quota` PostgreSQL function for atomic quota reservation
  - Function uses row locking (`FOR UPDATE`) to prevent race conditions
  - Granted execute permissions to `authenticated` and `service_role`

**New Quota Limits by Plan:**
```
Plan      | Jobs/Day | Auto-Applies/Day
----------|----------|-----------------
Free      | 5        | 1
Starter   | 10       | 10
Basic     | 10       | 10
Pro       | 25       | 25
Ultra     | 50       | 50
Mega      | 50       | 50
```

**Breaking changes:** None

**Notes:**
- Free tier users now get 5 job matches and 1 auto-apply per day (previously 3 jobs, 0 auto-applies)
- Quota enforcement is plan-aware and updates automatically when user upgrades/downgrades
- Daily quota resets at midnight (local server time)
- Auto-apply quota is tracked separately from job discovery quota
- Both quotas use atomic database functions to prevent race conditions

---

## 2026-01-25 - Frontend Agent

**Task:** Add Tester Management UI to Admin Dashboard

**Files modified:**

### Admin Dashboard
- `src/app/(dashboard)/admin/page.tsx`:
  - Added new "Testers" tab to admin dashboard
  - Added tester-related icon imports (FlaskConical, Link2, Copy, Plus, UserMinus, Ticket)
  - Added TypeScript interfaces: TesterInviteStatus, TesterInvite, Tester, TesterStats
  - Added state variables for testers, invites, and stats management
  - Added tester management functions: fetchTesters, generateInviteCode, revokeInvite, removeTesterStatus, copyInviteLink
  - Added getInviteStatusBadgeColor helper for invite status badges
  - Updated header stats grid from 5 to 6 columns to include Testers count
  - Added "Testers" tab trigger with FlaskConical icon and count
  - Created comprehensive Testers tab content with:
    - Quick stats cards (Total Testers, Active Invites, Used Invites, Expired/Revoked)
    - Invite Codes section with generate button, code list, copy/revoke actions
    - Active Testers list showing user details, plan, tester badge, invite code used
  - Added confirmation dialogs for revoking invites and removing tester status
  - Updated Refresh All button to include fetchTesters

**Features implemented:**

1. **Tester Invite Management**
   - Generate new invite codes with auto-copy functionality
   - View all invite codes with status (active, used, revoked, expired)
   - Copy invite link to clipboard with visual feedback
   - Revoke unused invite codes with confirmation dialog
   - Full invite URL format: `{site}/signup?invite={code}`

2. **Testers List**
   - View all users with tester status
   - Display actual subscription plan alongside tester badge
   - Show signup date, tester activation date, and invite code used
   - Remove tester status (demote to free) with confirmation dialog

3. **Quick Stats**
   - Total testers count
   - Active invite codes
   - Used invite codes
   - Expired/revoked invites

4. **UI Design**
   - Teal accent color for tester-related elements
   - Matches existing admin dashboard metallic dark theme
   - Badge system for invite status and tester identification
   - Responsive grid layouts for stats cards

**API Integration (endpoints expected):**
- `GET /api/admin/testers` - List testers and invites
- `POST /api/admin/testers` - Generate new invite (action: generate_invite)
- `DELETE /api/admin/testers` - Revoke invite or remove tester status

**Security:**
- Only visible to admin users (is_admin check from profiles)
- Testers do NOT have access to this section despite elevated access

**Dependencies added:** None (uses existing lucide-react icons)

**Notes:**
- UI is complete and ready for backend API integration
- Invite codes display as monospace text for readability
- All actions include loading states and toast feedback
- Design follows established patterns from existing admin tabs

---

## 2026-01-25 - Frontend Agent

**Task:** Update Pricing Page with New Pricing Structure

**Files modified:**

### Pricing Page
- `src/app/pricing/page.tsx`:
  - Updated Free plan: jobsPerDay from 3 to 5
  - Updated Free plan features to include "1 auto-apply per day" as included feature
  - Updated comparison table to show "1/day" for Free auto-apply instead of dash
  - Updated FAQ about auto-apply to mention Free tier gets 1 auto-apply per day
  - Updated jobs indicator to show "1 auto-apply included" for Free plan

### Pricing Card Component
- `src/components/pricing/PricingCard.tsx`:
  - Updated PRICING_PLANS constant for Free plan (5 jobs/day, 1 auto-apply highlighted)
  - Updated jobs indicator text to differentiate Free ("1 auto-apply included") from paid plans

**Pricing Structure:**
| Plan | Jobs/Day | Auto-Apply | Price |
|------|----------|------------|-------|
| Free | 5 | 1/day | $0 |
| Starter | 10 | All 10 | $14.99/mo |
| Pro | 25 | All 25 | $29.99/mo (3-day trial) |
| Ultra | 50 | All 50 | $59.99/mo |

**Key Messaging:**
- Free tier now emphasizes "1 auto-apply per day" as a feature (not limitation)
- Upgrade value proposition: "Upgrade to apply to all your daily matches automatically"
- Comparison table shows specific auto-apply limits per plan

**Dependencies added:** None

**Notes:**
- PLAN_LIMITS in `src/lib/stripe/plans.ts` was already correctly configured
- All pricing components now consistently reflect the new Free tier auto-apply feature
- FAQ updated to clarify auto-apply availability across all tiers

---

## 2026-01-24 - QA Agent

**Task:** Re-Audit AI Learning System - Post-Fix Verification

**Issues verified:** 6 P0/P1 issues checked

**Files reviewed:**
- `src/lib/ai/preference-learning.ts`
- `src/lib/ai/preference-scoring.ts`
- `src/app/api/chat/tools.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/interactions/route.ts`
- `src/app/api/jobs/search/route.ts`
- `src/app/api/preferences/reset/route.ts`
- `supabase/migrations/20260124000000_add_ai_learning_tables.sql`
- `src/lib/supabase/types.ts`

**Tests run:** TypeScript type checking (`npx tsc --noEmit`) - PASSED

**Status:** PASS - All P0/P1 issues verified as fixed

**Verification Results:**

1. **P0: Table name mismatch** - VERIFIED FIXED
   - `preference-learning.ts` line 619: Uses `user_preferences` (correct)
   - `preference-learning.ts` line 675: Uses `user_preferences` (correct)
   - `chat/tools.ts` line 862: Uses `user_preferences` (correct)
   - `preference-scoring.ts` line 551: Uses `user_preferences` (correct)

2. **P1: Type mismatch (arrays vs Record<string,number>)** - VERIFIED FIXED
   - `upsertUserPreferences()`: Converts arrays to `Record<string, number>` with weighted scores (lines 624-648)
   - `getUserPreferences()`: Properly handles JSONB as `Record<string, number>` and converts back to arrays (line 692-695)
   - `UserPreferences` interface: Correctly typed as `Record<string, number>` for all JSONB fields (types.ts lines 1466-1485)

3. **P1: Missing RLS INSERT policy for user_preferences** - VERIFIED FIXED
   - Migration includes `CREATE POLICY "Users can insert own preferences"` (line 134-135)
   - Also has service role policy for background processing (lines 141-144)

4. **P1: Learning settings enforcement** - VERIFIED FIXED
   - `interactions/route.ts`: Checks `track_interactions` setting (lines 118-136)
   - `chat/route.ts`: Checks `use_for_chat` setting (lines 291-299)
   - `jobs/search/route.ts`: Checks `use_for_recommendations` setting (lines 932-940)

5. **P1: Feature gating on interactions API** - VERIFIED FIXED
   - `interactions/route.ts`: Has `canAccessFeature(userPlan, 'ai_learning')` check (lines 97-115)
   - Returns 403 FEATURE_GATED error for non-Pro/Ultra users

6. **P1: Partial reset failure handling** - VERIFIED FIXED
   - `preferences/reset/route.ts`: Tracks errors for each deletion (lines 64-97)
   - Returns 500 PARTIAL_FAILURE if ANY deletion fails (lines 99-111)
   - Only claims success if ALL deletions succeed

**No new issues found:**
- TypeScript compilation passes with no errors
- All imports are correct and functional
- Error handling patterns are consistent
- No regressions detected

**Notes:**
- All P0/P1 fixes have been properly implemented
- Code follows established patterns in the codebase
- Type safety is maintained throughout the AI Learning module

---

## 2026-01-24 - Backend Agent

**Task:** Integrate Learned Preferences with Job Scoring and AI Chat

**Files created:**

### Core Module
- `src/lib/ai/preference-scoring.ts`: Preference scoring module for job matching:
  - `computePreferenceScore(job, preferences)` - Scores jobs based on user preferences
  - `computeFinalJobScore(job, cvMatchScore, preferences)` - Blends CV match with preference score
  - `injectDiversity(scoredJobs, allJobs)` - Adds 20% exploration jobs to prevent filter bubbles
  - `getUserLearnedPreferences(userId)` - Fetches preferences from `user_preferences` table
  - `formatPreferencesForAI(preferences)` - Formats preferences for AI chat system prompt
  - Scoring breakdown: industry, salary, remote, keywords, company
  - Confidence-scaled influence: none=0, low=0.2, medium=0.5, high=0.8

**Files modified:**

### Job Search API
- `src/app/api/jobs/search/route.ts`:
  - Added preference scoring imports
  - Fetches `subscription_plan` with profile data
  - Checks `canAccessFeature(userPlan, 'ai_learning')` for Pro/Ultra gating
  - After CV scoring, applies preference scoring if user has Pro/Ultra
  - Injects diversity (20% exploration jobs) to scored results
  - Adds `preference_reasons` and `is_exploration` to job response
  - Response includes `preference_scoring` stats (enabled, confidence, exploration count)

### AI Chat Integration
- `src/app/api/chat/route.ts`:
  - Added imports for `getUserLearnedPreferences`, `formatPreferencesForAI`
  - Fetches user's subscription plan from profile
  - For Pro/Ultra users with preferences, injects formatted preferences into system prompt
  - Section header: "User's Learned Job Preferences ({confidence} confidence)"

- `src/app/api/chat/tools.ts`:
  - Added `get_user_preferences` tool definition
  - Tool returns user's learned preferences including:
    - Confidence level
    - Industry preferences
    - Salary range and importance
    - Remote work preference (with human-readable description)
    - Preferred/avoided companies
    - Positive/negative keywords (top 10 each)
    - Seniority preference
    - Interaction and favorite counts
  - Feature gated to Pro/Ultra plans

### Bug Fixes
- `src/app/api/jobs/[id]/favorite/route.ts`: Fixed `validationError.errors` to `validationError.issues` (Zod API)
- `src/app/api/preferences/route.ts`:
  - Fixed Zod `z.record()` to include key schema `z.record(z.string(), z.number())`
  - Fixed `validationError.errors` to `validationError.issues`
- `src/app/api/preferences/settings/route.ts`: Fixed `validationError.errors` to `validationError.issues`
- `src/app/api/jobs/favorites/route.ts`: Fixed `checkFeatureAccess` to use `canAccessFeature`
- `src/app/api/preferences/match/route.ts`: Fixed `checkFeatureAccess` to use `canAccessFeature`

**New chat tool:**
- `get_user_preferences` - Retrieves user's learned job preferences for personalized AI assistance

**API Response Enhancement:**
- Job search response now includes:
  - `preference_reasons: string[]` - Why job matches preferences
  - `is_exploration: boolean` - Whether job is a diversity pick
  - `preference_scoring: { enabled, confidence?, exploration_jobs?, reason? }` - Scoring metadata

**Scoring Algorithm:**
```typescript
// Blending formula
finalScore = cvMatchScore * (1 - influence) + preferenceScore * influence

// Influence by confidence
influence = { none: 0, low: 0.2, medium: 0.5, high: 0.8 }

// Preference score breakdown (weights sum to 1.0)
industryMatch: 0.25
salaryMatch: 0.20
remoteMatch: 0.20
keywordMatch: 0.20
companyMatch: 0.15

// Diversity injection
DIVERSITY_PERCENT = 0.20 // 20% exploration jobs
```

**Breaking changes:** None

**Notes:**
- All preference features gated behind Pro/Ultra subscription plans
- Free users get standard CV-based matching without preference personalization
- Diversity injection ensures users see opportunities outside their comfort zone
- Preferences integrate with chat for personalized job recommendations
- Uses `user_preferences` table (from `add_preference_learning_tables` migration)

---

## 2026-01-24 - Frontend Agent

**Task:** Implement Favorites UI and Preference Dashboard for AI Learning System

**Files created:**

### UI Components
- `src/components/ui/tooltip.tsx`: Radix-based Tooltip component with dark theme styling for showing hints and descriptions on hover

### Dashboard Components
- `src/components/dashboard/FavoriteButton.tsx`: Heart icon button for favoriting jobs
  - Optimistic UI updates with API sync
  - Animated heart fill with particle burst effect on favorite
  - Pro/Ultra gating with lock icon and upgrade tooltip for free users
  - Three sizes: sm, md, lg
  - Tooltip support for contextual hints

- `src/components/dashboard/PreferenceMatch.tsx`: Match percentage badge for job cards
  - Score-based color theming (emerald for 85%+, teal for 70%+, amber for 55%+, zinc below)
  - Expandable reasons list on click
  - Tooltip version for compact display
  - Shows reasons like "Matches React preference", "Similar salary"

### Pages
- `src/app/(dashboard)/preferences/page.tsx`: Full AI Learning Preferences dashboard
  - Learning status card with confidence level and stats
  - Preferred industries with progress bars
  - Salary range display with override inputs
  - Work style (remote preference) visualization
  - Preferred/avoided companies display
  - Positive keywords section (green themed) with add/remove
  - Negative keywords section (red themed) with add/remove
  - Settings toggles for learning, tracking, recommendations, chat integration
  - Reset all confirmation dialog
  - Premium gate with upgrade prompt for free users

**Files modified:**

### Job Card Integration
- `src/components/dashboard/job-card.tsx`:
  - Added FavoriteButton import and integration
  - Added PreferenceMatch badge display
  - Added useSubscription hook for plan detection
  - Extended props with onFavoriteToggle, preferenceReasons, preferenceScore
  - Conditional rendering for Pro/Ultra users only

### Job Detail Page
- `src/app/(dashboard)/jobs/[id]/page.tsx`:
  - Added FavoriteButton next to job title in header
  - Added "Why you might like this" section with reasons list (emerald themed)
  - Fetches favorite status and preference match reasons for premium users
  - Added useSubscription hook integration

### Kanban Column
- `src/components/dashboard/kanban-column.tsx`:
  - Added onFavoriteToggle prop to interface
  - Passes onFavoriteToggle to JobCard components

### Dashboard Page
- `src/app/(dashboard)/dashboard/page.tsx`:
  - Added Favorites filter toggle (All Jobs | Favorites)
  - Added favorite IDs state and sync with API
  - Added handleFavoriteToggle function
  - Extended filterJobs to support showFavoritesOnly filter
  - Passes handleFavoriteToggle to KanbanColumn
  - Added Heart icon import and useSubscription hook

### Navigation
- `src/app/(dashboard)/layout.tsx`:
  - Added Brain icon import
  - Added premiumNavigation object for AI Preferences link
  - Added isPremium state based on subscription plan
  - Added AI Preferences link to desktop navigation (Pro/Ultra only)
  - Added AI Preferences link to mobile navigation
  - Added AI Preferences link to user dropdown menu

### API Endpoints (Supporting Frontend)
- `src/app/api/jobs/favorites/route.ts`: GET endpoint to fetch all favorite job IDs for dashboard filter
- `src/app/api/preferences/match/route.ts`: GET endpoint to fetch preference match reasons for a specific job

**Dependencies added:**
- `@radix-ui/react-tooltip` - For tooltip component

**Design Notes:**
- Follows existing metallic/silver theme with zinc colors
- FavoriteButton uses rose/pink accent for favorited state
- PreferenceMatch uses score-based color gradient (emerald > teal > amber > zinc)
- Preferences page uses subtle colored sections for positive/negative keywords
- All animations use Framer Motion for consistency
- Mobile-responsive layouts throughout

**Notes:**
- All new features are gated behind Pro/Ultra subscription plans
- Free users see lock icons with upgrade tooltips
- Optimistic UI updates with automatic revert on API errors
- Preference data is fetched from existing backend API endpoints
- Components integrate seamlessly with existing design system

---

## 2026-01-24 - Backend Agent

**Task:** Implement Database Schema & API Routes for AI Learning System

**Files created:**

### Database Migration
- `supabase/migrations/20260124000000_add_ai_learning_tables.sql`: Creates 4 tables for AI preference learning:
  - `user_favorite_jobs` - Jobs marked as favorites with optional reason
  - `user_interactions` - All job interactions (view, save, apply, discard, etc.)
  - `user_preferences` - Computed preference profile from behavior
  - `user_learning_settings` - User settings for learning feature
  - All tables have RLS enabled with user-scoped policies
  - Service role policies for background processing
  - Auto-update triggers for updated_at timestamps

### API Endpoints
- `src/app/api/jobs/[id]/favorite/route.ts`:
  - `GET` - Check if job is favorited
  - `POST` - Add job to favorites, track interaction
  - `DELETE` - Remove from favorites, track unfavorite interaction
  - Feature gated to Pro/Ultra plans

- `src/app/api/preferences/route.ts`:
  - `GET` - Get user's learned preferences
  - `PUT` - Update/override specific preferences (user corrections)
  - Feature gated to Pro/Ultra plans

- `src/app/api/preferences/reset/route.ts`:
  - `POST` - Reset all learned data (preferences, interactions, favorites)
  - Rate limited to 10 per hour

- `src/app/api/preferences/settings/route.ts`:
  - `GET` - Get learning settings
  - `PUT` - Update learning settings (enable/disable tracking, recommendations, chat)

**Files modified:**

- `src/lib/supabase/types.ts`:
  - Added `InteractionType` and `ConfidenceLevel` types
  - Added `UserFavoriteJob`, `UserInteraction`, `UserPreferences`, `UserLearningSettings` interfaces
  - Added Database interface definitions for all 4 new tables

- `src/lib/features/config.ts`:
  - Added `ai_learning` feature with Pro plan minimum requirement
  - Added feature info for upgrade prompts

**Database migrations:**
- `20260124000000_add_ai_learning_tables.sql` - Creates:
  - `user_favorite_jobs` table with unique (user_id, job_id) constraint
  - `user_interactions` table with interaction type validation
  - `user_preferences` table matching preference-learning.ts schema
  - `user_learning_settings` table for user controls
  - RLS policies for all tables
  - Indexes for efficient queries
  - Auto-update triggers for timestamps

**New endpoints:**
- `GET/POST/DELETE /api/jobs/[id]/favorite` - Manage job favorites
- `GET/PUT /api/preferences` - Manage learned preferences
- `POST /api/preferences/reset` - Reset all learning data
- `GET/PUT /api/preferences/settings` - Manage learning settings

**Feature gating:**
- `ai_learning` feature requires Pro plan or higher
- All new endpoints check feature access before processing

**Breaking changes:** None

**Notes:**
- All endpoints use standard error/success response format
- Rate limiting applied to all endpoints
- Zod validation on all request bodies
- Integration with existing preference-learning.ts code
- Table names match what existing preference-learning.ts expects

---

## 2026-01-24 - Backend Agent

**Task:** Implement Preference Learning Engine for AI-driven job recommendations

**Files created:**

### Core Preference Learning Module
- `src/lib/ai/preference-learning.ts`: Main preference learning engine with:
  - `computeUserPreferences(userId)` - Analyzes user interactions and computes preference profile
  - `getUserPreferences(userId)` - Retrieves stored preferences from database
  - `calculatePreferenceScore(job, preferences)` - Calculates match score for a job
  - Weighted interaction scoring (favorite=1.0, apply=0.8, save=0.5, view_details=0.3, view=0.1, discard=-0.5, skip=-0.2, unfavorite=-0.8)
  - Recency decay with 30-day half-life formula
  - Feature extraction from job interactions (industries, company sizes, remote types, salaries, keywords, job types, locations, companies)
  - Confidence levels based on data volume (none, low, medium, high)
  - Safety bounds to prevent overfitting (max 10 preferred items, max 50 avoided companies, max 20 negative keywords)

### Track Interaction Module
- `src/lib/ai/track-interaction.ts`: Helper module for tracking interactions:
  - `trackInteractionAndLearn(userId, jobId, type, metadata?, durationSeconds?)` - Track single interaction
  - `trackInteractionsBatch(userId, interactions[])` - Track batch of interactions
  - `getUserInteractionStats(userId)` - Get interaction statistics
  - `getJobInteractionHistory(userId, jobId)` - Get interaction history for a job
  - `canRecompute(userId)` / `getRecomputeCooldownRemaining(userId)` - Rate limit checks
  - `forceRecompute(userId)` - Manual recomputation trigger
  - Automatic preference recomputation for significant interactions (favorite, apply, discard)
  - 1-minute cooldown between recomputations to prevent abuse

### API Endpoints
- `src/app/api/preferences/compute/route.ts`:
  - `POST` - Recompute preferences for authenticated user (rate limited: 1/minute)
  - `GET` - Get current preferences without recomputing
  - Standard error/success response format
  - Rate limit headers included in response

- `src/app/api/interactions/route.ts`:
  - `POST` - Track single interaction or batch of interactions
  - `GET` - Get user's interaction statistics
  - Zod validation for request bodies
  - Rate limited: 60/minute for single, 10/minute for batch
  - Supports all interaction types: view, view_details, save, favorite, apply, discard, skip, unfavorite

**Database:**
- Uses existing `user_interactions` table from AI Learning migration
- Uses existing `user_learned_preferences` table from AI Learning migration
- No new migrations required

**New endpoints:**
- `POST /api/preferences/compute` - Trigger preference recomputation
- `GET /api/preferences/compute` - Get current preferences
- `POST /api/interactions` - Track interaction(s)
- `GET /api/interactions` - Get interaction statistics

**Constants & Configuration:**
```typescript
INTERACTION_WEIGHTS = {
  favorite: 1.0, apply: 0.8, save: 0.5, view_details: 0.3,
  view: 0.1, discard: -0.5, skip: -0.2, unfavorite: -0.8
}

CONFIDENCE_THRESHOLDS = {
  none: { minFavorites: 0, minInteractions: 0 },
  low: { minFavorites: 3, minInteractions: 10 },
  medium: { minFavorites: 8, minInteractions: 30 },
  high: { minFavorites: 15, minInteractions: 75 }
}

SAFETY_BOUNDS = {
  maxSingleJobInfluence: 0.15, minUniqueCompanies: 3, minUniqueIndustries: 2,
  maxNegativeKeywords: 20, maxAvoidedCompanies: 50, decayHalfLifeDays: 30, maxPreferredItems: 10
}
```

**Tech Keywords Extracted:**
- 60+ tech keywords including: react, typescript, python, java, aws, kubernetes, docker, graphql, machine learning, etc.

**Seniority Detection:**
- entry: junior, entry, graduate, intern, trainee, associate
- associate: associate, mid, intermediate
- mid-senior: senior, sr, lead, principal, staff
- director: director, vp, head of, chief, cto, ceo, manager

**Breaking changes:** None

**Notes:**
- Preference computation uses service client to access all user interactions
- Preferences are stored with user_id UNIQUE constraint (upsert pattern)
- Recency decay formula: decay = 0.5^(ageInDays / 30)
- Keyword affinities normalized to [-1, 1] range
- Remote preference stored as 0-1 score (0 = onsite preference, 1 = remote preference)
- Salary importance calculated based on proportion of jobs with salary data
- Company size inferred heuristically from company name (enterprise companies list + startup indicators)

---

## 2026-01-23 - Frontend Agent

**Task:** Add missing Mega plan to pricing page (P1-2)

**Files modified:**

### Pricing Card Component
- `src/components/pricing/PricingCard.tsx`:
  - Added `Building2` icon import from lucide-react
  - Added new "mega" plan to `PRICING_PLANS` array with:
    - Price: $149/month, $1490/year
    - Description: "For teams and agencies"
    - Features: Everything in Ultra, 500 auto-applications/day, Team collaboration, White-label reports, Dedicated account manager, Custom integrations, SLA guarantee, Priority API access

### Pricing Page
- `src/app/pricing/page.tsx`:
  - Added `Building2` icon import
  - Updated grid layout to show first 4 plans in standard grid
  - Added distinctive full-width enterprise tier section for Mega plan below the main grid
  - Enterprise section features gradient background, decorative blur elements, horizontal layout with features grid
  - Updated feature comparison table from 4 columns to 5 columns
  - Added new features to comparison table: Team Collaboration, White-label Reports, Account Manager, SLA Guarantee
  - Added subtle gradient highlight for Mega column in comparison table
  - Changed max-width from `max-w-5xl` to `max-w-6xl` to accommodate 5 columns

### Bug Fix (unrelated pre-existing issue)
- `src/app/api/jobs/search/route.ts`:
  - Fixed TypeScript error where `user` could be null for internal API calls
  - Introduced `effectiveUserId` pattern to handle both authenticated users and internal API calls
  - Internal calls can now pass `userId` in request body
  - Replaced all `user.id` references with `effectiveUserId`

**Dependencies added:** None

**Notes:**
- Mega plan layout uses a premium enterprise-style design: full-width card with gradient background and features displayed in a 2-column grid
- The first 4 plans (Free, Basic, Pro, Ultra) remain in the standard 4-column card grid
- Feature comparison table now properly shows all 5 plans with Mega having distinct features
- Layout is fully responsive: enterprise tier stacks vertically on mobile
- Consistent with existing Linear-inspired dark theme and cyan accent colors

---

## 2026-01-23 - Backend Agent

**Task:** Fix P1 and P2 Security and Pricing Issues

**Files modified:**

### Pricing Fix (P1-1)
- `src/lib/stripe/plans.ts`: Updated PLAN_LIMITS prices to match frontend pricing page
  - basic: $9 -> $19
  - pro: $29 -> $49
  - ultra: $59 -> $99
  - mega: $99 -> $149

### Security Fix: Service Role Key Exposure (P1-3)
- `src/app/api/cron/daily-curation/route.ts`: Replaced `X-Service-Role` header containing SUPABASE_SERVICE_ROLE_KEY with `x-api-key` header using INTERNAL_API_KEY
- `src/app/api/jobs/search/route.ts`: Added internal API key authentication support for cron/automated calls

### Rate Limiting (P1-4, P2-1, P2-2, P2-3)
- `src/app/api/jobs/search/route.ts`: Added rate limiting (5 req/min) - expensive endpoint with external API and OpenAI calls
- `src/app/api/stripe/checkout/route.ts`: Added rate limiting (10 req/min)
- `src/app/api/stripe/portal/route.ts`: Added rate limiting (10 req/min)
- `src/app/api/notifications/send/route.ts`: Added rate limiting (20 req/min) for POST, skipped for internal API key calls
- `src/app/api/credentials/route.ts`: Added rate limiting (30 req/min) for GET, POST, and DELETE

**Security Improvements:**
- Service role key no longer exposed in HTTP headers
- Internal API key pattern used consistently for server-to-server calls
- Rate limiting protects expensive endpoints from abuse
- All rate-limited endpoints return proper 429 status with Retry-After header

**Breaking changes:** None

**Notes:**
- Rate limiting uses in-memory store (existing implementation)
- Internal calls (cron, webhooks) bypass rate limiting via INTERNAL_API_KEY
- Retry-After header calculated from rate limit resetAt timestamp

---

## 2026-01-23 - Backend Agent

**Task:** Fix P1 and P2 architectural issues (Processing State Deadlock, Race Condition, Subscription State Handling)

**Files created:**

### Stale Job Recovery Cron (P1-5)
- `src/app/api/cron/recover-stale-jobs/route.ts`: New cron endpoint to recover jobs stuck in 'processing' state

### Database Migration (P1-6)
- `supabase/migrations/20260123300000_add_quota_reservation_function.sql`: Added stored procedure for race-condition-free quota checking

**Files modified:**

### Configuration
- `vercel.json`: Added recover-stale-jobs cron (every 15 minutes) and function config

### Daily Curation Race Condition Fix (P1-6)
- `src/app/api/cron/daily-curation/route.ts`: Updated to use `check_and_reserve_daily_quota` database function with transaction isolation to prevent concurrent requests from exceeding quota

### Subscription State Handling (P2-5)
- `src/app/api/stripe/webhook/route.ts`: Updated `getActivePlan()` function to handle all Stripe subscription statuses

**Database migrations:**
- `20260123300000_add_quota_reservation_function.sql` - Creates:
  - `check_and_reserve_daily_quota(p_user_id UUID, p_jobs_needed INTEGER)` function
  - Uses `FOR UPDATE` row locking to prevent race conditions
  - Returns available slot count (0 to p_jobs_needed)
  - Granted execute to `authenticated` and `service_role`

**New endpoints:**
- `GET /api/cron/recover-stale-jobs` - Recovers stuck processing jobs (requires CRON_SECRET)
- `POST /api/cron/recover-stale-jobs` - Same as GET (alternative method)

**Vercel Cron schedules added:**
- Stale job recovery: `*/15 * * * *` (every 15 minutes)

**Fixes Applied:**

1. **P1-5: Processing State Deadlock**
   - New cron endpoint checks for jobs stuck in 'processing' state > 30 minutes
   - Recovers scraped_questions with `scrape_status='processing'`
   - Recovers application_queue with `status='processing'`
   - Increments retry_count and resets to 'pending' for retry
   - Marks as 'failed' after max retries reached
   - Updates related job auto_apply_status accordingly

2. **P1-6: Race Condition in Daily Curation**
   - Created `check_and_reserve_daily_quota` PostgreSQL function
   - Uses `SELECT ... FOR UPDATE` to lock user's profile row
   - Prevents concurrent curation requests from exceeding daily quota
   - Falls back to original query method if function not yet deployed

3. **P2-5: Orphan Subscription States**
   - Updated `getActivePlan()` to handle all Stripe statuses:
     - `active`, `trialing`: Full plan access
     - `past_due`: Grace period, keeps plan
     - `paused`: Keeps plan (configurable behavior)
     - `incomplete`, `incomplete_expired`: Free (checkout not finished)
     - `unpaid`: Free (payment failed after retries)
     - `canceled` and others: Free

**Breaking changes:** None

**Notes:**
- Recovery cron runs every 15 minutes with 60-second max duration
- Database function gracefully falls back if migration not applied yet
- All subscription status transitions now explicitly documented

---

## 2026-01-23 - QA Agent

**Task:** Comprehensive Security Audit and Vulnerability Fixes

**Issues found:** 0 critical (previously fixed), 0 high (previously fixed), 3 medium, 2 low

**Files reviewed:**
- `src/app/api/admin/users/route.ts` - SQL injection protection verified
- `src/app/api/admin/api-usage/route.ts` - Rate limiting verified
- `src/app/api/admin/scraper-failures/route.ts` - Rate limiting verified
- `src/app/api/admin/reports/route.ts` - Rate limiting verified
- `src/app/api/profile/route.ts` - Added rate limiting
- `src/app/api/reports/route.ts` - Added rate limiting
- `src/app/api/scrape/questions/route.ts` - Added rate limiting
- `src/app/api/apply/submit/route.ts` - Added rate limiting
- `src/app/api/jobs/curate/route.ts` - Added rate limiting
- `src/lib/admin/auth.ts` - Environment variable configuration verified
- `src/lib/security/validation.ts` - Input sanitization verified
- `src/lib/security/rate-limit.ts` - Rate limiting implementation verified
- `src/middleware.ts` - Admin access control verified
- `supabase/migrations/` - All RLS policies reviewed

**Status:** PASS with improvements applied

**Security Fixes Applied:**

1. **Rate Limiting Added to API Endpoints (MEDIUM)**
   - `src/app/api/profile/route.ts` - GET and PUT now rate limited (60 req/min)
   - `src/app/api/reports/route.ts` - POST rate limited (10 req/min), GET rate limited (60 req/min)
   - `src/app/api/scrape/questions/route.ts` - POST rate limited (20 req/min)
   - `src/app/api/apply/submit/route.ts` - POST rate limited (10 req/min)
   - `src/app/api/jobs/curate/route.ts` - POST rate limited (3 req/min - expensive operation)

2. **RLS Policy Tightening (MEDIUM)**
   - Created `supabase/migrations/20260123200000_tighten_scraper_failures_rls.sql`
   - Replaced overly permissive `FOR INSERT WITH CHECK (true)` policy
   - New policy: Users can only insert scraper failures for their own jobs
   - Admin-only update policy added

3. **Environment Variable Documentation (LOW)**
   - Added `ADMIN_EMAILS` to `.env.local.example` with explanation
   - Format: comma-separated list of admin email addresses

**Previously Fixed Issues (verified working):**
- SQL Injection in admin users search - Fixed with sanitizeSearchInput and sanitizeSearchPattern
- Hardcoded admin email in database is_admin() function - Fixed in security_improvements migration
- Overly permissive RLS on api_usage/api_request_log - Fixed in fix_admin_rls_policies migration
- Admin auth centralized to environment variable - Working via ADMIN_EMAILS env var

**Passed Security Checks:**
- UUID validation on all admin endpoints
- Zod schema validation for request bodies
- Parameterized queries (no raw SQL with user input)
- Stripe webhook signature verification
- Service role key properly used only server-side
- RLS enabled on all user data tables

**Notes:**
- Rate limiting uses in-memory store (suitable for single-instance deployment)
- For multi-instance deployments, consider Redis-based rate limiting

---

## 2026-01-23 - Backend Agent

**Task:** Implement scheduled daily job curation system

**Files created:**

### Database Migration
- `supabase/migrations/20260123100000_add_scrape_retry_columns.sql`: Added retry tracking columns to scraped_questions table

### API Endpoints
- `src/app/api/cron/daily-curation/route.ts`: Cron endpoint for daily job curation
- `src/app/api/jobs/retry-failed/route.ts`: Endpoint for retrying failed scraping jobs

### Configuration
- `vercel.json`: Vercel cron configuration for scheduled jobs

**Files modified:**
- `src/lib/supabase/types.ts`: Added retry_count, max_retries, last_error, last_retry_at columns to scraped_questions table types
- `.env.local.example`: Added CRON_SECRET and NEXT_PUBLIC_APP_URL environment variables

**Database migrations:**
- `20260123100000_add_scrape_retry_columns.sql` - Adds to scraped_questions table:
  - `retry_count` INTEGER DEFAULT 0 - Number of retry attempts
  - `max_retries` INTEGER DEFAULT 3 - Maximum allowed retries
  - `last_error` TEXT - Most recent error message
  - `last_retry_at` TIMESTAMPTZ - Timestamp of last retry attempt
  - Index for finding retryable failed jobs

**New endpoints:**
- `GET /api/cron/daily-curation` - Triggers daily job curation for all production mode users (requires CRON_SECRET)
- `POST /api/cron/daily-curation` - Same as GET (alternative method)
- `GET /api/jobs/retry-failed` - Lists failed scraping jobs eligible for retry
- `POST /api/jobs/retry-failed` - Retries failed scraping jobs (up to 3 times per job)

**Environment variables added:**
- `CRON_SECRET` - Secret key for authenticating cron requests
- `NEXT_PUBLIC_APP_URL` - Application URL for internal API calls

**Vercel Cron schedules:**
- Daily curation: `0 6 * * *` (6 AM UTC daily)
- Retry failed jobs: `0 */4 * * *` (every 4 hours)

**Features:**
1. **Daily Curation Cron**
   - Queries all users with production_mode = true
   - Respects 20 jobs/day quota per user
   - Idempotent - safe to call multiple times (skips users at quota)
   - Creates curation_logs entries for monitoring
   - Supports both Vercel Cron and external cron services (cron-job.org)
   - Authenticates via CRON_SECRET header or query param

2. **Retry Failed Scraping**
   - Finds jobs in scraped_questions with failed status
   - Retries up to 3 times (configurable via max_retries)
   - Tracks retry_count and last_error for debugging
   - Marks as permanently failed after max retries
   - Moves permanently failed jobs to scraper_failures table
   - Can be triggered manually or via cron (every 4 hours)

**Breaking changes:** None

**Notes:**
- Function max duration set to 300s for daily-curation (5 minutes)
- Function max duration set to 60s for retry-failed (1 minute)
- Small delays (1-2 seconds) between user processing to prevent rate limiting
- Errors are logged and summarized in response

---

## 2026-01-23 - Frontend Agent

**Task:** Create comprehensive pricing page with Stripe integration

**Files created:**

### Pricing Page
- `src/app/pricing/page.tsx`: Full-featured pricing page with 4-tier plans, monthly/yearly toggle, feature comparison table, FAQ section, and Stripe checkout integration

### Pricing Components
- `src/components/pricing/PricingCard.tsx`: Reusable pricing card component with plan details, feature lists, highlighted state, loading states, and current plan indicator
- `src/components/pricing/PricingToggle.tsx`: Animated toggle switch for monthly/yearly billing with savings badge
- `src/components/pricing/PricingFAQ.tsx`: Accordion-style FAQ section with 8 common pricing questions
- `src/components/pricing/index.ts`: Barrel export file for pricing components

**Features implemented:**

1. **Pricing Cards (4 tiers)**
   - Free ($0/month): 5 AI matches/day, manual applications, basic search
   - Basic ($19/month): 20 AI matches/day, 10 auto-applications/day, email notifications
   - Pro ($49/month): 50 AI matches/day, 30 auto-applications/day, priority support, advanced filters (highlighted as "Most Popular")
   - Ultra ($99/month): Unlimited AI matches, 100 auto-applications/day, dedicated support, API access

2. **Billing Toggle**
   - Monthly/Yearly switch with spring animation
   - Yearly pricing shows 2 months free (10 months price)
   - Savings displayed on each card when yearly is selected

3. **Feature Comparison Table**
   - Full breakdown of all features across all plans
   - Checkmarks for included features, dashes for excluded
   - Pro plan column highlighted with cyan background

4. **FAQ Section**
   - 8 expandable questions covering: limits, plan changes, yearly billing, payments, trials, auto-apply, support tiers, refunds
   - Smooth accordion animations with Framer Motion

5. **Stripe Integration**
   - Subscribe buttons call `/api/stripe/checkout` with plan ID
   - Free plan redirects to `/login`
   - Current plan detection with badge indicator
   - Loading states during checkout
   - Error handling with toast notifications
   - Handles `?subscription=canceled` URL param from Stripe redirect

6. **Design Implementation**
   - Consistent with existing Linear-inspired dark theme
   - Cyan (#06B6D4) accent color throughout
   - Framer Motion animations for scroll-triggered reveals
   - Responsive design (mobile-first, 1-4 column grid)
   - Glass-morphism navigation header
   - Gradient background effects with grid pattern
   - Trust indicators section (Stripe security, cancellation, guarantee)

**Dependencies added:** None (uses existing framer-motion, lucide-react)

**Notes:**
- Page is accessible at `/pricing` route
- Integrates with existing Stripe checkout API from Backend Agent
- Follows existing component patterns and design system
- Fully responsive with mobile-optimized layout

---

## 2026-01-23 - Integration Agent

**Task:** Set up email notification system using Resend

**Files created:**

### Email Service Library (`src/lib/email/`)
- `client.ts`: Resend client initialization with error handling and HTML-to-text conversion
- `index.ts`: Barrel exports for all email-related functions
- `base-template.ts`: Responsive HTML email template with placeholder branding, cyan accent colors
- `triggers.ts`: Notification trigger functions with user preference checks and database logging

### Email Templates (`src/lib/email/templates/`)
- `welcome.ts`: Welcome email for new users with setup steps
- `job-matches.ts`: Daily job matches summary with top 5 jobs displayed
- `application-status.ts`: Application status updates (applied, interviewing, offer)
- `quota-warning.ts`: Daily quota warnings at 20%, 10%, 5%, and 0% thresholds

### API Endpoints
- `src/app/api/notifications/send/route.ts`: POST - Send notifications (supports internal API key auth), GET - Fetch notification history

### Database Migration
- `supabase/migrations/20260123100000_add_notifications.sql`: Notifications table and profile preference columns

**Files modified:**
- `src/lib/supabase/types.ts`: Added NotificationType, NotificationStatus, NotificationPreferences interfaces, notifications table definition, email_notifications and notification_preferences columns to profiles
- `.env.local.example`: Added RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, INTERNAL_API_KEY
- `package.json`: Added resend dependency

**Database migrations:**
- `20260123100000_add_notifications.sql` - Creates:
  - `notifications` table (id, user_id, type, status, error, sent_at, created_at)
  - `email_notifications` column on profiles (boolean, default true)
  - `notification_preferences` column on profiles (JSONB for granular control)
  - RLS policies for user and service role access
  - Indexes for efficient queries

**New endpoints:**
- `POST /api/notifications/send` - Send notification to user
- `GET /api/notifications/send` - Get user's notification history

**Environment variables added:**
- `RESEND_API_KEY` - Resend API key from https://resend.com/api-keys
- `EMAIL_FROM` - Sender email address (must be verified in Resend)
- `EMAIL_REPLY_TO` - Optional reply-to address
- `INTERNAL_API_KEY` - Secret for server-to-server notification calls

**Notification Types:**
- `welcome` - Sent to new users on signup
- `job_matches` - Daily job matches summary
- `application_status` - Status changes (applied, interviewing, offer)
- `quota_warning` - Low quota alerts at specific thresholds

**Helper Functions:**
- `notifyWelcome(userId)` - Send welcome email
- `notifyNewMatches(userId, matchCount, topMatches)` - Send daily job matches
- `notifyApplicationStatus(userId, jobId, jobTitle, company, oldStatus, newStatus)` - Send status update
- `notifyQuotaWarning(userId, remaining, limit)` - Send quota warning

**Notes:**
- Uses placeholder branding `[App Name]` throughout - easy to customize later
- Templates are responsive HTML with inline CSS for email client compatibility
- Gracefully handles missing RESEND_API_KEY (logs warning, returns error)
- Respects user notification preferences (master toggle + granular control)
- All notifications logged to database for audit trail
- Application status notifications only sent for significant changes (applied, interviewing, offer)
- Quota warnings sent at 20%, 10%, 5%, and 0% thresholds

---

## 2026-01-23 - Backend Agent

**Task:** Implement Stripe payment integration for subscription management

**Files created:**

### Database Migration
- `supabase/migrations/20260123000000_add_stripe_tables.sql`: Added customers and subscriptions tables with RLS policies

### Stripe Library
- `src/lib/stripe/client.ts`: Server-side Stripe client with plan-to-price mapping utilities
- `src/lib/stripe/plans.ts`: Plan limits, features, and utility functions for plan enforcement
- `src/lib/stripe/browser.ts`: Client-side Stripe utilities for checkout and billing portal
- `src/lib/stripe/index.ts`: Re-exports for cleaner imports

### API Endpoints
- `src/app/api/stripe/checkout/route.ts`: POST - Creates Stripe Checkout sessions for subscriptions
- `src/app/api/stripe/webhook/route.ts`: POST - Handles Stripe webhooks (checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_succeeded, invoice.payment_failed)
- `src/app/api/stripe/portal/route.ts`: POST - Creates Stripe Billing Portal sessions
- `src/app/api/stripe/subscription/route.ts`: GET - Returns current subscription status and plan details

### Configuration
- `.env.local.example`: Added Stripe environment variables documentation

**Files modified:**
- `src/lib/supabase/types.ts`: Added Customer, Subscription, StripeSubscriptionStatus, and SubscriptionDetails types, plus Database table definitions for customers and subscriptions
- `package.json`: Added stripe and @stripe/stripe-js dependencies

**Database migrations:**
- `20260123000000_add_stripe_tables.sql` - Creates:
  - `customers` table (user_id, stripe_customer_id)
  - `subscriptions` table (user_id, stripe_subscription_id, status, plan, period dates, cancellation info)
  - RLS policies for user access and service role management
  - Auto-update trigger for updated_at timestamp

**New endpoints:**
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/webhook` - Handle Stripe events
- `POST /api/stripe/portal` - Open billing portal
- `GET /api/stripe/subscription` - Get subscription status

**Environment variables added:**
- `STRIPE_SECRET_KEY` - Server-side Stripe API key
- `STRIPE_PUBLISHABLE_KEY` - Publishable key (backend reference)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side publishable key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification secret
- `STRIPE_PRICE_BASIC` - Price ID for Basic plan
- `STRIPE_PRICE_PRO` - Price ID for Pro plan
- `STRIPE_PRICE_ULTRA` - Price ID for Ultra plan
- `STRIPE_PRICE_MEGA` - Price ID for Mega plan

**Plan Configuration:**
- free: 10 jobs/day, 0 auto-applications, 25 saved jobs
- basic ($9/mo): 50 jobs/day, 25 auto-applications, 100 saved jobs
- pro ($29/mo): 200 jobs/day, 100 auto-applications, 500 saved jobs
- ultra ($59/mo): 500 jobs/day, 300 auto-applications, 2000 saved jobs
- mega ($99/mo): 1000 jobs/day, 1000 auto-applications, 10000 saved jobs

**Notes:**
- Uses Stripe Checkout (hosted) for PCI compliance
- Webhook handles subscription lifecycle (create, update, delete, payments)
- Profile's subscription_plan field is updated automatically via webhooks
- Billing Portal allows users to manage subscriptions, update payment methods, view invoices
- Plan enforcement utilities available via PLAN_LIMITS and helper functions

---

## 2026-01-23 - Backend Agent

**Task:** Set up scheduled job curation and DigitalOcean droplet deployment for automation worker

**Files created:**

### Database Migration
- `supabase/migrations/20260123000000_add_curation_logs.sql`: Added curation_logs table for tracking scheduled job curation runs

### Automation Worker - Scheduled Curation
- `automation-worker/src/scheduler/curation-scheduler.ts`: Node-cron based scheduler that runs daily job curation for production mode users
- `automation-worker/src/health/server.ts`: HTTP health check server with /health, /live, and /ready endpoints

### Deployment Scripts
- `deploy/setup-droplet.sh`: Initial DigitalOcean droplet setup script (installs Node.js, PM2, Playwright dependencies)
- `deploy/deploy.sh`: Deployment update script for pulling code and restarting worker
- `deploy/pm2.config.js`: PM2 ecosystem configuration for process management
- `deploy/README.md`: Comprehensive deployment documentation
- `automation-worker/pm2.config.js`: Worker-local PM2 config

**Files modified:**
- `automation-worker/src/config.ts`: Added curation and health check configuration options
- `automation-worker/src/index.ts`: Integrated curation scheduler and health check server startup/shutdown
- `automation-worker/src/browser/manager.ts`: Added getActiveBrowserCount() method for health monitoring
- `automation-worker/package.json`: Added node-cron dependency and types, added trigger-curation script
- `automation-worker/.env.example`: Added new environment variables for curation and health check
- `src/lib/supabase/types.ts`: Added CurationLogStatus type and curation_logs table types

**Database migrations:**
- `20260123000000_add_curation_logs.sql` - Creates curation_logs table with RLS policies

**New endpoints:**
- Health check server at configurable port (default 3001):
  - `GET /health` - Full health status with checks and stats
  - `GET /live` - Liveness probe
  - `GET /ready` - Readiness probe

**Environment variables added:**
- `CURATION_ENABLED` - Enable/disable scheduled curation (default: true)
- `CURATION_SCHEDULE` - Cron expression for schedule (default: 0 6 * * * = 6 AM UTC)
- `APP_URL` - Application URL for internal API calls
- `DAILY_JOB_TARGET` - Jobs to curate per user daily (default: 20)
- `HEALTH_CHECK_ENABLED` - Enable health check server (default: true)
- `HEALTH_CHECK_PORT` - Port for health check server (default: 3001)

**Notes:**
- Curation runs daily at configurable time (default 6 AM UTC)
- Only users with `production_mode = true` get daily curation
- Curation respects daily quota limits (20 jobs/day default)
- Health check provides worker status for monitoring
- PM2 configured for auto-restart on crash and memory limits
- Setup script handles fresh Ubuntu 22.04 droplet configuration

---

## 2026-01-23 - Frontend Agent

**Task:** Create professional marketing landing page at root route (/)

**Files changed:**
- `src/app/page.tsx`: Updated root page to serve landing page for unauthenticated users (redirects to dashboard if logged in)
- `src/components/landing/landing-page.tsx`: Created comprehensive marketing landing page component with hero, features, how-it-works, pricing, testimonials, and footer sections
- `src/components/landing/index.ts`: Created barrel export file for landing components

**Features implemented:**

1. **Hero Section**
   - Animated headline with gradient text effect
   - Subheadline explaining AI-powered job search value proposition
   - CTA buttons (Get Started Free, See Pricing)
   - Social proof with avatar stack and star rating
   - Animated dashboard preview mockup with floating notification cards

2. **Stats Section**
   - Key metrics display (50K+ jobs daily, 10K+ users, 85% success rate, 2.5x faster)
   - Scroll-triggered fade-in animations

3. **Features Section**
   - 6 feature cards: AI Job Matching, Smart Curation, Auto-Apply, Multi-Source Search, Kanban Dashboard, AI Assistant
   - Icon-based cards with hover effects
   - Consistent cyan accent theming

4. **How It Works Section**
   - 4-step visual process flow
   - Connected step indicators with gradient lines
   - Clear step numbering and descriptions

5. **Testimonials Section**
   - 3 testimonial cards with star ratings
   - Avatar initials and role/company information
   - Quote formatting with proper typography

6. **Pricing Section**
   - 3-tier pricing display (Free, Pro $19/mo, Ultra $49/mo)
   - Feature comparison lists
   - Highlighted "Most Popular" tier
   - CTA buttons for each plan

7. **CTA Section**
   - Full-width gradient banner
   - Final call-to-action with pattern overlay

8. **Footer**
   - Brand logo and description
   - Navigation links (Product, Company, Legal sections)
   - Social media icons (Twitter, GitHub, LinkedIn)
   - Copyright notice

**Design Implementation:**
- Follows existing Linear-inspired dark theme with cyan accent (#06B6D4)
- Uses project CSS variables and utility classes (gradient-cyan, glass-header, glow-cyan, etc.)
- Framer Motion animations for scroll-triggered reveals and staggered content
- Fully responsive design (mobile-first approach)
- Dark mode support matching existing app theming
- Grid pattern and gradient orb background effects

**SEO:**
- Added metadata export with title, description, and keywords
- OpenGraph tags for social sharing
- Semantic HTML structure with proper heading hierarchy

**Authentication:**
- Server-side auth check redirects logged-in users to /dashboard
- All CTAs link to /login page for sign up flow

**Dependencies added:** None (uses existing framer-motion, lucide-react, and project components)

**Notes:**
- Landing page is now the default route for unauthenticated visitors
- Consistent with existing design system established in login page and dashboard
- Pricing values are placeholder and can be updated when finalized
- Testimonials use placeholder data that can be replaced with real testimonials

---

## 2026-01-21 - QA Agent

**Task:** Security & Resilience Audit of Admin Implementation

**Issues found:** 2 critical, 3 high, 4 medium, 3 low

**Files reviewed:**
- `src/app/(dashboard)/admin/page.tsx`
- `src/middleware.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/api-usage/route.ts`
- `src/app/api/admin/scraper-failures/route.ts`
- `src/lib/admin/auth.ts`
- `supabase/migrations/20260121000000_add_admin_tables.sql`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/app/(dashboard)/layout.tsx`
- `supabase/migrations/20260119000000_add_scraper_failures.sql`
- `.env.local`

**Tests run:** Manual code review (static analysis)

**Status:** FAIL - Critical issues must be fixed before production

**Blocking issues:**
1. CRITICAL: SQL Injection vulnerability in user search API (users/route.ts line 35)
2. CRITICAL: Exposed secrets in .env.local file (API keys, service role key visible)
3. HIGH: Overly permissive RLS policies on api_usage and api_request_log tables

**Notes:**
- Admin email hardcoded in 5 locations - should be centralized to environment variable
- Missing rate limiting on all admin API endpoints
- UUID validation missing on delete/patch operations
- Full security report generated with remediation steps

---

## 2026-01-21 - Frontend Agent

**Task:** Update AI chat popup to match site styling and add context-aware functionality

**Files changed:**
- `src/components/chat/ChatPanel.tsx`: Updated to dark theme with cyan accents, added page context awareness with route-based hints, updated job context indicator styling
- `src/components/chat/ChatHeader.tsx`: Replaced purple gradient with cyan gradient, updated dropdown menu styling, added pageContext prop for dynamic subtitle
- `src/components/chat/ChatButton.tsx`: Changed from purple to cyan gradient, added glow effect and shadow styling
- `src/components/chat/MessageInput.tsx`: Updated border and focus states to use cyan accents, improved background styling
- `src/components/chat/MessageItem.tsx`: Updated user/AI bubble styling (user=cyan, AI=muted with border), added "Use Answer" autofill button for AI responses when there's a pending question
- `src/components/chat/MessageList.tsx`: Updated empty state with cyan icon styling, added custom-scrollbar class
- `src/components/chat/TypingIndicator.tsx`: Updated to use muted backgrounds and cyan bouncing dots
- `src/components/chat/QuickActions.tsx`: Added pageContext prop for page-specific suggestions, updated button styling with cyan hover states
- `src/components/chat/ChatProvider.tsx`: Added page descriptions for AI awareness, sends pageContext with API requests
- `src/components/apply/scraped-questions-form.tsx`: Updated "Ask AI" button to use cyan styling

**Features implemented:**

1. **Dark Theme Styling**
   - All chat components now match the site's Linear-inspired dark theme
   - Cyan (#06B6D4) accent color throughout
   - Consistent border styling with `border-border/50` and `hover:border-cyan-500/50`
   - Backdrop blur and card transparency effects

2. **Page Context Awareness**
   - Chat knows which page user is on (Dashboard, Profile, Setup, Job Details)
   - Quick actions change based on current page context
   - Header subtitle shows current page being helped with
   - Page description sent to API for AI awareness

3. **Autofill Functionality**
   - When user asks AI for help with a form question
   - AI response shows "Use Answer" button
   - Clicking autofills the answer into the form field
   - Visual feedback with checkmark when filled

4. **"Ask AI" Integration**
   - Textarea fields in job application form have "Ask AI" button
   - Opens chat popup with pre-filled prompt about that question
   - AI can suggest answers and user can autofill them

**Dependencies added:** None

**Notes:**
- Styling follows existing CSS variables from globals.css
- Uses existing event system (dispatchFillAnswer) for form integration
- Page context is additive - job context still works when on job pages

---

## 2026-01-17 - Research Agent

**Task:** Research strategies for scaling company database from 91 to 500+ companies

**Output:** `docs/research/company-discovery-strategies.md`

**Key findings:** Multiple viable paths exist to scale the company database. Free sources include GitHub repositories (crypto-jobs-fyi with 300+ companies, job-board-aggregator with 4,000+ companies) and community platforms (YC Work at a Startup, Wellfound). Commercial options include BuiltWith, Wappalyzer, and Enlyft which track 11,000+ Greenhouse users. All three ATS platforms (Greenhouse, Lever, Ashby) have public APIs requiring no authentication for job retrieval. Recommended approach: (1) harvest from existing open-source aggregators for immediate 5x growth, (2) implement user-submitted companies feature for sustainable growth, (3) consider commercial data providers for enterprise scale.

---

## 2026-01-16 - Research Agent

**Task:** Analyze JSearch implementation and define requirements for Adzuna API integration

**Output:** `docs/requirements/adzuna-api-integration.md`

**Key findings:** Adzuna API supports 12 countries (gb, us, de, fr, au, nz, ca, in, pl, br, at, za) with similar search capabilities to JSearch. Key differences include: country code required in URL path, description is truncated (snippet only), no company logos provided, and page number in URL path instead of query parameter. Environment variables are already configured. Implementation should follow the jsearch.ts pattern with type definitions, searchJobs function, and mapping function to convert to internal Job schema.

---

## 2026-01-14 - Backend Agent

**Task:** Set up Supabase database tables and storage bucket for JobSilver

**Files created:**

### Scripts (`src/scripts/`)
- `setup-supabase.ts`: Database setup script that verifies tables and creates storage bucket

**Database Schema:**

The following tables are defined in `supabase/schema.sql`:

1. **profiles** - User profile data
   - Links to `auth.users` via UUID primary key
   - Stores: full_name, email, phone, location, cv_url, cv_parsed_data (JSONB), job_filters (JSONB)
   - RLS policies: users can view/update/insert their own profile

2. **jobs** - Job listings for users
   - UUID primary key with auto-generation
   - Foreign key to profiles
   - Stores: external_id, source, title, company, location, salary, job_type, remote, description, application_url, match_score, status, application_questions (JSONB), application_answers (JSONB)
   - RLS policies: users can view/insert/update/delete their own jobs

3. **application_history** - Analytics tracking
   - UUID primary key with auto-generation
   - Foreign keys to profiles and jobs
   - Stores: job_title, company, status, applied_at
   - RLS policies: users can view/insert their own history

4. **saved_answers** - Reusable application answers
   - UUID primary key with auto-generation
   - Foreign key to profiles
   - Stores: question_type, question_text, answer_text, usage_count
   - RLS policies: users can view/insert/update/delete their own answers

**Database Features:**
- All tables have RLS (Row Level Security) enabled
- Indexes on frequently queried columns (user_id, status, created_at)
- Auto-profile creation trigger on user signup (`handle_new_user` function)
- Cleanup function for expired job applications (`cleanup_expired_jobs`)

**Storage Bucket:**
- Name: `cvs`
- Public: true (allows public read access)
- File size limit: 10MB
- Allowed MIME types: PDF, DOC, DOCX

**Dependencies added:**
- `pg` (PostgreSQL client for potential direct DB connections)
- `tsx` (dev dependency for running TypeScript scripts)
- `@types/pg` (TypeScript types)

**Setup Instructions:**
1. Run `npx tsx src/scripts/setup-supabase.ts` to verify setup and create storage bucket
2. Execute `supabase/schema.sql` in your Supabase SQL Editor (Dashboard > SQL Editor)
3. Re-run setup script to verify all tables are created

**Current Status:**
- Storage bucket "cvs": CREATED (public, 10MB limit)
- Table "jobs": EXISTS
- Tables "profiles", "application_history", "saved_answers": Require SQL execution in Supabase Dashboard

**Notes:**
- Supabase REST API does not support direct SQL execution for security reasons
- The schema SQL must be executed manually in the Supabase SQL Editor
- Service role key is used for admin operations (storage bucket management)
- All RLS policies ensure users can only access their own data

---

## 2026-01-14 - Frontend Agent

**Task:** Complete frontend UI implementation for JobSilver application

**Files created:**

### UI Components (`src/components/ui/`)
- `avatar.tsx`: Avatar component with image and fallback support
- `badge.tsx`: Badge component with multiple variants (default, secondary, destructive, outline, success, warning, info)
- `dialog.tsx`: Modal dialog component with overlay and animations
- `dropdown-menu.tsx`: Dropdown menu with full keyboard navigation support
- `scroll-area.tsx`: Custom scrollable area with styled scrollbars
- `select.tsx`: Select dropdown with search and keyboard support
- `separator.tsx`: Visual separator for content sections
- `skeleton.tsx`: Loading skeleton placeholder component
- `switch.tsx`: Toggle switch component
- `tabs.tsx`: Tab navigation component
- `textarea.tsx`: Multi-line text input
- `toast.tsx`: Toast notification component with variants
- `toaster.tsx`: Toast notification container

### Hooks (`src/hooks/`)
- `use-toast.ts`: Toast notification hook for managing notifications

### Dashboard Components (`src/components/dashboard/`)
- `job-card.tsx`: Draggable job card with company logo, match score, and actions
- `kanban-column.tsx`: Droppable kanban column with job list
- `search-bar.tsx`: Job search bar with filters (keywords, location, remote, job type)

### Pages (`src/app/`)
- `page.tsx`: Updated root page with auth redirect logic
- `login/page.tsx`: Login/signup page with Supabase authentication
- `(dashboard)/layout.tsx`: Dashboard layout with header, navigation, and user menu
- `(dashboard)/dashboard/page.tsx`: Main dashboard with kanban board and job search
- `(dashboard)/profile/page.tsx`: Profile settings with personal info, CV upload, and job preferences
- `(dashboard)/jobs/[id]/page.tsx`: Job detail page with split layout and application form

### Styles
- `globals.css`: Updated with custom fonts (DM Sans, Instrument Serif), purple theme, animations, and utility classes

**Dependencies added:**
- `@radix-ui/react-switch`
- `@radix-ui/react-separator`

**Features implemented:**
1. **Login Page**
   - Email/password authentication with Supabase
   - Toggle between sign in and sign up
   - Professional split-screen design with feature highlights
   - Form validation and loading states

2. **Dashboard Layout**
   - Responsive header with logo and navigation
   - User dropdown menu with profile and sign out
   - Mobile navigation support
   - Notification indicator

3. **Dashboard Page**
   - Kanban board with 4 columns (Saved, Applied, Interviewing, Offer)
   - Drag-and-drop job cards using @dnd-kit
   - Job search with filters (keywords, location, remote toggle, job type)
   - Discovered jobs carousel
   - Quick stats display
   - Empty state with call to action

4. **Profile Page**
   - Personal information form (name, email, phone, location)
   - CV upload with drag-and-drop
   - Job preferences (keywords, location, remote, job types, salary range, experience level)
   - Tabbed interface for organization

5. **Job Detail Page**
   - Split-screen layout (description on left, actions on right)
   - Job metadata display (salary, location, type, posted date)
   - CV preview with change option
   - AI-generated application questions
   - Apply and discard actions
   - Sticky footer with action buttons

**Design choices:**
- Purple primary color (#7C3AED / HSL 262 83% 58%)
- DM Sans for body text, Instrument Serif for display headings
- Clean white backgrounds with subtle slate accents
- Smooth animations and micro-interactions
- Consistent spacing and border radius
- Mobile-first responsive design

**Notes:**
- All components use TypeScript with proper type definitions
- Components follow shadcn/ui patterns for consistency
- Existing Supabase types from `src/lib/supabase/types.ts` are used throughout
- API routes are consumed but not modified (assumed to be working)

---

## 2026-01-14 - Frontend Agent

**Task:** Build comprehensive multi-step job configuration wizard (4 steps)

**Files created:**

### Setup Wizard Page (`src/app/(dashboard)/setup/`)
- `page.tsx`: Main wizard page with decorative background elements and gradient styling

### Setup Components (`src/components/setup/`)
- `setup-wizard.tsx`: Main wizard container with step navigation, progress indicator, state management, and Supabase integration
- `step-job-preferences.tsx`: Step 1 - Work location (remote/on-site toggles, country multi-select), job types (full-time, part-time, contractor, internship), and job titles (up to 5 with tag input)
- `step-job-filters.tsx`: Step 2 - Match threshold slider, seniority levels, time zones, industries, job description languages, include/exclude keywords, and company exclusions
- `step-screening.tsx`: Step 3 - CV status display, cover letter mode, phone with country code, location fields, current job title, availability toggles, work authorization, visa sponsorship, nationality, salary inputs, LinkedIn URL, and experience summary
- `step-final.tsx`: Step 4 - Remote preference, travel/relocation toggles, spoken languages (up to 6), optional fields (DOB, GPA, age confirmation, gender, disability, military service, ethnicity, driving license, security clearance), and application mode selection

### UI Components (`src/components/ui/`)
- `checkbox.tsx`: Radix UI checkbox component with purple theme styling

**Dependencies added:**
- `@radix-ui/react-checkbox`

**Features implemented:**

1. **Wizard Navigation**
   - Visual progress indicator with step icons and descriptions
   - Animated progress line showing completion
   - Clickable step indicators to jump between steps
   - Back/Next navigation buttons
   - Mobile-responsive step counter

2. **Step 1: Job Preferences**
   - Remote jobs toggle with country multi-select dropdown
   - On-site/Hybrid jobs toggle
   - Job type selection with icon cards (multi-select)
   - Job titles tag input with 5-item limit
   - Purple-themed tags with X removal buttons

3. **Step 2: Job Filters**
   - Three-level match threshold selector (High/Higher/Highest)
   - Seniority level toggle buttons
   - Multi-select dropdowns for time zones, industries, languages
   - Include keywords section (green themed)
   - Exclude keywords section (red themed)
   - Company exclusion list

4. **Step 3: Screening Questions**
   - CV upload status with quality indicators
   - Cover letter mode radio (auto-generate/upload)
   - Phone number with country code dropdown
   - Location fields (country, city, state, postcode)
   - Availability toggle buttons
   - Work authorization country selection
   - Visa sponsorship toggle
   - Nationality multi-select (up to 3)
   - Current/Expected salary inputs
   - LinkedIn URL with "I don't use LinkedIn" checkbox
   - Experience summary textarea with character counter

5. **Step 4: Final Configuration**
   - Remote preference (hybrid/full remote)
   - Travel and relocation toggles
   - Languages spoken multi-select (up to 6)
   - Optional demographic fields
   - Application mode selection (Auto-Save & Review vs Full Auto-Apply)
   - Summary card with completion indicators

6. **State Management**
   - Single unified state object for all wizard data
   - Uses JobFilters and ScreeningAnswers types from Supabase types
   - Loads existing data from user profile on mount
   - Saves to Supabase profiles table on completion
   - Toast notifications for success/error states

**Design choices:**
- Purple primary color (#7C3AED) consistent with app theme
- Rounded toggle buttons with filled state when selected
- Purple tags with X buttons for removable items
- Progress indicator at top showing "Step X of 4"
- Gradient backgrounds with subtle decorative elements
- Clean, professional design with attention to accessibility
- Mobile-first responsive layout
- Smooth transitions and hover states

**Notes:**
- Wizard is accessible from `/setup` route under dashboard layout
- All form fields support keyboard navigation
- Dropdowns close when clicking outside
- Uses existing UI components (Button, Input, Label, Switch, Badge, etc.)
- Follows established TypeScript patterns with proper type definitions
- Integrates with existing Supabase client for data persistence
