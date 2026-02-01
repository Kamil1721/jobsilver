-- Migration: Add user_reports table for problem reporting and suggestions
-- Users can report issues (incorrect questions, descriptions, bugs) and submit suggestions
-- Admin can view and manage all reports

-- Report type enum
CREATE TYPE report_type AS ENUM (
  'incorrect_questions',    -- Scraped questions are wrong or missing
  'incorrect_description',  -- Job description doesn't match the actual job
  'bug',                    -- Application bug report
  'suggestion',             -- Feature suggestion or improvement idea
  'other'                   -- Anything else
);

-- Report status enum
CREATE TYPE report_status AS ENUM (
  'open',         -- New report, not yet reviewed
  'in_progress',  -- Admin is working on it
  'resolved',     -- Issue has been fixed/addressed
  'wont_fix',     -- Acknowledged but won't be addressed
  'duplicate'     -- Already reported by someone else
);

-- User reports table
-- Note: user_id references profiles (not auth.users) to enable PostgREST joins
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Report content
  report_type report_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Optional job context (with snapshots in case job is deleted)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_title TEXT,      -- Snapshot of job title at report time
  job_company TEXT,    -- Snapshot of company name at report time

  -- Context fields
  page_url TEXT,       -- URL where the user was when reporting
  browser_info TEXT,   -- User agent/browser info for debugging

  -- Status tracking
  status report_status NOT NULL DEFAULT 'open',

  -- Admin fields
  admin_notes TEXT,           -- Internal notes (not shown to user)
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_reports_user ON user_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_type ON user_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_user_reports_job ON user_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_created ON user_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_open ON user_reports(status) WHERE status = 'open';

-- Enable RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON user_reports
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own reports
CREATE POLICY "Users can create reports" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all reports (using is_admin from profiles)
CREATE POLICY "Admins can view all reports" ON user_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can update any report
CREATE POLICY "Admins can update reports" ON user_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admins can delete reports
CREATE POLICY "Admins can delete reports" ON user_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_reports_updated_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_user_reports_updated_at();

-- Comments
COMMENT ON TABLE user_reports IS 'User-submitted problem reports and suggestions';
COMMENT ON COLUMN user_reports.report_type IS 'Category of the report';
COMMENT ON COLUMN user_reports.job_title IS 'Snapshot of job title in case job is deleted';
COMMENT ON COLUMN user_reports.job_company IS 'Snapshot of company name in case job is deleted';
COMMENT ON COLUMN user_reports.page_url IS 'URL where user was when submitting report';
COMMENT ON COLUMN user_reports.browser_info IS 'User agent string for debugging';
COMMENT ON COLUMN user_reports.admin_notes IS 'Internal admin notes, not visible to users';
COMMENT ON COLUMN user_reports.resolved_by IS 'Admin who resolved the report';
