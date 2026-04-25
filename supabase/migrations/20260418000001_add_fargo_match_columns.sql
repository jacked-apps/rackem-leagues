-- ============================================================================
-- ADD FARGO COLUMNS TO matches AND match_games
-- ============================================================================
--
-- Schema support for Fargo 5v5 scoring:
--
-- matches.fargo_start_points
--   Team handicap awarded to the weaker team at match start, computed once
--   from lineup pairings per the FargoRate formula (see
--   docs/research/fargorate-formula.md). Integer; nullable for BCA matches.
--   Captain-overridable at lineup-lock confirmation per Unit 11.
--
-- match_games.winner_points / loser_points / loser_balls_pocketed
--   Per-game Fargo scoring fields. Winner points defaults to 10 per game
--   (override via leagues.system_overrides.winner_points). Loser points
--   are 0-7 depending on balls pocketed in 8-ball. All nullable — BCA
--   games leave them NULL; Fargo games populate them.
--
-- No CHECK constraints on ranges: TypeScript validates at the single write
-- path (the scoring modal, Unit 11). This keeps the schema flexible for
-- future Fargo scoring variants (14-point, 17-point, etc.) without
-- requiring another migration.
--
-- Tier 3 per the mutability hierarchy: once a game is scored and these
-- columns are written, they don't re-read from "live" overrides. The values
-- stored here are the frozen record of what happened.
-- ============================================================================

-- === matches: team-level Fargo start points ===

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fargo_start_points INTEGER;

COMMENT ON COLUMN matches.fargo_start_points IS
  'Fargo: team handicap awarded to the weaker team at match start. NULL for non-Fargo matches. Computed from lineup pairings at lineup lock (Unit 11), captain-overridable, then frozen for the match duration.';

-- === match_games: per-game Fargo scoring ===

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS winner_points INTEGER;

COMMENT ON COLUMN match_games.winner_points IS
  'Fargo winner points for this game. Default 10 per game, override-able via leagues.system_overrides.winner_points. NULL for BCA matches.';

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS loser_points INTEGER;

COMMENT ON COLUMN match_games.loser_points IS
  'Fargo loser points for this game. 0-7 for 8-ball (balls the loser pocketed). NULL for BCA matches.';

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS loser_balls_pocketed INTEGER;

COMMENT ON COLUMN match_games.loser_balls_pocketed IS
  'Fargo raw input: how many balls the loser pocketed this game. Drives loser_points (commonly 1:1, override-able via loser_points_method). NULL for BCA matches.';
