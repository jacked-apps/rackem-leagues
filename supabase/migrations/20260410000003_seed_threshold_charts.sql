-- ============================================================================
-- SEED THRESHOLD CHARTS - Global Templates
-- ============================================================================
--
-- Seeds the standard Rackem League threshold charts as global templates:
-- 1. Rackem League 3v3 Points Chart (team_points) - 18 games, exact lookup, range -12 to +12
-- 2. Rackem League 5v5 Percentage Chart (team_percentage) - 25 games, range lookup
-- 3. Rackem League Race Points Chart (race_points) - Individual player races, handicap +2 to -2
-- 4. Rackem League Race Percentage Chart (race_percentage) - Individual player races, percentage-based
--
-- These match the hardcoded charts in:
-- - src/utils/handicap/get3v3GamesNeeded.ts (Points chart)
-- - src/components/operator/threshold-editor/PercentageThresholdChartEditor.tsx (Percentage chart)
-- - src/components/operator/threshold-editor/RaceThresholdChartEditor.tsx (Race charts)
--
-- created_by = NULL indicates these are system-created Rackem League standard charts
--
-- This file is idempotent - safe to run multiple times.
-- Run this AFTER 20260119000000_threshold_charts.sql
-- ============================================================================

-- ============================================================================
-- 1. Rackem League 3v3 Points Chart (team_points)
-- ============================================================================
-- Used for leagues with 3-player lineups and double round-robin (18 games per match)
-- Exact lookup by handicap difference
-- Based on CUSTOM_5MAN_HANDICAP_SYSTEM.md

INSERT INTO threshold_charts (
    entity_type,
    entity_id,
    chart_type,
    lookup_mode,
    name,
    description,
    is_default,
    created_by
) VALUES (
    'global',
    '00000000-0000-0000-0000-000000000000',
    'team_points',
    'exact',
    'Rackem League 3v3 Points Chart',
    'Standard Rackem League handicap chart for 3-player lineup leagues (double round-robin, 18 games). Ties only possible at even handicap differences.',
    true,
    NULL  -- System-created Rackem League standard chart
) ON CONFLICT (entity_type, entity_id, chart_type, name) DO NOTHING;

-- Insert rows for Points chart (only if chart exists and has no rows)
-- Data from get3v3GamesNeeded.ts (HANDICAP_CHART_3V3)
-- comp_1 = handicap diff, result_1 = games_to_win, result_2 = games_to_tie (null for odd diffs), result_3 = games_to_lose
DO $$
DECLARE
    chart_uuid UUID;
    row_count INTEGER;
