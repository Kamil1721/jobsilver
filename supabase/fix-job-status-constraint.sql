-- Fix Job Status Constraint
-- The current CHECK constraint is missing 'discovered' and 'discarded' statuses
-- Run this in your Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add the corrected constraint with all required statuses
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
CHECK (status IN ('discovered', 'saved', 'applied', 'interviewing', 'offer', 'discarded', 'rejected'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'jobs'::regclass AND contype = 'c';
