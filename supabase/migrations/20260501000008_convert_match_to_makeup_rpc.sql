-- Migration: convert_match_to_makeup RPC
-- Purpose: Single-match operator action that turns a forfeited (or
-- still-scheduled past-due) bye match into a playable makeup match
-- between two real teams.
--
-- Called from the schedule editor when an LO and the affected captains
-- agree to actually play a week that would otherwise stay as a forfeit.
--
-- Validation guards:
--   - Match must currently be in a state where the result hasn't been
--     "locked" by real play: status IN ('forfeited', 'scheduled', 'postponed').
--     Rejects 'completed', 'awaiting_verification', 'in_progress'.
--   - The side being replaced must currently reference a bye/withdrawn team.
--   - The new team must be 'active' and in the same season.
--   - No match_games rows with non-NULL scores can exist for this match
--     (defense-in-depth — a real played match should never reach this RPC).
--
-- After validation, the RPC:
--   - Updates the side's team_id (existing
--     trigger_sync_match_lineups_on_update propagates to match_lineups
--     in-place; no separate lineup DDL needed).
--   - Resets status to 'scheduled' (regardless of prior state).
--   - Clears home/away_points_earned, home/away_team_score,
--     winner_team_id, match_result, completed_at — so the standings
--     query no longer credits a forfeit win, and the match plays like
--     any other scheduled match.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (PR 2 Unit 2.3, R15b, R17)

CREATE OR REPLACE FUNCTION convert_match_to_makeup(
  p_match_id UUID,
  p_new_team_id UUID,
  p_side TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_member_id UUID;
  v_match RECORD;
  v_new_team RECORD;
  v_org_id UUID;
  v_authorized BOOLEAN;
  v_existing_side_team_id UUID;
  v_existing_side_status TEXT;
  v_match_games_with_scores INTEGER;
BEGIN
  IF p_side NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'p_side must be ''home'' or ''away'', got %', p_side;
  END IF;

  -- Step 0: authorization gate
  SELECT id INTO v_actor_member_id
  FROM members
  WHERE user_id = auth.uid();

  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve the match's organization via season → league
  SELECT l.organization_id INTO v_org_id
  FROM matches m
  JOIN seasons s ON s.id = m.season_id
  JOIN leagues l ON l.id = s.league_id
  WHERE m.id = p_match_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Match % not found or has no organization', p_match_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM organization_staff os
    WHERE os.member_id = v_actor_member_id
      AND os.organization_id = v_org_id
      AND os.position IN ('owner', 'admin')
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized for this match';
  END IF;

  -- Load the match (no FOR UPDATE here — single-match conversion is
  -- low-contention enough; if races become a concern we can add a lock).
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id;

  -- Match-status guard: reject results-bearing matches even if their
  -- team is now withdrawn. Without this check, an LO could accidentally
  -- wipe a real played result by picking the wrong match.
  IF v_match.status NOT IN ('forfeited', 'scheduled', 'postponed') THEN
    RAISE EXCEPTION 'Match status is %, can only convert from forfeited/scheduled/postponed', v_match.status;
  END IF;

  -- Defense-in-depth: refuse if any game scores already exist.
  SELECT COUNT(*) INTO v_match_games_with_scores
  FROM match_games
  WHERE match_id = p_match_id
    AND (home_score IS NOT NULL OR away_score IS NOT NULL);

  IF v_match_games_with_scores > 0 THEN
    RAISE EXCEPTION 'Match has % game(s) with recorded scores; cannot convert to makeup', v_match_games_with_scores;
  END IF;

  -- Validate the side being replaced
  IF p_side = 'home' THEN
    v_existing_side_team_id := v_match.home_team_id;
  ELSE
    v_existing_side_team_id := v_match.away_team_id;
  END IF;

  SELECT status INTO v_existing_side_status
  FROM teams
  WHERE id = v_existing_side_team_id;

  IF v_existing_side_status NOT IN ('bye', 'withdrawn') THEN
    RAISE EXCEPTION 'The % side''s current team is %, can only replace bye/withdrawn sides', p_side, v_existing_side_status;
  END IF;

  -- Validate the new team
  SELECT * INTO v_new_team
  FROM teams
  WHERE id = p_new_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New team % not found', p_new_team_id;
  END IF;

  IF v_new_team.status != 'active' THEN
    RAISE EXCEPTION 'New team status must be active, got %', v_new_team.status;
  END IF;

  IF v_new_team.season_id != v_match.season_id THEN
    RAISE EXCEPTION 'New team is in a different season';
  END IF;

  -- Apply the conversion. The side's team_id flips, status resets to
  -- scheduled, and any forfeit-write fields clear.
  IF p_side = 'home' THEN
    UPDATE matches
    SET home_team_id = p_new_team_id,
        status = 'scheduled',
        winner_team_id = NULL,
        match_result = NULL,
        home_team_score = NULL,
        away_team_score = NULL,
        home_points_earned = 0,
        away_points_earned = 0,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = p_match_id;
  ELSE
    UPDATE matches
    SET away_team_id = p_new_team_id,
        status = 'scheduled',
        winner_team_id = NULL,
        match_result = NULL,
        home_team_score = NULL,
        away_team_score = NULL,
        home_points_earned = 0,
        away_points_earned = 0,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = p_match_id;
  END IF;

  -- match_lineups team_id propagation handled by
  -- trigger_sync_match_lineups_on_update.
END;
$$;

GRANT EXECUTE ON FUNCTION convert_match_to_makeup(UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION convert_match_to_makeup(UUID, UUID, TEXT) IS
'Converts a forfeited or unplayed bye match into a playable makeup match. Replaces the bye/withdrawn side with a real active team, resets status to scheduled, and clears any forfeit-write fields so the standings query no longer credits a forfeit win. Validates that the match is not already results-bearing (status not in completed/awaiting_verification/in_progress) and that no match_games rows with scores exist. Authorization: caller must be an owner or admin of the match''s organization.';
