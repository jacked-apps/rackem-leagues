-- ============================================================================
-- PHASE 2 UNIT 2.3a — EXTEND resolved_league_preferences WITH PHASE 2 COLUMNS
-- ============================================================================
--
-- The previous view (20260417000000_add_modular_to_resolved_view) cascaded
-- the first round of modular columns. THIS migration adds the 8 Phase 2
-- columns from 20260429000001_extend_preferences_phase2_modular_axes.sql to
-- the same league → org → default cascade.
--
-- Cascade: league_prefs → org_prefs → SQL DEFAULT (matching column DEFAULTs)
--
-- Defaults align with the column DEFAULTs in 20260429000001:
--   pairing_format       = 'single_rack'
--   scoring_method       = 'winner_takes_all'
--   win_condition        = 'first_to_games'
--   mechanism            = 'extra_games'
--   standings_sort       = ARRAY['match_wins','games_won','points_earned']
--   tiebreaker_trigger   = 'never'
--   tiebreaker_format    = 'accept_tie'
--   race_length          = NULL
-- ============================================================================

DROP VIEW IF EXISTS public.resolved_league_preferences;

CREATE VIEW public.resolved_league_preferences AS
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
  -- Phase 7 Unit 7.3: `team_format` column dropped from leagues +
  -- preferences. Lineup geometry comes from `lineup_size` below.
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

  -- Phase 2 modular columns (new — names corrected per the v2 plan's
  -- architectural reframe: scoring_method → points_calculator,
  -- and win_condition value space collapsed from 4 values to 2)
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
  'Final resolved preferences for each league with full fallback chain: league → org → system default. Includes original columns, Phase 1 modular columns (handicap_type, lineup_size, max_roster_size, game_generation, points_system, threshold_chart_id), and Phase 2 modular columns (pairing_format, points_calculator, points_calculator_params, win_condition [games|points], mechanism, standings_sort, tiebreaker_trigger, tiebreaker_format, race_length). Reflects the v2 architectural reframe.';
