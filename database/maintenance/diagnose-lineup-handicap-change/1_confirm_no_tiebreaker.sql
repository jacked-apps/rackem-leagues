-- READ-ONLY. Step 1 of 3 — confirm this match had no tiebreaker.
-- Expect tiebreaker_games = 0.

SELECT
  m.id,
  m.status,
  m.match_result,
  m.winner_team_id,
  m.home_games_won,
  m.away_games_won,
  m.completed_at,
  (SELECT count(*) FROM match_games g
     WHERE g.match_id = m.id AND g.is_tiebreaker) AS tiebreaker_games
FROM matches m
WHERE m.id::text LIKE '92b799f2%';   -- <<< match id here
