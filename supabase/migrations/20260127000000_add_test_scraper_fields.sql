-- Migration: Add test scraper fields to scraper_failures table
-- Purpose: Support admin testing system with test run tracking and debug info

-- Add is_test_run column to track failures from test runs
ALTER TABLE scraper_failures
ADD COLUMN IF NOT EXISTS is_test_run BOOLEAN DEFAULT false;

-- Add debug_info JSONB column for copy-paste debugging
-- Contains structured data like job_url, platform, detected_elements, screenshots, etc.
ALTER TABLE scraper_failures
ADD COLUMN IF NOT EXISTS debug_info JSONB DEFAULT NULL;

-- Create index for filtering test runs
CREATE INDEX IF NOT EXISTS idx_scraper_failures_is_test_run
ON scraper_failures(is_test_run);

-- Create index for filtering by test run combined with reviewed status
CREATE INDEX IF NOT EXISTS idx_scraper_failures_test_run_reviewed
ON scraper_failures(is_test_run, reviewed);

-- Add comment for documentation
COMMENT ON COLUMN scraper_failures.is_test_run IS 'True if this failure was recorded during an admin test run';
COMMENT ON COLUMN scraper_failures.debug_info IS 'Structured debug info for copy-paste troubleshooting (JSON with job_url, platform, detected_elements, screenshot_url, etc.)';
