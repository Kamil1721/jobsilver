# JobSilver

A job search management app that helps users discover, track, and apply to jobs with AI assistance. Jobs are curated daily from multiple sources, displayed on a Kanban board, and paired with an AI assistant for cover letters, CV tailoring, and application help.

> **Manual apply workflow** — JobSilver helps you prepare, but you apply directly on company websites.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS 3.4, shadcn/ui, Framer Motion |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | OpenAI (gpt-4o-mini) via Vercel AI SDK |
| Payments | Stripe (subscriptions, webhooks, billing portal) |
| Email | Resend |
| Video | Remotion 4.0 |
| Deployment | Vercel |

## Architecture Overview

```
src/
├── app/                        # Pages & API routes
│   ├── (dashboard)/            # Auth'd pages: dashboard, profile, jobs/[id], setup, admin
│   ├── api/                    # 47 API endpoints
│   │   ├── jobs/               # Search, curate, favorites, CRUD, chat, favorites
│   │   ├── ai/                 # Usage stats, skill/achievement suggestions
│   │   ├── chat/               # Streaming AI assistant (SSE)
│   │   ├── cv/                 # Upload, parse, generate, reparse
│   │   ├── cover-letter/       # Upload, DOCX download
│   │   ├── preferences/        # AI learning, match scoring, settings
│   │   ├── stripe/             # Checkout, webhooks, subscription, portal
│   │   ├── admin/              # Users, testers, reports, announcements, API usage
│   │   ├── cron/               # Daily curation, job cleanup, subscription checks, health
│   │   └── ...                 # Auth, account, notifications, reports, interactions
│   └── ...                     # Public pages: landing, login, pricing, FAQ, legal
│
├── components/                 # ~60 React components
│   ├── dashboard/              # Kanban board, job cards, bulk actions, favorites, search
│   ├── chat/                   # Floating AI chat (draggable button, panel, messages)
│   ├── ai-assistant/           # Job-page embedded AI chat, usage indicator
│   ├── setup/                  # 5-step onboarding wizard + CV section editors
│   ├── pricing/                # Plan cards, billing toggle, FAQ
│   ├── cv/                     # CV generator dialog
│   ├── job-notes/              # Auto-saving notes per job
│   ├── landing/                # Landing page with scroll animations
│   ├── video/                  # Remotion video players (lazy-loaded)
│   ├── ui/                     # 23 shadcn/ui primitives + FeatureGate
│   └── ...                     # Profile, report, theme, footer, modals
│
├── lib/                        # Shared logic (42 files)
│   ├── ai/                     # Query generation, CV parsing, matching, usage tracking,
│   │                           #   preference learning/scoring, chat service
│   ├── api/                    # Job source clients (fantastic.jobs, Greenhouse, Lever, Ashby)
│   ├── cv/                     # PDF generation, AI tailoring, data mapping
│   ├── email/                  # Resend client, templates (welcome, job matches), triggers
│   ├── stripe/                 # Plans config, pricing, server/browser clients
│   ├── security/               # Rate limiting, Zod validation, audit logging
│   ├── features/               # Feature gating by plan (11 gated features)
│   ├── job-sources/            # Multi-source search coordination, ATS search
│   └── ...                     # Cache, events, contexts, utils, admin auth
│
├── hooks/                      # useAIUsage, useChat, useFeatureAccess, useToast, useReducedMotion
└── remotion/                   # 5 video compositions + shared animated components

supabase/
└── migrations/                 # 38 migrations (DO NOT DELETE)
```

## Job Sources

| Source | Type | Auth |
|--------|------|------|
| fantastic.jobs | Primary aggregator (via RapidAPI) | `RAPIDAPI_KEY` required |
| Greenhouse | ATS public posting API | No key needed |
| Lever | ATS public posting API | No key needed |
| Ashby | ATS public posting API | No key needed |

## Pricing Model (3-Tier)

| | Free | Pro | Ultra |
|---|------|-----|-------|
| Jobs/day | 3 | 15 | 35 |
| AI responses/day | 0 | 30 | Unlimited |
| Cover letters/day | 0 | 5 | Unlimited |
| CV generations/day | 0 | 3 | Unlimited |
| Email alerts | None | Daily | Daily |
| Price | $0 | $3.99/wk \| $12.99/mo | $6.99/wk \| $19.99/mo |
| Trial | - | 3 days | - |

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- Stripe account
- OpenAI API key
- RapidAPI key (for fantastic.jobs)

### Setup

```bash
# 1. Clone & install
git clone https://github.com/yourusername/jobsilver.git
cd jobsilver
npm install

# 2. Environment variables
cp .env.local.example .env.local
# Edit .env.local with your keys (see table below)

# 3. Database
# Run all migrations from supabase/migrations/ in your Supabase SQL Editor
# (in order by filename timestamp)

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `OPENAI_API_KEY` | OpenAI API key |
| `RAPIDAPI_KEY` | RapidAPI key for fantastic.jobs |
| `RAPIDAPI_PLAN` | RapidAPI plan tier (default: `pro`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `RESEND_API_KEY` | Resend email API key |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `INTERNAL_API_KEY` | Secret for internal API calls (generate with `openssl rand -hex 32`) |
| `CRON_SECRET` | Secret for cron job auth (generate with `openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (e.g. `https://jobsilver.com`) |

See `.env.local.example` for the complete list.

## Deployment (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Cron Jobs (configured in vercel.json)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/daily-curation` | 6 AM daily | Curate jobs & send email notifications |
| `/api/cron/cleanup-expired-jobs` | 7 AM daily | Delete jobs older than 60 days |
| `/api/cron/check-expired-subscriptions` | 6 AM daily | Safety net for missed Stripe webhooks |

### Stripe Webhook

Point your Stripe webhook to `https://your-domain.com/api/stripe/webhook` and subscribe to:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `subscription_schedule.released`

## Key Flows

**Onboarding:** Login → Choose Plan → 5-Step Setup (preferences, filters, screening, CV, finalize) → Dashboard

**Daily Curation:** Cron generates AI search queries from user profile → fetches from fantastic.jobs + ATS boards → filters/scores/deduplicates → saves to board → sends email notification

**Job Application:** User views job on Kanban → reads description with AI match analysis → uses AI for cover letter/CV tailoring → clicks Apply → redirects to company site → marks as Applied

**Kanban:** New Matches → Applied → Offers (+ discard). Drag-and-drop, bulk actions, favorites filter.

## Security

- Rate limiting on 30+ endpoints (hybrid in-memory + DB)
- Zod input validation on all requests
- RLS policies on all Supabase tables
- Timing-safe cron secret comparison
- Audit logging for admin operations
- Security headers (X-Frame-Options, CSP, etc.)
- Cross-account data isolation
- Sanitized AI prompts to prevent injection

## License

Proprietary software. All rights reserved.

## Support

jobsilver50@gmail.com
