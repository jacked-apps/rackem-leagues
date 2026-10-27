-- =============================================================================
-- recalculate_points_3man_3_undo.sql  —  UNDO the latest Points 3-Man re-score
-- =============================================================================
--
-- Step 3 of 3 — ONLY if you need to roll back. Restores the points saved by
-- the most recent run of recalculate_points_3man_2_apply.sql (from
-- maintenance.points_recalc_backup), then removes that run's backup rows so a
-- second undo would roll back the run before it.
-- =============================================================================

begin;
update matches mt
set home_points_earned = b.home_points_earned,
    away_points_earned = b.away_points_earned
from maintenance.points_recalc_backup b
where b.run_at = (select max(run_at) from maintenance.points_recalc_backup)
  and b.match_id = mt.id;
delete from maintenance.points_recalc_backup
where run_at = (select max(run_at) from maintenance.points_recalc_backup);
commit;
