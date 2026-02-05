-- Migration: Add downgrade_reasons table for tracking subscription downgrade analytics
-- Created: 2026-02-05

-- Create downgrade_reasons table
CREATE TABLE IF NOT EXISTS public.downgrade_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_plan TEXT NOT NULL,
  to_plan TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_downgrade_reasons_user_id ON public.downgrade_reasons(user_id);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_downgrade_reasons_created_at ON public.downgrade_reasons(created_at);

-- Create index for reason-based analytics
CREATE INDEX IF NOT EXISTS idx_downgrade_reasons_reason ON public.downgrade_reasons(reason);

-- Enable RLS
ALTER TABLE public.downgrade_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can insert their own downgrade reasons (via API)
CREATE POLICY "Users can insert own downgrade reasons"
  ON public.downgrade_reasons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can view their own downgrade history
CREATE POLICY "Users can view own downgrade reasons"
  ON public.downgrade_reasons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all downgrade reasons (for analytics)
CREATE POLICY "Admins can view all downgrade reasons"
  ON public.downgrade_reasons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = TRUE
    )
  );

-- Grant service role full access for API operations
GRANT ALL ON public.downgrade_reasons TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.downgrade_reasons IS 'Tracks reasons users give when downgrading their subscription plan';
COMMENT ON COLUMN public.downgrade_reasons.from_plan IS 'The plan the user is downgrading from (e.g., ultra, pro)';
COMMENT ON COLUMN public.downgrade_reasons.to_plan IS 'The plan the user is downgrading to (e.g., pro, free)';
COMMENT ON COLUMN public.downgrade_reasons.reason IS 'User-provided reason code for the downgrade';
