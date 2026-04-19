-- ============================================================================
-- REVISE FARGO + ACHIEVEMENTS SCHEMA
-- ============================================================================
--
-- Corrects over-builds from migrations 20260418000001 (Fargo match columns).
-- After discussing with the operator we simplified the schema:
--
-- Dropped (redundant — derivable from other fields or dials):
--   matches.fargo_start_points      — will reuse home_games_to_win/away_games_to_win
--                                     (the weaker team's column holds the handicap)
--   match_games.winner_points       — always the league's winner_points dial, static per
--                                     league. Derive at read time from system_overrides.
--   match_games.loser_points        — derive from loser_balls_pocketed + league's
--                                     loser_points_method dial at read time.
--
-- Added (genuinely new per-game data, always tracked):
--   match_games.break_fouled        — breaker fouled on the break; game re-racked with
--                                     opponent breaking. Derivation rule for "actual
--                                     breaker": scheduled breaker XOR break_fouled.
--   match_games.runout              — non-breaker wins after opponent's dry or fouled
--                                     break.
--   match_games.win_by_forfeit      — winner wins because opponent forfeited.
--
-- Kept from 20260418000001:
--   match_games.loser_balls_pocketed — the one genuinely per-game Fargo input.
--
-- No data loss risk: the three dropped columns have never been populated (they
-- were added in the previous Phase 2 migration and no code writes to them yet —
-- Phase 3 would have been the first writer).
-- ============================================================================

-- === Drop the three over-built columns ===

ALTER TABLE matches
  DROP COLUMN IF EXISTS fargo_start_points;

ALTER TABLE match_games
  DROP COLUMN IF EXISTS winner_points;

ALTER TABLE match_games
  DROP COLUMN IF EXISTS loser_points;

-- === Add the three new per-game achievement/state columns ===

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS break_fouled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN match_games.break_fouled IS
  'True when the scheduled breaker fouled on their break, triggering a re-rack with the opponent breaking. The actual breaker of the game-of-record is the scheduled racker when this is true, the scheduled breaker when false.';

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS runout BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN match_games.runout IS
  'True when the winner ran the table after opponent broke dry or fouled on break. Only claimable when the winner is the non-breaker (derived from scheduled roles + break_fouled).';

ALTER TABLE match_games
  ADD COLUMN IF NOT EXISTS win_by_forfeit BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN match_games.win_by_forfeit IS
  'True when the winner was awarded the game because the opponent forfeited.';