BEGIN
    SELECT id INTO chart_uuid FROM threshold_charts
    WHERE entity_type = 'global' AND chart_type = 'team_points' AND name = 'Rackem League 3v3 Points Chart';

    -- Only insert if chart exists and has no rows yet
    IF chart_uuid IS NOT NULL THEN
        SELECT COUNT(*) INTO row_count FROM threshold_chart_rows WHERE chart_id = chart_uuid;

        IF row_count = 0 THEN
            INSERT INTO threshold_chart_rows (chart_id, comp_1, comp_2, result_1, result_2, result_3, sort_order) VALUES
                -- Positive diffs (home team stronger = needs more games to win)
                (chart_uuid, 12, NULL, 16, 15, 14, 1),   -- +12: win=16, tie=15, lose=14
                (chart_uuid, 11, NULL, 15, NULL, 14, 2), -- +11: win=15, tie=null, lose=14
                (chart_uuid, 10, NULL, 15, 14, 13, 3),   -- +10: win=15, tie=14, lose=13
                (chart_uuid, 9, NULL, 14, NULL, 13, 4),  -- +9: win=14, tie=null, lose=13
                (chart_uuid, 8, NULL, 14, 13, 12, 5),    -- +8: win=14, tie=13, lose=12
                (chart_uuid, 7, NULL, 13, NULL, 12, 6),  -- +7: win=13, tie=null, lose=12
                (chart_uuid, 6, NULL, 13, 12, 11, 7),    -- +6: win=13, tie=12, lose=11
                (chart_uuid, 5, NULL, 12, NULL, 11, 8),  -- +5: win=12, tie=null, lose=11
                (chart_uuid, 4, NULL, 12, 11, 10, 9),    -- +4: win=12, tie=11, lose=10
                (chart_uuid, 3, NULL, 11, NULL, 10, 10), -- +3: win=11, tie=null, lose=10
                (chart_uuid, 2, NULL, 11, 10, 9, 11),    -- +2: win=11, tie=10, lose=9
                (chart_uuid, 1, NULL, 10, NULL, 9, 12),  -- +1: win=10, tie=null, lose=9
                -- Even match
                (chart_uuid, 0, NULL, 10, 9, 8, 13),     -- 0: win=10, tie=9, lose=8
                -- Negative diffs (home team weaker = needs fewer games to win)
                (chart_uuid, -1, NULL, 9, NULL, 8, 14),  -- -1: win=9, tie=null, lose=8
                (chart_uuid, -2, NULL, 9, 8, 7, 15),     -- -2: win=9, tie=8, lose=7
                (chart_uuid, -3, NULL, 8, NULL, 7, 16),  -- -3: win=8, tie=null, lose=7
                (chart_uuid, -4, NULL, 8, 7, 6, 17),     -- -4: win=8, tie=7, lose=6
                (chart_uuid, -5, NULL, 7, NULL, 6, 18),  -- -5: win=7, tie=null, lose=6
                (chart_uuid, -6, NULL, 7, 6, 5, 19),     -- -6: win=7, tie=6, lose=5
                (chart_uuid, -7, NULL, 6, NULL, 5, 20),  -- -7: win=6, tie=null, lose=5
                (chart_uuid, -8, NULL, 6, 5, 4, 21),     -- -8: win=6, tie=5, lose=4
                (chart_uuid, -9, NULL, 5, NULL, 4, 22),  -- -9: win=5, tie=null, lose=4
                (chart_uuid, -10, NULL, 5, 4, 3, 23),    -- -10: win=5, tie=4, lose=3
                (chart_uuid, -11, NULL, 4, NULL, 3, 24), -- -11: win=4, tie=null, lose=3
                (chart_uuid, -12, NULL, 4, 3, 2, 25);    -- -12: win=4, tie=3, lose=2
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 2. Rackem League 5v5 Percentage Chart (team_percentage)
-- ============================================================================
-- Used for leagues with 5-player lineups and percentage handicaps (25 games per match)
-- Range lookup (VLOOKUP-style) by handicap difference range
-- No ties (odd number of games ensures clear winner)

INSERT INTO threshold_charts (
    entity_type,
    entity_id,
    chart_type,
    lookup_mode,
    name,
    description,
    is_default,
    created_by
) VALUES (
    'global',
    '00000000-0000-0000-0000-000000000000',
    'team_percentage',
    'range',
    'Rackem League 5v5 Percentage Chart',
    'Standard Rackem League handicap chart for 5-player lineup leagues using percentage handicaps (25 games). Range-based lookup by handicap difference.',
    true,
    NULL  -- System-created Rackem League standard chart
) ON CONFLICT (entity_type, entity_id, chart_type, name) DO NOTHING;

-- Insert rows for Percentage chart (only if chart exists and has no rows)
-- Data from getDefaultPercentageChartRows() in PercentageThresholdChartEditor.tsx
-- comp_1 = minDiff, comp_2 = maxDiff, result_1 = higherWins, result_3 = lowerWins, result_2 = null (no ties)
DO $$
DECLARE
    chart_uuid UUID;
    row_count INTEGER;
