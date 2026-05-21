# Auto-Apply Milestone 1 — Job-Detail Question UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `jobs/[id]` page, show the job description (left) and its application questions (right); questions are extracted from the job's ATS, standard fields auto-fill from the user's JobSilver profile, and the user fills the gaps and saves a draft.

**Architecture:** A new `src/lib/auto-apply/` module handles ATS detection, question extraction (Greenhouse/Lever/Ashby public APIs), and profile-based pre-fill. Two new Supabase tables store extracted questions (shared per posting) and per-user application drafts. The existing `jobs/[id]` page gains a two-column layout with a new `ApplicationForm` client component. **No Skyvern submission in M1** — that is Milestone 2.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase (Postgres + Auth + RLS), shadcn/ui, Tailwind.

**Scope note:** This is Milestone 1 of 2. M2 (separate plan) adds the Skyvern apply pipeline: submit, fail-safe verification, webhook, status, quota. M1 produces working software on its own — a user can see and fill an application; it just isn't submitted yet.

**Reference implementation:** A proven proof-of-concept exists in the repo and should be used as the reference for extraction/normalization/prefill logic — port and harden it, do not re-derive:
- `src/app/api/poc-auto-apply/questions/route.ts` — Greenhouse URL parsing + question normalization
- `src/app/poc-auto-apply/page.tsx` — question rendering (text/textarea/select/file/multiselect), profile auto-fill matcher
- `src/app/poc-auto-apply/test-profile.ts` — the profile auto-fill matcher (`autoFillAnswers`)

**Spec:** `docs/superpowers/specs/2026-05-21-auto-apply-engine-design.md`. Two refinements adopted since the spec, carried by this plan:
1. **Answer source is profile-first** — standard fields pre-fill from the user's profile; the user fills only gaps (refines spec §2 "user-provided per-job").
2. **Semantic field classification** — extraction assigns each question a semantic type so the UI renders the correct input (refines spec §4/§5).

**Verification reality:** JobSilver has no automated test suite (per `CLAUDE.md`). Verification for every task = `npm run lint` + `npm run build` + a stated manual/visual check. Do not invent a test runner.

**Migrations:** never edit existing files in `supabase/migrations/` — add new ones. The migration in Task 1 runs against the **production** "Job Tracker" database — it must be reviewed by the repo owner before it is applied.

---

## File Structure

**Created:**
- `supabase/migrations/20260521000000_add_auto_apply_questions.sql` — new tables + RLS
- `src/lib/auto-apply/types.ts` — shared TypeScript types
- `src/lib/auto-apply/platform-detector.ts` — ATS detection + URL parsing
- `src/lib/auto-apply/classify.ts` — semantic field classification
- `src/lib/auto-apply/extraction/greenhouse.ts` — Greenhouse question extractor
- `src/lib/auto-apply/extraction/lever.ts` — Lever question extractor
- `src/lib/auto-apply/extraction/ashby.ts` — Ashby question extractor
- `src/lib/auto-apply/extraction/index.ts` — `extractQuestions()` dispatcher
- `src/lib/auto-apply/questions-store.ts` — get-or-extract + cache by posting key
- `src/lib/auto-apply/profile-prefill.ts` — map a profile to pre-filled answers
- `src/app/api/auto-apply/[jobId]/questions/route.ts` — GET questions + prefill
- `src/app/api/auto-apply/[jobId]/answers/route.ts` — PUT save draft answers
- `src/components/auto-apply/application-form.tsx` — the questions form (client)
- `src/components/auto-apply/phone-field.tsx` — phone input with country code

**Modified:**
- `src/app/(dashboard)/jobs/[id]/page.tsx` — two-column layout + `ApplicationForm`

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260521000000_add_auto_apply_questions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Auto-apply Milestone 1: extracted questions (shared per posting) + per-user drafts.

