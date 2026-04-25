-- ============================================================================
-- SEED EXTRA PLAYERS — Pool of 50 placeholder roster fillers (DEV ONLY)
-- ============================================================================
--
-- Adds 50 placeholder members (user_id = NULL) for filling out team rosters
-- on leagues with 8+ roster slots during local testing. Names are realistic
-- but generic; nicknames are short and distinguishable. Handicaps are spread
-- across the skill range so picking-by-handicap during lineup tests behaves
-- the same as a real league.
--
-- All emails follow the pattern extra###@example.com to avoid colliding
-- with anything in seed_members.sql or the staging dump.
--
-- DEV ONLY. Do not run against staging or production.
--
-- IDEMPOTENT: re-running won't create duplicates. Each INSERT is gated by
-- WHERE NOT EXISTS on the email column (which has no UNIQUE constraint, so
-- a real ON CONFLICT clause would error).
--
-- To run:
--   psql < supabase/seed_extra_players.sql
-- Or paste into Supabase Studio's SQL editor.
-- ============================================================================

INSERT INTO public.members (
  user_id, first_name, last_name, nickname, phone, email,
  city, state, role,
  starting_handicap_3v3, starting_handicap_5v5, fargo_rating
)
SELECT v.user_id, v.first_name, v.last_name, v.nickname, v.phone, v.email,
       v.city, v.state, v.role::user_role,
       v.starting_handicap_3v3, v.starting_handicap_5v5, v.fargo_rating
