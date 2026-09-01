# Critical Flow Regression Suite Plan

**Goal:** Convert the manually proven onboarding and job-discovery path into a deterministic local/CI regression suite before further product work can reintroduce legacy setup screens or break account, upload, quota, curation, or notification behavior.

**Current baseline (verified manually 2026-08-27):** Signup/login profile bootstrap → free-plan selection → five-step Dawn setup → valid TXT CV upload → corrupt PDF rejection with Storage cleanup → configuration save → real job search → three saved job cards → job detail. The repository currently has no automated test runner.

**Smallest proposed stack:** Add only `@playwright/test`, selecting its then-current Node 24-compatible release from official Playwright documentation at implementation time. Use it for browser, API, and database-backed integration tests; use the existing `pg` package for direct local Postgres setup/assertions. Run the application as a Next 16 production server on Node 24. Start with one worker because some tests deliberately alter isolated database permissions or exercise shared quota rows.

This document plans future work only. It does not authorize dependency installation, application changes, database migrations, or production traffic.

## Proposed layout

| Path | Responsibility |
|---|---|
| `playwright.config.ts` | Node 24, production-server webServer, serial default, trace/screenshot on failure |
| `tests/e2e/onboarding.spec.ts` | Password bootstrap, plan selection, Dawn setup, upload, search, dashboard, job detail |
| `tests/e2e/oauth-bootstrap.spec.ts` | Google-shaped local auth identity and post-OAuth bootstrap/redirect contract |
| `tests/e2e/profile-failure.spec.ts` | Recoverable profile-read 503 experience |
| `tests/integration/cv-upload.spec.ts` | PDF/DOCX/TXT validation, replacement, rejection, and Storage cleanup |
| `tests/integration/job-quota.spec.ts` | Concurrent reserve/settle, idempotent retry, partial settlement, lease recovery |
| `tests/integration/daily-curation.spec.ts` | Scheduled curation deduplication and rerun behavior |
| `tests/integration/notification-email.spec.ts` | Captured outbound job-match email and notification ledger |
| `tests/fixtures/cv/` | Tiny synthetic valid and corrupt files containing no personal data |
| `tests/support/` | Auth, local Supabase, database cleanup, fixed job-source, and email-capture helpers |

## Phase 1 — Harness and isolation

- [ ] Add `@playwright/test` and scripts for `test:e2e`, `test:integration`, and `test:critical`; do not introduce Jest, Vitest, MSW, or a second assertion library.
- [ ] Run a production build and `next start` through Playwright's `webServer`; fail the suite if the app or local Supabase is unavailable.
- [ ] Require an explicitly local database URL (loopback host and dedicated test database). Abort before setup if the URL resembles production.
- [ ] Give every run a unique `run_id`; tag all synthetic emails, users, jobs, quota reservations, notifications, and Storage object paths with it.
- [ ] Provide helpers that create auth users through the local Supabase admin API, obtain browser sessions without exposing credentials, and query Postgres through the existing `pg` package.
- [ ] Stub only nondeterministic boundaries: job-source responses and outbound email delivery. Keep Next routes, Supabase Auth/PostgREST/Storage, SQL functions, page navigation, and browser uploads real.
- [ ] Record a trace, screenshot, console errors, failed network requests, and relevant server output on failure.

**Harness acceptance criteria**

- `npm run test:critical` starts from an empty run-specific dataset and works twice consecutively.
- No test calls production Supabase, live ATS/RapidAPI sources, Google credential forms, or Resend.
- Failure artifacts make the route, response status, browser state, and run ID identifiable without containing secrets or CV content.

## Phase 2 — Authentication, plan, and Dawn setup

### Password critical path

- [ ] Create a local password user with no application profile, sign in through `/login`, and assert `/api/auth/bootstrap-profile` creates exactly one `profiles` row and any required compatibility identity row.
- [ ] Reload and sign in again; assert bootstrap is idempotent and creates no duplicate profile/identity rows.
- [ ] Select Free and assert `has_selected_plan=true`, `subscription_plan='free'`, and navigation to the five-step setup.
- [ ] At every setup step, assert the Dawn heading/controls are visible and maintain a deny-list assertion for known legacy setup text, selectors, logos, and metallic panel classes.
- [ ] Complete all five steps, assert the CV-required guard prevents early finalization, upload the valid fixture, save configuration, and verify persisted filters/screening data before the first search.
- [ ] Assert successful search reaches the Dawn dashboard, displays saved cards, and a card opens the matching Dawn job detail.

