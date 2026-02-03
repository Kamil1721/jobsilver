# JobSilver Changelog

## Current State (February 2026)

### Pricing
- **Free**: 3 jobs/day, no AI assistance
- **Pro**: $4.99/week or $14.99/month, 50 jobs/day, unlimited AI, 3-day trial

### Core Features
- Job search from multiple sources (fantastic.jobs, Greenhouse, Lever, Ashby)
- Kanban board (New Matches → Applied → Offers)
- AI assistant for applications, cover letters, interview prep
- CV upload, parsing, and generation
- Email notifications for job matches (Pro users)

### Architecture
- **Manual apply workflow** - Users apply directly on company sites
- **AI-powered assistance** - Help with applications, not automation

### Tech Stack
- Next.js 14 (App Router), React, TypeScript, Tailwind, shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)
- Stripe (subscriptions, webhooks)
- OpenAI via Vercel AI SDK
- Resend for transactional emails

---

## Table of Contents

- [2026-02 - February](#2026-02---february)
- [2026-01 - January](#2026-01---january)
- [Major Milestones](#major-milestones)

---

## 2026-02 - February

### 2026-02-03 - Email System Remaining Fixes

**Task:** Fix remaining P0 and P2 issues in the email notification system

#### P0-2: Welcome Email Now Triggered on Signup
- **File:** `src/app/auth/callback/route.ts`
- After successful session creation, checks if user profile was created in last 5 minutes
- If new user, triggers welcome email (fire-and-forget)

#### P2-1: Retry Logic for Failed Email Sends
- **File:** `src/lib/email/client.ts`
- Added `sendWithRetry()` helper with exponential backoff (3 retries: 1s, 2s, 4s)

#### P2-2: Timeout on Internal API Calls
- **File:** `src/app/api/cron/daily-curation/route.ts`
- Added AbortController with 30 second timeout to `fetchJobsFromSearch()`

---

### 2026-02-03 - Email System P3 Fixes

#### P3-1: Plain Text Email Formatting
- **File:** `src/lib/email/client.ts`
- Improved `stripHtml()` to preserve line breaks and decode HTML entities

#### P3-2: Duplicate Email Prevention
- **File:** `src/lib/email/triggers.ts`
- Added check to prevent duplicate job match emails per day

---

### 2026-02-03 - Email System Security Fixes

#### P0-1: XSS Vulnerability in Email Templates (CRITICAL)
- **File:** `src/lib/email/utils.ts` (NEW)
- Created `escapeHtml()` utility for all user-supplied data in templates

#### P1-1: Timing Attack Vulnerability in Cron Secret
- **File:** `src/app/api/cron/daily-curation/route.ts`
- Using `crypto.timingSafeEqual()` for constant-time comparison

#### P1-2: Rate Limiting on Cron Endpoint
- Added 2 requests/minute limit after authentication

#### P1-5: Missing `remote` Field in Email Job Data
- Added `remote: savedJob.remote` to curated jobs

#### P2-3: Jobs Sorted by Match Score
- Sorting curated jobs by match score before sending

---

### 2026-02-02 - Security & Routing Fixes

#### Chat History 404 Fix (RESOLVED)
- **Root Cause:** Vercel custom domain routing didn't match Next.js dynamic `[id]` segments
- **Solution:** Added explicit identity rewrites in `vercel.json` for `/api/jobs/:id/*` routes

#### Rate Limiting Added
- `src/app/api/ai/suggest-skills/route.ts` - 10 requests/hour
- `src/app/api/cv/generate/route.ts` - 5 requests/hour
- `src/app/api/cover-letter/upload/route.ts` - 10 requests/hour

#### Input Validation Hardened
- `src/app/api/jobs/[id]/chat/route.ts` - Added role validation

#### Cross-Account Contamination Prevention
- Auth state change listener forces refresh on user change
- CV URL validation matches current user ID

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

#### Files Modified
- `src/app/(dashboard)/admin/page.tsx` - Removed "Scrape Fails" and "Apply Fails" tabs
- `src/app/api/jobs/curate/route.ts` - Simplified to always set `auto_apply_status: 'manual'`
- `vercel.json` - Removed auto-apply cron jobs

#### Database Impact
Tables kept but no longer written to: `scraped_questions`, `application_queue`, `scraper_failures`

---

### 2026-01-28 - AI Assistant Pivot (Frontend)

**Task:** Update frontend for AI assistant focus

#### Landing Page Updates
- Hero changed from "apply automatically" to "helps you craft perfect applications"
- Step 3 changed to AI assistant focus

#### Pricing Page Updates
- All tiers now show AI-focused features
- Removed auto-apply metrics

#### Job Card Updates
- Added AI quick action buttons (Help, Letter, Match)
- Added Apply button that opens external URL

#### New Components
- `src/components/ai-assistant/usage-indicator.tsx` - Shows remaining AI quota
- `src/hooks/use-ai-usage.ts` - Hook for AI usage data

---

### 2026-01-28 - AI Assistant Pivot (Backend)

**Task:** Backend infrastructure for AI assistant

#### Database Migration
- `20260128000000_add_ai_usage_tracking.sql`
- Created `user_ai_usage` table for daily tracking
- RLS policies and increment functions

#### New Files
- `src/lib/ai/usage-tracker.ts` - Check limits, increment usage, get stats
- `src/app/api/ai/usage/route.ts` - GET endpoint for usage stats

#### Plan Limits Updated
- New 2-tier model: Free and Pro
- Free: 3 jobs/day, no AI
- Pro: 50 jobs/day, unlimited AI, $4.99/week

#### Chat API Changes
- Added AI quota check before processing
- Returns 429 with `QUOTA_EXCEEDED` code when over limit

---

### 2026-01-26 - Multi-Step Form Scraper (Historical - Superseded)

> **Note:** This work was superseded by the auto-apply removal on 2026-01-29.

Enhanced scraper for multi-step job application forms across 25+ ATS platforms with detailed tracking.

---

### 2026-01-25 - Tester System & Security

#### Tester Role Implementation
- `supabase/migrations/20260125000000_add_tester_system.sql`
- Added `is_tester` to profiles, created `tester_invites` table
- Testers get Ultra-level access without admin privileges

#### API Endpoints
- `GET/POST/PATCH/DELETE /api/admin/testers` - Manage testers and invites
- `GET/POST /api/auth/tester-signup` - Validate and apply invite codes

#### Security Fixes
- P0: Atomic invite redemption with row locking
- P1: Rate limiting on expensive endpoints
- P1: Generic error responses to prevent enumeration

---

### 2026-01-25 - Pricing & Quota Updates

#### Free Tier Changes
- Jobs limit: 3 → 5 per day
- Auto-applies: 0 → 1 per day (before removal)

#### Quota System
- Plan-aware limits
- Atomic reservation functions

---

### 2026-01-24 - AI Learning System

#### Database Tables
- `user_favorite_jobs` - Jobs marked as favorites
- `user_interactions` - All job interactions (view, save, apply, etc.)
- `user_preferences` - Computed preference profile
- `user_learning_settings` - User controls for learning

#### Preference Learning Engine
- `src/lib/ai/preference-learning.ts` - Computes preferences from behavior
- Weighted scoring (favorite=1.0, apply=0.8, save=0.5, discard=-0.5)
- Recency decay with 30-day half-life
- Confidence levels: none, low, medium, high

#### Job Scoring Integration
- `src/lib/ai/preference-scoring.ts` - Scores jobs based on preferences
- 20% diversity injection to prevent filter bubbles
- Pro/Ultra feature gating

---

### 2026-01-23 - Infrastructure & Security

#### Daily Curation System
- `src/app/api/cron/daily-curation/route.ts` - Runs at 6 AM daily
- Sends job match emails to users with notifications enabled

#### Email System (Resend)
- Email templates for welcome, job matches, status updates
- Notification triggers with preference checks

#### Security Audit
- Rate limiting on all API endpoints
- RLS policy tightening
- SQL injection protection
- Stripe webhook verification

#### Pricing Page
- Full-featured pricing with monthly/yearly toggle
- Feature comparison table
- FAQ section
- Stripe checkout integration

---

## Major Milestones

| Date | Milestone |
|------|-----------|
| 2026-01-23 | Email notification system launched |
| 2026-01-24 | AI learning system implemented |
| 2026-01-25 | Tester system and security hardening |
| 2026-01-28 | AI assistant pivot completed, new pricing model |
| 2026-01-29 | Auto-apply system removed |
| 2026-02-02 | Production routing fix (vercel.json rewrites) |
| 2026-02-03 | Email security and reliability improvements |
