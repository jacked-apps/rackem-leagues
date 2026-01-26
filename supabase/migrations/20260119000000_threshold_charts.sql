-- ============================================================================
-- THRESHOLD CHARTS MIGRATION
-- ============================================================================
--
-- Creates tables for storing threshold charts used to determine games-to-win
-- thresholds based on handicap differentials.
--
-- Chart Types:
-- 1. team_points: Team format with point handicaps (e.g., +2 vs -1 = 7 to win, 5 to tie, 3 to lose)
-- 2. team_percentage: Team format with percentage handicaps (range lookup)
-- 3. race_points: Individual race with point handicaps (e.g., +2 vs -2 = 6-2 race)
-- 4. race_percentage: Individual race with percentage handicaps (range lookup)
--
-- Lookup Modes:
-- - exact: Direct match on comp_1 (and comp_2 if applicable)
-- - range: VLOOKUP-style lookup where comp_1 is the minimum of a range
--
-- Storage Optimization (Race Charts):
-- Race charts only store rows where comp_1 >= comp_2. The lookup function
-- normalizes input and swaps result_1/result_3 when needed.
--
-- Result Columns:
-- - result_1: Team wins threshold OR Player 1 games to win
-- - result_2: Tie threshold (NULL for race formats)
-- - result_3: Team loss threshold OR Player 2 games to win
--
-- NOTE: This migration drops and recreates tables. For production, remove the
-- DROP statements and use ALTER TABLE for schema changes.
--
-- ============================================================================

-- ============================================================================
-- DROP EXISTING (for clean local development - remove for production)
-- ============================================================================
DROP FUNCTION IF EXISTS lookup_threshold(UUID, NUMERIC, NUMERIC);
DROP TABLE IF EXISTS threshold_chart_rows;
DROP TABLE IF EXISTS threshold_charts;

-- ============================================================================
-- THRESHOLD CHARTS TABLE (Parent)
-- ============================================================================

CREATE TABLE threshold_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- === Entity Ownership ===
    -- Similar to playoff_configurations: global templates, org defaults, league specifics
    entity_type TEXT NOT NULL CHECK (entity_type IN ('global', 'organization', 'league')),

    -- The entity this chart belongs to:
    -- - global: '00000000-0000-0000-0000-000000000000' (nil UUID, system templates)
    -- - organization: the organization's UUID (org-wide charts)
    -- - league: the league's UUID (league-specific charts)
    entity_id UUID NOT NULL,

    -- === Chart Type ===
    -- Determines how the chart is used and displayed
    chart_type TEXT NOT NULL CHECK (chart_type IN (
        'team_points',      -- Team format, point handicaps (exact lookup)
        'team_percentage',  -- Team format, percentage handicaps (range lookup)
        'race_points',      -- Individual race, point handicaps (exact lookup)
        'race_percentage'   -- Individual race, percentage handicaps (range lookup)
    )),

    -- === Lookup Configuration ===
    -- How to find the matching row in threshold_chart_rows
    lookup_mode TEXT NOT NULL DEFAULT 'exact' CHECK (lookup_mode IN ('exact', 'range')),

    -- === Metadata ===
    name TEXT NOT NULL,         -- Display name (e.g., "Rackem League 3v3 Points Chart")
    description TEXT,           -- Optional description for operators browsing charts

    -- Is this the default chart for this entity and chart_type?
    is_default BOOLEAN DEFAULT false,

    -- === Ownership ===
    -- Who created this chart. NULL for system-created global templates.
    -- For global templates created by Rackem League, use nil UUID to indicate system ownership.
    created_by UUID,            -- References auth.users(id), NULL = system/Rackem League

    -- === Timestamps ===
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- === Constraints ===
    -- Ensure global records use the nil UUID
    CONSTRAINT valid_global_entity CHECK (
        (entity_type = 'global' AND entity_id = '00000000-0000-0000-0000-000000000000') OR
        (entity_type != 'global' AND entity_id != '00000000-0000-0000-0000-000000000000')
    ),

    -- Each entity can only have one chart with a given name and type
    CONSTRAINT unique_entity_chart_name UNIQUE (entity_type, entity_id, chart_type, name)
);

-- ============================================================================
-- THRESHOLD CHART ROWS TABLE (Child)
-- ============================================================================

