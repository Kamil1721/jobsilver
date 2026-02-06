# JobSilver Changelog

## Current State (February 2026)

### Pricing (3-Tier Model)
- **Free**: 3 jobs/day, no AI assistance
- **Pro**: $3.99/week or $12.99/month, 15 jobs/day, 30 AI responses/day, 5 cover letters/day, 3 CV generations/day, 3-day trial
- **Ultra**: $6.99/week or $19.99/month, 35 jobs/day, unlimited AI, priority support, no trial

### Core Features
- Job search from fantastic.jobs (primary, via RapidAPI) and ATS integrations (Greenhouse, Lever, Ashby)
- Kanban board (New Matches → Applied → Offers) with drag-and-drop, bulk actions, favorites
- AI assistant for applications, cover letters, interview prep (limited for Pro, unlimited for Ultra)
- CV upload, parsing, AI-tailored generation, and reparse
- Cover letter generation with DOCX download
- Job notes with auto-save
- Admin announcements system
- Email notifications: Daily alerts (Pro and Ultra)
- Subscription downgrade flow with reason tracking
- GDPR data export
- Cron health monitoring

### Architecture
- **Manual apply workflow** - Users apply directly on company sites
- **AI-powered assistance** - Help with applications, not automation
- **47 API routes** with rate limiting and security hardening
- **38 database migrations** tracking all schema changes

### Tech Stack
- Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)
- Stripe (subscriptions, webhooks, billing portal)
- OpenAI (gpt-4o-mini) via Vercel AI SDK
- Resend for transactional emails
- Remotion for animated landing page demos

---

## Table of Contents

