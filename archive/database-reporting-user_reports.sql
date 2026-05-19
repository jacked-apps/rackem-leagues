-- ============================================================================
-- ARCHIVED 2026-05-13 (Messaging Phase 1 / Unit 9 cleanup)
-- ============================================================================
-- Original location: database/reporting/user_reports.sql
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
 * @fileoverview User Reporting System
 *
 * A comprehensive reporting system for handling user misconduct.
 * Designed with legal protection and accountability in mind.
 *
 * Key Features:
 * - Immutable audit trail (reports can't be deleted)
 * - Multiple report categories
 * - Evidence preservation (snapshots of reported content)
 * - Escalation workflow (operator → developer)
 * - Privacy protection for reporters
 * - Action tracking (warnings, suspensions, bans)
 *
 * Report Types:
 * - inappropriate_message: Offensive/profane messages
 * - harassment: Persistent unwanted contact
 * - fake_account: Suspected fake/bot account
 * - cheating: Match fixing or score manipulation
 * - poor_sportsmanship: Unsportsmanlike conduct
 * - impersonation: Pretending to be someone else
 * - spam: Repeated unwanted messages
 * - other: Other violations
 */

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Report categories
CREATE TYPE report_category AS ENUM (
  'inappropriate_message',
  'harassment',
  'fake_account',
  'cheating',
  'poor_sportsmanship',
  'impersonation',
  'spam',
  'other'
);

-- Report status workflow
CREATE TYPE report_status AS ENUM (
  'pending',           -- Newly created, awaiting review
  'under_review',      -- Operator is investigating
  'escalated',         -- Escalated to developer
  'action_taken',      -- Action taken (warning/suspension/ban)
  'resolved',          -- Resolved with no action
  'dismissed'          -- Invalid/frivolous report
);

-- Severity levels
CREATE TYPE report_severity AS ENUM (
  'low',               -- Minor issue
  'medium',            -- Concerning behavior
  'high',              -- Serious violation
  'critical'           -- Immediate action required
);

-- Actions taken
CREATE TYPE moderation_action AS ENUM (
  'warning',           -- Verbal/written warning
  'temporary_suspension', -- Temporary ban
  'permanent_ban',     -- Permanent ban
  'account_deletion',  -- Account removed
  'no_action'          -- No action taken
);

-- =============================================================================
-- USER REPORTS TABLE
-- =============================================================================

CREATE TABLE user_reports (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who and What
  reporter_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category report_category NOT NULL,

  -- Description and Evidence
  description TEXT NOT NULL, -- Reporter's description of issue
  evidence_snapshot JSONB,   -- Snapshot of reported content (message text, match data, etc.)
  context_data JSONB,        -- Additional context (conversation_id, match_id, etc.)

  -- Severity and Priority
  severity report_severity DEFAULT 'medium',
  auto_flagged BOOLEAN DEFAULT FALSE, -- True if auto-detected (profanity filter, etc.)

  -- Status tracking
  status report_status DEFAULT 'pending',

  -- Assignment and handling
  assigned_operator_id UUID REFERENCES league_operators(id) ON DELETE SET NULL,
  escalated_to_dev BOOLEAN DEFAULT FALSE,

  -- Timestamps (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT cannot_report_self CHECK (reporter_id != reported_user_id),
  CONSTRAINT description_not_empty CHECK (LENGTH(TRIM(description)) > 0)
);

-- =============================================================================
-- REPORT ACTIONS TABLE (Audit Trail)
-- =============================================================================

CREATE TABLE report_actions (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links
  report_id UUID NOT NULL REFERENCES user_reports(id) ON DELETE CASCADE,

  -- Who took action
  actor_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  actor_role VARCHAR(50) NOT NULL, -- 'operator', 'developer'

  -- What action
  action_type moderation_action NOT NULL,
  action_notes TEXT NOT NULL, -- Why this action was taken

  -- For suspensions
  suspension_until TIMESTAMPTZ, -- NULL for warnings/permanent bans

  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- REPORT UPDATES TABLE (Status Changes)
-- =============================================================================

CREATE TABLE report_updates (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Links
  report_id UUID NOT NULL REFERENCES user_reports(id) ON DELETE CASCADE,

  -- Who made update
  updater_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  updater_role VARCHAR(50) NOT NULL, -- 'operator', 'developer'

  -- What changed
  old_status report_status NOT NULL,
  new_status report_status NOT NULL,
  update_notes TEXT, -- Optional notes about status change

  -- Timestamp (immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Performance indexes
CREATE INDEX idx_user_reports_reporter ON user_reports(reporter_id);
CREATE INDEX idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX idx_user_reports_status ON user_reports(status);
CREATE INDEX idx_user_reports_category ON user_reports(category);
CREATE INDEX idx_user_reports_severity ON user_reports(severity);
CREATE INDEX idx_user_reports_assigned_operator ON user_reports(assigned_operator_id);
CREATE INDEX idx_user_reports_created_at ON user_reports(created_at DESC);
CREATE INDEX idx_user_reports_escalated ON user_reports(escalated_to_dev) WHERE escalated_to_dev = TRUE;

CREATE INDEX idx_report_actions_report ON report_actions(report_id);
CREATE INDEX idx_report_actions_actor ON report_actions(actor_id);
CREATE INDEX idx_report_actions_created ON report_actions(created_at DESC);

CREATE INDEX idx_report_updates_report ON report_updates(report_id);

-- =============================================================================
-- TRIGGERS (Auto-update timestamps)
-- =============================================================================

-- Update reviewed_at when status changes from pending
CREATE OR REPLACE FUNCTION update_report_reviewed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.reviewed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_reviewed_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_report_reviewed_at();

-- Update resolved_at when status changes to resolved/dismissed/action_taken
CREATE OR REPLACE FUNCTION update_report_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('resolved', 'dismissed', 'action_taken') AND OLD.resolved_at IS NULL THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_resolved_at
  BEFORE UPDATE ON user_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_report_resolved_at();

-- Auto-create report_update entry when status changes
CREATE OR REPLACE FUNCTION log_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO report_updates (
      report_id,
      updater_id,
      updater_role,
      old_status,
      new_status,
      update_notes
    ) VALUES (
      NEW.id,
      -- Get current user's member_id
      (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1),
      -- Determine role based on user
      (CASE
        WHEN EXISTS (SELECT 1 FROM league_operators WHERE member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)) THEN 'operator'
        WHEN EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'developer') THEN 'developer'
        ELSE 'unknown'
      END),
      OLD.status,
      NEW.status,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_report_status_change
  AFTER UPDATE ON user_reports
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_report_status_change();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_updates ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports (reports they submitted)
CREATE POLICY "Users can view their own reports"
  ON user_reports
  FOR SELECT
  USING (
    reporter_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON user_reports
  FOR INSERT
  WITH CHECK (
    reporter_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  );

-- Operators can view reports for their leagues
CREATE POLICY "Operators can view league reports"
  ON user_reports
  FOR SELECT
  USING (
    -- Operator can see reports about players in their leagues
    EXISTS (
      SELECT 1 FROM league_operators lo
      INNER JOIN leagues l ON l.operator_id = lo.id
      INNER JOIN seasons s ON s.league_id = l.id AND s.status = 'active'
      INNER JOIN teams t ON t.season_id = s.id
      INNER JOIN team_players tp ON tp.team_id = t.id
      WHERE lo.member_id = (SELECT id FROM members WHERE user_id = auth.uid())
        AND tp.member_id = user_reports.reported_user_id
    )
  );

-- Operators can update reports in their jurisdiction
CREATE POLICY "Operators can update league reports"
  ON user_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM league_operators lo
      INNER JOIN leagues l ON l.operator_id = lo.id
      INNER JOIN seasons s ON s.league_id = l.id AND s.status = 'active'
      INNER JOIN teams t ON t.season_id = s.id
      INNER JOIN team_players tp ON tp.team_id = t.id
      WHERE lo.member_id = (SELECT id FROM members WHERE user_id = auth.uid())
        AND tp.member_id = user_reports.reported_user_id
    )
  );

-- Developers can view all reports
CREATE POLICY "Developers can view all reports"
  ON user_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'developer'
    )
  );

-- Developers can update all reports
CREATE POLICY "Developers can update all reports"
  ON user_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND role = 'developer'
    )
  );

