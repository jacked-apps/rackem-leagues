-- Migration: teams.withdrawn_at — audit timestamp for drop operations
-- Purpose: When the drop_team RPC marks a team withdrawn, it records the
-- moment so UIs can surface "Team X dropped on <date>" context to captains
-- and players viewing schedules and standings affected by the drop.
--
-- NULL for active and original-bye teams (they were never dropped).
-- Set to NOW() inside drop_team's transaction (PR 2 Unit 2.2).
--
-- No data migration needed — column is nullable and defaults to NULL.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (R22)

ALTER TABLE teams ADD COLUMN withdrawn_at timestamptz;

COMMENT ON COLUMN teams.withdrawn_at IS
'Set by the drop_team RPC when status flips to ''withdrawn''. NULL for teams that were never dropped (active rows + original-schedule bye rows). Used by UIs to surface "Team X dropped on <date>" context.';
