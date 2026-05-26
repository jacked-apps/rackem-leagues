-- ============================================================================
-- DEV DATABASE STARTING POINT — single-paste setup for local dev work
-- ============================================================================
--
-- Goal: paste this once after `pnpm db:reset` and you have a fully usable
-- local dev environment. No /register, no manual form-filling, no clicking
-- around to create orgs or leagues — everything you need to start poking
-- at the app is here.
--
-- This file GROWS over time. We add a section every time the dev workflow
-- needs another piece of pre-built state. Always one file, always
-- idempotent (safe to re-run after re-resetting the DB).
--
-- Logins (all use password "password")
--
--   dev@test.com    — Lee Goperator (Lo)         — LO of Tester Org, captain of Team 3
--   cap1@test.com   — Johnny Captain (Johnny)    — Captain of Team 1
--   cap2@test.com   — Captain Smith (Smitty)     — Captain of Team 4
--   cap3@test.com   — Sally Captain (Sal)        — Captain of Team 2
--
-- How to use
--
--   1. pnpm db:reset            (re-applies migrations, clean schema)
--   2. Open Supabase Studio at http://localhost:54323
--   3. SQL Editor → paste the contents of this file → Run
--   4. Sign in to the app at http://localhost:5173/login as dev@test.com
--
-- Current scope (Steps 1–6 done)
--
--   [x] Step 1: 4 auth users (dev + 3 captains) profile-completed.
--   [x] Step 2: Member rows for all 4 logins.
--   [x] Step 3: "Tester Org" + dev as owner staff (mock Stripe, payment-
--               verified — no need to redo LO application).
--   [x] Step 4: 130 placeholder members from seed_fake_members.sql
--               (Florida-spread pool to fill rosters / test player search).
--   [x] Step 5: League 1 — "3v3 old school" (8-Ball Tuesday) starting
--               today. 16-week season + break + playoffs, 4 teams (each
--               rostered captain + 4 placeholders = 5), 34 matches.
--   [x] Step 6: League 2 — "Standard 5v5" (8-Ball Wednesday) starting
--               today+1. Same shape as League 1 but lineup_size=5,
--               handicap_type=percentage, points_system=bca_tiered,
--               team_format=8_man. Different 16 placeholders for rosters.
--   [x] Step 7: League 3 — "Fargo 5v5" (8-Ball Thursday) starting
--               today+2. lineup_size=5, handicap_type=fargo,
--               points_system=differential, team_format=5_man. Another
--               16 distinct placeholders for rosters.
--
-- Date handling: all dates are computed with CURRENT_DATE and offsets,
-- so the leagues always "start today / today+1 / today+2" regardless of
-- when you run this script.
--
-- Captain assignment across all 3 leagues
--
--   Each captain login is captain of "Team N" in every league, where:
--     Team 1 → cap1 (Johnny Captain)
--     Team 2 → cap3 (Sally Captain)
--     Team 3 → dev  (Lee Goperator)
--     Team 4 → cap2 (Captain Smith)
--
-- Roster non-overlap across leagues
--
--   Placeholders 1–16  → League 1 rosters
--   Placeholders 17–32 → League 2 rosters
--   Placeholders 33–48 → League 3 rosters
--   No member is on two teams at once across leagues.
--
-- Safety
--
--   The DO block at the top refuses to run unless current_database() is
--   'postgres' (matches local Supabase default).
--
-- Triggers we dodge (they auto-fill rows we'd otherwise duplicate)
--
--   organizations           → create_owner_staff_trigger (org_staff)
--                            trigger_create_org_preferences (org prefs)
--   leagues                 → trigger_create_league_preferences (empty
--                            preferences row — Step 5 UPSERTs onto it)
--   matches                 → trigger_auto_create_match_lineups (2 lineups
--                            per match — Step 5 doesn't insert lineups)
--
-- Why some auth fields look weird
--
--   GoTrue sign-in needs more than just a password hash:
--     - confirmation_token / recovery_token / email_change* must be ''
--       (empty string), NOT NULL — GoTrue Scan-errors on NULL
--     - An auth.identities row for the email provider — without it,
--       sign-in returns "Database error querying schema"
--   Both handled below.
--
-- ============================================================================

-- ============================================================================
-- Section 0: Safety guard
-- ============================================================================

DO $$
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION
      'Refusing to run: database is "%", expected "postgres" (local Supabase). This script is dev-only.',
      current_database();
  END IF;
END $$;

-- ============================================================================
-- Section 1: Cleanup (idempotent — safe to re-run)
--
-- Order: leaf-inward. Everything scoped to the foundation org
-- (Tester Org, id 01010101-cccc-…) gets removed cleanly. Placeholders
-- (members with email LIKE '%@example.com') get cleaned separately so
-- subsequent re-runs of the seed don't pile up duplicates.
-- ============================================================================

-- 1a. League chain (matches → match_lineups via trigger; team_players
-- references teams + members; etc.). Cascade by org_id ownership.

DELETE FROM match_lineups
  WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN seasons s ON s.id = m.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM match_games
  WHERE match_id IN (
    SELECT m.id FROM matches m
    JOIN seasons s ON s.id = m.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM matches
  WHERE season_id IN (
    SELECT s.id FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM season_weeks
  WHERE season_id IN (
    SELECT s.id FROM seasons s
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM seasons
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM team_players
  WHERE team_id IN (
    SELECT t.id FROM teams t
    JOIN leagues l ON l.id = t.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM teams
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

DELETE FROM league_venues
  WHERE league_id IN (
    SELECT id FROM leagues
    WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101'
  );

-- 1b. Preferences (no FK from prefs to leagues/orgs; entity_id-based).

DELETE FROM preferences
  WHERE entity_type = 'league'
    AND entity_id IN (
      SELECT id FROM leagues
      WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101'
    );

DELETE FROM preferences
  WHERE entity_type = 'organization'
    AND entity_id = '01010101-cccc-cccc-cccc-010101010101';

-- 1c. Leagues, venues, org staff, organizations.

DELETE FROM leagues
  WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';

DELETE FROM venues
  WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';

DELETE FROM organization_staff
  WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';

DELETE FROM organizations
  WHERE id = '01010101-cccc-cccc-cccc-010101010101';

-- 1d. Foundation members + placeholders + auth.

DELETE FROM members
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('dev@test.com', 'cap1@test.com', 'cap2@test.com', 'cap3@test.com')
  );

DELETE FROM members
  WHERE email LIKE '%@example.com';

DELETE FROM auth.identities
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('dev@test.com', 'cap1@test.com', 'cap2@test.com', 'cap3@test.com')
  );

DELETE FROM auth.users
  WHERE email IN ('dev@test.com', 'cap1@test.com', 'cap2@test.com', 'cap3@test.com');

-- ============================================================================
-- STEP 1: AUTH LOGINS (4 users — all password "password")
-- ============================================================================

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  (
    'dededede-dede-dede-dede-dededededede'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'dev@test.com',
    '$2a$10$K8ZVjU8Oc5P67Fdy1VK.vOxU/vbguRDS.2WAoAE46QhkW8aoIBdXO',
    NOW(),
    '{"provider": "email", "providers": ["email"]}', '{}',
    'authenticated', 'authenticated',
    NOW(), NOW(),
    '', '', '', ''
  ),
  (
    'c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'cap1@test.com',
    '$2a$10$K8ZVjU8Oc5P67Fdy1VK.vOxU/vbguRDS.2WAoAE46QhkW8aoIBdXO',
    NOW(),
    '{"provider": "email", "providers": ["email"]}', '{}',
    'authenticated', 'authenticated',
    NOW(), NOW(),
    '', '', '', ''
  ),
  (
    'c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'cap2@test.com',
    '$2a$10$K8ZVjU8Oc5P67Fdy1VK.vOxU/vbguRDS.2WAoAE46QhkW8aoIBdXO',
    NOW(),
    '{"provider": "email", "providers": ["email"]}', '{}',
    'authenticated', 'authenticated',
    NOW(), NOW(),
    '', '', '', ''
  ),
  (
    'c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3'::uuid,
    '00000000-0000-0000-0000-000000000000',
    'cap3@test.com',
    '$2a$10$K8ZVjU8Oc5P67Fdy1VK.vOxU/vbguRDS.2WAoAE46QhkW8aoIBdXO',
    NOW(),
    '{"provider": "email", "providers": ["email"]}', '{}',
    'authenticated', 'authenticated',
    NOW(), NOW(),
    '', '', '', ''
  );

-- Email-provider identities (auth.identities.email is generated — omit it)

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    'dededede-dede-dede-dede-dededededede',
    'dededede-dede-dede-dede-dededededede'::uuid,
    '{"sub":"dededede-dede-dede-dede-dededededede","email":"dev@test.com","email_verified":false,"phone_verified":false}'::jsonb,
    'email', NOW(), NOW(), NOW()
  ),
  (
    'c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1',
    'c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1'::uuid,
    '{"sub":"c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1","email":"cap1@test.com","email_verified":false,"phone_verified":false}'::jsonb,
    'email', NOW(), NOW(), NOW()
  ),
  (
    'c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2',
    'c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2'::uuid,
    '{"sub":"c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2","email":"cap2@test.com","email_verified":false,"phone_verified":false}'::jsonb,
    'email', NOW(), NOW(), NOW()
  ),
  (
    'c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3',
    'c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3'::uuid,
    '{"sub":"c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3","email":"cap3@test.com","email_verified":false,"phone_verified":false}'::jsonb,
    'email', NOW(), NOW(), NOW()
  );

-- ============================================================================
-- STEP 2: MEMBER PROFILES (pre-completed — no /complete-profile redirect)
-- ============================================================================

INSERT INTO members (
  id, user_id, first_name, last_name, nickname, email,
  city, state, role
) VALUES
  (
    'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0'::uuid,
    'dededede-dede-dede-dede-dededededede'::uuid,
    'Lee', 'Goperator', 'Lo',
    'dev@test.com', 'Somecity', 'FL', 'league_operator'
  ),
  (
    'c1c1c1c1-bbbb-bbbb-bbbb-c1c1c1c1c1c1'::uuid,
    'c1c1c1c1-aaaa-aaaa-aaaa-c1c1c1c1c1c1'::uuid,
    'Johnny', 'Captain', 'Johnny',
    'cap1@test.com', 'Somecity', 'FL', 'player'
  ),
  (
    'c2c2c2c2-bbbb-bbbb-bbbb-c2c2c2c2c2c2'::uuid,
    'c2c2c2c2-aaaa-aaaa-aaaa-c2c2c2c2c2c2'::uuid,
    'Captain', 'Smith', 'Smitty',
    'cap2@test.com', 'Somecity', 'FL', 'player'
  ),
  (
    'c3c3c3c3-bbbb-bbbb-bbbb-c3c3c3c3c3c3'::uuid,
    'c3c3c3c3-aaaa-aaaa-aaaa-c3c3c3c3c3c3'::uuid,
    'Sally', 'Captain', 'Sal',
    'cap3@test.com', 'Somecity', 'FL', 'player'
  );

-- ============================================================================
-- STEP 3: ORGANIZATION (LO staff + org preferences auto-created by triggers)
-- ============================================================================

INSERT INTO organizations (
  id, organization_name, organization_address, organization_city,
  organization_state, organization_zip_code,
  organization_email, organization_email_visibility,
  organization_phone, organization_phone_visibility,
  stripe_customer_id, payment_method_id,
  card_last4, card_brand, expiry_month, expiry_year, billing_zip,
  payment_verified, profanity_filter_enabled,
  created_by
) VALUES (
  '01010101-cccc-cccc-cccc-010101010101'::uuid,
  'Tester Org',
  '',
  'Somecity', 'FL', '',
  'dev@test.com', 'my_teams',
  '', 'my_teams',
  'cus_dev_tester_org', 'pm_dev_tester_org',
  '4242', 'visa', 12, 2027, '12345',
  TRUE, TRUE,
  'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0'::uuid
);

-- (organization_staff and organization-level preferences auto-created
-- by triggers above. Don't insert manually.)

-- ============================================================================
-- STEP 4: 130 PLACEHOLDER MEMBERS
--
-- Copied inline from database/seed_fake_members.sql — Florida-spread
-- pool of placeholders (no user_id, can't log in). Used to fill team
-- rosters in Step 5 and to test captain-search / player-lookup UX.
-- system_player_number is auto-assigned by the table's sequence.
-- ============================================================================

INSERT INTO members (first_name, last_name, nickname, phone, email, address, city, state, zip_code, date_of_birth, role, bca_member_number) VALUES
-- Miami Area (33101-33199)
('James', 'Anderson', 'Jimmy', '305-555-0101', 'james.anderson@example.com', '1001 Biscayne Blvd', 'Miami', 'FL', '33101', '1985-03-15', 'player', '123456'),
('Maria', 'Garcia', 'Maria', '305-555-0102', 'maria.garcia@example.com', '1002 Ocean Drive', 'Miami', 'FL', '33139', '1990-07-22', 'player', NULL),
('Robert', 'Martinez', 'Bobby', '305-555-0103', 'robert.martinez@example.com', '1003 Collins Ave', 'Miami Beach', 'FL', '33140', '1982-11-08', 'player', NULL),
('Jennifer', 'Rodriguez', 'Jenny', '305-555-0104', 'jennifer.rodriguez@example.com', '1004 Washington Ave', 'Miami Beach', 'FL', '33139', '1995-02-14', 'player', '234567'),
('Michael', 'Hernandez', 'Mike', '305-555-0105', 'michael.hernandez@example.com', '1005 Alton Rd', 'Miami Beach', 'FL', '33139', '1988-09-30', 'player', NULL),
('Lisa', 'Lopez', 'Lisa', '305-555-0106', 'lisa.lopez@example.com', '1006 Flagler St', 'Miami', 'FL', '33130', '1992-05-18', 'player', NULL),
('David', 'Gonzalez', 'Dave', '305-555-0107', 'david.gonzalez@example.com', '1007 Coral Way', 'Miami', 'FL', '33145', '1987-12-25', 'player', '345678'),
('Sarah', 'Wilson', 'Sarah', '305-555-0108', 'sarah.wilson@example.com', '1008 SW 8th St', 'Miami', 'FL', '33135', '1991-08-07', 'player', NULL),
('Christopher', 'Perez', 'Chris', '305-555-0109', 'christopher.perez@example.com', '1009 NW 7th St', 'Miami', 'FL', '33136', '1984-04-20', 'player', NULL),
('Jessica', 'Sanchez', 'Jess', '305-555-0110', 'jessica.sanchez@example.com', '1010 Brickell Ave', 'Miami', 'FL', '33131', '1993-10-12', 'player', '456789'),
-- Tampa Area (33601-33699)
('Daniel', 'Ramirez', 'Danny', '813-555-0201', 'daniel.ramirez@example.com', '2001 Tampa St', 'Tampa', 'FL', '33602', '1986-01-30', 'player', NULL),
('Emily', 'Torres', 'Emily', '813-555-0202', 'emily.torres@example.com', '2002 Kennedy Blvd', 'Tampa', 'FL', '33602', '1994-06-15', 'player', NULL),
('Matthew', 'Rivera', 'Matt', '813-555-0203', 'matthew.rivera@example.com', '2003 Bayshore Blvd', 'Tampa', 'FL', '33606', '1989-03-22', 'player', '567890'),
('Amanda', 'Flores', 'Amanda', '813-555-0204', 'amanda.flores@example.com', '2004 Davis Islands', 'Tampa', 'FL', '33606', '1992-09-08', 'player', NULL),
('Joshua', 'Gomez', 'Josh', '813-555-0205', 'joshua.gomez@example.com', '2005 Hyde Park Ave', 'Tampa', 'FL', '33606', '1983-12-19', 'player', NULL),
('Ashley', 'Reyes', 'Ash', '813-555-0206', 'ashley.reyes@example.com', '2006 Armenia Ave', 'Tampa', 'FL', '33607', '1990-07-04', 'player', '678901'),
('Andrew', 'Cruz', 'Andy', '813-555-0207', 'andrew.cruz@example.com', '2007 Dale Mabry Hwy', 'Tampa', 'FL', '33609', '1987-02-28', 'player', NULL),
('Stephanie', 'Morales', 'Steph', '813-555-0208', 'stephanie.morales@example.com', '2008 Henderson Blvd', 'Tampa', 'FL', '33609', '1995-11-16', 'player', NULL),
('Ryan', 'Gutierrez', 'Ryan', '813-555-0209', 'ryan.gutierrez@example.com', '2009 Cypress St', 'Tampa', 'FL', '33607', '1988-05-23', 'player', '789012'),
('Nicole', 'Ortiz', 'Nikki', '813-555-0210', 'nicole.ortiz@example.com', '2010 Florida Ave', 'Tampa', 'FL', '33602', '1991-08-10', 'player', NULL),
-- Orlando Area (32801-32899)
('Brandon', 'Jimenez', 'Brandon', '407-555-0301', 'brandon.jimenez@example.com', '3001 Orange Ave', 'Orlando', 'FL', '32801', '1985-04-17', 'player', NULL),
('Melissa', 'Ruiz', 'Mel', '407-555-0302', 'melissa.ruiz@example.com', '3002 Church St', 'Orlando', 'FL', '32801', '1993-10-05', 'player', '890123'),
('Jonathan', 'Diaz', 'Jon', '407-555-0303', 'jonathan.diaz@example.com', '3003 Colonial Dr', 'Orlando', 'FL', '32803', '1989-01-12', 'player', NULL),
('Heather', 'Mendoza', 'Heather', '407-555-0304', 'heather.mendoza@example.com', '3004 Mills Ave', 'Orlando', 'FL', '32803', '1991-06-29', 'player', NULL),
('Justin', 'Castro', 'Justin', '407-555-0305', 'justin.castro@example.com', '3005 Bumby Ave', 'Orlando', 'FL', '32803', '1986-09-14', 'player', '901234'),
('Lauren', 'Vargas', 'Lauren', '407-555-0306', 'lauren.vargas@example.com', '3006 Summerlin Ave', 'Orlando', 'FL', '32806', '1994-03-20', 'player', NULL),
('Kevin', 'Romero', 'Kevin', '407-555-0307', 'kevin.romero@example.com', '3007 Curry Ford Rd', 'Orlando', 'FL', '32806', '1987-12-08', 'player', NULL),
('Rachel', 'Medina', 'Rachel', '407-555-0308', 'rachel.medina@example.com', '3008 Hoffner Ave', 'Orlando', 'FL', '32822', '1992-07-25', 'player', '012345'),
('Tyler', 'Aguilar', 'Tyler', '407-555-0309', 'tyler.aguilar@example.com', '3009 Sand Lake Rd', 'Orlando', 'FL', '32819', '1988-02-11', 'player', NULL),
('Amber', 'Moreno', 'Amber', '407-555-0310', 'amber.moreno@example.com', '3010 Conroy Rd', 'Orlando', 'FL', '32839', '1990-11-03', 'player', NULL),
-- Jacksonville Area
('Eric', 'Ramos', 'Eric', '904-555-0401', 'eric.ramos@example.com', '4001 Bay St', 'Jacksonville', 'FL', '32202', '1984-05-19', 'player', '123450'),
('Michelle', 'Santos', 'Michelle', '904-555-0402', 'michelle.santos@example.com', '4002 Main St', 'Jacksonville', 'FL', '32202', '1991-09-27', 'player', NULL),
('Jacob', 'Navarro', 'Jake', '904-555-0403', 'jacob.navarro@example.com', '4003 Ocean Blvd', 'Jacksonville Beach', 'FL', '32250', '1987-01-14', 'player', NULL),
('Danielle', 'Campos', 'Dani', '904-555-0404', 'danielle.campos@example.com', '4004 Beach Blvd', 'Jacksonville Beach', 'FL', '32250', '1995-06-08', 'player', '234560'),
('Aaron', 'Delgado', 'Aaron', '904-555-0405', 'aaron.delgado@example.com', '4005 Atlantic Blvd', 'Jacksonville', 'FL', '32225', '1989-10-22', 'player', NULL),
('Brittany', 'Guerrero', 'Brittany', '904-555-0406', 'brittany.guerrero@example.com', '4006 Southside Blvd', 'Jacksonville', 'FL', '32256', '1993-03-16', 'player', NULL),
('Nathan', 'Ortega', 'Nate', '904-555-0407', 'nathan.ortega@example.com', '4007 St Johns Ave', 'Jacksonville', 'FL', '32205', '1986-08-30', 'player', '345670'),
('Samantha', 'Fuentes', 'Sam', '904-555-0408', 'samantha.fuentes@example.com', '4008 University Blvd', 'Jacksonville', 'FL', '32211', '1992-12-13', 'player', NULL),
('Kyle', 'Valdez', 'Kyle', '904-555-0409', 'kyle.valdez@example.com', '4009 Beach Blvd', 'Jacksonville', 'FL', '32207', '1988-04-26', 'player', NULL),
('Christina', 'Salazar', 'Chris', '904-555-0410', 'christina.salazar@example.com', '4010 San Jose Blvd', 'Jacksonville', 'FL', '32217', '1990-07-19', 'player', '456780'),
-- Fort Lauderdale Area
('Adam', 'Castillo', 'Adam', '954-555-0501', 'adam.castillo@example.com', '5001 Las Olas Blvd', 'Fort Lauderdale', 'FL', '33301', '1985-02-23', 'player', NULL),
('Kelly', 'Jimenez', 'Kelly', '954-555-0502', 'kelly.jimenez@example.com', '5002 Sunrise Blvd', 'Fort Lauderdale', 'FL', '33304', '1991-08-15', 'player', NULL),
('Jason', 'Miranda', 'Jason', '954-555-0503', 'jason.miranda@example.com', '5003 Oakland Park Blvd', 'Fort Lauderdale', 'FL', '33306', '1987-11-28', 'player', '567891'),
('Megan', 'Rojas', 'Megan', '954-555-0504', 'megan.rojas@example.com', '5004 Commercial Blvd', 'Fort Lauderdale', 'FL', '33308', '1994-05-07', 'player', NULL),
('Brian', 'Acosta', 'Brian', '954-555-0505', 'brian.acosta@example.com', '5005 Federal Hwy', 'Fort Lauderdale', 'FL', '33308', '1989-09-19', 'player', NULL),
('Laura', 'Contreras', 'Laura', '954-555-0506', 'laura.contreras@example.com', '5006 Sample Rd', 'Pompano Beach', 'FL', '33064', '1992-01-31', 'player', '678902'),
('Scott', 'Luna', 'Scott', '954-555-0507', 'scott.luna@example.com', '5007 Atlantic Blvd', 'Pompano Beach', 'FL', '33062', '1986-06-12', 'player', NULL),
('Angela', 'Herrera', 'Angie', '954-555-0508', 'angela.herrera@example.com', '5008 Copans Rd', 'Pompano Beach', 'FL', '33064', '1993-10-24', 'player', NULL),
('Timothy', 'Dominguez', 'Tim', '954-555-0509', 'timothy.dominguez@example.com', '5009 McNab Rd', 'Pompano Beach', 'FL', '33069', '1988-03-08', 'player', '789013'),
('Rebecca', 'Estrada', 'Becca', '954-555-0510', 'rebecca.estrada@example.com', '5010 Sample Rd', 'Coral Springs', 'FL', '33065', '1991-07-16', 'player', NULL),
-- St. Petersburg Area
('Jeremy', 'Figueroa', 'Jeremy', '727-555-0601', 'jeremy.figueroa@example.com', '6001 Central Ave', 'St. Petersburg', 'FL', '33701', '1984-09-21', 'player', NULL),
('Crystal', 'Cardenas', 'Crystal', '727-555-0602', 'crystal.cardenas@example.com', '6002 4th St N', 'St. Petersburg', 'FL', '33701', '1992-02-14', 'player', '890124'),
('Patrick', 'Vega', 'Pat', '727-555-0603', 'patrick.vega@example.com', '6003 Beach Dr', 'St. Petersburg', 'FL', '33701', '1988-06-29', 'player', NULL),
('Kimberly', 'Leon', 'Kim', '727-555-0604', 'kimberly.leon@example.com', '6004 1st Ave N', 'St. Petersburg', 'FL', '33701', '1995-11-10', 'player', NULL),
('Sean', 'Soto', 'Sean', '727-555-0605', 'sean.soto@example.com', '6005 Tyrone Blvd', 'St. Petersburg', 'FL', '33710', '1987-04-03', 'player', '901235'),
('Tiffany', 'Cortez', 'Tiff', '727-555-0606', 'tiffany.cortez@example.com', '6006 66th St N', 'St. Petersburg', 'FL', '33709', '1993-08-18', 'player', NULL),
('Gregory', 'Pacheco', 'Greg', '727-555-0607', 'gregory.pacheco@example.com', '6007 38th Ave N', 'St. Petersburg', 'FL', '33710', '1986-12-26', 'player', NULL),
('Vanessa', 'Calderon', 'Vanessa', '727-555-0608', 'vanessa.calderon@example.com', '6008 Park Blvd', 'Pinellas Park', 'FL', '33781', '1991-05-09', 'player', '012346'),
('Peter', 'Alvarado', 'Peter', '727-555-0609', 'peter.alvarado@example.com', '6009 49th St N', 'St. Petersburg', 'FL', '33709', '1989-09-24', 'player', NULL),
('Monica', 'Galindo', 'Monica', '727-555-0610', 'monica.galindo@example.com', '6010 Ulmerton Rd', 'Largo', 'FL', '33771', '1994-01-15', 'player', NULL),
-- Tallahassee Area
('Bradley', 'Ibarra', 'Brad', '850-555-0701', 'bradley.ibarra@example.com', '7001 Tennessee St', 'Tallahassee', 'FL', '32304', '1985-07-28', 'player', '123451'),
('Catherine', 'Velasquez', 'Cathy', '850-555-0702', 'catherine.velasquez@example.com', '7002 Apalachee Pkwy', 'Tallahassee', 'FL', '32301', '1992-11-06', 'player', NULL),
('Kenneth', 'Maldonado', 'Ken', '850-555-0703', 'kenneth.maldonado@example.com', '7003 Monroe St', 'Tallahassee', 'FL', '32303', '1988-03-19', 'player', NULL),
('Diana', 'Espinoza', 'Diana', '850-555-0704', 'diana.espinoza@example.com', '7004 Capital Cir', 'Tallahassee', 'FL', '32308', '1993-07-31', 'player', '234561'),
('Richard', 'Mejia', 'Rick', '850-555-0705', 'richard.mejia@example.com', '7005 Thomasville Rd', 'Tallahassee', 'FL', '32308', '1987-10-13', 'player', NULL),
('Alexis', 'Orozco', 'Alexis', '850-555-0706', 'alexis.orozco@example.com', '7006 Mahan Dr', 'Tallahassee', 'FL', '32308', '1991-02-25', 'player', NULL),
('Dennis', 'Sandoval', 'Dennis', '850-555-0707', 'dennis.sandoval@example.com', '7007 Pensacola St', 'Tallahassee', 'FL', '32304', '1986-06-08', 'player', '345671'),
('Sharon', 'Ochoa', 'Sharon', '850-555-0708', 'sharon.ochoa@example.com', '7008 Magnolia Dr', 'Tallahassee', 'FL', '32301', '1994-10-20', 'player', NULL),
('Jerry', 'Cervantes', 'Jerry', '850-555-0709', 'jerry.cervantes@example.com', '7009 Lafayette St', 'Tallahassee', 'FL', '32301', '1989-01-02', 'player', NULL),
('Cynthia', 'Cabrera', 'Cindy', '850-555-0710', 'cynthia.cabrera@example.com', '7010 Gaines St', 'Tallahassee', 'FL', '32304', '1992-05-17', 'player', '456781'),
-- Pensacola Area
('Raymond', 'Nunez', 'Ray', '850-555-0801', 'raymond.nunez@example.com', '8001 Palafox St', 'Pensacola', 'FL', '32501', '1984-08-22', 'player', NULL),
('Pamela', 'Rios', 'Pam', '850-555-0802', 'pamela.rios@example.com', '8002 Navy Blvd', 'Pensacola', 'FL', '32507', '1990-12-04', 'player', NULL),
('Harold', 'Pena', 'Harold', '850-555-0803', 'harold.pena@example.com', '8003 Gulf Beach Hwy', 'Pensacola', 'FL', '32507', '1987-04-16', 'player', '567892'),
('Julie', 'Montoya', 'Julie', '850-555-0804', 'julie.montoya@example.com', '8004 Davis Hwy', 'Pensacola', 'FL', '32514', '1993-08-28', 'player', NULL),
('Carl', 'Blanco', 'Carl', '850-555-0805', 'carl.blanco@example.com', '8005 9th Ave', 'Pensacola', 'FL', '32514', '1988-11-09', 'player', NULL),
('Frances', 'Rubio', 'Frances', '850-555-0806', 'frances.rubio@example.com', '8006 Perdido Key Dr', 'Pensacola', 'FL', '32507', '1991-03-23', 'player', '678903'),
('Roy', 'Marquez', 'Roy', '850-555-0807', 'roy.marquez@example.com', '8007 Brent Ln', 'Pensacola', 'FL', '32503', '1985-07-06', 'player', NULL),
('Martha', 'Zavala', 'Martha', '850-555-0808', 'martha.zavala@example.com', '8008 Summit Blvd', 'Pensacola', 'FL', '32505', '1992-10-18', 'player', NULL),
('Willie', 'Osorio', 'Willie', '850-555-0809', 'willie.osorio@example.com', '8009 Mobile Hwy', 'Pensacola', 'FL', '32506', '1989-02-01', 'player', '789014'),
('Virginia', 'Robles', 'Ginny', '850-555-0810', 'virginia.robles@example.com', '8010 Creighton Rd', 'Pensacola', 'FL', '32504', '1994-06-14', 'player', NULL),
-- Clearwater Area
('Albert', 'Molina', 'Al', '727-555-0901', 'albert.molina@example.com', '9001 Gulf to Bay Blvd', 'Clearwater', 'FL', '33759', '1986-09-11', 'player', NULL),
('Joyce', 'Valencia', 'Joyce', '727-555-0902', 'joyce.valencia@example.com', '9002 Belleair Rd', 'Clearwater', 'FL', '33756', '1991-01-24', 'player', '890125'),
('Joe', 'Carrillo', 'Joe', '727-555-0903', 'joe.carrillo@example.com', '9003 Drew St', 'Clearwater', 'FL', '33755', '1988-05-07', 'player', NULL),
('Kathryn', 'Rosales', 'Kate', '727-555-0904', 'kathryn.rosales@example.com', '9004 Sunset Point Rd', 'Clearwater', 'FL', '33759', '1993-09-19', 'player', NULL),
('Frank', 'Vasquez', 'Frank', '727-555-0905', 'frank.vasquez@example.com', '9005 Court St', 'Clearwater', 'FL', '33756', '1987-12-31', 'player', '901236'),
('Judith', 'Carmona', 'Judy', '727-555-0906', 'judith.carmona@example.com', '9006 Cleveland St', 'Clearwater', 'FL', '33755', '1992-04-13', 'player', NULL),
('Douglas', 'Cano', 'Doug', '727-555-0907', 'douglas.cano@example.com', '9007 Keene Rd', 'Clearwater', 'FL', '33755', '1986-08-26', 'player', NULL),
('Evelyn', 'Barrera', 'Evelyn', '727-555-0908', 'evelyn.barrera@example.com', '9008 Missouri Ave', 'Clearwater', 'FL', '33756', '1994-12-08', 'player', '012347'),
('Henry', 'Esquivel', 'Hank', '727-555-0909', 'henry.esquivel@example.com', '9009 Highland Ave', 'Clearwater', 'FL', '33755', '1989-03-21', 'player', NULL),
('Teresa', 'Villarreal', 'Teresa', '727-555-0910', 'teresa.villarreal@example.com', '9010 Bayshore Blvd', 'Clearwater', 'FL', '33767', '1991-07-03', 'player', NULL),
-- Sarasota Area
('Walter', 'Zamora', 'Walt', '941-555-1001', 'walter.zamora@example.com', '10001 Main St', 'Sarasota', 'FL', '34236', '1985-10-15', 'player', '123452'),
('Ann', 'Montes', 'Ann', '941-555-1002', 'ann.montes@example.com', '10002 Tamiami Trail', 'Sarasota', 'FL', '34231', '1992-02-27', 'player', NULL),
('Ralph', 'Duarte', 'Ralph', '941-555-1003', 'ralph.duarte@example.com', '10003 Fruitville Rd', 'Sarasota', 'FL', '34232', '1988-06-10', 'player', NULL),
('Janice', 'Quiroz', 'Jan', '941-555-1004', 'janice.quiroz@example.com', '10004 Bee Ridge Rd', 'Sarasota', 'FL', '34233', '1993-10-22', 'player', '234562'),
('Roger', 'Barajas', 'Roger', '941-555-1005', 'roger.barajas@example.com', '10005 Clark Rd', 'Sarasota', 'FL', '34233', '1987-01-04', 'player', NULL),
('Marie', 'Velazquez', 'Marie', '941-555-1006', 'marie.velazquez@example.com', '10006 Stickney Point Rd', 'Sarasota', 'FL', '34231', '1991-05-18', 'player', NULL),
('Jack', 'Camacho', 'Jack', '941-555-1007', 'jack.camacho@example.com', '10007 Siesta Dr', 'Sarasota', 'FL', '34242', '1986-09-30', 'player', '345672'),
('Diane', 'Bautista', 'Diane', '941-555-1008', 'diane.bautista@example.com', '10008 Gulf Gate Dr', 'Sarasota', 'FL', '34231', '1994-01-11', 'player', NULL),
('Arthur', 'Avila', 'Art', '941-555-1009', 'arthur.avila@example.com', '10009 Beneva Rd', 'Sarasota', 'FL', '34238', '1989-05-24', 'player', NULL),
('Joan', 'Corona', 'Joan', '941-555-1010', 'joan.corona@example.com', '10010 McIntosh Rd', 'Sarasota', 'FL', '34232', '1992-09-06', 'player', '456782'),
-- Cape Coral Area
('Eugene', 'Cordova', 'Gene', '239-555-1101', 'eugene.cordova@example.com', '11001 Del Prado Blvd', 'Cape Coral', 'FL', '33909', '1984-11-17', 'player', NULL),
('Cheryl', 'Escobar', 'Cheryl', '239-555-1102', 'cheryl.escobar@example.com', '11002 Santa Barbara Blvd', 'Cape Coral', 'FL', '33991', '1990-03-30', 'player', NULL),
('Russell', 'Munoz', 'Russ', '239-555-1103', 'russell.munoz@example.com', '11003 Pine Island Rd', 'Cape Coral', 'FL', '33909', '1987-07-12', 'player', '567893'),
('Carolyn', 'Lara', 'Carolyn', '239-555-1104', 'carolyn.lara@example.com', '11004 Cape Coral Pkwy', 'Cape Coral', 'FL', '33904', '1993-11-24', 'player', NULL),
('Philip', 'Calderon', 'Phil', '239-555-1105', 'philip.calderon@example.com', '11005 Veterans Pkwy', 'Cape Coral', 'FL', '33914', '1988-02-06', 'player', NULL),
('Janet', 'Paz', 'Janet', '239-555-1106', 'janet.paz@example.com', '11006 Chiquita Blvd', 'Cape Coral', 'FL', '33993', '1991-06-19', 'player', '678904'),
('Billy', 'Gil', 'Billy', '239-555-1107', 'billy.gil@example.com', '11007 Skyline Blvd', 'Cape Coral', 'FL', '33914', '1985-10-01', 'player', NULL),
('Betty', 'Tovar', 'Betty', '239-555-1108', 'betty.tovar@example.com', '11008 Hancock Bridge Pkwy', 'Cape Coral', 'FL', '33990', '1992-01-13', 'player', NULL),
('Bobby', 'Delacruz', 'Bobby', '239-555-1109', 'bobby.delacruz@example.com', '11009 Embers Pkwy', 'Cape Coral', 'FL', '33993', '1989-05-26', 'player', '789015'),
('Gloria', 'Mata', 'Gloria', '239-555-1110', 'gloria.mata@example.com', '11010 Nicholas Pkwy', 'Cape Coral', 'FL', '33990', '1994-09-08', 'player', NULL),
-- Port St. Lucie Area
('Lawrence', 'Fernandez', 'Larry', '772-555-1201', 'lawrence.fernandez@example.com', '12001 US Highway 1', 'Port St. Lucie', 'FL', '34952', '1986-12-20', 'player', NULL),
('Doris', 'Alonso', 'Doris', '772-555-1202', 'doris.alonso@example.com', '12002 SW Port St Lucie Blvd', 'Port St. Lucie', 'FL', '34953', '1991-04-02', 'player', '890126'),
('Louis', 'Trujillo', 'Lou', '772-555-1203', 'louis.trujillo@example.com', '12003 SE Walton Rd', 'Port St. Lucie', 'FL', '34952', '1988-08-15', 'player', NULL),
('Marilyn', 'Rosario', 'Marilyn', '772-555-1204', 'marilyn.rosario@example.com', '12004 SW Darwin Blvd', 'Port St. Lucie', 'FL', '34987', '1993-12-27', 'player', NULL),
('Gerald', 'Quintero', 'Gerald', '772-555-1205', 'gerald.quintero@example.com', '12005 Gatlin Blvd', 'Port St. Lucie', 'FL', '34953', '1987-03-10', 'player', '901237'),
('Norma', 'Elizondo', 'Norma', '772-555-1206', 'norma.elizondo@example.com', '12006 SW Cashmere Blvd', 'Port St. Lucie', 'FL', '34987', '1992-07-23', 'player', NULL),
('Keith', 'Bustamante', 'Keith', '772-555-1207', 'keith.bustamante@example.com', '12007 SW California Blvd', 'Port St. Lucie', 'FL', '34987', '1986-11-05', 'player', NULL),
('Alice', 'Olvera', 'Alice', '772-555-1208', 'alice.olvera@example.com', '12008 SW Bayshore Blvd', 'Port St. Lucie', 'FL', '34987', '1994-03-18', 'player', '012348'),
('Craig', 'Arellano', 'Craig', '772-555-1209', 'craig.arellano@example.com', '12009 SW Becker Rd', 'Port St. Lucie', 'FL', '34987', '1989-06-30', 'player', NULL),
('Debra', 'Guillen', 'Deb', '772-555-1210', 'debra.guillen@example.com', '12010 SW Jennings Ave', 'Port St. Lucie', 'FL', '34987', '1991-10-12', 'player', NULL),
-- Hialeah Area
('Wayne', 'Solis', 'Wayne', '305-555-1301', 'wayne.solis@example.com', '13001 W 49th St', 'Hialeah', 'FL', '33012', '1985-01-25', 'player', '123453'),
('Theresa', 'Lugo', 'Terry', '305-555-1302', 'theresa.lugo@example.com', '13002 Palm Ave', 'Hialeah', 'FL', '33010', '1992-05-08', 'player', NULL),
('Randy', 'Navarro', 'Randy', '305-555-1303', 'randy.navarro@example.com', '13003 E 4th Ave', 'Hialeah', 'FL', '33013', '1988-09-20', 'player', NULL),
('Tammy', 'Cisneros', 'Tammy', '305-555-1304', 'tammy.cisneros@example.com', '13004 NW 79th St', 'Hialeah', 'FL', '33016', '1993-01-01', 'player', '234563'),
('Howard', 'Nieves', 'Howard', '305-555-1305', 'howard.nieves@example.com', '13005 W 84th St', 'Hialeah', 'FL', '33014', '1987-05-15', 'player', NULL),
('Shirley', 'Galvan', 'Shirley', '305-555-1306', 'shirley.galvan@example.com', '13006 E 8th Ave', 'Hialeah', 'FL', '33013', '1991-09-27', 'player', NULL),
('Larry', 'Andrade', 'Larry', '305-555-1307', 'larry.andrade@example.com', '13007 W 20th Ave', 'Hialeah', 'FL', '33010', '1986-01-09', 'player', '345673'),
('Brenda', 'Jaramillo', 'Brenda', '305-555-1308', 'brenda.jaramillo@example.com', '13008 NW 103rd St', 'Hialeah', 'FL', '33018', '1994-05-22', 'player', NULL),
('Eugene', 'Collazo', 'Gene', '305-555-1309', 'eugene.collazo@example.com', '13009 SE 3rd Ct', 'Hialeah', 'FL', '33010', '1989-08-03', 'player', NULL),
('Katherine', 'Lucero', 'Kathy', '305-555-1310', 'katherine.lucero@example.com', '13010 W 12th Ave', 'Hialeah', 'FL', '33012', '1992-12-16', 'player', '456783');

-- ============================================================================
-- STEP 5: LEAGUE + SEASON + VENUE + TEAMS + ROSTERS + MATCHES
--
-- All in one DO block so we can use variables for IDs and arrays. The
-- league captures the "3v3 old school" setup from the LO wizard. Dates
-- are dynamic (CURRENT_DATE + offsets) so the league always starts
-- "today" no matter when this script runs.
-- ============================================================================

DO $$
DECLARE
  v_org_id      UUID := '01010101-cccc-cccc-cccc-010101010101';
  v_league_id   UUID := '0c0c0c0c-1111-1111-1111-0c0c0c0c0c0c';
  v_season_id   UUID := '0c0c0c0c-2222-2222-2222-0c0c0c0c0c0c';
  v_venue_id    UUID := '0c0c0c0c-3333-3333-3333-0c0c0c0c0c0c';
  v_team_ids    UUID[] := ARRAY[
    '7e7e7e7e-1111-1111-1111-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-2222-2222-2222-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-3333-3333-3333-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-4444-4444-4444-7e7e7e7e7e7e'::uuid
  ];
  -- Captain member ids matching the "captured" assignment from the wizard:
  --   Team 1 captain = cap1 (Johnny Captain)
  --   Team 2 captain = cap3 (Sally Captain)
  --   Team 3 captain = dev (Lee Goperator)
  --   Team 4 captain = cap2 (Captain Smith)
  v_captain_ids UUID[] := ARRAY[
    'c1c1c1c1-bbbb-bbbb-bbbb-c1c1c1c1c1c1'::uuid,
    'c3c3c3c3-bbbb-bbbb-bbbb-c3c3c3c3c3c3'::uuid,
    'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0'::uuid,
    'c2c2c2c2-bbbb-bbbb-bbbb-c2c2c2c2c2c2'::uuid
  ];
  v_week_ids    UUID[] := ARRAY[]::UUID[];
  v_week_id     UUID;
  v_placeholders UUID[];
  v_i           INT;
  v_j           INT;
  v_pidx        INT := 1;
  -- 12 round-robin pairings (1-based team indices) — one full double
  -- round-robin for 4 teams. Repeated across the 16 regular weeks.
  v_pairings    INT[][] := ARRAY[
    ARRAY[1,2], ARRAY[3,4],
    ARRAY[1,3], ARRAY[2,4],
    ARRAY[1,4], ARRAY[2,3],
    ARRAY[2,1], ARRAY[4,3],
    ARRAY[3,1], ARRAY[4,2],
    ARRAY[4,1], ARRAY[3,2]
  ];
  v_pair_idx    INT;
BEGIN
  ----------------------------------------------------------------------------
  -- League + preferences (trigger created the empty prefs row; UPSERT into it)
  ----------------------------------------------------------------------------

  -- team_format dropped from leagues by 20260502000000_drop_team_format.sql;
  -- lineup geometry now lives in preferences.lineup_size (set in the UPDATE below).
  INSERT INTO leagues (
    id, organization_id, game_type, day_of_week, division,
    league_start_date, status,
    handicap_variant, team_handicap_variant, handicap_level,
    golden_break_counts_as_win
  ) VALUES (
    v_league_id, v_org_id, 'eight_ball', 'tuesday', '3v3 old school',
    CURRENT_DATE, 'active',
    'standard', 'standard', 'standard',
    FALSE
  );

  -- Modular preference fields (empty row was auto-created by trigger).
  UPDATE preferences
    SET lineup_size = 3,
        max_roster_size = 5,
        game_generation = 'double_round_robin',
        handicap_type = 'points',
        points_system = 'differential'
    WHERE entity_type = 'league' AND entity_id = v_league_id;

  ----------------------------------------------------------------------------
  -- Venue + league_venues link
  ----------------------------------------------------------------------------

  INSERT INTO venues (
    id, organization_id, name,
    street_address, city, state, zip_code, phone,
    bar_box_tables, regulation_tables, bar_box_table_numbers
  ) VALUES (
    v_venue_id, v_org_id, 'Sams''s Billiards',
    '123 Main St', 'Springfield', 'FL', '11111', '111-111-1111',
    0, 0, ARRAY[1, 2, 3, 4]
  );

  INSERT INTO league_venues (
    league_id, venue_id,
    available_bar_box_tables, available_regulation_tables,
    available_table_numbers, capacity
  ) VALUES (
    v_league_id, v_venue_id,
    0, 0,
    ARRAY[1, 2, 3, 4], 4
  );

  ----------------------------------------------------------------------------
  -- Season (16 weeks regular + 1 break + 1 playoffs = 18 total weeks)
  ----------------------------------------------------------------------------

  INSERT INTO seasons (
    id, league_id, season_name,
    start_date, end_date, season_length, status
  ) VALUES (
    v_season_id, v_league_id,
    '8-Ball Tuesday 3v3 old school Spring 2026',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '16 weeks', 16, 'active'
  );

  -- 16 regular weeks (capture ids in array for match scheduling).
  FOR v_i IN 1..16 LOOP
    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
    VALUES (
      v_season_id,
      CURRENT_DATE + ((v_i - 1) * INTERVAL '7 days'),
      'Week ' || v_i,
      'regular'
    )
    RETURNING id INTO v_week_id;
    v_week_ids := array_append(v_week_ids, v_week_id);
  END LOOP;

  -- Season End Break (week 17 by date — no matches scheduled).
  INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
  VALUES (
    v_season_id,
    CURRENT_DATE + (16 * INTERVAL '7 days'),
    'Season End Break',
    'season_end_break'
  );

  -- Playoffs (week 18 by date — 2 matches).
  INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
  VALUES (
    v_season_id,
    CURRENT_DATE + (17 * INTERVAL '7 days'),
    'Playoffs',
    'playoffs'
  )
  RETURNING id INTO v_week_id;
  v_week_ids := array_append(v_week_ids, v_week_id);  -- index 17 (0-based 16)

  ----------------------------------------------------------------------------
  -- Teams + captain team_players
  ----------------------------------------------------------------------------

  FOR v_i IN 1..4 LOOP
    INSERT INTO teams (
      id, season_id, league_id, team_name, captain_id,
      home_venue_id, roster_size, status
    ) VALUES (
      v_team_ids[v_i], v_season_id, v_league_id,
      'Team ' || v_i, v_captain_ids[v_i],
      v_venue_id, 5, 'active'
    );

    INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
    VALUES (v_team_ids[v_i], v_season_id, v_captain_ids[v_i], TRUE, 'active');
  END LOOP;

  ----------------------------------------------------------------------------
  -- Roster filling: 4 placeholders per team (16 total) from the 130-pool.
  -- Pick the first 16 by stable email ordering so re-runs assign the
  -- same placeholders every time.
  ----------------------------------------------------------------------------

  SELECT array_agg(id ORDER BY email) INTO v_placeholders
  FROM (
    SELECT id, email FROM members
    WHERE email LIKE '%@example.com'
    ORDER BY email
    LIMIT 16
  ) p;

  FOR v_i IN 1..4 LOOP
    FOR v_j IN 1..4 LOOP
      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_ids[v_i], v_season_id, v_placeholders[v_pidx], FALSE, 'active');
      v_pidx := v_pidx + 1;
    END LOOP;
  END LOOP;

  ----------------------------------------------------------------------------
  -- Match schedule: 2 matches per regular week (16 weeks × 2 = 32) + 2
  -- playoff matches = 34 total. Pairings cycle through v_pairings (12
  -- entries) — first 6 weeks complete one full double round-robin,
  -- weeks 7–12 repeat, weeks 13–16 are first 4 of cycle 3.
  --
  -- The trigger_auto_create_match_lineups trigger fires AFTER each
  -- INSERT and creates 2 match_lineups rows per match automatically.
  -- We do NOT insert match_lineups manually.
  ----------------------------------------------------------------------------

  FOR v_i IN 1..16 LOOP
    -- Match 1 of the week
    v_pair_idx := ((v_i - 1) * 2) % 12 + 1;  -- 1-based mod 12
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status
    ) VALUES (
      v_season_id, v_week_ids[v_i],
      v_team_ids[v_pairings[v_pair_idx][1]],
      v_team_ids[v_pairings[v_pair_idx][2]],
      1, 'scheduled'
    );

    -- Match 2 of the week
    v_pair_idx := ((v_i - 1) * 2 + 1) % 12 + 1;
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status
    ) VALUES (
      v_season_id, v_week_ids[v_i],
      v_team_ids[v_pairings[v_pair_idx][1]],
      v_team_ids[v_pairings[v_pair_idx][2]],
      2, 'scheduled'
    );
  END LOOP;

  -- Playoffs: 2 matches in week 17 (index 17 in array, since we appended).
  -- Simple semis: Team 1 vs Team 4, Team 2 vs Team 3.
  INSERT INTO matches (
    season_id, season_week_id, home_team_id, away_team_id,
    match_number, status
  ) VALUES (
    v_season_id, v_week_ids[17],
    v_team_ids[1], v_team_ids[4],
    1, 'scheduled'
  );

  INSERT INTO matches (
    season_id, season_week_id, home_team_id, away_team_id,
    match_number, status
  ) VALUES (
    v_season_id, v_week_ids[17],
    v_team_ids[2], v_team_ids[3],
    2, 'scheduled'
  );
END $$;

-- ============================================================================
-- STEPS 6 + 7: TWO MORE LEAGUES (Standard 5v5 + Fargo 5v5)
--
-- Loops over 2 league configs. Each league mirrors Step 5's shape but
-- with its own preset values, start date, day-of-week, and disjoint
-- chunk of the placeholder pool for rosters.
--
-- v_l index meaning:
--   v_l = 1  →  Standard 5v5  (Wednesday, today+1, percentage handicap)
--   v_l = 2  →  Fargo 5v5     (Thursday,  today+2, fargo handicap)
-- ============================================================================

DO $$
DECLARE
  -- Shared across both leagues
  v_org_id      UUID := '01010101-cccc-cccc-cccc-010101010101';
  v_venue_id    UUID := '0c0c0c0c-3333-3333-3333-0c0c0c0c0c0c';  -- reuse Sams's
  v_captain_ids UUID[] := ARRAY[
    'c1c1c1c1-bbbb-bbbb-bbbb-c1c1c1c1c1c1'::uuid,  -- Team 1 → cap1
    'c3c3c3c3-bbbb-bbbb-bbbb-c3c3c3c3c3c3'::uuid,  -- Team 2 → cap3
    'd0d0d0d0-bbbb-bbbb-bbbb-d0d0d0d0d0d0'::uuid,  -- Team 3 → dev
    'c2c2c2c2-bbbb-bbbb-bbbb-c2c2c2c2c2c2'::uuid   -- Team 4 → cap2
  ];
  v_pairings INT[][] := ARRAY[
    ARRAY[1,2], ARRAY[3,4],
    ARRAY[1,3], ARRAY[2,4],
    ARRAY[1,4], ARRAY[2,3],
    ARRAY[2,1], ARRAY[4,3],
    ARRAY[3,1], ARRAY[4,2],
    ARRAY[4,1], ARRAY[3,2]
  ];

  -- Per-league config arrays. Index 1 = League 2, Index 2 = League 3.
  v_league_ids UUID[] := ARRAY[
    '0c0c0c0c-1111-2222-2222-0c0c0c0c0c0c'::uuid,
    '0c0c0c0c-1111-3333-3333-0c0c0c0c0c0c'::uuid
  ];
  v_season_ids UUID[] := ARRAY[
    '0c0c0c0c-2222-2222-1111-0c0c0c0c0c0c'::uuid,
    '0c0c0c0c-2222-3333-1111-0c0c0c0c0c0c'::uuid
  ];
  -- 8 team ids: indices 1-4 for League 2, 5-8 for League 3. The middle
  -- segments use 'aaaa' (L2) and 'bbbb' (L3) to avoid colliding with
  -- Step 5's L1 team uuids, which use the team-number pattern
  -- 7e7e7e7e-NNNN-NNNN-NNNN- (Team 1=1111, Team 2=2222, etc).
  v_team_id_pool UUID[] := ARRAY[
    '7e7e7e7e-aaaa-1111-1111-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-aaaa-2222-2222-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-aaaa-3333-3333-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-aaaa-4444-4444-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-bbbb-1111-1111-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-bbbb-2222-2222-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-bbbb-3333-3333-7e7e7e7e7e7e'::uuid,
    '7e7e7e7e-bbbb-4444-4444-7e7e7e7e7e7e'::uuid
  ];
  v_day_offsets        INT[]  := ARRAY[1, 2];           -- start_date offsets from CURRENT_DATE
  v_days_of_week       TEXT[] := ARRAY['wednesday', 'thursday'];
  v_divisions          TEXT[] := ARRAY['Standard 5v5', 'Fargo 5v5'];
  v_season_names       TEXT[] := ARRAY[
    '8-Ball Wednesday Standard 5v5 Spring 2026',
    '8-Ball Thursday Fargo 5v5 Spring 2026'
  ];
  -- team_format dropped from leagues (see 20260502000000_drop_team_format.sql).
  -- Kept lineup_size = 5 set in the preferences UPDATE below.
  v_handicap_types     TEXT[] := ARRAY['percentage', 'fargo'];
  v_points_systems     TEXT[] := ARRAY['bca_tiered', 'differential'];
  v_placeholder_offsets INT[] := ARRAY[16, 32];          -- skip placeholders used by League 1 / 1+2

  -- Per-iteration locals
  v_l           INT;
  v_team_ids    UUID[];
  v_week_ids    UUID[];
  v_placeholders UUID[];
  v_week_id     UUID;
  v_pidx        INT;
  v_i           INT;
  v_j           INT;
  v_pair_idx    INT;
  v_start_date  DATE;
BEGIN
  FOR v_l IN 1..2 LOOP
    -- Per-iteration setup. Build v_team_ids as a fresh 1-indexed 4-element
    -- array via explicit indexing — PL/pgSQL array slicing
    -- (v_team_id_pool[lo:hi]) preserves the original lower bound, which
    -- breaks v_team_ids[v_i] in the loops below.
    v_team_ids   := ARRAY[
      v_team_id_pool[(v_l - 1) * 4 + 1],
      v_team_id_pool[(v_l - 1) * 4 + 2],
      v_team_id_pool[(v_l - 1) * 4 + 3],
      v_team_id_pool[(v_l - 1) * 4 + 4]
    ];
    v_week_ids   := ARRAY[]::UUID[];
    v_pidx       := 1;
    v_start_date := CURRENT_DATE + v_day_offsets[v_l];

    --------------------------------------------------------------------------
    -- League + preferences (trigger created the empty prefs row; UPDATE it)
    --------------------------------------------------------------------------

    INSERT INTO leagues (
      id, organization_id, game_type, day_of_week, division,
      league_start_date, status,
      handicap_variant, team_handicap_variant, handicap_level,
      golden_break_counts_as_win
    ) VALUES (
      v_league_ids[v_l], v_org_id, 'eight_ball', v_days_of_week[v_l], v_divisions[v_l],
      v_start_date, 'active',
      'standard', 'standard', 'standard',
      FALSE
    );

    UPDATE preferences
      SET lineup_size = 5,
          max_roster_size = 8,
          game_generation = 'single_round_robin',
          handicap_type = v_handicap_types[v_l],
          points_system = v_points_systems[v_l]
      WHERE entity_type = 'league' AND entity_id = v_league_ids[v_l];

    --------------------------------------------------------------------------
    -- league_venues link (reuse Sams's Billiards venue from Step 5)
    --------------------------------------------------------------------------

    INSERT INTO league_venues (
      league_id, venue_id,
      available_bar_box_tables, available_regulation_tables,
      available_table_numbers, capacity
    ) VALUES (
      v_league_ids[v_l], v_venue_id,
      0, 0,
      ARRAY[1, 2, 3, 4], 4
    );

    --------------------------------------------------------------------------
    -- Season + 16 regular weeks + season_end_break + playoffs
    --------------------------------------------------------------------------

    INSERT INTO seasons (
      id, league_id, season_name,
      start_date, end_date, season_length, status
    ) VALUES (
      v_season_ids[v_l], v_league_ids[v_l], v_season_names[v_l],
      v_start_date, v_start_date + INTERVAL '16 weeks', 16, 'active'
    );

    FOR v_i IN 1..16 LOOP
      INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
      VALUES (
        v_season_ids[v_l],
        v_start_date + ((v_i - 1) * INTERVAL '7 days'),
        'Week ' || v_i,
        'regular'
      )
      RETURNING id INTO v_week_id;
      v_week_ids := array_append(v_week_ids, v_week_id);
    END LOOP;

    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
    VALUES (
      v_season_ids[v_l],
      v_start_date + (16 * INTERVAL '7 days'),
      'Season End Break',
      'season_end_break'
    );

    INSERT INTO season_weeks (season_id, scheduled_date, week_name, week_type)
    VALUES (
      v_season_ids[v_l],
      v_start_date + (17 * INTERVAL '7 days'),
      'Playoffs',
      'playoffs'
    )
    RETURNING id INTO v_week_id;
    v_week_ids := array_append(v_week_ids, v_week_id);  -- index 17

    --------------------------------------------------------------------------
    -- Teams + captain team_players
    --------------------------------------------------------------------------

    FOR v_i IN 1..4 LOOP
      INSERT INTO teams (
        id, season_id, league_id, team_name, captain_id,
        home_venue_id, roster_size, status
      ) VALUES (
        v_team_ids[v_i], v_season_ids[v_l], v_league_ids[v_l],
        'Team ' || v_i, v_captain_ids[v_i],
        v_venue_id, 5, 'active'
      );

      INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
      VALUES (v_team_ids[v_i], v_season_ids[v_l], v_captain_ids[v_i], TRUE, 'active');
    END LOOP;

    --------------------------------------------------------------------------
    -- Roster filling: 16 placeholders for this league, drawn from a
    -- distinct slice of the placeholder pool so no member is double-
    -- rostered across leagues.
    --   League 2: placeholders #17–32 (OFFSET 16, LIMIT 16)
    --   League 3: placeholders #33–48 (OFFSET 32, LIMIT 16)
    --------------------------------------------------------------------------

    SELECT array_agg(id ORDER BY email) INTO v_placeholders
    FROM (
      SELECT id, email FROM members
      WHERE email LIKE '%@example.com'
      ORDER BY email
      OFFSET v_placeholder_offsets[v_l]
      LIMIT 16
    ) p;

    FOR v_i IN 1..4 LOOP
      FOR v_j IN 1..4 LOOP
        INSERT INTO team_players (team_id, season_id, member_id, is_captain, status)
        VALUES (v_team_ids[v_i], v_season_ids[v_l], v_placeholders[v_pidx], FALSE, 'active');
        v_pidx := v_pidx + 1;
      END LOOP;
    END LOOP;

    --------------------------------------------------------------------------
    -- Matches: 32 regular (2/week × 16 weeks) + 2 playoffs = 34 total.
    -- Pairings cycle through v_pairings (12 entries). The auto-trigger
    -- creates 2 match_lineups rows per match; we don't insert them.
    --------------------------------------------------------------------------

    FOR v_i IN 1..16 LOOP
      v_pair_idx := ((v_i - 1) * 2) % 12 + 1;
      INSERT INTO matches (
        season_id, season_week_id, home_team_id, away_team_id,
        match_number, status
      ) VALUES (
        v_season_ids[v_l], v_week_ids[v_i],
        v_team_ids[v_pairings[v_pair_idx][1]],
        v_team_ids[v_pairings[v_pair_idx][2]],
        1, 'scheduled'
      );

      v_pair_idx := ((v_i - 1) * 2 + 1) % 12 + 1;
      INSERT INTO matches (
        season_id, season_week_id, home_team_id, away_team_id,
        match_number, status
      ) VALUES (
        v_season_ids[v_l], v_week_ids[v_i],
        v_team_ids[v_pairings[v_pair_idx][1]],
        v_team_ids[v_pairings[v_pair_idx][2]],
        2, 'scheduled'
      );
    END LOOP;

    -- Playoffs: 2 semis (T1 vs T4, T2 vs T3).
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status
    ) VALUES (
      v_season_ids[v_l], v_week_ids[17],
      v_team_ids[1], v_team_ids[4],
      1, 'scheduled'
    );
    INSERT INTO matches (
      season_id, season_week_id, home_team_id, away_team_id,
      match_number, status
    ) VALUES (
      v_season_ids[v_l], v_week_ids[17],
      v_team_ids[2], v_team_ids[3],
      2, 'scheduled'
    );
  END LOOP;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
DECLARE
  v_placeholder_count INT;
  v_league_count INT;
  v_match_count INT;
  v_team_count INT;
BEGIN
  SELECT count(*) INTO v_placeholder_count FROM members WHERE email LIKE '%@example.com';
  SELECT count(*) INTO v_league_count FROM leagues
    WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';
  SELECT count(*) INTO v_team_count FROM teams t
    JOIN leagues l ON l.id = t.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101';
  SELECT count(*) INTO v_match_count FROM matches m
    JOIN seasons s ON s.id = m.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE l.organization_id = '01010101-cccc-cccc-cccc-010101010101';

  RAISE NOTICE 'Dev starting point ready.';
  RAISE NOTICE '';
  RAISE NOTICE 'Logins (all password "password"):';
  RAISE NOTICE '  dev@test.com  — Lee Goperator (Lo)        — LO of Tester Org, captain of Team 3 in every league';
  RAISE NOTICE '  cap1@test.com — Johnny Captain (Johnny)   — Captain of Team 1 in every league';
  RAISE NOTICE '  cap2@test.com — Captain Smith (Smitty)    — Captain of Team 4 in every league';
  RAISE NOTICE '  cap3@test.com — Sally Captain (Sal)       — Captain of Team 2 in every league';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  Tester Org — dev as owner, mock Stripe payment-verified';
  RAISE NOTICE '  Sams''s Billiards venue (4 bar-box tables, shared across leagues)';
  RAISE NOTICE '  % leagues:', v_league_count;
  RAISE NOTICE '    L1 "3v3 old school"     — Tuesday   — starts %', CURRENT_DATE;
  RAISE NOTICE '    L2 "Standard 5v5"       — Wednesday — starts %', CURRENT_DATE + 1;
  RAISE NOTICE '    L3 "Fargo 5v5"          — Thursday  — starts %', CURRENT_DATE + 2;
  RAISE NOTICE '  Each league: 16 regular weeks + break + playoffs, 4 teams, captain+4 roster';
  RAISE NOTICE '  % teams across the 3 leagues', v_team_count;
  RAISE NOTICE '  % matches scheduled (auto match_lineups via trigger)', v_match_count;
  RAISE NOTICE '  % placeholder members in the pool (48 rostered, rest free for tests)', v_placeholder_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Sign in at /login as dev@test.com to land on the LO dashboard.';
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
