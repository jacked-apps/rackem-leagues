-- ============================================================================
-- POINTS_CALCULATOR — REPLACE NULL WITH EXPLICIT 'none' SENTINEL
-- ============================================================================
--
-- BUG: the original Phase 2 design treated `NULL` on
-- `preferences.points_calculator` as the "don't track points" choice. The
-- resolved-preferences view (`resolved_league_preferences`) cascades
-- league → org → default with `COALESCE`, which treats NULL as "missing"
-- and silently collapses an explicit "no points" choice to the next
-- level's default ('linear_above_threshold').
--
-- Symptom (2026-05-03 testing): an LO created a Custom league with
-- `points_calculator = NULL` ("None — don't track points"). The
-- resolved view returned 'linear_above_threshold'; that value was
-- snapshotted onto the match; the running-totals pipeline ran
-- `linear_above_threshold` faithfully — and the scoreboard showed
-- non-zero points the LO never asked to track.
--
-- FIX: make "don't track points" a first-class value, not the absence
-- of a value. Introduce the explicit string `'none'`, mark the column
-- NOT NULL, and update the CHECK constraint to require one of the four
-- known values. The resolved-view's COALESCE now works correctly
-- because it only fires when the LEFT JOIN found no row at all (true
-- "missing"), never when the row exists with the LO's explicit choice.
--
-- This pattern follows the user's stated rule: every league MUST pick
-- a games-counting system AND a points system. "Not picking" is not a
-- valid wizard outcome — `'none'` is the explicit "we tracked games,
-- not points" choice.
--
-- DATA MIGRATION: any row currently NULL is migrated to 'none' (those
-- rows reflect LOs who explicitly picked "None" via the wizard).
-- Match snapshots that captured NULL (also reflecting an explicit
-- choice) are migrated the same way. App data is disposable test data
-- per project convention; no backfill plumbing needed.
-- ============================================================================

-- 1. Drop the old CHECK FIRST. The auto-named constraint (created by
--    Postgres in 20260429000001_extend_preferences_phase2_modular_axes.sql
--    using the <table>_<column>_check format) only allows NULL plus the
--    three calculator names — it would reject the UPDATE-to-'none' below
--    if left in place. Drop it before any data changes.
ALTER TABLE public.preferences
  DROP CONSTRAINT IF EXISTS preferences_points_calculator_check;

