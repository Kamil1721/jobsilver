-- Migration: add covering indexes for unindexed foreign keys
--
-- WHY: Postgres does NOT auto-create an index for a FOREIGN KEY. An unindexed FK column
-- forces a sequential scan whenever the parent row is deleted (FK check) or the column is
-- used in a join/filter. Invisible at current row counts; a scan hazard as these tables grow.
--
-- LOCK BEHAVIOR: plain CREATE INDEX takes a SHARE lock (blocks writes) for the build, which
-- at current table sizes (every table here is under a few hundred rows) completes in
-- milliseconds — safe. NOTE: if any of these tables is large by the time this runs, switch
-- to CREATE INDEX CONCURRENTLY and run it OUTSIDE a transaction, one statement at a time.
--
-- ROLLBACK: DROP INDEX <name>;

-- High-growth (grows per API request / per application): index first.
CREATE INDEX IF NOT EXISTS idx_api_request_log_triggered_by
  ON public.api_request_log (triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id
  ON public.job_applications (job_id);

-- Low-growth admin/reference tables: cheap insurance, prevents seq-scan on parent delete.
CREATE INDEX IF NOT EXISTS idx_admin_announcements_created_by
  ON public.admin_announcements (created_by);
CREATE INDEX IF NOT EXISTS idx_tester_invites_created_by
  ON public.tester_invites (created_by);
CREATE INDEX IF NOT EXISTS idx_tester_invites_used_by
  ON public.tester_invites (used_by);
CREATE INDEX IF NOT EXISTS idx_user_reports_resolved_by
  ON public.user_reports (resolved_by);
