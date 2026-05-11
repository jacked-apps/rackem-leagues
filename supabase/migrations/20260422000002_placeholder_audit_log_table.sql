-- Migration: placeholder_audit_log table
-- Purpose: First-class audit trail for every action in the placeholder
--          lifecycle — merge, undo, captain-initiated no-stats delete, and
--          remove-from-team. Captured inside the same transaction as the
--          action itself so failure semantics are all-or-nothing.
--
-- Scope: audit rows record the WHAT and WHO, with `archive_id` linking to
-- `archived_placeholders` when the action produced a snapshot. Richer
-- before/after state lives in the archive table; this log is the
-- chronological index.
--
-- Access control: identical to archived_placeholders — RLS enabled with
-- RESTRICTIVE DENY policies for anon and authenticated. Audit rows reference
-- member ids and org ids that should never be readable from client sessions.
-- Service role bypasses RLS for Edge Functions and SECURITY DEFINER RPCs.
--
-- Audit-preservation convention (see invite_tokens migration): no DELETE
-- policy is granted. Rows are never pruned by the application layer.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 6)

CREATE TABLE placeholder_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What happened. Check constraint guards against typos from callers.
  action TEXT NOT NULL CHECK (action IN (
    'merge',
    'undo',
    'delete_no_stats',
    'remove_from_team'
  )),

  -- Who triggered it (captain or LO). Server-resolved from JWT in the
  -- Edge Function layer; never accepted from client request bodies.
  actor_member_id UUID NOT NULL REFERENCES members(id),

  -- The placeholder the action targeted. NULL-able because after a 'merge'
  -- the placeholder row is deleted — callers record the id here anyway for
  -- traceability, but the FK would fail, so no FK. The equivalent live
  -- linkage after merge is through archive_id → archived_placeholders.
  placeholder_member_id UUID,

  -- The registered member the placeholder merged into (merges + undos only).
  target_member_id UUID REFERENCES members(id),

  -- Org scope for LO dashboard queries and authz checks.
  organization_id UUID NOT NULL,

  -- Links this audit entry to the archive row for merges and undos. NULL
  -- for delete_no_stats and remove_from_team, which don't produce archive
  -- rows. No ON DELETE behavior — archives are never deleted while audit
  -- entries that reference them exist (application-layer invariant).
  archive_id UUID REFERENCES archived_placeholders(id),

  -- Free-form per-action context. For merges this captures the FK rewrite
  -- set ({table: row_count}) mirrored from archived_placeholders.transferred_rows;
  -- for removes this captures the team_id; for undos this captures restored
  -- row counts and any 'row_missing_during_undo' notes.
  affected_tables JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
-- (org, created_at DESC): LO audit feed.
CREATE INDEX idx_placeholder_audit_log_org_created
  ON placeholder_audit_log (organization_id, created_at DESC);

-- placeholder_member_id: "what happened to this PP" history query, works
-- both before and after merge (since we preserve the id without an FK).
CREATE INDEX idx_placeholder_audit_log_placeholder
  ON placeholder_audit_log (placeholder_member_id);

-- archive_id: jump from an archive row back to its audit entry.
CREATE INDEX idx_placeholder_audit_log_archive
  ON placeholder_audit_log (archive_id);

-- ============================================================================
-- ROW-LEVEL SECURITY: DENY for anon + authenticated
-- ============================================================================
ALTER TABLE placeholder_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all for anon" ON placeholder_audit_log
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "deny all for authenticated" ON placeholder_audit_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE placeholder_audit_log IS
'Chronological audit trail of placeholder-lifecycle actions (merge, undo, delete_no_stats, remove_from_team). Rows are written in the same transaction as the action and are never deleted by the application layer. Access is service_role only.';

COMMENT ON COLUMN placeholder_audit_log.placeholder_member_id IS
'Original placeholder id. Intentionally has no FK — after a merge the placeholder is deleted, but this log still needs to name it for the "what happened to this PP" query.';

COMMENT ON COLUMN placeholder_audit_log.archive_id IS
'Points at the archive row for actions that produced one (merge, undo). NULL for delete_no_stats and remove_from_team.';

COMMENT ON COLUMN placeholder_audit_log.affected_tables IS
'Per-action JSONB context. For merges: map of table_name → row_count rewritten. For undos: map of table_name → row_count restored, plus any "row_missing_during_undo" notes. For removes: team_id. For deletes: row count of team_players cleaned up.';
