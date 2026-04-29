-- ============================================================================
-- PHASE 2 UNIT 2.1 — EXTEND preferences WITH NEW MODULAR AXES
-- ============================================================================
--
-- Adds the remaining modular preference columns per the modular-league plan
-- (docs/plans/2026-04-28-001-feat-modular-league-system-plan.md, R4 / R5 /
-- R6 / R8 / R10 / R11). The previous round of modular columns (handicap_type,
-- lineup_size, max_roster_size, game_generation, points_system,
-- threshold_chart_id) was added in 20260410000000_extend_preferences_modular
-- and is unchanged. THIS migration adds 8 new columns that fill out the
-- 13-axis modular surface:
--
--   pairing_format       — single_rack | race_to_n              (R4)
--   scoring_method       — winner_takes_all | points_10_7 | race_winner  (R5)
--   win_condition        — first_to_games | first_to_pairings |
--                          highest_after_all_games | total_points_target  (R6)
--   mechanism            — extra_games | start_points |
--                          race_length_adjustment | none         (R8)
--   standings_sort       — text[] priority list                  (R10)
--   tiebreaker_trigger   — even_total_games_only | never         (R11)
--   tiebreaker_format    — best_of_3_short_race |
--                          single_short_race | accept_tie        (R11)
--   race_length          — INTEGER nullable
--                          (NULL except for race_to_n combos)    (R4)
--
-- Plus a soft cap CHECK on max_roster_size (≤30) to prevent absurd values
-- from breaking UI rendering. The cap is high enough that no realistic
-- league hits it.
--
-- handicap_type already accepts 'skill_level' (added in
-- 20260410000000_extend_preferences_modular.sql) — BCAPL SL support
-- needs no further alteration to the existing CHECK constraint.
--
-- DEFAULTS (applied to existing rows on ALTER TABLE ADD COLUMN, then to
-- new rows via the column DEFAULT clause):
--   - pairing_format       = 'single_rack'
--   - scoring_method       = 'winner_takes_all'
--   - win_condition        = 'first_to_games'
--   - mechanism            = 'extra_games'
--   - standings_sort       = '{match_wins,games_won,points_earned}'
--   - tiebreaker_trigger   = 'never'
--   - tiebreaker_format    = 'accept_tie'
--   - race_length          = NULL (only set when pairing_format='race_to_n')
--
-- These match what the three existing presets (bca3v3, bca5v5, fargo5v5)
-- effectively do today: single rack per pairing, win-by-game-count, extra-
-- games handicap, wins-first standings, no tiebreaker by default. The
-- bca3v3 preset will override tiebreaker fields via system_overrides or
-- the wizard for its 18-game DRR (which can tie at 9-9).
-- ============================================================================

-- pairing_format: single_rack (one rack per pairing) | race_to_n (race per pairing)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS pairing_format TEXT
  DEFAULT 'single_rack'
  CHECK (pairing_format IS NULL OR pairing_format IN ('single_rack', 'race_to_n'));

COMMENT ON COLUMN preferences.pairing_format IS
  'Per-pairing format. single_rack = one rack per opponent matchup (BCA / Fargo 10-7). race_to_n = each pairing plays a race-to-N match (BCAPL SL). Driven by R4 of modular-league plan.';

-- scoring_method: per-game scoring unit
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS scoring_method TEXT
  DEFAULT 'winner_takes_all'
  CHECK (scoring_method IS NULL OR scoring_method IN (
    'winner_takes_all',
    'points_10_7',
    'race_winner'
  ));

COMMENT ON COLUMN preferences.scoring_method IS
  'Per-game scoring method. winner_takes_all = 1 game-win to winner. points_10_7 = winner gets winner_points (default 10), loser gets balls_pocketed (0-7). race_winner = winner of the race wins one pairing (relevant only when pairing_format=race_to_n). Driven by R5.';

