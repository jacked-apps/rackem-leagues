-- @fileoverview Take "accept tie" off the default; best-of-3 is the default
-- tiebreaker.
--
-- Ed, 2026-10-28: "accept tie" was added as an option in case some league
-- wanted it — it was never meant to be the default, and no league he runs
-- allows ties. But it WAS the default in three places in the database:
--
--   1. preferences.tiebreaker_format column DEFAULT (20260429000001). Every
--      preferences row created without an explicit value got 'accept_tie', so
--      the stored value says "accept tie" even though nobody chose it.
--   2. resolved_league_preferences' last-resort fallback (20260605000001).
--   3. (app code — the scoring screen and the league wizard, same commit.)
--
-- It went unnoticed because the scoring screen only ever special-cased
-- 'manual': every other value, 'accept_tie' included, ran the best-of-3
-- tiebreaker. The tiebreak-record work (docs/plans/2026-10-28-001-...) makes
-- each format mean what it says, which would have quietly switched tiebreakers
-- OFF for every league carrying the accidental default.
--
-- The "Accept Tie" option is removed from the league wizard; there is no way to
-- choose it for now (Ed: "that is just fine"). The value stays legal in the
-- CHECK constraint because frozen match snapshots may still carry it.
--
-- tiebreaker_trigger is deliberately left alone: nothing in the app acts on it.

-- 1. New rows default to best-of-3.
ALTER TABLE public.preferences
  ALTER COLUMN tiebreaker_format SET DEFAULT 'best_of_3_short_race';

-- 2. Existing rows: every stored 'accept_tie' came from the column default,
--    not from a choice (Ed confirmed no league allows ties), so move them all.
UPDATE public.preferences
   SET tiebreaker_format = 'best_of_3_short_race'
 WHERE tiebreaker_format = 'accept_tie';

-- 3. The view's last-resort fallback. Identical to the 20260605000001
--    definition except the tiebreaker_format default; same columns in the same
--    order, so CREATE OR REPLACE is allowed.
CREATE OR REPLACE VIEW public.resolved_league_preferences AS
SELECT
  l.id AS league_id,
  l.organization_id,

  -- Original columns (unchanged)
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
  -- Was 'accept_tie' — see the header.
  COALESCE(league_prefs.tiebreaker_format, org_prefs.tiebreaker_format, 'best_of_3_short_race')
    AS tiebreaker_format,
  COALESCE(league_prefs.race_length, org_prefs.race_length)
    AS race_length,

  -- Scoring System Workshop — Per-Game Allocator Room
  COALESCE(league_prefs.per_game_allocator_id, org_prefs.per_game_allocator_id)
    AS per_game_allocator_id

FROM public.leagues l
LEFT JOIN public.preferences org_prefs
  ON org_prefs.entity_type = 'organization' AND org_prefs.entity_id = l.organization_id
LEFT JOIN public.preferences league_prefs
  ON league_prefs.entity_type = 'league' AND league_prefs.entity_id = l.id;
