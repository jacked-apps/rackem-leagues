-- ============================================================================
-- Migration: Relax match_games position CHECK constraints (1..5 → 1..20)
-- ============================================================================
--
-- The baseline schema capped `match_games.home_position` and
-- `match_games.away_position` at 1..5 via two CHECK constraints:
--
--   match_games_home_position_check  CHECK (home_position >= 1 AND <= 5)
--   match_games_away_position_check  CHECK (away_position >= 1 AND <= 5)
--
-- That was fine when every shipped Scoring System used a lineup_size of
-- 3 or 5. After the Pairings Generator extraction (PR #149) the new
-- Module is lineup_size-agnostic at the TS level — it accepts any
-- positive integer + either round-robin mode and produces correct slot
-- lists for 6v6, 7v7, etc. (verified by cross-combo tests in
-- src/systems/pairings/__tests__/pairings.test.ts).
--
-- The DB schema is the only remaining bottleneck: prep_match would fail
-- with a constraint violation the moment it tried to write a row with
-- home_position = 6 (or higher).
--
-- This migration relaxes both bounds to 1..20 — matching the existing
-- preferences_max_roster_size_check ceiling already in the schema. No
-- shipping system uses 6v6+ yet, so no data backfill needed; this only
-- widens what's acceptable for FUTURE writes.
--
-- Sensible upper bound rationale: 20 mirrors the
-- preferences_max_roster_size_check (the administrative roster cap)
-- which is already the canonical "largest reasonable team size" value
-- in the schema. Going higher than that crosses into "no realistic
-- league configuration" territory.
--
-- See also: LIST_FOR_ED.md "2026-05-26 — Relax match_games position
-- CHECK constraint for 6v6+" — this is the follow-on the pairings
-- plan's Scope Boundaries section called out.
-- ============================================================================

ALTER TABLE public.match_games
  DROP CONSTRAINT IF EXISTS match_games_home_position_check;

ALTER TABLE public.match_games
  ADD CONSTRAINT match_games_home_position_check
  CHECK (home_position >= 1 AND home_position <= 20);

ALTER TABLE public.match_games
  DROP CONSTRAINT IF EXISTS match_games_away_position_check;

ALTER TABLE public.match_games
  ADD CONSTRAINT match_games_away_position_check
  CHECK (away_position >= 1 AND away_position <= 20);

COMMENT ON CONSTRAINT match_games_home_position_check ON public.match_games IS
  'Home player lineup position. Bounds widened from 1..5 to 1..20 by '
  'migration 20260526000001 to match preferences_max_roster_size_check '
  'and unblock 6v6+ scoring systems at the schema layer. The Pairings '
  'Generator Module is lineupSize-agnostic; this CHECK previously was '
  'the only thing preventing 6v6+ matches from persisting.';

COMMENT ON CONSTRAINT match_games_away_position_check ON public.match_games IS
  'Away player lineup position. Bounds widened from 1..5 to 1..20 by '
  'migration 20260526000001 to match preferences_max_roster_size_check '
  'and unblock 6v6+ scoring systems at the schema layer.';
