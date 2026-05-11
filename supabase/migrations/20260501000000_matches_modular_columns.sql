-- ============================================================================
-- PHASE 2 UNIT 2.1 (matches table portion) — column rename + redundancy drop
-- ============================================================================
--
-- The architectural reframe captured in the v2 plan splits the
-- preferences-table changes (handled in 20260429000001 / 20260429000002,
-- edited in place per the consolidation rule) from the matches-table
-- changes (handled here, since these columns came from the baseline
-- migration that pre-dates this branch).
--
-- 1. RENAME threshold columns from games-only names to mode-neutral names.
--    The columns hold a target/threshold number; what that number means
--    depends on the league's win_condition (games count or points value).
--    The old "games_to_*" names lied when win_condition='points'.
--
--    Renames:
--      home_games_to_win  → home_to_win    (and away/tie/lose counterparts)
--
-- 2. DROP `home_team_score` and `away_team_score` columns.
--    These were redundant — populated at match-end with either the team's
--    games-won count (BCA) or points-earned (Fargo), depending on league
--    type. Same column, two different meanings, both already stored in
--    other columns (home_games_won / home_points_earned). The duplication
--    silently drifted between leagues. See plan Decision section.
--
-- Phase 5 Unit 5.5 then routes per-game scoring through the calculator
-- registry, updating home_games_won / home_points_earned per scoring
-- mutation. Match completion stops being a "snapshot" event for these
-- columns — they're already current from the running per-game writes.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Rename threshold columns to mode-neutral names
-- ---------------------------------------------------------------------------

ALTER TABLE matches RENAME COLUMN home_games_to_win  TO home_to_win;
ALTER TABLE matches RENAME COLUMN away_games_to_win  TO away_to_win;
ALTER TABLE matches RENAME COLUMN home_games_to_tie  TO home_to_tie;
ALTER TABLE matches RENAME COLUMN away_games_to_tie  TO away_to_tie;
ALTER TABLE matches RENAME COLUMN home_games_to_lose TO home_to_lose;
ALTER TABLE matches RENAME COLUMN away_games_to_lose TO away_to_lose;

COMMENT ON COLUMN matches.home_to_win IS
  'Home team threshold to win the match. Unit depends on win_condition: games count when win_condition=''games''; points target when win_condition=''points'' (NULL for play-all-games-no-target). The ResolvedSystemConfig snapshot carries the unit context.';
COMMENT ON COLUMN matches.away_to_win IS
  'Away team threshold to win the match. See home_to_win comment for unit semantics.';
COMMENT ON COLUMN matches.home_to_tie IS
  'Home team threshold to tie. Unit depends on win_condition: games count when win_condition=''games'' (the tie band edge); start-points credit when win_condition=''points'' + mechanism=start_points (the points credit the team begins the match with). NULL when no tie possible.';
COMMENT ON COLUMN matches.away_to_tie IS
  'Away team threshold to tie. See home_to_tie comment for unit semantics.';
COMMENT ON COLUMN matches.home_to_lose IS
  'Home team decisive-loss threshold (games count). NULL when not applicable (e.g., points-mode matches).';
COMMENT ON COLUMN matches.away_to_lose IS
  'Away team decisive-loss threshold. See home_to_lose comment.';

-- ---------------------------------------------------------------------------
-- 2. Drop redundant team_score columns
-- ---------------------------------------------------------------------------
--
-- These columns were written by MatchEndVerification at match-end with
-- either the games-won count or points-earned value (depending on league
-- type). The same value is already stored in home_games_won or
-- home_points_earned. Removing the duplication eliminates a silent-drift
-- bug surface. Display layer reads home_games_won or home_points_earned
-- directly based on the snapshot's win_condition.

ALTER TABLE matches DROP COLUMN IF EXISTS home_team_score;
ALTER TABLE matches DROP COLUMN IF EXISTS away_team_score;

COMMIT;
