-- ============================================================================
-- DEV-ONLY: play out the seeded schedule so results pages have something to show
-- ============================================================================
--
-- ⚠️  NEVER RUN THIS AGAINST PRODUCTION OR STAGING. It invents match results.
--     It refuses to run unless the dev fixture organization is present, but
--     treat that as a seatbelt, not a licence — check which database you are
--     connected to first.
--
-- WHY THIS EXISTS
--
-- The dev bootstraps build leagues, teams, rosters and a full schedule, but
-- every match stays `scheduled` with empty lineups and no games. That is the
-- right starting point for testing the "season begins" flows and useless for
-- anything that reads RESULTS — standings, top shooters, feats, and now My
-- Stats, which otherwise shows "No games yet" on a freshly seeded database.
--
-- WHAT IT PRODUCES
--
--   - Every unplayed match completed, with a venue and a table number.
--   - Lineups filled from each team's real roster, with handicaps in the range
--     that league's system actually uses (points -2..+2, percentage 30..80,
--     fargo 350..750) — so filtering by system shows believable numbers rather
--     than one shared scale.
--   - A game per lineup pairing, with a winner and occasionally a notable
--     ending: break & run, golden break, runout, early 8, forfeit.
--   - Two game types across the leagues (8-ball, and 9-ball for the Fargo one)
--     so game-type filters have something to do.
--   - `dev@test.com` added to one team per league, so the dev login has a
--     personal record spanning several leagues and both game types.
--
-- Everything is DETERMINISTIC — results derive from row ids via md5 — so
-- re-running gives identical results and screenshots stay stable. Nothing here
-- is random, and nothing here is real.
--
-- SAFE TO RE-RUN: matches that already have games are skipped.
--
-- USAGE
--   psql "$DATABASE_URL" -f database/dev_play_matches.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers. Created here, dropped at the bottom — this script leaves nothing
-- behind in the schema.
-- ---------------------------------------------------------------------------

-- A stable non-negative number from any string. bit(28) keeps it inside int
-- range and away from the sign bit, so `%` never yields a negative.
CREATE OR REPLACE FUNCTION dev_hash(seed text)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT ('x' || substr(md5(seed), 1, 7))::bit(28)::int;
$$;

-- A plausible handicap for this player under this league's system.
CREATE OR REPLACE FUNCTION dev_handicap(member uuid, system text)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE system
    WHEN 'points'     THEN (dev_hash(member::text) % 5) - 2          -- -2 .. +2
    WHEN 'percentage' THEN 30 + (dev_hash(member::text) % 51)        -- 30 .. 80
    WHEN 'fargo'      THEN 350 + (dev_hash(member::text) % 401)      -- 350 .. 750
    ELSE 0
  END::numeric;
$$;

