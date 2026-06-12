-- ============================================================================
-- swap_player_in_lineup: atomic mid-match player swap + recalibration
-- ============================================================================
--
-- Lineup-swap recalibration / Unit 3. Resolves an approved swap request in a
-- single transaction so a partial write (lineup changed but games not
-- cascaded, or thresholds written without the lineup change) is impossible.
--
-- Mirrors prep_match (20260504000000): SECURITY DEFINER, JSONB params,
-- guarded writes, GRANT to authenticated. Threshold composition stays
-- client-side (composeMatchThresholds) — the runtime's ThresholdOperations are
-- TypeScript modules that cannot run inside Postgres — so the caller passes the
-- precomputed six-column payload in p_thresholds, exactly like prep_match.
--
-- Permission model (see memory feedback_gate_ui_relax_rls): this function does
-- NOT police WHO the caller is. Anyone scoring the match (captain, guest
-- scorekeeper, or referee) can resolve a swap; access is gated in the UI, not
-- here. The function enforces only the guards that protect DATA integrity:
--   1. A pending swap still exists (FOR UPDATE lock closes the double-approve
--      race — the second caller finds swap_position already cleared).
--   2. The match is still in progress.
--   3. The outgoing player has not played any games (re-checked server-side in
--      case a game completed between request and approval).
--
-- p_resolution is stamped verbatim into swap_last_resolution for the audit
-- trail / resolution toast; it is display/audit data, never authorization.
-- ============================================================================

CREATE OR REPLACE FUNCTION swap_player_in_lineup(
  p_lineup_id  UUID,
  p_thresholds JSONB,
  p_resolution JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lineup         match_lineups%ROWTYPE;
  v_match_id       UUID;
  v_match_status   TEXT;
  v_is_home        BOOLEAN;
  v_player_field   TEXT;
  v_old_player_id  UUID;
  v_completed      INT;
BEGIN
  -- Guard 1: lock the lineup and confirm a pending swap is still open. A
  -- race-losing second approval finds no row (swap_position already cleared)
  -- and exits cleanly with a terminal error.
  SELECT * INTO v_lineup
  FROM match_lineups
  WHERE id = p_lineup_id
    AND swap_position IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending lineup swap to resolve for this lineup';
  END IF;

  v_match_id := v_lineup.match_id;

  -- Old player currently sitting at the swap position (derived, not stored).
  v_old_player_id := CASE v_lineup.swap_position
    WHEN 1 THEN v_lineup.player1_id
    WHEN 2 THEN v_lineup.player2_id
    WHEN 3 THEN v_lineup.player3_id
    WHEN 4 THEN v_lineup.player4_id
    WHEN 5 THEN v_lineup.player5_id
  END;

  -- Guard 2: match must still be in progress.
  SELECT status, (home_team_id = v_lineup.team_id)
    INTO v_match_status, v_is_home
  FROM matches
  WHERE id = v_match_id;

  IF v_match_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Match is no longer in progress (status: %)', v_match_status;
  END IF;

  v_player_field := CASE WHEN v_is_home THEN 'home_player_id' ELSE 'away_player_id' END;

  -- Guard 3: the outgoing player must have no completed games (a game may have
  -- been finished in the window between request and approval).
  IF v_old_player_id IS NOT NULL THEN
    EXECUTE format(
      'SELECT count(*) FROM match_games
         WHERE match_id = $1 AND %I = $2 AND winner_player_id IS NOT NULL',
      v_player_field
    ) INTO v_completed USING v_match_id, v_old_player_id;

    IF v_completed > 0 THEN
      RAISE EXCEPTION 'Outgoing player has already played games — swap no longer possible';
    END IF;
  END IF;

  -- Write 1: apply the swap at its position, clear all swap_* request columns,
  -- and stamp the resolution audit.
  EXECUTE format(
    'UPDATE match_lineups
        SET %I = $1,
            %I = $2,
            swap_position = NULL,
            swap_new_player_id = NULL,
            swap_new_player_handicap = NULL,
            swap_requested_at = NULL,
            swap_requested_by_member_id = NULL,
            swap_last_resolution = $3
      WHERE id = $4',
    'player' || v_lineup.swap_position || '_id',
    'player' || v_lineup.swap_position || '_handicap'
  ) USING v_lineup.swap_new_player_id,
          v_lineup.swap_new_player_handicap,
          p_resolution,
          p_lineup_id;

  -- Write 2: cascade the new player into this team's UNPLAYED games only
  -- (winner_player_id IS NULL). Played games keep the original player.
  IF v_old_player_id IS NOT NULL AND v_lineup.swap_new_player_id IS NOT NULL THEN
    EXECUTE format(
      'UPDATE match_games SET %I = $1
         WHERE match_id = $2 AND %I = $3 AND winner_player_id IS NULL',
      v_player_field, v_player_field
    ) USING v_lineup.swap_new_player_id, v_match_id, v_old_player_id;
  END IF;

  -- Write 3: apply the recomputed thresholds (JSON null -> SQL NULL).
  UPDATE matches
  SET
    home_to_win  = NULLIF(p_thresholds->>'home_to_win',  'null')::INT,
    home_to_tie  = NULLIF(p_thresholds->>'home_to_tie',  'null')::INT,
    home_to_lose = NULLIF(p_thresholds->>'home_to_lose', 'null')::INT,
    away_to_win  = NULLIF(p_thresholds->>'away_to_win',  'null')::INT,
    away_to_tie  = NULLIF(p_thresholds->>'away_to_tie',  'null')::INT,
    away_to_lose = NULLIF(p_thresholds->>'away_to_lose', 'null')::INT
  WHERE id = v_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION swap_player_in_lineup(UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION swap_player_in_lineup(UUID, JSONB, JSONB) IS
'Atomically resolve an approved mid-match lineup swap: apply the new player at
its position, cascade the new player into UNPLAYED match_games only, write the
recomputed thresholds, and stamp swap_last_resolution — all in one transaction.
Guards (data-integrity only, NOT identity): pending swap exists (FOR UPDATE, no
double-approve), match in_progress, outgoing player has no completed games.
Mirrors prep_match. Thresholds are composed client-side and passed in
p_thresholds. Access is gated in the UI, not here (any scorekeeper may call).';
