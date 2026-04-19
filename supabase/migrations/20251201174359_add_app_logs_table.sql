-- ============================================================================
-- APP_LOGS TABLE
-- Stores application logs from the frontend for production debugging
-- ============================================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by level and time
CREATE INDEX idx_app_logs_level_created ON app_logs(level, created_at DESC);

-- Index for querying by user
CREATE INDEX idx_app_logs_user_id ON app_logs(user_id) WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to INSERT logs (they can log their own errors)
CREATE POLICY "Users can insert their own logs"
  ON app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to insert logs too (for pre-auth errors)
CREATE POLICY "Anonymous users can insert logs"
  ON app_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Only allow operators/admins to READ logs (for debugging)
-- For now, we'll restrict to service role only - operators can view via Supabase dashboard
-- If you want operators to see logs in-app, add a policy like:
-- CREATE POLICY "Operators can view all logs"
--   ON app_logs
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM organization_staff os
--       WHERE os.member_id = (SELECT id FROM members WHERE user_id = auth.uid())
--       AND os.position IN ('owner', 'admin')
--     )
--   );

-- Add comment
COMMENT ON TABLE app_logs IS 'Frontend application logs for production debugging. Errors and warnings are automatically sent here.';
