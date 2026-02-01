# JobSilver

A modern job search management application that helps users discover, track, and apply to jobs with AI assistance.

## Features

- **Job Search & Discovery** - Aggregates jobs from fantastic.jobs API and direct ATS integrations (Greenhouse, Lever, Ashby)
- **Kanban Board** - Visual job tracking with customizable columns (Discovered, Saved, Applied, Interviewing, Offer, Discarded)
- **AI Assistant** - Get help crafting application answers, writing cover letters, and analyzing job fit
- **CV Management** - Upload, parse, and generate optimized CVs
- **Subscription Plans** - Free, Starter, Pro, and Mega tiers with different AI usage quotas

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + Storage)
- **AI**: OpenAI via Vercel AI SDK
- **Payments**: Stripe (subscriptions, checkout, webhooks)
- **Email**: Resend
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/jobsilver.git
   cd jobsilver
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and fill in your values (see [Environment Variables](#environment-variables) below).

4. Set up the database:
   - Create a new Supabase project
   - Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor
   - Enable Row Level Security policies from `supabase/migrations/`

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `ADMIN_EMAILS` | Comma-separated admin email addresses |

See `.env.local.example` for the complete list with descriptions.

### Generating Secure Keys

For `INTERNAL_API_KEY` and `CRON_SECRET`, generate cryptographically secure keys:

```bash
openssl rand -hex 32
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (dashboard)/        # Authenticated dashboard pages
│   ├── api/                # API endpoints
│   └── ...                 # Public pages
├── components/             # React components
│   ├── ai-assistant/       # AI chat components
│   ├── dashboard/          # Kanban board, job cards
│   ├── landing/            # Landing page sections
│   └── ui/                 # shadcn/ui components
├── lib/                    # Shared utilities
│   ├── ai/                 # AI integrations
│   ├── api/                # Job source API clients
│   ├── security/           # Rate limiting, validation
│   ├── stripe/             # Payment helpers
│   └── supabase/           # Database client
└── hooks/                  # React hooks

supabase/
└── migrations/             # Database migrations
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Stripe Webhook

Set up a webhook endpoint in Stripe Dashboard pointing to:
```
https://your-domain.com/api/stripe/webhook
```

Subscribe to these events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

## Security

This application implements several security measures:

- **Authentication**: Supabase Auth with Row Level Security
- **Rate Limiting**: Protection against abuse on all API endpoints
- **Input Validation**: Zod schemas for request validation
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Audit Logging**: Security events are logged for monitoring

## License

This project is proprietary software. All rights reserved.

## Support

For support, email jobsilver50@gmail.com

# Trigger deployment
