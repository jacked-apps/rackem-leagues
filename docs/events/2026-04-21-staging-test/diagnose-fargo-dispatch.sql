-- =====================================================================
-- Diagnose why staging match 44455346-f33f-4362-9f52-bcc1341b2c0c
-- went through the 3v3 games creator instead of 5v5.
--
-- Theory: the league's resolved_league_preferences.lineup_size is
-- returning 3 (default) instead of 5, because the preferences row for
-- the league was never created or was dropped.
--
-- Run this on STAGING. Read-only — nothing below mutates data.
-- =====================================================================

-- 1. What does the league look like, and what does the resolved view say?
--    This is the most important query. If lineup_size here is 3 (or the
--    row is missing entirely), that is the whole bug.
SELECT l.id             AS league_id,
       l.name           AS league_name,
       l.team_format,
       l.handicap_variant,
       rlp.lineup_size,
       rlp.handicap_type,
       rlp.game_generation
FROM matches m
JOIN leagues l ON m.season_id = l.season_id
LEFT JOIN resolved_league_preferences rlp ON rlp.league_id = l.id
WHERE m.id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 2. Do league-level and org-level preferences rows actually exist?
--    If league_pref_count = 0 AND org_pref_count = 0, the view falls
--    back to the hard-coded default of 3.
SELECT l.id AS league_id,
       l.organization_id,
       (SELECT COUNT(*) FROM preferences
         WHERE entity_type = 'league' AND entity_id = l.id) AS league_pref_count,
       (SELECT COUNT(*) FROM preferences
         WHERE entity_type = 'organization' AND entity_id = l.organization_id) AS org_pref_count
FROM matches m
JOIN leagues l ON m.season_id = l.season_id
WHERE m.id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 3. If a league preference row exists, what does it actually hold for
--    the lineup/scoring fields? (Shows NULLs if the row is partial.)
SELECT p.entity_type, p.entity_id,
       p.lineup_size,
       p.handicap_type,
       p.game_generation
FROM matches m
JOIN leagues l ON m.season_id = l.season_id
LEFT JOIN preferences p ON p.entity_type = 'league' AND p.entity_id = l.id
WHERE m.id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- 4. Count generated games for this match.
--    18 (or 9 per round) = double round robin, 3v3 dispatch hit.
--    25 = single round robin, 5v5 dispatch hit (correct for Fargo 5v5).
SELECT COUNT(*)                AS total_games,
       MAX(game_number)        AS max_game_number,
       COUNT(DISTINCT home_player_id) AS distinct_home_players,
       COUNT(DISTINCT away_player_id) AS distinct_away_players
FROM match_games
WHERE match_id = '44455346-f33f-4362-9f52-bcc1341b2c0c';

-- Interpretation:
--   Q1 lineup_size = 3  -> dispatched as 3v3. Confirms the theory.
--   Q1 lineup_size = 5  -> something else routed to 3v3; dig further.
--   Q2 both counts = 0  -> preferences row missing, view defaulted to 3.
--   Q2 league_pref_count > 0 but Q3 lineup_size is NULL -> row exists
--                                   but column is null; cascade to org/default.
--   Q4 total_games = 18 and distinct_*_players = 3 -> 3v3 dispatch confirmed
--                                                    at the games-creator level.
