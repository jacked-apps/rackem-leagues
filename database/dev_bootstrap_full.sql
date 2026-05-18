-- ============================================================================
-- DEV-ONLY: FULL LO-with-league fixture.
-- ============================================================================
--
-- Extends database/dev_bootstrap_lo.sql with everything you need to click
-- around the full app:
--
--   - 1 organization + 1 venue
--   - LEAGUE 1 (fresh): active 12-week season starting TODAY, 4 teams x 5
--     placeholder players, full round-robin schedule. Use for testing the
--     normal "new season starts, players play matches" flow.
--   - LEAGUE 2 (near end of season): active season started ~11 weeks ago,
--     ends in 10 days. Past-dated weeks marked completed so the progress
--     bar reflects "almost done." 4 teams x 5 players, full schedule. Use
--     for testing the next-season wizard's entry points (LeagueDetail
--     "Start Next Season" ActionCard + ActiveLeagues hint badge) without
--     waiting weeks of calendar time.
--
-- Each league's URLs are printed via RAISE NOTICE at the bottom.
--
-- WHAT THIS DOES NOT DO
--   - Does NOT create the auth.users row. Sign up via /register first.
--   - Does NOT put the LO on a team roster. (You said quick fix by hand.)
--
-- SAFETY
--   Guard 1: aborts unless current_database() = 'postgres' (local default).
--   Guard 2: aborts unless the email placeholder is edited.
--   File lives under database/ so no tooling auto-runs it.
--
-- HOW TO USE
--   1. Register at /register with the email you'll edit below.
--   2. Edit v_email and (optionally) state/city.
--   3. Paste into Supabase Studio > SQL Editor > Run.
--   4. RAISE NOTICEs at the bottom give you the URLs to visit.
--
-- ============================================================================