create table if not exists public.job_application_questions (
  id            uuid primary key default gen_random_uuid(),
  posting_key   text not null,                 -- hash of the canonical application URL
  field_key     text not null,                 -- the ATS field identifier
  label         text not null,
  field_type    text not null,                 -- text|textarea|select|multiselect|file
  semantic_type text not null default 'text',  -- text|email|phone|url|select|file|date|number
  required      boolean not null default false,
  options       jsonb,                         -- [{label,value}] for select/multiselect
  source        text not null,                 -- 'api' | 'skyvern'
  position      integer not null default 0,
  extracted_at  timestamptz not null default now(),
  unique (posting_key, field_key)
);
create index if not exists job_application_questions_posting_key_idx
  on public.job_application_questions (posting_key);

create table if not exists public.job_applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  job_id       uuid not null references public.jobs (id) on delete cascade,
  posting_key  text not null,
  answers      jsonb not null default '{}'::jsonb,
  status       text not null default 'draft',  -- M1: draft only. M2 adds queued/submitting/applied/...
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, job_id)
);
create index if not exists job_applications_user_id_idx
  on public.job_applications (user_id);

-- RLS
alter table public.job_application_questions enable row level security;
alter table public.job_applications enable row level security;

-- Questions are shared, non-sensitive reference data: any authenticated user may read.
create policy "questions readable by authenticated"
  on public.job_application_questions for select
  to authenticated using (true);

-- Drafts are private to their owner.
create policy "applications selectable by owner"
  on public.job_applications for select to authenticated
  using (auth.uid() = user_id);
create policy "applications insertable by owner"
  on public.job_applications for insert to authenticated
  with check (auth.uid() = user_id);
create policy "applications updatable by owner"
  on public.job_applications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Owner review gate**

Do NOT auto-apply. Present the migration to the repo owner. Writes/inserts to `job_application_questions` are done server-side with the service-role client, so no INSERT policy is needed for it.

- [ ] **Step 3: Apply the migration**

After owner approval, apply via the Supabase MCP `apply_migration` (project `pjgdcasgyxjooqwihivh`) or the Supabase SQL editor.

- [ ] **Step 4: Verify**

Run `list_tables` (Supabase MCP) and confirm both tables exist with RLS enabled.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260521000000_add_auto_apply_questions.sql
git commit -m "feat(auto-apply): add job_application_questions + job_applications tables"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/auto-apply/types.ts`

- [ ] **Step 1: Write the types**

```ts
export type AtsPlatform = 'greenhouse' | 'lever' | 'ashby' | 'other'

export type FieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'file'

export type SemanticType =
  | 'text' | 'email' | 'phone' | 'url' | 'select' | 'file' | 'date' | 'number'

export interface QuestionOption { label: string; value: string }

export interface ApplicationQuestion {
  fieldKey: string
  label: string
  fieldType: FieldType
  semanticType: SemanticType
  required: boolean
  options?: QuestionOption[]
  position: number
  source: 'api' | 'skyvern'
}

export interface ExtractionResult {
  postingKey: string
  questions: ApplicationQuestion[]
}

/** A question plus, if applicable, the value pre-filled from the user's profile. */
export interface PrefilledQuestion extends ApplicationQuestion {
  prefilledValue?: string
  prefilledFromProfile: boolean
}
```

- [ ] **Step 2: Verify** — `npm run lint`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/types.ts
git commit -m "feat(auto-apply): add shared types"
```

---

## Task 3: Platform detector

**Files:**
- Create: `src/lib/auto-apply/platform-detector.ts`

- [ ] **Step 1: Implement**

Provide `detectAts(url: string): AtsPlatform` and per-ATS URL parsers. Port `parseGreenhouseUrl` from `src/app/api/poc-auto-apply/questions/route.ts` (path shape `/{boardToken}/jobs/{jobId}`). Add:
- `parseLeverUrl(url)` → `{ site, postingId }` from `jobs.lever.co/{site}/{postingId}` (and `jobs.eu.lever.co`).
- `parseAshbyUrl(url)` → `{ jobBoardName, jobPostingId }` from `jobs.ashbyhq.com/{org}/{uuid}`.
Each parser returns `null` if the URL does not match.
Also export `computePostingKey(url: string): string` — normalize the URL (lowercase host, strip query/hash and trailing slash) and return a SHA-256 hex digest via `node:crypto`.

