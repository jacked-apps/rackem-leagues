-- READ-ONLY. Step 3 of 3 — cross-check.
-- A swap shows one player replaced partway through the game list. A hand-edit
-- shows the same players throughout, with the lineup row carrying different
-- handicap numbers than the match was actually scored at.

SELECT
  g.game_number,
  g.is_tiebreaker,
  hp.nickname AS home_player,
  ap.nickname AS away_player,
  g.winner_team_id,
  g.winner_player_id
FROM match_games g
JOIN matches m ON m.id = g.match_id
LEFT JOIN members hp ON hp.id = g.home_player_id
LEFT JOIN members ap ON ap.id = g.away_player_id
WHERE m.id::text LIKE '92b799f2%'    -- <<< match id here
ORDER BY g.game_number;
