-- Migration: Add scraper_failures table for jobs that can't be scraped
-- These jobs are hidden from users but stored for admin review

-- Failure reason enum
CREATE TYPE scraper_failure_reason AS ENUM (
  'login_required',      -- Page requires authentication
  'scraper_error',       -- Technical scraping failure
  'no_questions_found',  -- Could access page but no form fields found
  'timeout',             -- Page load timeout
  'page_not_found',      -- 404 or job expired
  'captcha_required',    -- Anti-bot protection detected
  'unknown'              -- Other failures
);

-- Scraper failures table - jobs that failed scraping and are hidden from users
CREATE TABLE IF NOT EXISTS scraper_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Original job data (copied for reference)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  external_id TEXT,
  source TEXT,
  title TEXT NOT NULL,
  company TEXT,
  application_url TEXT,
  platform_detected TEXT,

  -- Failure details
  failure_reason scraper_failure_reason NOT NULL,
  error_message TEXT,
  error_details JSONB,  -- Additional debug info (page snapshot, detected elements, etc.)

  -- Detection metadata
  detected_auth_elements JSONB,  -- What auth indicators were found
  page_title TEXT,               -- Title of the page when scraped
  page_url TEXT,                 -- Final URL after any redirects

  -- Timestamps
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Review status (for admin)
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_scraper_failures_user ON scraper_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_scraper_failures_reason ON scraper_failures(failure_reason);
CREATE INDEX IF NOT EXISTS idx_scraper_failures_reviewed ON scraper_failures(reviewed) WHERE reviewed = FALSE;
CREATE INDEX IF NOT EXISTS idx_scraper_failures_job ON scraper_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_failures_external ON scraper_failures(source, external_id);

-- Enable RLS
ALTER TABLE scraper_failures ENABLE ROW LEVEL SECURITY;

-- Users can view their own failures (for transparency, but we won't show these in UI)
CREATE POLICY "Users can view own scraper failures" ON scraper_failures
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert failures (service role)
CREATE POLICY "Service can insert scraper failures" ON scraper_failures
  FOR INSERT WITH CHECK (true);

-- Service can update failures (for review status)
CREATE POLICY "Service can update scraper failures" ON scraper_failures
  FOR UPDATE USING (true);

-- Add new auto_apply_status values for tracking
-- Update jobs table to support new statuses
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_auto_apply_status_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_auto_apply_status_check;
  END IF;
END $$;

-- Add new column to track if job was moved to failures
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Comments
COMMENT ON TABLE scraper_failures IS 'Jobs that failed scraping - stored for admin review but hidden from users';
COMMENT ON COLUMN scraper_failures.failure_reason IS 'Why the job could not be scraped';
COMMENT ON COLUMN scraper_failures.detected_auth_elements IS 'JSON array of auth-related elements found on the page';
COMMENT ON COLUMN scraper_failures.error_details IS 'Additional debugging information';
COMMENT ON COLUMN scraper_failures.reviewed IS 'Whether an admin has reviewed this failure';
