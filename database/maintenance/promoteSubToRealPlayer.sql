-- =============================================================================
-- promoteSubToRealPlayer.sql  —  DEVELOPER-ONLY retroactive sub correction
-- =============================================================================
--
-- @fileoverview One-off maintenance script for the case where a roster player
-- was entered into a lineup as an ANONYMOUS SUBSTITUTE, and then actually
-- showed up and played the match himself. The lineup slot holds a sub sentinel
-- UUID instead of his member id, so every game he played is credited to a
-- fictional placeholder and he gets no stats at all.
--
-- The real-world shape of this (the Oct 2026 Leftovers/Fluff makeup match):
-- the player wasn't sure he could make it, so the captains set the lineup with
-- an anonymous sub. He did make it, nobody knew how to swap a player mid-match,
-- so they played it out under the sub slot.
--
-- WHY THIS IS A RAW SQL SCRIPT (and not the in-app swap):
--   `swap_player_in_lineup` (20260602000001) is the in-app tool for this and it
--   will REFUSE this job, correctly. Two of its guards block a retroactive fix:
--     * the match must still be `in_progress` — this one is completed; and
--     * the outgoing player must have NO completed games — the sub played all
--       of them.
--   It also only cascades the new player into UNPLAYED games and never touches
--   `winner_player_id`, so even if the guards passed it would leave every win
--   credited to the sentinel. Do not reach for it here. Running this from the
--   SQL editor keeps the fix with a developer who can read the before-state.
--
-- WHEN YOU CAN USE THIS (the real requirements):
--   * The player ACTUALLY PLAYED the games now credited to the sentinel. This
--     is the whole premise — this script rewrites history to match reality, so
--     if he didn't play, you are fabricating results.
--   * He played AT THE SUB'S HANDICAP. See the handicap note below; if the
--     handicap was wrong too, this script is not enough on its own.
--   * He is NOT already in another slot of the same lineup. STEP 1's
--     `already_in_lineup` column detects it; the DO block also re-checks and
--     aborts, because one person cannot occupy two slots in one match.
--
-- WHAT IT CHANGES (exactly two tables):
--   1. match_lineups.playerN_id  — the sentinel's slot becomes his member id.
--   2. match_games.home_player_id / away_player_id  — his side only.
--   3. match_games.winner_player_id — every game the sentinel WON becomes his.
--      This is the column that actually matters: Top Shooters, My Stats, team
--      stats and Feats are all computed live from these three match_games
--      columns (see src/api/queries/playerStats.ts), and they DROP sentinel
--      rows outright. Fix these and every stats page corrects itself. There is
--      no stats table to backfill.
--
-- WHAT IT DELIBERATELY DOES NOT CHANGE:
--   * `match_lineups.playerN_handicap` — left exactly as entered. This script
--     assumes he played at the sub's handicap (the usual case when a captain
--     enters the absent player's own number). If the handicap was ALSO wrong,
--     stop: the handicap feeds `matches.home_to_win/_to_tie/_to_lose` + the
--     away set, and `home_to_tie` doubles as start-points credit in
--     start-points leagues, so a handicap change can move team points and in
--     the worst case flip `match_result` / `winner_team_id` and the standings.
--     That is a different, much larger fix — not this one.
--   * `game_confirmations` — an append-only audit log of what each scorekeeper
--     vouched for at the time, explicitly FK-free ("historical, must not mutate
--     on parent delete"). It is read only by useGameConfirmations for the
--     scoring/dispute UI, never by any stats query, so stale sentinel ids in it
--     are harmless on a completed match. Rewriting it would falsify the record
--     of what was actually confirmed.
--   * `team_players.individual_wins` / `individual_losses` — these columns
--     exist but are dead. Nothing in the scoring path has ever written them.
--   * `matches` — untouched, because the handicap is unchanged, so every
--     threshold and point total already computed is still correct.
--
-- THE CASE THIS IS FILLED IN FOR (Oct 2026). Both ids are already in every
-- step below; change them to reuse the script for someone else.
--   member_id  552891c9-47f9-4562-9007-75a3390351de   <- members.id, the PLAYER
--   auth uuid  bee0d3c8-a1c2-4168-95ea-eb027fbcfa30   <- members.user_id, his LOGIN
--   match_id   27d7bfe6-13c0-435c-bd28-dfe48a57a186   Leftovers (home) v Fluff
--                                                     3v3, week of 2026-10-04,
--                                                     played 2026-10-11
--   The anonymous sub sits at HOME position 3, handicap 2.0.
--
--   Note which id is which: lineups, games and stats all reference `members.id`.
--   The auth uuid appears nowhere except `members.user_id`, so it is useless for
--   this fix — STEP 1d converts one to the other if you only have the login id.
--
-- HOW TO USE (four steps):
--   0. Run STEP 0 to find the match id from the two team names + the date.
--   1. Paste the member id + match id into STEP 1 (read-only) and check:
--      sentinel_position IS NOT NULL, already_in_lineup IS NULL, and
--      games_as_sentinel / wins_as_sentinel look like the night he played.
--   2. Run STEP 2 with the same two ids. One transaction; any guard that fires
--      raises and rolls the whole thing back.
--   3. Run STEP 3 to confirm the sentinel is gone and he now holds the games.
--
-- NO UNDO: there is no archive row for this one (unlike the placeholder merge).
-- STEP 1 prints the before-state — keep that output until you have verified
-- STEP 3. Reverting means re-running the swap with the ids reversed by hand.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — FIND THE MATCH  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Edit the two team-name fragments (ILIKE, so partial names are fine) and the
-- date window. A makeup match is played off its scheduled week, so this looks
-- at started_at/completed_at as well as the week's scheduled_date.
WITH input AS (
  SELECT
    '%leftover%'   AS team_a,
    '%fluff%'      AS team_b,
    DATE '2026-10-04' AS played_on
)
SELECT
  m.id                AS match_id,
  ht.team_name        AS home_team,
  at.team_name        AS away_team,
  m.status,
  sw.scheduled_date   AS week_scheduled_date,
  m.started_at,
  m.completed_at,
  m.home_games_won,
  m.away_games_won,
  m.match_result
FROM matches m
JOIN teams ht        ON ht.id = m.home_team_id
JOIN teams at        ON at.id = m.away_team_id
JOIN season_weeks sw ON sw.id = m.season_week_id
CROSS JOIN input i
WHERE (
        (ht.team_name ILIKE i.team_a AND at.team_name ILIKE i.team_b)
     OR (ht.team_name ILIKE i.team_b AND at.team_name ILIKE i.team_a)
      )
  AND (
        sw.scheduled_date    = i.played_on
     OR m.started_at::date   = i.played_on
     OR m.completed_at::date = i.played_on
      )
ORDER BY m.completed_at NULLS LAST;


-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1c — WHERE IS HE ROSTERED?  (read-only; run if 1b showed all FALSE)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every roster row he has, with the season each one belongs to, next to the
-- season the match belongs to. If a team name here matches a team in the match
-- but the season_id differs, the roster row is on the wrong season.
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid                        AS match_id
)
SELECT
  (SELECT first_name || ' ' || last_name FROM members WHERE id = i.member_id)
                            AS player_name,
  t.team_name,
  tp.season_id              AS roster_season_id,
  (SELECT season_id FROM matches WHERE id = i.match_id)
                            AS match_season_id,
  tp.season_id = (SELECT season_id FROM matches WHERE id = i.match_id)
                            AS same_season,
  tp.status,
  tp.is_captain
