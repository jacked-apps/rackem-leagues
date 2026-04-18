-- ============================================================================
-- TIER 3 MATCH-START SNAPSHOT: matches.system_snapshot JSONB
-- ============================================================================
--
-- Per the mutability hierarchy documented in
-- docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md:
--
-- Tier 3 — Match-immutable:
--   All gameplay-relevant dials snapshot onto the matches record when the
--   match transitions from `scheduled` to `in_progress`. In-flight matches
--   are immune to dial changes even if a mid-season edit somehow bypassed
--   the tier 2 season-active lock. Threshold-chart edits that land mid-season
--   apply forward-only: only unstarted matches see the change; matches
--   already started or completed keep their snapshotted values.
--
-- Snapshot shape (populated by application code in Unit 11 at first-scoring-event):
--   {
--     "overrides":          { winner_points?: N, loser_points_method?, ... },
--     "threshold_chart_id": "uuid-or-null",
--     "snapshot_at":        "2026-04-18T17:30:00.000Z"
--   }
--
-- NULL means the match hasn't been scored yet OR it's a legacy match from
-- before this column existed. Scoring code (resolver with match context)
-- falls back to live league data in that case and logs a warning.
--
-- Per-game points (match_games.winner_points, loser_points, loser_balls_pocketed)
-- are already per-row frozen by Unit 5's migration — this snapshot extends
-- that protection to dials that don't have per-game storage.
-- ============================================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS system_snapshot JSONB;

COMMENT ON COLUMN matches.system_snapshot IS
  'Tier 3 match-start snapshot: frozen tier 2 dial values + threshold_chart_id at scheduled → in_progress transition. In-flight matches score from this, not live league data. NULL for unstarted or legacy matches. See src/systems/types.ts and the plan doc for shape.';
