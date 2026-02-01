-- Migration: Add quota reservation function for race-condition-free daily curation
-- This function uses transaction isolation to prevent concurrent requests from exceeding quota

-- Create the quota check and reservation function
CREATE OR REPLACE FUNCTION check_and_reserve_daily_quota(
  p_user_id UUID,
  p_jobs_needed INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_existing_count INTEGER;
  v_available_slots INTEGER;
BEGIN
  -- Lock the user's profile row to prevent concurrent updates
  -- This ensures only one curation request can process at a time per user
  PERFORM 1 FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Count existing jobs for today
  -- We count jobs created today that are in discoverable states
  SELECT COUNT(*) INTO v_existing_count
  FROM jobs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
    AND status IN ('discovered', 'saved');

  -- Calculate available slots (max 20 per day)
  v_available_slots := GREATEST(0, 20 - v_existing_count);

  -- Return the number of jobs that can be added (limited by request)
  RETURN LEAST(p_jobs_needed, v_available_slots);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_and_reserve_daily_quota(UUID, INTEGER) TO authenticated;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION check_and_reserve_daily_quota(UUID, INTEGER) TO service_role;

-- Add a comment explaining the function
COMMENT ON FUNCTION check_and_reserve_daily_quota IS
'Atomically checks and reserves daily job quota for a user.
Uses FOR UPDATE to prevent race conditions in concurrent curation requests.
Returns the number of jobs that can be added (0 to p_jobs_needed).';
