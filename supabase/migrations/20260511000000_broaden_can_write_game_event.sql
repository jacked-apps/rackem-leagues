-- ============================================================================
-- BRANCH B PHASE 1 FOLLOWUP — broaden can_write_game_event scorer branch
-- ============================================================================
--
-- The original Branch B Phase 1 implementation of `can_write_game_event`
-- gated the scorer branch on "is the caller on the locked match lineup?"
-- That excluded a legitimate scorer pattern: captains who score for their
-- team while not personally playing in this match's 3-player or 5-player
-- lineup (they're running the book from the sideline).
--
-- The 3v3 format makes this collision common: a 7-player roster picks 3 to
-- play, so 4 out of 7 roster members — including the captain who isn't
-- one of the 3 — would be blocked from scoring under the old check.
--
-- Pre-Branch-B behavior: match_games had no RLS at all, so anyone
-- authenticated could write. This migration broadens the scorer branch to
-- match the historical-but-undocumented practice: any active roster
-- member of either team in the match can write events. Captains and
-- bench members both pass; non-roster members and other-league players
-- are still blocked. The org-admin branch is unchanged.
--
-- See plan: docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md
-- ============================================================================

CREATE OR REPLACE FUNCTION can_write_game_event(target_game_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_match_id UUID;
  v_org_id UUID;
  v_caller_member_id UUID;
  v_home_team_id UUID;
  v_away_team_id UUID;
  v_season_id UUID;
BEGIN
  IF target_game_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Resolve match + org + team context from the game.
  SELECT mg.match_id, mt.home_team_id, mt.away_team_id, mt.season_id, l.organization_id
    INTO v_match_id, v_home_team_id, v_away_team_id, v_season_id, v_org_id
    FROM match_games mg
    JOIN matches mt ON mt.id = mg.match_id
    JOIN seasons s ON s.id = mt.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE mg.id = target_game_id;

  IF v_match_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT id INTO v_caller_member_id
    FROM members
    WHERE user_id = auth.uid();

  IF v_caller_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Branch (a): active roster member of either team in this match.
  -- Captains scoring from the bench, players on the lineup, and
  -- non-playing rostered members all pass. Other-league players and
  -- non-roster members are blocked.
  IF EXISTS (
    SELECT 1
      FROM team_players tp
      WHERE tp.team_id IN (v_home_team_id, v_away_team_id)
        AND tp.season_id = v_season_id
        AND tp.member_id = v_caller_member_id
        AND tp.status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Branch (b): owner/admin of the league's organization.
  IF EXISTS (
    SELECT 1
      FROM organization_staff os
      WHERE os.member_id = v_caller_member_id
        AND os.organization_id = v_org_id
        AND os.position IN ('owner', 'admin')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION can_write_game_event(UUID) IS
  'True iff the caller is an active roster member of either team in the match OR is owner/admin of the league''s organization. The roster-member check covers captains scoring from the bench AND players on the active lineup. league_rep is excluded from the org-admin branch.';
