/**
 * Migration: Make Venue Table Count Columns Optional
 *
 * The table number arrays (bar_box_table_numbers, eight_foot_table_numbers,
 * regulation_table_numbers) are now the source of truth. The array lengths
 * provide the counts.
 *
 * This migration:
 * 1. Makes the legacy count columns optional (nullable with defaults)
 * 2. Updates total_tables to be computed from array lengths
 * 3. Updates the venue_must_have_tables constraint accordingly
 */

-- =============================================================================
-- Step 1: Drop the old constraint that depends on the generated column
-- =============================================================================
ALTER TABLE public.venues
DROP CONSTRAINT IF EXISTS venue_must_have_tables;

-- =============================================================================
-- Step 2: Drop the old generated column
-- =============================================================================
ALTER TABLE public.venues
DROP COLUMN IF EXISTS total_tables;

-- =============================================================================
-- Step 3: Make legacy integer count columns optional
-- =============================================================================
ALTER TABLE public.venues
ALTER COLUMN bar_box_tables DROP NOT NULL,
ALTER COLUMN bar_box_tables SET DEFAULT 0;

ALTER TABLE public.venues
ALTER COLUMN regulation_tables DROP NOT NULL,
ALTER COLUMN regulation_tables SET DEFAULT 0;

-- =============================================================================
-- Step 4: Add new generated column based on array lengths
-- =============================================================================
ALTER TABLE public.venues
ADD COLUMN total_tables integer GENERATED ALWAYS AS (
  COALESCE(array_length(bar_box_table_numbers, 1), 0) +
  COALESCE(array_length(eight_foot_table_numbers, 1), 0) +
  COALESCE(array_length(regulation_table_numbers, 1), 0)
) STORED;

-- =============================================================================
-- Step 5: Migrate existing venues with old count columns to use arrays
-- =============================================================================
-- For venues that have bar_box_tables > 0 but empty bar_box_table_numbers,
-- generate default table numbers [1, 2, 3, ...] based on the count
UPDATE public.venues
SET bar_box_table_numbers = (
  SELECT array_agg(i)
  FROM generate_series(1, bar_box_tables) AS i
)
WHERE bar_box_tables > 0
  AND (bar_box_table_numbers IS NULL OR array_length(bar_box_table_numbers, 1) IS NULL);

-- Same for regulation_tables -> regulation_table_numbers
-- Offset the numbers to avoid conflicts with bar_box tables
UPDATE public.venues
SET regulation_table_numbers = (
  SELECT array_agg(i)
  FROM generate_series(
    COALESCE(array_length(bar_box_table_numbers, 1), 0) + 1,
    COALESCE(array_length(bar_box_table_numbers, 1), 0) + regulation_tables
  ) AS i
)
WHERE regulation_tables > 0
  AND (regulation_table_numbers IS NULL OR array_length(regulation_table_numbers, 1) IS NULL);

-- =============================================================================
-- Step 6: Add new constraint based on array-computed total
-- =============================================================================
ALTER TABLE public.venues
ADD CONSTRAINT venue_must_have_tables CHECK (total_tables > 0);

-- =============================================================================
-- Step 7: Add comments explaining the new structure
-- =============================================================================
COMMENT ON COLUMN public.venues.bar_box_tables IS
'DEPRECATED: Use bar_box_table_numbers array instead. Kept for backwards compatibility.';

COMMENT ON COLUMN public.venues.regulation_tables IS
'DEPRECATED: Use regulation_table_numbers array instead. Kept for backwards compatibility.';

COMMENT ON COLUMN public.venues.total_tables IS
'Total number of tables (computed from array lengths: bar_box_table_numbers + eight_foot_table_numbers + regulation_table_numbers).';