- [2026-02 - February](#2026-02---february)
- [2026-01 - January](#2026-01---january)
- [Major Milestones](#major-milestones)

---

## 2026-02 - February

### 2026-02-06 - API Quota Optimization & UI Polish

**Reduced fantastic.jobs API consumption by ~70%:**
- Cron's `fetchJobsFromSearch()` previously looped over `buildSearchQueries()` results, making 3+ identical API calls per user — now makes a single call
- Reduced per-search limits from 50/30 to 35/20 (primary/location queries)
- Global quota guard added in `fantasticjobs.ts` with 10% safety reserve
- API quota tracked in `api_usage` table (monthly `jobs_fetched` and `requests_made`)

**Cover letter daily limits enforced:**
- Cover letter generation now respects plan-based daily limits (Free=0, Pro=5, Ultra=unlimited)
- Curate job limits fixed to match plan tiers
- Email notifications updated from weekly (Pro) to daily for all paid plans

**Setup flow & admin panel fixes:**
- Multiple bug fixes in the onboarding wizard
- Admin panel improvements

**UI Polish:**
- Added tagline to landing page hero section
- Fixed white scrollbar appearing after logout
- Fixed orange announcement flash on login
- Resend client lazy loading fix to prevent build-time errors

---

### 2026-02-05 - 3-Tier Pricing, Announcements, Job Notes & Downgrade Flow

**Major pricing restructure from 2-tier (Free/Pro) to 3-tier (Free/Pro/Ultra):**

| Feature | Free | Pro | Ultra |
|---------|------|-----|-------|
| Jobs/day | 3 | 15 | 35 |
| AI responses/day | 0 | 30 | Unlimited |
| Cover letters/day | 0 | 5 | Unlimited |
| CV generations/day | 0 | 3 | Unlimited |
| Saved jobs | 50 | 200 | Unlimited |
| Email alerts | None | Daily | Daily |
| Price | $0 | $3.99/wk ($12.99/mo) | $6.99/wk ($19.99/mo) |
| Trial | - | 3 days | None |

**Subscription Downgrade Flow:**
- New `/api/subscription/downgrade` endpoint
- Downgrade to free: cancels subscription at period end
- Ultra-to-Pro: uses Stripe Subscription Schedules for auto-transition at period end
- Reason tracking for analytics (too expensive, not using features, found alternative, etc.)
- Plan change confirmation dialog with feature loss summary

**Admin Announcements System:**
- Full CRUD for announcements via `/api/admin/announcements`
- Public endpoint `/api/announcements/active` with plan-based targeting
- Announcement banner component with marquee text and dismissibility
- Supports info/warning/promo/maintenance types

**Job Notes Feature:**
- Auto-saving personal notes on each job with 2-second debounce
- Concurrent save queuing, abort on unmount, error recovery
- 50,000 character limit with warning at 45,000

**CV Generator Improvements:**
- Phone number fields with auto country code detection (40+ countries)
- Work location field, education highlights/achievements
- AI-suggested achievements for work entries
- Quick CV generation and pdf-parse dependency
- CV data persistence across sessions
- CV reparse endpoint (`/api/cv/reparse`)

**Security Fixes (P0-P1):**
- Job ownership verification for CV tailoring
- Rate limit race condition fixed (atomic check-and-increment)
- Sanitized data in PDF generation
- Consolidated sanitization functions (`sanitizeForPrompt`, `sanitizeAIOutput`)
- Zod validation schemas for CV generation
- User data isolation security enhancements
- Company+title duplicate prevention in job search

**Cron Monitoring:**
- New `/api/cron/check-expired-subscriptions` — safety net for missed Stripe webhooks
- New `/api/cron/health` — health check with status reporting
- Subscription lifecycle handling for payment failures

**Admin & Feature Access:**
- Admin users bypass all feature gates
- `isAdmin` added to SubscriptionContext
- Admin user management: PATCH (update tester status), DELETE (cascade delete)

**GDPR Compliance:**
- Account data export endpoint (`/api/account/export`)

**Stripe Production Setup:**
- Added Stripe products/prices for production environment
- Legacy plan mapping (mega→ultra, starter/basic→pro)

---

### 2026-02-03 - Email System Fixes

**P0: Welcome Email on Signup**
- Auth callback now checks if profile was created in last 5 minutes
- Triggers welcome email for new users (fire-and-forget)

**P0: XSS Vulnerability in Email Templates (CRITICAL)**
- Created `escapeHtml()` utility for all user-supplied data in templates

**P1: Security Hardening**
- Timing-safe comparison for cron secret (`crypto.timingSafeEqual`)
- Rate limiting on cron endpoint (2/min)
- Missing `remote` field added to email job data

**P2: Reliability**
- Retry logic with exponential backoff (3 retries: 1s, 2s, 4s)
- 30-second timeout on internal API calls via AbortController
- Duplicate email prevention per day
- Jobs sorted by match score in emails
- Plain text formatting improvements

---

### 2026-02-02 - Security & Routing Fixes

**Chat History 404 Fix (RESOLVED)**
- Root cause: Vercel custom domain routing didn't match Next.js dynamic `[id]` segments
- Solution: Added explicit identity rewrites in `vercel.json`

**Rate Limiting Added**
- `suggest-skills`: 10/hr → updated to 20/hr
- `cv/generate`: 5/hr
- `cover-letter/upload`: 10/hr

**Input Validation & Security**
- Chat message role validation
- Cross-account contamination prevention
- Auth state change listener forces refresh on user change

---

## 2026-01 - January

### 2026-01-29 - Auto-Apply System Removal

**Purpose:** JobSilver pivoted from auto-apply to manual apply with AI assistance. This cleanup removed all automation code.

#### Directories Deleted
| Directory | Description |
|-----------|-------------|
| `automation-worker/` | Playwright-based worker (~50+ files) |
| `src/lib/auto-apply/` | Encryption, login detection, platform detection |
| `deploy/` | Automation worker deployment scripts |
| `scripts/` | Scraping test scripts |

#### API Routes Deleted
| Route | Purpose |
|-------|---------|
| `/api/jobs/[id]/submit` | Submit auto-filled application |
| `/api/jobs/[id]/application-data` | Get scraped questions |
| `/api/jobs/retry-failed` | Retry failed applications |
| `/api/credentials` | LinkedIn/Indeed credentials |
| `/api/preferences/auto-apply-mode` | Auto-apply mode setting |
| `/api/production-mode/toggle` | Toggle production mode |
| `/api/cron/recover-stale-jobs` | Recover stuck jobs |

#### Database Impact
Legacy tables dropped in migration `20260206_drop_unused_legacy_tables.sql`

---

### 2026-01-28 - AI Assistant Pivot

**Frontend:**
- Landing page hero changed from "apply automatically" to "helps you craft perfect applications"
- AI-focused pricing tiers, job card quick actions (Help, Letter, Match)
- New `UsageIndicator` component, `useAIUsage` hook

**Backend:**
- `user_ai_usage` table for daily tracking
- `usage-tracker.ts` for plan-based AI limits
- Chat API returns 429 with `QUOTA_EXCEEDED` when over limit

---

### 2026-01-25 - Tester System & Security

- `is_tester` flag on profiles, `tester_invites` table
- Testers get Ultra-level access without admin privileges
- Admin CRUD for testers, public invite validation/redemption
- Atomic invite redemption with row locking
- Rate limiting on expensive endpoints

---

### 2026-01-24 - AI Learning System

- `user_favorite_jobs`, `user_interactions`, `user_preferences`, `user_learning_settings` tables
- Preference learning from behavior (weighted: favorite=1.0, apply=0.8, save=0.5, discard=-0.5)
- Recency decay with 30-day half-life
- Preference scoring with 20% diversity injection
- Pro/Ultra feature gating

---

### 2026-01-23 - Infrastructure & Security

- Daily curation cron job (6 AM)
- Resend email system (welcome, job matches)
- Security audit: rate limiting, RLS policies, SQL injection protection, Stripe webhook verification
- Pricing page with Stripe checkout integration

---

## Major Milestones

| Date | Milestone |
|------|-----------|
| 2026-01-23 | Email notification system launched |
| 2026-01-24 | AI learning system implemented |
| 2026-01-25 | Tester system and security hardening |
| 2026-01-28 | AI assistant pivot completed |
| 2026-01-29 | Auto-apply system removed |
| 2026-02-02 | Production routing fix (vercel.json rewrites) |
| 2026-02-03 | Email security and reliability improvements |
| 2026-02-05 | 3-tier pricing, announcements, job notes, downgrade flow, CV generator v2 |
| 2026-02-06 | API quota optimization (~70% reduction), cover letter limits, UI polish |
