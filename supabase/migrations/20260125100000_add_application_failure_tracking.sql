-- Add failure tracking fields to jobs table for application failures
-- These are separate from scraper_failures which track scraping issues

-- Add failure_reason column to store why the application submission failed
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Add failure_reviewed column to mark failures as reviewed by admin
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_reviewed BOOLEAN DEFAULT FALSE;

-- Add failure_reviewed_at column to track when the failure was reviewed
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_reviewed_at TIMESTAMPTZ;

-- Add failure_notes column for admin notes about the failure
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_notes TEXT;

-- Add index for querying failed jobs efficiently
CREATE INDEX IF NOT EXISTS idx_jobs_auto_apply_status_failed
ON jobs(auto_apply_status)
WHERE auto_apply_status = 'failed';

-- Add index for unreviewed failures
CREATE INDEX IF NOT EXISTS idx_jobs_failure_unreviewed
ON jobs(auto_apply_status, failure_reviewed)
WHERE auto_apply_status = 'failed' AND failure_reviewed = FALSE;

COMMENT ON COLUMN jobs.failure_reason IS 'Reason why the application submission failed';
COMMENT ON COLUMN jobs.failure_reviewed IS 'Whether an admin has reviewed this failed application';
COMMENT ON COLUMN jobs.failure_reviewed_at IS 'When the failure was reviewed by admin';
COMMENT ON COLUMN jobs.failure_notes IS 'Admin notes about the failure';
