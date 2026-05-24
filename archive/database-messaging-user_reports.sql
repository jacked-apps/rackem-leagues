-- ============================================================================
-- ARCHIVED 2026-05-13 (Messaging Phase 1 / Unit 9 cleanup)
-- ============================================================================
-- Original location: database/messaging/user_reports.sql
--
-- This file is no longer the authoritative source for the user_reports table.
-- The live schema (including all RLS policies, indexes, and triggers) lives in
-- the baseline migration:
--
--   supabase/migrations/20251130010824_baseline.sql
--
-- Kept here only for historical reference. Do NOT run this file against any
-- environment. New schema work goes through supabase/migrations/.
-- ============================================================================

/**
 * @fileoverview User Reports Table Schema
 *
 * Allows users to report inappropriate messages or users to league operators.
 * Features:
 * - Report specific messages or general user behavior
 * - Category-based reporting (harassment, spam, inappropriate content, etc.)
 * - Status tracking (pending, reviewed, resolved, dismissed)
 * - Optional admin notes for resolution tracking
 * - Prevents duplicate reports (same reporter + same target)
 *
 * Reports are visible to:
 * - The reporter (their own reports)
 * - League operators (all reports in their organization)
 * - Developers (all reports)
 */

CREATE TABLE IF NOT EXISTS user_reports (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  reporter_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,  -- Optional: specific message being reported
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,  -- Context for the report

  -- Report details
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'harassment',
    'spam',
    'inappropriate_content',
    'impersonation',
    'other'
  )),
  description TEXT NOT NULL CHECK (LENGTH(description) > 0 AND LENGTH(description) <= 1000),

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
  )),
  admin_notes TEXT,  -- Notes from operator/admin who reviewed the report
  reviewed_by UUID REFERENCES members(id) ON DELETE SET NULL,  -- Operator who reviewed
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT cannot_report_self CHECK (reporter_id != reported_user_id),
  CONSTRAINT valid_review CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
    (status != 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON user_reports(status);
CREATE INDEX idx_user_reports_created_at ON user_reports(created_at DESC);
CREATE INDEX idx_user_reports_message ON user_reports(message_id) WHERE message_id IS NOT NULL;

-- Unique constraint to prevent duplicate reports
CREATE UNIQUE INDEX idx_user_reports_unique ON user_reports(reporter_id, reported_user_id, message_id)
  WHERE status IN ('pending', 'under_review');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_reports_updated_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_user_reports_updated_at();

-- Function to set reviewed_at when status changes from pending
CREATE OR REPLACE FUNCTION set_reviewed_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes from pending to anything else, set reviewed_at
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.reviewed_at = NOW();
    NEW.reviewed_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set reviewed_at and reviewed_by
CREATE TRIGGER set_reviewed_info
  BEFORE UPDATE OF status ON user_reports
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status != 'pending')
  EXECUTE FUNCTION set_reviewed_timestamp();

-- Row Level Security (RLS)
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON user_reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- Policy: League operators can view all reports in their organization
CREATE POLICY "Operators can view all reports"
  ON user_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = auth.uid()
        AND role IN ('league_operator', 'developer')
    )
  );

-- Policy: Authenticated users can create reports
CREATE POLICY "Users can create reports"
  ON user_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
    AND auth.uid() IS NOT NULL
  );

-- Policy: Only operators can update report status
CREATE POLICY "Operators can update reports"
  ON user_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = auth.uid()
        AND role IN ('league_operator', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members
      WHERE id = auth.uid()
        AND role IN ('league_operator', 'developer')
    )
  );

-- Policy: Users can delete their own pending reports
CREATE POLICY "Users can delete their pending reports"
  ON user_reports
  FOR DELETE
  USING (
    auth.uid() = reporter_id
    AND status = 'pending'
  );

-- Comments
COMMENT ON TABLE user_reports IS 'User-submitted reports for inappropriate messages or behavior';
COMMENT ON COLUMN user_reports.reporter_id IS 'User who submitted the report';
COMMENT ON COLUMN user_reports.reported_user_id IS 'User being reported';
COMMENT ON COLUMN user_reports.message_id IS 'Optional: specific message being reported';
COMMENT ON COLUMN user_reports.conversation_id IS 'Context: conversation where incident occurred';
COMMENT ON COLUMN user_reports.category IS 'Type of report: harassment, spam, inappropriate_content, impersonation, or other';
COMMENT ON COLUMN user_reports.description IS 'User-provided description of the issue (max 1000 characters)';
COMMENT ON COLUMN user_reports.status IS 'Report status: pending, under_review, resolved, or dismissed';
COMMENT ON COLUMN user_reports.admin_notes IS 'Internal notes from operator who reviewed the report';
COMMENT ON COLUMN user_reports.reviewed_by IS 'Operator who reviewed and resolved the report';
COMMENT ON COLUMN user_reports.reviewed_at IS 'When the report was reviewed';
