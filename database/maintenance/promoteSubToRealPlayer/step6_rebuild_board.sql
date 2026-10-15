-- ─────────────────────────────────────────────────────────────────
-- STEP 6 — REBUILD THE TOP SHOOTERS BOARD  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- When the DB says one number and the page prints another with caching already
-- ruled out, stop comparing one player and rebuild the whole board. This is
-- fetchSeasonPlayerStats transcribed to SQL: same filters, same per-player
-- tally, sentinels dropped at the end.
--
-- Then read the page next to this. Two things it catches that a single-player
-- query cannot:
--   * the same human appearing TWICE under two member ids (a duplicate signup
--     — see mergeRegisteredPlayers.sql). The board would list both, and the
--     row you happen to read may not be the one that got fixed.
--   * a name whose totals match the page while another row holds the games.
WITH input AS (
  SELECT 'de71a764-2628-4ba3-81d7-bb42983f07cd'::uuid AS season_id
),
-- Every countable game in the season, flattened to one row per participant.
part AS (
  SELECT g.home_player_id AS pid, (g.winner_player_id = g.home_player_id) AS won
  FROM match_games g JOIN matches mm ON mm.id = g.match_id CROSS JOIN input i
  WHERE mm.season_id = i.season_id
    AND mm.status = 'completed'
    AND mm.home_team_verified_by IS NOT NULL
    AND mm.away_team_verified_by IS NOT NULL
    AND g.is_tiebreaker = false
    AND g.winner_player_id IS NOT NULL
    AND g.home_player_id IS NOT NULL
  UNION ALL
  SELECT g.away_player_id AS pid, (g.winner_player_id = g.away_player_id) AS won
  FROM match_games g JOIN matches mm ON mm.id = g.match_id CROSS JOIN input i
  WHERE mm.season_id = i.season_id
    AND mm.status = 'completed'
    AND mm.home_team_verified_by IS NOT NULL
    AND mm.away_team_verified_by IS NOT NULL
    AND g.is_tiebreaker = false
    AND g.winner_player_id IS NOT NULL
    AND g.away_player_id IS NOT NULL
)
SELECT
  mem.first_name || ' ' || mem.last_name AS player_name,
  p.pid                                  AS member_id,
  count(*) FILTER (WHERE p.won)          AS wins,
  count(*) FILTER (WHERE NOT p.won)      AS losses,
  count(*)                               AS games,
  count(*) FILTER (WHERE p.won) - count(*) FILTER (WHERE NOT p.won) AS plus_minus,
  round(100.0 * count(*) FILTER (WHERE p.won) / count(*), 1)        AS win_pct
FROM part p
LEFT JOIN members mem ON mem.id = p.pid
-- The four sub sentinels are fictional; the page deletes them from the board.
WHERE p.pid NOT IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000011'::uuid,
  '00000000-0000-0000-0000-000000000012'::uuid
)
GROUP BY mem.first_name, mem.last_name, p.pid
ORDER BY plus_minus DESC, wins DESC;
