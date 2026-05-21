# Wire Curation → Question Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the job-curation pipeline extract each posting's application questions and record the outcome on the job, so curated jobs carry their question set — verifiable on a dev server.

**Architecture:** A single shared, never-throwing function (`extractAndStoreForJob`) computes a posting key, runs the existing `getOrExtractQuestions` cache-or-extract path, and records a `questions_status` on the `jobs` row. The production daily-curation cron calls it after each job insert; a new dev-only route triggers the same pipeline on demand against fantastic.jobs.

**Tech Stack:** Next.js 14 App Router route handlers, Supabase (Postgres + service client), TypeScript 5, fantastic.jobs (Active Jobs DB via RapidAPI).

---

## Scope

This plan implements **only** the curation → extraction wiring. In scope:

- New `jobs` columns: `posting_key`, `questions_status`.
- A shared extraction-wiring function.
- Calling it from the daily-curation cron.
- A dev-only trigger route to run the pipeline and see jobs + questions.

**Explicitly out of scope** (follow-up plans):

- Dashboard "gated display" (hiding jobs while extraction is pending) — spec §2.
- The Skyvern-scrape extractor for non-Greenhouse/Lever/Ashby ATSes — spec §10.1.
- The apply/submit flow, Skyvern apply workflow, webhooks — spec §7–9.
- Pricing/quota redesign — spec sub-project C.

## Reality this plan inherits (verified in source 2026-05-21)

- **Extraction only covers Greenhouse / Lever / Ashby.** `detectAts()` in
  `src/lib/auto-apply/platform-detector.ts` returns `'other'` for everything else, and
  `extractQuestions()` throws `UnsupportedAtsError` for `'other'`. fantastic.jobs draws
  from 130k+ career sites, so on a typical pull the **majority of jobs will be
  `unsupported`** — that is expected, not a bug. Those jobs still appear (manual-apply);
  only Greenhouse/Lever/Ashby jobs get a question set.
- **Display gating resolves a spec tension:** spec §2 says jobs appear only once
  questions are ready; spec §6 says failed-extraction jobs are shown as manual-apply.
  Resolution for this codebase: a job is shown regardless; `questions_status`
  distinguishes `ready` (auto-applyable) from `failed`/`unsupported` (manual). Pending
  is a transient state during a curation run. Dashboard filtering is a follow-up.
- **The project has no automated test suite.** Per `CLAUDE.md`, verification is
  `npm run lint` + `npm run build`, plus the manual dev-server run in Task 6. Do **not**
  scaffold a test runner.

## ⚠️ Pre-flight: the dev server uses the PRODUCTION database

`.env.local` line 1 declares the Supabase project as **production** (`pjgdcasgyxjooqwihivh`).
A local `npm run dev` therefore reads/writes production data. Consequences:

- The Task 1 migration must be applied to the **production** Supabase project for the
  code to build/run. It is **additive only** (one nullable column, one column with a
  default + CHECK) — low risk and reversible, but it is a real production schema change.
- The Task 5 dev route inserts real `jobs` rows for a real user — they will appear on
  that user's live dashboard.

**Before executing, the operator must choose** (raised at plan handoff): proceed against
production, or first point `.env.local` at a separate Supabase (local `supabase start`
or a Supabase branch). The plan code is identical either way; only the target DB differs.

## File Structure

| File | Create / Modify | Responsibility |
|---|---|---|
| `supabase/migrations/20260521030000_add_jobs_questions_status.sql` | Create | Add `jobs.posting_key` + `jobs.questions_status`. |
| `src/lib/supabase/types.ts` | Modify | Add the two new columns to the `jobs` types so the build type-checks. |
| `src/lib/auto-apply/curation-extraction.ts` | Create | Shared, never-throwing extract-and-record function. |
| `src/app/api/cron/daily-curation/route.ts` | Modify | Call the wiring function after each job is saved. |
| `src/app/api/dev/auto-apply-curation/route.ts` | Create | Dev-only trigger: fetch from fantastic.jobs → store → extract → JSON summary. |

---

### Task 1: Migration — add `posting_key` and `questions_status` to `jobs`

**Files:**
- Create: `supabase/migrations/20260521030000_add_jobs_questions_status.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260521030000_add_jobs_questions_status.sql`:

```sql
-- Auto-apply: link per-user job rows to their extracted question set.
-- posting_key      — canonical posting identity (sha256 of the normalized
--                    application URL); matches job_application_questions.posting_key.
-- questions_status — extraction lifecycle for this posting's question set:
--                    pending  — not yet attempted (default for new rows)
--                    ready    — questions extracted (or posting genuinely has none)
--                    failed   — a supported ATS returned an error
--                    unsupported — URL is not a Greenhouse/Lever/Ashby ATS

alter table public.jobs
  add column if not exists posting_key text,
  add column if not exists questions_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_questions_status_check'
  ) then
    alter table public.jobs
      add constraint jobs_questions_status_check
      check (questions_status in ('pending', 'ready', 'failed', 'unsupported'));
  end if;
end $$;

create index if not exists jobs_posting_key_idx on public.jobs (posting_key);
```