- [ ] **Step 2: Verify** — `npm run lint` + `npm run build`. Manually: in a Node REPL or a scratch script, confirm `detectAts('https://job-boards.greenhouse.io/stockx/jobs/8465053002')` returns `'greenhouse'` and `computePostingKey` is stable across the same URL with/without query string.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/platform-detector.ts
git commit -m "feat(auto-apply): add ATS platform detector and URL parsers"
```

---

## Task 4: Semantic field classification

**Files:**
- Create: `src/lib/auto-apply/classify.ts`

- [ ] **Step 1: Implement `classifySemanticType`**

```ts
import type { FieldType, SemanticType } from './types'

/** Infer a semantic type from a field's key, label, and base field type. */
export function classifySemanticType(
  fieldKey: string,
  label: string,
  fieldType: FieldType,
): SemanticType {
  if (fieldType === 'select' || fieldType === 'multiselect') return 'select'
  if (fieldType === 'file') return 'file'
  const hay = `${fieldKey} ${label}`.toLowerCase()
  if (/\bemail\b/.test(hay)) return 'email'
  if (/\bphone\b|\bmobile\b|\btelephone\b/.test(hay)) return 'phone'
  if (/linkedin|github|portfolio|website|\burl\b/.test(hay)) return 'url'
  if (/\bdate\b/.test(hay)) return 'date'
  return 'text'
}
```

- [ ] **Step 2: Verify** — `npm run lint`. Manually confirm a field labelled "Phone" → `'phone'`, "LinkedIn Profile" → `'url'`, "Email" → `'email'`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/classify.ts
git commit -m "feat(auto-apply): add semantic field classification"
```

---

## Task 5: ATS question extractors

**Files:**
- Create: `src/lib/auto-apply/extraction/greenhouse.ts`
- Create: `src/lib/auto-apply/extraction/lever.ts`
- Create: `src/lib/auto-apply/extraction/ashby.ts`
- Create: `src/lib/auto-apply/extraction/index.ts`

- [ ] **Step 1: Greenhouse extractor**

`extractGreenhouseQuestions(url)`: parse with `parseGreenhouseUrl`, fetch
`https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true`,
normalize. Port the field-type map and one-question-per-field expansion from
`src/app/api/poc-auto-apply/questions/route.ts`. For each emitted question call
`classifySemanticType`. Map Greenhouse `input_file` → `fieldType:'file'`. Set
`source:'api'`, assign incremental `position`. Return `ApplicationQuestion[]`.

- [ ] **Step 2: Lever extractor**

`extractLeverQuestions(url)`: fetch `https://api.lever.co/v0/postings/{site}/{postingId}?mode=json`. Lever postings expose custom application questions under the posting's `customQuestions` / form cards. Map text → `text`, textarea → `textarea`, multiple-choice → `select` with `options`. Include the standard Lever fields (name, email, phone, resume, org, links) as questions. Set `source:'api'`.

- [ ] **Step 3: Ashby extractor**

`extractAshbyQuestions(url)`: call the Ashby public posting API
(`https://api.ashbyhq.com/posting-api/job-board/{jobBoardName}` then select the posting, or the per-posting endpoint) and read `applicationFormDefinition` / form sections. Map Ashby field types (`String`→`text`, `LongText`→`textarea`, `ValueSelect`→`select`, `File`→`file`, `Boolean`→`select`). Set `source:'api'`.

- [ ] **Step 4: Dispatcher**

`extraction/index.ts` exports `extractQuestions(url): Promise<ExtractionResult>` — calls `detectAts`, dispatches to the matching extractor, computes `postingKey`. For `'other'` throw a typed `UnsupportedAtsError` (M2 will route these to Skyvern).