-- 2. Replace NULL with 'none' in preferences (preserves the LO's choice).
--    Safe to run now because no CHECK gates the column.
UPDATE public.preferences
SET points_calculator = 'none'
WHERE points_calculator IS NULL;

-- 3. Replace NULL inside match snapshots with 'none' (frozen choice).
--    Matches the LO's intent at lineup-lock — these snapshots were
--    captured BEFORE the bug was understood; preserving them as 'none'
--    keeps already-prepared matches honest. Match snapshots aren't
--    constrained by the preferences CHECK, but ordering this here
--    keeps all data fixes in one block.
UPDATE public.matches
SET system_snapshot = jsonb_set(
      system_snapshot,
      '{points_calculator}',
      '"none"'::jsonb
    )
WHERE system_snapshot IS NOT NULL
  AND system_snapshot ? 'points_calculator'
  AND (system_snapshot ->> 'points_calculator') IS NULL;

-- 4. Add the corrected CHECK: 'none' is now a valid value, NULL is not.
--    Runs AFTER the UPDATEs so existing 'none' rows pass validation.
ALTER TABLE public.preferences
  ADD CONSTRAINT preferences_points_calculator_check
  CHECK (points_calculator IN (
    'none',
    'linear_above_threshold',
    'accumulate_with_milestone_jumps',
    'accumulated_per_game'
  ));

-- 5. Forbid NULL going forward. The wizard now always writes one of
--    the four valid values; legacy rows were converted in step 2.
ALTER TABLE public.preferences
  ALTER COLUMN points_calculator SET NOT NULL;

-- 6. Update the column comment to reflect the new semantics.
COMMENT ON COLUMN public.preferences.points_calculator IS
  'Points-calculation formula name. References a calculator registered in src/systems/calculators/. NOT NULL — every league must explicitly pick a value. Use ''none'' (a registered no-op calculator) when the league does not track points at all (standings sort cannot include points_earned and win_condition must be ''games''). The other three values are the Tested Preset calculators. New calculator types add themselves to the registry; the CHECK constraint is updated when new types ship.';

-- 7. Recreate the resolved-preferences view. The COALESCE chain stays
--    structurally identical, but its behavior is now correct because
--    league_prefs.points_calculator is NOT NULL — the view's
--    COALESCE only fires when the LEFT JOIN found no preferences row
--    at all (true "missing"), never when the LO made an explicit
--    choice.
DROP VIEW IF EXISTS public.resolved_league_preferences;

CREATE VIEW public.resolved_league_preferences AS
SELECT
  l.id AS league_id,
  l.organization_id,

  COALESCE(league_prefs.handicap_variant, org_prefs.handicap_variant, l.handicap_variant, 'standard')
    AS handicap_variant,
  COALESCE(league_prefs.team_handicap_variant, org_prefs.team_handicap_variant, org_prefs.handicap_variant, l.handicap_variant, 'standard')
    AS team_handicap_variant,
  COALESCE(league_prefs.game_history_limit, org_prefs.game_history_limit, 200)
    AS game_history_limit,
  COALESCE(league_prefs.golden_break_counts_as_win, org_prefs.golden_break_counts_as_win, l.golden_break_counts_as_win, true)
    AS golden_break_counts_as_win,

  -- Phase 1 modular columns
  COALESCE(league_prefs.max_roster_size, org_prefs.max_roster_size, 8)
    AS max_roster_size,
  COALESCE(league_prefs.lineup_size, org_prefs.lineup_size, 3)
    AS lineup_size,
  COALESCE(league_prefs.handicap_type, org_prefs.handicap_type, 'points')
    AS handicap_type,
  COALESCE(league_prefs.game_generation, org_prefs.game_generation, 'double_round_robin')
    AS game_generation,
  COALESCE(league_prefs.points_system, org_prefs.points_system, 'differential')
    AS points_system,
  COALESCE(league_prefs.threshold_chart_id, org_prefs.threshold_chart_id)
    AS threshold_chart_id,

  -- Phase 2 modular columns
  COALESCE(league_prefs.pairing_format, org_prefs.pairing_format, 'single_rack')
    AS pairing_format,
  -- points_calculator: NOT NULL on the column, so league_prefs value
  -- (when present) is always honored. Cascade only fires for orphan
  -- leagues with no preferences row at all.
  COALESCE(league_prefs.points_calculator, org_prefs.points_calculator, 'linear_above_threshold')
    AS points_calculator,
  COALESCE(league_prefs.points_calculator_params, org_prefs.points_calculator_params, '{}'::jsonb)
    AS points_calculator_params,
  COALESCE(league_prefs.win_condition, org_prefs.win_condition, 'games')
    AS win_condition,
  COALESCE(league_prefs.mechanism, org_prefs.mechanism, 'extra_games')
    AS mechanism,
  COALESCE(league_prefs.standings_sort, org_prefs.standings_sort, ARRAY['match_wins','games_won','points_earned']::TEXT[])
    AS standings_sort,
  COALESCE(league_prefs.tiebreaker_trigger, org_prefs.tiebreaker_trigger, 'never')
    AS tiebreaker_trigger,
  COALESCE(league_prefs.tiebreaker_format, org_prefs.tiebreaker_format, 'accept_tie')
    AS tiebreaker_format,
  COALESCE(league_prefs.race_length, org_prefs.race_length)
    AS race_length

FROM public.leagues l
LEFT JOIN public.preferences org_prefs
  ON org_prefs.entity_type = 'organization' AND org_prefs.entity_id = l.organization_id
LEFT JOIN public.preferences league_prefs
  ON league_prefs.entity_type = 'league' AND league_prefs.entity_id = l.id;

COMMENT ON VIEW public.resolved_league_preferences IS
  'Final resolved preferences for each league with full fallback chain: league → org → system default. Phase 2 axes use the calculator-as-type pattern. After 20260503000000, points_calculator is NOT NULL with ''none'' as a first-class value (replaces the buggy NULL-as-no-points convention).';