- [ ] **Step 2: Apply the migration**

Apply against the linked Supabase project. Either:
- Supabase MCP: `apply_migration` with name `add_jobs_questions_status` and the SQL above, **or**
- CLI: `supabase db push`

Expected: migration applies cleanly; `jobs` now has `posting_key` and `questions_status`.
Verify: `select column_name from information_schema.columns where table_name = 'jobs' and column_name in ('posting_key','questions_status');` returns both rows.

Do **not** edit any existing file in `supabase/migrations/` — only add this new one.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521030000_add_jobs_questions_status.sql
git commit -m "feat(auto-apply): add jobs.posting_key + questions_status columns"
```

---

### Task 2: Add the new columns to the `jobs` TypeScript types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Read the file and locate the `jobs` types**

Open `src/lib/supabase/types.ts`. Locate two things:
1. The Supabase-generated `jobs` table type — `Tables.jobs` with its `Row`, `Insert`, `Update` shapes.
2. The hand-maintained `Job` interface (around line 971).

- [ ] **Step 2: Add the columns to the generated `jobs` table type**

In the `jobs` table type, add to `Row`:

```ts
posting_key: string | null
questions_status: string
```

Add to `Insert` (both optional — DB supplies a default for `questions_status`, `posting_key` is nullable):

```ts
posting_key?: string | null
questions_status?: string
```

Add the same two optional fields to `Update`.

- [ ] **Step 3: Add the columns to the `Job` interface**

In the `Job` interface (~line 971), add:

```ts
posting_key?: string | null
questions_status?: string
```

Match the surrounding optional-field style of that interface.

- [ ] **Step 4: Verify the build type-checks**

Run: `npm run build`
Expected: build succeeds. (If it fails on these types, the field names must match the migration exactly: `posting_key`, `questions_status`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(auto-apply): type jobs.posting_key + questions_status"
```

---

### Task 3: Shared extraction-wiring function

**Files:**
- Create: `src/lib/auto-apply/curation-extraction.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/auto-apply/curation-extraction.ts`:

```ts
import { computePostingKey } from '@/lib/auto-apply/platform-detector'
import { getOrExtractQuestions } from '@/lib/auto-apply/questions-store'
import { UnsupportedAtsError } from '@/lib/auto-apply/extraction'
import { createServiceClient } from '@/lib/supabase/server'

export type QuestionsStatus = 'pending' | 'ready' | 'failed' | 'unsupported'

export interface ExtractAndStoreResult {
  postingKey: string
  status: QuestionsStatus
  questionCount: number
  error?: string
}

/**
 * Extract a job posting's application questions and record the outcome on its
 * `jobs` row. Shared by the daily-curation cron and the dev trigger route.
 *
 * Never throws — extraction failure is recorded as a status, not propagated,
 * so one bad posting cannot abort a curation run.
 *
 *   - 'ready'       — questions extracted (or the posting genuinely has none).
 *   - 'unsupported' — URL is not a Greenhouse/Lever/Ashby ATS (no extractor yet).
 *   - 'failed'      — a supported ATS returned an error.
 */
export async function extractAndStoreForJob(
  supabase: ReturnType<typeof createServiceClient>,
  jobId: string,
  applicationUrl: string,
): Promise<ExtractAndStoreResult> {
  const postingKey = computePostingKey(applicationUrl)
  let status: QuestionsStatus
  let questionCount = 0
  let error: string | undefined

  try {
    const questions = await getOrExtractQuestions(applicationUrl)
    questionCount = questions.length
    status = 'ready'
  } catch (err) {
    if (err instanceof UnsupportedAtsError) {
      status = 'unsupported'
    } else {
      status = 'failed'
      error = err instanceof Error ? err.message : 'Unknown extraction error'
      console.error(`[auto-apply] Question extraction failed for job ${jobId}:`, error)
    }
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ posting_key: postingKey, questions_status: status })
    .eq('id', jobId)

  if (updateError) {
    console.error(
      `[auto-apply] Failed to record questions_status for job ${jobId}:`,
      updateError.message,
    )
  }

  return { postingKey, status, questionCount, error }
}
```

