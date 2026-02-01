-- Migration: Add curation logs table for tracking scheduled job curation
-- This table logs each curation run for monitoring and debugging

CREATE TABLE IF NOT EXISTS curation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'partial')),
  jobs_target INTEGER NOT NULL DEFAULT 20,
  jobs_curated INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_curation_logs_user_id ON curation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_curation_logs_started_at ON curation_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_curation_logs_status ON curation_logs(status);

-- Enable RLS
ALTER TABLE curation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own curation logs
CREATE POLICY "Users can view own curation logs" ON curation_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert/update (used by worker)
-- Note: Service role bypasses RLS, so no explicit policy needed for writes

-- Add production_mode column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'production_mode'
  ) THEN
    ALTER TABLE profiles ADD COLUMN production_mode BOOLEAN DEFAULT false;
    COMMENT ON COLUMN profiles.production_mode IS 'When true, daily job curation is enabled for this user';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE curation_logs IS 'Logs for scheduled job curation runs';
COMMENT ON COLUMN curation_logs.status IS 'running = in progress, success = completed successfully, failed = error occurred, partial = some jobs failed';
COMMENT ON COLUMN curation_logs.jobs_target IS 'Number of jobs targeted for this curation run';
COMMENT ON COLUMN curation_logs.jobs_curated IS 'Number of jobs successfully curated';
COMMENT ON COLUMN curation_logs.jobs_failed IS 'Number of jobs that failed during curation';
