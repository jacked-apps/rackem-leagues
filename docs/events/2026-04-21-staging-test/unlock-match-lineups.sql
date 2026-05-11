-- =====================================================================
-- Unlock both lineups for match 44455346-f33f-4362-9f52-bcc1341b2c0c
-- Purpose: captains need to re-open lineup editing after a bad device
-- handoff; players stay exactly as selected, we just flip the lock off.
-- Run this in the Supabase SQL editor on STAGING only.
-- =====================================================================

-- 1. Inspect current state before changing anything.
SELECT id, team_id, locked, locked_at,
       player1_id, player2_id, player3_id, player4_id, player5_id
FROM match_lineups
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 2. Check if any games have already been auto-created for this match.
--    If game_count > 0 but played_count = 0, nothing has been played yet
--    and the games can be deleted safely. If played_count > 0, stop and
--    vacate/rescore those games via the app instead of nuking them here.
SELECT COUNT(*)                         AS game_count,
       COUNT(winner_team_id)            AS played_count
FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 3. Check Fargo confirm state (harmless no-op on non-Fargo matches).
SELECT id, fargo_start_points,
       fargo_start_points_confirmed_by_home,
       fargo_start_points_confirmed_by_away
FROM matches
WHERE id = '44455346-f33f-4362-9f52-bcc1341b2c0c';


-- ---------------------------------------------------------------------
-- Run the section below only after reviewing the SELECTs above.
-- ---------------------------------------------------------------------

BEGIN;

-- 4. Unlock both lineups (home + away) — players are preserved.
UPDATE match_lineups
SET locked = false,
    locked_at = NULL
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 5. Clear Fargo start-points confirms so the negotiation flow restarts.
--    No effect on non-Fargo matches.
UPDATE matches
SET fargo_start_points_confirmed_by_home = NULL,
    fargo_start_points_confirmed_by_away = NULL
WHERE id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 6. If match prep already created unplayed games, wipe them so prep
--    can re-run when the lineups lock again. Uncomment if query #2
--    returned game_count > 0 AND played_count = 0.
-- DELETE FROM match_games
-- WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c'
--   AND winner_team_id IS NULL;

COMMIT;

-- 7. Re-verify.
SELECT id, team_id, locked, locked_at
FROM match_lineups
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';
