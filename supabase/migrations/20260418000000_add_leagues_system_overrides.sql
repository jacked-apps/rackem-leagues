-- ============================================================================
-- ADD leagues.system_overrides JSONB — PER-LEAGUE DIAL OVERRIDES
-- ============================================================================
--
-- Adds a flat JSONB column to the leagues table for per-league dial overrides.
-- Each key corresponds to a dial documented in:
--   docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md
--   (Known Dials section)
--
-- Examples:
--   {}                                          — use module defaults
--   { "winner_points": 14 }                     — Fargo league overrides to 14
--   { "team_bonus_enabled": false }             — BCA league disables team bonus
--   { "loser_points_max": 7, "winner_points": 10 } — explicit Fargo defaults
--
-- Only keys that differ from the module default should be persisted. Absent
-- keys fall back to the module's hardcoded defaults. Typing and validation
-- live in TypeScript (src/types/systemOverrides.ts).
--
-- Tier 2 per the mutability hierarchy: editable between seasons, locked while
-- the current season is active (enforced at the application layer in Unit 8).
-- ============================================================================

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS system_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN leagues.system_overrides IS
  'Per-league dial overrides (winner_points, loser_points_method, team_bonus_enabled, etc.). Flat JSONB. Absent keys fall back to module defaults. See src/types/systemOverrides.ts for the typed shape.';