FROM (VALUES
  -- 500+ Fargo (sharks)
  (NULL::uuid, 'Aaron',     'Bennett',   'AB',       '555-0201', 'extra001@example.com', 'Austin',     'TX', 'player',  2, 70, 600),
  (NULL,       'Beth',      'Carter',    'Bee',      '555-0202', 'extra002@example.com', 'Houston',    'TX', 'player',  2, 68, 585),
  (NULL,       'Carlos',    'Dixon',     'Los',      '555-0203', 'extra003@example.com', 'Dallas',     'TX', 'player',  2, 66, 570),
  (NULL,       'Dana',      'Espinoza',  'D',        '555-0204', 'extra004@example.com', 'Plano',      'TX', 'player',  2, 65, 555),
  (NULL,       'Eli',       'Foster',    'Eli F',    '555-0205', 'extra005@example.com', 'Frisco',     'TX', 'player',  1, 60, 540),
  (NULL,       'Faith',     'Greene',    'Fay',      '555-0206', 'extra006@example.com', 'Irving',     'TX', 'player',  1, 58, 525),
  (NULL,       'Gabe',      'Hayes',     'Gabe H',   '555-0207', 'extra007@example.com', 'Arlington',  'TX', 'player',  1, 56, 510),

  -- 450-500 Fargo (steady players)
  (NULL,       'Hank',      'Iverson',   'Hank',     '555-0208', 'extra008@example.com', 'Fort Worth', 'TX', 'player',  1, 54, 495),
  (NULL,       'Iris',      'Jensen',    'Iri',      '555-0209', 'extra009@example.com', 'Garland',    'TX', 'player',  1, 52, 485),
  (NULL,       'Jamal',     'Kang',      'Jay',      '555-0210', 'extra010@example.com', 'McKinney',   'TX', 'player',  0, 48, 475),
  (NULL,       'Kira',      'Lambert',   'Kee',      '555-0211', 'extra011@example.com', 'Denton',     'TX', 'player',  0, 46, 470),
  (NULL,       'Leon',      'Mendez',    'Leo',      '555-0212', 'extra012@example.com', 'Carrollton', 'TX', 'player',  0, 45, 465),
  (NULL,       'Maya',      'Novak',     'May',      '555-0213', 'extra013@example.com', 'Lewisville', 'TX', 'player',  0, 44, 460),
  (NULL,       'Nico',      'Oliver',    'Nic',      '555-0214', 'extra014@example.com', 'Allen',      'TX', 'player',  0, 43, 455),

  -- 400-450 Fargo (mid-pack)
  (NULL,       'Owen',      'Padilla',   'O',        '555-0215', 'extra015@example.com', 'Mesquite',   'TX', 'player',  0, 42, 445),
  (NULL,       'Priya',     'Quinn',     'Pri',      '555-0216', 'extra016@example.com', 'Richardson', 'TX', 'player',  0, 41, 440),
  (NULL,       'Quinn',     'Reyes',     'Q',        '555-0217', 'extra017@example.com', 'Grapevine',  'TX', 'player',  0, 40, 435),
  (NULL,       'Reggie',    'Singh',     'Reg',      '555-0218', 'extra018@example.com', 'Coppell',    'TX', 'player',  0, 40, 430),
  (NULL,       'Sasha',     'Tate',      'Sash',     '555-0219', 'extra019@example.com', 'Flower Md',  'TX', 'player', -1, 38, 425),
  (NULL,       'Theo',      'Underwood', 'Theo',     '555-0220', 'extra020@example.com', 'Highland P', 'TX', 'player', -1, 38, 420),
  (NULL,       'Uma',       'Vargas',    'U',        '555-0221', 'extra021@example.com', 'Euless',     'TX', 'player', -1, 37, 415),
  (NULL,       'Victor',    'Walsh',     'Vic',      '555-0222', 'extra022@example.com', 'Bedford',    'TX', 'player', -1, 36, 410),
  (NULL,       'Wren',      'Xu',        'Ren',      '555-0223', 'extra023@example.com', 'Hurst',      'TX', 'player', -1, 35, 405),

  -- 350-400 Fargo (improving)
  (NULL,       'Xavier',    'Young',     'Xav',      '555-0224', 'extra024@example.com', 'Keller',     'TX', 'player', -1, 34, 395),
  (NULL,       'Yara',      'Zimmer',    'Yar',      '555-0225', 'extra025@example.com', 'Southlake',  'TX', 'player', -1, 33, 390),
  (NULL,       'Zach',      'Aldridge',  'Z',        '555-0226', 'extra026@example.com', 'Trophy Cl',  'TX', 'player', -1, 32, 385),
  (NULL,       'Alana',     'Beasley',   'Lani',     '555-0227', 'extra027@example.com', 'Roanoke',    'TX', 'player', -1, 32, 380),
  (NULL,       'Brody',     'Calderon',  'Bro',      '555-0228', 'extra028@example.com', 'Justin',     'TX', 'player', -1, 31, 375),
  (NULL,       'Cleo',      'Donnelly',  'Cee',      '555-0229', 'extra029@example.com', 'Argyle',     'TX', 'player', -1, 30, 370),
  (NULL,       'Dax',       'Ellsworth', 'Dax',      '555-0230', 'extra030@example.com', 'Aubrey',     'TX', 'player', -1, 30, 365),
  (NULL,       'Esme',      'Fitch',     'Es',       '555-0231', 'extra031@example.com', 'Pilot Pt',   'TX', 'player', -2, 28, 360),
  (NULL,       'Finn',      'Gallagher', 'Finn',     '555-0232', 'extra032@example.com', 'Sanger',     'TX', 'player', -2, 27, 355),

  -- 300-350 Fargo (newer / casual)
  (NULL,       'Greta',     'Holloway',  'Gigi',     '555-0233', 'extra033@example.com', 'Krum',       'TX', 'player', -2, 26, 345),
  (NULL,       'Henry',     'Iqbal',     'Hank I',   '555-0234', 'extra034@example.com', 'Ponder',     'TX', 'player', -2, 25, 340),
  (NULL,       'Indra',     'Jacoby',    'Indi',     '555-0235', 'extra035@example.com', 'Krugerville','TX', 'player', -2, 24, 335),
  (NULL,       'Joel',      'Kowalski',  'Jojo',     '555-0236', 'extra036@example.com', 'Northlake',  'TX', 'player', -2, 23, 330),
  (NULL,       'Kara',      'Linville',  'Kar',      '555-0237', 'extra037@example.com', 'Frisco',     'TX', 'player', -2, 22, 325),
  (NULL,       'Luca',      'Mosley',    'Luc',      '555-0238', 'extra038@example.com', 'Prosper',    'TX', 'player', -2, 21, 320),
  (NULL,       'Mira',      'Nazario',   'Mir',      '555-0239', 'extra039@example.com', 'Celina',     'TX', 'player', -2, 20, 315),
  (NULL,       'Noah',      'Ostrander', 'No',       '555-0240', 'extra040@example.com', 'Anna',       'TX', 'player', -2, 20, 310),

  -- Unrated / brand new players (no Fargo)
  (NULL,       'Olive',     'Pham',      'Olly',     '555-0241', 'extra041@example.com', 'Melissa',    'TX', 'player',  0, 40, NULL),
  (NULL,       'Pax',       'Quinones',  'Pax',      '555-0242', 'extra042@example.com', 'Princeton',  'TX', 'player',  0, 40, NULL),
  (NULL,       'Quincy',    'Reddick',   'Quin',     '555-0243', 'extra043@example.com', 'Farmersvil', 'TX', 'player',  0, 40, NULL),
  (NULL,       'Rina',      'Stahl',     'Reen',     '555-0244', 'extra044@example.com', 'Wylie',      'TX', 'player',  0, 40, NULL),
  (NULL,       'Solomon',   'Tate',      'Sol',      '555-0245', 'extra045@example.com', 'Murphy',     'TX', 'player',  0, 40, NULL),
  (NULL,       'Tessa',     'Urbina',    'Tess',     '555-0246', 'extra046@example.com', 'Sachse',     'TX', 'player',  0, 40, NULL),
  (NULL,       'Ulises',    'Valdez',    'Uli',      '555-0247', 'extra047@example.com', 'Rowlett',    'TX', 'player',  0, 40, NULL),
  (NULL,       'Vera',      'Whitfield', 'Vee',      '555-0248', 'extra048@example.com', 'Rockwall',   'TX', 'player',  0, 40, NULL),
  (NULL,       'Wesley',    'Yao',       'Wes',      '555-0249', 'extra049@example.com', 'Heath',      'TX', 'player',  0, 40, NULL),
  (NULL,       'Zelda',     'Zarate',    'Zel',      '555-0250', 'extra050@example.com', 'Forney',     'TX', 'player',  0, 40, NULL)
) AS v(
  user_id, first_name, last_name, nickname, phone, email,
  city, state, role,
  starting_handicap_3v3, starting_handicap_5v5, fargo_rating
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m WHERE m.email = v.email
);
