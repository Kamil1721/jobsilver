# Design Spec — JobSilver Auto-Apply Engine (Skyvern-powered)

**Date:** 2026-05-21
**Status:** Approved design — ready for implementation planning
**Sub-project:** B of 3 (A: question extraction — folded in here; C: pricing redesign — separate)

## 1. Goal

Rebuild a job auto-apply capability for JobSilver. A job arrives on the user's
dashboard already carrying its application questions. The user opens the job, fills
the answers himself on JobSilver, and clicks **Apply**. Skyvern then fills out and
submits the real application on the employer's ATS site, unattended.

The auto-apply subsystem was previously built and fully removed (Jan 2026; tables
dropped by `supabase/migrations/20260206_drop_unused_legacy_tables.sql`). This is a
ground-up rebuild with Skyvern as the browser-automation engine, not a revival of the
old code.

## 2. Locked Decisions

These were settled during brainstorming and are not open for re-litigation in the plan:

| Decision | Choice | Rationale |
|---|---|---|
| Platform scope (v1) | **No-login ATS only** | Login-required ATS (Workday etc.) would force JobSilver to store users' ATS credentials — a security/UX liability deferred to v2. |
| Skyvern hosting | **Skyvern Cloud REST API** | Includes the managed anti-bot/CAPTCHA layer (absent from the open-source build); keeps Skyvern's AGPL license out of JobSilver's codebase since JobSilver is only an API consumer. |
| Submit mode | **Full-auto, fail-safe** | No human review after the user clicks Apply — but submission happens only when correctness is programmatically verified (see §7). |
| Answer source | **User-provided, per-job** | The user fills every answer himself on JobSilver. No AI-generated answers in v1. |
| Extraction timing | **Eager — gated display** | A job appears in the user's UI **only once both** its description **and** its full question set are scraped and stored. Incomplete jobs are not shown. |
| Extraction caching | **Once per posting, shared** | Question extraction runs once per unique job posting (keyed by canonical URL) and is shared across every user whose feed contains it — never re-run per user. The primary cost control. |
| Extraction strategy | **Hybrid** | Greenhouse/Lever/Ashby questions from their free official API (exact); Skyvern scrape for other no-login ATS. |
| Submission path | **Always Skyvern** | ATS APIs are read-only (questions); they do not accept third-party submissions. Every application is submitted by Skyvern, all ATS. |

### Explicitly out of scope (YAGNI)
- Login-required ATS (Workday and similar) and the encrypted credential vault — v2.
- AI-generated application answers — the user provides all answers.
- LinkedIn / Indeed auto-apply — direct Terms-of-Service violation; never.
- Any "assisted" / review-before-submit mode — full-auto only.
- Application submission via ATS partner APIs — Skyvern handles all submissions in v1.

## 3. Architecture Overview

Skyvern Cloud performs all browser work, so JobSilver needs **no separate worker or
droplet** (unlike the removed system). JobSilver's responsibilities are: extract
questions during curation, render the form, queue Skyvern tasks, and receive webhooks.

```
Daily curation cron
  └─ for each fetched job:
       platform-detector → classify ATS
       extraction service → questions (API or Skyvern scrape)
       store job + job_application_questions   → job appears on dashboard

User opens job → fills answers → clicks Apply
  └─ POST /api/auto-apply/[jobId]/submit
       validate answers, create job_applications row (queued)
       create Skyvern Cloud apply task (workflow: navigate → fill → verify → submit)
       store skyvern_task_id → user returns to dashboard

Skyvern runs (1–5 min, async)
  └─ POST /api/auto-apply/webhook   (Skyvern → JobSilver on completion)
       update status: applied | failed | failed_verification | needs_refresh
       store result screenshot + submitted answers
```

## 4. Components

| Component | Location | Responsibility |
|---|---|---|
| Platform detector | `src/lib/auto-apply/platform-detector.ts` | Classify a job URL into an ATS type; flag no-login vs login-required vs unsupported. |
| Extraction service | `src/lib/auto-apply/extraction/` | Hybrid question extraction → normalized `ApplicationQuestion[]`. API extractors reuse/extend `src/lib/api/{greenhouse,lever,ashby}.ts`; Skyvern extractor for the rest. |
| Skyvern client | `src/lib/skyvern/` | Thin wrapper over the Skyvern Cloud REST API: create task/workflow, get status, verify webhook signatures. |
| Application form UI | `src/components/auto-apply/` | Render the question set on the `jobs/[id]` page; collect answers; attach resume from existing CV tooling; Apply button. |
| Apply API | `src/app/api/auto-apply/` | `submit`, `webhook`, `status` route handlers. |

## 5. Data Model (new migration)

**`job_postings`** (or equivalent canonical-posting key) — the dedup anchor.
JobSilver's `jobs` table is **per-user**: one posting becomes N rows for N users. To
extract questions only once per posting (not once per user), questions are keyed by a
**canonical posting identity** — the normalized application URL — not by a per-user
`jobs.id`. A `posting_key` (hash of the canonical URL) is the shared key. Each
per-user `jobs` row references its `posting_key`.