-- NOTE: NO DELETE POLICIES - Reports are immutable for legal protection

-- Report Actions RLS (same patterns as user_reports)
CREATE POLICY "Users can view actions on their reports"
  ON report_actions
  FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM user_reports
      WHERE reporter_id = (SELECT id FROM members WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Operators and Devs can view report actions"
  ON report_actions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid()
        AND (role = 'developer' OR role = 'league_operator')
    )
  );

CREATE POLICY "Operators and Devs can create report actions"
  ON report_actions
  FOR INSERT
  WITH CHECK (
    actor_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid()
        AND (role = 'developer' OR role = 'league_operator')
    )
  );

-- Report Updates RLS
CREATE POLICY "Anyone can view report updates"
  ON report_updates
  FOR SELECT
  USING (
    -- Users can see updates on their own reports
    report_id IN (
      SELECT id FROM user_reports
      WHERE reporter_id = (SELECT id FROM members WHERE user_id = auth.uid())
    )
    OR
    -- Operators and developers can see all updates
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid()
        AND (role = 'developer' OR role = 'league_operator')
    )
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_reports IS 'Immutable record of all user reports - legal protection and accountability';
COMMENT ON TABLE report_actions IS 'Audit trail of all moderation actions taken';
COMMENT ON TABLE report_updates IS 'History of status changes for each report';

COMMENT ON COLUMN user_reports.evidence_snapshot IS 'Immutable snapshot of reported content (message text, match data, etc.) stored as JSONB';
COMMENT ON COLUMN user_reports.context_data IS 'Additional context like conversation_id, match_id, etc.';
COMMENT ON COLUMN user_reports.auto_flagged IS 'True if system auto-detected (profanity filter, etc.)';

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ User reporting system created';
  RAISE NOTICE '  - Reports are IMMUTABLE (no delete policy)';
  RAISE NOTICE '  - Full audit trail maintained';
  RAISE NOTICE '  - Evidence preserved in evidence_snapshot';
  RAISE NOTICE '  - Escalation workflow: Operator → Developer';
END $$;
