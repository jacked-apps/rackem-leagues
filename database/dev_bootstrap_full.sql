-- ============================================================================
-- DEV-ONLY: FULL LO-with-league fixture.
-- ============================================================================
--
-- Extends database/dev_bootstrap_lo.sql with everything you need to click
-- around the full app:
--
--   - 1 organization + 1 venue
--   - LEAGUE 1 (fresh): active 12-week season starting TODAY. 4 teams,
--     each with 7 players (1 captain + 6 regulars — roster intentionally
--     larger than the 5-man lineup so the dev can swap substitutes
--     during lineup testing). Full round-robin schedule. Team names
--     derived from each captain's last name + " Crew" (e.g.,
--     "Thompson Crew"). Use for testing the normal "new season starts,
--     players play matches" flow.
--   - LEAGUE 2 (near end of season): active season started ~11 weeks ago,
--     ends in 10 days. Past-dated weeks marked completed so the progress
--     bar reflects "almost done." Same 4 teams × 7 player shape as
--     League 1, but team names use " Sharks" suffix so they're visually
--     distinguishable. Use for testing the next-season wizard's entry
--     points (LeagueDetail "Start Next Season" ActionCard + ActiveLeagues
--     hint badge) without waiting weeks of calendar time.
--   - FREE AGENTS: any seeded placeholder members beyond the 56 needed
--     for the two leagues stay unassigned — they appear in the dev's
--     player-picker dropdowns as "available to roster" so the captain's
--     add-player UX has realistic options. Roughly 14 free agents
--     given the 70-member seed pool.
--
-- DEPENDS ON: supabase/seed_members.sql + supabase/seed_extra_players.sql
-- having been run first. The bootstrap pulls real placeholder members
-- (with realistic names, handicaps, and BCA numbers) from that pool
-- instead of generating "Player N Team M" literals. Bootstrap will
-- abort with a clear message if the pool is too small.
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
  -- (team_format was dropped from `leagues` in 20260502000000 — lineup size is
  --  now a modular league preference, configured via the app after seeding.)
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
  v_j   INT;
  v_idx INT;
  v_pp  UUID;
  v_match_id UUID;

  -- Roster shape: each team gets 1 captain + 6 regular roster players
  -- (7 total per team). Roster intentionally LARGER than the 5-man
  -- lineup so the dev can test substitute swaps (and so the player
  -- search has more rows to filter through). 4 teams × 7 = 28 members
  -- per league, × 2 leagues = 56 needed.
  v_team_roster_size CONSTANT INT := 7; -- 1 captain + 6 regulars

  -- Pool of pre-seeded placeholder members we'll pick from. Populated
  -- by querying members where user_id IS NULL — both seed_members.sql
  -- and seed_extra_players.sql contribute. Bootstrap aborts if the
  -- pool doesn't have at least v_min_pool_size rows; user runs the
  -- two seed files first.
  v_pool         UUID[];
  v_pool_size    INT;
  v_min_pool_size CONSTANT INT := 56; -- 4 teams × 7 × 2 leagues
  v_captain_name TEXT;
