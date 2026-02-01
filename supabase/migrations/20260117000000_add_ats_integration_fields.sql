-- Migration: Add ATS integration fields for direct Greenhouse, Lever, Ashby API integration
-- This allows storing jobs fetched directly from ATS APIs with their questions pre-loaded

-- Add ATS-specific columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS ats_source text CHECK (ats_source IN ('greenhouse', 'lever', 'ashby', 'jsearch')),
ADD COLUMN IF NOT EXISTS ats_job_id text,
ADD COLUMN IF NOT EXISTS questions_loaded boolean DEFAULT false;

-- Add questions_source column to scraped_questions table
-- This indicates whether questions came from the ATS API or were scraped via Playwright
ALTER TABLE scraped_questions
ADD COLUMN IF NOT EXISTS questions_source text DEFAULT 'scraped' CHECK (questions_source IN ('api', 'scraped'));

-- Create index for ATS lookups
CREATE INDEX IF NOT EXISTS idx_jobs_ats_source ON jobs(ats_source) WHERE ats_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_ats_job_id ON jobs(ats_job_id) WHERE ats_job_id IS NOT NULL;

-- Create index for questions source
CREATE INDEX IF NOT EXISTS idx_scraped_questions_source ON scraped_questions(questions_source);

-- Add 'ashby' to platform_detected check constraint if not already there
-- First, drop the old constraint and add a new one with 'ashby' included
DO $$
BEGIN
  -- Try to add ashby to the constraint
  -- This will fail silently if the constraint doesn't exist or already includes ashby
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_platform_detected_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_platform_detected_check;
    ALTER TABLE jobs ADD CONSTRAINT jobs_platform_detected_check
      CHECK (platform_detected IS NULL OR platform_detected IN ('linkedin', 'indeed', 'glassdoor', 'greenhouse', 'lever', 'ashby', 'workday', 'unknown'));
  END IF;
END $$;

-- Add comment explaining the new columns
COMMENT ON COLUMN jobs.ats_source IS 'The ATS platform that this job was fetched from (greenhouse, lever, ashby) or jsearch for aggregator sources';
COMMENT ON COLUMN jobs.ats_job_id IS 'The job ID in the ATS system, used for fetching questions and submitting applications';
COMMENT ON COLUMN jobs.questions_loaded IS 'Whether application questions have been loaded from the ATS API';
COMMENT ON COLUMN scraped_questions.questions_source IS 'Source of questions: api (from ATS API) or scraped (via Playwright)';
