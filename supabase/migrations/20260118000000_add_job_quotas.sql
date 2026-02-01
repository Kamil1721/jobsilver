-- Migration: Add user job quotas for fantastic.jobs integration
-- Users have a daily limit of jobs they can fetch (20 for testing phase)

-- User quotas table - tracks daily job fetch limits
CREATE TABLE IF NOT EXISTS user_job_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  jobs_fetched INTEGER DEFAULT 0,
  jobs_limit INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create index for quota lookups
CREATE INDEX IF NOT EXISTS idx_user_job_quotas_lookup ON user_job_quotas(user_id, date);

-- Enable RLS
ALTER TABLE user_job_quotas ENABLE ROW LEVEL SECURITY;

-- Users can view their own quotas
CREATE POLICY "Users can view own quotas" ON user_job_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own quota records
CREATE POLICY "Users can insert own quotas" ON user_job_quotas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own quotas
CREATE POLICY "Users can update own quotas" ON user_job_quotas
  FOR UPDATE USING (auth.uid() = user_id);

-- Add 'fantasticjobs' as a valid ats_source
-- Update the existing check constraint to include 'fantasticjobs'
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ats_source_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_ats_source_check;
  END IF;

  -- Add new constraint with 'fantasticjobs' included
  ALTER TABLE jobs ADD CONSTRAINT jobs_ats_source_check
    CHECK (ats_source IS NULL OR ats_source IN ('greenhouse', 'lever', 'ashby', 'jsearch', 'fantasticjobs'));
END $$;

-- Add comment
COMMENT ON TABLE user_job_quotas IS 'Tracks daily job fetch quotas per user for fantastic.jobs API rate limiting';
COMMENT ON COLUMN user_job_quotas.jobs_fetched IS 'Number of jobs fetched today';
COMMENT ON COLUMN user_job_quotas.jobs_limit IS 'Maximum jobs allowed per day (20 for testing, higher for paid tiers)';
