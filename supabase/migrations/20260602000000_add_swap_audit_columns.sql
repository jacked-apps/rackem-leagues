-- Migration: Add swap audit columns to match_lineups
-- Purpose: Record WHO requested a lineup swap and HOW the most recent swap
--          request was resolved (approved / denied), for the in-match audit
--          trail surfaced to captains and operators.
--
-- Companion to 20251211000000_add_lineup_change_request.sql, which added the
-- pending-request columns (swap_position, swap_new_player_id,
-- swap_new_player_handicap, swap_requested_at). Those describe the OPEN
-- request; these describe its provenance and outcome.
--
-- Both columns are nullable with no backfill:
-- - swap_requested_by_member_id is set when a request is opened (NULL when no
--   request has ever been made, or after older pre-migration requests).
-- - swap_last_resolution is set when a request is approved or denied and
--   persists after the swap_* request columns are cleared, so the resolution
--   toast / audit can read the outcome of the most recent resolved swap.

ALTER TABLE match_lineups
ADD COLUMN IF NOT EXISTS swap_requested_by_member_id UUID REFERENCES members(id),
ADD COLUMN IF NOT EXISTS swap_last_resolution JSONB;

COMMENT ON COLUMN match_lineups.swap_requested_by_member_id IS
  'Member who opened the current/most-recent swap request. Cleared alongside the swap_* request columns on resolution is NOT required — kept for the open request; resolution provenance lives in swap_last_resolution.by_member_id.';

COMMENT ON COLUMN match_lineups.swap_last_resolution IS
  'Outcome of the most recently resolved swap request. Shape: {kind: ''approved''|''denied'', by_member_id: uuid, resolved_at: timestamptz, position: int, old_player_id: uuid, new_player_id: uuid}. NULL until the first swap is resolved. JSONB so fields can be added backward-compatibly.';
