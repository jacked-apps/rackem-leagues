-- Migration: teams.status — add 'bye' value
-- Purpose: Allow teams rows to carry status='bye' so byes can be represented
-- as real team records instead of NULL home_team_id/away_team_id on matches.
--
-- ALTER TABLE does not support modifying CHECK constraint expressions
-- directly, so we DROP and re-ADD the constraint. Both happen inside the
-- same migration transaction.
--
-- This is purely additive: every existing row already satisfies the new
-- constraint (active|withdrawn|forfeited are still allowed). No data
-- migration needed.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (PR 1 Unit 1.1)
--            docs/brainstorms/team-deletion-cascade-fix-requirements.md (R2, R3)

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_status_check;
ALTER TABLE teams
  ADD CONSTRAINT teams_status_check
  CHECK ((status)::text = ANY (ARRAY[
    ('active'::character varying)::text,
    ('withdrawn'::character varying)::text,
    ('forfeited'::character varying)::text,
    ('bye'::character varying)::text
  ]));

COMMENT ON COLUMN teams.status IS
'Team status: active (playing), withdrawn (left league), forfeited (disqualified), bye (placeholder team for odd-team-count seasons or absorbed dropped-team slots — no roster, no captain, opponent gets forfeit win on past-dated unplayed matches).';
