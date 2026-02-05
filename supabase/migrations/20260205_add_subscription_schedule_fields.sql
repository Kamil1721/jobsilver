-- Add scheduled downgrade fields to subscriptions table
-- These track Ultra→Pro auto-transitions using Stripe Subscription Schedules

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS scheduled_downgrade_to TEXT,
ADD COLUMN IF NOT EXISTS scheduled_downgrade_date TIMESTAMPTZ;

-- Add index for querying scheduled downgrades
CREATE INDEX IF NOT EXISTS idx_subscriptions_scheduled_downgrade
ON subscriptions (scheduled_downgrade_date)
WHERE scheduled_downgrade_to IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN subscriptions.scheduled_downgrade_to IS 'Target plan for scheduled downgrade (e.g., "pro" for Ultra→Pro)';
COMMENT ON COLUMN subscriptions.scheduled_downgrade_date IS 'Date when the scheduled downgrade will take effect';
