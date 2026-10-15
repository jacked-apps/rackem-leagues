-- ─────────────────────────────────────────────────────────────────
-- STEP 1 — READ-ONLY PREVIEW  (makes no changes; safe to run repeatedly)
-- ─────────────────────────────────────────────────────────────────────────────
-- Paste the member id and the match id from STEP 0, then inspect the one row.
--
--   (no rows at all)    he is not rostered on either team in that match —
--                       wrong member id or wrong match id.
--   sentinel_position   must be 1-5. NULL means no anonymous sub in his team's
--                       lineup — wrong match, or already fixed.
--   sentinel_slot_count must be 1. 2+ means the team fielded two anonymous
--                       subs sharing one sentinel; STEP 2 refuses that.
--   already_in_lineup   must be NULL. A position number here means he is
--                       ALREADY in the lineup and STEP 2 will abort.
--   games_as_sentinel   how many games the fix moves to him.
--   wins_as_sentinel    how many of those he won (his new W-L for the night).
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid                        AS match_id
),
-- His team in this match: the lineup row whose team he is rostered on.
lu AS (
  SELECT ml.*, (ml.team_id = m.home_team_id) AS is_home
  FROM match_lineups ml
  JOIN matches m ON m.id = ml.match_id
  CROSS JOIN input i
  WHERE ml.match_id = i.match_id
    AND EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.team_id   = ml.team_id
        AND tp.season_id = m.season_id
        AND tp.member_id = i.member_id
    )
),
-- The anonymous sentinel for that side: ...0001 home, ...0002 away.
sent AS (
  SELECT
    lu.*,
    CASE WHEN lu.is_home
      THEN '00000000-0000-0000-0000-000000000001'::uuid
      ELSE '00000000-0000-0000-0000-000000000002'::uuid
    END AS sentinel_id
  FROM lu
)
SELECT
  (SELECT first_name || ' ' || last_name FROM members, input
    WHERE members.id = input.member_id)                    AS player_name,
  (SELECT team_name FROM teams, sent WHERE teams.id = sent.team_id)
                                                           AS his_team,
  (SELECT CASE WHEN is_home THEN 'home' ELSE 'away' END FROM sent)
                                                           AS side,
  (SELECT status FROM matches, input WHERE matches.id = input.match_id)
                                                           AS match_status,
  s.sentinel_id,
  -- Which slot holds the sentinel (NULL if none -> nothing to fix).
  CASE
    WHEN s.player1_id = s.sentinel_id THEN 1
    WHEN s.player2_id = s.sentinel_id THEN 2
    WHEN s.player3_id = s.sentinel_id THEN 3
    WHEN s.player4_id = s.sentinel_id THEN 4
    WHEN s.player5_id = s.sentinel_id THEN 5
  END                                                      AS sentinel_position,
  -- MUST be 1. A 5v5 team that fielded TWO anonymous subs has the same
  -- sentinel in two slots; the data then cannot say which one he was, and
  -- STEP 2 will refuse.
  (CASE WHEN s.player1_id = s.sentinel_id THEN 1 ELSE 0 END
 + CASE WHEN s.player2_id = s.sentinel_id THEN 1 ELSE 0 END
 + CASE WHEN s.player3_id = s.sentinel_id THEN 1 ELSE 0 END
 + CASE WHEN s.player4_id = s.sentinel_id THEN 1 ELSE 0 END
 + CASE WHEN s.player5_id = s.sentinel_id THEN 1 ELSE 0 END)
                                                           AS sentinel_slot_count,
  -- The handicap recorded in that slot. Confirm this is HIS correct number;
  -- this script does not change it.
  CASE
    WHEN s.player1_id = s.sentinel_id THEN s.player1_handicap
    WHEN s.player2_id = s.sentinel_id THEN s.player2_handicap
    WHEN s.player3_id = s.sentinel_id THEN s.player3_handicap
    WHEN s.player4_id = s.sentinel_id THEN s.player4_handicap
    WHEN s.player5_id = s.sentinel_id THEN s.player5_handicap
  END                                                      AS sentinel_handicap,
  -- MUST be NULL. Non-null = he already occupies a slot; swap would duplicate.
  CASE
    WHEN s.player1_id = i.member_id THEN 1
    WHEN s.player2_id = i.member_id THEN 2
    WHEN s.player3_id = i.member_id THEN 3
    WHEN s.player4_id = i.member_id THEN 4
    WHEN s.player5_id = i.member_id THEN 5
  END                                                      AS already_in_lineup,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id
      AND (CASE WHEN s.is_home THEN g.home_player_id ELSE g.away_player_id END)
          = s.sentinel_id)                                 AS games_as_sentinel,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id
      AND g.winner_player_id = s.sentinel_id)              AS wins_as_sentinel
FROM sent s CROSS JOIN input i;

