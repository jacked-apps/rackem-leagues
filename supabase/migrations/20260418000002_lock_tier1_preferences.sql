-- ============================================================================
-- TIER 1 IMMUTABILITY: LOCK handicap_type AND lineup_size ON LEAGUE ROWS
-- ============================================================================
--
-- Per the mutability hierarchy documented in
-- docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md:
--
-- Tier 1 — League-immutable: handicap_type, lineup_size
--   Cannot change after league creation. Philosophy: "Want different?
--   Start a new league."
--
-- This trigger enforces it at the DB level so no code path — not an admin
-- script, not a direct SQL edit, not a buggy mutation — can accidentally
-- shift a league's scoring system or lineup size once set.
--
-- Scope:
--   - Applies ONLY to rows with entity_type = 'league'.
--   - Organization-level rows (entity_type = 'organization') remain editable;
--     they are templates that cascade to new leagues.
--   - INSERTs of league rows are allowed (tier 1 values are set at creation).
--   - UPDATEs that leave handicap_type and lineup_size unchanged are allowed
--     (so other league preferences can be tweaked normally).
--   - UPDATEs that set tier 1 fields for the first time are allowed (initial
--     population from NULL -> value). This matters because the existing
--     AFTER INSERT trigger `trigger_create_league_preferences` auto-creates
--     a preferences row with all modular fields NULL, and the wizard then
--     upserts the real values -- which PostgREST routes through UPDATE.
--   - UPDATEs that change either field from one real value to a different
--     real value (or back to NULL) raise an exception.
--
-- Pattern mirrors prevent_global_chart_modification in
-- supabase/migrations/20260410000002_threshold_charts.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_tier1_league_preference_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.entity_type = 'league' THEN
        IF OLD.handicap_type IS NOT NULL
           AND OLD.handicap_type IS DISTINCT FROM NEW.handicap_type THEN
            RAISE EXCEPTION 'Cannot change handicap_type on an existing league. Create a new league if you need a different scoring system. (tier 1 immutable)'
              USING ERRCODE = '22023'; -- invalid_parameter_value
        END IF;

        IF OLD.lineup_size IS NOT NULL
           AND OLD.lineup_size IS DISTINCT FROM NEW.lineup_size THEN
            RAISE EXCEPTION 'Cannot change lineup_size on an existing league. Create a new league if you need a different lineup size. (tier 1 immutable)'
              USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_tier1_league_preferences ON preferences;
CREATE TRIGGER lock_tier1_league_preferences
    BEFORE UPDATE ON preferences
    FOR EACH ROW
    EXECUTE FUNCTION prevent_tier1_league_preference_change();

COMMENT ON FUNCTION prevent_tier1_league_preference_change IS
  'Tier 1 mutability enforcement: blocks UPDATE of preferences.handicap_type and preferences.lineup_size when entity_type = league. Organization-level rows are unaffected.';
