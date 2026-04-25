-- Migration: archived_placeholders table + retire unused merge_requests
-- Purpose: Store a complete snapshot of every placeholder at merge time plus
--          the list of rows that belonged to them, so undo can restore both.
--
-- Design (see plan doc, Key Technical Decision #2):
--   - member_snapshot JSONB holds the full placeholder `members` row at merge.
--   - transferred_rows JSONB holds {table_name, row_id} pairs collected by
--     the merge RPC as it walks the schema-aware FK loop. Undo walks this
--     list and flips each row's member_id back to the restored placeholder.
--     Rows the target created AFTER the merge are never in the list, so they
--     stay with the target automatically.
--   - placeholder_member_id has no FK — the placeholder row is deleted during
--     the merge. Undo recreates the row with the same UUID so downstream
--     references that were never rewritten (none today, but future-proofed)
--     line up correctly.
--
-- Access control (RLS is globally disabled in this project but the table
-- holds PII snapshots and must not leak to client sessions): explicit RLS is
-- enabled with DENY-everything policies for `anon` and `authenticated`.
-- `service_role` bypasses RLS so Edge Functions and SECURITY DEFINER RPCs
-- retain full access. Defense-in-depth: if RLS is ever flipped on globally,
-- this table stays locked down.
--
-- Retention: `expires_at = created_at + 1 year`. Read-side filter is the
-- default enforcement; optional scheduled purge is a follow-up (Unit 15).
--
-- Also drops the unused `merge_requests` table from 20251216121115, its
-- trigger function, and its enum type. That table was added for an
-- approval-queue workflow that was never wired to any UI and is superseded
-- here by the snapshot + direct-merge model.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 3)

-- ============================================================================
-- DROP: unused merge_requests machinery
-- ============================================================================
-- CASCADE removes the table's indexes and the merge_requests_updated_at
-- trigger. The trigger function and enum type are then unreferenced and can
-- be dropped cleanly.
DROP TABLE IF EXISTS merge_requests CASCADE;
DROP FUNCTION IF EXISTS update_merge_request_timestamp();
DROP TYPE IF EXISTS merge_request_status;

-- ============================================================================
-- CREATE: archived_placeholders
-- ============================================================================
CREATE TABLE archived_placeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The deleted placeholder's original id. No FK — the row is gone by the
  -- time this archive row is written. Used by undo to INSERT the restored
  -- placeholder back into `members` with the same id.
  placeholder_member_id UUID NOT NULL,

  -- Who absorbed the placeholder.
  target_member_id UUID NOT NULL REFERENCES members(id),

  -- Org ownership — used by LO list queries and as an authz boundary in the
  -- Edge Function that gates undo access.
  organization_id UUID NOT NULL,

  -- Who initiated the merge, and how.
  actor_member_id UUID NOT NULL REFERENCES members(id),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('invite_accept', 'lo_initiated')),

  -- Full placeholder `members` row captured at merge time (PII).
  -- Built via `SELECT to_jsonb(m.*) FROM members m WHERE id = placeholder_id`.
  member_snapshot JSONB NOT NULL,

  -- Ordered list of {table_name, row_id} pairs rewritten during the merge.
  -- Canonical record of what the merge moved; undo walks this list to flip
  -- each row's member_id back to the restored placeholder id.
  transferred_rows JSONB NOT NULL,

  -- Set when the merge is undone. NULL means the merge is active.
  undone_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One-year retention window. Undo UI and LO list queries filter on
  -- `expires_at > now()`. Physical purge is optional (Unit 15).
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year')
);

-- Indexes
-- (org, created_at DESC): LO dashboard scans of recent merges.
CREATE INDEX idx_archived_placeholders_org_created
  ON archived_placeholders (organization_id, created_at DESC);

-- target: "did this user absorb a placeholder?" lookups on the user profile.
CREATE INDEX idx_archived_placeholders_target
  ON archived_placeholders (target_member_id);

-- placeholder: "what happened to this PP id?" lookups from audit entries and
-- residual references that somehow persisted after the merge.
CREATE INDEX idx_archived_placeholders_placeholder
  ON archived_placeholders (placeholder_member_id);

-- ============================================================================
-- ROW-LEVEL SECURITY: DENY for anon + authenticated
-- ============================================================================
-- RLS is globally disabled in this project; authorization lives in UI +
-- Edge Functions + query layer. Enabling RLS here with explicit DENY policies
-- is defense-in-depth for a table that holds PII member snapshots: if a
-- client session ever gets a direct supabase.from('archived_placeholders')
-- query through (intentional or not), Postgres blocks it.
-- `service_role` (used by Edge Functions and SECURITY DEFINER RPCs) bypasses
-- RLS, so the planned merge and undo paths are unaffected.
ALTER TABLE archived_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all for anon" ON archived_placeholders
  AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "deny all for authenticated" ON archived_placeholders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE archived_placeholders IS
'Snapshot + row-list of every placeholder-player merge. Drives undo and LO audit surfaces. Access is service_role only; anon and authenticated are denied by restrictive RLS policies.';

COMMENT ON COLUMN archived_placeholders.placeholder_member_id IS
'Original UUID of the deleted placeholder. No FK because the row is gone. Undo restores the placeholder with this same id so any stale references line up.';

COMMENT ON COLUMN archived_placeholders.transferred_rows IS
'JSONB array of {table_name, row_id} pairs collected by the merge RPC. Undo walks this list and rewrites each row back to the restored placeholder id.';

COMMENT ON COLUMN archived_placeholders.expires_at IS
'One-year retention boundary. Undo RPC rejects archives past this. Physical purge is a separate, optional job.';