FROM team_players tp
JOIN teams t ON t.id = tp.team_id
CROSS JOIN input i
WHERE tp.member_id = i.member_id
ORDER BY same_season DESC, t.team_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1d — IS THAT ID EVEN A MEMBER?  (read-only; run if 1c returned nothing)
-- ─────────────────────────────────────────────────────────────────────────────
-- An id with no roster row anywhere is usually not a `members.id` at all. The
-- two ids get confused constantly because the Auth dashboard and the app show
-- different ones for the same human:
--   * auth.users.id   — the LOGIN. What Supabase -> Authentication -> Users
--                       lists, and what you get from a session/JWT.
--   * members.id      — the PLAYER. What lineups, games and stats reference.
--     members.user_id is the link between them, and it is NULLABLE: a
--     placeholder player entered by a captain has no login at all.
--
-- This looks the id up both ways. `matched_on` tells you which it was:
--   'members.id'      -> it IS a member; he has simply never been rostered.
--   'members.user_id' -> you had the LOGIN id. Use the member_id column this
--                        returns for every other step in this file.
--   (no rows)         -> the id is neither; wrong id entirely.
WITH input AS (
  SELECT 'bee0d3c8-a1c2-4168-95ea-eb027fbcfa30'::uuid AS probe
)
SELECT 'members.id'      AS matched_on,
       m.id              AS member_id,
       m.user_id,
       m.first_name || ' ' || m.last_name AS name,
       m.email