DO $$
DECLARE
  -- ===== EDIT THESE =====
  v_email        TEXT := 'REPLACE@example.com';
  v_first_name   TEXT := 'Test';
  v_last_name    TEXT := 'Operator';
  -- LO's state/city; placeholder players use the same state so player lookups
  -- filtered by state still surface them for dev testing.
  v_state        TEXT := 'FL';
  v_city         TEXT := 'Zephyrhills';
  v_org_name     TEXT := 'Dev Test Leagues';
  v_org_address  TEXT := '123 Main St';
  v_org_zip      TEXT := '33540';
  v_org_phone    TEXT := '555-0100';
  v_game_type    TEXT := 'eight_ball';
  v_day_of_week  TEXT := 'tuesday';
  v_team_format  TEXT := '5_man';
  -- ===== END EDIT =====

  v_user_id   UUID;
  v_member_id UUID;
  v_org_id    UUID;
  v_venue_id  UUID;
  v_league_id UUID;
  v_season_id UUID;
  v_start     DATE := CURRENT_DATE;
  v_end       DATE := CURRENT_DATE + INTERVAL '12 weeks';

  v_team_ids    UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_captain_ids UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_week_ids    UUID[];
  v_week_id     UUID;

  -- Second league: a "near end of season" league so the next-season
  -- wizard's entry-point button is visible immediately (no need to
  -- run a separate squish script). Season started 11 weeks ago,
  -- ends 10 days from now. Past weeks marked completed so the
  -- progress bar reflects "almost done."
  v_league2_id UUID;
  v_season2_id UUID;
  v_start2     DATE := CURRENT_DATE - INTERVAL '11 weeks';
  v_end2       DATE := CURRENT_DATE + INTERVAL '10 days';

  v_team2_ids    UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_captain2_ids UUID[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_week2_ids    UUID[];
  v_week2_id     UUID;
  v_match2_id    UUID;

  -- Round-robin pattern captured from the UI's schedule generator. Rows are
  -- (week, match_number, home_team_idx, away_team_idx). Indexes are 1-based.
  v_schedule INT[][] := ARRAY[
    ARRAY[1,1,1,2], ARRAY[1,2,3,4],
    ARRAY[2,1,3,1], ARRAY[2,2,4,2],
    ARRAY[3,1,2,3], ARRAY[3,2,1,4],
    ARRAY[4,1,3,4], ARRAY[4,2,2,1],
    ARRAY[5,1,4,2], ARRAY[5,2,1,3],
    ARRAY[6,1,1,4], ARRAY[6,2,3,2],
    ARRAY[7,1,2,1], ARRAY[7,2,4,3],
    ARRAY[8,1,1,3], ARRAY[8,2,2,4],
    ARRAY[9,1,3,2], ARRAY[9,2,4,1],
    ARRAY[10,1,4,3], ARRAY[10,2,1,2],
    ARRAY[11,1,2,4], ARRAY[11,2,3,1],
    ARRAY[12,1,4,1], ARRAY[12,2,2,3]
  ];

  v_row INT[];
  v_i   INT;
  v_pp  UUID;
  v_match_id UUID;
BEGIN
  -- Guards
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Refusing to run: database is "%", expected "postgres" (local). This script is dev-only.', current_database();
  END IF;
  IF v_email LIKE 'REPLACE%' THEN
    RAISE EXCEPTION 'Edit v_email in the CONFIG block before running.';
  END IF;

  -- 1. Find auth user.
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for email "%". Register at /register first.', v_email;
  END IF;

  -- 2. Upsert LO members row.
  SELECT id INTO v_member_id FROM members WHERE user_id = v_user_id;
  IF v_member_id IS NULL THEN
    INSERT INTO members (user_id, first_name, last_name, city, state, email, role)
    VALUES (v_user_id, v_first_name, v_last_name, v_city, v_state, v_email, 'league_operator')
    RETURNING id INTO v_member_id;
  END IF;
  -- Pick up the LO's actual state/city in case the members row already existed.
  SELECT state, city INTO v_state, v_city FROM members WHERE id = v_member_id;

  -- 3. Organization + owner staff (via trigger).
  INSERT INTO organizations (
    organization_name, organization_address, organization_city,
    organization_state, organization_zip_code,
    organization_email, organization_phone,
    stripe_customer_id, payment_method_id,
    card_last4, card_brand, expiry_month, expiry_year, billing_zip,
    created_by
  ) VALUES (
    v_org_name, v_org_address, v_city, v_state, v_org_zip,
    v_email, v_org_phone,
    'cus_dev_' || substring(v_user_id::text from 1 for 8),
    'pm_dev_'  || substring(v_user_id::text from 1 for 8),
    '4242', 'visa', 12, 2030, v_org_zip,
    v_member_id
  ) RETURNING id INTO v_org_id;

  -- 4. Venue for the org.
  -- venues.total_tables is a generated column from array_length of the three
  -- table-numbers arrays, and a CHECK requires total_tables > 0. Populate
  -- bar_box_table_numbers so the constraint passes.
  INSERT INTO venues (organization_id, name, street_address, city, state, zip_code, phone, bar_box_tables, regulation_tables, bar_box_table_numbers)
  VALUES (v_org_id, 'Sam''s Billiards', '45 Pool Hall Rd', v_city, v_state, v_org_zip, v_org_phone, 4, 2, ARRAY[1,2,3,4])
  RETURNING id INTO v_venue_id;

  -- 5. League.
  INSERT INTO leagues (organization_id, game_type, day_of_week, team_format, league_start_date, division, status)
  VALUES (v_org_id, v_game_type, v_day_of_week, v_team_format, v_start, 'Dev League', 'active')
  RETURNING id INTO v_league_id;

  INSERT INTO league_venues (league_id, venue_id) VALUES (v_league_id, v_venue_id);

  -- 6. Active season starting today, 12 weeks.
  INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length, status)
  VALUES (v_league_id, 'Dev Season ' || to_char(v_start, 'YYYY-MM-DD'), v_start, v_end, 12, 'active')
  RETURNING id INTO v_season_id;

  -- 7. Season weeks: 12 regular + 1 season_end_break.
  v_week_ids := ARRAY[]::UUID[];
  FOR v_i IN 1..12 LOOP
    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
    VALUES (v_season_id, v_start + ((v_i - 1) * 7), 'Week ' || v_i, 'regular')
    RETURNING id INTO v_week_id;
    v_week_ids := array_append(v_week_ids, v_week_id);
  END LOOP;
  INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
  VALUES (v_season_id, v_start + (12 * 7), 'Season End Break', 'season_end_break');

  -- 8. Captains — four placeholder members. State matches the LO's so the
  -- dev's player-lookup (filtered by state) still finds them.
  FOR v_i IN 1..4 LOOP
    INSERT INTO members (first_name, last_name, city, state, role)
    VALUES ('Captain', 'Team ' || v_i, v_city, v_state, 'player')
    RETURNING id INTO v_pp;
    v_captain_ids[v_i] := v_pp;
  END LOOP;

  -- 9. Teams (4) + roster (captain + 4 regulars per team).
  FOR v_i IN 1..4 LOOP
    INSERT INTO teams (id, season_id, league_id, team_name, captain_id, roster_size, home_venue_id, status)
    VALUES (v_team_ids[v_i], v_season_id, v_league_id, 'Team ' || v_i, v_captain_ids[v_i], 5, v_venue_id, 'active');

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team_ids[v_i], v_season_id, v_captain_ids[v_i], TRUE, 'active');

    FOR v_row IN SELECT ARRAY[j] FROM generate_series(1, 4) AS j LOOP
      INSERT INTO members (first_name, last_name, city, state, role)
      VALUES ('Player ' || v_row[1], 'Team ' || v_i, v_city, v_state, 'player')
      RETURNING id INTO v_pp;
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_ids[v_i], v_season_id, v_pp, FALSE, 'active');
    END LOOP;
  END LOOP;

  -- 10. Matches + lineups using the hardcoded round-robin pattern.
  FOREACH v_row SLICE 1 IN ARRAY v_schedule LOOP
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status, scheduled_venue_id
    ) VALUES (
      v_season_id, v_week_ids[v_row[1]],
      v_team_ids[v_row[3]], v_team_ids[v_row[4]],
      v_row[2], 'scheduled', v_venue_id
    ) RETURNING id INTO v_match_id;
    -- match_lineups are auto-created by trigger_auto_create_match_lineups.
  END LOOP;

  -- ===========================================================
  -- SECOND LEAGUE: "near end of season" for next-season-wizard testing
  -- ===========================================================
  --
  -- Same shape as the first league (4 teams, 5 players each, full
  -- round-robin schedule) but the season started 11 weeks ago and
  -- ends 10 days from now → falls inside the next-season wizard's
  -- 21-day ripe window, so the "Start Next Season" button + the
  -- org-dashboard hint badge appear immediately without needing to
  -- run a separate squish script.
  --
  -- Past-dated weeks get week_completed=true so the LeagueStatusCard
  -- progress bar reflects "almost done" instead of week 0.

  -- 12. Second league (same org + venue, different day_of_week so
  --     league names disambiguate visually).
  INSERT INTO leagues (organization_id, game_type, day_of_week, team_format, league_start_date, division, status)
  VALUES (v_org_id, v_game_type, 'thursday', v_team_format, v_start2, 'Dev League — Near End', 'active')
  RETURNING id INTO v_league2_id;

  INSERT INTO league_venues (league_id, venue_id) VALUES (v_league2_id, v_venue_id);

  -- 13. Active season ending in 10 days (started 11 weeks ago).
  INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length, status)
  VALUES (v_league2_id, 'Dev Season ' || to_char(v_start2, 'YYYY-MM-DD') || ' (near end)', v_start2, v_end2, 12, 'active')
  RETURNING id INTO v_season2_id;

  -- 14. Weeks 1-12 regular + 1 end break. Mark past weeks completed.
  v_week2_ids := ARRAY[]::UUID[];
  FOR v_i IN 1..12 LOOP
    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type, week_completed)
    VALUES (
      v_season2_id,
      v_start2 + ((v_i - 1) * 7),
      'Week ' || v_i,
      'regular',
      (v_start2 + ((v_i - 1) * 7)) < CURRENT_DATE
    )
    RETURNING id INTO v_week2_id;
    v_week2_ids := array_append(v_week2_ids, v_week2_id);
  END LOOP;
  INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
  VALUES (v_season2_id, v_start2 + (12 * 7), 'Season End Break', 'season_end_break');

  -- 15. Captains (4 placeholders, distinguished by team name suffix).
  FOR v_i IN 1..4 LOOP
    INSERT INTO members (first_name, last_name, city, state, role)
    VALUES ('Captain', 'NearEnd ' || v_i, v_city, v_state, 'player')
    RETURNING id INTO v_pp;
    v_captain2_ids[v_i] := v_pp;
  END LOOP;

  -- 16. Teams (4) + roster (captain + 4 regulars per team).
  FOR v_i IN 1..4 LOOP
    INSERT INTO teams (id, season_id, league_id, team_name, captain_id, roster_size, home_venue_id, status)
    VALUES (v_team2_ids[v_i], v_season2_id, v_league2_id, 'NearEnd Team ' || v_i, v_captain2_ids[v_i], 5, v_venue_id, 'active');

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team2_ids[v_i], v_season2_id, v_captain2_ids[v_i], TRUE, 'active');

    FOR v_row IN SELECT ARRAY[j] FROM generate_series(1, 4) AS j LOOP
      INSERT INTO members (first_name, last_name, city, state, role)
      VALUES ('Player ' || v_row[1], 'NearEnd ' || v_i, v_city, v_state, 'player')
      RETURNING id INTO v_pp;
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team2_ids[v_i], v_season2_id, v_pp, FALSE, 'active');
    END LOOP;
  END LOOP;

  -- 17. Matches + lineups (reuses the same hardcoded round-robin
  --     pattern from the first league — same week + match numbers,
  --     just bound to the second league's team + week IDs).
  FOREACH v_row SLICE 1 IN ARRAY v_schedule LOOP
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status, scheduled_venue_id
    ) VALUES (
      v_season2_id, v_week2_ids[v_row[1]],
      v_team2_ids[v_row[3]], v_team2_ids[v_row[4]],
      v_row[2], 'scheduled', v_venue_id
    ) RETURNING id INTO v_match2_id;
  END LOOP;

  -- 18. Done.
  RAISE NOTICE '=== Full bootstrap complete ===';
  RAISE NOTICE 'auth.user:         %', v_user_id;
  RAISE NOTICE 'member:            %', v_member_id;
  RAISE NOTICE 'organization:      %', v_org_id;
  RAISE NOTICE 'venue:             %', v_venue_id;
  RAISE NOTICE '';
  RAISE NOTICE '--- League 1 (fresh) ---';
  RAISE NOTICE 'league:            %', v_league_id;
  RAISE NOTICE 'season:            % (% → %)', v_season_id, v_start, v_end;
  RAISE NOTICE 'teams:             %', v_team_ids;
  RAISE NOTICE 'League settings:   /league-settings/%', v_league_id;
  RAISE NOTICE '';
  RAISE NOTICE '--- League 2 (near end of season — for next-season wizard testing) ---';
  RAISE NOTICE 'league:            %', v_league2_id;
  RAISE NOTICE 'season:            % (% → %)  ends in 10 days', v_season2_id, v_start2, v_end2;
  RAISE NOTICE 'teams:             %', v_team2_ids;
  RAISE NOTICE 'League page:       /league/%', v_league2_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Org URL:           /operator-settings/%', v_org_id;
  RAISE NOTICE 'House rules URL:   /league-rules/%', v_org_id;
END $$;
