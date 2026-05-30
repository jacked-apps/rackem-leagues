-- ============================================================================
-- DEV SEED — FULL test environment (post-modular-system)
-- ============================================================================
--
-- ONE comprehensive, idempotent seed that gives you everything needed to log
-- in and SCORE matches across all three packaged scoring systems — without
-- touching the wizard. Paste once after `pnpm db:reset`.
--
-- WHAT YOU GET
--
--   1. 4 auth logins (all password "password") — ALL FOUR ARE TEAM CAPTAINS
--      (dev@test.com is also the League Operator of Tester Org):
--        dev@test.com   — Lee Goperator (Lo)      — LO + captain
--        cap1@test.com  — Johnny Captain (Johnny)  — captain
--        cap2@test.com  — Captain Smith (Smitty)   — captain
--        cap3@test.com  — Sally Captain (Sal)      — captain
--   2. Tester Org (mock Stripe, payment-verified) + 1 venue.
--   3. ~100 placeholder players (random handicaps for all three systems).
--   4. THREE leagues, one per packaged scoring system, each pre-configured
--      (preferences = byte-exact PRESET_MAPPINGS from the wizard):
--        L1: 3v3 Points       — handicap=points,     calc=linear_above_threshold
--        L2: 5v5 Percentage   — handicap=percentage, calc=accumulate_with_milestone_jumps
--        L3: 5v5 Fargo 10-7   — handicap=fargo,      calc=accumulated_per_game (points-mode)
--   5. Each league: 1 active season, 3 schedule weeks, 4 teams (each captained
--      by one of the 4 logins), rosters filled to lineup_size + 1 from the
--      placeholder pool, and a full 4-team round-robin of `scheduled` matches.
--
-- HOW TO SCORE (the matches are left in `scheduled` on purpose)
--
--   The lineup → lock → prep → score flow is app-owned (it computes thresholds
--   from the locked lineups). So: log in as the two captains of a match, set +
--   lock both lineups, prep, then score. Every match pairs two of the 4 logins,
--   so you always have both captains available.
--
-- HANDICAPS (so the handicapping system has real numbers to chew on)
--
--   Every seeded member gets a random value in all three fields, so whichever
--   league they play in has a rating:
--     starting_handicap_3v3 (points):     -2 .. +2
--     starting_handicap_5v5 (percentage): 20 .. 80
--     fargo_rating (fargo, CHECK 100-850): 350 .. 650
--
-- SAFETY / IDEMPOTENCY
--
--   Aborts unless current_database() = 'postgres' (local). The cleanup block
--   removes any prior run (scoped to the Tester Org id + the 4 login emails),
--   so it's safe to re-run.
--
-- HOW TO USE
--   1. pnpm db:reset
--   2. Studio (http://localhost:54323) → SQL Editor → paste this file → Run
--   3. Sign in at http://localhost:5173/login as dev@test.com / password
-- ============================================================================

DO $$
DECLARE
  -- Deterministic ids so cleanup is idempotent.
  v_org_id    UUID := 'a0a0a0a0-cccc-cccc-cccc-a0a0a0a0a0a0';
  v_venue_id  UUID := 'a0a0a0a0-dddd-dddd-dddd-a0a0a0a0a0a0';

  -- The 4 captain logins (dev@test.com is LO + captain). user/member ids are
  -- fixed; emails drive cleanup.
  v_user_ids   UUID[] := ARRAY[
    'dededede-dede-dede-dede-dededededede',
    'c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1',
    'c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2',
    'c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3'
  ]::UUID[];
  v_cap_member_ids UUID[] := ARRAY[
    'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0',
    'c1c1c1c1-bbbb-bbbb-bbbb-c1c1c1c1c1c1',
    'c2c2c2c2-bbbb-bbbb-bbbb-c2c2c2c2c2c2',
    'c3c3c3c3-bbbb-bbbb-bbbb-c3c3c3c3c3c3'
  ]::UUID[];
  v_emails     TEXT[] := ARRAY['dev@test.com','cap1@test.com','cap2@test.com','cap3@test.com'];
  v_firsts     TEXT[] := ARRAY['Lee','Johnny','Captain','Sally'];
  v_lasts      TEXT[] := ARRAY['Goperator','Captain','Smith','Captain'];
  v_nicks      TEXT[] := ARRAY['Lo','Johnny','Smitty','Sal'];
  v_roles      TEXT[] := ARRAY['league_operator','player','player','player'];
  -- bcrypt("password", cost 10) — same hash dev_seed_minimal.sql uses.
  v_pw_hash    TEXT := '$2a$10$K8ZVjU8Oc5P67Fdy1VK.vOxU/vbguRDS.2WAoAE46QhkW8aoIBdXO';

  -- Placeholder pool.
  v_pool       UUID[] := ARRAY[]::UUID[];
  v_cursor     INT := 0;            -- next free pool member
  v_pp         UUID;

  -- Per-league config (index 1=3v3 points, 2=5v5 percentage, 3=5v5 fargo).
  v_names      TEXT[] := ARRAY['3v3 Points League','5v5 Percentage League','5v5 Fargo 10-7 League'];
  v_lineup     INT[]  := ARRAY[3,5,5];
  v_maxroster  INT[]  := ARRAY[5,8,8];
  v_gamegen    TEXT[] := ARRAY['double_round_robin','single_round_robin','single_round_robin'];
  v_handicap   TEXT[] := ARRAY['points','percentage','fargo'];
  v_pointssys  TEXT[] := ARRAY['differential','bca_tiered','differential'];
  v_calc       TEXT[] := ARRAY['linear_above_threshold','accumulate_with_milestone_jumps','accumulated_per_game'];
  v_wincond    TEXT[] := ARRAY['games','games','points'];
  v_mech       TEXT[] := ARRAY['extra_games','extra_games','start_points'];
  v_tbtrig     TEXT[] := ARRAY['even_total_games_only','never','never'];
  v_tbfmt      TEXT[] := ARRAY['best_of_3_short_race','accept_tie','accept_tie'];

  v_i          INT;     -- league index
  v_t          INT;     -- team index within league
  v_r          INT;     -- roster slot
  v_w          INT;     -- week index
  v_mnum       INT;     -- match_number counter (per season)
  v_league_id  UUID;
  v_season_id  UUID;
  v_week_ids   UUID[];
  v_week_id    UUID;
  v_team_ids   UUID[];
  v_team_id    UUID;
  v_standings  TEXT[];
  -- 4-team single round-robin pairings: (round, home_idx, away_idx).
  v_rr         INT[][] := ARRAY[
    ARRAY[1,1,2], ARRAY[1,3,4],
    ARRAY[2,1,3], ARRAY[2,2,4],
    ARRAY[3,1,4], ARRAY[3,2,3]
  ];
  v_pair       INT[];
BEGIN
  -- Guard: local only.
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Refusing to run: database is "%", expected "postgres" (local).', current_database();
  END IF;

  -- ==========================================================================
  -- CLEANUP (idempotent) — leaf-inward, scoped to the Tester Org + 4 emails.
  -- ==========================================================================
  DELETE FROM team_players WHERE team_id IN (
    SELECT id FROM teams WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = v_org_id));
  DELETE FROM match_games WHERE match_id IN (
    SELECT m.id FROM matches m JOIN seasons s ON s.id = m.season_id
    JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = v_org_id);
  DELETE FROM match_lineups WHERE match_id IN (
    SELECT m.id FROM matches m JOIN seasons s ON s.id = m.season_id
    JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = v_org_id);
  DELETE FROM matches WHERE season_id IN (
    SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = v_org_id);
  DELETE FROM season_weeks WHERE season_id IN (
    SELECT s.id FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE l.organization_id = v_org_id);
  DELETE FROM seasons WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = v_org_id);
  DELETE FROM teams WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = v_org_id);
  DELETE FROM league_venues WHERE league_id IN (SELECT id FROM leagues WHERE organization_id = v_org_id);
  DELETE FROM preferences WHERE entity_type = 'league'
    AND entity_id IN (SELECT id FROM leagues WHERE organization_id = v_org_id);
  DELETE FROM leagues WHERE organization_id = v_org_id;
  DELETE FROM organization_staff WHERE organization_id = v_org_id;
  DELETE FROM preferences WHERE entity_type = 'organization' AND entity_id = v_org_id;
  DELETE FROM venues WHERE organization_id = v_org_id;
  -- Delete the org BEFORE its members: organizations.created_by references a
  -- member, so the member can't be removed while the org still points at it.
  DELETE FROM organizations WHERE id = v_org_id;
  DELETE FROM members WHERE user_id = ANY(v_user_ids);
  DELETE FROM members WHERE organization_id = v_org_id;
  DELETE FROM auth.identities WHERE user_id = ANY(v_user_ids);
  DELETE FROM auth.users WHERE id = ANY(v_user_ids);

  -- ==========================================================================
  -- AUTH LOGINS + MEMBER PROFILES (4 captains; dev@test.com also LO)
  -- ==========================================================================
  FOR v_i IN 1..4 LOOP
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_user_ids[v_i], '00000000-0000-0000-0000-000000000000',
      v_emails[v_i], v_pw_hash, NOW(),
      '{"provider": "email", "providers": ["email"]}', '{}',
      'authenticated', 'authenticated', NOW(), NOW(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_ids[v_i]::text, v_user_ids[v_i],
      jsonb_build_object('sub', v_user_ids[v_i]::text, 'email', v_emails[v_i],
                         'email_verified', false, 'phone_verified', false),
      'email', NOW(), NOW(), NOW()
    );
    -- organization_id is set AFTER the org is created (circular FK: members.
    -- organization_id ↔ organizations.created_by).
    INSERT INTO members (
      id, user_id, first_name, last_name, nickname, email, city, state, role,
      starting_handicap_3v3, starting_handicap_5v5, fargo_rating
    ) VALUES (
      v_cap_member_ids[v_i], v_user_ids[v_i], v_firsts[v_i], v_lasts[v_i],
      v_nicks[v_i], v_emails[v_i], 'Tampa', 'FL', v_roles[v_i]::user_role,
      floor(random()*5)::int - 2, 20 + floor(random()*61)::int, 350 + floor(random()*301)::int
    );
  END LOOP;

  -- ==========================================================================
  -- ORGANIZATION (mock Stripe, payment-verified) + owner staff + venue
  -- ==========================================================================
  INSERT INTO organizations (
    id, organization_name, organization_address, organization_city,
    organization_state, organization_zip_code, organization_email, organization_phone,
    stripe_customer_id, payment_method_id, card_last4, card_brand,
    expiry_month, expiry_year, billing_zip, payment_verified, created_by
  ) VALUES (
    v_org_id, 'Tester Org', '1 Test Lane', 'Tampa', 'FL', '33601',
    'dev@test.com', '555-0100', 'cus_dev_tester', 'pm_dev_tester',
    '4242', 'visa', 12, 2030, '33601', TRUE, v_cap_member_ids[1]
  );
  INSERT INTO organization_staff (organization_id, member_id, position)
  VALUES (v_org_id, v_cap_member_ids[1], 'owner') ON CONFLICT DO NOTHING;

  -- Org exists now → link the captains to it.
  UPDATE members SET organization_id = v_org_id WHERE id = ANY(v_cap_member_ids);

  INSERT INTO venues (
    id, organization_id, name, street_address, city, state, zip_code, phone,
    bar_box_tables, regulation_tables, bar_box_table_numbers
  ) VALUES (
    v_venue_id, v_org_id, 'Test Venue', '2 Test Lane', 'Tampa', 'FL', '33601',
    '555-0100', 8, 0, ARRAY[1,2,3,4,5,6,7,8]
  );

  -- ==========================================================================
  -- PLACEHOLDER POOL (~100, random handicaps in all three systems)
  -- ==========================================================================
  FOR v_i IN 1..100 LOOP
    INSERT INTO members (
      first_name, last_name, nickname, city, state, role, organization_id,
      starting_handicap_3v3, starting_handicap_5v5, fargo_rating
    ) VALUES (
      'Player', 'Number' || v_i, 'P' || v_i, 'Tampa', 'FL', 'player', v_org_id,
      floor(random()*5)::int - 2, 20 + floor(random()*61)::int, 350 + floor(random()*301)::int
    ) RETURNING id INTO v_pp;
    v_pool := array_append(v_pool, v_pp);
  END LOOP;

  -- ==========================================================================
  -- THREE LEAGUES (one per scoring system) + season + weeks + teams + matches
  -- ==========================================================================
  FOR v_i IN 1..3 LOOP
    -- League (insert auto-creates an empty preferences row via trigger).
    INSERT INTO leagues (organization_id, game_type, day_of_week, league_start_date, division, status)
    VALUES (v_org_id, 'eight_ball', 'tuesday', CURRENT_DATE, v_names[v_i], 'active')
    RETURNING id INTO v_league_id;

    INSERT INTO league_venues (league_id, venue_id) VALUES (v_league_id, v_venue_id);

    -- Scoring config — UPSERT over the trigger-created pref row. Values are the
    -- byte-exact PRESET_MAPPINGS (src/wizards/league-v2/presetMappings.ts).
    v_standings := CASE WHEN v_i = 3
      THEN ARRAY['points_earned','match_wins','games_won']
      ELSE ARRAY['match_wins','games_won','points_earned'] END;
    INSERT INTO preferences (
      entity_type, entity_id, lineup_size, max_roster_size, game_generation,
      handicap_type, points_system, pairing_format, points_calculator,
      points_calculator_params, win_condition, mechanism, standings_sort,
      tiebreaker_trigger, tiebreaker_format, race_length
    ) VALUES (
      'league', v_league_id, v_lineup[v_i], v_maxroster[v_i], v_gamegen[v_i],
      v_handicap[v_i], v_pointssys[v_i], 'single_rack', v_calc[v_i],
      '{}'::jsonb, v_wincond[v_i], v_mech[v_i], v_standings,
      v_tbtrig[v_i], v_tbfmt[v_i], NULL
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
      lineup_size = EXCLUDED.lineup_size, max_roster_size = EXCLUDED.max_roster_size,
      game_generation = EXCLUDED.game_generation, handicap_type = EXCLUDED.handicap_type,
      points_system = EXCLUDED.points_system, pairing_format = EXCLUDED.pairing_format,
      points_calculator = EXCLUDED.points_calculator,
      points_calculator_params = EXCLUDED.points_calculator_params,
      win_condition = EXCLUDED.win_condition, mechanism = EXCLUDED.mechanism,
      standings_sort = EXCLUDED.standings_sort, tiebreaker_trigger = EXCLUDED.tiebreaker_trigger,
      tiebreaker_format = EXCLUDED.tiebreaker_format, race_length = EXCLUDED.race_length;

    -- Season + 3 schedule weeks.
    INSERT INTO seasons (league_id, season_name, start_date, end_date, season_length, status)
    VALUES (v_league_id, v_names[v_i] || ' Season', CURRENT_DATE,
            CURRENT_DATE + INTERVAL '12 weeks', 12, 'active')
    RETURNING id INTO v_season_id;

    v_week_ids := ARRAY[]::UUID[];
    FOR v_w IN 1..12 LOOP
      INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
      VALUES (v_season_id, CURRENT_DATE + ((v_w - 1) * 7), 'Week ' || v_w, 'regular')
      RETURNING id INTO v_week_id;
      v_week_ids := array_append(v_week_ids, v_week_id);
    END LOOP;

    -- 4 teams, each captained by one of the 4 logins; roster = captain +
    -- lineup_size placeholders (= lineup_size + 1 players).
    v_team_ids := ARRAY[]::UUID[];
    FOR v_t IN 1..4 LOOP
      v_team_id := gen_random_uuid();
      INSERT INTO teams (id, league_id, season_id, team_name, captain_id, roster_size, home_venue_id, status)
      VALUES (v_team_id, v_league_id, v_season_id,
              v_nicks[v_t] || '''s ' || v_names[v_i] || ' Team',
              v_cap_member_ids[v_t], v_maxroster[v_i], v_venue_id, 'active');
      v_team_ids := array_append(v_team_ids, v_team_id);

      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_id, v_season_id, v_cap_member_ids[v_t], TRUE, 'active');

      FOR v_r IN 1..v_lineup[v_i] LOOP
        v_cursor := v_cursor + 1;
        INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
        VALUES (v_team_id, v_season_id, v_pool[v_cursor], FALSE, 'active');
      END LOOP;
    END LOOP;

    -- Schedule: 12 weeks = the 4-team round-robin (3 rounds) repeated 4×, so
    -- every week has 2 matches and the season is a realistic length.
    v_mnum := 0;
    FOR v_w IN 1..12 LOOP
      FOREACH v_pair SLICE 1 IN ARRAY v_rr LOOP
        IF v_pair[1] = ((v_w - 1) % 3) + 1 THEN
          v_mnum := v_mnum + 1;
          INSERT INTO matches (
            season_id, season_week_id, home_team_id, away_team_id,
            match_number, status, scheduled_venue_id
          ) VALUES (
            v_season_id, v_week_ids[v_w],
            v_team_ids[v_pair[2]], v_team_ids[v_pair[3]],
            v_mnum, 'scheduled', v_venue_id
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'FULL dev seed complete.';
  RAISE NOTICE 'Logins (password "password"): dev@test.com (LO+captain),';
  RAISE NOTICE '  cap1@test.com, cap2@test.com, cap3@test.com (captains)';
  RAISE NOTICE '3 leagues (3v3 points / 5v5 percentage / 5v5 fargo 10-7),';
  RAISE NOTICE '  4 teams each, rosters filled, 12 weeks x 2 = 24 matches each.';
  RAISE NOTICE 'Sign in at http://localhost:5173/login as dev@test.com.';
  RAISE NOTICE '====================================================';
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
