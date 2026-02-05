-- Admin Improvements Migration
-- Adds: admin_announcements table, admin_audit_logs table

-- ============================================
-- ADMIN ANNOUNCEMENTS TABLE
-- ============================================
-- Stores banner announcements for the dashboard

CREATE TABLE IF NOT EXISTS admin_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'promo', 'maintenance')),
  priority INTEGER NOT NULL DEFAULT 0,
  target_plans TEXT[] DEFAULT NULL, -- NULL = all plans, or ['free'], ['free', 'pro']
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying active announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON admin_announcements(is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON admin_announcements(priority DESC);

-- RLS: Anyone can read active announcements, only admins can write
ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;

-- Public can read currently active announcements
CREATE POLICY "Anyone can read active announcements" ON admin_announcements
  FOR SELECT USING (
    is_active = true
    AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- Admins can do everything
CREATE POLICY "Admins can manage announcements" ON admin_announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- ADMIN AUDIT LOGS TABLE
-- ============================================
-- Stores all admin actions for security auditing

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT, -- 'user', 'report', 'tester', 'announcement'
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);

-- RLS: Only admins can read/write audit logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs" ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert audit logs" ON admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Prevent deletion/update of audit logs (immutable for security)
-- No update or delete policies are created intentionally

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE admin_announcements IS 'Banner announcements displayed to dashboard users';
COMMENT ON COLUMN admin_announcements.type IS 'Announcement type: info (blue), warning (amber), promo (purple), maintenance (red)';
COMMENT ON COLUMN admin_announcements.target_plans IS 'Which plans see this announcement. NULL = all plans';
COMMENT ON COLUMN admin_announcements.priority IS 'Higher priority announcements shown first';

COMMENT ON TABLE admin_audit_logs IS 'Immutable audit log of all admin actions';
COMMENT ON COLUMN admin_audit_logs.action IS 'Action performed: tester_granted, tester_revoked, report_updated, user_deleted, announcement_created, etc.';
COMMENT ON COLUMN admin_audit_logs.target_type IS 'Type of entity affected: user, report, tester, announcement';
