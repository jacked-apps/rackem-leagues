-- Migration: revert auto-archive trigger
-- Purpose: Removing the team_players auto-archive trigger added in
--          20260425000001 + 20260425000002. The premise was wrong: a
--          placeholder being off all teams is a NORMAL state (snowbirds,
--          vacation, mid-season swaps, between-season gaps). Auto-
--          archiving causes more harm than good — it makes the player
--          vanish from search dropdowns when the captain may just be
--          about to re-add them.
--
-- After this migration:
--   - Captains can still remove placeholders from a roster (Unit 11
--     wall-removal stays). Removing only deletes the team_players row.
--     The placeholder stays active, still appears in player search, can
--     be re-added by anyone.
--   - Archiving a placeholder remains an explicit LO action via the
--     archive_placeholder RPC (Player Management surface).
--
-- Cleanup: also un-archives any placeholder that was auto-archived by
-- the now-removed trigger (identified via affected_tables.op = 'auto_archive'
-- in placeholder_audit_log). Audit rows themselves stay as historical
-- record.
--
-- Reference: project memory feedback_no_auto_archive

-- ============================================================================
-- Step 1: drop the trigger + function
-- ============================================================================
DROP TRIGGER IF EXISTS team_players_auto_archive_orphan_placeholder ON team_players;
DROP FUNCTION IF EXISTS auto_archive_orphan_placeholder();

-- ============================================================================
-- Step 2: un-archive anything the trigger erroneously archived
-- ============================================================================
WITH auto_archived AS (
  SELECT DISTINCT placeholder_member_id
  FROM placeholder_audit_log
  WHERE action = 'remove_from_team'
    AND affected_tables ->> 'op' = 'auto_archive'
)
UPDATE members
   SET archived_at = NULL
 WHERE id IN (SELECT placeholder_member_id FROM auto_archived)
   AND archived_at IS NOT NULL
   AND user_id IS NULL;
