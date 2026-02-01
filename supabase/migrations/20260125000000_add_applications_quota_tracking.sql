-- Migration: Add applications quota tracking to user_job_quotas
-- Tracks daily auto-apply usage alongside job discovery quota

-- Add applications_used column for tracking daily auto-apply count
ALTER TABLE user_job_quotas
ADD COLUMN IF NOT EXISTS applications_used INTEGER DEFAULT 0;

-- Add applications_limit column for plan-based limits
ALTER TABLE user_job_quotas
ADD COLUMN IF NOT EXISTS applications_limit INTEGER DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN user_job_quotas.applications_used IS 'Number of auto-applies used today';
COMMENT ON COLUMN user_job_quotas.applications_limit IS 'Maximum auto-applies allowed per day based on subscription plan';

-- Create index for efficient quota lookups (covers both job and application quotas)
CREATE INDEX IF NOT EXISTS idx_user_job_quotas_applications ON user_job_quotas(user_id, date, applications_used);

-- Function to check and reserve application quota atomically
-- Returns number of applications that can be made (0 to p_applications_needed)
CREATE OR REPLACE FUNCTION check_and_reserve_application_quota(
  p_user_id UUID,
  p_applications_needed INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quota_record user_job_quotas%ROWTYPE;
  v_available INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Lock the user's quota row for today (or create if not exists)
  SELECT * INTO v_quota_record
  FROM user_job_quotas
  WHERE user_id = p_user_id AND date = v_today
  FOR UPDATE;

  -- If no record exists, create one with free tier default values
  -- Free tier: 5 jobs/day, 1 auto-apply/day
  IF NOT FOUND THEN
    INSERT INTO user_job_quotas (user_id, date, jobs_fetched, jobs_limit, applications_used, applications_limit)
    VALUES (p_user_id, v_today, 0, 5, 0, 1)
    RETURNING * INTO v_quota_record;
  END IF;

  -- Calculate available application slots
  v_available := GREATEST(0, v_quota_record.applications_limit - v_quota_record.applications_used);

  -- Determine how many we can actually reserve
  v_available := LEAST(v_available, p_applications_needed);

  -- Update the quota if we're reserving any
  IF v_available > 0 THEN
    UPDATE user_job_quotas
    SET applications_used = applications_used + v_available
    WHERE id = v_quota_record.id;
  END IF;

  RETURN v_available;
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION check_and_reserve_application_quota(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_reserve_application_quota(UUID, INTEGER) TO service_role;
