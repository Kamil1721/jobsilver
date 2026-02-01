-- Migration: Add retry columns to scraped_questions table
-- These columns track retry attempts for failed scraping jobs

-- Add retry_count column (number of retry attempts)
ALTER TABLE scraped_questions
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add max_retries column (maximum allowed retries before permanent failure)
ALTER TABLE scraped_questions
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Add last_error column (stores the most recent error message)
ALTER TABLE scraped_questions
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Add last_retry_at column (timestamp of last retry attempt)
ALTER TABLE scraped_questions
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Create index for finding failed jobs that can be retried
CREATE INDEX IF NOT EXISTS idx_scraped_questions_retry
ON scraped_questions(scrape_status, retry_count, max_retries)
WHERE scrape_status = 'failed' AND retry_count < max_retries;

-- Add comments for documentation
COMMENT ON COLUMN scraped_questions.retry_count IS 'Number of retry attempts for failed scraping';
COMMENT ON COLUMN scraped_questions.max_retries IS 'Maximum retry attempts before marking as permanently failed (default: 3)';
COMMENT ON COLUMN scraped_questions.last_error IS 'Most recent error message from scraping attempt';
COMMENT ON COLUMN scraped_questions.last_retry_at IS 'Timestamp of the last retry attempt';