BEGIN
  -- Guards
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Refusing to run: database is "%", expected "postgres" (local). This script is dev-only.', current_database();
  END IF;
  IF v_email LIKE 'REPLACE%' THEN
    RAISE EXCEPTION 'Edit v_email in the CONFIG block before running.';
  END IF;

  -- 0. Check the seed-player pool is populated. The bootstrap fills
  --    teams from placeholder members (user_id IS NULL) seeded by
  --    seed_members.sql + seed_extra_players.sql. Without those, we
  --    can't fill rosters — bail out with a helpful message rather
  --    than create empty teams.
  SELECT array_agg(id ORDER BY created_at) INTO v_pool
  FROM members
  WHERE user_id IS NULL
    AND role = 'player';
  v_pool_size := COALESCE(array_length(v_pool, 1), 0);
  IF v_pool_size < v_min_pool_size THEN
    RAISE EXCEPTION 'Seed pool too small (% placeholder players, need >= %). Run supabase/seed_members.sql + supabase/seed_extra_players.sql first.',
      v_pool_size, v_min_pool_size;
  END IF;

  -- Reshape the picked members to match the LO's city/state so the
  -- player-search filter (which scopes by state) surfaces them. Only
  -- touches the v_min_pool_size members we'll actually use; leaves
  -- the free-agent overflow in their seeded city/state for variety.
  UPDATE members
  SET city = v_city, state = v_state
  WHERE id = ANY(v_pool[1:v_min_pool_size]);

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
  INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date, division, status)
  VALUES (v_org_id, v_game_type, v_day_of_week, v_start, 'Dev League', 'active')
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
  VALUES (v_season_id, v_start + (12 * 7), 'Season End Break', 'blackout');

  -- 8. League 1 captains — pull the first 4 members from the pool.
  --    Pool indexes [1..4] = captains for teams 1..4 respectively.
  FOR v_i IN 1..4 LOOP
    v_captain_ids[v_i] := v_pool[v_i];
  END LOOP;

  -- 9. League 1 teams (4) + rosters (7 per team: 1 captain + 6
  --    regulars). Roster intentionally larger than the 5-man lineup
  --    so the dev can swap substitutes during lineup testing AND so
  --    players with duplicate nicknames (which the seed data has on
  --    purpose) can be swapped in/out without losing a roster slot.
  --    Team name is derived from the captain's last name so the LO
  --    sees a recognizable name instead of generic "Team N".
  FOR v_i IN 1..4 LOOP
    SELECT last_name INTO v_captain_name FROM members WHERE id = v_captain_ids[v_i];

    INSERT INTO teams (id, season_id, league_id, team_name, captain_id, roster_size, home_venue_id, status)
    VALUES (v_team_ids[v_i], v_season_id, v_league_id, v_captain_name || ' Crew', v_captain_ids[v_i], v_team_roster_size, v_venue_id, 'active');

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team_ids[v_i], v_season_id, v_captain_ids[v_i], TRUE, 'active');

    -- Pool indexes [5..28] = league 1 regulars (6 per team × 4 teams).
    -- For team v_i, members are at pool indexes 5 + (v_i-1)*6 .. 4 + v_i*6.
    FOR v_j IN 1..6 LOOP
      v_idx := 4 + (v_i - 1) * 6 + v_j;
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_ids[v_i], v_season_id, v_pool[v_idx], FALSE, 'active');
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
  INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date, division, status)
  VALUES (v_org_id, v_game_type, 'thursday', v_start2, 'Dev League — Near End', 'active')
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
  VALUES (v_season2_id, v_start2 + (12 * 7), 'Season End Break', 'blackout');

  -- 15. League 2 captains — pool indexes [29..32].
  FOR v_i IN 1..4 LOOP
    v_captain2_ids[v_i] := v_pool[28 + v_i];
  END LOOP;

  -- 16. League 2 teams (4) + rosters. Same shape as League 1
  --     (1 captain + 6 regulars per team, name derived from captain).
  --     Pool indexes [33..56] are these teams' regulars.
  FOR v_i IN 1..4 LOOP
    SELECT last_name INTO v_captain_name FROM members WHERE id = v_captain2_ids[v_i];

    INSERT INTO teams (id, season_id, league_id, team_name, captain_id, roster_size, home_venue_id, status)
    VALUES (v_team2_ids[v_i], v_season2_id, v_league2_id, v_captain_name || ' Sharks', v_captain2_ids[v_i], v_team_roster_size, v_venue_id, 'active');

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team2_ids[v_i], v_season2_id, v_captain2_ids[v_i], TRUE, 'active');

    FOR v_j IN 1..6 LOOP
      v_idx := 32 + (v_i - 1) * 6 + v_j;
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team2_ids[v_i], v_season2_id, v_pool[v_idx], FALSE, 'active');
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
  RAISE NOTICE '';
  RAISE NOTICE 'Free agents (not on any team): % member(s) — appear in player pickers.',
    GREATEST(0, v_pool_size - v_min_pool_size);
END $$;


-- ============================================================================
-- Anonymous-sub sentinel members (required by match_lineups FK).
-- ============================================================================
--
-- The lineup-page anonymous-sub workflow writes these sentinel UUIDs into
-- match_lineups.player{1..N}_id. Without rows in the members table for
-- these UUIDs, the FK constraint match_lineups_player*_id_fkey fires with
-- HTTP 409 Conflict at lock time.
--
-- The canonical supabase/seed.sql includes these rows, but local dev
-- bootstrap files historically omitted them. ON CONFLICT (id) DO NOTHING
-- makes this idempotent — re-running the bootstrap is safe. nextval on
-- the system_player_number sequence prevents UNIQUE collisions with any
-- members the bootstrap inserted above this block.
-- ============================================================================

INSERT INTO public.members (
  id, user_id, first_name, last_name, nickname, phone, email,
  address, city, state, zip_code, date_of_birth, role,
  system_player_number, bca_member_number, membership_paid_date,
  created_at, updated_at, profanity_filter_enabled
) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, NULL, 'Home', 'Substitute', 'Sub (Home)', '000-000-0001', 'sub.home@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false),
  ('00000000-0000-0000-0000-000000000002'::uuid, NULL, 'Away', 'Substitute', 'Sub (Away)', '000-000-0002', 'sub.away@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- Double-duty sentinel members (required by match_lineups FK).
-- ============================================================================
--
-- Sibling to the anonymous-sub sentinels above. The double-duty
-- (5v5 double-duty) workflow writes these sentinel UUIDs into
-- match_lineups.player{1..N}_id while awaiting the opposing captain's
-- OpponentSubstituteModal. Without rows in the members table for these
-- UUIDs, the FK fires the same 409 Conflict the anonymous subs hit.
--
-- Nicknames are capped at varchar(12) by the schema — 'Sub (HomeDD)'
-- and 'Sub (AwayDD)' are exactly 12 chars and parallel the existing
-- 'Sub (Home)' / 'Sub (Away)' style.
-- ============================================================================

INSERT INTO public.members (
  id, user_id, first_name, last_name, nickname, phone, email,
  address, city, state, zip_code, date_of_birth, role,
  system_player_number, bca_member_number, membership_paid_date,
  created_at, updated_at, profanity_filter_enabled
) VALUES
  ('00000000-0000-0000-0000-000000000011'::uuid, NULL, 'Home', 'Double Duty', 'Sub (HomeDD)', '000-000-0011', 'sub.home.dd@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false),
  ('00000000-0000-0000-0000-000000000012'::uuid, NULL, 'Away', 'Double Duty', 'Sub (AwayDD)', '000-000-0012', 'sub.away.dd@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false)
ON CONFLICT (id) DO NOTHING;
