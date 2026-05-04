-- Migration: backfill NULL-team_id matches → real bye-team rows
-- Purpose: Existing matches written before PR 1 of the team-deletion-cascade
-- fix have home_team_id = NULL (or away_team_id = NULL) when they were byes.
-- Now that byes are real teams rows (status='bye'), these legacy NULLs need
-- to be replaced with real UUIDs pointing at per-season bye rows.
--
-- Approach:
--   1. Pre-flight DO block enumerates abort conditions and counts affected rows.
--   2. INSERT one bye row per affected season (CTE: distinct season_ids that
--      have at least one NULL-team match).
--   3. UPDATE matches: set NULL home_team_id / away_team_id to that season's
--      bye-row UUID. The existing trigger_sync_match_lineups_on_update
--      automatically propagates the team_id change to match_lineups (no
--      separate match_lineups DDL needed).
--   4. RAISE NOTICE summary at the end with row counts.
--
-- The whole migration runs inside a single transaction (BEGIN/COMMIT) so any
-- mid-migration failure rolls back deterministically.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (PR 1 Unit 1.3, R4)

BEGIN;

-- Pre-flight: enumerate abort conditions before mutating data.
DO $$
DECLARE
  v_double_null_count INT;
  v_null_season_count INT;
  v_orphan_lineup_count INT;
  v_no_league_seasons INT;
  v_total_affected INT;
  v_affected_seasons INT;
BEGIN
  -- Both team_ids NULL on the same match — would produce bye-vs-bye debris.
  SELECT COUNT(*) INTO v_double_null_count
  FROM matches
  WHERE home_team_id IS NULL AND away_team_id IS NULL;

  IF v_double_null_count > 0 THEN
    RAISE EXCEPTION 'Backfill aborted: % match(es) have both home_team_id AND away_team_id NULL. Resolve manually before re-running.', v_double_null_count;
  END IF;

  -- Matches without a season_id — orphans we can't associate a bye with.
  SELECT COUNT(*) INTO v_null_season_count
  FROM matches
  WHERE (home_team_id IS NULL OR away_team_id IS NULL)
    AND season_id IS NULL;

  IF v_null_season_count > 0 THEN
    RAISE EXCEPTION 'Backfill aborted: % NULL-team match(es) have no season_id. Resolve manually before re-running.', v_null_season_count;
  END IF;

  -- Affected seasons whose league_id is NULL or whose league has been deleted —
  -- can't read roster_size to construct a bye row.
  SELECT COUNT(DISTINCT s.id) INTO v_no_league_seasons
  FROM matches m
  JOIN seasons s ON s.id = m.season_id
  LEFT JOIN leagues l ON l.id = s.league_id
  WHERE (m.home_team_id IS NULL OR m.away_team_id IS NULL)
    AND (s.league_id IS NULL OR l.id IS NULL);

  IF v_no_league_seasons > 0 THEN
    RAISE EXCEPTION 'Backfill aborted: % season(s) with NULL-team matches have a NULL or deleted league_id. Resolve manually before re-running.', v_no_league_seasons;
  END IF;

  -- Orphan match_lineups rows (team_id IS NULL but no parent match exists).
  -- Should be impossible given the FK, but defensive against historical bugs.
  SELECT COUNT(*) INTO v_orphan_lineup_count
  FROM match_lineups ml
  LEFT JOIN matches m ON m.id = ml.match_id
  WHERE ml.team_id IS NULL AND m.id IS NULL;

  IF v_orphan_lineup_count > 0 THEN
    RAISE EXCEPTION 'Backfill aborted: % orphan match_lineups row(s) with NULL team_id and no parent match. Resolve manually before re-running.', v_orphan_lineup_count;
  END IF;

  -- All checks passed — report scope.
  SELECT COUNT(*) INTO v_total_affected
  FROM matches
  WHERE home_team_id IS NULL OR away_team_id IS NULL;

  SELECT COUNT(DISTINCT season_id) INTO v_affected_seasons
  FROM matches
  WHERE home_team_id IS NULL OR away_team_id IS NULL;

  RAISE NOTICE 'Backfill scope: % match(es) across % season(s) will be updated.',
    v_total_affected, v_affected_seasons;
END $$;

-- Step 1: INSERT one bye-team row per affected season.
-- Uses a CTE so we can capture the inserted UUIDs and use them in step 2.
WITH affected_seasons AS (
  SELECT DISTINCT m.season_id, l.id AS league_id, l.team_format
  FROM matches m
  JOIN seasons s ON s.id = m.season_id
  JOIN leagues l ON l.id = s.league_id
  WHERE m.home_team_id IS NULL OR m.away_team_id IS NULL
),
inserted_byes AS (
  INSERT INTO teams (season_id, league_id, captain_id, team_name, roster_size, status, home_venue_id)
  SELECT
    season_id,
    league_id,
    NULL,
    'BYE',
    -- roster_size derived from team_format ('5_man' -> 5, '8_man' -> 8)
    CASE WHEN team_format = '8_man' THEN 8 ELSE 5 END,
    'bye',
    NULL
  FROM affected_seasons
  RETURNING id, season_id
)
-- Step 2: UPDATE matches in two passes (home then away). The existing
-- trigger_sync_match_lineups_on_update propagates each team_id change to
-- match_lineups in-place; we don't touch match_lineups directly here.
UPDATE matches m
SET home_team_id = ib.id
FROM inserted_byes ib
WHERE m.season_id = ib.season_id
  AND m.home_team_id IS NULL;

-- Second pass for away_team_id (the CTE above is consumed by the first UPDATE,
-- so we re-derive the bye row from the season teams now that they exist).
UPDATE matches m
SET away_team_id = bye.id
FROM teams bye
WHERE bye.status = 'bye'
  AND bye.season_id = m.season_id
  AND m.away_team_id IS NULL;

-- Step 3: report final state.
DO $$
DECLARE
  v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM matches
  WHERE home_team_id IS NULL OR away_team_id IS NULL;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % match(es) still have NULL team_ids after migration.', v_remaining;
  END IF;

  RAISE NOTICE 'Backfill complete: 0 matches with NULL team_ids remain.';
END $$;

COMMIT;
