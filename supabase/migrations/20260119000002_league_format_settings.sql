-- ============================================================================
-- LEAGUE FORMAT SETTINGS MIGRATION
-- ============================================================================
--
-- Creates a table to store per-league format configuration and settings.
-- This table links leagues to their threshold charts and stores game format options.
--
-- Design Rationale:
-- - Charts can be shared across multiple leagues (many-to-one relationship)
-- - Each league has ONE format settings record (one-to-one with leagues)
-- - Settings are stored here rather than on the leagues table because:
--   1. Keeps leagues table focused on identity/static info
--   2. Groups related configuration together
--   3. Easier to extend with new settings without modifying leagues table
--   4. Matches the pattern from PLAN-league-format-configs.md
--
-- NOTE: This migration drops and recreates tables for local development.
-- For production, remove DROP statements and use ALTER TABLE.
--
-- ============================================================================

-- ============================================================================
-- DROP EXISTING (for clean local development - remove for production)
-- ============================================================================
DROP TABLE IF EXISTS league_format_settings;

-- ============================================================================
-- LEAGUE FORMAT SETTINGS TABLE
-- ============================================================================

CREATE TABLE league_format_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- === League Reference ===
    -- Each league has exactly one format settings record
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,

    -- === Team/Lineup Structure ===
    -- How many players per team in match lineups (3, 4, 5, etc.)
    lineup_size INTEGER NOT NULL DEFAULT 3 CHECK (lineup_size BETWEEN 1 AND 10),

    -- Maximum players allowed on a team roster
    max_roster_size INTEGER NOT NULL DEFAULT 8 CHECK (max_roster_size BETWEEN 1 AND 20),

    -- === Handicap Configuration ===
    -- Type of handicap system used
    -- 'points': Discrete point values (e.g., -2, -1, 0, +1, +2)
    -- 'percentage': Percentage values (e.g., 45%, 50%, 55%)
    -- 'skill_level': APA-style skill levels (1-9)
    -- 'none': No handicaps
    handicap_type TEXT NOT NULL DEFAULT 'points' CHECK (handicap_type IN (
        'points',
        'percentage',
        'skill_level',
        'none'
    )),

    -- === Threshold Chart Reference ===
    -- Charts can be shared across leagues (FK to threshold_charts)
    -- NULL means use the global default chart for this handicap type
    -- The chart's own chart_type column determines if it's team or race based
    threshold_chart_id UUID REFERENCES threshold_charts(id) ON DELETE SET NULL,

    -- === Game Generation ===
    -- How matches generate their individual games
    -- 'double_round_robin': Each player plays each opponent twice (3v3 = 18 games)
    -- 'single_round_robin': Each player plays each opponent once (5v5 = 25 games)
    -- 'sets': Players play in sets (position vs position)
    -- 'manual': No auto-generation, operator creates games manually
    game_generation TEXT NOT NULL DEFAULT 'double_round_robin' CHECK (game_generation IN (
        'double_round_robin',
        'single_round_robin',
        'sets',
        'manual'
    )),

    -- Estimated/minimum games per match
    -- This is a baseline estimate, actual games may vary:
    -- - Team matches with ties may have tiebreaker games
    -- - Race formats vary based on how quickly players reach win threshold
    -- For double_round_robin: lineup_size² × 2 (e.g., 3×3×2 = 18)
    -- For single_round_robin: lineup_size² (e.g., 5×5 = 25)
    estimated_games INTEGER NOT NULL DEFAULT 18 CHECK (estimated_games BETWEEN 1 AND 100),

    -- Games per set (only used when game_generation = 'sets')
    games_per_set INTEGER CHECK (games_per_set BETWEEN 1 AND 20),

    -- === Points/Scoring System ===
    -- How team points are calculated from match results
    -- 'differential': Points based on games won vs threshold
    -- 'bca_tiered': BCA percentage-based tiered points
    -- 'per_game': Fixed points per game won
    -- 'manual': Operator enters points directly
    points_system TEXT NOT NULL DEFAULT 'differential' CHECK (points_system IN (
        'differential',
        'bca_tiered',
        'per_game',
        'manual'
    )),

    -- === Game Rules ===
    -- Whether breaking and sinking the game ball (8/9/10) counts as a win
    golden_break_enabled BOOLEAN NOT NULL DEFAULT true,

    -- === Timestamps ===
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- === Constraints ===
    -- One settings record per league
    CONSTRAINT unique_league_settings UNIQUE (league_id),

    -- Validate games_per_set is set when using sets mode
    CONSTRAINT valid_games_per_set CHECK (
        (game_generation != 'sets') OR (games_per_set IS NOT NULL)
    ),

    -- Validate estimated_games is reasonable for lineup
    -- (not enforced strictly to allow custom formats)
    CONSTRAINT reasonable_estimated_games CHECK (
        estimated_games >= lineup_size
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by league
CREATE INDEX IF NOT EXISTS idx_league_format_settings_league
    ON league_format_settings(league_id);

-- Find leagues using a specific chart
CREATE INDEX IF NOT EXISTS idx_league_format_settings_chart
    ON league_format_settings(threshold_chart_id)
    WHERE threshold_chart_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_league_format_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_league_format_settings_updated_at ON league_format_settings;
CREATE TRIGGER trigger_update_league_format_settings_updated_at
    BEFORE UPDATE ON league_format_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_league_format_settings_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- RLS policies intentionally permissive for development speed.
-- TODO: Add proper policies before production deployment.

ALTER TABLE league_format_settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations during development
DROP POLICY IF EXISTS "Dev: Allow all operations on league_format_settings" ON league_format_settings;
CREATE POLICY "Dev: Allow all operations on league_format_settings"
    ON league_format_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE league_format_settings IS
    'Stores per-league format configuration including lineup size, handicap type, threshold chart references, and game generation settings.';

COMMENT ON COLUMN league_format_settings.league_id IS
    'The league this settings record belongs to. One-to-one relationship.';

COMMENT ON COLUMN league_format_settings.lineup_size IS
    'Number of players per team in match lineups (e.g., 3 for 3v3, 5 for 5v5).';

COMMENT ON COLUMN league_format_settings.max_roster_size IS
    'Maximum players allowed on a team roster.';

COMMENT ON COLUMN league_format_settings.handicap_type IS
    'Type of handicap system: points, percentage, skill_level, or none.';

COMMENT ON COLUMN league_format_settings.threshold_chart_id IS
    'FK to threshold_charts. NULL uses the global default chart for the handicap_type. Chart type (team/race) is determined by the chart itself.';

COMMENT ON COLUMN league_format_settings.game_generation IS
    'How match games are generated: double_round_robin, single_round_robin, sets, or manual.';

COMMENT ON COLUMN league_format_settings.estimated_games IS
    'Estimated/minimum games per match. Actual games may vary (ties add tiebreakers, races vary by outcome).';

COMMENT ON COLUMN league_format_settings.games_per_set IS
    'Games per set when using sets game_generation mode.';

COMMENT ON COLUMN league_format_settings.points_system IS
    'How team points are calculated: differential, bca_tiered, per_game, or manual.';

COMMENT ON COLUMN league_format_settings.golden_break_enabled IS
    'Whether breaking and sinking the game ball counts as a win.';

-- ============================================================================
-- HELPER FUNCTION: Get or Create Settings for a League
-- ============================================================================
-- Returns the settings for a league, creating default settings if none exist.

CREATE OR REPLACE FUNCTION get_or_create_league_format_settings(p_league_id UUID)
RETURNS league_format_settings
LANGUAGE plpgsql
AS $$
DECLARE
    v_settings league_format_settings;
    v_team_format TEXT;
BEGIN
    -- Try to get existing settings
    SELECT * INTO v_settings
    FROM league_format_settings
    WHERE league_id = p_league_id;

    IF FOUND THEN
        RETURN v_settings;
    END IF;

    -- Get the league's team_format to determine defaults
    SELECT team_format INTO v_team_format
    FROM leagues
    WHERE id = p_league_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'League not found: %', p_league_id;
    END IF;

    -- Create default settings based on team_format
    IF v_team_format = '5_man' THEN
        -- 3v3 Points format (despite the confusing column name)
        INSERT INTO league_format_settings (
            league_id,
            lineup_size,
            max_roster_size,
            handicap_type,
            game_generation,
            estimated_games,
            points_system
        ) VALUES (
            p_league_id,
            3,      -- 3 players per lineup
            8,      -- 8 max roster
            'points',
            'double_round_robin',
            18,     -- 3×3×2 = 18 games (estimate)
            'differential'
        )
        RETURNING * INTO v_settings;
    ELSE
        -- 5v5 Percentage format (8_man = BCA style)
        INSERT INTO league_format_settings (
            league_id,
            lineup_size,
            max_roster_size,
            handicap_type,
            game_generation,
            estimated_games,
            points_system
        ) VALUES (
            p_league_id,
            5,      -- 5 players per lineup
            10,     -- 10 max roster
            'percentage',
            'single_round_robin',
            25,     -- 5×5 = 25 games (estimate)
            'bca_tiered'
        )
        RETURNING * INTO v_settings;
    END IF;

    RETURN v_settings;
END;
$$;

COMMENT ON FUNCTION get_or_create_league_format_settings IS
    'Returns the format settings for a league, creating default settings based on team_format if none exist.';
