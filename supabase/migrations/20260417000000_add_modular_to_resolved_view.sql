-- ============================================================================
-- ADD MODULAR COLUMNS TO resolved_league_preferences VIEW
-- ============================================================================
--
-- The existing view only resolves the original columns (handicap_variant,
-- team_format, etc.). This migration replaces it to also include the modular
-- configuration columns added by 20260410000000_extend_preferences_modular.sql:
--
--   max_roster_size, lineup_size, handicap_type, game_generation,
--   points_system, threshold_chart_id
--
-- Cascade remains: league prefs → org prefs → system default.
-- ============================================================================

-- Must drop first — Postgres doesn't allow adding columns via CREATE OR REPLACE VIEW.
-- This is safe: it's a view (no data stored), and we recreate it immediately below.
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
  COALESCE(league_prefs.team_format, org_prefs.team_format, l.team_format::text)
    AS team_format,
  COALESCE(league_prefs.golden_break_counts_as_win, org_prefs.golden_break_counts_as_win, l.golden_break_counts_as_win, true)
    AS golden_break_counts_as_win,

  -- Modular columns (new)
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
    AS threshold_chart_id

FROM public.leagues l
LEFT JOIN public.preferences org_prefs
  ON org_prefs.entity_type = 'organization' AND org_prefs.entity_id = l.organization_id
LEFT JOIN public.preferences league_prefs
  ON league_prefs.entity_type = 'league' AND league_prefs.entity_id = l.id;

COMMENT ON VIEW public.resolved_league_preferences IS
  'Final resolved preferences for each league with full fallback chain: league → org → system default. Includes both original and modular (Wizard 2.0) columns.';
