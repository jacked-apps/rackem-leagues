-- ============================================================================
-- DEV SEED — minimal post-modular-system starting point
-- ============================================================================
--
-- Goal: paste this once after `pnpm db:reset` to get the SETUP STATE you
-- need to test the modular-league-system branch — without the league /
-- season / team / match scaffolding the old `dev_starting_point.sql`
-- created. That scaffolding referenced columns the v2 schema dropped or
-- renamed (`team_format`, `scoring_method`, `home_games_to_win`, etc.).
--
-- What this seed gives you:
--
--   1. 4 auth users (LO + 3 captains) — all password "password"
--   2. Member profiles for all 4 (no /complete-profile redirect)
--   3. Tester Org with the LO as owner-staff (mock Stripe, payment-verified —
--      skips the LO application flow)
--   4. 130 placeholder members — Florida-spread fake players for filling
--      rosters and testing player search / lookup UX
--
-- What this seed DOESN'T do (intentionally):
--
--   - No leagues, seasons, teams, matches, or schedules. You create those
--     through the wizard — that's what we're testing.
--   - No player handicaps. You set those when you build lineups.
--
-- Logins (all use password "password")
--
--   dev@test.com    — Lee Goperator (Lo)         — LO of Tester Org
--   cap1@test.com   — Johnny Captain (Johnny)    — captain
--   cap2@test.com   — Captain Smith (Smitty)     — captain
--   cap3@test.com   — Sally Captain (Sal)        — captain
--
-- How to use
--
--   1. pnpm db:reset                           (re-applies migrations, clean schema)
--   2. Open Supabase Studio at http://localhost:54323
--   3. SQL Editor → paste the contents of this file → Run
--   4. Sign in to the app at http://localhost:5173/login as dev@test.com
--   5. Create your test league via the wizard
--
-- Idempotency
--
--   Safe to re-run. The cleanup section at the top removes any prior run's
--   org + members + auth users.
--
-- Replaces (was): database/dev_starting_point.sql
-- ============================================================================

-- Safety: only allow on local Supabase
DO $$
BEGIN
  IF current_database() != 'postgres' THEN
    RAISE EXCEPTION
      'Refusing to run: database is "%", expected "postgres" (local Supabase). This script is dev-only.',
      current_database();
  END IF;
END $$;

-- ============================================================================
-- Cleanup (idempotent — safe to re-run)
--
-- Removes the foundation org, all 4 auth users, their member rows, and any
-- placeholder members from prior runs.
-- ============================================================================

-- Anything pointing at the foundation org goes first.

DELETE FROM organization_staff
  WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';

DELETE FROM preferences
  WHERE entity_type = 'organization'
    AND entity_id = '01010101-cccc-cccc-cccc-010101010101';

-- Members reference the org via members.organization_id (set by Step 5
-- below on prior runs). Delete the relevant member rows BEFORE the
-- org delete or the FK constraint blocks it.

DELETE FROM members
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('dev@test.com', 'cap1@test.com', 'cap2@test.com', 'cap3@test.com')
  );

DELETE FROM members
  WHERE email LIKE '%@example.com';

-- Defensive: any remaining members still pointing at this org from a
-- partial prior run shouldn't block the org delete. NULL them out.

UPDATE members
  SET organization_id = NULL
  WHERE organization_id = '01010101-cccc-cccc-cccc-010101010101';

DELETE FROM organizations
  WHERE id = '01010101-cccc-cccc-cccc-010101010101';

-- Auth identities + users for the 4 logins.

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
-- STEP 3: ORGANIZATION
--
-- The create_owner_staff_trigger automatically inserts a row into
-- organization_staff (Lo as owner). The trigger_create_org_preferences
-- creates an empty preferences row for the org. Both fire on this
-- INSERT — don't insert manually.
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

