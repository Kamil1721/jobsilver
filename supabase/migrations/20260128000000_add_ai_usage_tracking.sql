-- Migration: Add AI Usage Tracking
-- Purpose: Track daily AI feature usage (responses, cover letters, CV optimizations) per user
-- This supports the pivot from auto-apply to AI assistant focus

-- ============================================
-- TABLE: user_ai_usage
-- ============================================
-- Tracks daily AI feature usage per user
-- Each row represents one user's usage for one day

CREATE TABLE IF NOT EXISTS user_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- AI feature usage counters
  ai_responses_used INTEGER NOT NULL DEFAULT 0,
  cover_letters_generated INTEGER NOT NULL DEFAULT 0,
  cv_optimizations_used INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure only one row per user per day
  UNIQUE(user_id, date)
);

-- Create index for efficient lookups by user and date
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_user_date ON user_ai_usage(user_id, date);

-- Create index for cleanup queries (finding old records)
CREATE INDEX IF NOT EXISTS idx_user_ai_usage_date ON user_ai_usage(date);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own AI usage data
CREATE POLICY "Users can read own ai usage" ON user_ai_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all AI usage (for API routes to increment counters)
-- This is necessary because usage is incremented from server-side API routes
CREATE POLICY "Service role can manage ai usage" ON user_ai_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can insert their own usage records (needed for upsert from authenticated context)
CREATE POLICY "Users can insert own ai usage" ON user_ai_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records (needed for incrementing counters)
CREATE POLICY "Users can update own ai usage" ON user_ai_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNCTION: Increment AI Usage
-- ============================================
-- Atomic function to increment usage counters
-- Returns the new count after increment

CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_feature TEXT, -- 'ai_responses', 'cover_letters', or 'cv_optimizations'
  p_increment INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Insert or update the usage record for today
  INSERT INTO user_ai_usage (user_id, date, ai_responses_used, cover_letters_generated, cv_optimizations_used)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_feature = 'ai_responses' THEN p_increment ELSE 0 END,
    CASE WHEN p_feature = 'cover_letters' THEN p_increment ELSE 0 END,
    CASE WHEN p_feature = 'cv_optimizations' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (user_id, date) DO UPDATE
  SET
    ai_responses_used = CASE
      WHEN p_feature = 'ai_responses'
      THEN user_ai_usage.ai_responses_used + p_increment
      ELSE user_ai_usage.ai_responses_used
    END,
    cover_letters_generated = CASE
      WHEN p_feature = 'cover_letters'
      THEN user_ai_usage.cover_letters_generated + p_increment
      ELSE user_ai_usage.cover_letters_generated
    END,
    cv_optimizations_used = CASE
      WHEN p_feature = 'cv_optimizations'
      THEN user_ai_usage.cv_optimizations_used + p_increment
      ELSE user_ai_usage.cv_optimizations_used
    END,
    updated_at = NOW()
  RETURNING
    CASE p_feature
      WHEN 'ai_responses' THEN ai_responses_used
      WHEN 'cover_letters' THEN cover_letters_generated
      WHEN 'cv_optimizations' THEN cv_optimizations_used
      ELSE 0
    END INTO v_new_count;

  RETURN v_new_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_ai_usage(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage(UUID, TEXT, INTEGER) TO service_role;

-- ============================================
-- FUNCTION: Get Daily AI Usage
-- ============================================
-- Returns the current day's usage for a user

CREATE OR REPLACE FUNCTION get_daily_ai_usage(p_user_id UUID)
RETURNS TABLE (
  ai_responses_used INTEGER,
  cover_letters_generated INTEGER,
  cv_optimizations_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(u.ai_responses_used, 0),
    COALESCE(u.cover_letters_generated, 0),
    COALESCE(u.cv_optimizations_used, 0)
  FROM user_ai_usage u
  WHERE u.user_id = p_user_id AND u.date = CURRENT_DATE;

  -- If no row found, return zeros
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_daily_ai_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_ai_usage(UUID) TO service_role;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_user_ai_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_ai_usage_updated_at
  BEFORE UPDATE ON user_ai_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_ai_usage_updated_at();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE user_ai_usage IS 'Tracks daily AI feature usage per user for quota enforcement';
COMMENT ON COLUMN user_ai_usage.ai_responses_used IS 'Number of AI chat responses used today';
COMMENT ON COLUMN user_ai_usage.cover_letters_generated IS 'Number of cover letters generated today';
COMMENT ON COLUMN user_ai_usage.cv_optimizations_used IS 'Number of CV optimization requests today';
COMMENT ON FUNCTION increment_ai_usage IS 'Atomically increments AI usage counter and returns new count';
COMMENT ON FUNCTION get_daily_ai_usage IS 'Returns current day AI usage for a user';
