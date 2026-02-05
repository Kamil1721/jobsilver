-- Add notes column to jobs table for user notes
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN jobs.notes IS 'User notes for the job';