**`job_application_questions`** — extracted question set, one row per question per
**posting** (shared across all users who have that posting):
- `id`, `posting_key` (canonical posting identity — NOT per-user `job_id`)
- `label`, `type` (text/textarea/select/checkbox/radio/file/date/number/email/phone/url)
- `required` (bool), `options` (JSONB, for select/radio), `validation` (JSONB)
- `ats_field_identifier` — how Skyvern locates the real field
- `source` — `'api'` | `'skyvern'`
- `extracted_at`

A posting's questions are extracted once; every user whose feed contains that posting
reads the same rows. A job is displayed to a user only when its `posting_key` has a
complete `questions_ready` set (see §2 — gated display).

**`job_applications`** — one row per user+job application:
- `id`, `user_id` (FK), `job_id` (FK)
- `status` — see §6
- `answers` (JSONB) — the user's submitted answers, keyed to question ids
- `resume_file_ref` — pointer to the CV used
- `skyvern_task_id`
- `submitted_at`, `result_screenshot_url`, `failure_reason`
- timestamps
- **Unique constraint on `(user_id, job_id)`** — one application per user per job. A
  re-apply after a `failed` / `failed_verification` / `needs_refresh` outcome reuses
  the existing row (status reset) rather than creating a second.

**Cleanup:** drop the orphaned `jobs.auto_apply_status` column and remove the dead
`AutoApplyMode` / `AutoApplyStatus` / `AutoApplyQuota` / `apply_mode` types from
`src/lib/supabase/types.ts`. Do not edit existing migrations — add new ones.

## 6. State Machines

**Extraction (per job):**
`questions_pending → questions_ready` — or `questions_failed` (job shown as
manual-apply, not auto-applyable).

**Application (per user+job):**
`draft` (user filling the form) `→ queued → submitting → applied`
Failure branches from `submitting`:
- `failed` — Skyvern could not complete the run (site error, timeout).
- `failed_verification` — fields did not verify; nothing was submitted (§7.2).
- `needs_refresh` — the live form no longer matches the extracted questions; nothing
  was submitted (§7.1). Triggers re-extraction.

## 7. Correctness / Fail-Safe Layer

This is the core guarantee: **full-auto, but it never blind-submits a form it cannot
verify.** Three checks, all enforced inside the Skyvern apply workflow:

### 7.1 Re-validate at apply time
Before filling, confirm the live form's fields still match the stored
`job_application_questions`. If the form changed (new/removed/renamed fields), abort:
status `needs_refresh`, do not submit, trigger re-extraction, surface to the user.

### 7.2 Field-by-field verification before submit
The workflow fills every field, then reads each one back and confirms it equals the
intended answer. If any field mismatches, or the real form has an unexpected required
field with no answer, abort *without clicking submit*: status `failed_verification`,
surface to the user with detail.

### 7.3 Post-submission audit record
On success, store the final screenshot and the exact answers submitted. Every
application sent under the user's name is auditable from the dashboard.

## 8. API Surface

- `POST /api/auto-apply/[jobId]/submit` — validate the answer payload against the
  question set, create a `job_applications` row (`queued`), create the Skyvern apply
  task, store `skyvern_task_id`. Quota-checked (§10). Returns immediately.
- `POST /api/auto-apply/webhook` — Skyvern completion callback. Verify the webhook
  signature, update `job_applications` status + result, store screenshot.
- `GET /api/auto-apply/status` — dashboard polling for in-flight applications.

Route conventions follow the repo standard: `dynamic = 'force-dynamic'`, error shape
`{ error: { code, message } }`, rate-limited via `src/lib/security/rate-limit.ts`.

## 9. Skyvern Integration

- **Cloud REST API**, called from JobSilver backend route handlers.
- New env vars: `SKYVERN_API_KEY`, `SKYVERN_BASE_URL`, `SKYVERN_WEBHOOK_SECRET`.
- Apply runs are async (1–5 min). The dashboard reflects live status via polling.
- The apply workflow is a Skyvern workflow: navigate to job URL → fill fields from the
  answer payload → verify (§7.1, §7.2) → submit → screenshot.
- Resume upload: the user's CV (from existing `src/lib/cv/` tooling) is passed to the
  Skyvern task as the file for any file-upload field.

## 10. Quota, Gating & Pricing Tie-In

- Auto-apply is a gated feature (`src/lib/features/config.ts`).
- Reintroduce a daily **applications quota** (the removed system had a
  `check_and_reserve_application_quota` Postgres function — rebuild equivalently with
  atomic reservation).
- Cost model (drives sub-project C, pricing redesign):
  - Question extraction: free for Greenhouse/Lever/Ashby; ~$0.30–$1.00 per Skyvern
    scrape for long-tail ATS.
  - Submission: ~$0.35–$1.00 per application (Skyvern Cloud, non-deterministic;
    failed/retried runs still consume credits).
