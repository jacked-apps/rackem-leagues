-- Migration: restore profanity_filter_enabled to resolved_league_preferences
--
-- THE BUG. The "no profanity in team names" preference (league → org → off)
-- was resolved by this view from 20251202194308. When 20260417000000 rebuilt
-- the view for the modular scoring columns, profanity_filter_enabled was left
-- out, and every rebuild since copied that list. getOperatorProfanityFilter()
-- selects the column, PostgREST rejects the select, and the team editor treats
-- the error as "filter off" — so the setting has done nothing since April 2026.
--
-- THE FIX. Add the column back with the original fallback chain.
--
-- WHY CREATE OR REPLACE (not DROP + CREATE). It may only append columns, which
-- is all this needs, and it keeps the view's existing grants and comment
-- intact. Every existing column below is copied verbatim from 20260605000001.

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
  COALESCE(league_prefs.tiebreaker_format, org_prefs.tiebreaker_format, 'accept_tie')
    AS tiebreaker_format,
  COALESCE(league_prefs.race_length, org_prefs.race_length)
    AS race_length,

  -- Scoring System Workshop — Per-Game Allocator Room
  COALESCE(league_prefs.per_game_allocator_id, org_prefs.per_game_allocator_id)
    AS per_game_allocator_id,

  -- Restored: dropped by accident when 20260417000000 rebuilt this view.
  -- Same chain as the original (20251202194308): league → org → off.
  COALESCE(league_prefs.profanity_filter_enabled, org_prefs.profanity_filter_enabled, false)
    AS profanity_filter_enabled

FROM public.leagues l
LEFT JOIN public.preferences org_prefs
  ON org_prefs.entity_type = 'organization' AND org_prefs.entity_id = l.organization_id
LEFT JOIN public.preferences league_prefs
  ON league_prefs.entity_type = 'league' AND league_prefs.entity_id = l.id;

COMMENT ON VIEW public.resolved_league_preferences IS
  'Final resolved preferences for each league with full fallback chain: league → org → system default. Includes original columns, Phase 1 + Phase 2 modular columns, the per-game allocator workshop pointer (per_game_allocator_id), and profanity_filter_enabled.';
