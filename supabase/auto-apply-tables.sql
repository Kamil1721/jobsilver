-- Auto-Apply Feature Tables
-- Run this migration to add tables for question scraping and application submission

-- 1. Scraped questions from job applications
CREATE TABLE IF NOT EXISTS scraped_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'linkedin', 'indeed', 'greenhouse', 'lever', 'unknown'
  questions JSONB NOT NULL DEFAULT '[]', -- Array of question objects
  form_structure JSONB, -- Metadata about the form
  scrape_status TEXT DEFAULT 'pending', -- pending, processing, success, failed
  error_message TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

-- 2. Application submission queue
CREATE TABLE IF NOT EXISTS application_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}', -- User's answers keyed by question_id
  cv_url TEXT, -- Path to user's CV in storage
  status TEXT DEFAULT 'pending', -- pending, processing, success, failed, manual_required
  error_code TEXT,
  error_message TEXT,
  screenshot_url TEXT, -- Screenshot of submitted form
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 3. Platform credentials (encrypted)
CREATE TABLE IF NOT EXISTS platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'linkedin', 'indeed'
  credentials_encrypted TEXT NOT NULL, -- AES-256 encrypted JSON
  session_data_encrypted TEXT, -- Encrypted cookies for session reuse
  last_verified_at TIMESTAMPTZ,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Add columns to jobs table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'platform_detected') THEN
    ALTER TABLE jobs ADD COLUMN platform_detected TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'auto_apply_status') THEN
    ALTER TABLE jobs ADD COLUMN auto_apply_status TEXT DEFAULT 'not_started';
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraped_questions_job ON scraped_questions(job_id);
CREATE INDEX IF NOT EXISTS idx_scraped_questions_status ON scraped_questions(scrape_status);
CREATE INDEX IF NOT EXISTS idx_application_queue_status ON application_queue(status);
CREATE INDEX IF NOT EXISTS idx_application_queue_user ON application_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_application_queue_job ON application_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_platform_credentials_user ON platform_credentials(user_id);

-- Enable Row Level Security
ALTER TABLE scraped_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scraped_questions
-- Users can view scraped questions for jobs they own
DROP POLICY IF EXISTS "Users can view scraped questions for their jobs" ON scraped_questions;
CREATE POLICY "Users can view scraped questions for their jobs"
  ON scraped_questions FOR SELECT
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- Users can insert scraped questions for their jobs
DROP POLICY IF EXISTS "Users can insert scraped questions for their jobs" ON scraped_questions;
CREATE POLICY "Users can insert scraped questions for their jobs"
  ON scraped_questions FOR INSERT
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- Users can update scraped questions for their jobs
DROP POLICY IF EXISTS "Users can update scraped questions for their jobs" ON scraped_questions;
CREATE POLICY "Users can update scraped questions for their jobs"
  ON scraped_questions FOR UPDATE
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- Users can delete scraped questions for their jobs
DROP POLICY IF EXISTS "Users can delete scraped questions for their jobs" ON scraped_questions;
CREATE POLICY "Users can delete scraped questions for their jobs"
  ON scraped_questions FOR DELETE
  USING (job_id IN (SELECT id FROM jobs WHERE user_id = auth.uid()));

-- Service role can do anything (for the worker)
DROP POLICY IF EXISTS "Service role full access to scraped_questions" ON scraped_questions;
CREATE POLICY "Service role full access to scraped_questions"
  ON scraped_questions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for application_queue
DROP POLICY IF EXISTS "Users can manage their application queue" ON application_queue;
CREATE POLICY "Users can manage their application queue"
  ON application_queue FOR ALL
  USING (user_id = auth.uid());

-- Service role can do anything (for the worker)
DROP POLICY IF EXISTS "Service role full access to application_queue" ON application_queue;
CREATE POLICY "Service role full access to application_queue"
  ON application_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for platform_credentials
DROP POLICY IF EXISTS "Users can manage their credentials" ON platform_credentials;
CREATE POLICY "Users can manage their credentials"
  ON platform_credentials FOR ALL
  USING (user_id = auth.uid());

-- Service role can do anything (for the worker)
DROP POLICY IF EXISTS "Service role full access to platform_credentials" ON platform_credentials;
CREATE POLICY "Service role full access to platform_credentials"
  ON platform_credentials FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