BEGIN
    SELECT id INTO chart_uuid FROM threshold_charts
    WHERE entity_type = 'global' AND chart_type = 'team_percentage' AND name = 'Rackem League 5v5 Percentage Chart';

    -- Only insert if chart exists and has no rows yet
    IF chart_uuid IS NOT NULL THEN
        SELECT COUNT(*) INTO row_count FROM threshold_chart_rows WHERE chart_id = chart_uuid;

        IF row_count = 0 THEN
            INSERT INTO threshold_chart_rows (chart_id, comp_1, comp_2, result_1, result_2, result_3, sort_order) VALUES
                (chart_uuid, 0, 14, 13, NULL, 13, 1),     -- 0-14 diff: higher=13, lower=13 (even match)
                (chart_uuid, 15, 40, 14, NULL, 12, 2),    -- 15-40 diff: higher=14, lower=12
                (chart_uuid, 41, 66, 15, NULL, 11, 3),    -- 41-66 diff: higher=15, lower=11
                (chart_uuid, 67, 92, 16, NULL, 10, 4),    -- 67-92 diff: higher=16, lower=10
                (chart_uuid, 93, 118, 17, NULL, 9, 5),    -- 93-118 diff: higher=17, lower=9
                (chart_uuid, 119, 144, 18, NULL, 8, 6),   -- 119-144 diff: higher=18, lower=8
                (chart_uuid, 145, 999, 19, NULL, 7, 7);   -- 145+ diff: higher=19, lower=7
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 3. Rackem League Race Points Chart (race_points)
-- ============================================================================
-- Used for individual player vs player races with point-based handicaps
-- Exact lookup by both player handicaps (2D matrix, upper triangle only)
-- Handicap range: +2 to -2 (5 levels)
-- Base race: 5, Max race: 7, Min race: 2
--
-- Algorithm used to generate:
-- - Row base decreases by 1 for every 2 rows below the first
-- - Differences alternate: -1 to lower player, +1 to higher player
-- - Example: base 5 → 5-5 → 5-4 → 6-4 → 6-3 → 7-3

INSERT INTO threshold_charts (
    entity_type,
    entity_id,
    chart_type,
    lookup_mode,
    name,
    description,
    is_default,
    created_by
) VALUES (
    'global',
    '00000000-0000-0000-0000-000000000000',
    'race_points',
    'exact',
    'Rackem League Race Points Chart',
    'Standard Rackem League race chart for individual player matchups. Handicaps +2 to -2, base race 5, max 7, min 2.',
    true,
    NULL  -- System-created Rackem League standard chart
) ON CONFLICT (entity_type, entity_id, chart_type, name) DO NOTHING;

-- Insert rows for Race Points chart (only if chart exists and has no rows)
-- comp_1 = player1 handicap (higher), comp_2 = player2 handicap (lower or equal)
-- result_1 = player1 races to, result_2 = null (no ties), result_3 = player2 races to
DO $$
DECLARE
    chart_uuid UUID;
    row_count INTEGER;
