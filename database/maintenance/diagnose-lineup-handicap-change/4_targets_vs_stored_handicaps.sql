-- READ-ONLY. Step 4 of 4 — THE PROOF.
--
-- Targets are computed from the lineup handicaps at match prep and SAVED on the
-- match row. The lineup row can be rewritten afterwards; the saved targets
-- cannot. So if the stored handicaps no longer explain the saved targets, the
-- lineup row was changed AFTER the match was prepped.
--
-- For Points 3-Man the two sides' totals drive the spread. Equal totals should
-- give symmetric targets (same to_win and to_tie on both sides).
--
--   symmetric targets + equal totals  -> consistent; no evidence of a change
--   asymmetric targets + equal totals -> the lineup row changed after prep

SELECT
  m.home_to_win, m.home_to_tie, m.home_to_lose,
  m.away_to_win, m.away_to_tie, m.away_to_lose,
  m.home_games_won, m.away_games_won,
  hl.player1_handicap + hl.player2_handicap + hl.player3_handicap
    + hl.player4_handicap + hl.player5_handicap            AS home_total_now,
  al.player1_handicap + al.player2_handicap + al.player3_handicap
    + al.player4_handicap + al.player5_handicap            AS away_total_now,
  hl.home_team_modifier,
  m.system_snapshot -> 'handicap_type'                     AS handicap_type,
  m.system_snapshot -> 'win_condition'                     AS win_condition,
  m.system_snapshot -> 'handicap_mechanism'                AS mechanism
FROM matches m
LEFT JOIN match_lineups hl ON hl.match_id = m.id AND hl.team_id = m.home_team_id
LEFT JOIN match_lineups al ON al.match_id = m.id AND al.team_id = m.away_team_id
WHERE m.id::text LIKE '92b799f2%';   -- <<< match id here