### OAuth bootstrap contract

- [ ] Provision a local Supabase auth user with Google-shaped provider metadata and an authenticated browser session; call the same bootstrap boundary used after `/auth/callback`.
- [ ] Assert email/name metadata is normalized into one profile, bootstrap is idempotent, and routing is choose-plan → setup for a new identity and dashboard for a completed identity.
- [ ] Add a staging-only smoke check that starts the Google handoff and validates the configured callback origin. Do not automate a Google login form, store Google credentials, or make this smoke check a CI blocker.

### Invalid-filter recovery

- [ ] Make the deterministic job-source fixture reject the first saved filter combination as invalid.
- [ ] Assert the setup remains recoverable: user input and uploaded CV survive, the error is understandable, and the user can return to the relevant filter step.
- [ ] Correct the filter, retry once, and assert only one finalized configuration and one set of saved jobs are produced.

**Authentication/setup acceptance criteria**

- Password and Google-shaped identities each produce exactly one application profile.
- No completed-user navigation exposes choose-plan or setup; `/setup` without edit intent redirects to dashboard.
- No setup route displays a legacy screen at desktop, 390×844 mobile, or after a hard reload.
- A failed first search never discards setup data or strands the user; the corrected retry reaches dashboard.

## Phase 3 — CV upload and cleanup matrix

Run each case through the real `/api/cv/upload` route and local Storage:

| Case | Expected result |
|---|---|
| Valid `.txt` | 200, parsed non-empty content, profile points to the uploaded object |
| Valid `.pdf` | 200, readable content extracted, no worker/chunk error |
| Valid `.docx` | 200, readable content extracted |
| Empty allowed-format file | 422, stable user-facing error, no object/profile mutation |
| Truncated/corrupt PDF | 422, stable user-facing error, no orphan object |
| Corrupt DOCX/ZIP | 422, stable user-facing error, no orphan object |
| Unsupported extension/MIME mismatch | 400/415 contract response, no object written |
| Valid replacement | New object/profile committed; old object removed only after success |
| Failed replacement | Old object/profile remains usable; failed new object removed |
| Explicit delete | Storage object removed before profile URL is cleared; Storage failure leaves profile intact |

**Upload acceptance criteria**

- Every rejected upload leaves the user's profile and object count exactly as they were before the request.
- Successful replacement leaves exactly one current CV object for the user.
- API errors are JSON with stable status/code/message fields and never expose parser internals.
- Browser setup and profile-upload controls show the same result as the API/database state.

## Phase 4 — Quota reservation correctness

Exercise `reserve_daily_job_quota` and `settle_daily_job_quota` directly against isolated local Postgres rows, then repeat the main cases through `/api/jobs/search`.

- [ ] Launch at least 20 simultaneous reservations against one user whose daily limit is 3; total reserved plus fetched must never exceed 3.
- [ ] Settle one reservation partially and assert unused slots become available while only saved jobs increment `jobs_fetched`.
- [ ] Retry the identical settlement concurrently and sequentially; it must return the same result without double counting.
- [ ] Retry a settled reservation with a different saved count; it must fail without changing quota state.
- [ ] Simulate response loss after database commit, repeat settlement with the same reservation ID, and assert exactly-once accounting.
- [ ] Leave a reservation un-settled past its lease, run the planned lease-recovery operation, and assert slots are released once, the reservation is marked expired/recovered, and a later stale settlement cannot consume another reservation's slots.
- [ ] Cross midnight using database-controlled dates (not workstation clock changes) and assert reservations settle only against their recorded quota date.

**Quota acceptance criteria**

- Invariants hold after every test: `jobs_fetched >= 0`, `jobs_reserved >= 0`, and `jobs_fetched + jobs_reserved <= jobs_limit`.
- Reservation IDs are the idempotency key; no retry can charge or release a different reservation.
- Search failures settle or recover all reserved capacity, and saved-job count equals charged quota count.

## Phase 5 — Scheduled curation and notification

### Curation deduplication

