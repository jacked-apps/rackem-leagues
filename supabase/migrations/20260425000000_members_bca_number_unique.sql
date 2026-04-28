-- Migration: members.bca_member_number — uniqueness constraint
-- Purpose: A BCA# identifies one real person at the sanctioning level. Two
--          members can't legitimately share the same number. Today the
--          column is just a nullable varchar with no constraint, so the
--          rule lives only in convention. Adding a partial unique index
--          enforces it at the storage layer.
--
-- Normalization: lower(trim(...)) so that "12345 ", "12345", and " 12345 "
-- collide. Empty strings are excluded — only non-empty trimmed values must
-- be unique. Most members today have NULL or empty.
--
-- Pre-existing duplicates: this is a pre-production environment so any
-- duplicates that exist are dev seed/test data. The migration NULLs the
-- newer rows and keeps the oldest match per duplicate-set, so the unique
-- index can land cleanly. A loud NOTICE reports any cleanup that fired.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- ============================================================================
-- Step 1: dedupe (pre-production, no real users yet — keep oldest, null out the rest)
-- ============================================================================
DO $$
DECLARE
  v_cleaned INT;
BEGIN
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY lower(trim(bca_member_number))
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM members
    WHERE bca_member_number IS NOT NULL
      AND trim(bca_member_number) <> ''
  ),
  cleared AS (
    UPDATE members SET bca_member_number = NULL
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_cleaned FROM cleared;

  IF v_cleaned > 0 THEN
    RAISE NOTICE 'BCA# dedup: nulled out % duplicate row(s) (kept oldest of each group)', v_cleaned;
  ELSE
    RAISE NOTICE 'BCA# dedup: no duplicates found, proceeding directly to unique index';
  END IF;
END $$;

-- ============================================================================
-- Step 2: unique partial index on the normalized form
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_members_bca_member_number
  ON members ( lower(trim(bca_member_number)) )
  WHERE bca_member_number IS NOT NULL
    AND trim(bca_member_number) <> '';

COMMENT ON INDEX uniq_members_bca_member_number IS
'Enforces global uniqueness of BCA member numbers across the members table. Normalized via lower(trim(...)) to ignore casing and whitespace differences. Empty/null values are excluded — the constraint only applies to populated BCA numbers.';
