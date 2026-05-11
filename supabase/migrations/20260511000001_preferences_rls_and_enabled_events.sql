-- ============================================================================
-- BRANCH B PHASE 2 UNIT 2 — preferences RLS + enabled_events column + view rebuild
-- ============================================================================
--
-- Phase 2 of the scoring event registry rework. Phase 1 shipped the
-- TypeScript registry, game_events table, and atomic rpcs. Phase 2 adds
-- the LO override surface: a jsonb column on preferences storing per-event
-- toggles, an RLS layer so only org owners/admins can write, and a view
-- extension that does per-key jsonb merge across the org → league cascade.
--
-- KEY DECISIONS (from plan §Architecture)
--
--   * preferences had NO RLS — verified GRANT ALL TO authenticated, zero
--     policies. Adding the enabled_events column without RLS would let any
--     authenticated user upsert any league's events configuration via
--     direct PostgREST. This migration adds RLS first (defensive baseline),
--     then adds the column.
--
--   * Authorization mirrors can_write_house_rule_org / can_write_threshold_chart:
--     SECURITY DEFINER function checks organization_staff.position IN
--     ('owner', 'admin') against the row's (entity_type, entity_id):
--       entity_type='organization' → direct org match
--       entity_type='league'       → resolve org via leagues.organization_id
--
--   * enabled_events shape: sparse jsonb map { event_name: boolean }.
--     Absent key means inherit from the next cascade tier. NEVER NULL — per
--     feedback_string_sentinels_not_null memory (the 2026-05-03 silent-
--     default-collapse incident).
--
--   * View extension uses per-key jsonb || merge — first per-key cascade
--     in this view. Documented in the view's COMMENT so future jsonb
--     cascades have a model. Right operand wins per key:
--       resolved.enabled_events =
--         COALESCE(org_prefs.enabled_events, '{}'::jsonb)
--         || COALESCE(league_prefs.enabled_events, '{}'::jsonb)
--
--   * View created with SECURITY INVOKER (the default) so it respects the
--     new RLS on preferences. SELECT is OPEN on preferences, so this is
--     mostly a future-proofing note.
--
-- See plan: docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md
-- (Unit 2 Phase 2 portion, Unit 3 consumer side).
-- ============================================================================

BEGIN;

SET search_path = public;

-- ----------------------------------------------------------------------------
-- 1. Authorization predicate: can_write_preferences(entity_type, entity_id)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION can_write_preferences(
  p_entity_type TEXT,
  p_entity_id   UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_caller_member_id UUID;
BEGIN
  IF p_entity_type IS NULL OR p_entity_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_caller_member_id
    FROM members
    WHERE user_id = auth.uid();

  IF v_caller_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Resolve target org from entity.
  IF p_entity_type = 'organization' THEN
    v_org_id := p_entity_id;
  ELSIF p_entity_type = 'league' THEN
    SELECT organization_id INTO v_org_id FROM leagues WHERE id = p_entity_id;
    IF v_org_id IS NULL THEN
      RETURN FALSE;
    END IF;
  ELSE
    -- Unknown entity_type — deny by default.
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM organization_staff os
      WHERE os.member_id = v_caller_member_id
        AND os.organization_id = v_org_id
        AND os.position IN ('owner', 'admin')
  );
END;
$$;

COMMENT ON FUNCTION can_write_preferences(TEXT, UUID) IS
  'True iff the caller is owner/admin of the organization that owns the preferences row (direct for entity_type=organization, transitive via leagues.organization_id for entity_type=league). league_rep is intentionally excluded — preference edits are LO-level decisions.';

REVOKE EXECUTE ON FUNCTION can_write_preferences(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION can_write_preferences(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION can_write_preferences(TEXT, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Enable RLS + policies on preferences
-- ----------------------------------------------------------------------------
-- SELECT is OPEN (matches existing posture; the resolved view exposes
-- preference values to all authenticated readers anyway, and there's no
-- precedent for scoping prefs visibility per org). INSERT/UPDATE/DELETE
-- gated through can_write_preferences.

ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY preferences_select_public
  ON preferences
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY preferences_insert_authorized
  ON preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (can_write_preferences(entity_type, entity_id));

CREATE POLICY preferences_update_authorized
  ON preferences
  FOR UPDATE
  TO authenticated
  USING (can_write_preferences(entity_type, entity_id))
  WITH CHECK (can_write_preferences(entity_type, entity_id));

CREATE POLICY preferences_delete_authorized
  ON preferences
  FOR DELETE
  TO authenticated
  USING (can_write_preferences(entity_type, entity_id));

-- ----------------------------------------------------------------------------
-- 3. enabled_events column
-- ----------------------------------------------------------------------------

ALTER TABLE preferences
  ADD COLUMN enabled_events JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN preferences.enabled_events IS
  'Sparse override map of { event_name: boolean } against the TypeScript event registry at src/systems/game-events/. Absent key = inherit from the next cascade tier (registry default for org rows, org for league rows). NEVER stores NULL: explicit absence is the only way to express inherit. Values: true (force-enable), false (force-disable). Resolved across the org → league cascade by per-key jsonb || merge in resolved_league_preferences.';

-- ----------------------------------------------------------------------------
-- 4. Rebuild resolved_league_preferences view with per-key jsonb merge
-- ----------------------------------------------------------------------------
-- The view is DROP + CREATE because we're adding a column. Every existing
-- COALESCE is preserved verbatim — only the new enabled_events expression
-- is novel. NOTE: this is the FIRST per-key jsonb cascade in this view.
-- All existing axes are scalar COALESCE("first non-null wins"). The new
-- enabled_events uses jsonb || which is per-key right-wins-merge. Future
-- per-key jsonb axes should follow this precedent.

DROP VIEW IF EXISTS resolved_league_preferences;

CREATE VIEW resolved_league_preferences AS
SELECT
  l.id AS league_id,
  l.organization_id,
  -- Scalar axes — first non-null wins via COALESCE (unchanged from prior view).
  COALESCE(league_prefs.handicap_variant,       org_prefs.handicap_variant,       'standard')         AS handicap_variant,
  COALESCE(league_prefs.team_handicap_variant,  org_prefs.team_handicap_variant,  'standard')         AS team_handicap_variant,
  COALESCE(league_prefs.golden_break_counts_as_win, org_prefs.golden_break_counts_as_win, FALSE)      AS golden_break_counts_as_win,
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
  -- New: per-key jsonb merge. The || operator merges two jsonb objects
  -- with right-operand-wins-per-key semantics, so league overrides org
  -- per event. Absent keys in BOTH tiers fall back to the registry's
  -- enabledByDefault, applied client-side by resolveEnabledEvents().
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
  'Cascade-resolved preferences for each league: scalar axes use COALESCE(league, org, default) (first-non-null-wins); enabled_events jsonb uses per-key || merge (right-operand-wins-per-key) so league explicitly overrides org per event_name. Absent keys at the league level inherit from org; absent keys in both fall back to the TypeScript registry''s enabledByDefault at the resolver layer (src/systems/game-events/resolveEnabledEvents.ts). View is SECURITY INVOKER (default) so it respects RLS on the underlying preferences table.';

-- ----------------------------------------------------------------------------
-- 5. Re-grant SELECT on the view (DROP+CREATE clears prior grants)
-- ----------------------------------------------------------------------------

GRANT SELECT ON resolved_league_preferences TO anon, authenticated, service_role;

COMMIT;
