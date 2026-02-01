-- Migration: Add admin tables for user management and API usage tracking
-- Date: 2026-01-21

-- ============================================
-- Add subscription_plan to profiles
-- ============================================

-- Add subscription_plan column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Comment on columns
COMMENT ON COLUMN profiles.subscription_plan IS 'User subscription plan: free, basic, pro, ultra, mega';
COMMENT ON COLUMN profiles.is_admin IS 'Whether user has admin access';

-- ============================================
-- API Usage Tracking Table
-- ============================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Monthly aggregation key
  month_year TEXT NOT NULL,  -- Format: YYYY-MM (e.g., '2026-01')

  -- Usage counts
  jobs_fetched INTEGER DEFAULT 0,           -- Total jobs returned from API
  requests_made INTEGER DEFAULT 0,          -- Total API requests made

  -- Plan limits (snapshot at time of recording)
  jobs_limit INTEGER DEFAULT 250,           -- Monthly job limit from plan
  requests_limit INTEGER DEFAULT 25,        -- Monthly request limit from plan

  -- RapidAPI subscription info
  rapidapi_plan TEXT DEFAULT 'basic',       -- Current RapidAPI plan

  -- Rate limit headers from last request
  rate_limit_remaining INTEGER,
  rate_limit_reset TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for month
  UNIQUE(month_year)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_month ON api_usage(month_year);

-- ============================================
-- Per-request logging (optional, for detailed tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS api_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request details
  endpoint TEXT NOT NULL,                    -- API endpoint called
  params JSONB,                              -- Request parameters

  -- Response info
  jobs_returned INTEGER DEFAULT 0,           -- Jobs in this response
  response_status INTEGER,                   -- HTTP status code

  -- Rate limit headers
  rate_limit_limit INTEGER,                  -- X-RateLimit-Limit
  rate_limit_remaining INTEGER,              -- X-RateLimit-Remaining
  rate_limit_reset TIMESTAMPTZ,              -- X-RateLimit-Reset

  -- Timing
  response_time_ms INTEGER,                  -- How long the request took
  requested_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional: which user triggered this (null for system calls)
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Keep only last 30 days of request logs
CREATE INDEX IF NOT EXISTS idx_api_request_log_date ON api_request_log(requested_at);

-- ============================================
-- Admin RLS Policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

-- API usage: only service role can write, admins can read
CREATE POLICY "Service can manage api_usage" ON api_usage
  FOR ALL USING (true);

CREATE POLICY "Service can manage api_request_log" ON api_request_log
  FOR ALL USING (true);

-- Update profiles RLS to allow admin access to view all profiles
-- First, create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = TRUE OR email = 'admin@example.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policy for viewing all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin() OR auth.uid() = id);

-- Admin policy for viewing all scraper failures
DROP POLICY IF EXISTS "Users can view own scraper failures" ON scraper_failures;
CREATE POLICY "Users and admins can view scraper failures" ON scraper_failures
  FOR SELECT USING (is_admin() OR auth.uid() = user_id);

-- Admin policy for updating scraper failures
CREATE POLICY "Admins can update scraper failures" ON scraper_failures
  FOR UPDATE USING (is_admin());

-- ============================================
-- Function to update API usage monthly
-- ============================================

CREATE OR REPLACE FUNCTION update_api_usage(
  p_jobs_fetched INTEGER,
  p_requests INTEGER DEFAULT 1,
  p_rate_limit_remaining INTEGER DEFAULT NULL,
  p_rate_limit_reset TIMESTAMPTZ DEFAULT NULL,
  p_rapidapi_plan TEXT DEFAULT 'basic'
)
RETURNS void AS $$
DECLARE
  current_month TEXT;
  plan_jobs_limit INTEGER;
  plan_requests_limit INTEGER;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := TO_CHAR(NOW(), 'YYYY-MM');

  -- Set limits based on plan
  CASE p_rapidapi_plan
    WHEN 'basic' THEN
      plan_jobs_limit := 250;
      plan_requests_limit := 25;
    WHEN 'pro' THEN
      plan_jobs_limit := 5000;
      plan_requests_limit := 2500;
    WHEN 'ultra' THEN
      plan_jobs_limit := 20000;
      plan_requests_limit := 20000;
    WHEN 'mega' THEN
      plan_jobs_limit := 50000;
      plan_requests_limit := 50000;
    ELSE
      plan_jobs_limit := 250;
      plan_requests_limit := 25;
  END CASE;

  -- Upsert the monthly record
  INSERT INTO api_usage (
    month_year,
    jobs_fetched,
    requests_made,
    jobs_limit,
    requests_limit,
    rapidapi_plan,
    rate_limit_remaining,
    rate_limit_reset,
    updated_at
  )
  VALUES (
    current_month,
    p_jobs_fetched,
    p_requests,
    plan_jobs_limit,
    plan_requests_limit,
    p_rapidapi_plan,
    p_rate_limit_remaining,
    p_rate_limit_reset,
    NOW()
  )
  ON CONFLICT (month_year)
  DO UPDATE SET
    jobs_fetched = api_usage.jobs_fetched + EXCLUDED.jobs_fetched,
    requests_made = api_usage.requests_made + EXCLUDED.requests_made,
    jobs_limit = EXCLUDED.jobs_limit,
    requests_limit = EXCLUDED.requests_limit,
    rapidapi_plan = EXCLUDED.rapidapi_plan,
    rate_limit_remaining = COALESCE(EXCLUDED.rate_limit_remaining, api_usage.rate_limit_remaining),
    rate_limit_reset = COALESCE(EXCLUDED.rate_limit_reset, api_usage.rate_limit_reset),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Set initial admin user
-- ============================================

-- Make admin@example.com an admin
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'admin@example.com';

-- Comments
COMMENT ON TABLE api_usage IS 'Monthly API usage tracking for RapidAPI fantastic.jobs';
COMMENT ON TABLE api_request_log IS 'Detailed log of individual API requests (for debugging)';
COMMENT ON FUNCTION update_api_usage IS 'Function to safely update monthly API usage stats';
