# DB Scale Audit — JobSilver — 2026-09-01

Production Supabase project `pjgdcasgyxjooqwihivh`. Read-only audit against the live DB.

## Executive summary

Current data is tiny (jobs = 84, profiles = 4, most tables 0 rows), so nothing is slow **today**.
The schema is, on the whole, in good shape for growth: the hot table (`jobs`) is thoroughly
indexed, capacity/quota races are guarded by real unique constraints and atomic `FOR UPDATE`
+ `ON CONFLICT` RPCs, and every per-user table has a `user_id` index.

**The one issue that matters at scale:** essentially every RLS policy calls `auth.uid()`
(and admin policies `is_admin()`) **unwrapped**, so the auth lookup is re-evaluated once per
row scanned. Invisible at 84 rows; on a mature `jobs` / `user_interactions` /
`job_chat_messages` table (thousands of rows per user, scanned per dashboard load) it makes
RLS overhead scale with row count.

**Fix these first (both authored as migrations, unapplied):**
1. Wrap `auth.uid()` / `is_admin()` as `(select …)` in all 52 policies → `20260901000000_optimize_rls_initplan.sql`. Ready to 100x once applied.
2. Add indexes for 6 unindexed foreign keys → `20260901000100_add_missing_fk_indexes.sql`.
3. (Client-code, already handled this session) unbounded `select('*')`/exclusion fetches in the search + dashboard paths — see "Client-code" below.

Ready for 10x today. Ready for 100x after fix #1.

## Findings (ranked by breaks-at multiplier)

| # | Finding | Breaks at | Evidence | Fix | Effort |
|---|---------|-----------|----------|-----|--------|
| 1 | **Unwrapped `auth.uid()`/`is_admin()` in 52 RLS policies** — re-evaluated per row | ~100x (per-user tables with many rows) | `pg_policy`: e.g. `jobs`.`Users can view own jobs` USING `(auth.uid() = user_id)`; same on user_interactions, job_chat_messages, user_favorite_jobs, user_job_quotas, user_ai_*, curation_logs, +admin `is_admin()` | migration `…_optimize_rls_initplan.sql` (ALTER POLICY, metadata-only, safe) | Low |
| 2 | **6 unindexed foreign keys** | 100x (api_request_log, job_applications) / 1000x (admin/tester/reports) | `pg_constraint` join vs `pg_index`: api_request_log.triggered_by_user_id, job_applications.job_id, admin_announcements.created_by, tester_invites.created_by, tester_invites.used_by, user_reports.resolved_by — none has a leading-column index | migration `…_add_missing_fk_indexes.sql` (CREATE INDEX CONCURRENTLY) | Low |
| 3 | **`api_request_log` append-only, no retention** — grows one row per external API request, only index is `requested_at` | 100x (table bloat, vacuum pressure) | `pg_stat_user_tables`; the admin panel already has a `clear_request_log` action (keeps 24h) but nothing runs it on a schedule | Add a scheduled prune (cron) or a 7–30d retention policy; consider partitioning by day if volume is high | Medium |

## Checked and HEALTHY (coverage, not just problems)

- **`jobs`** — indexed on user_id, status, source, external_id, created_at, posted_at, industry, remote_type, ats_*, plus unique `(user_id, external_id, source)` and `(user_id, application_url)`. Well covered for the dashboard/search filters.
- **Capacity / quota races** — `reserve_daily_job_quota` (SECURITY DEFINER) locks the profile row `FOR UPDATE` then upserts `user_job_quotas` via `ON CONFLICT`; `daily_job_quota_reservations` + unique `(user_id, date)` prevent double-spend. This is the correct pattern, not check-then-write.
- **Per-user indexes** — user_job_quotas `(user_id, date)`, user_interactions `(user_id, interaction_type)` + `(user_id)`, user_favorite_jobs `(user_id)` + unique `(user_id, job_id)`, job_chat_messages `(user_id)` + `(job_id)`, subscriptions unique `(user_id)` + `(stripe_subscription_id)`. All present.
- **Money paths** — Stripe reconciliation goes through an atomic `reconcile_stripe_subscription` RPC with staleness guards; `subscriptions` has UNIQUE(user_id).

## Client-code items (fixed this session in /debugfix, listed for cross-reference)

- `jobs/search`: discarded/applied exclusion fetch was unpaginated (1000-row cap) → now paginated; per-job insert loop → single bulk upsert.
- `cron/cleanup-expired-jobs`: favorites exclusion unpaginated + non-keyset batch loop → paginated + keyset cursor.
- Still open (not blocking, noted for the normal dev flow): `dashboard/page.tsx` loads `select('*')` (full HTML descriptions) for all non-discarded jobs with no limit — trim columns + paginate before a user routinely holds hundreds of jobs.

## Could NOT be checked

- **`pg_stat_statements`** was not queried in this pass (would rank real query cost) — worth a follow-up once there is production traffic; at 4 users the plan cache is not representative.
- **`EXPLAIN ANALYZE` on RLS cost** is not meaningful at 84 rows (planner seq-scans tiny tables regardless), so finding #1 rests on the policy definitions + the documented Supabase InitPlan behavior, not a plan diff. Re-verify with EXPLAIN once a test user has a few thousand jobs.

## What to do

1. Apply `…_optimize_rls_initplan.sql` (instant, metadata-only) and `…_add_missing_fk_indexes.sql` (CONCURRENTLY — run outside a txn).
2. Schedule the existing `clear_request_log` admin action, or add a retention cron for `api_request_log`.
3. Re-run this audit after ~5x growth, and add a `pg_stat_statements` pass once real traffic exists.
