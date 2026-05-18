-- ============================================================================
-- DEV-ONLY: squish the dev seed's active season into the
-- "Start Next Season" ripe window.
-- ============================================================================
--
-- The next-season wizard's entry-point button (and the org-dashboard hint
-- badge) only appears when an active season's end_date is within the next
-- 21 days OR the league has a completed previous season. The dev bootstrap
-- creates a season starting today with 12 weeks of runway, so by default
-- the wizard's entry points are invisible — you'd have to wait ~10 weeks
-- of real calendar time to see them.
--
-- This script targets the dev_bootstrap_full.sql season (named
-- 'Dev Season YYYY-MM-DD'), squishes its end_date to 10 days from today,
-- and marks past weeks as completed so the season progress bar reflects
-- the fast-forward. Refresh the operator dashboard → "Start Next Season"
-- entry points become visible immediately.
--
-- SAFE TO RE-RUN. Idempotent. Targets only the most-recently-created
-- season named 'Dev Season %'.
--
-- HOW TO USE
--   Paste into Supabase Studio > SQL Editor > Run. Then refresh the
--   operator dashboard or league page.
--
-- HOW TO UNDO
--   See the trailing UNDO block (commented out by default).
-- ============================================================================

WITH target_season AS (
  SELECT id, start_date, season_length
  FROM seasons
  WHERE season_name LIKE 'Dev Season %'
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE seasons s
SET end_date = CURRENT_DATE + 10
FROM target_season ts
WHERE s.id = ts.id;

-- Mark past scheduled weeks as completed so the LeagueStatusCard
-- progress bar shows "almost done" instead of stuck at week 1.
UPDATE season_weeks sw
SET week_completed = true
WHERE sw.season_id = (
  SELECT id FROM seasons
  WHERE season_name LIKE 'Dev Season %' AND status = 'active'
  ORDER BY created_at DESC LIMIT 1
)
AND sw.scheduled_date < CURRENT_DATE;

-- Confirmation: print the updated season so you can verify in the SQL
-- Editor's results pane.
SELECT id, season_name, start_date, end_date, status,
       (end_date - CURRENT_DATE) AS days_until_end
FROM seasons
WHERE season_name LIKE 'Dev Season %'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- UNDO (commented out — uncomment + re-run to restore the original end_date)
-- ============================================================================
-- UPDATE seasons s
-- SET end_date = s.start_date + (s.season_length * 7)
-- WHERE s.season_name LIKE 'Dev Season %' AND s.status = 'active';
--
-- UPDATE season_weeks
-- SET week_completed = false
-- WHERE season_id = (
--   SELECT id FROM seasons
--   WHERE season_name LIKE 'Dev Season %' AND status = 'active'
--   ORDER BY created_at DESC LIMIT 1
-- );
