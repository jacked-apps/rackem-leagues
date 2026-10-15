-- ─────────────────────────────────────────────────────────────────
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

