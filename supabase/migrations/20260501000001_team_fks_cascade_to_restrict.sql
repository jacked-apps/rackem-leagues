-- Migration: team-referencing FKs — CASCADE -> RESTRICT
-- Purpose: Prevent silent destruction of matches and lineups when a team is deleted.
--
-- Before this migration, three FKs referencing teams(id) were defined with
-- ON DELETE CASCADE:
--   - matches.home_team_id
--   - matches.away_team_id
--   - match_lineups.team_id
--
-- A single `DELETE FROM teams WHERE id = X` therefore wiped every match
-- that team played in (destroying opponents' weekly schedules and any
-- standings/stat history that referenced those matches) AND every
-- match_lineups row pointing at that team (destroying lineup history,
-- handicap captures, and locked lineup state).
--
-- Fix: change all three FKs to ON DELETE RESTRICT. The database now refuses
-- any team deletion that would orphan a match or lineup row, regardless of
-- which call site issued the DELETE (UI, ad-hoc SQL, future feature, scripts).
--
-- Application-code semantics after this change:
--   - The operator UI must NOT issue a raw DELETE FROM teams when matches
--     exist. Instead, the team-management page guards the Delete button
--     (LIST_FOR_ED.md item #1, PR 0 Unit 0.2) and routes mid-season
--     departures through a Drop workflow (PR 2) that marks the team
--     status='withdrawn' and reassigns its scheduled matches to a bye row.
--   - League teardown (DeleteLeagueModal) must delete child rows
--     (match_lineups -> matches -> team_players -> teams -> seasons ->
--     leagues) explicitly in dependency order; it can no longer rely on
--     the leagues -> teams cascade carrying everything with it.
--
-- Safety: this is a tightening, not a loosening. Existing rows cannot
-- violate the new constraint. No data migration needed.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md
--            docs/brainstorms/team-deletion-cascade-fix-requirements.md
--            LIST_FOR_ED.md item #1

-- matches.home_team_id
ALTER TABLE matches DROP CONSTRAINT matches_home_team_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_home_team_id_fkey
  FOREIGN KEY (home_team_id) REFERENCES teams(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT matches_home_team_id_fkey ON matches IS
'RESTRICT: refuses team delete while a match still references this team. Mid-season departures use the drop_team RPC (status=withdrawn + reassign to bye row), not raw DELETE.';

-- matches.away_team_id
ALTER TABLE matches DROP CONSTRAINT matches_away_team_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_away_team_id_fkey
  FOREIGN KEY (away_team_id) REFERENCES teams(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT matches_away_team_id_fkey ON matches IS
'RESTRICT: refuses team delete while a match still references this team. Mid-season departures use the drop_team RPC (status=withdrawn + reassign to bye row), not raw DELETE.';

-- match_lineups.team_id
ALTER TABLE match_lineups DROP CONSTRAINT match_lineups_team_id_fkey;
ALTER TABLE match_lineups
  ADD CONSTRAINT match_lineups_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT match_lineups_team_id_fkey ON match_lineups IS
'RESTRICT: refuses team delete while a lineup row still references this team. Lineup history is preserved alongside the match record.';