- [ ] **Step 5: Verify** — `npm run lint` + `npm run build`. Manually: a scratch script calling `extractQuestions('https://job-boards.greenhouse.io/stockx/jobs/8465053002')` returns 11 questions including the notice-period `select` with 5 options. (Lever/Ashby: verify against one public posting each.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/auto-apply/extraction
git commit -m "feat(auto-apply): add Greenhouse/Lever/Ashby question extractors"
```

---

## Task 6: Question store (extract-once, cache by posting key)

**Files:**
- Create: `src/lib/auto-apply/questions-store.ts`

- [ ] **Step 1: Implement `getOrExtractQuestions`**

Signature: `getOrExtractQuestions(serviceClient, jobUrl): Promise<ApplicationQuestion[]>`.
- Compute `postingKey`.
- `select * from job_application_questions where posting_key = $1 order by position`.
- If rows exist → map to `ApplicationQuestion[]` and return (cache hit; no network).
- If none → `extractQuestions(jobUrl)`, then `insert` the rows (service-role client, so RLS is bypassed for the write), then return them.
- On a unique-violation race, re-select and return.
Uses `createServiceClient()` from `src/lib/supabase/server.ts`.

- [ ] **Step 2: Verify** — `npm run lint` + `npm run build`. Manually: call twice for the same URL; the second call performs no outbound ATS fetch (add a temporary `console.log` in the extractor to confirm, then remove it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/questions-store.ts
git commit -m "feat(auto-apply): add posting-keyed question store with caching"
```

---

## Task 7: Profile pre-fill

**Files:**
- Create: `src/lib/auto-apply/profile-prefill.ts`

- [ ] **Step 1: Implement `prefillFromProfile`**

Signature: `prefillFromProfile(questions: ApplicationQuestion[], profile: Profile): PrefilledQuestion[]`.
Port the matcher from `src/app/poc-auto-apply/test-profile.ts` (`autoFillAnswers`), adapted to the real `Profile` type (`src/lib/supabase/types.ts`) and its `screening_answers` blob (`ScreeningAnswers`). Match rules (case-insensitive on `fieldKey` + `label`):
- first name → `screening_answers.first_name`
- last name → `screening_answers.last_name`
- email → `profiles.email`
- `semanticType === 'phone'` → `profiles.phone` (already E.164 with country code)
- label/key contains `linkedin` → `screening_answers.linkedin_url`
- a `select` whose label mentions start/notice/availability → match `screening_answers.availability` to the closest option label
Anything unmatched (salary / "cost to company", cover letter, resume) → `prefilledFromProfile: false`, no value.
Return each question with `prefilledValue?` and `prefilledFromProfile`.

- [ ] **Step 2: Verify** — `npm run lint`. Manually: pass the 11 StockX questions + a profile fixture; confirm 8 fields get `prefilledFromProfile: true`, the 2 salary questions get `false`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto-apply/profile-prefill.ts
git commit -m "feat(auto-apply): add profile-based answer pre-fill"
```

---

## Task 8: API routes

**Files:**
- Create: `src/app/api/auto-apply/[jobId]/questions/route.ts`
- Create: `src/app/api/auto-apply/[jobId]/answers/route.ts`

- [ ] **Step 1: Questions route (GET)**

`export const dynamic = 'force-dynamic'`. Authenticate via the cookie-bound server client (`createClient()` from `lib/supabase/server.ts`); 401 if no user. Load the `jobs` row for `jobId` (RLS scopes it to the user). Resolve the job's application URL. If `detectAts` is `'other'` → respond `{ supported: false }`. Else: `getOrExtractQuestions(...)`, load the user's `profiles` row, `prefillFromProfile(...)`, load any existing `job_applications` draft answers, and respond `{ supported: true, questions: PrefilledQuestion[], savedAnswers }`. Error shape `{ error: { code, message } }`. Rate-limit via `lib/security/rate-limit.ts`.

- [ ] **Step 2: Answers route (PUT)**

`export const dynamic = 'force-dynamic'`. Authenticate. Body `{ answers: Record<string,string> }`. Validate with Zod (`lib/security/validation.ts` pattern). `upsert` into `job_applications` on conflict `(user_id, job_id)` with `answers`, `posting_key`, `status:'draft'`, `updated_at: now()`. Respond `{ ok: true }`.

- [ ] **Step 3: Verify** — `npm run lint` + `npm run build`. Manually with the dev server + a logged-in session: `GET /api/auto-apply/{realJobId}/questions` returns questions; `PUT .../answers` persists (confirm a row appears in `job_applications` via the Supabase MCP).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auto-apply
git commit -m "feat(auto-apply): add questions + answers API routes"
```

---

## Task 9: Phone field component

**Files:**
- Create: `src/components/auto-apply/phone-field.tsx`

- [ ] **Step 1: Implement**

A controlled phone input with a country-code selector. Reuse the existing `src/components/ui/phone-input.tsx` and `src/lib/data/countries.ts` if they fit; otherwise wrap them. Value is a single E.164-style string (`+48511390981`). Props: `value`, `onChange`, `id`, `required`.

- [ ] **Step 2: Verify** — `npm run lint`. Visual check in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/components/auto-apply/phone-field.tsx
git commit -m "feat(auto-apply): add phone field with country code"
```

---

## Task 10: ApplicationForm component

**Files:**
- Create: `src/components/auto-apply/application-form.tsx`

- [ ] **Step 1: Implement**

Client component. Props: `jobId`. On mount, `GET /api/auto-apply/{jobId}/questions`.
- If `supported: false` → render a "Apply on the company site" external-link fallback.
- Else render each question by `semanticType`: `phone` → `<PhoneField>`; `email` → email `<Input>`; `url` → url `<Input>`; `select` → shadcn `<Select>` with options; `file` → a note "Resume is taken from your profile CV" (M1: no upload here — the profile CV is used; M2 wires the actual file); `text`/`date`/`number` → `<Input>`; `textarea` → `<Textarea>`.
- Seed state from `savedAnswers` if present, else `prefilledValue`.
- Show a subtle "from profile" pill on questions where `prefilledFromProfile` is true, and a header line "N of M filled from your profile — fill the rest". All values editable.
- A "Save" button → `PUT /api/auto-apply/{jobId}/answers`; show saved/error state. (The "Apply" button is M2 — render it disabled with tooltip "Coming soon".)
Render rendering logic by porting from `src/app/poc-auto-apply/page.tsx`.

- [ ] **Step 2: Verify** — `npm run lint` + `npm run build`. Visual check in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/components/auto-apply/application-form.tsx
git commit -m "feat(auto-apply): add ApplicationForm component"
```

---

## Task 11: Job-detail page integration

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx`

- [ ] **Step 1: Two-column layout**

Read the current page first to follow its data-loading and styling patterns. Restructure the main content into a responsive two-column layout: **left** = the existing job description / details; **right** = `<ApplicationForm jobId={job.id} />`. On narrow screens stack (description above form). Keep all existing page behavior (match score, notes, status controls) intact — only wrap/relayout.

- [ ] **Step 2: Verify**

`npm run lint` + `npm run build`. Then with the dev server and a logged-in session, open a real Greenhouse-sourced job at `/jobs/{id}`:
- description shows left, questions show right;
- standard fields are pre-filled with "from profile" pills;
- the salary/gap questions are empty;
- editing + Save persists (re-open the page → values remain).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/jobs/[id]/page.tsx"
git commit -m "feat(auto-apply): show application questions on the job detail page"
```

---

## Out of scope for M1 (→ Milestone 2)

- Skyvern apply pipeline: submit, fail-safe field verification (spec §7), webhook, status polling.
- The `application_queue` / submission status states beyond `draft`.
- Per-plan applications/day quota + feature gating.
- Skyvern-based extraction for no-API ATS (`detectAts === 'other'`).
- Eager extraction during the daily-curation cron (M1 extracts on first job-detail load, then caches by posting key — functionally equivalent for supported ATS, just lazier on the first view).
- Adding salary capture to the JobSilver profile/setup (the identified product gap).
