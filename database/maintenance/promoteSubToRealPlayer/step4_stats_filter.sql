-- ─────────────────────────────────────────────────────────────────
-- STEP 4 — WHY ISN'T HE ON TOP SHOOTERS?  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- A correct STEP 3 does not guarantee the stats pages show him, because
-- fetchSeasonPlayerStats (src/api/queries/playerStats.ts) counts a game only
-- when ALL of these hold on its match:
--     status = 'completed'
--     home_team_verified_by IS NOT NULL
--     away_team_verified_by IS NOT NULL
--     is_tiebreaker = false   (on the game)
-- An unverified match contributes nothing to Top Shooters for ANY player, so
-- the promotion can be perfect and still invisible. This reports both halves:
-- whether the match passes the filter, and what he totals under it.
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid AS match_id
)
SELECT
  m.status,
  m.home_team_verified_by,
  m.away_team_verified_by,
  -- ALL FOUR must be true for this match to reach Top Shooters.
  (m.status = 'completed')                 AS ok_completed,
  (m.home_team_verified_by IS NOT NULL)    AS ok_home_verified,
  (m.away_team_verified_by IS NOT NULL)    AS ok_away_verified,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false) AS countable_games,
  -- His totals from THIS match under the exact Top Shooters filter.
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false
      AND i.member_id IN (g.home_player_id, g.away_player_id))  AS his_games_here,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false
      AND g.winner_player_id = i.member_id)                     AS his_wins_here,
  -- His season-wide totals under the same filter — what the page should print.
  (SELECT count(*) FROM match_games g JOIN matches mm ON mm.id = g.match_id
    WHERE mm.season_id = m.season_id AND mm.status = 'completed'
      AND mm.home_team_verified_by IS NOT NULL
      AND mm.away_team_verified_by IS NOT NULL
      AND g.is_tiebreaker = false
      -- fetchSeasonPlayerStats skips games with no winner; match that or this
      -- count runs ahead of what the page prints for games played.
      AND g.winner_player_id IS NOT NULL
      AND i.member_id IN (g.home_player_id, g.away_player_id))  AS his_season_games,
  (SELECT count(*) FROM match_games g JOIN matches mm ON mm.id = g.match_id
    WHERE mm.season_id = m.season_id AND mm.status = 'completed'
      AND mm.home_team_verified_by IS NOT NULL
      AND mm.away_team_verified_by IS NOT NULL
      AND g.is_tiebreaker = false
      AND g.winner_player_id = i.member_id)                     AS his_season_wins,
  m.season_id
FROM matches m CROSS JOIN input i
WHERE m.id = i.match_id;

