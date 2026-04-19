-- ============================================================================
-- SEED MEMBERS — Placeholder players (no user_id)
-- ============================================================================
--
-- Creates a pool of unregistered players for local development and testing.
-- All have user_id = NULL (placeholder players, not linked to auth accounts).
-- Run after migrations: supabase db reset will auto-run seed.sql but NOT
-- this file. Run manually: psql < supabase/seed_members.sql
-- Or add to seed.sql if you want it on every reset.
--
-- Password: N/A — these are placeholder members, not auth users.
-- ============================================================================

INSERT INTO public.members (
  user_id, first_name, last_name, nickname, phone, email,
  address, city, state, zip_code, date_of_birth,
  role, bca_member_number, starting_handicap_3v3, starting_handicap_5v5,
  fargo_rating
) VALUES
  -- Solid players (Fargo 500+)
  (NULL, 'Mike', 'Thompson', 'MikeT', '555-0101', 'mike.t@example.com',
   '123 Main St', 'Austin', 'TX', '78701', '1985-03-15',
   'player', 'BCA-10001', 1, 55, 520),

  (NULL, 'Sarah', 'Chen', 'SarahC', '555-0102', 'sarah.c@example.com',
   '456 Oak Ave', 'Austin', 'TX', '78702', '1990-07-22',
   'player', 'BCA-10002', 2, 62, 545),

  (NULL, 'James', 'Rodriguez', 'JRod', '555-0103', 'james.r@example.com',
   '789 Pine Rd', 'Round Rock', 'TX', '78664', '1982-11-08',
   'player', 'BCA-10003', -1, 45, 480),

  (NULL, 'Lisa', 'Williams', 'LisaW', '555-0104', 'lisa.w@example.com',
   '321 Elm St', 'Cedar Park', 'TX', '78613', '1993-01-30',
   'player', NULL, 0, 40, 435),

  (NULL, 'David', 'Kim', 'DaveK', '555-0105', 'david.k@example.com',
   '654 Maple Dr', 'Georgetown', 'TX', '78628', '1988-06-12',
   'player', 'BCA-10005', 1, 58, 510),

  -- Mid-range players (Fargo 400-500)
  (NULL, 'Chris', 'Johnson', 'CJ', '555-0106', 'chris.j@example.com',
   '987 Cedar Ln', 'Pflugerville', 'TX', '78660', '1991-09-05',
   'player', NULL, 0, 42, 460),

  (NULL, 'Amanda', 'Davis', 'Mandy', '555-0107', 'amanda.d@example.com',
   '147 Birch Way', 'Austin', 'TX', '78703', '1987-04-18',
   'player', 'BCA-10007', -1, 38, 415),

  (NULL, 'Robert', 'Martinez', 'Bobby', '555-0108', 'robert.m@example.com',
   '258 Walnut Ct', 'Leander', 'TX', '78641', '1995-12-25',
   'player', NULL, 0, 44, 470),

  (NULL, 'Jennifer', 'Taylor', 'Jen', '555-0109', 'jennifer.t@example.com',
   '369 Spruce St', 'Austin', 'TX', '78704', '1989-08-14',
   'player', 'BCA-10009', 1, 52, 495),

  (NULL, 'Brian', 'Anderson', 'BA', '555-0110', 'brian.a@example.com',
   '741 Ash Blvd', 'Round Rock', 'TX', '78665', '1984-02-28',
   'player', NULL, -1, 36, 405),

  -- Newer / casual players (Fargo 300-400)
  (NULL, 'Michelle', 'Garcia', 'Shell', '555-0111', 'michelle.g@example.com',
   '852 Poplar Ave', 'Austin', 'TX', '78705', '1996-05-10',
   'player', NULL, -2, 28, 350),

  (NULL, 'Kevin', 'Brown', 'Kev', '555-0112', 'kevin.b@example.com',
   '963 Willow Dr', 'Cedar Park', 'TX', '78613', '1992-10-03',
   'player', NULL, -1, 32, 380),

  (NULL, 'Rachel', 'Wilson', 'Rach', '555-0113', 'rachel.w@example.com',
   '174 Hickory Ln', 'Pflugerville', 'TX', '78660', '1998-07-19',
   'player', NULL, 0, 40, 420),

  (NULL, 'Tom', 'Moore', 'TomM', '555-0114', 'tom.m@example.com',
   '285 Sycamore St', 'Georgetown', 'TX', '78628', '1980-03-22',
   'player', 'BCA-10014', 2, 68, NULL),

  (NULL, 'Emily', 'Jackson', 'Em', '555-0115', 'emily.j@example.com',
   '396 Chestnut Rd', 'Austin', 'TX', '78706', '1994-11-15',
   'player', NULL, 0, 40, NULL),

  (NULL, 'Steve', 'White', 'Stevie', '555-0116', 'steve.w@example.com',
   '507 Dogwood Ct', 'Leander', 'TX', '78641', '1986-09-08',
   'player', NULL, 1, 50, 505),

  (NULL, 'Laura', 'Harris', 'Lo', '555-0117', 'laura.h@example.com',
   '618 Magnolia Way', 'Austin', 'TX', '78707', '1991-06-01',
   'player', 'BCA-10017', -1, 35, 390),

  (NULL, 'Dan', 'Clark', 'Danny', '555-0118', 'dan.c@example.com',
   '729 Redwood Ave', 'Round Rock', 'TX', '78664', '1983-12-20',
   'player', NULL, 0, 43, 455),

  (NULL, 'Nicole', 'Lewis', 'Nikki', '555-0119', 'nicole.l@example.com',
   '830 Cypress Blvd', 'Cedar Park', 'TX', '78613', '1997-08-07',
   'player', NULL, -2, 25, 320),

  (NULL, 'Mark', 'Robinson', 'Marky', '555-0120', 'mark.r@example.com',
   '941 Juniper St', 'Austin', 'TX', '78708', '1979-01-14',
   'player', 'BCA-10020', 2, 72, 580)

ON CONFLICT DO NOTHING;
