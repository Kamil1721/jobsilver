-- Migration: Add unique constraint on application_url per user
-- Purpose: Prevent duplicate jobs from different sources pointing to the same application

-- First, clean up existing duplicates (keep oldest by created_at)
-- This handles cases where the same job was added from different sources
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, application_url
    ORDER BY created_at ASC
  ) as rn
  FROM jobs
  WHERE application_url IS NOT NULL
)
DELETE FROM jobs WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint (NULL values are treated as distinct, so multiple NULL URLs are allowed)
ALTER TABLE jobs ADD CONSTRAINT jobs_user_url_unique
  UNIQUE(user_id, application_url);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT jobs_user_url_unique ON jobs IS
  'Prevents duplicate jobs from different sources that have the same application URL for a user';