CREATE TABLE IF NOT EXISTS threshold_chart_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- === Parent Reference ===
    chart_id UUID NOT NULL REFERENCES threshold_charts(id) ON DELETE CASCADE,

    -- === Comparison Values ===
    -- comp_1: Primary comparison value (handicap diff, or player 1 handicap)
    -- comp_2: Secondary comparison (for race formats: player 2 handicap)
    -- For team charts: comp_1 is the handicap differential, comp_2 is NULL
    -- For race charts: comp_1 is player 1 handicap, comp_2 is player 2 handicap
    comp_1 NUMERIC NOT NULL,
    comp_2 NUMERIC,

    -- === Result Values ===
    -- Flexible columns that mean different things by chart_type:
    -- Team charts: result_1=wins, result_2=tie, result_3=loss
    -- Race charts: result_1=player1_wins, result_2=NULL, result_3=player2_wins
    result_1 INTEGER NOT NULL,
    result_2 INTEGER,           -- NULL for race formats (no ties in races)
    result_3 INTEGER NOT NULL,

    -- === Ordering ===
    -- For display and range lookup (lower sort_order = checked first for ranges)
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- === Timestamps ===
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- === Constraints ===
    -- For race charts, ensure comp_1 >= comp_2 (upper triangle optimization)
    -- This is enforced at the application layer, not DB, to allow flexibility

    -- Ensure unique row per chart (no duplicate comparison values)
    CONSTRAINT unique_chart_row UNIQUE (chart_id, comp_1, comp_2)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookup by entity for threshold_charts
CREATE INDEX IF NOT EXISTS idx_threshold_charts_entity
    ON threshold_charts(entity_type, entity_id);

-- Find charts by type
CREATE INDEX IF NOT EXISTS idx_threshold_charts_type
    ON threshold_charts(chart_type);

-- Find global templates quickly
CREATE INDEX IF NOT EXISTS idx_threshold_charts_global
    ON threshold_charts(entity_type)
    WHERE entity_type = 'global';

-- Find default chart for an entity and type
CREATE INDEX IF NOT EXISTS idx_threshold_charts_default
    ON threshold_charts(entity_type, entity_id, chart_type)
    WHERE is_default = true;

-- Fast row lookup by chart
CREATE INDEX IF NOT EXISTS idx_threshold_chart_rows_chart
    ON threshold_chart_rows(chart_id);

-- Fast lookup by comparison values (for exact match)
CREATE INDEX IF NOT EXISTS idx_threshold_chart_rows_lookup
    ON threshold_chart_rows(chart_id, comp_1, comp_2);

-- Sorted retrieval for range lookups
CREATE INDEX IF NOT EXISTS idx_threshold_chart_rows_sorted
    ON threshold_chart_rows(chart_id, sort_order);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps for threshold_charts
CREATE OR REPLACE FUNCTION update_threshold_charts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_threshold_charts_updated_at ON threshold_charts;
CREATE TRIGGER trigger_update_threshold_charts_updated_at
    BEFORE UPDATE ON threshold_charts
    FOR EACH ROW
    EXECUTE FUNCTION update_threshold_charts_updated_at();

-- Ensure only one default per entity and chart_type
CREATE OR REPLACE FUNCTION ensure_single_default_threshold_chart()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE threshold_charts
        SET is_default = false
        WHERE entity_type = NEW.entity_type
          AND entity_id = NEW.entity_id
          AND chart_type = NEW.chart_type
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_default_threshold_chart ON threshold_charts;
CREATE TRIGGER trigger_ensure_single_default_threshold_chart
    BEFORE INSERT OR UPDATE ON threshold_charts
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_threshold_chart();

-- ----------------------------------------------------------------------------
-- PROTECT GLOBAL CHARTS FROM MODIFICATION
-- ----------------------------------------------------------------------------
-- Global charts are system templates (Rackem League standards). They should
-- never be modified or deleted - operators must copy them to create custom versions.
-- These triggers enforce this at the database level.

-- Protect threshold_charts table
CREATE OR REPLACE FUNCTION prevent_global_chart_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.entity_type = 'global' THEN
        RAISE EXCEPTION 'Cannot modify global threshold charts - these are system templates. Copy to your league to customize.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_global_charts_update ON threshold_charts;
