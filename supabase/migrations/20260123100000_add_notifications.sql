-- Migration: Add notifications table and user notification preferences
-- Date: 2026-01-23

-- ============================================================================
-- 1. Add notification preference columns to profiles
-- ============================================================================

-- Add email notifications toggle (master switch)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- Add granular notification preferences (JSON object)
-- Keys: welcome, job_matches, application_status, quota_warning
-- Values: boolean (true = enabled, false = disabled)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "welcome": true,
  "job_matches": true,
  "application_status": true,
  "quota_warning": true
}'::jsonb;

-- ============================================================================
-- 2. Create notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('welcome', 'job_matches', 'application_status', 'quota_warning')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 3. Create indexes for efficient queries
-- ============================================================================

-- Index for fetching user's notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Index for fetching notifications by type
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Index for fetching notifications by status
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Compound index for common query pattern (user's recent notifications)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ============================================================================
-- 4. Enable RLS and create policies
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can manage all notifications (for system-triggered emails)
CREATE POLICY "Service role can manage notifications"
ON notifications FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- 5. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE notifications IS 'Email notification log for tracking sent notifications';
COMMENT ON COLUMN notifications.id IS 'Unique notification identifier';
COMMENT ON COLUMN notifications.user_id IS 'User who received the notification';
COMMENT ON COLUMN notifications.type IS 'Type of notification (welcome, job_matches, application_status, quota_warning)';
COMMENT ON COLUMN notifications.status IS 'Delivery status (pending, sent, failed)';
COMMENT ON COLUMN notifications.error IS 'Error message if notification failed';
COMMENT ON COLUMN notifications.sent_at IS 'Timestamp when notification was successfully sent';
COMMENT ON COLUMN notifications.created_at IS 'Timestamp when notification record was created';

COMMENT ON COLUMN profiles.email_notifications IS 'Master toggle for all email notifications';
COMMENT ON COLUMN profiles.notification_preferences IS 'Granular notification preferences by type';
