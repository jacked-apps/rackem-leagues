-- ============================================================================
-- EXTEND PREFERENCES TABLE — MODULAR LEAGUE CONFIGURATION
-- ============================================================================
--
-- Adds new columns to the existing preferences table to support the modular
-- league configuration system (Wizard 2.0). These columns follow the same
-- cascade pattern as existing preferences: league → org → system default.
-- NULL means "inherit from the next level up."
--
-- The existing columns (handicap_variant, team_format, etc.) stay unchanged
-- for backward compatibility. Old code reads those. New code reads these.
-- The wizard dual-writes to both.
--
-- See: memory-bank/plans/PLAN-wizard2.md
--
-- NOTE: For local development. Production deployments may need ALTER TABLE
-- instead of this approach.
-- ============================================================================

-- === New modular columns ===

-- Lineup size: how many players play per match night (3-6 typically)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS lineup_size INTEGER
  CHECK (lineup_size IS NULL OR (lineup_size >= 1 AND lineup_size <= 10));

COMMENT ON COLUMN preferences.lineup_size IS
  'Number of players per team in match lineups. NULL = use next level default.';

-- Max roster size: maximum players allowed on a team
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS max_roster_size INTEGER
  CHECK (max_roster_size IS NULL OR (max_roster_size >= 1 AND max_roster_size <= 20));

COMMENT ON COLUMN preferences.max_roster_size IS
  'Maximum players on a team roster. Must be >= lineup_size. NULL = use next level default.';

-- Game generation: how individual games are created within a match
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS game_generation TEXT
  CHECK (game_generation IS NULL OR game_generation IN (
    'double_round_robin',
    'single_round_robin',
    'sets',
    'manual'
  ));

COMMENT ON COLUMN preferences.game_generation IS
  'How match games are generated: double/single round robin, sets, or manual. NULL = use next level default.';

-- Handicap type: which handicap calculation system to use
-- This is DIFFERENT from the existing handicap_variant column:
--   handicap_type = WHICH system (points, percentage, fargo)
--   handicap_variant = a modifier WITHIN a system (standard, reduced)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS handicap_type TEXT
  CHECK (handicap_type IS NULL OR handicap_type IN (
    'points',
    'percentage',
    'fargo',
    'skill_level',
    'none'
  ));

COMMENT ON COLUMN preferences.handicap_type IS
  'Which handicap system: points (-2/+2), percentage, fargo, skill_level, or none. NULL = use next level default. Different from handicap_variant which is a modifier within a system.';

-- Points system: how team points are calculated from match results
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS points_system TEXT
  CHECK (points_system IS NULL OR points_system IN (
    'differential',
    'bca_tiered',
    'per_game',
    'manual'
  ));

COMMENT ON COLUMN preferences.points_system IS
  'How team points are scored: differential, bca_tiered, per_game, or manual. NULL = use next level default.';

-- Threshold chart reference: links to the threshold chart for win calculations
-- FK added after threshold_charts table exists (see threshold charts migration)
ALTER TABLE preferences
  ADD COLUMN IF NOT EXISTS threshold_chart_id UUID;

COMMENT ON COLUMN preferences.threshold_chart_id IS
  'FK to threshold_charts table. Determines win/loss thresholds. NULL = use global default chart for the handicap_type.';

-- === Loosen existing team_format constraint ===
-- The old constraint only allowed '5_man' and '8_man'. We need to allow
-- new formats or remove the constraint entirely since max_roster_size
-- is now the canonical field for this concept.

-- Drop the old constraint if it exists (constraint name may vary)
DO $$
BEGIN
  ALTER TABLE preferences DROP CONSTRAINT IF EXISTS preferences_team_format_check;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Constraint doesn't exist or has a different name, that's fine
END $$;

-- Add a more permissive constraint (or none — the wizard validates this)
-- Keeping it loose: any non-empty string is valid
ALTER TABLE preferences
  DROP CONSTRAINT IF EXISTS preferences_team_format_check;
