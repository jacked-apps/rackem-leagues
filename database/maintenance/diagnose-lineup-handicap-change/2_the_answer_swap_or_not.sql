-- READ-ONLY. Step 2 of 3 — THE ANSWER.
-- Both lineup rows with their swap audit trail. Read the `verdict` column:
--   'SWAP (legitimate)' -> went through swap_player_in_lineup. Nothing to chase.
--   'NO SWAP RECORDED'  -> untracked edit. No record of who or when.

SELECT
  CASE WHEN l.team_id = m.home_team_id THEN 'HOME' ELSE 'AWAY' END AS side,
  t.team_name,
  l.locked,
  l.locked_at,
  l.home_team_modifier,
  l.player1_handicap, l.player2_handicap, l.player3_handicap,
  l.player4_handicap, l.player5_handicap,
  l.swap_requested_by_member_id,
  l.swap_last_resolution,
  CASE
    WHEN l.swap_last_resolution IS NOT NULL THEN 'SWAP (legitimate)'
    ELSE 'NO SWAP RECORDED'
  END AS verdict
FROM match_lineups l
JOIN matches m ON m.id = l.match_id
LEFT JOIN teams t ON t.id = l.team_id
WHERE m.id::text LIKE '92b799f2%'    -- <<< match id here
ORDER BY side;
