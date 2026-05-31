-- ============================================================================
-- Migration: Seed substitute sentinel members (system data, not test data)
-- ============================================================================
--
-- The lineup-page substitution workflows write four sentinel UUIDs into
-- match_lineups.player{N}_id to represent placeholder players:
--
--   00000000-0000-0000-0000-000000000001 — anonymous sub, home side
--   00000000-0000-0000-0000-000000000002 — anonymous sub, away side
--   00000000-0000-0000-0000-000000000011 — double-duty, home side
--   00000000-0000-0000-0000-000000000012 — double-duty, away side
--
-- The match_lineups table has FK constraints (match_lineups_player{N}_id_fkey)
-- requiring every player_id to exist in the members table. Without these
-- four rows present, ANY lineup-lock that includes an anonymous sub or a
-- double-duty placeholder fails with HTTP 409 Conflict (FK violation) —
-- i.e. the substitution feature is non-functional.
--
-- These rows are SYSTEM DATA: they're required for the app to work, in
-- every environment (dev, staging, production). They belong in a
-- migration so every environment gets them automatically.
--
-- Historical context: the baseline schema comment on the members table
-- already documents these UUIDs as "special substitute members with
-- fixed UUIDs," but the baseline migration never inserted them.
-- supabase/seed.sql (a dev-only seed) included two of the four. The
-- local database/dev_*.sql bootstrap files included none. This
-- migration unifies the contract — the four rows now exist by virtue of
-- the schema migration, not by accident of seed-file content.
--
-- Idempotency: ON CONFLICT (id) DO NOTHING. Safe to re-run; safe in
-- environments that already have some or all of the sentinels.
--
-- nickname is varchar(12), enforced by the schema. The values below are
-- exactly within that limit ('Sub (Home)' = 10, 'Sub (HomeDD)' = 12).
-- ============================================================================

INSERT INTO public.members (
  id, user_id, first_name, last_name, nickname, phone, email,
  address, city, state, zip_code, date_of_birth, role,
  system_player_number, bca_member_number, membership_paid_date,
  created_at, updated_at, profanity_filter_enabled
) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, NULL, 'Home', 'Substitute',  'Sub (Home)',   '000-000-0001', 'sub.home@placeholder.local',    'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false),
  ('00000000-0000-0000-0000-000000000002'::uuid, NULL, 'Away', 'Substitute',  'Sub (Away)',   '000-000-0002', 'sub.away@placeholder.local',    'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false),
  ('00000000-0000-0000-0000-000000000011'::uuid, NULL, 'Home', 'Double Duty', 'Sub (HomeDD)', '000-000-0011', 'sub.home.dd@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false),
  ('00000000-0000-0000-0000-000000000012'::uuid, NULL, 'Away', 'Double Duty', 'Sub (AwayDD)', '000-000-0012', 'sub.away.dd@placeholder.local', 'N/A', 'N/A', 'NA', '00000', '1900-01-01'::date, 'player', nextval('public.members_system_player_number_seq'), NULL, NULL, now(), now(), false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN public.members.id IS
  'Primary key. Four UUIDs are reserved as system sentinels for substitute placeholders: '
  '00000000-0000-0000-0000-000000000001 (anon home), '
  '00000000-0000-0000-0000-000000000002 (anon away), '
  '00000000-0000-0000-0000-000000000011 (double-duty home), '
  '00000000-0000-0000-0000-000000000012 (double-duty away). '
  'These rows are seeded by migration 20260526000000_seed_substitute_sentinel_members and are required for the substitution workflows to function (FK from match_lineups.player*_id).';
