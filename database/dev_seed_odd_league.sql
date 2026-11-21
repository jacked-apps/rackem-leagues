-- ============================================================================
-- DEV SEED: 7-team league, NO schedule yet (for testing odd-league drops)
-- ============================================================================
--
-- DEV ONLY. Never run against staging or production (the guard below refuses
-- any database not named "postgres", the local Supabase default).
--
-- What you get, in "Tester Org" (log in as dev@test.com / password):
--   * League "7-team drop test" (8-Ball), starting one week from today
--   * Season: 16 regular weeks + Season End Break + Playoffs, status upcoming
--   * 7 active teams with captains + 4 placeholder players each
--       Teams 1-4 captained by the 4 dev logins (cap1, cap3, dev, cap2)
--       Teams 5-7 captained by placeholder members
--   * Two venues so you can SEE "venue follows the home team":
--       Teams 1-4 home = Sams's Billiards, Teams 5-7 home = Corner Pocket
--   * NO matches. Generate the schedule in the app (league page →
--     schedule setup). The app adds the BYE itself for 7 teams.
--
-- Needs: database/dev_starting_point.sql already run (Tester Org, the 4
-- logins, the placeholder pool and Sams's Billiards).
--
-- Re-runnable: it deletes and rebuilds ONLY this league (fixed ids
-- 0c0c0c0c-...-4444-...), so your other dev leagues are untouched.
--
-- Test plan this supports (Ed, 2026-11-21):
--   1. generate schedule → drop a team before any week is played
--   2. add a team back → regenerate → (BYE again?)
--   3. play a few weeks by hand → drop again
--   Review the Schedule page after each step.
--
-- To run: Supabase Studio (http://localhost:54323) → SQL Editor → paste → Run
-- ============================================================================

DO $$
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Refusing to run: database is "%", expected "postgres" (local Supabase). Dev only.',
      current_database();
  END IF;
END $$;

DO $$
DECLARE
  v_org_id     UUID := '01010101-cccc-cccc-cccc-010101010101';
  v_league_id  UUID := '0c0c0c0c-1111-4444-4444-0c0c0c0c0c0c';
  v_season_id  UUID := '0c0c0c0c-2222-4444-4444-0c0c0c0c0c0c';
  v_sams_id    UUID := '0c0c0c0c-3333-3333-3333-0c0c0c0c0c0c';  -- from dev_starting_point
  v_corner_id  UUID := '0c0c0c0c-3333-4444-4444-0c0c0c0c0c0c';
  v_start      DATE := CURRENT_DATE + 7;  -- nothing is "past due" yet
  v_captains   UUID[] := ARRAY[
    'c1c1c1c1-bbbb-bbbb-bbbb-c1c1c1c1c1c1'::uuid,  -- Team 1: cap1
    'c3c3c3c3-bbbb-bbbb-bbbb-c3c3c3c3c3c3'::uuid,  -- Team 2: cap3
    'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0'::uuid,  -- Team 3: dev
    'c2c2c2c2-bbbb-bbbb-bbbb-c2c2c2c2c2c2'::uuid   -- Team 4: cap2
  ];
  v_pool       UUID[];
  v_team_id    UUID;
  v_captain    UUID;
  v_pidx       INT := 1;
  v_i          INT;
  v_j          INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org_id)
     OR NOT EXISTS (SELECT 1 FROM venues WHERE id = v_sams_id) THEN
    RAISE EXCEPTION 'Run database/dev_starting_point.sql first (Tester Org / Sams''s Billiards missing).';
  END IF;

  --------------------------------------------------------------------------
  -- Cleanup: this league only (leaf-inward).
  --------------------------------------------------------------------------
  DELETE FROM match_games   WHERE match_id IN (SELECT id FROM matches WHERE season_id = v_season_id);
  DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE season_id = v_season_id);
  DELETE FROM matches       WHERE season_id = v_season_id;
  DELETE FROM team_players  WHERE team_id IN (SELECT id FROM teams WHERE league_id = v_league_id);
  DELETE FROM teams         WHERE league_id = v_league_id;
  DELETE FROM season_weeks  WHERE season_id = v_season_id;
  DELETE FROM seasons       WHERE league_id = v_league_id;
  DELETE FROM league_venues WHERE league_id = v_league_id;
  DELETE FROM preferences   WHERE entity_type = 'league' AND entity_id = v_league_id;
  DELETE FROM leagues       WHERE id = v_league_id;
  DELETE FROM venues        WHERE id = v_corner_id;

  --------------------------------------------------------------------------
  -- League + preferences (a trigger creates the empty prefs row).
  --------------------------------------------------------------------------
  INSERT INTO leagues (id, organization_id, game_type, day_of_week, division,
    league_start_date, status, handicap_variant, team_handicap_variant,
    handicap_level, golden_break_counts_as_win)
  VALUES (v_league_id, v_org_id, 'eight_ball', lower(trim(to_char(v_start, 'day'))),
    '7-team drop test', v_start, 'active', 'standard', 'standard', 'standard', FALSE);

  UPDATE preferences
     SET lineup_size = 3, max_roster_size = 5, game_generation = 'double_round_robin',
         handicap_type = 'points', points_system = 'differential'
   WHERE entity_type = 'league' AND entity_id = v_league_id;

  --------------------------------------------------------------------------
  -- Venues: reuse Sams's (4 tables) + a second bar (4 tables).
  --------------------------------------------------------------------------
  INSERT INTO venues (id, organization_id, name, street_address, city, state, zip_code, phone,
    bar_box_tables, regulation_tables, bar_box_table_numbers)
  VALUES (v_corner_id, v_org_id, 'Corner Pocket', '9 Side St', 'Springfield', 'FL', '11111',
    '222-222-2222', 0, 0, ARRAY[1, 2, 3, 4]);

  INSERT INTO league_venues (league_id, venue_id, available_bar_box_tables,
    available_regulation_tables, available_table_numbers, capacity)
  VALUES (v_league_id, v_sams_id,   0, 0, ARRAY[1, 2, 3, 4], 4),
         (v_league_id, v_corner_id, 0, 0, ARRAY[1, 2, 3, 4], 4);

  --------------------------------------------------------------------------
  -- Season: 16 regular weeks + break + playoffs. No matches.
  --------------------------------------------------------------------------
  INSERT INTO seasons (id, league_id, season_name, start_date, end_date, season_length, status)
  VALUES (v_season_id, v_league_id, '8-Ball 7-team drop test', v_start,
    v_start + INTERVAL '17 weeks', 16, 'upcoming');

  FOR v_i IN 1..16 LOOP
    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
    VALUES (v_season_id, v_start + (v_i - 1) * 7, 'Week ' || v_i, 'regular');
  END LOOP;
  INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
  VALUES (v_season_id, v_start + 16 * 7, 'Season End Break', 'blackout'),
         (v_season_id, v_start + 17 * 7, 'Playoffs', 'playoffs');

  --------------------------------------------------------------------------
  -- 7 teams. Placeholder pool: skip the 48 used by Leagues 1-3, then take
  -- 3 captains (teams 5-7) + 28 roster players, in stable email order.
  --------------------------------------------------------------------------
  SELECT array_agg(id ORDER BY email) INTO v_pool
    FROM (SELECT id, email FROM members WHERE email LIKE '%@example.com'
          ORDER BY email OFFSET 48 LIMIT 31) p;
  IF coalesce(array_length(v_pool, 1), 0) < 31 THEN
    RAISE EXCEPTION 'Need 79 placeholder members (@example.com); found fewer. Run dev_starting_point.sql.';
  END IF;

  FOR v_i IN 1..7 LOOP
    v_team_id := ('0c0c0c0c-4444-4444-4444-0c0c0c0c0c0' || v_i)::uuid;
    IF v_i <= 4 THEN
      v_captain := v_captains[v_i];
    ELSE
      v_captain := v_pool[v_pidx];
      v_pidx := v_pidx + 1;
    END IF;

    INSERT INTO teams (id, season_id, league_id, team_name, captain_id, home_venue_id, roster_size, status)
    VALUES (v_team_id, v_season_id, v_league_id, 'Team ' || v_i, v_captain,
      CASE WHEN v_i <= 4 THEN v_sams_id ELSE v_corner_id END, 5, 'active');

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team_id, v_season_id, v_captain, TRUE, 'active');

    FOR v_j IN 1..4 LOOP
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_id, v_season_id, v_pool[v_pidx], FALSE, 'active');
      v_pidx := v_pidx + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '7-team drop test league ready: 7 teams, 16 weeks, no schedule. Generate it in the app.';
END $$;
