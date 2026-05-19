-- ============================================================================
-- BRANCH A UNIT 2 — generalize per-game scoring storage
-- ============================================================================
--
-- The old `loser_balls_pocketed` column baked 10-7-specific ball-count
-- semantics into the schema. The actual concept is "per-game input value
-- the calculator consumes" — could be points, balls, or any number whose
-- meaning the active calculator's scoringPopupFields() spec defines.
--
-- 1. DROP `loser_balls_pocketed`. Per project policy, all current data
--    is disposable test data — no backfill plumbing required.
--
-- 2. ADD `winner_value` and `loser_value` as nullable integer columns.
--    Each holds the per-game input collected by the scoring modal for
--    its corresponding side. The active calculator's compute() function
--    interprets the values at read time (e.g., for accumulated_per_game
--    Fargo 10-7: loser_value 0-7 → loser earns N points). Future
--    calculators with arbitrary winner-side or wider-range counters
--    populate these columns without further schema changes.
--
-- See docs/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md.
-- ============================================================================

ALTER TABLE match_games DROP COLUMN IF EXISTS loser_balls_pocketed;

ALTER TABLE match_games ADD COLUMN winner_value integer;
ALTER TABLE match_games ADD COLUMN loser_value integer;

COMMENT ON COLUMN match_games.winner_value IS
  'Calculator-driven per-game input value collected by the scoring modal for the winning side. Meaning is determined by the active calculator''s scoringPopupFields() spec (see src/systems/calculators/types.ts). NULL when the calculator declares the winner side as kind: ''fixed'' (no input) or when the league does not track points.';
COMMENT ON COLUMN match_games.loser_value IS
  'Calculator-driven per-game input value collected by the scoring modal for the losing side. For Fargo 10-7 (accumulated_per_game), this is the count of balls the loser pocketed before losing (renamed from the old loser_balls_pocketed column). NULL when the calculator declares the loser side as kind: ''fixed'' (no input) or when the league does not track points.';