Note: `UnsupportedAtsError` is exported from `src/lib/auto-apply/extraction/index.ts`
(confirmed in source). `getOrExtractQuestions` already handles the per-posting cache and
persists rows into `job_application_questions` — this function only adds the
status-recording layer and the never-throws guarantee.

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/curation-extraction.ts
git commit -m "feat(auto-apply): add extractAndStoreForJob curation-extraction helper"
```

---

### Task 4: Wire extraction into the daily-curation cron

**Files:**
- Modify: `src/app/api/cron/daily-curation/route.ts`

- [ ] **Step 1: Add the import**

At the top of `src/app/api/cron/daily-curation/route.ts`, with the other `@/lib`
imports (after the `sendCronFailureAlert` import on line 9), add:

```ts
import { extractAndStoreForJob } from '@/lib/auto-apply/curation-extraction'
```

- [ ] **Step 2: Call the wiring function after each job is saved**

In `fetchAndCurateJobs`, the per-job loop currently contains this block:

```ts
        if (saveError) {
          console.error(`[Daily Curation] Failed to save job:`, saveError)
          jobsFailed++
          continue
        }

        jobsCurated++
        existingIds.add(job.external_id)

        // Track curated job for email notification (top 3)
        if (curatedJobs.length < 3 && savedJob) {
```

Insert the extraction call between `existingIds.add(...)` and the `// Track curated job`
comment, so the block reads:

```ts
        if (saveError) {
          console.error(`[Daily Curation] Failed to save job:`, saveError)
          jobsFailed++
          continue
        }

        jobsCurated++
        existingIds.add(job.external_id)

        // Extract application questions for this posting (auto-apply pipeline).
        // Best-effort: never throws — failure is recorded on the job row.
        if (savedJob && job.application_url) {
          await extractAndStoreForJob(supabase, savedJob.id, job.application_url)
        }

        // Track curated job for email notification (top 3)
        if (curatedJobs.length < 3 && savedJob) {
```

Rationale for inline placement: Greenhouse/Lever/Ashby extraction is a single fast API
call; `unsupported` URLs cost nothing (no network). The cron's `maxDuration = 300` gives
ample headroom for per-user job counts (3–35). If curation volume grows materially, move
extraction to a queue — out of scope here.

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/daily-curation/route.ts
git commit -m "feat(auto-apply): extract questions during daily curation"
```

---

### Task 5: Dev-only trigger route

**Files:**
- Create: `src/app/api/dev/auto-apply-curation/route.ts`

- [ ] **Step 1: Confirm the `jobs` insert shape**

The dev route inserts `jobs` rows. Reference the existing, known-good insert in
`src/app/api/cron/daily-curation/route.ts` (`fetchAndCurateJobs`, the
`supabase.from('jobs').insert({ ... })` call) — the template below mirrors its required
columns. If the insert fails at runtime on a NOT NULL column, read the `jobs` `Insert`
type in `src/lib/supabase/types.ts` and add the missing column.

- [ ] **Step 2: Create the route**

Create `src/app/api/dev/auto-apply-curation/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { searchJobs, mapFantasticJobToJob } from '@/lib/api/fantasticjobs'
import { extractAndStoreForJob } from '@/lib/auto-apply/curation-extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * DEV-ONLY trigger for the auto-apply curation pipeline.
 *
 * Fetches a small batch of jobs from fantastic.jobs, stores any not already
 * present for the user, runs question extraction on each, and returns a JSON
 * summary. Lets you exercise the curation -> extraction flow on a dev server
 * without the production cron's CRON_SECRET / production_mode prerequisites.
 *
 *   GET /api/dev/auto-apply-curation?limit=5&userId=<uuid>
 *
 * Returns 404 in production.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Not found' } },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit')) || 5, 20)
  const requestedUserId = searchParams.get('userId')

  const supabase = createServiceClient()

  // Resolve the owning user: explicit ?userId, else the first profile.
  let userId = requestedUserId
  if (!userId) {
    const { data: firstProfile } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single()
    userId = firstProfile?.id ?? null
  }
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'no_user', message: 'No profile found — pass ?userId=<uuid>' } },
      { status: 400 },
    )
  }

  // 1. Fetch a batch of jobs from fantastic.jobs.
  let fjJobs
  try {
    fjJobs = await searchJobs({ limit, description_type: 'html' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fantastic.jobs request failed'
    return NextResponse.json({ error: { code: 'fetch_failed', message } }, { status: 502 })
  }

  // De-dupe against jobs already stored for this user.
  const { data: existing } = await supabase
    .from('jobs')
    .select('external_id')
    .eq('user_id', userId)
  const existingIds = new Set((existing ?? []).map((j) => j.external_id))

  // 2. Store each new job, then extract its questions.
  const results: Array<Record<string, unknown>> = []
  for (const fjJob of fjJobs) {
    const mapped = mapFantasticJobToJob(fjJob, userId)

    if (existingIds.has(mapped.external_id)) {
      results.push({ title: mapped.title, skipped: 'already stored' })
      continue
    }

    const { data: savedJob, error: saveError } = await supabase
      .from('jobs')
      .insert({
        user_id: mapped.user_id,
        external_id: mapped.external_id,
        source: mapped.source,
        ats_source: mapped.ats_source,
        title: mapped.title,
        company: mapped.company,
        company_logo_url: mapped.company_logo_url,
        location: mapped.location,
        salary_min: mapped.salary_min,
        salary_max: mapped.salary_max,
        salary_currency: mapped.salary_currency,
        job_type: mapped.job_type,
        remote: mapped.remote,
        remote_type: mapped.remote_type,
        description: mapped.description,
        application_url: mapped.application_url,
        status: 'discovered',
        auto_apply_status: 'manual',
      })
      .select()
      .single()

    if (saveError || !savedJob) {
      results.push({ title: mapped.title, error: saveError?.message ?? 'insert failed' })
      continue
    }
    existingIds.add(mapped.external_id)

    const extraction = await extractAndStoreForJob(
      supabase,
      savedJob.id,
      mapped.application_url,
    )
    results.push({
      jobId: savedJob.id,
      title: mapped.title,
      company: mapped.company,
      applicationUrl: mapped.application_url,
      questionsStatus: extraction.status,
      questionCount: extraction.questionCount,
      ...(extraction.error ? { extractionError: extraction.error } : {}),
    })
  }

  const readyCount = results.filter((r) => r.questionsStatus === 'ready').length
  return NextResponse.json({
    userId,
    jobsFetched: fjJobs.length,
    jobsProcessed: results.length,
    jobsWithQuestions: readyCount,
    results,
  })
}
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dev/auto-apply-curation/route.ts
git commit -m "feat(auto-apply): add dev-only curation+extraction trigger route"
```

---

### Task 6: Run on the dev server and verify

**Files:** none (verification only).

- [ ] **Step 1: Confirm env is set**

`.env.local` must contain `RAPIDAPI_KEY` and `RAPIDAPI_PLAN=basic` (already added).
Confirm: `grep -c '^RAPIDAPI_KEY' .env.local` returns `1`.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server ready at `http://localhost:3000`.

- [ ] **Step 3: Trigger the pipeline**

Run (replace `<uuid>` with your own profile id, or omit `userId` to use the first profile):

```bash
curl -s 'http://localhost:3000/api/dev/auto-apply-curation?limit=5&userId=<uuid>' | python3 -m json.tool
```

Expected: JSON with `jobsProcessed`, `jobsWithQuestions`, and a `results` array. Each
result shows `questionsStatus` of `ready` / `unsupported` / `failed`. Most jobs will be
`unsupported` (not a Greenhouse/Lever/Ashby ATS) — that is expected (see "Reality" above).
At least the Greenhouse/Lever/Ashby ones should be `ready` with a non-zero `questionCount`.

- [ ] **Step 4: Verify the data landed in the database**

Via Supabase MCP `execute_sql` (or the SQL editor):

```sql
select j.title, j.company, j.questions_status, j.posting_key,
       count(q.id) as question_count
from jobs j
left join job_application_questions q on q.posting_key = j.posting_key
where j.questions_status is not null
group by j.id
order by j.created_at desc
limit 20;
```

Expected: rows with `questions_status` populated; `ready` rows have a matching
`question_count > 0` (unless the posting genuinely has no extra questions).

- [ ] **Step 5: Final verification**

Run: `npm run lint && npm run build`
Expected: both pass with no errors. Report the real output.

- [ ] **Step 6: Commit any final fixes**

If Steps 3–5 surfaced fixes, commit them:

```bash
git add -A
git commit -m "fix(auto-apply): address curation-extraction dev-run findings"
```

---

## Self-Review

**Spec coverage (against `docs/superpowers/specs/2026-05-21-auto-apply-engine-design.md`):**
- §3 "Daily curation cron → extraction service → store job + questions" — Tasks 3, 4. ✅
- §5 `job_application_questions` keyed by `posting_key` — pre-existing; `jobs.posting_key` link added in Task 1. ✅
- §6 extraction state machine (`pending → ready` / `failed`) — `questions_status` in Task 1; `unsupported` added for the no-extractor case. ✅
- §10.1.2 "extract once per posting, shared" — provided by the pre-existing `getOrExtractQuestions` cache; unchanged. ✅
- §2 gated display, §7–9 apply flow, Skyvern-scrape extractor, pricing — **deliberately out of scope** (stated above). ✅

**Placeholder scan:** No TBD/TODO; every code step contains complete code. Task 2 and
Task 5 Step 1 instruct reading a specific named file before editing — that is a concrete
instruction, not a placeholder.

**Type consistency:** `questions_status` and `posting_key` spelled identically across the
migration (Task 1), types (Task 2), wiring function (Task 3), and verification SQL (Task 6).
`QuestionsStatus` union and `extractAndStoreForJob` signature defined in Task 3 and used
unchanged in Tasks 4 and 5.
