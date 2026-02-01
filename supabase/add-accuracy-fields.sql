-- Add accuracy-related fields to jobs table
-- Run this in your Supabase SQL editor

-- Add remote_type column to store validated remote status
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS remote_type TEXT
  CHECK (remote_type IN ('fully_remote', 'hybrid', 'onsite'));

-- Add industry_category for better categorization
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry_category TEXT;

-- Add job_posted_at timestamp for freshness tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_posted_at TIMESTAMPTZ;

-- Add location_verified flag
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;

-- Add spam_score for quality filtering (0-10, higher = more suspicious)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;

-- Create index for faster filtering by remote_type
CREATE INDEX IF NOT EXISTS idx_jobs_remote_type ON jobs(remote_type);

-- Create index for filtering by industry
CREATE INDEX IF NOT EXISTS idx_jobs_industry ON jobs(industry_category);

-- Create index for filtering by freshness
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(job_posted_at);

-- Update comment on jobs table
COMMENT ON COLUMN jobs.remote_type IS 'Validated remote work type: fully_remote, hybrid, or onsite';
COMMENT ON COLUMN jobs.industry_category IS 'Job industry category for filtering';
COMMENT ON COLUMN jobs.job_posted_at IS 'When the job was originally posted';
COMMENT ON COLUMN jobs.location_verified IS 'Whether job location was validated against user preferences';
COMMENT ON COLUMN jobs.spam_score IS 'Spam likelihood score (0-10), higher = more suspicious';
