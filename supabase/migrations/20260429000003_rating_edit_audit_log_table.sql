-- ============================================================================
-- PHASE 2 UNIT 2.3b — rating_edit_audit_log TABLE SCAFFOLDING
-- ============================================================================
--
-- Creates the audit-log table for rating mutations. R21 of the modular-
-- league plan addresses BCA's #1 software anxiety (sandbagging via silent
-- rating manipulation) by recording every player-rating change to an
-- immutable log.
--
-- THIS MIGRATION: table + indexes + RESTRICTIVE DENY RLS for anon/authenticated
-- (defense-in-depth — defaults to deny; SECURITY DEFINER RPCs in Phase 6
-- Unit 6.1 will be the only INSERT path).
--
-- DEFERRED to Phase 6 Unit 6.1:
--   - The atomic rating-mutation RPCs (set_match_lineup_rating,
--     recompute_member_rating, vacate_and_rescore_audit_marker)
--   - RLS SELECT policy granting org owners/admins read access
--   - The TS wrapper at src/api/mutations/ratingMutations.ts
--   - Wiring the existing rating-edit pathways through the RPCs
--
-- This split lets the table exist now (Phase 5 work can REFERENCE it
-- without circular Phase 6 dependencies) without yet committing to the
-- full audit-emission flow that's a chunk of work in itself.
--
-- COLUMN SHAPE rationale:
--
--   actor_user_id        — auth.uid() at time of edit. Server-resolved
--                          from JWT inside the SECURITY DEFINER RPC,
--                          NEVER accepted from client request bodies.
--   actor_type           — 'user' | 'system' | 'api'. 'system' for
--                          automated recomputes; 'api' for future
--                          FargoRate / BCA Verified ingest.
--   target_member_id     — the player whose rating changed. NOT a FK
--                          because audit must survive even if the member
--                          is later deleted (placeholder merge / archive).
--   target_match_lineup_id — set when the edit is per-match-lineup
--                          (Fargo manual entry). NULL for persistent-
--                          rating mutations.
--   rating_system        — 'points' | 'percentage' | 'fargo' | 'skill_level'
--                          | 'none'. Mirrors preferences.handicap_type
--                          values; locks which system the edit applied to.
--   before_value         — TEXT (rather than numeric) so any rating
--                          system's value representation can be stored
--                          without precision loss. Caller stringifies.
--   after_value          — same.
--   scope                — 'per_match_lineup' | 'persistent'.
--   reason               — optional free-text from the LO when the edit
--                          is manual ("captain misentered original").
--   source               — 'manual' | 'computed' | 'api' | 'rescore'.
--   organization_id      — the league's org. Lets RLS scope SELECT to
--                          the org's owners/admins without joining
--                          back through leagues every read.
--   created_at           — timestamptz default now(). The "when" of the
--                          audit row. Indexed for org-scoped chronological
--                          listing.
--
-- IMMUTABILITY:
--   No UPDATE policy granted. No DELETE policy granted. Once a row is
--   inserted by the RPC, it cannot be modified or removed by anyone
--   except a Postgres superuser (which the app never runs as).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rating_edit_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  actor_user_id UUID,                      -- auth.uid() at edit time
  actor_type    TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('user', 'system', 'api')),

  target_member_id       UUID NOT NULL,
  target_match_lineup_id UUID,
  rating_system          TEXT NOT NULL,    -- mirrors preferences.handicap_type
  before_value           TEXT,
  after_value            TEXT,

  scope  TEXT NOT NULL
    CHECK (scope IN ('per_match_lineup', 'persistent')),
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'computed', 'api', 'rescore')),

  organization_id UUID,                    -- denormalized for RLS

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rating_edit_audit_log IS
  'Immutable audit log for player-rating mutations (R21 of modular-league plan). INSERT-only via SECURITY DEFINER RPCs in Phase 6 Unit 6.1. No UPDATE / no DELETE policies. Addresses BCA''s #1 software concern: sandbagging via silent rating manipulation.';

-- Indexes for the access patterns the audit-log read UI will use:
--   1. Org owner browsing recent rating edits in their org
--   2. Looking up history for a specific player
--   3. Looking up changes that came from a specific match (e.g. after vacate-rescore)
CREATE INDEX IF NOT EXISTS idx_rating_edit_audit_log_org_created
  ON rating_edit_audit_log (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rating_edit_audit_log_target_member
  ON rating_edit_audit_log (target_member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rating_edit_audit_log_target_match_lineup
  ON rating_edit_audit_log (target_match_lineup_id)
  WHERE target_match_lineup_id IS NOT NULL;

-- Enable RLS with RESTRICTIVE DENY policies for anon and authenticated.
-- Phase 6 Unit 6.1 will add the SELECT policy for org owners/admins
-- alongside the SECURITY DEFINER RPCs that are the sole INSERT path.
-- service_role bypasses RLS as usual.
ALTER TABLE rating_edit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY rating_edit_audit_log_deny_anon
  ON rating_edit_audit_log
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY rating_edit_audit_log_deny_authenticated_default
  ON rating_edit_audit_log
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- The Phase 6 SELECT permission for org owners will be a non-restrictive
-- policy that opens specific rows; until that lands, ALL access by
-- authenticated users is denied (defense-in-depth — service_role bypass
-- is the only access path during the Phase 2 → Phase 6 transition).
