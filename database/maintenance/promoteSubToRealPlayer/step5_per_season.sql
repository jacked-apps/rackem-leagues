-- ─────────────────────────────────────────────────────────────────
-- STEP 5 — HIS TOTALS PER SEASON  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- If a stats page shows a number STEP 4 says is wrong, the next question is
-- which season the page is actually scoped to. useTopShooters(seasonId) takes
-- the season from the route, so a page left on last season reports last
-- season's totals and looks stale when it is merely pointed elsewhere.
--
-- One row per season he has played, under the exact Top Shooters filter
-- (completed + both verifications + non-tiebreaker). Match the row whose
-- wins/losses equal what the page prints: that is the season it is showing.
WITH input AS (
  SELECT '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id
)
SELECT
  s.id          AS season_id,
  s.season_name,
  -- `leagues` has no name column; day + division is how a league identifies.
  l.day_of_week || COALESCE(' ' || l.division, '') AS league,
  count(*) FILTER (WHERE g.winner_player_id = i.member_id)  AS wins,
  count(*) FILTER (WHERE g.winner_player_id <> i.member_id) AS losses,
  count(*)                                                  AS games
  -- games with no winner yet are excluded in the WHERE below, matching the page
FROM match_games g
JOIN matches mm ON mm.id = g.match_id
JOIN seasons s  ON s.id  = mm.season_id
JOIN leagues l  ON l.id  = s.league_id
CROSS JOIN input i
WHERE i.member_id IN (g.home_player_id, g.away_player_id)
  AND mm.status = 'completed'
  AND mm.home_team_verified_by IS NOT NULL
  AND mm.away_team_verified_by IS NOT NULL
  AND g.is_tiebreaker = false
  AND g.winner_player_id IS NOT NULL
GROUP BY s.id, s.season_name, l.day_of_week, l.division
ORDER BY games DESC;

