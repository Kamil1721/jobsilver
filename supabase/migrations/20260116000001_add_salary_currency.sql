-- Add salary_currency column to jobs table
-- This stores the ISO 4217 currency code (e.g., 'USD', 'GBP', 'PLN', 'EUR')

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(3) DEFAULT 'USD';

-- Add comment explaining the field
COMMENT ON COLUMN jobs.salary_currency IS 'ISO 4217 currency code for salary values (e.g., USD, GBP, PLN, EUR)';