- [ ] Feed a fixed source containing duplicate URLs, reordered duplicates, and the same postings on two consecutive scheduled runs.
- [ ] Trigger `src/app/api/cron/daily-curation/route.ts` twice with valid local cron authorization.
- [ ] Assert the first run saves each canonical posting once and the second creates no duplicate jobs, consumes no extra quota for existing jobs, and records a successful no-new-work result.
- [ ] Run two curation requests concurrently; enforce the same uniqueness and quota assertions.

### Verified notification email

- [ ] Add a narrow application-owned email transport seam to `src/lib/email/client.ts`: production remains Resend; tests send to a local in-process HTTP capture server. Guard the capture transport so it cannot activate in production.
- [ ] Curate known jobs for a notification-enabled user and assert one captured message has the expected recipient, subject, match count, job titles/links, unsubscribe/preferences link, and both HTML and text bodies.
- [ ] Assert the corresponding `notifications` row is `sent` and stores the captured provider message ID.
- [ ] Repeat curation on the same day and assert no second job-match email. Disable notifications and assert neither delivery nor a false `sent` row occurs.
- [ ] Force capture transport failure and assert curation/job persistence succeeds while the notification ledger records `failed` with a bounded, non-secret error.

**Curation/email acceptance criteria**

- Sequential and concurrent scheduled reruns never duplicate a canonical posting or overcharge quota.
- Exactly one daily job-match email is captured when eligible; zero are captured for duplicates, no matches, or disabled preferences.
- “Sent” means the transport returned a provider message ID—not merely that rendering was attempted.

## Phase 6 — Profile-read failure and visual regression guard

- [ ] In the isolated, serial test database, temporarily revoke the authenticated role's profile read permission, request `/dashboard`, and restore the grant in `finally` even when the assertion fails.
- [ ] Assert the response is 503 with `Cache-Control: no-store`, shows the Dawn retry experience, does not redirect to choose-plan/setup, and contains no legacy shell.
- [ ] Restore access, activate Retry, and assert the same session reaches dashboard without signing in again.
- [ ] Capture narrow visual baselines only for setup steps, upload states, profile-read 503, empty dashboard, populated dashboard, and job detail at desktop and 390×844. Prefer semantic assertions for everything else.

**Failure-state acceptance criteria**

- A profile read failure never looks like a new user and never mutates plan/setup data.
- Permission restoration is verified after the test; later tests can read the profile.
- Browser console has no uncaught errors and no request loops in the 503/retry path.

## Local and CI lifecycle

1. **Preflight:** verify Node 24, install from lockfile, build Next 16, and confirm local Supabase health plus required migrations.
2. **Seed:** create a unique run ID and only synthetic users/files/jobs. Stub fixed job-source and email-capture boundaries.
3. **Execute:** database integration tests first; production-server browser tests second; keep destructive permission and lease tests serial.
4. **Always clean in `globalTeardown` and per-test `finally`:** restore any altered grants; delete run-tagged Storage objects; delete dependent notifications, jobs, curation logs, quota reservations/rows, profiles/compatibility rows; then delete exact auth users.
5. **Verify cleanup:** query every touched table and `storage.objects` for the run ID and require zero rows/objects. Fail CI on residue.
6. **Artifacts:** retain traces/screenshots/server logs only on failure; never retain auth cookies, keys, raw CV text, or database dumps.

Local interruption recovery must be explicit: a cleanup command accepts only a validated `run_id`, prints the exact local targets, refuses broad/glob deletion, and performs the same dependency-ordered cleanup. CI uses an ephemeral Supabase database where possible, but still runs and verifies application-level cleanup so cascade assumptions are tested.

## Release gate

The critical suite becomes a required check only after it passes three consecutive clean local runs and one clean CI run. Release acceptance is:

- Zero critical-flow failures and zero legacy setup-screen detections.
- All upload rejection/cleanup and quota concurrency invariants pass.
- Scheduled reruns are deduplicated and notification delivery is verified through the capture transport.
- `npm run lint`, `npm run typecheck`, and `npm run build` remain green.
- Test teardown reports zero synthetic database rows, auth users, and Storage objects.

Anything requiring a live provider—Google credential entry, live ATS/RapidAPI traffic, or Resend delivery—is a separately scheduled staging smoke check and must not make the deterministic local/CI suite flaky.
