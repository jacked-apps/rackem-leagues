-- ============================================================================
-- Update prep_match RPC for Phase 2 Unit 2.1 column renames + status flip
-- ============================================================================
--
-- Phase 2 Unit 2.1 of the modular-league-system v2 plan renamed the
-- threshold columns:
--
--   home_games_to_win  → home_to_win
--   home_games_to_tie  → home_to_tie
--   home_games_to_lose → home_to_lose
--   away_games_to_win  → away_to_win
--   away_games_to_tie  → away_to_tie
--   away_games_to_lose → away_to_lose
--
-- The original `prep_match` RPC (20260424000000) was authored before that
-- rename and still references the old column names in both the column
-- targets AND the JSONB key lookups. The client (useMatchPreparation)
-- now sends the new key names, so the RPC fails with:
--
--   column "home_games_to_win" of relation "matches" does not exist
--
-- This migration replaces the function body to use the new column names
-- everywhere.
--
-- Also: the prior implementation never transitioned matches.status from
-- 'scheduled' to 'in_progress'. The codebase historically used
-- `started_at IS NOT NULL` as the "match is live" signal and skipped
-- the intermediate status entirely. The matches table then looked
-- confusing in dev tools — a fully-scored match still showed status =
-- 'scheduled' until completion flipped it straight to 'completed'.
--
-- This migration also flips `status = 'in_progress'` (only when status
-- is currently 'scheduled' — don't overwrite 'completed' / 'forfeited' /
-- etc.) and stamps `started_at = NOW()` (if not already set) when
-- prep_match runs. Both lineups are locked and games rows exist by
-- this point — that's exactly when "in progress" applies.
-- MatchEndVerification flips it to 'completed' on match-end (or back
-- to 'in_progress' for tied games headed to tiebreaker), so the full
-- lifecycle is now: scheduled → in_progress → completed.
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
  UPDATE matches
  SET
    home_to_win  = NULLIF(p_thresholds->>'home_to_win',  'null')::INT,
    home_to_tie  = NULLIF(p_thresholds->>'home_to_tie',  'null')::INT,
    home_to_lose = NULLIF(p_thresholds->>'home_to_lose', 'null')::INT,
    away_to_win  = NULLIF(p_thresholds->>'away_to_win',  'null')::INT,
    away_to_tie  = NULLIF(p_thresholds->>'away_to_tie',  'null')::INT,
    away_to_lose = NULLIF(p_thresholds->>'away_to_lose', 'null')::INT,
    -- Phase 5 Unit 5.5 follow-up: flip status to 'in_progress' so the
    -- matches row reflects "actively being scored" instead of being
    -- stuck on 'scheduled' until match completion. Defensive: only
    -- transition from 'scheduled' (don't clobber 'completed' /
    -- 'forfeited' / 'postponed' if the match has already moved on).
    status = CASE WHEN status = 'scheduled' THEN 'in_progress' ELSE status END,
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'prep_match: match % not found', p_match_id
      USING ERRCODE = 'no_data_found';
  END IF;

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
END;
$$;

GRANT EXECUTE ON FUNCTION prep_match(UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION prep_match(UUID, JSONB, JSONB) IS
'Transactional match preparation. Writes threshold columns + flips status
from scheduled to in_progress (defensive — only when currently scheduled)
+ stamps started_at on the matches row, then inserts match_games rows,
all in a single Postgres transaction. Phase 2 Unit 2.1 column-rename
update: thresholds use the new home_to_*/away_to_* column names. Phase 5
Unit 5.5 follow-up: status now reflects scheduled → in_progress →
completed lifecycle (was scheduled → completed before). ON CONFLICT
(match_id, game_number) DO NOTHING makes the insert safe to retry.
Client wraps this in a retry loop; each attempt is atomic so a failed
attempt leaves no partial state behind.';
