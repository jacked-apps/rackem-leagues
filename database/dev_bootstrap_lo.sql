-- ============================================================================
-- DEV-ONLY: Bootstrap a League-Operator test setup in one paste.
-- ============================================================================
--
-- WHAT THIS DOES
--   Given an email of an already-signed-up auth.users account, this script
--   creates (if missing) a matching members row, then creates an organization
--   (with you as owner via the create_owner_staff trigger) and one league
--   under it. Ready for LO testing in ~10 seconds.
--
-- WHAT IT DOES NOT DO
--   - Does NOT create the auth.users row. Sign up via the app first at
--     /register with email+password. Google OAuth also works if configured.
--   - Does NOT seed teams, seasons, or matches — just enough to exercise
--     operator settings, league settings, and the house-rules flows.
--
-- SAFETY
--   Guard below aborts if current_database() is not "postgres" (the local
--   Supabase default). Production DBs always have a different name.
--   Additionally aborts if the email placeholder hasn't been edited.
--   This file lives under database/ (NOT supabase/) so it is never auto-run
--   by `supabase db reset` or any migration tooling. It exists solely for
--   devs to paste into Supabase Studio > SQL Editor.
--
-- HOW TO USE
--   1. Start local Supabase (`pnpm exec supabase start`).
--   2. Sign up in the app with an email you'll remember.
--   3. (Optional) Complete the profile flow — but the script will create the
--      members row for you if you haven't.
--   4. Edit the CONFIG block below: v_email (required), org/league details.
--   5. Paste into Studio (http://127.0.0.1:54323) > SQL Editor > Run.
--   6. Copy the RAISE NOTICE output. Those are your new IDs.
--
-- ============================================================================

DO $$
DECLARE
  -- ===== EDIT THESE =====
  v_email          TEXT := 'REPLACE@example.com';
  v_first_name     TEXT := 'Test';
  v_last_name      TEXT := 'Operator';
  v_city           TEXT := 'Austin';
  v_state          TEXT := 'TX';
  v_org_name       TEXT := 'Test Pool League Organization';
  v_org_address    TEXT := '123 Main St';
  v_org_zip        TEXT := '78701';
  v_org_phone      TEXT := '555-0100';
  v_game_type      TEXT := 'eight_ball';  -- eight_ball | nine_ball | ten_ball
  v_day_of_week    TEXT := 'tuesday';
  -- (team_format was dropped from `leagues` in 20260502000000 — lineup size is
  --  now a modular league preference, configured via the app after seeding.)
  -- ===== END EDIT =====

  v_user_id   UUID;
  v_member_id UUID;
  v_org_id    UUID;
  v_league_id UUID;
BEGIN
  -- Guard 1: never run against prod.
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'Refusing to run: database is "%", expected "postgres" (local). This script is dev-only.', current_database();
  END IF;

  -- Guard 2: force you to edit the email.
  IF v_email = 'REPLACE@example.com' THEN
    RAISE EXCEPTION 'Edit v_email in the CONFIG block before running.';
  END IF;

  -- Find the auth user by email.
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for email "%". Register at /register first.', v_email;
  END IF;

  -- Upsert members row (create if missing, link to this auth user).
  SELECT id INTO v_member_id FROM members WHERE user_id = v_user_id;
  IF v_member_id IS NULL THEN
    INSERT INTO members (user_id, first_name, last_name, city, state, email, role)
    VALUES (v_user_id, v_first_name, v_last_name, v_city, v_state, v_email, 'league_operator')
    RETURNING id INTO v_member_id;
    RAISE NOTICE 'Created members row: %', v_member_id;
  ELSE
    RAISE NOTICE 'Using existing members row: %', v_member_id;
  END IF;

  -- Create the organization. The create_owner_staff trigger will auto-insert
  -- the organization_staff row with position='owner' using created_by.
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

  -- Create one league under the org.
  INSERT INTO leagues (
    organization_id, game_type, day_of_week, league_start_date
  ) VALUES (
    v_org_id, v_game_type, v_day_of_week, CURRENT_DATE
  ) RETURNING id INTO v_league_id;

  RAISE NOTICE '=== Bootstrap complete ===';
  RAISE NOTICE 'auth.user:       %', v_user_id;
  RAISE NOTICE 'member:          %', v_member_id;
  RAISE NOTICE 'organization:    %', v_org_id;
  RAISE NOTICE 'league:          %', v_league_id;
  RAISE NOTICE 'Org URL:         /operator-settings/%', v_org_id;
  RAISE NOTICE 'House rules URL: /league-rules/%', v_org_id;
  RAISE NOTICE 'League settings: /league-settings/%', v_league_id;
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
