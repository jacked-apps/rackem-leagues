/**
 * @fileoverview E2E test foundation seed (Playwright sandbox).
 *
 * Creates the local-only Playwright sandbox shared by all E2E specs:
 *   - 1 Test Organization
 *   - 1 Test Venue (with bar-box table numbers so the generated total_tables
 *     CHECK constraint passes)
 *   - 5 foundation users (auth.users + members rows): an LO, 3 captains,
 *     and 1 observer (no team affiliation; spectator role for live route)
 *
 * Distinct from supabase/seed_test_users.sql (which seeds RLS unit-test
 * users with a different password and naming convention). The two seeds
 * are intentionally non-overlapping: different emails (e2e-* vs *@test.com),
 * different system_player_number ranges (200001-200005 vs 100001-100004),
 * and different shared passwords (so the two test populations are not
 * credential-equivalent).
 *
 * SECURITY MODEL
 *
 *   LOCAL-ONLY. The DO block below refuses to run unless BOTH:
 *     - current_database() = 'postgres' (matches dev_bootstrap_full.sql's
 *       guard pattern)
 *     - GUC e2e.local_ok = 'true' (the pnpm e2e:setup runner sets this
 *       via `psql -c "SET e2e.local_ok = 'true'"` before running -f)
 *
 *   The database-name check is consistency-only; hosted Supabase projects
 *   (including staging) also use database name 'postgres'. The GUC is the
 *   real gate.
 *
 *   Password lives in each developer's .env.local as E2E_PW (gitignored).
 *   This file commits ONLY the bcrypt hash. The plaintext is documented
 *   in .env.example's comment; ask the team channel for the value.
 *
 * REGENERATING THE HASH
 *
 *   If you ever rotate E2E_PW, regenerate the hash with:
 *     pnpm dlx bcrypt-cli "$YOUR_NEW_PW" 10
 *   Replace E2E_PASSWORD_HASH below with the result. Cost factor 10,
 *   $2a$ prefix matches what GoTrue accepts.
 *
 * IDEMPOTENCY
 *
 *   The DELETE block at the top removes any prior e2e- foundation rows
 *   plus any throwaway leagues left behind by factory runs (named
 *   `e2e-YYYY-MM-DD-...`). Safe to re-run any time.
 *
 * FOUNDATION USERS (5 logins)
 *
 *   e2e-lo@test.test          League Operator
 *   e2e-captain-1@test.test   Captain — home team
 *   e2e-captain-2@test.test   Captain — away team
 *   e2e-captain-3@test.test   Reserve captain (3rd context when needed)
 *   e2e-observer@test.test    No team affiliation (spectator role)
 */

-- ============================================================================
-- Section 1: Safety guard (refuse to run on the wrong database)
-- ============================================================================

DO $$
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION
      'Refusing to run: database is "%", expected "postgres" (local Supabase). This script is dev-only.',
      current_database();
  END IF;

  IF coalesce(current_setting('e2e.local_ok', true), '') <> 'true' THEN
    RAISE EXCEPTION
      'Refusing to run: e2e.local_ok GUC is not set to "true". Run via "pnpm e2e:setup" which sets the GUC, or manually via "psql -c \"SET e2e.local_ok = ''true''\" -f database/e2e_seed.sql".';
  END IF;
END $$;

-- ============================================================================
-- Section 2: Cleanup (idempotency)
--
-- All E2E artifacts are scoped under one organization (E2E Test Org) with a
-- deterministic UUID. Deleting by that UUID covers both the foundation org
-- itself AND any throwaway leagues factories produce later. Order is leaf-
-- inward; explicit deletes are cheaper to reason about than relying on FK
-- cascade rules.
--
-- The leagues table has no `name` column — leagues are identified by their
-- (organization_id, division, day_of_week) combination. We don't need
-- division-level filtering since the org_id alone is unique to E2E.
-- ============================================================================