CREATE TRIGGER protect_global_charts_update
    BEFORE UPDATE ON threshold_charts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_global_chart_modification();

DROP TRIGGER IF EXISTS protect_global_charts_delete ON threshold_charts;
CREATE TRIGGER protect_global_charts_delete
    BEFORE DELETE ON threshold_charts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_global_chart_modification();

-- Protect threshold_chart_rows table (check parent chart's entity_type)
CREATE OR REPLACE FUNCTION prevent_global_chart_row_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_entity_type TEXT;
BEGIN
    SELECT entity_type INTO v_entity_type
    FROM threshold_charts
    WHERE id = OLD.chart_id;

    IF v_entity_type = 'global' THEN
        RAISE EXCEPTION 'Cannot modify rows of global threshold charts - these are system templates. Copy to your league to customize.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_global_chart_rows_update ON threshold_chart_rows;
CREATE TRIGGER protect_global_chart_rows_update
    BEFORE UPDATE ON threshold_chart_rows
    FOR EACH ROW
    EXECUTE FUNCTION prevent_global_chart_row_modification();

DROP TRIGGER IF EXISTS protect_global_chart_rows_delete ON threshold_chart_rows;
CREATE TRIGGER protect_global_chart_rows_delete
    BEFORE DELETE ON threshold_chart_rows
    FOR EACH ROW
    EXECUTE FUNCTION prevent_global_chart_row_modification();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- RLS policies intentionally permissive for development speed.
-- TODO: Add proper policies before production deployment.

ALTER TABLE threshold_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE threshold_chart_rows ENABLE ROW LEVEL SECURITY;

-- Allow all operations during development
DROP POLICY IF EXISTS "Dev: Allow all operations on threshold_charts" ON threshold_charts;
CREATE POLICY "Dev: Allow all operations on threshold_charts"
    ON threshold_charts
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev: Allow all operations on threshold_chart_rows" ON threshold_chart_rows;
CREATE POLICY "Dev: Allow all operations on threshold_chart_rows"
    ON threshold_chart_rows
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE threshold_charts IS
    'Stores threshold chart configurations for determining games-to-win thresholds. Charts can be global templates, organization defaults, or league-specific.';

COMMENT ON COLUMN threshold_charts.entity_type IS
    'Level of this chart: global (system template), organization (org default), or league (override)';

COMMENT ON COLUMN threshold_charts.entity_id IS
    'UUID of the entity. For global: nil UUID. For org/league: their respective UUIDs.';

COMMENT ON COLUMN threshold_charts.chart_type IS
    'Type of chart: team_points, team_percentage, race_points, or race_percentage';

COMMENT ON COLUMN threshold_charts.lookup_mode IS
    'How to find matching rows: exact (direct match) or range (VLOOKUP-style minimum)';

COMMENT ON COLUMN threshold_charts.name IS
    'Display name for this chart. Used in chart picker menus.';

COMMENT ON COLUMN threshold_charts.description IS
    'Optional description explaining this chart. Helpful for operators browsing available charts.';

COMMENT ON COLUMN threshold_charts.created_by IS
    'UUID of the user who created this chart. NULL for system-created global templates (Rackem League standard charts).';

COMMENT ON TABLE threshold_chart_rows IS
    'Individual rows in a threshold chart. Each row maps comparison values to result thresholds.';

COMMENT ON COLUMN threshold_chart_rows.comp_1 IS
    'Primary comparison value. For team charts: handicap differential. For race charts: player 1 handicap.';

COMMENT ON COLUMN threshold_chart_rows.comp_2 IS
    'Secondary comparison value. For team charts: NULL. For race charts: player 2 handicap.';

COMMENT ON COLUMN threshold_chart_rows.result_1 IS
    'First result value. For team charts: games to win. For race charts: player 1 games to win.';

COMMENT ON COLUMN threshold_chart_rows.result_2 IS
    'Second result value. For team charts: games to tie. For race charts: NULL (no ties).';

COMMENT ON COLUMN threshold_chart_rows.result_3 IS
    'Third result value. For team charts: games to lose. For race charts: player 2 games to win.';

COMMENT ON COLUMN threshold_chart_rows.sort_order IS
    'Display order and range lookup priority. Lower values checked first for range lookups.';

-- ============================================================================
-- LOOKUP FUNCTION FOR THRESHOLD CHARTS
-- ============================================================================
-- This function handles all the lookup logic including:
-- 1. Exact vs range matching
-- 2. Race chart normalization (swap when comp_1 < comp_2)
-- 3. Returns all result columns

CREATE OR REPLACE FUNCTION lookup_threshold(
    p_chart_id UUID,
    p_comp_1 NUMERIC,
    p_comp_2 NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    result_1 INTEGER,
    result_2 INTEGER,
    result_3 INTEGER,
    was_swapped BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_chart_type TEXT;
    v_lookup_mode TEXT;
    v_actual_comp_1 NUMERIC;
    v_actual_comp_2 NUMERIC;
    v_swapped BOOLEAN := false;
BEGIN
    -- Get chart metadata
    SELECT tc.chart_type, tc.lookup_mode
    INTO v_chart_type, v_lookup_mode
    FROM threshold_charts tc
    WHERE tc.id = p_chart_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chart not found: %', p_chart_id;
    END IF;

    -- For race charts, normalize so comp_1 >= comp_2
    IF v_chart_type IN ('race_points', 'race_percentage') AND p_comp_2 IS NOT NULL THEN
        IF p_comp_1 < p_comp_2 THEN
            -- Swap the comparison values
            v_actual_comp_1 := p_comp_2;
            v_actual_comp_2 := p_comp_1;
            v_swapped := true;
        ELSE
            v_actual_comp_1 := p_comp_1;
            v_actual_comp_2 := p_comp_2;
        END IF;
    ELSE
        v_actual_comp_1 := p_comp_1;
        v_actual_comp_2 := p_comp_2;
    END IF;

    -- Perform lookup based on mode
    IF v_lookup_mode = 'exact' THEN
        -- Exact match lookup
        IF v_swapped THEN
            -- Return swapped results (result_1 and result_3 swapped)
            RETURN QUERY
            SELECT tcr.result_3, tcr.result_2, tcr.result_1, true
            FROM threshold_chart_rows tcr
            WHERE tcr.chart_id = p_chart_id
              AND tcr.comp_1 = v_actual_comp_1
              AND (tcr.comp_2 = v_actual_comp_2 OR (tcr.comp_2 IS NULL AND v_actual_comp_2 IS NULL));
        ELSE
            RETURN QUERY
            SELECT tcr.result_1, tcr.result_2, tcr.result_3, false
            FROM threshold_chart_rows tcr
            WHERE tcr.chart_id = p_chart_id
              AND tcr.comp_1 = v_actual_comp_1
              AND (tcr.comp_2 = v_actual_comp_2 OR (tcr.comp_2 IS NULL AND v_actual_comp_2 IS NULL));
        END IF;
    ELSE
        -- Range lookup (VLOOKUP-style: find highest comp_1 <= input)
        IF v_swapped THEN
            RETURN QUERY
            SELECT tcr.result_3, tcr.result_2, tcr.result_1, true
            FROM threshold_chart_rows tcr
            WHERE tcr.chart_id = p_chart_id
              AND tcr.comp_1 <= v_actual_comp_1
              AND (v_actual_comp_2 IS NULL OR tcr.comp_2 IS NULL OR tcr.comp_2 <= v_actual_comp_2)
            ORDER BY tcr.comp_1 DESC, tcr.comp_2 DESC NULLS LAST
            LIMIT 1;
        ELSE
            RETURN QUERY
            SELECT tcr.result_1, tcr.result_2, tcr.result_3, false
            FROM threshold_chart_rows tcr
            WHERE tcr.chart_id = p_chart_id
              AND tcr.comp_1 <= v_actual_comp_1
              AND (v_actual_comp_2 IS NULL OR tcr.comp_2 IS NULL OR tcr.comp_2 <= v_actual_comp_2)
            ORDER BY tcr.comp_1 DESC, tcr.comp_2 DESC NULLS LAST
            LIMIT 1;
        END IF;
    END IF;
END;
$$;

COMMENT ON FUNCTION lookup_threshold IS
    'Looks up threshold values from a chart. Handles exact/range modes and race chart normalization (swaps results when comp_1 < comp_2 for race charts).';
