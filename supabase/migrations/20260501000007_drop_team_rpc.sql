-- Migration: drop_team RPC
-- Purpose: Atomic, idempotent operator action that withdraws an active team
-- mid-season, clears its roster, creates a fresh bye row to absorb its
-- future matches, forfeits any past-due ones the bye now owns, and
-- revokes pending invites.
--
-- Mirrors the structure of undo_merge_placeholder_rpc (full RPC pattern
-- with structured success/error returns) and uses the FOR UPDATE row-lock
-- idempotency pattern from the invite_tokens RPC.
--
-- Body steps:
--   0. Authorization gate (auth.uid() → org_staff for the team's org)
--   1. SELECT FOR UPDATE on the team row
--   2. Idempotency: refuse if status != 'active'
--   3. UPDATE team: status='withdrawn', withdrawn_at=NOW()
--   4. UPDATE team_players for the team: status='dropped' (preserves
--      individual_wins/losses/skill history; existing
--      team_players_status_check already supports 'dropped')
--   5. INSERT new bye-team row with descriptive name encoding which
--      team it replaced and the current week number
--   6. UPDATE matches WHERE team is home/away AND status IN
--      ('scheduled','postponed'): reassign to the new bye row.
--      Existing trigger_sync_match_lineups_on_update propagates the
--      team_id change to match_lineups in-place — no separate
--      match_lineups DDL needed.
--   7. CALL forfeit_past_bye_matches(season, team_filter=team_id) so
--      past-due matches that were just reassigned get marked
--      status='completed' with the active opponent credited as winner.
--   8. UPDATE invite_tokens for the dropped team: status='cancelled'
--      (already-claimed invites stay claimed — those players are real
--      registered users, just no longer on the team).
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (PR 2 Unit 2.2)

CREATE OR REPLACE FUNCTION drop_team(
  p_team_id UUID,
  p_actor_member_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  new_bye_team_id UUID,
  matches_reassigned INTEGER,
  matches_forfeited INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_member_id UUID;
  v_team RECORD;
  v_org_id UUID;
  v_authorized BOOLEAN;
  v_new_bye_id UUID;
  v_old_team_name TEXT;
  v_current_week_number INTEGER;
  v_bye_name TEXT;
  v_reassigned_count INTEGER := 0;
  v_home_count INTEGER := 0;
  v_away_count INTEGER := 0;
  v_forfeited_count INTEGER := 0;
BEGIN
  -- Step 0: authorization gate. Derive caller's member_id from auth.uid()
  -- (so a malicious client can't pass someone else's UUID as
  -- p_actor_member_id and impersonate them). Then verify org_staff role.
  SELECT id INTO v_actor_member_id
  FROM members
  WHERE user_id = auth.uid();

  IF v_actor_member_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Not authenticated'::TEXT;
    RETURN;
  END IF;

  IF v_actor_member_id != p_actor_member_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Actor mismatch (impersonation attempt)'::TEXT;
    RETURN;
  END IF;

  -- Find the team's organization via league
  SELECT l.organization_id INTO v_org_id
  FROM teams t
  JOIN leagues l ON l.id = t.league_id
  WHERE t.id = p_team_id;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Team not found or has no league/organization'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM organization_staff os
    WHERE os.member_id = v_actor_member_id
      AND os.organization_id = v_org_id
      AND os.position IN ('owner', 'admin')
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Not authorized to drop this team'::TEXT;
    RETURN;
  END IF;

  -- Step 1: lock the team row
  SELECT * INTO v_team
  FROM teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 0, 'Team not found'::TEXT;
    RETURN;
  END IF;

  -- Step 2: idempotency
  IF v_team.status != 'active' THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::UUID,
      0,
      0,
      ('Team already ' || v_team.status || ' — cannot drop')::TEXT;
    RETURN;
  END IF;

  v_old_team_name := v_team.team_name;

  -- Compute current week number: count regular weeks in this season whose
  -- date has already passed. 1-indexed.
  SELECT COUNT(*) INTO v_current_week_number
  FROM season_weeks
  WHERE season_id = v_team.season_id
    AND week_type = 'regular'
    AND scheduled_date <= CURRENT_DATE;

  v_current_week_number := GREATEST(v_current_week_number, 1);
  v_bye_name := 'BYE — replaced ' || v_old_team_name || ' wk ' || v_current_week_number;

  -- Step 3: mark team withdrawn
  UPDATE teams
  SET status = 'withdrawn',
      withdrawn_at = NOW(),
      updated_at = NOW()
  WHERE id = p_team_id;

  -- Step 4: clear roster (preserves stats, just changes status)
  UPDATE team_players
  SET status = 'dropped',
      updated_at = NOW()
  WHERE team_id = p_team_id
    AND status = 'active';

  -- Step 5: create the new bye row to absorb future matches
  INSERT INTO teams (
    season_id,
    league_id,
    captain_id,
    team_name,
    roster_size,
    status,
    home_venue_id
  ) VALUES (
    v_team.season_id,
    v_team.league_id,
    NULL,
    v_bye_name,
    v_team.roster_size,
    'bye',
    NULL
  ) RETURNING id INTO v_new_bye_id;

  -- Step 6: reassign scheduled+postponed matches to the bye row.
  -- The existing trigger_sync_match_lineups_on_update propagates each
  -- team_id change to match_lineups automatically.
  UPDATE matches
  SET home_team_id = v_new_bye_id,
      updated_at = NOW()
  WHERE home_team_id = p_team_id
    AND status IN ('scheduled', 'postponed');

  GET DIAGNOSTICS v_home_count = ROW_COUNT;

  UPDATE matches
  SET away_team_id = v_new_bye_id,
      updated_at = NOW()
  WHERE away_team_id = p_team_id
    AND status IN ('scheduled', 'postponed');

  GET DIAGNOSTICS v_away_count = ROW_COUNT;

  v_reassigned_count := v_home_count + v_away_count;

  -- Step 7: forfeit past-due matches the bye row now owns
  v_forfeited_count := forfeit_past_bye_matches(v_team.season_id, v_new_bye_id);

  -- Step 8: cancel pending invites for the dropped team. Already-claimed
  -- invites stay claimed (those players are real registered users now).
  UPDATE invite_tokens
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE team_id = p_team_id
    AND status = 'pending';

  RETURN QUERY SELECT
    TRUE,
    v_new_bye_id,
    v_reassigned_count,
    v_forfeited_count,
    NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT
    FALSE,
    NULL::UUID,
    0,
    0,
    ('drop_team failed: ' || SQLERRM)::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION drop_team(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION drop_team(UUID, UUID) IS
'Operator-initiated mid-season team drop. Atomic: marks the team withdrawn, clears the roster (preserves stats via team_players.status=''dropped''), creates a fresh bye row to absorb the team''s future scheduled/postponed matches, forfeits any past-due matches the bye now owns (via forfeit_past_bye_matches with team filter), and cancels pending invites. Idempotent: refuses if the team is already withdrawn. Authorization: caller must be an owner or admin of the team''s organization. Future tracking: this RPC is the natural write-site for the captain flake-flag (LIST_FOR_ED.md item #7) when that ships — add an INSERT into a member_flags table at the end of the success path.';
