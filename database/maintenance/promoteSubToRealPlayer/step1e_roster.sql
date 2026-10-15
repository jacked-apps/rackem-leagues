-- ─────────────────────────────────────────────────────────────────
-- STEP 1e — WHO WAS ON THAT ROSTER?  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- The roster of the team that fielded the anonymous sub, for that match's
-- season. The player who actually showed up is almost certainly one of these
-- names — the three in the lineup played, so he is one of the others.
-- Edit p_team_name if you need the other side.
WITH input AS (
  SELECT
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid AS match_id,
    '%leftover%'          AS p_team_name
)
SELECT
  mem.id   AS member_id,
  mem.first_name || ' ' || mem.last_name AS name,
  mem.user_id,
  tp.status,
  tp.is_captain,
  mem.starting_handicap_3v3,
  -- TRUE for the three who are already in this match's lineup.
  EXISTS (
    SELECT 1 FROM match_lineups ml
    WHERE ml.match_id = i.match_id
      AND mem.id IN (ml.player1_id, ml.player2_id, ml.player3_id,
                     ml.player4_id, ml.player5_id)
  )        AS already_in_lineup
FROM team_players tp
JOIN teams   t   ON t.id   = tp.team_id
JOIN members mem ON mem.id = tp.member_id
JOIN matches mt  ON mt.id  = (SELECT match_id FROM input)
CROSS JOIN input i
WHERE t.team_name ILIKE i.p_team_name
  AND tp.season_id = mt.season_id
ORDER BY already_in_lineup, name;

