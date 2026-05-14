-- ============================================================================
-- BRANCH B PHASE 2 FOLLOWUP — deprecate golden_break_counts_as_win
-- ============================================================================
--
-- Phase 2 made enabled_events.golden_break the LO-facing toggle for whether
-- Golden Break renders in the scoring modal. The legacy
-- leagues.golden_break_counts_as_win column encodes the same decision
-- (tracking GB as a stat requires it to count as a win — the two are tied).
-- Phase 2 synced them on save to keep the modal consistent. This migration
-- collapses to a single source of truth: enabled_events.golden_break.
--
-- DATA PRESERVATION
--
-- Per project policy (`feedback_dev_data_disposable`) we could just drop and
-- rebuild. But the LO might have actively toggled this preference; preserving
-- the explicit-true case prevents that work from vanishing. For each league
-- whose `golden_break_counts_as_win` is explicitly TRUE, we write
-- `enabled_events.golden_break = true` into the preferences row so the
-- cascade resolves to the same effective state post-migration.
--
-- The explicit-FALSE case doesn't need preservation — the new registry
-- default for golden_break on 8-ball is `false` (BCA standard), so leagues
-- that had GB off (the typical case) get the same behavior with zero
-- override. Explicit-false write would be redundant.
--
-- See plan: docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md
-- ============================================================================

BEGIN;

SET search_path = public;

-- ----------------------------------------------------------------------------
-- 1. Data preservation: explicit-TRUE leagues get enabled_events.golden_break = true
-- ----------------------------------------------------------------------------
-- INSERT a preferences row for any league with GB=TRUE that doesn't already
-- have a row; UPDATE existing rows to merge {golden_break: true} into their
-- enabled_events jsonb. The trigger that auto-creates preferences rows on
-- league insert means most leagues will have a row already.
-- ----------------------------------------------------------------------------

-- Existing preferences rows: merge {golden_break: true} into enabled_events.
UPDATE preferences
   SET enabled_events = COALESCE(enabled_events, '{}'::jsonb)
                        || jsonb_build_object('golden_break', true)
 WHERE entity_type = 'league'
   AND entity_id IN (
     SELECT id FROM leagues WHERE golden_break_counts_as_win = TRUE
   );

-- Leagues with GB=TRUE that have no preferences row yet (rare, but safe).
INSERT INTO preferences (entity_type, entity_id, enabled_events)
SELECT 'league', l.id, jsonb_build_object('golden_break', true)
  FROM leagues l
 WHERE l.golden_break_counts_as_win = TRUE
   AND NOT EXISTS (
     SELECT 1 FROM preferences p
      WHERE p.entity_type = 'league' AND p.entity_id = l.id
   );

-- ----------------------------------------------------------------------------
-- 2. Drop the resolved view (it references preferences.golden_break_counts_as_win)
-- ----------------------------------------------------------------------------
-- Postgres won't let us DROP COLUMN while a view depends on it, even with
-- CASCADE we'd lose policies/grants. Drop the view explicitly first, then
-- drop the columns, then recreate the view in step 4.

DROP VIEW IF EXISTS resolved_league_preferences;

-- ----------------------------------------------------------------------------
-- 3. Drop the legacy column from both tables
-- ----------------------------------------------------------------------------

ALTER TABLE leagues DROP COLUMN IF EXISTS golden_break_counts_as_win;
ALTER TABLE preferences DROP COLUMN IF EXISTS golden_break_counts_as_win;

-- ----------------------------------------------------------------------------
-- 4. Rebuild resolved_league_preferences view without the dropped column
-- ----------------------------------------------------------------------------

CREATE VIEW resolved_league_preferences AS
SELECT
  l.id AS league_id,
  l.organization_id,
  COALESCE(league_prefs.handicap_variant,       org_prefs.handicap_variant,       'standard')         AS handicap_variant,
  COALESCE(league_prefs.team_handicap_variant,  org_prefs.team_handicap_variant,  'standard')         AS team_handicap_variant,
  COALESCE(league_prefs.game_history_limit,     org_prefs.game_history_limit,     100)                AS game_history_limit,
  COALESCE(league_prefs.allow_unauthorized_players, org_prefs.allow_unauthorized_players, TRUE)       AS allow_unauthorized_players,
  COALESCE(league_prefs.profanity_filter_enabled,   org_prefs.profanity_filter_enabled,   FALSE)      AS profanity_filter_enabled,
  COALESCE(league_prefs.lineup_size,            org_prefs.lineup_size,            3)                  AS lineup_size,
  COALESCE(league_prefs.max_roster_size,        org_prefs.max_roster_size,        5)                  AS max_roster_size,
  COALESCE(league_prefs.game_generation,        org_prefs.game_generation,        'double_round_robin') AS game_generation,
  COALESCE(league_prefs.handicap_type,          org_prefs.handicap_type,          'points')           AS handicap_type,
  COALESCE(league_prefs.points_system,          org_prefs.points_system,          'differential')     AS points_system,
  COALESCE(league_prefs.threshold_chart_id,     org_prefs.threshold_chart_id,     NULL)               AS threshold_chart_id,
  COALESCE(league_prefs.pairing_format,         org_prefs.pairing_format,         'single_rack')      AS pairing_format,
  COALESCE(league_prefs.points_calculator,      org_prefs.points_calculator,      'linear_above_threshold') AS points_calculator,
  COALESCE(league_prefs.points_calculator_params, org_prefs.points_calculator_params, '{}'::jsonb)    AS points_calculator_params,
  COALESCE(league_prefs.win_condition,          org_prefs.win_condition,          'games')            AS win_condition,
  COALESCE(league_prefs.mechanism,              org_prefs.mechanism,              'extra_games')      AS mechanism,
  COALESCE(league_prefs.standings_sort,         org_prefs.standings_sort,         ARRAY['match_wins', 'games_won', 'points_earned']) AS standings_sort,
  COALESCE(league_prefs.tiebreaker_trigger,     org_prefs.tiebreaker_trigger,     'never')            AS tiebreaker_trigger,
  COALESCE(league_prefs.tiebreaker_format,      org_prefs.tiebreaker_format,      'accept_tie')       AS tiebreaker_format,
  COALESCE(league_prefs.race_length,            org_prefs.race_length,            NULL)               AS race_length,
  COALESCE(org_prefs.enabled_events, '{}'::jsonb)
    || COALESCE(league_prefs.enabled_events, '{}'::jsonb)                                            AS enabled_events
FROM leagues l
LEFT JOIN preferences org_prefs
  ON org_prefs.entity_type = 'organization'
  AND org_prefs.entity_id = l.organization_id
LEFT JOIN preferences league_prefs
  ON league_prefs.entity_type = 'league'
  AND league_prefs.entity_id = l.id;

COMMENT ON VIEW resolved_league_preferences IS
  'Cascade-resolved preferences for each league. Scalar axes use COALESCE(league, org, default); enabled_events uses per-key jsonb || merge (right-operand-wins). Whether Golden Break counts as a win is now expressed via enabled_events.golden_break (cascade-resolved with registry default) — the legacy golden_break_counts_as_win column was dropped 2026-05-12.';

GRANT SELECT ON resolved_league_preferences TO anon, authenticated, service_role;

COMMIT;
