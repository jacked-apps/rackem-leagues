-- ============================================================================
-- RELAX teams.roster_size CHECK CONSTRAINT
-- ============================================================================
--
-- The original `teams_roster_size_check` constraint (from the baseline schema)
-- restricted `roster_size` to exactly 5 or 8 — a hard-coded assumption from
-- the pre-modular era when the app only supported "5-man" or "8-man" formats.
--
-- The modular handicap/lineup system introduced in the April 2026 refactor
-- already uses `preferences.max_roster_size` with a far more permissive
-- CHECK of `>= 1 AND <= 20`. This migration aligns `teams.roster_size` with
-- that same range so operators can run leagues with any roster size in the
-- supported bounds (e.g., 10 or 12 players per team).
--
-- No data migration is needed — all existing rows already satisfy the new
-- constraint because they were previously required to be 5 or 8 (both of
-- which fall inside 1..20).
-- ============================================================================

ALTER TABLE teams
  DROP CONSTRAINT IF EXISTS teams_roster_size_check;

ALTER TABLE teams
  ADD CONSTRAINT teams_roster_size_check
  CHECK (roster_size >= 1 AND roster_size <= 20);

COMMENT ON COLUMN teams.roster_size IS
  'Maximum players on this team''s roster. Must be between 1 and 20, and should be <= the league/org max_roster_size preference.';
