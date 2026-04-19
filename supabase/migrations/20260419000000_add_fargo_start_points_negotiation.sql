-- ============================================================================
-- FARGO START-POINTS NEGOTIATION COLUMNS
-- ============================================================================
--
-- Unit 11c: captains must agree on the Fargo start-points number before the
-- match scoring page opens. This app runs parallel to BCA's official
-- FargoRate app, and when the two produce slightly different numbers the
-- captains defer to whichever they agree is correct.
--
-- Flow:
--   1. Both lineups locked + handicap_type=fargo → home-side client writes
--      the computed default to `fargo_start_points` and stamps its own
--      confirm (`fargo_start_points_confirmed_by_home`).
--   2. Away captain sees the proposed value on the lineup page and either
--      confirms (stamps `fargo_start_points_confirmed_by_away`) or edits.
--   3. Editing clears BOTH confirms and stamps only the editor's side.
--   4. When both confirm columns are non-null, match preparation runs
--      (games created, `fargo_start_points` copied to the weaker team's
--      `home_games_to_win` / `away_games_to_win`).
--
-- Tier 2 mutability (match-scoped): values on `matches`, cleared at match
-- completion or rollover. No snapshot needed — this is pre-match state.
-- ============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fargo_start_points INTEGER;

COMMENT ON COLUMN matches.fargo_start_points IS
  'Fargo: current proposed or agreed start-points value for the weaker team. Copied to home_games_to_win or away_games_to_win once both captains confirm. NULL for non-Fargo matches or Fargo matches where the first proposal has not yet been written.';

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fargo_start_points_confirmed_by_home UUID
    REFERENCES members(id);

COMMENT ON COLUMN matches.fargo_start_points_confirmed_by_home IS
  'Fargo: member_id of the home-team captain who confirmed (or proposed) the current fargo_start_points value. Cleared whenever the value is edited. When non-null alongside fargo_start_points_confirmed_by_away, the number is locked in and match preparation proceeds.';

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS fargo_start_points_confirmed_by_away UUID
    REFERENCES members(id);

COMMENT ON COLUMN matches.fargo_start_points_confirmed_by_away IS
  'Fargo: member_id of the away-team captain who confirmed (or proposed) the current fargo_start_points value. Cleared whenever the value is edited. When non-null alongside fargo_start_points_confirmed_by_home, the number is locked in and match preparation proceeds.';
