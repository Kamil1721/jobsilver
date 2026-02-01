-- Migration: Add columns for caching AI-generated search queries
-- These columns store cached search queries generated from user profile data
-- to avoid regenerating them on every search request.

-- Add generated_queries column to store the cached queries JSON
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS generated_queries JSONB;

-- Add hash column to track when profile data changes (for cache invalidation)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS queries_profile_hash VARCHAR(16);

-- Add timestamp to track when queries were generated (for TTL)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS queries_generated_at TIMESTAMPTZ;

-- Add index on hash for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_profiles_queries_hash ON profiles(queries_profile_hash);

-- Add comment for documentation
COMMENT ON COLUMN profiles.generated_queries IS 'Cached AI-generated search queries based on user profile';
COMMENT ON COLUMN profiles.queries_profile_hash IS 'Hash of profile data used to generate queries (for cache invalidation)';
COMMENT ON COLUMN profiles.queries_generated_at IS 'Timestamp when queries were generated (for TTL-based expiration)';
