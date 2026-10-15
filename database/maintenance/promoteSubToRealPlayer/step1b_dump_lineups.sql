-- ─────────────────────────────────────────────────────────────────
-- STEP 1b — DIAGNOSE AN EMPTY STEP 1  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 resolves his team by looking him up in `team_players` for the match's
-- season. If STEP 1 came back with NO ROWS, that lookup failed and the reason
-- is one of:
--   * he isn't on either team's roster for that season (a genuine outside sub,
--     or his roster row carries a different season_id);
--   * he plays under a DIFFERENT member id than the one we have (duplicate
--     signup — see mergeRegisteredPlayers.sql);
--   * the lineups for this match were never filled in.
--
-- This dumps both lineups slot by slot with no roster assumption at all, so you
-- can see what is actually in them. Expect 10 rows (5 per team).
--
--   who                    resolved name, or a '** ANON SUB **' marker
--   is_our_guy             TRUE on the slot he already holds, if any
--   he_is_rostered_here    FALSE on both teams = the roster lookup is why
--                          STEP 1 was empty
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid                        AS match_id
)
SELECT
  CASE WHEN ml.team_id = mt.home_team_id THEN 'HOME' ELSE 'AWAY' END AS side,
  t.team_name,
  s.pos        AS position,
  s.pid        AS player_id,
  COALESCE(
    mem.first_name || ' ' || mem.last_name,
    CASE s.pid
      WHEN '00000000-0000-0000-0000-000000000001'::uuid THEN '** ANON SUB (home) **'
      WHEN '00000000-0000-0000-0000-000000000002'::uuid THEN '** ANON SUB (away) **'
      WHEN '00000000-0000-0000-0000-000000000011'::uuid THEN '** DOUBLE-DUTY (home) **'
      WHEN '00000000-0000-0000-0000-000000000012'::uuid THEN '** DOUBLE-DUTY (away) **'
    END,
    '(empty slot)'
  )            AS who,
  s.hcp        AS handicap,
  (s.pid = i.member_id) AS is_our_guy,
  EXISTS (
    SELECT 1 FROM team_players tp
    WHERE tp.team_id   = ml.team_id
      AND tp.season_id = mt.season_id
      AND tp.member_id = i.member_id
  )            AS he_is_rostered_here
FROM match_lineups ml
JOIN matches mt ON mt.id = ml.match_id
JOIN teams   t  ON t.id  = ml.team_id
CROSS JOIN input i
CROSS JOIN LATERAL (VALUES
  (1, ml.player1_id, ml.player1_handicap),
  (2, ml.player2_id, ml.player2_handicap),
  (3, ml.player3_id, ml.player3_handicap),
  (4, ml.player4_id, ml.player4_handicap),
  (5, ml.player5_id, ml.player5_handicap)
) AS s(pos, pid, hcp)
LEFT JOIN members mem ON mem.id = s.pid
WHERE ml.match_id = i.match_id
ORDER BY side DESC, s.pos;

