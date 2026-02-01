-- Migration: Add AI Learning System Tables
-- Created: 2026-01-24
-- Description: Creates tables for user-specific AI preference learning

-- ============================================
-- TABLE: user_favorite_jobs
-- Stores jobs that users have explicitly marked as favorites
-- ============================================
CREATE TABLE IF NOT EXISTS user_favorite_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  favorited_at TIMESTAMPTZ DEFAULT NOW(),
  favorite_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- RLS policies for user_favorite_jobs
ALTER TABLE user_favorite_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON user_favorite_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON user_favorite_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON user_favorite_jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites" ON user_favorite_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for user_favorite_jobs
CREATE INDEX idx_favorites_user ON user_favorite_jobs(user_id);
CREATE INDEX idx_favorites_job ON user_favorite_jobs(job_id);
CREATE INDEX idx_favorites_created ON user_favorite_jobs(favorited_at DESC);

-- ============================================
-- TABLE: user_interactions
-- Tracks user interactions with jobs for learning preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'view_details', 'save', 'favorite', 'unfavorite', 'apply', 'discard', 'skip')),
  duration_seconds INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for user_interactions
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions" ON user_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can insert for background processing
CREATE POLICY "Service role can manage interactions" ON user_interactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for user_interactions
CREATE INDEX idx_interactions_user ON user_interactions(user_id);
CREATE INDEX idx_interactions_type ON user_interactions(user_id, interaction_type);
CREATE INDEX idx_interactions_created ON user_interactions(created_at DESC);
CREATE INDEX idx_interactions_job ON user_interactions(job_id);

-- ============================================
-- TABLE: user_ai_preferences
-- Stores learned preferences computed from user behavior
-- (Matches schema expected by src/lib/ai/preference-learning.ts)
-- ============================================
CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Confidence and metadata
  confidence_level TEXT DEFAULT 'none' CHECK (confidence_level IN ('none', 'low', 'medium', 'high')),

  -- Industry & Company Preferences (JSONB with weights)
  preferred_industries JSONB DEFAULT '{}',
  preferred_company_sizes JSONB DEFAULT '{}',
  preferred_job_types JSONB DEFAULT '{}',

  -- Remote preference (JSONB with remote type weights)
  remote_preference JSONB DEFAULT '{}',

  -- Salary Preferences
  preferred_salary_min INT,
  preferred_salary_max INT,
  salary_currency TEXT,

  -- Keyword weights (keyword -> score mapping)
  keyword_weights JSONB DEFAULT '{}',

  -- Location preferences (JSONB with weights)
  preferred_locations JSONB DEFAULT '{}',

  -- Company Preferences
  preferred_companies JSONB DEFAULT '{}',
  avoided_companies JSONB DEFAULT '[]',

  -- Statistics
  total_interactions INT DEFAULT 0,
  total_favorites INT DEFAULT 0,
  total_applies INT DEFAULT 0,
  total_discards INT DEFAULT 0,

  -- Computation metadata
  last_computed_at TIMESTAMPTZ,
  computation_version INT DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for user_ai_preferences
ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON user_ai_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_ai_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_ai_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert/update for background processing
CREATE POLICY "Service role can manage preferences" ON user_ai_preferences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for user_ai_preferences
CREATE INDEX idx_preferences_user ON user_ai_preferences(user_id);
CREATE INDEX idx_preferences_confidence ON user_ai_preferences(confidence_level);

-- ============================================
-- TABLE: user_learning_settings
-- User settings for AI learning feature
-- ============================================
CREATE TABLE IF NOT EXISTS user_learning_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  learning_enabled BOOLEAN DEFAULT true,
  track_interactions BOOLEAN DEFAULT true,
  use_for_recommendations BOOLEAN DEFAULT true,
  use_for_chat BOOLEAN DEFAULT true,

  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for user_learning_settings
ALTER TABLE user_learning_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_learning_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_learning_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_learning_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON user_learning_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Index for user_learning_settings
CREATE INDEX idx_learning_settings_user ON user_learning_settings(user_id);

-- ============================================
-- TRIGGERS: Auto-update updated_at timestamps
-- ============================================

-- Trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_favorite_jobs
DROP TRIGGER IF EXISTS update_user_favorite_jobs_updated_at ON user_favorite_jobs;
CREATE TRIGGER update_user_favorite_jobs_updated_at
  BEFORE UPDATE ON user_favorite_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_interactions
DROP TRIGGER IF EXISTS update_user_interactions_updated_at ON user_interactions;
CREATE TRIGGER update_user_interactions_updated_at
  BEFORE UPDATE ON user_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_ai_preferences
DROP TRIGGER IF EXISTS update_user_ai_preferences_updated_at ON user_ai_preferences;
CREATE TRIGGER update_user_ai_preferences_updated_at
  BEFORE UPDATE ON user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_learning_settings
DROP TRIGGER IF EXISTS update_user_learning_settings_updated_at ON user_learning_settings;
CREATE TRIGGER update_user_learning_settings_updated_at
  BEFORE UPDATE ON user_learning_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS: Document the tables
-- ============================================

COMMENT ON TABLE user_favorite_jobs IS 'Stores jobs that users have explicitly marked as favorites for AI learning';
COMMENT ON TABLE user_interactions IS 'Tracks user interactions with jobs (view, save, apply, etc.) for preference learning';
COMMENT ON TABLE user_ai_preferences IS 'Computed preferences learned from user behavior and favorites';
COMMENT ON TABLE user_learning_settings IS 'User settings controlling AI learning and interaction tracking';