BEGIN
    SELECT id INTO chart_uuid FROM threshold_charts
    WHERE entity_type = 'global' AND chart_type = 'race_points' AND name = 'Rackem League Race Points Chart';

    -- Only insert if chart exists and has no rows yet
    IF chart_uuid IS NOT NULL THEN
        SELECT COUNT(*) INTO row_count FROM threshold_chart_rows WHERE chart_id = chart_uuid;

        IF row_count = 0 THEN
            INSERT INTO threshold_chart_rows (chart_id, comp_1, comp_2, result_1, result_2, result_3, sort_order) VALUES
                -- Row 0 (handicap 2 vs X): base=5
                (chart_uuid, 2, 2, 5, NULL, 5, 0),    -- 2 vs 2: 5-5 (diff 0)
                (chart_uuid, 2, 1, 5, NULL, 4, 1),    -- 2 vs 1: 5-4 (diff 1: -1 to lower)
                (chart_uuid, 2, 0, 6, NULL, 4, 2),    -- 2 vs 0: 6-4 (diff 2: +1 to higher)
                (chart_uuid, 2, -1, 6, NULL, 3, 3),   -- 2 vs -1: 6-3 (diff 3: -1 to lower)
                (chart_uuid, 2, -2, 7, NULL, 3, 4),   -- 2 vs -2: 7-3 (diff 4: +1 to higher)
                -- Row 1 (handicap 1 vs X): base=4 (row reduction = 1)
                (chart_uuid, 1, 1, 4, NULL, 4, 5),    -- 1 vs 1: 4-4 (diff 0)
                (chart_uuid, 1, 0, 4, NULL, 3, 6),    -- 1 vs 0: 4-3 (diff 1: -1 to lower)
                (chart_uuid, 1, -1, 5, NULL, 3, 7),   -- 1 vs -1: 5-3 (diff 2: +1 to higher)
                (chart_uuid, 1, -2, 5, NULL, 2, 8),   -- 1 vs -2: 5-2 (diff 3: -1 to lower)
                -- Row 2 (handicap 0 vs X): base=4 (row reduction = 1)
                (chart_uuid, 0, 0, 4, NULL, 4, 9),    -- 0 vs 0: 4-4 (diff 0)
                (chart_uuid, 0, -1, 4, NULL, 3, 10),  -- 0 vs -1: 4-3 (diff 1: -1 to lower)
                (chart_uuid, 0, -2, 5, NULL, 3, 11),  -- 0 vs -2: 5-3 (diff 2: +1 to higher)
                -- Row 3 (handicap -1 vs X): base=3 (row reduction = 2)
                (chart_uuid, -1, -1, 3, NULL, 3, 12), -- -1 vs -1: 3-3 (diff 0)
                (chart_uuid, -1, -2, 3, NULL, 2, 13), -- -1 vs -2: 3-2 (diff 1: -1 to lower)
                -- Row 4 (handicap -2 vs X): base=3 (row reduction = 2)
                (chart_uuid, -2, -2, 3, NULL, 3, 14); -- -2 vs -2: 3-3 (diff 0)
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 4. Rackem League Race Percentage Chart (race_percentage)
-- ============================================================================
-- Used for individual player vs player races with percentage-based handicaps
-- 2D ranged lookup by:
--   1. Diff (difference between player handicaps) - comp_1 is upper bound (exclusive)
--      - Diff=16 covers 0-15, Diff=32 covers 16-31, etc.
--   2. Highest H/C (higher player's skill tier) - comp_2 is lower bound (inclusive)
--
-- Settings: base=5, max=7, min=3 (same as points chart), handicap range 100-20, 5 divisions
--
-- Tier count is DERIVED from settings:
-- - Number of tiers = base - min + 1 = 5 - 3 + 1 = 3 tiers
-- - Tier boundaries: 80 range / 3 tiers ≈ 27 per tier
-- - Tier 0 (74-100): base=5
-- - Tier 1 (47-73): base=4
-- - Tier 2 (20-46): base=3
--
-- Structure:
-- - comp_1 = Diff upper bound (e.g., 16 means "diffs 0-15")
-- - comp_2 = Highest H/C lower bound (e.g., 74 means "handicaps 74-100")
-- - result_1 = Games higher-handicapped player races to
-- - result_3 = Games lower-handicapped player races to
--
-- Division calculation: 80 range / 5 divisions = 16 per division
-- - Division 0: diff 0-15 (comp_1=16) → adj=0 (even)
-- - Division 1: diff 16-31 (comp_1=32) → adj=1 → -1 to lower
-- - Division 2: diff 32-47 (comp_1=48) → adj=2 → +1 to higher
-- - Division 3: diff 48-63 (comp_1=64) → adj=3 → -1 to lower
-- - Division 4: diff 64-79 (comp_1=80) → adj=4 → +1 to higher
--
-- Algorithm (calculateRaceLengths helper):
-- Odd steps: -1 to lower, Even steps: +1 to higher
-- If lower hits min, overflow to higher; if higher hits max, overflow to lower
--
-- Rows grouped by Highest H/C tier, then Diff within each tier

INSERT INTO threshold_charts (
    entity_type,
    entity_id,
    chart_type,
    lookup_mode,
    name,
    description,
    is_default,
    created_by
) VALUES (
    'global',
    '00000000-0000-0000-0000-000000000000',
    'race_percentage',
    'range',
    'Rackem League Race Percentage Chart',
    'Standard Rackem League race chart for individual player matchups using percentage handicaps. 2D lookup by gap range and skill tier.',
    true,
    NULL  -- System-created Rackem League standard chart
) ON CONFLICT (entity_type, entity_id, chart_type, name) DO NOTHING;

-- Insert rows for Race Percentage chart (only if chart exists and has no rows)
-- Settings: base=5, max=7, min=3, handicap range 100-20, 5 divisions
-- 3 tiers (derived from base-min+1 = 5-3+1): 74-100, 47-73, 20-46
-- 5 diff ranges per tier = 15 total rows
-- Grouped by Highest H/C tier first
DO $$
DECLARE
    chart_uuid UUID;
    row_count INTEGER;
BEGIN
    SELECT id INTO chart_uuid FROM threshold_charts
    WHERE entity_type = 'global' AND chart_type = 'race_percentage' AND name = 'Rackem League Race Percentage Chart';

    -- Only insert if chart exists and has no rows yet
    IF chart_uuid IS NOT NULL THEN
        SELECT COUNT(*) INTO row_count FROM threshold_chart_rows WHERE chart_id = chart_uuid;

        IF row_count = 0 THEN
            INSERT INTO threshold_chart_rows (chart_id, comp_1, comp_2, result_1, result_2, result_3, sort_order) VALUES
                -- Skill tier 74-100 (tier 0, base=5)
                -- adj=0: even, adj=1: -1 lower, adj=2: +1 higher, adj=3: -1 lower, adj=4: +1 higher
                (chart_uuid, 16, 74, 5, NULL, 5, 1),    -- Diff 0-15:  adj=0 → 5-5 (even)
                (chart_uuid, 32, 74, 5, NULL, 4, 2),    -- Diff 16-31: adj=1 → 5-4 (-1 lower)
                (chart_uuid, 48, 74, 6, NULL, 4, 3),    -- Diff 32-47: adj=2 → 6-4 (+1 higher)
                (chart_uuid, 64, 74, 6, NULL, 3, 4),    -- Diff 48-63: adj=3 → 6-3 (-1 lower)
                (chart_uuid, 80, 74, 7, NULL, 3, 5),    -- Diff 64-79: adj=4 → 7-3 (+1 higher)
                -- Skill tier 47-73 (tier 1, base=4)
                (chart_uuid, 16, 47, 4, NULL, 4, 6),    -- Diff 0-15:  adj=0 → 4-4 (even)
                (chart_uuid, 32, 47, 4, NULL, 3, 7),    -- Diff 16-31: adj=1 → 4-3 (-1 lower)
                (chart_uuid, 48, 47, 5, NULL, 3, 8),    -- Diff 32-47: adj=2 → 5-3 (+1 higher)
                (chart_uuid, 64, 47, 6, NULL, 3, 9),    -- Diff 48-63: adj=3 → 6-3 (-1 lower clamped, overflow to higher)
                (chart_uuid, 80, 47, 7, NULL, 3, 10),   -- Diff 64-79: adj=4 → 7-3 (+1 higher)
                -- Skill tier 20-46 (tier 2, base=3)
                (chart_uuid, 16, 20, 3, NULL, 3, 11),   -- Diff 0-15:  adj=0 → 3-3 (even)
                (chart_uuid, 32, 20, 4, NULL, 3, 12),   -- Diff 16-31: adj=1 → 4-3 (-1 lower clamped, overflow to higher)
                (chart_uuid, 48, 20, 5, NULL, 3, 13),   -- Diff 32-47: adj=2 → 5-3 (+1 higher)
                (chart_uuid, 64, 20, 6, NULL, 3, 14),   -- Diff 48-63: adj=3 → 6-3 (-1 lower clamped, overflow to higher)
                (chart_uuid, 80, 20, 7, NULL, 3, 15);   -- Diff 64-79: adj=4 → 7-3 (+1 higher)
        END IF;
    END IF;
END $$;