-- win_condition: when does the match end / who is declared winner
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS win_condition TEXT
  DEFAULT 'first_to_games'
  CHECK (win_condition IS NULL OR win_condition IN (
    'first_to_games',
    'first_to_pairings',
    'highest_after_all_games',
    'total_points_target'
  ));

COMMENT ON COLUMN preferences.win_condition IS
  'Match-level win condition. first_to_games = first team to X games (X derived from threshold). first_to_pairings = first team to X pairing-wins (race format). highest_after_all_games = play all games, highest total wins. total_points_target = first team to reach a points target. Must be coherent with scoring_method per R14-R16.';

-- mechanism: shape of the threshold output
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS mechanism TEXT
  DEFAULT 'extra_games'
  CHECK (mechanism IS NULL OR mechanism IN (
    'extra_games',
    'start_points',
    'race_length_adjustment',
    'none'
  ));

COMMENT ON COLUMN preferences.mechanism IS
  'Handicap mechanism. extra_games = higher-rated team must win extra games beyond the median. start_points = lower-rated team starts with bonus points. race_length_adjustment = per-pairing race length differs by rating diff (BCAPL SL). none = no handicap applied. Driven by R8. Discriminates the SystemModule.threshold output union (Phase 1 Unit 1.3).';

-- standings_sort: priority list of sort keys
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS standings_sort TEXT[]
  DEFAULT ARRAY['match_wins', 'games_won', 'points_earned']::TEXT[];

-- Constrain values: every element must be one of the recognized keys.
-- Postgres arrays don't have a built-in element-wise CHECK, so we use a
-- predicate that the array is a subset of the allowed values.
ALTER TABLE preferences
  ADD CONSTRAINT preferences_standings_sort_values_check
  CHECK (
    standings_sort IS NULL
    OR standings_sort <@ ARRAY['match_wins', 'games_won', 'points_earned']::TEXT[]
  );

COMMENT ON COLUMN preferences.standings_sort IS
  'Priority list of standings sort keys. Each element is match_wins | games_won | points_earned. Default [match_wins, games_won, points_earned] matches existing wins-first behavior. Refactored to a shared helper in Phase 5 Unit 5.3. Driven by R10.';

-- tiebreaker_trigger: when does the tiebreaker fire
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS tiebreaker_trigger TEXT
  DEFAULT 'never'
  CHECK (tiebreaker_trigger IS NULL OR tiebreaker_trigger IN (
    'even_total_games_only',
    'never'
  ));

COMMENT ON COLUMN preferences.tiebreaker_trigger IS
  'When tiebreaker games fire. even_total_games_only = trigger when total games is even AND match ends tied (e.g. BCA 3v3 18-game DRR can tie 9-9). never = matches that end tied stay as ties. Driven by R11.';

-- tiebreaker_format: what shape the tiebreaker takes
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS tiebreaker_format TEXT
  DEFAULT 'accept_tie'
  CHECK (tiebreaker_format IS NULL OR tiebreaker_format IN (
    'best_of_3_short_race',
    'single_short_race',
    'accept_tie'
  ));

COMMENT ON COLUMN preferences.tiebreaker_format IS
  'Tiebreaker format when triggered. best_of_3_short_race = current 3v3 behavior (games 19-21). single_short_race = one extra rack. accept_tie = treat as final tie, no extra play. Driven by R11.';

-- race_length: race-to-N target (only relevant when pairing_format='race_to_n')
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS race_length INTEGER
  CHECK (race_length IS NULL OR race_length >= 1);

COMMENT ON COLUMN preferences.race_length IS
  'Per-pairing race target N for pairing_format=race_to_n. NULL when pairing_format=single_rack (the default). For BCAPL SL, this is dynamic per matchup (set by the SL chart) — race_length here would be a per-league override or default. Driven by R4.';

-- max_roster_size cap: an existing constraint from 20260410000000_extend_preferences_modular
-- (preferences_max_roster_size_check) already limits this to 1..20. The plan
-- proposed 30; the shipped cap is 20. Either works as a soft cap. Keeping
-- the existing constraint as-is to avoid a drop/recreate round-trip.
