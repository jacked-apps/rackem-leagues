/**
 * Create test users for RLS testing
 *
 * These users can be used in automated tests with createAuthenticatedClient()
 * Password for all users: test-password-123
 *
 * Password hash generated with: bcrypt('test-password-123', 10)
 * Hash: $2a$10$rN8eJLJ3mRqKWPkKXq.5ieTqMbE4z.QZJ5v3G5.5k5VxYqJ5Gu5K2
 */

-- Player user (regular player, no special permissions)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '00000000-0000-0000-0000-000000000000',
  'player@test.com',
  '$2a$10$rN8eJLJ3mRqKWPkKXq.5ieTqMbE4z.QZJ5v3G5.5k5VxYqJ5Gu5K2',
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Operator user (league operator)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '00000000-0000-0000-0000-000000000000',
  'operator@test.com',
  '$2a$10$rN8eJLJ3mRqKWPkKXq.5ieTqMbE4z.QZJ5v3G5.5k5VxYqJ5Gu5K2',
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Captain user (team captain)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '00000000-0000-0000-0000-000000000000',
  'captain@test.com',
  '$2a$10$rN8eJLJ3mRqKWPkKXq.5ieTqMbE4z.QZJ5v3G5.5k5VxYqJ5Gu5K2',
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Owner user (organization owner)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) VALUES (
  '44444444-4444-4444-4444-444444444444'::uuid,
  '00000000-0000-0000-0000-000000000000',
  'owner@test.com',
  '$2a$10$rN8eJLJ3mRqKWPkKXq.5ieTqMbE4z.QZJ5v3G5.5k5VxYqJ5Gu5K2',
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding member records for each test user
-- This links auth users to the members table

INSERT INTO public.members (
  id,
  user_id,
  first_name,
  last_name,
  city,
  state,
  email,
  phone,
  role,
  system_player_number,
  created_at,
  updated_at
) VALUES
  -- Player
  (
    '11111111-aaaa-aaaa-aaaa-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Test',
    'Player',
    'Reno',
    'NV',
    'player@test.com',
    '555-0001',
    'player',
    100001,
    NOW(),
    NOW()
  ),
  -- Operator
  (
    '22222222-bbbb-bbbb-bbbb-222222222222'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Test',
    'Operator',
    'Reno',
    'NV',
    'operator@test.com',
    '555-0002',
    'league_operator',
    100002,
    NOW(),
    NOW()
  ),
  -- Captain
  (
    '33333333-cccc-cccc-cccc-333333333333'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    'Test',
    'Captain',
    'Reno',
    'NV',
    'captain@test.com',
    '555-0003',
    'player',
    100003,
    NOW(),
    NOW()
  ),
  -- Owner
  (
    '44444444-dddd-dddd-dddd-444444444444'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    'Test',
    'Owner',
    'Reno',
    'NV',
    'owner@test.com',
    '555-0004',
    'league_operator',
    100004,
    NOW(),
    NOW()
  )
ON CONFLICT (user_id) DO NOTHING;
