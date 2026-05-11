-- ============================================================================
-- Harden prep_match: WHERE status='scheduled' on all writes; idempotent on race-losers
-- ============================================================================
--
-- Background
-- ----------
-- The current prep_match (20260502000002) guards only the `status` column from
-- being clobbered on a second call (via CASE WHEN status='scheduled'). All
-- other writes — threshold columns, started_at — run unconditionally. This
-- leaves a multi-device race window:
--
--   Two devices both authenticated as home captain (e.g., the same user on
--   phone + laptop, or partner-as-co-captain testing). Both qualify the prep
--   gate. Both call prep_match. Both UPDATEs run. Last writer wins on
--   threshold values. If the two devices' matchData differs (because one
--   missed a Fargo-edit cache invalidation), the loser's threshold values
--   silently overwrite the winner's.
--
-- This migration replaces the function body so ALL writes are guarded by
-- WHERE id = p_match_id AND status = 'scheduled'. A second call from any
-- race-loser is a true no-op — no writes, no exception, no duplicate rows.
--
-- Two adjustments compared to the prior version
-- ---------------------------------------------
-- 1. The IF NOT FOUND block is dropped. With the new WHERE clause, NOT FOUND
--    fires whenever the match isn't 'scheduled' (which is exactly the
--    race-loser case we're trying to make silent). Raising would defeat the
--    purpose. Callers that need a "match exists?" check can do their own
--    SELECT before calling.
--
-- 2. The INSERT INTO match_games block is wrapped in IF FOUND so race-losers
--    don't enter the INSERT path at all. The ON CONFLICT DO NOTHING clause
--    is retained as belt-and-suspenders against the unlikely case where the
--    UPDATE matched but a concurrent prep_match has already inserted some
--    game rows.
--
-- What this does NOT change
-- -------------------------
-- No schema changes. No new columns, no new tables, no dropped columns. The
-- matches table looks identical before and after this migration.
--
-- The points-mode "preserve home_to_lose / away_to_lose" pattern in the
-- client (useMatchPreparation.ts) remains correct: those columns are doing
-- double-duty for the temporary Fargo start-points negotiation feature, and
-- prep_match continues to write whatever the client passes through. The
-- staleTime fix in the client is what actually closes bug #22 — by ensuring
-- the client reads the freshest *_to_lose values before passing them back.
-- ============================================================================

CREATE OR REPLACE FUNCTION prep_match(
  p_match_id UUID,
  p_thresholds JSONB,
  p_game_rows JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- All writes guarded by status='scheduled'. Race-loser calls match zero
  -- rows here and skip the INSERT below (via IF FOUND). No exceptions, no
  -- side effects.
  UPDATE matches
  SET
    home_to_win  = NULLIF(p_thresholds->>'home_to_win',  'null')::INT,
    home_to_tie  = NULLIF(p_thresholds->>'home_to_tie',  'null')::INT,
    home_to_lose = NULLIF(p_thresholds->>'home_to_lose', 'null')::INT,
    away_to_win  = NULLIF(p_thresholds->>'away_to_win',  'null')::INT,
    away_to_tie  = NULLIF(p_thresholds->>'away_to_tie',  'null')::INT,
    away_to_lose = NULLIF(p_thresholds->>'away_to_lose', 'null')::INT,
    status = 'in_progress',
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_match_id
    AND status = 'scheduled';

  -- Only insert game rows when the UPDATE matched. Skipping this for
  -- race-losers keeps the function fully no-op when nothing changed.
  IF FOUND THEN
    INSERT INTO match_games (
      match_id,
      game_number,
      game_type,
      home_player_id,
      away_player_id,
      home_position,
      away_position,
      home_action,
      away_action
    )
    SELECT
      p_match_id,
      (row_obj->>'game_number')::INT,
      row_obj->>'game_type',
      NULLIF(row_obj->>'home_player_id', 'null')::UUID,
      NULLIF(row_obj->>'away_player_id', 'null')::UUID,
      (row_obj->>'home_position')::INT,
      (row_obj->>'away_position')::INT,
      row_obj->>'home_action',
      row_obj->>'away_action'
    FROM jsonb_array_elements(p_game_rows) AS row_obj
    ON CONFLICT (match_id, game_number) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION prep_match(UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION prep_match(UUID, JSONB, JSONB) IS
'Transactional match preparation, hardened against multi-device races.
ALL writes (thresholds, status, started_at) are guarded by
WHERE status = ''scheduled''. A second call from any race-loser is a
true no-op: no row updated, no exception raised, no duplicate game rows
inserted. The INSERT INTO match_games is gated on IF FOUND so it only
runs when the UPDATE matched. ON CONFLICT (match_id, game_number) DO
NOTHING is retained as belt-and-suspenders. Replaces the prior version
which only guarded the status column and would silently overwrite
threshold values when two devices both ran prep_match concurrently.';
