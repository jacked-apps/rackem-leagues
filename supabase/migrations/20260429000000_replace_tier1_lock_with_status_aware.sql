-- ============================================================================
-- TIER 1 LOCK — STATUS-AWARE REPLACEMENT
-- ============================================================================
--
-- Phase 1 Unit 1.1 of the modular-league-system plan
-- (docs/plans/2026-04-28-001-feat-modular-league-system-plan.md).
--
-- Replaces the permanent-lock trigger from
-- supabase/migrations/20260418000002_lock_tier1_preferences.sql with a
-- status-aware version that allows handicap_type and lineup_size edits
-- BEFORE any matches in the league have been started, and blocks them
-- AFTER. This honors the modular plan's graceful-degradation principle:
-- LOs configuring a fresh league should be able to adjust scoring system
-- and lineup size up until the season actually begins.
--
-- BLOCK CONDITION (after change):
--   The trigger blocks the UPDATE if and only if the league has at least
--   one match with status != 'scheduled'. Once a single match transitions
--   out of 'scheduled' (i.e., a captain has begun lineup-prep, or a game
--   has been scored, or the match has been completed/vacated/forfeited),
--   the league's tier-1 preferences become immutable for the rest of the
--   season — protecting in-flight match data from retroactive scoring
--   changes.
--
-- JOIN PATH (REQUIRED — easy to get wrong):
--   matches do NOT have a direct league_id column. They reference
--   seasons.id, and seasons references leagues.id. The trigger therefore
--   must JOIN through seasons:
--
--     matches m JOIN seasons s ON m.season_id = s.id
--     WHERE s.league_id = NEW.entity_id AND m.status <> 'scheduled'
--
--   Skipping the join silently allows lock bypass (no rows = "league
--   has no matches" even if it does).
--
-- CONCURRENCY (race-safety):
--   The trigger and the lifecycle hook that transitions matches from
--   'scheduled' to 'in_progress' can race. To serialize concurrent
--   operations against the same league, the trigger acquires a
--   transaction-scoped advisory lock keyed on the league id. The
--   matching lifecycle hook (Phase 5 Unit 5.x — to be added) will
--   acquire the same lock to ensure preference UPDATEs and match status
--   transitions cannot interleave.
--
-- INSERT and "first-population from NULL" behavior:
--   Same as the previous trigger — INSERTs are unaffected, and an
--   UPDATE that sets a tier-1 field for the first time (NULL → value)
--   is still allowed. This matters because trigger_create_league_preferences
--   auto-creates a preferences row with all modular fields NULL, and the
--   wizard then upserts the real values via UPDATE.
--
-- ORG-LEVEL ROWS:
--   Same as before — the trigger applies only to entity_type = 'league'.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_tier1_league_preference_change()
RETURNS TRIGGER AS $$
DECLARE
    v_has_active_match BOOLEAN;
BEGIN
    IF OLD.entity_type <> 'league' THEN
        RETURN NEW;
    END IF;

    -- Fast-exit: if neither tier-1 field is being changed (or being changed
    -- from NULL → value, which is the initial-population case), no need to
    -- acquire the advisory lock or query matches.
    IF (OLD.handicap_type IS NULL OR OLD.handicap_type IS NOT DISTINCT FROM NEW.handicap_type)
       AND (OLD.lineup_size IS NULL OR OLD.lineup_size IS NOT DISTINCT FROM NEW.lineup_size) THEN
        RETURN NEW;
    END IF;

    -- Acquire transaction-scoped advisory lock keyed on the league id.
    -- The lifecycle hook that transitions matches scheduled → in_progress
    -- (Phase 5) will acquire the same lock to prevent interleaving.
    PERFORM pg_advisory_xact_lock(hashtext('league_pref_change_' || NEW.entity_id::text));

    -- Status-aware block: any match past 'scheduled' makes tier-1 immutable.
    -- JOIN PATH: matches → seasons → leagues. matches.season_id is the FK;
    -- seasons.league_id matches our preferences.entity_id (which is the
    -- league id when entity_type = 'league').
    SELECT EXISTS (
        SELECT 1
        FROM matches m
        JOIN seasons s ON m.season_id = s.id
        WHERE s.league_id = NEW.entity_id
          AND m.status <> 'scheduled'
        LIMIT 1
    )
    INTO v_has_active_match;

    IF NOT v_has_active_match THEN
        -- League has no in-flight matches yet — tier-1 edits allowed.
        RETURN NEW;
    END IF;

    -- League has at least one match past 'scheduled'. Block tier-1 edits.
    IF OLD.handicap_type IS NOT NULL
       AND OLD.handicap_type IS DISTINCT FROM NEW.handicap_type THEN
        RAISE EXCEPTION 'Cannot change handicap_type on a league with in-flight matches. Tier-1 preferences are locked once the season begins. (tier 1 immutable after first match)'
          USING ERRCODE = '22023';
    END IF;

    IF OLD.lineup_size IS NOT NULL
       AND OLD.lineup_size IS DISTINCT FROM NEW.lineup_size THEN
        RAISE EXCEPTION 'Cannot change lineup_size on a league with in-flight matches. Tier-1 preferences are locked once the season begins. (tier 1 immutable after first match)'
          USING ERRCODE = '22023';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, auth;

-- The trigger from the previous migration is redefined here in case the
-- previous version was dropped manually; CREATE OR REPLACE on the function
-- is the actual swap. Trigger DDL is idempotent.
DROP TRIGGER IF EXISTS lock_tier1_league_preferences ON preferences;
CREATE TRIGGER lock_tier1_league_preferences
    BEFORE UPDATE ON preferences
    FOR EACH ROW
    EXECUTE FUNCTION prevent_tier1_league_preference_change();

COMMENT ON FUNCTION prevent_tier1_league_preference_change IS
  'Status-aware tier-1 mutability enforcement (replaces permanent lock from 20260418000002). Blocks UPDATE of preferences.handicap_type and preferences.lineup_size when entity_type = league AND the league has at least one match past scheduled status. Allows pre-season edits. Acquires pg_advisory_xact_lock per league to prevent races with match-status transitions. Phase 1 Unit 1.1 of modular-league plan.';
