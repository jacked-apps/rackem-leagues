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

-- points_calculator: which points-calculation formula to use
-- (Renamed from scoring_method per the modular-league v2 architectural
-- reframe — supplement Section 1. The old name conflated "scoring" with
-- the points axis specifically; the new name is honest about what this
-- column drives. The value space also shifts: old strings like
-- 'winner_takes_all' are no longer valid — replaced by the calculator
-- registry's named formulas.)
--
-- Value space (matches src/systems/calculators/* names):
--   'linear_above_threshold'              — three-band formula (BCA Classic 3v3 default)
--   'accumulate_with_milestone_jumps'     — monotonic with stepped jumps (BCA Classic 5v5 default)
--   'accumulated_per_game'                — per-game accumulation (Fargo 10-7 default)
--   NULL                                  — don't track points at all (pure-games-won league)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS points_calculator TEXT
  DEFAULT 'linear_above_threshold'
  CHECK (points_calculator IS NULL OR points_calculator IN (
    'linear_above_threshold',
    'accumulate_with_milestone_jumps',
    'accumulated_per_game'
  ));

COMMENT ON COLUMN preferences.points_calculator IS
  'Points-calculation formula name. References a calculator registered in src/systems/calculators/. Each calculator declares its math, editable parameters (stored in points_calculator_params), and per-game scoring-popup field spec. NULL means do not track points at all (pure-games-won league); standings cannot include points_earned and win_condition must be ''games''. New calculator types add themselves to the registry; the CHECK constraint is updated when new types ship. Driven by R5 (corrected) of the modular-league v2 plan.';

-- points_calculator_params: editable values for the calculator
-- (NEW — supplement Section 2. Type+params pattern: the calculator code
-- is parameter-blind; the params blob holds the LO-editable values like
-- multiplier, milestone percent, winner-points, counter min/max, etc.
-- Validated at save time by zod against the calculator's paramSchema;
-- validated again at runtime as defense-in-depth.)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS points_calculator_params JSONB
  NOT NULL
  DEFAULT '{}'::jsonb;

COMMENT ON COLUMN preferences.points_calculator_params IS
  'Editable parameters for the league''s points calculator. Shape varies by points_calculator type — each calculator owns its own zod schema. Empty object means use the calculator''s defaultParams (Tested Preset values). LO-edited values flow through here; the runtime is parameter-blind. Driven by R5 (corrected).';

-- win_condition: which of the two always-tracked metrics decides the match
-- (Collapsed from 4 values to 2 per the modular-league v2 reframe —
-- supplement Section 1. We always track BOTH games_won and points_earned;
-- this axis chooses which one decides the winner. The "first_to_X vs play
-- all games" distinction lives in threshold values, not as a separate axis.)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS win_condition TEXT
  DEFAULT 'games'
  CHECK (win_condition IS NULL OR win_condition IN ('games', 'points'));

COMMENT ON COLUMN preferences.win_condition IS
  'Which metric decides the match winner. ''games'' = team with more games_won wins. ''points'' = team with more points_earned wins. Match always tracks both metrics; this axis picks which one is decisive. The "first to N" vs "play all games" distinction is encoded in the threshold values (matches.*_to_win set → can end early; NULL → play out). Driven by R6 (corrected).';

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
