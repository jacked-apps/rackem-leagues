-- ============================================================================
-- Schedule ⇄ Matchup decoupling — Phase B1: labels to notes, collapse types
-- ============================================================================
--
-- Part of the refactor that stops STORING the season week number (see
-- docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md).
-- Phase A moved every reader off `week_name` (numbers are now derived from a
-- regular week's date position). This migration cleans up the stored data:
--
--   1. Backfill blackout / season-end-break LABELS into the `notes` column
--      (the holiday name etc. used to live in `week_name`; the derived-label
--      model reads a blackout's label from `notes`). Idempotent: only fills
--      rows whose `notes` is still NULL.
--   2. Collapse `season_end_break` rows into `blackout` — the three-type model
--      (regular / blackout / playoffs) treats a season-end break as a blackout
--      labelled "Week Off".
--   3. Relax the `week_type` CHECK to the three-type set.
--
-- `week_name` is intentionally LEFT in place (still NOT NULL, still written by
-- writers) and is dropped later in Phase C, once nothing references it at all.
--
-- Ordering + atomicity: convert the season_end_break rows BEFORE re-adding the
-- narrowed CHECK (otherwise ADD CONSTRAINT would fail validating surviving
-- season_end_break rows), and run it all in ONE transaction so a partial apply
-- can never leave a season_end_break row that the new CHECK rejects on the next
-- write. UNIQUE(season_id, scheduled_date) and the matches FK are untouched
-- (no row deleted, no id/date changed).
-- ============================================================================

BEGIN;

-- 1. Move the human label out of week_name and into notes for off weeks.
--    Regular/playoff labels are derived (Week N / Playoffs) and are NOT stored.
UPDATE public.season_weeks
SET notes = week_name
WHERE week_type IN ('blackout', 'season_end_break')
  AND notes IS NULL;

-- 2. Collapse the season_end_break type into blackout (must precede the CHECK swap).
UPDATE public.season_weeks
SET week_type = 'blackout'
WHERE week_type = 'season_end_break';

-- 3. Narrow the allowed week_type set to the three-type model.
ALTER TABLE public.season_weeks
  DROP CONSTRAINT season_weeks_week_type_check;

ALTER TABLE public.season_weeks
  ADD CONSTRAINT season_weeks_week_type_check
  CHECK (week_type IN ('regular', 'blackout', 'playoffs'));

COMMIT;