- The pricing redesign (sub-project C) consumes the finalized per-application cost and
  the chosen daily quota numbers. Quota tier values are **deferred to sub-project C**;
  this spec only requires that the quota mechanism exists and is enforced at `submit`.

### 10.1 Skyvern Credit Cost Controls

Credits burn on every Skyvern run (extraction scrapes and apply submissions); failed
runs still cost. With eager gated display (§2) the controls that apply are:

1. **Maximize the free path.** Greenhouse/Lever/Ashby questions come from their free
   API — zero credits. Resolve each posting's real URL (including fantastic.jobs
   listings, many of which are Greenhouse/Lever/Ashby underneath) and route to the
   free API wherever possible. Skyvern extraction is only for genuinely no-API ATS.
2. **Extract once per posting, shared.** Keyed by `posting_key` (§5) — one extraction
   serves every user who has that posting. The largest single saving.
3. **Templated Skyvern workflows per ATS.** Once an ATS's form is solved, run a
   parameterized workflow instead of fresh agentic exploration — fewer actions/credits.
4. **Cheap pre-flight.** Try a plain `fetch` + lightweight HTML parse before spending a
   Skyvern run; before an apply run, confirm the posting URL is still live (not
   404/expired).
5. **Hard caps + global circuit breaker.** Cap retries at 1; set per-task action/time
   limits; abort early on the §7 fail-safe checks. Add a global daily Skyvern credit
   budget that halts runs past a threshold (reuse the existing fantastic.jobs
   "global quota guard" pattern).
6. **Per-plan applications/day quota** — the hard ceiling on per-user submission spend.

## 11. Dependencies & Open Items

- **Skyvern Cloud account** + API key must be provisioned before integration testing.
- **Workflow definition** — the exact Skyvern workflow/prompt for the fill-verify-submit
  sequence will be developed and tuned during implementation against real ATS forms.
- **ATS coverage list** — the concrete set of "no-login ATS" supported in v1 (beyond
  Greenhouse/Lever/Ashby) is finalized during implementation as the platform detector
  is built; each non-API ATS needs a Skyvern extraction check.
- **Sub-project C (pricing)** depends on the cost numbers validated here.

## 12. Assumptions & Risks

These are load-bearing assumptions the implementation plan must inherit as explicit
gates, not hidden traps.

### 12.1 Skyvern per-field verification is unproven (HIGH RISK)
The fail-safe layer (§7.2 — fill, read each field back, prove equality before submit)
is the entire mechanism behind the "no mistakes" guarantee. Skyvern is an LLM-driven
agent, not a deterministic form-filler; its ability to reliably read back filled
values and assert field-level equality is **not yet validated**.

**Gate:** before committing to this architecture, implementation must build a
proof-of-concept of the read-back-and-compare workflow against a real ATS form. If
Skyvern cannot expressly support per-field verification, §7 must be redesigned (e.g.
JobSilver-side screenshot/DOM diffing) before further build-out.

### 12.2 Pricing must be solvable (HIGH RISK — constrains sub-project C)
Even with hybrid extraction, a long-tail-ATS-heavy day for an Ultra user (eager
extraction × multiple paid Skyvern scrapes × full Skyvern submissions) can exceed the
plan's daily-amortized revenue.

**Constraint for sub-project C:** the applications-per-day quota must be sized so that
worst-case daily Skyvern cost per user stays below the plan's daily-amortized revenue.
If no quota satisfies this at acceptable plan prices, the product model — not just the
pricing page — needs revisiting.

### 12.3 Smaller open items for the implementation plan
- **Unsupported-ATS dashboard behavior** — define what the user sees for a job whose
  URL resolves to a login-required ATS / LinkedIn / Indeed / unknown platform
  (manual-apply badge with an external link is the expected default; confirm).
- **Webhook reliability** — Skyvern's completion webhook may be dropped. Add a polling
  fallback with a timeout so a `submitting` row cannot stall indefinitely.
- **Resume upload mechanism** — how the user's CV reaches the Skyvern task (signed
  Supabase Storage URL vs. base64 vs. direct upload) is unspecified; decide during
  implementation.
- **Multi-page / conditional ATS forms** — the §5 question model is field-flat. Real
  ATS forms can be multi-page with conditional fields. v1 should define which form
  shapes are supported and how unsupported shapes degrade (e.g. fall back to
  manual-apply rather than a partial submission).

## 13. Success Criteria

- A curated job reaches the dashboard with an accurate, complete question set.
- A user can fill the form and submit; the application is filled and submitted on the
  real ATS by Skyvern.
- No application is ever submitted unless §7.1 and §7.2 pass.
- Every submitted application has an audit record (screenshot + answers).
- Auto-apply is quota-gated and only available to entitled plans.
