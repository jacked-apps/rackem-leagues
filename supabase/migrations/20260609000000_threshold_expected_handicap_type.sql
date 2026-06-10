-- ============================================================================
-- THRESHOLD ROOM — declare the expected handicap type (input declaration)
-- ============================================================================
--
-- A threshold must declare WHAT it takes in before anything else: which of the
-- supported handicap systems its home/away input is in. That declaration is a
-- DIAL the author sets (points / percentage / fargo) — and it's what the slot
-- uses to attach the right guard rail automatically. The author never writes a
-- guard; they answer "which handicap system?" and the guard follows.
--
-- Nullable for now: the blank Empty Starter has no type until the author picks
-- one. The 3 supported systems are points / percentage / fargo.
--
-- See docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md.
-- ============================================================================

ALTER TABLE "public"."thresholds"
  ADD COLUMN IF NOT EXISTS "expected_handicap_type" text;

ALTER TABLE "public"."thresholds"
  ADD CONSTRAINT "thresholds_handicap_type_check"
  CHECK (
    expected_handicap_type IS NULL
    OR expected_handicap_type IN ('points', 'percentage', 'fargo')
  );

COMMENT ON COLUMN "public"."thresholds"."expected_handicap_type" IS
  'Which handicap system the threshold''s home/away input is in (points | percentage | fargo). The author-set dial that selects the input guard rail.';

-- Backfill the seeded officials (this migration runs AFTER the seed). The tamper
-- trigger blocks UPDATE of official rows, so disable it around the backfill.
ALTER TABLE "public"."thresholds" DISABLE TRIGGER thresholds_block_official_modification;
UPDATE "public"."thresholds" SET expected_handicap_type = 'points'
  WHERE name IN ('threshold_official_points_chart_win', 'threshold_official_points_formula_win', 'threshold_official_points_chart_edge');
UPDATE "public"."thresholds" SET expected_handicap_type = 'percentage'
  WHERE name IN ('threshold_official_pct_chart_win', 'threshold_official_pct_formula_win');
UPDATE "public"."thresholds" SET expected_handicap_type = 'fargo'
  WHERE name IN ('threshold_official_fargo_start', 'threshold_official_fargo_win');
ALTER TABLE "public"."thresholds" ENABLE TRIGGER thresholds_block_official_modification;