FROM members m CROSS JOIN input i
WHERE m.id = i.probe
UNION ALL
SELECT 'members.user_id' AS matched_on,
       m.id              AS member_id,
       m.user_id,
       m.first_name || ' ' || m.last_name AS name,
       m.email
FROM members m CROSS JOIN input i
WHERE m.user_id = i.probe;


-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — PERFORM THE FIX  (one transaction; rolls back on any error)
-- ─────────────────────────────────────────────────────────────────────────────
-- Use the SAME two ids you previewed above.
DO $$
DECLARE
  v_member UUID := '552891c9-47f9-4562-9007-75a3390351de';  -- <-- real player
  v_match  UUID := '27d7bfe6-13c0-435c-bd28-dfe48a57a186';                         -- <-- from STEP 0

  v_lineup_id    UUID;
  v_team_id      UUID;
  v_is_home      BOOLEAN;
  v_season_id    UUID;
  v_sentinel     UUID;
  v_position     INT;
  v_sent_count   INT;
  v_dupe_pos     INT;
  v_side_col     TEXT;
  v_games        INT;
  v_wins         INT;
BEGIN
  -- Guard 1: the match exists. Lock it so a concurrent score edit can't race.
  SELECT season_id INTO v_season_id
  FROM matches WHERE id = v_match FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No match with id %', v_match;
  END IF;

  -- Guard 2: resolve HIS team in this match via the roster, and lock the
  -- lineup row. Scoping to his own team's lineup is what makes the game
  -- updates below safe when BOTH teams used an anonymous sub that night.
  SELECT ml.id, ml.team_id, (ml.team_id = m.home_team_id)
    INTO v_lineup_id, v_team_id, v_is_home
  FROM match_lineups ml
  JOIN matches m ON m.id = ml.match_id
  WHERE ml.match_id = v_match
    AND EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.team_id   = ml.team_id
        AND tp.season_id = v_season_id
        AND tp.member_id = v_member
    )
  FOR UPDATE OF ml;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Member % is not rostered on either team in match % — wrong member or wrong match',
      v_member, v_match;
  END IF;

  v_sentinel := CASE WHEN v_is_home
    THEN '00000000-0000-0000-0000-000000000001'::uuid   -- SUB_HOME_ANON_ID
    ELSE '00000000-0000-0000-0000-000000000002'::uuid   -- SUB_AWAY_ANON_ID
  END;
  v_side_col := CASE WHEN v_is_home THEN 'home_player_id' ELSE 'away_player_id' END;

  -- Guard 3: find the sentinel's slot. Zero slots = nothing to do (or already
  -- fixed); we refuse rather than silently no-op.
  --
  -- More than one slot is the dangerous case and it is REACHABLE: getAnonSubId()
  -- returns the same sentinel for every anonymous sub on a side, so a 5v5 team
  -- that fielded two anonymous subs has the identical uuid in two slots. There
  -- is then no way to tell from the data WHICH sub he was, and Writes 2+3 below
  -- cannot distinguish his games from the other sub's either. Refuse and let a
  -- developer fix it by hand with the position chosen explicitly.
  SELECT count(*) INTO v_sent_count
  FROM (
    SELECT player1_id AS pid FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT player2_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT player3_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT player4_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT player5_id FROM match_lineups WHERE id = v_lineup_id
  ) slots
  WHERE pid = v_sentinel;

  IF v_sent_count = 0 THEN
    RAISE EXCEPTION
      'No anonymous sub (%) in the % lineup for match % — nothing to promote (already fixed?)',
      v_sentinel, CASE WHEN v_is_home THEN 'home' ELSE 'away' END, v_match;
  END IF;

  IF v_sent_count > 1 THEN
    RAISE EXCEPTION
      'That % lineup has % anonymous-sub slots sharing sentinel % — ambiguous which one he was; fix by hand',
      CASE WHEN v_is_home THEN 'home' ELSE 'away' END, v_sent_count, v_sentinel;
  END IF;

  SELECT pos INTO v_position
  FROM (
    SELECT 1 AS pos, player1_id AS pid FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 2, player2_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 3, player3_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 4, player4_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 5, player5_id FROM match_lineups WHERE id = v_lineup_id
  ) slots
  WHERE pid = v_sentinel;

  -- Guard 4: he must not already hold a slot. One human cannot play two slots
  -- in one match; there is no DB constraint stopping it, so we check here.
  SELECT pos INTO v_dupe_pos
  FROM (
    SELECT 1 AS pos, player1_id AS pid FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 2, player2_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 3, player3_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 4, player4_id FROM match_lineups WHERE id = v_lineup_id
    UNION ALL SELECT 5, player5_id FROM match_lineups WHERE id = v_lineup_id
  ) slots
  WHERE pid = v_member;

  IF v_dupe_pos IS NOT NULL THEN
    RAISE EXCEPTION
      'Member % already occupies position % in this lineup — promoting the sub would enter him twice',
      v_member, v_dupe_pos;
  END IF;

  -- Write 1: the lineup slot. Handicap is left exactly as entered (see header).
  EXECUTE format(
    'UPDATE match_lineups SET %I = $1, updated_at = now() WHERE id = $2',
    'player' || v_position || '_id'
  ) USING v_member, v_lineup_id;

  -- Write 2: his side of every game the sentinel appeared in. Filtering on the
  -- side-specific sentinel id means the opposing team's sub is never touched.
  EXECUTE format(
    'UPDATE match_games SET %I = $1, updated_at = now()
       WHERE match_id = $2 AND %I = $3',
    v_side_col, v_side_col
  ) USING v_member, v_match, v_sentinel;
  GET DIAGNOSTICS v_games = ROW_COUNT;

  -- Write 3: the wins. This is the column every stats page reads.
  UPDATE match_games
  SET winner_player_id = v_member, updated_at = now()
  WHERE match_id = v_match AND winner_player_id = v_sentinel;
  GET DIAGNOSTICS v_wins = ROW_COUNT;

  RAISE NOTICE 'Promoted % into position % of the % lineup (team %).',
    v_member, v_position, CASE WHEN v_is_home THEN 'home' ELSE 'away' END, v_team_id;
  RAISE NOTICE 'Reassigned % game slot(s) and % win(s) from sentinel %.',
    v_games, v_wins, v_sentinel;
  RAISE NOTICE 'Untouched by design: lineup handicap, matches thresholds/points, game_confirmations.';
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — WHY ISN'T HE ON TOP SHOOTERS?  (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- A correct STEP 3 does not guarantee the stats pages show him, because
-- fetchSeasonPlayerStats (src/api/queries/playerStats.ts) counts a game only
-- when ALL of these hold on its match:
--     status = 'completed'
--     home_team_verified_by IS NOT NULL
--     away_team_verified_by IS NOT NULL
--     is_tiebreaker = false   (on the game)
-- An unverified match contributes nothing to Top Shooters for ANY player, so
-- the promotion can be perfect and still invisible. This reports both halves:
-- whether the match passes the filter, and what he totals under it.
WITH input AS (
  SELECT
    '552891c9-47f9-4562-9007-75a3390351de'::uuid AS member_id,
    '27d7bfe6-13c0-435c-bd28-dfe48a57a186'::uuid AS match_id
)
SELECT
  m.status,
  m.home_team_verified_by,
  m.away_team_verified_by,
  -- ALL FOUR must be true for this match to reach Top Shooters.
  (m.status = 'completed')                 AS ok_completed,
  (m.home_team_verified_by IS NOT NULL)    AS ok_home_verified,
  (m.away_team_verified_by IS NOT NULL)    AS ok_away_verified,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false) AS countable_games,
  -- His totals from THIS match under the exact Top Shooters filter.
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false
      AND i.member_id IN (g.home_player_id, g.away_player_id))  AS his_games_here,
  (SELECT count(*) FROM match_games g
    WHERE g.match_id = i.match_id AND g.is_tiebreaker = false
      AND g.winner_player_id = i.member_id)                     AS his_wins_here,
  -- His season-wide totals under the same filter — what the page should print.
  (SELECT count(*) FROM match_games g JOIN matches mm ON mm.id = g.match_id
    WHERE mm.season_id = m.season_id AND mm.status = 'completed'
      AND mm.home_team_verified_by IS NOT NULL
      AND mm.away_team_verified_by IS NOT NULL
      AND g.is_tiebreaker = false
      AND i.member_id IN (g.home_player_id, g.away_player_id))  AS his_season_games,
  (SELECT count(*) FROM match_games g JOIN matches mm ON mm.id = g.match_id
    WHERE mm.season_id = m.season_id AND mm.status = 'completed'
      AND mm.home_team_verified_by IS NOT NULL
      AND mm.away_team_verified_by IS NOT NULL
      AND g.is_tiebreaker = false
      AND g.winner_player_id = i.member_id)                     AS his_season_wins,
  m.season_id
FROM matches m CROSS JOIN input i
WHERE m.id = i.match_id;