DO $$
DECLARE
  v_dev_member  uuid;
  v_match       record;
  v_home        uuid[];
  v_away        uuid[];
  v_size        int;
  v_system      text;
  v_game_type   text;
  v_games       int;
  v_n           int;
  v_slot_h      int;
  v_slot_a      int;
  v_hp          uuid;
  v_ap          uuid;
  v_home_breaks boolean;
  v_winner_home boolean;
  v_roll        int;
  v_br boolean; v_gb boolean; v_ro boolean; v_e8 boolean; v_ff boolean;
  v_played  int := 0;
  v_skipped int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE organization_name IN ('Tester Org', 'Dev Test Leagues')
  ) THEN
    RAISE EXCEPTION
      'Dev fixture organization not found. This script invents match results and must never run against real data.';
  END IF;

  SELECT id INTO v_dev_member FROM members WHERE email = 'dev@test.com';

  -- A second venue, so venue filters have more than one option.
  IF NOT EXISTS (SELECT 1 FROM venues WHERE name = 'Corner Pocket Tavern') THEN
    INSERT INTO venues (organization_id, name, street_address, city, state, zip_code, phone, bar_box_tables, bar_box_table_numbers)
    SELECT id, 'Corner Pocket Tavern', '88 Second St', 'Testville', 'TX', '00000', '5550000000', 4, ARRAY[1,2,3,4]
    FROM organizations
    WHERE organization_name IN ('Tester Org', 'Dev Test Leagues')
    LIMIT 1;
  END IF;

  -- Put the dev login on one team per league, so /stats has a real subject
  -- whose record spans several leagues and both game types.
  IF v_dev_member IS NOT NULL THEN
    INSERT INTO team_players (team_id, member_id, season_id, is_captain, status)
    SELECT picked.id, v_dev_member, picked.season_id, false, 'active'
    FROM (
      SELECT DISTINCT ON (s.league_id) t.id, t.season_id
      FROM teams t
      JOIN seasons s ON s.id = t.season_id
      ORDER BY s.league_id, t.id
    ) picked
    WHERE NOT EXISTS (
      SELECT 1 FROM team_players tp
      WHERE tp.team_id = picked.id AND tp.member_id = v_dev_member
    );
  END IF;

  FOR v_match IN
    SELECT m.id, m.home_team_id, m.away_team_id, m.scheduled_venue_id,
           COALESCE(p.lineup_size, 5)                        AS lineup_size,
           COALESCE(p.handicap_type, 'none')                 AS handicap_type,
           COALESCE(p.game_generation, 'single_round_robin') AS generation
    FROM matches m
    JOIN seasons s ON s.id = m.season_id
    LEFT JOIN resolved_league_preferences p ON p.league_id = s.league_id
    WHERE m.home_team_id IS NOT NULL
      AND m.away_team_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM match_games g WHERE g.match_id = m.id)
    ORDER BY m.id
  LOOP
    v_size   := v_match.lineup_size;
    v_system := v_match.handicap_type;
    v_game_type := CASE WHEN v_system = 'fargo' THEN 'nine_ball' ELSE 'eight_ball' END;

    -- Dev member first so they always make the lineup rather than riding the
    -- bench in a fixture built to show off their own stats page.
    SELECT array_agg(member_id ORDER BY (member_id = v_dev_member) DESC, member_id)
      INTO v_home FROM team_players WHERE team_id = v_match.home_team_id;
    SELECT array_agg(member_id ORDER BY (member_id = v_dev_member) DESC, member_id)
      INTO v_away FROM team_players WHERE team_id = v_match.away_team_id;

    IF v_home IS NULL OR v_away IS NULL
       OR array_length(v_home, 1) < v_size OR array_length(v_away, 1) < v_size THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Lineups. Slots beyond this league's size stay null.
    INSERT INTO match_lineups (
      match_id, team_id, locked,
      player1_id, player1_handicap, player2_id, player2_handicap,
      player3_id, player3_handicap, player4_id, player4_handicap,
      player5_id, player5_handicap
    )
    SELECT v_match.id, side.team_id, true,
           side.p[1], dev_handicap(side.p[1], v_system),
           side.p[2], dev_handicap(side.p[2], v_system),
           side.p[3], dev_handicap(side.p[3], v_system),
           CASE WHEN v_size >= 4 THEN side.p[4] END,
           CASE WHEN v_size >= 4 THEN dev_handicap(side.p[4], v_system) END,
           CASE WHEN v_size >= 5 THEN side.p[5] END,
           CASE WHEN v_size >= 5 THEN dev_handicap(side.p[5], v_system) END
    FROM (VALUES (v_match.home_team_id, v_home), (v_match.away_team_id, v_away))
         AS side(team_id, p)
    -- UPDATE on conflict, not DO NOTHING: the bootstraps already create an
    -- EMPTY lineup row per match/team. Skipping those would leave every player
    -- slot and handicap null, so games would exist with no handicaps attached
    -- to anyone — which reads as "handicap not recorded" everywhere and gives
    -- handicap filters nothing to work with.
    ON CONFLICT (match_id, team_id) DO UPDATE SET
      locked = true,
      player1_id = EXCLUDED.player1_id, player1_handicap = EXCLUDED.player1_handicap,
      player2_id = EXCLUDED.player2_id, player2_handicap = EXCLUDED.player2_handicap,
      player3_id = EXCLUDED.player3_id, player3_handicap = EXCLUDED.player3_handicap,
      player4_id = EXCLUDED.player4_id, player4_handicap = EXCLUDED.player4_handicap,
      player5_id = EXCLUDED.player5_id, player5_handicap = EXCLUDED.player5_handicap;

    v_games := CASE WHEN v_match.generation = 'double_round_robin'
                    THEN v_size * v_size * 2 ELSE v_size * v_size END;

    FOR v_n IN 1 .. v_games LOOP
      v_slot_h := ((v_n - 1) / v_size) % v_size + 1;
      v_slot_a := ((v_n - 1) % v_size) + 1;
      v_hp := v_home[v_slot_h];
      v_ap := v_away[v_slot_a];

      v_winner_home := (dev_hash(v_match.id::text || ':w:' || v_n) % 100) < 50;
      v_home_breaks := (v_n % 2) = 1;
      v_roll        := dev_hash(v_match.id::text || ':e:' || v_n) % 100;

      -- At most one ending: they are rival accounts of the same game, and the
      -- CHECK constraint rejects an early 8 alongside any achievement.
      v_ff := v_roll >= 98;
      v_e8 := NOT v_ff AND v_roll < 4 AND v_game_type = 'eight_ball';
      v_br := NOT v_ff AND v_roll >= 4  AND v_roll < 12;
      v_gb := NOT v_ff AND v_roll >= 12 AND v_roll < 15;
      v_ro := NOT v_ff AND v_roll >= 15 AND v_roll < 21;

      INSERT INTO match_games (
        match_id, game_number, game_type,
        home_player_id, away_player_id, home_position, away_position,
        home_action, away_action,
        winner_team_id, winner_player_id,
        break_and_run, golden_break, runout, early_eight,
        break_fouled, win_by_forfeit,
        is_tiebreaker, confirmed_by_home, confirmed_by_away
      ) VALUES (
        v_match.id, v_n, v_game_type,
        v_hp, v_ap, v_slot_h, v_slot_a,
        CASE WHEN v_home_breaks THEN 'breaks' ELSE 'racks' END,
        CASE WHEN v_home_breaks THEN 'racks'  ELSE 'breaks' END,
        CASE WHEN v_winner_home THEN v_match.home_team_id ELSE v_match.away_team_id END,
        CASE WHEN v_winner_home THEN v_hp ELSE v_ap END,
        v_br, v_gb, v_ro, v_e8,
        false, v_ff,
        -- Both sides confirmed: these are finished games in a fixture, and a
        -- pending confirmation would put every one of them into a dispute UI.
        false, v_hp, v_ap
      );
    END LOOP;

    UPDATE matches
       SET status = 'completed',
           completed_at = now(),
           actual_venue_id = COALESCE(
             scheduled_venue_id,
             (SELECT id FROM venues ORDER BY name LIMIT 1)
           ),
           -- Spread across tables so table filters have options.
           assigned_table_number = 1 + (dev_hash(id::text || ':table') % 4)
     WHERE id = v_match.id;

    v_played := v_played + 1;
  END LOOP;

  RAISE NOTICE 'dev_play_matches: played % matches, skipped % (roster smaller than lineup)',
    v_played, v_skipped;
END $$;

DROP FUNCTION IF EXISTS dev_handicap(uuid, text);
DROP FUNCTION IF EXISTS dev_hash(text);
