-- ============================================================================
-- PHASE 7 UNIT 7.3 — DROP `team_format` FROM leagues + preferences
-- ============================================================================
--
-- Final removal of the legacy `team_format` column. The v2 modular plan's
-- architectural reframe (supplement Section 4) made `team_format` redundant:
-- lineup geometry now comes from `preferences.lineup_size`, and the resolved
-- view exposes that. The two-value enum (`'5_man'` / `'8_man'`) was a
-- conflation of lineup size with format-bundle identity that the modular
-- system rejects.
--
-- Order matters:
--   1. The resolved view (recreated in 20260429000002 without `team_format`
--      per this unit's in-place edit) no longer depends on the column —
--      no view DROP needed here.
--   2. DROP the columns from `leagues` and `preferences`.
--
-- All app data is disposable test data; production has no real users today.
-- `db reset` rebuilds from this point.
--
-- @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 7.3)
-- ============================================================================

ALTER TABLE public.leagues
  DROP COLUMN IF EXISTS team_format;

ALTER TABLE public.preferences
  DROP COLUMN IF EXISTS team_format;
