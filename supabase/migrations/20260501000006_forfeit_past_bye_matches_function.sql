-- Migration: forfeit_past_bye_matches helper function
-- Purpose: For past-dated `scheduled` matches against bye/withdrawn teams,
-- write a `completed` forfeit-win result so the standings query (which
-- filters status='completed') picks up the active opponent's win.
--
-- Two callers:
--   1. drop_team RPC (PR 2 Unit 2.2) — passes p_team_filter so only
--      matches just reassigned by this drop get forfeited (drop-scoped).
--   2. "Close Past Byes" operator button (PR 2 Unit 2.8) — passes NULL
--      filter to sweep all original-schedule byes that have aged past
--      their date without being made up.
--
-- Forfeit-write semantics:
--   - status = 'completed' (NOT 'forfeited' — see plan R15 decision: the
--     standings query at src/api/queries/standings.ts:60 filters by
--     'completed', so this is the path that gets the active opponent
--     credited correctly).
--   - winner_team_id = active opponent's team_id.
--   - match_result = 'home_win' or 'away_win' depending on which side is
--     the active opponent.
--   - home_points_earned / away_points_earned = 2.0 for the active
--     opponent, 0 for the bye/withdrawn side. 2.0 is a reasonable default
--     forfeit-win value; adjust as needed once usage patterns settle.
--
-- Bye-vs-bye matches (both sides non-active) are skipped — neither side
-- gets credited.
--
-- Idempotent: matches already 'completed' are not re-touched.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md
--            (Unit 1.7, R15, R15a, R15b)

CREATE OR REPLACE FUNCTION forfeit_past_bye_matches(
  p_season_id UUID,
  p_team_filter UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_member_id UUID;
  v_org_id UUID;
  v_authorized BOOLEAN;
  v_forfeited_count INTEGER := 0;
  v_today DATE;
BEGIN
  -- Authorization gate. Mirror can_write_house_rule_org() pattern.
  -- Resolve the season's organization through league_id, then verify the
  -- caller is an owner or admin.
  SELECT id INTO v_actor_member_id
  FROM members
  WHERE user_id = auth.uid();

  IF v_actor_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT l.organization_id INTO v_org_id
  FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  WHERE s.id = p_season_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Season % not found or has no league/organization', p_season_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM organization_staff os
    WHERE os.member_id = v_actor_member_id
      AND os.organization_id = v_org_id
      AND os.position IN ('owner', 'admin')
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized for season %', p_season_id;
  END IF;

  v_today := CURRENT_DATE;

  -- Walk every scheduled match in the season whose week's date has passed
  -- and where exactly one side is a non-active team (bye or withdrawn).
  -- Skip bye-vs-bye matches (both sides non-active).
  WITH past_bye_matches AS (
    SELECT
      m.id,
      m.home_team_id,
      m.away_team_id,
      m.home_games_to_win,
      m.away_games_to_win,
      ht.status AS home_status,
      at.status AS away_status
    FROM matches m
    JOIN season_weeks sw ON sw.id = m.season_week_id
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE m.season_id = p_season_id
      AND m.status = 'scheduled'
      AND sw.scheduled_date < v_today
      AND (
        (ht.status IN ('bye', 'withdrawn') AND at.status = 'active')
        OR (at.status IN ('bye', 'withdrawn') AND ht.status = 'active')
      )
      -- Drop-scoped filter: only forfeit matches involving the dropped team
      -- when p_team_filter is non-NULL. Otherwise (NULL) sweep all in the season.
      AND (
        p_team_filter IS NULL
        OR m.home_team_id = p_team_filter
        OR m.away_team_id = p_team_filter
      )
  )
  UPDATE matches m
  SET
    status = 'completed',
    -- Winner is the active side
    winner_team_id = CASE
      WHEN pbm.home_status = 'active' THEN pbm.home_team_id
      ELSE pbm.away_team_id
    END,
    match_result = CASE
      WHEN pbm.home_status = 'active' THEN 'home_win'
      ELSE 'away_win'
    END,
    home_points_earned = CASE WHEN pbm.home_status = 'active' THEN 2.0 ELSE 0 END,
    away_points_earned = CASE WHEN pbm.away_status = 'active' THEN 2.0 ELSE 0 END,
    home_team_score = CASE
      WHEN pbm.home_status = 'active' THEN COALESCE(pbm.home_games_to_win, 0)
      ELSE 0
    END,
    away_team_score = CASE
      WHEN pbm.away_status = 'active' THEN COALESCE(pbm.away_games_to_win, 0)
      ELSE 0
    END,
    completed_at = NOW(),
    updated_at = NOW()
  FROM past_bye_matches pbm
  WHERE m.id = pbm.id;

  GET DIAGNOSTICS v_forfeited_count = ROW_COUNT;

  RETURN v_forfeited_count;
END;
$$;

GRANT EXECUTE ON FUNCTION forfeit_past_bye_matches(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION forfeit_past_bye_matches(UUID, UUID) IS
'Forfeits past-due scheduled bye/withdrawn matches by writing status=completed with the active opponent as winner. Pass p_team_filter to scope to a single team''s absorbed matches (used by drop_team RPC); pass NULL to sweep all season-wide past byes (used by the operator''s "Close Past Byes" button). Returns the number of matches forfeited. Bye-vs-bye matches are skipped — neither side is credited. Authorization: caller must be an owner or admin of the season''s organization.';
