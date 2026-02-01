-- Migration: Mark existing Workday jobs as manual
-- Workday requires mandatory account creation, so auto-apply is not supported

-- Update all jobs where platform_detected is 'workday' to require manual application
UPDATE jobs
SET auto_apply_status = 'manual'
WHERE platform_detected = 'workday'
  AND auto_apply_status NOT IN ('applied', 'failed', 'manual');

-- Also update any jobs with Workday URLs that weren't properly detected
UPDATE jobs
SET
  platform_detected = 'workday',
  auto_apply_status = 'manual'
WHERE (
    application_url ILIKE '%myworkday.com%'
    OR application_url ILIKE '%myworkdayjobs.com%'
    OR application_url ILIKE '%workday.com%/job%'
  )
  AND (platform_detected IS NULL OR platform_detected != 'workday')
  AND auto_apply_status NOT IN ('applied', 'failed', 'manual');

-- Delete any pending scrape jobs for Workday
DELETE FROM scraped_questions
WHERE job_id IN (
  SELECT id FROM jobs WHERE platform_detected = 'workday'
)
AND scrape_status = 'pending';

-- Add comment explaining why Workday is not supported
COMMENT ON COLUMN jobs.platform_detected IS 'Detected ATS platform. Note: workday is detected but not supported for auto-apply (requires account creation).';