-- ============================================================================
-- STEP 4: 130 PLACEHOLDER MEMBERS
--
-- Florida-spread pool of fake players for filling team rosters and
-- testing captain-search / player-lookup UX. Inlined from
-- database/seed_fake_members.sql so this seed is single-paste.
--
-- These members have no user_id (can't log in). About 20% have BCA
-- numbers. system_player_number is auto-assigned by the table sequence.
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
('Donna', 'Padilla', 'Donna', '727-555-0906', 'donna.padilla@example.com', '9006 Cleveland St', 'Clearwater', 'FL', '33755', '1990-04-13', 'player', NULL),
('Walter', 'Aguirre', 'Walt', '727-555-0907', 'walter.aguirre@example.com', '9007 McMullen Booth Rd', 'Clearwater', 'FL', '33759', '1985-08-26', 'player', NULL),
('Carolyn', 'Salinas', 'Carolyn', '727-555-0908', 'carolyn.salinas@example.com', '9008 East Bay Dr', 'Largo', 'FL', '33771', '1992-12-09', 'player', '012347'),
('Roger', 'Trevino', 'Roger', '727-555-0909', 'roger.trevino@example.com', '9009 Walsingham Rd', 'Largo', 'FL', '33778', '1989-03-22', 'player', NULL),
('Janet', 'Avalos', 'Janet', '727-555-0910', 'janet.avalos@example.com', '9010 Roosevelt Blvd', 'Clearwater', 'FL', '33760', '1994-07-04', 'player', NULL),
-- Naples Area
('Jose', 'Olvera', 'Jose', '239-555-1001', 'jose.olvera@example.com', '10001 5th Ave S', 'Naples', 'FL', '34102', '1983-10-17', 'player', '123452'),
('Nancy', 'Carrasco', 'Nancy', '239-555-1002', 'nancy.carrasco@example.com', '10002 Tamiami Trail', 'Naples', 'FL', '34103', '1990-02-28', 'player', NULL),
('Phillip', 'Quintero', 'Phil', '239-555-1003', 'phillip.quintero@example.com', '10003 Pine Ridge Rd', 'Naples', 'FL', '34109', '1986-06-11', 'player', NULL),
('Ruth', 'Salas', 'Ruth', '239-555-1004', 'ruth.salas@example.com', '10004 Vanderbilt Beach Rd', 'Naples', 'FL', '34108', '1993-10-23', 'player', '234562'),
('Howard', 'Camacho', 'Howard', '239-555-1005', 'howard.camacho@example.com', '10005 Goodlette Frank Rd', 'Naples', 'FL', '34102', '1988-02-05', 'player', NULL),
('Gloria', 'Saavedra', 'Gloria', '239-555-1006', 'gloria.saavedra@example.com', '10006 Davis Blvd', 'Naples', 'FL', '34104', '1991-06-18', 'player', NULL),
('Eugene', 'Tapia', 'Gene', '239-555-1007', 'eugene.tapia@example.com', '10007 Airport Rd', 'Naples', 'FL', '34109', '1984-09-30', 'player', '345672'),
('Joan', 'Alfaro', 'Joan', '239-555-1008', 'joan.alfaro@example.com', '10008 Immokalee Rd', 'Naples', 'FL', '34110', '1992-01-13', 'player', NULL),
('Phillip', 'Becerra', 'Phil', '239-555-1009', 'phillip.becerra@example.com', '10009 Collier Blvd', 'Naples', 'FL', '34114', '1987-05-26', 'player', NULL),
('Diane', 'Tijerina', 'Diane', '239-555-1010', 'diane.tijerina@example.com', '10010 Radio Rd', 'Naples', 'FL', '34104', '1990-09-08', 'player', '456782'),
-- Sarasota Area
('Donald', 'Beltran', 'Don', '941-555-1101', 'donald.beltran@example.com', '11001 Main St', 'Sarasota', 'FL', '34236', '1985-12-21', 'player', NULL),
('Sandra', 'Trujillo', 'Sandy', '941-555-1102', 'sandra.trujillo@example.com', '11002 Tamiami Trail', 'Sarasota', 'FL', '34239', '1993-04-04', 'player', '567893'),
('Jonathan', 'Alarcon', 'Jon', '941-555-1103', 'jonathan.alarcon@example.com', '11003 Bee Ridge Rd', 'Sarasota', 'FL', '34239', '1989-07-17', 'player', NULL),
('Doris', 'Tovar', 'Doris', '941-555-1104', 'doris.tovar@example.com', '11004 Fruitville Rd', 'Sarasota', 'FL', '34237', '1991-11-30', 'player', NULL),
('Dylan', 'Rangel', 'Dylan', '941-555-1105', 'dylan.rangel@example.com', '11005 Clark Rd', 'Sarasota', 'FL', '34233', '1984-03-12', 'player', '678904'),
('Janice', 'Polanco', 'Jan', '941-555-1106', 'janice.polanco@example.com', '11006 University Pkwy', 'Sarasota', 'FL', '34243', '1992-07-25', 'player', NULL),
('Wayne', 'Pineda', 'Wayne', '941-555-1107', 'wayne.pineda@example.com', '11007 Lockwood Ridge Rd', 'Sarasota', 'FL', '34243', '1986-11-07', 'player', NULL),
('Marie', 'Quiroz', 'Marie', '941-555-1108', 'marie.quiroz@example.com', '11008 Beneva Rd', 'Sarasota', 'FL', '34232', '1993-02-19', 'player', '789015'),
('Carl', 'Cazares', 'Carl', '941-555-1109', 'carl.cazares@example.com', '11009 12th St', 'Sarasota', 'FL', '34234', '1988-06-02', 'player', NULL),
('Kathleen', 'Esquivel', 'Kathy', '941-555-1110', 'kathleen.esquivel@example.com', '11010 Tuttle Ave', 'Sarasota', 'FL', '34239', '1990-10-15', 'player', NULL),
-- Gainesville Area
('Howard', 'Quintana', 'Howard', '352-555-1201', 'howard.quintana@example.com', '12001 University Ave', 'Gainesville', 'FL', '32601', '1984-01-28', 'player', '890126'),
('Cheryl', 'Tello', 'Cheryl', '352-555-1202', 'cheryl.tello@example.com', '12002 13th St', 'Gainesville', 'FL', '32604', '1991-05-11', 'player', NULL),
('Ralph', 'Bermudez', 'Ralph', '352-555-1203', 'ralph.bermudez@example.com', '12003 Archer Rd', 'Gainesville', 'FL', '32608', '1987-09-23', 'player', NULL),
('Mildred', 'Saldivar', 'Millie', '352-555-1204', 'mildred.saldivar@example.com', '12004 Newberry Rd', 'Gainesville', 'FL', '32607', '1994-12-06', 'player', '901237'),
('Roy', 'Vela', 'Roy', '352-555-1205', 'roy.vela@example.com', '12005 SW 2nd Ave', 'Gainesville', 'FL', '32601', '1986-04-19', 'player', NULL),
('Annie', 'Tamez', 'Annie', '352-555-1206', 'annie.tamez@example.com', '12006 NW 39th Ave', 'Gainesville', 'FL', '32606', '1989-08-01', 'player', NULL),
('Eugene', 'Madrigal', 'Gene', '352-555-1207', 'eugene.madrigal@example.com', '12007 SW 16th Ave', 'Gainesville', 'FL', '32601', '1992-12-14', 'player', '012348'),
('Ruth', 'Quezada', 'Ruth', '352-555-1208', 'ruth.quezada@example.com', '12008 NW 8th Ave', 'Gainesville', 'FL', '32605', '1985-03-27', 'player', NULL),
('Raymond', 'Munguia', 'Ray', '352-555-1209', 'raymond.munguia@example.com', '12009 Williston Rd', 'Gainesville', 'FL', '32608', '1993-07-09', 'player', NULL),
('Heather', 'Salgado', 'Heather', '352-555-1210', 'heather.salgado@example.com', '12010 Hawthorne Rd', 'Gainesville', 'FL', '32641', '1988-11-22', 'player', '123453'),
-- Hialeah Area
('Lawrence', 'Tellez', 'Larry', '305-555-1301', 'lawrence.tellez@example.com', '13001 W 49th St', 'Hialeah', 'FL', '33012', '1986-02-15', 'player', NULL),
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
-- STEP 5: ATTRIBUTE PLACEHOLDERS TO TESTER ORG
--
-- Without this, the `getAllMembers(orgId)` query in MemberCombobox /
-- player picker filters them out — placeholders need either a
-- `user_id`, `organization_id` matching the LO's org, or a non-null
-- `bca_member_number` to be visible to that org. The 130 fake members
-- above only have BCA numbers ~20% of the time, so without org
-- attribution most are invisible to the wizard's player picker.
-- ============================================================================

UPDATE members
SET organization_id = '01010101-cccc-cccc-cccc-010101010101'::uuid
WHERE email LIKE '%@example.com'
  AND organization_id IS NULL;

-- Also attribute the LO's own member row to Tester Org. The wizard's
-- CaptainsTeamsStep gates the members-fetch on `currentMember.organization_id`
-- (`enabled: !!orgId`); without this UPDATE, the LO logs in with a
-- member row whose organization_id is null and the picker query
-- never fires, leaving the dropdown empty.
UPDATE members
SET organization_id = '01010101-cccc-cccc-cccc-010101010101'::uuid
WHERE email = 'dev@test.com';

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Dev seed complete.';
  RAISE NOTICE '';
  RAISE NOTICE 'Logins (all password "password"):';
  RAISE NOTICE '  dev@test.com   — Lee Goperator (Lo)       — LO of Tester Org';
  RAISE NOTICE '  cap1@test.com  — Johnny Captain (Johnny)  — captain';
  RAISE NOTICE '  cap2@test.com  — Captain Smith (Smitty)   — captain';
  RAISE NOTICE '  cap3@test.com  — Sally Captain (Sal)      — captain';
  RAISE NOTICE '';
  RAISE NOTICE 'Sign in at http://localhost:5173/login as dev@test.com.';
  RAISE NOTICE 'Then create your test league via the wizard.';
  RAISE NOTICE '======================================';
END $$;