-- 2a. Throwaway leagues + their dependent rows (factories create these
-- under the foundation org).
DELETE FROM team_players
  WHERE team_id IN (
    SELECT t.id FROM teams t
    JOIN leagues l ON l.id = t.league_id
    WHERE l.organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM match_games
  WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN season_weeks sw ON sw.id = m.season_week_id
    JOIN seasons s ON s.id = sw.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM match_lineups
  WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN season_weeks sw ON sw.id = m.season_week_id
    JOIN seasons s ON s.id = sw.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM matches
  WHERE season_week_id IN (
    SELECT sw.id FROM season_weeks sw
    JOIN seasons s ON s.id = sw.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM season_weeks
  WHERE season_id IN (
    SELECT s.id FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM seasons
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM teams
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM league_venues
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid
  );

DELETE FROM leagues
  WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid;

-- 2b. Foundation org + venue + staff.
DELETE FROM organization_staff
  WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid;

DELETE FROM venues
  WHERE organization_id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid;

DELETE FROM organizations
  WHERE id = 'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid;

-- 2c. Foundation members (range-scoped) and auth.users (email-pattern-scoped).
DELETE FROM members
  WHERE system_player_number BETWEEN 200001 AND 200099;

DELETE FROM auth.users WHERE email LIKE 'e2e-%@test.test';

-- ============================================================================
-- Section 3: Foundation users (auth.users)
--
-- All 5 users share the same bcrypt hash, generated from E2E_PW (see header
-- comment for regeneration). email_confirmed_at = NOW() so the login flow
-- works without email-verification UI.
-- ============================================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
) VALUES
  -- LO
  (
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'e2e-lo@test.test',
    '$2a$10$zVsGyfqgT/TAJ11z.aIkF.3duWUArhPm8CQ/V5btFf7nVgsaKdDO6',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  ),
  -- Captain 1 (home team)
  (
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'e2e-captain-1@test.test',
    '$2a$10$zVsGyfqgT/TAJ11z.aIkF.3duWUArhPm8CQ/V5btFf7nVgsaKdDO6',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  ),
  -- Captain 2 (away team)
  (
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'e2e-captain-2@test.test',
    '$2a$10$zVsGyfqgT/TAJ11z.aIkF.3duWUArhPm8CQ/V5btFf7nVgsaKdDO6',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  ),
  -- Captain 3 (reserve / 3rd context)
  (
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'e2e-captain-3@test.test',
    '$2a$10$zVsGyfqgT/TAJ11z.aIkF.3duWUArhPm8CQ/V5btFf7nVgsaKdDO6',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  ),
  -- Observer (spectator route; members row exists, no team_members)
  (
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'e2e-observer@test.test',
    '$2a$10$zVsGyfqgT/TAJ11z.aIkF.3duWUArhPm8CQ/V5btFf7nVgsaKdDO6',
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Section 4: Foundation members (linked to auth.users via user_id)
--
-- system_player_number range: 200001-200005 (avoids the 100001-100004 used
-- by seed_test_users.sql and the BCA-10001+ range used by seed_members.sql).
-- ============================================================================

INSERT INTO members (
  id, user_id, first_name, last_name, email, phone, city, state,
  role, system_player_number, created_at, updated_at
) VALUES
  -- LO
  (
    'e0e0e0e0-bbbb-bbbb-bbbb-000000000001'::uuid,
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000001'::uuid,
    'E2E', 'LO',
    'e2e-lo@test.test', '555-0001',
    'Tampa', 'FL',
    'league_operator', 200001,
    NOW(), NOW()
  ),
  -- Captain 1
  (
    'e0e0e0e0-bbbb-bbbb-bbbb-000000000002'::uuid,
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000002'::uuid,
    'E2E', 'Captain One',
    'e2e-captain-1@test.test', '555-0002',
    'Tampa', 'FL',
    'player', 200002,
    NOW(), NOW()
  ),
  -- Captain 2
  (
    'e0e0e0e0-bbbb-bbbb-bbbb-000000000003'::uuid,
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000003'::uuid,
    'E2E', 'Captain Two',
    'e2e-captain-2@test.test', '555-0003',
    'Tampa', 'FL',
    'player', 200003,
    NOW(), NOW()
  ),
  -- Captain 3
  (
    'e0e0e0e0-bbbb-bbbb-bbbb-000000000004'::uuid,
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000004'::uuid,
    'E2E', 'Captain Three',
    'e2e-captain-3@test.test', '555-0004',
    'Tampa', 'FL',
    'player', 200004,
    NOW(), NOW()
  ),
  -- Observer
  (
    'e0e0e0e0-bbbb-bbbb-bbbb-000000000005'::uuid,
    'e0e0e0e0-aaaa-aaaa-aaaa-000000000005'::uuid,
    'E2E', 'Observer',
    'e2e-observer@test.test', '555-0005',
    'Tampa', 'FL',
    'player', 200005,
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Section 5: Test organization (with all NOT NULL fields populated per
-- dev_bootstrap_full.sql shape). created_by = LO's member id.
-- ============================================================================

INSERT INTO organizations (
  id,
  organization_name, organization_address, organization_city,
  organization_state, organization_zip_code,
  organization_email, organization_phone,
  stripe_customer_id, payment_method_id,
  card_last4, card_brand, expiry_month, expiry_year, billing_zip,
  created_by
) VALUES (
  'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid,
  'E2E Test Org',
  '1 E2E Test Lane',
  'Tampa',
  'FL',
  '33601',
  'e2e-lo@test.test',
  '555-0001',
  'cus_dev_e2e',
  'pm_dev_e2e',
  '4242', 'visa', 12, 2030, '33601',
  'e0e0e0e0-bbbb-bbbb-bbbb-000000000001'::uuid
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Section 6: Organization staff (LO as owner)
--
-- The create_owner_staff trigger fires on organization INSERT and writes to
-- organization_staff with column `position` (NOT `role`). When this seed
-- runs as service-role, the trigger may or may not populate correctly —
-- this manual INSERT with ON CONFLICT DO NOTHING covers both cases.
-- ============================================================================

INSERT INTO organization_staff (organization_id, member_id, position)
VALUES (
  'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid,
  'e0e0e0e0-bbbb-bbbb-bbbb-000000000001'::uuid,
  'owner'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Section 7: Test venue (bar_box_table_numbers populated to satisfy the
-- generated total_tables > 0 CHECK constraint per dev_bootstrap_full.sql).
-- ============================================================================

INSERT INTO venues (
  id, organization_id, name, street_address, city, state, zip_code, phone,
  bar_box_tables, regulation_tables, bar_box_table_numbers
) VALUES (
  'e0e0e0e0-dddd-dddd-dddd-dddddddddddd'::uuid,
  'e0e0e0e0-cccc-cccc-cccc-cccccccccccc'::uuid,
  'E2E Test Venue',
  '2 E2E Test Lane', 'Tampa', 'FL', '33601', '555-0001',
  4, 2, ARRAY[1, 2, 3, 4]
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Section 8: Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'E2E foundation rebuilt:';
  RAISE NOTICE '  Users: e2e-lo, e2e-captain-1, e2e-captain-2, e2e-captain-3, e2e-observer (all @test.test)';
  RAISE NOTICE '  Org:   E2E Test Org (id e0e0e0e0-cccc-cccc-cccc-cccccccccccc)';
  RAISE NOTICE '  Venue: E2E Test Venue (id e0e0e0e0-dddd-dddd-dddd-dddddddddddd)';
  RAISE NOTICE 'Run "pnpm test:e2e" to use this foundation.';
END $$;
