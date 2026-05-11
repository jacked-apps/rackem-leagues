-- =====================================================================
-- RESET match 44455346-f33f-4362-9f52-bcc1341b2c0c
-- Purpose: the beta handoff / double-duty flow failed mid-setup, leaving
-- the match in a bad state (wrong format inferred, wrong games created,
-- Fargo start-points calculated against the wrong game set). This script
-- wipes the generated games and unlocks both lineups so the captains can
-- re-submit cleanly.
--
-- Players on each lineup are PRESERVED. Only the lock flags and the
-- auto-generated match_games rows are cleared.
--
-- RUN IN SUPABASE SQL EDITOR ON STAGING ONLY.
-- Review every SELECT before executing the BEGIN...COMMIT block.
-- =====================================================================

-- 1. Current lineup lock state + rostered players.
SELECT id, team_id, locked, locked_at,
       player1_id, player2_id, player3_id, player4_id, player5_id
FROM match_lineups
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 2. Game counts. Review these before proceeding.
--    - game_count:   how many match_games rows exist
--    - played_count: how many have a winner_team_id populated
--    If played_count > 0, this script will still delete them because you
--    asked for a hard reset — but pause and confirm that's what you want.
--    The production path for edits to played games is vacate-and-rescore
--    via the app, NOT row deletion. This is a staging-specific shortcut.
SELECT COUNT(*)                      AS game_count,
       COUNT(winner_team_id)         AS played_count
FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 3. Fargo negotiation state (harmless to clear on non-Fargo matches).
SELECT id, fargo_start_points,
       fargo_start_points_confirmed_by_home,
       fargo_start_points_confirmed_by_away
FROM matches
WHERE id = '44455346-f33f-4362-9f52-bcc1341b2c0c';


-- ---------------------------------------------------------------------
-- Only run the block below after the SELECTs above look right.
-- ---------------------------------------------------------------------

BEGIN;

-- 4. Delete every game attached to this match so the lock-and-generate
--    flow can re-create them from scratch against the corrected lineup.
DELETE FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 5. Unlock both lineups. Players stay exactly as selected; only the lock
--    flag and timestamp are cleared.
UPDATE match_lineups
SET locked = false,
    locked_at = NULL
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 6. Clear Fargo start-points negotiation so the flow restarts when the
--    new lineups lock. No effect on non-Fargo matches.
UPDATE matches
SET fargo_start_points = NULL,
    fargo_start_points_confirmed_by_home = NULL,
    fargo_start_points_confirmed_by_away = NULL
WHERE id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

COMMIT;


-- ---------------------------------------------------------------------
-- Post-commit verification — should show 0 games, locked = false on
-- both lineups, and NULL Fargo confirms.
-- ---------------------------------------------------------------------

SELECT COUNT(*) AS remaining_games
FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

SELECT id, team_id, locked, locked_at
FROM match_lineups
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

SELECT id, fargo_start_points,
       fargo_start_points_confirmed_by_home,
       fargo_start_points_confirmed_by_away
FROM matches
WHERE id = '44455346-f33f-4362-9f52-bcc1341b2c0c';
