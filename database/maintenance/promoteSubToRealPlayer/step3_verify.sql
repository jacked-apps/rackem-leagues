-- ─────────────────────────────────────────────────────────────────
-- STEP 3 — VERIFY  (read-only; run after STEP 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: his name on every game row that used to be the sentinel, and zero
-- remaining sentinel references anywhere in match_games for this match.
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid                        AS match_id
)
SELECT
  g.game_number,
  hm.first_name || ' ' || hm.last_name AS home_player,
  am.first_name || ' ' || am.last_name AS away_player,
  wm.first_name || ' ' || wm.last_name AS winner,
  -- Must be FALSE on every row.
  (g.home_player_id   IN ('00000000-0000-0000-0000-000000000001'::uuid,
                          '00000000-0000-0000-0000-000000000002'::uuid)
   OR g.away_player_id IN ('00000000-0000-0000-0000-000000000001'::uuid,
                          '00000000-0000-0000-0000-000000000002'::uuid)
   OR g.winner_player_id IN ('00000000-0000-0000-0000-000000000001'::uuid,
                          '00000000-0000-0000-0000-000000000002'::uuid)
  ) AS still_has_sentinel
FROM match_games g
CROSS JOIN input i
LEFT JOIN members hm ON hm.id = g.home_player_id
LEFT JOIN members am ON am.id = g.away_player_id
LEFT JOIN members wm ON wm.id = g.winner_player_id
WHERE g.match_id = i.match_id
ORDER BY g.game_number;

