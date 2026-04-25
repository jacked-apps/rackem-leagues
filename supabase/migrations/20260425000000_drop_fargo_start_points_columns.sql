-- Migration: Drop fargo_start_points* columns from matches
--
-- The Fargo start-points negotiation flow originally added three dedicated
-- columns to the matches row (added in 20260419000000). Those are now being
-- removed in favor of repurposing the existing threshold columns:
--
--   matches.home_games_to_win  / away_games_to_win   = race target (Fargo)
--   matches.home_games_to_tie  / away_games_to_tie   = start points (Fargo;
--                                                       only weaker team's is non-zero)
--   matches.home_games_to_lose / away_games_to_lose  = confirmation player #
--                                                       (system_player_number; non-null
--                                                        means that captain confirmed)
--
-- This avoids per-system schema additions: each handicap system interprets
-- the existing 6 threshold columns according to its own semantics. Fargo
-- support is verified against BCA's official FargoRate calculator while
-- in dev — once verified, the negotiation flow goes away entirely.

ALTER TABLE matches DROP COLUMN IF EXISTS fargo_start_points;
ALTER TABLE matches DROP COLUMN IF EXISTS fargo_start_points_confirmed_by_home;
ALTER TABLE matches DROP COLUMN IF EXISTS fargo_start_points_confirmed_by_away;
