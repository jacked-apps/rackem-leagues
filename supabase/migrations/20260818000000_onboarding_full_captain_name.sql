-- ============================================================================
-- Onboarding list: show the captain's FULL name, not their nickname.
-- ============================================================================
--
-- `get_league_teams_for_onboarding` returned `captain_name` via
-- `member_display_name`, which prefers the member's nickname (e.g. "Mike J.").
-- That's right for player-facing surfaces, but on the operator's onboarding
-- admin list the LO needs the captain's real full name to know who each join
-- link is for. Swap that one field to first + last name (falling back to the
-- display name, then 'Player'). Only this RPC's `captain_name` changes.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_league_teams_for_onboarding"("p_league_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_actor uuid;
  v_org   uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Resolve the league's org, then gate on org-staff membership.
  SELECT organization_id INTO v_org FROM leagues WHERE id = p_league_id;
  IF v_org IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_staff os
     WHERE os.organization_id = v_org AND os.member_id = v_actor
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'team_id', t.id,
               'team_name', t.team_name,
               -- Full first + last name for LO identification (was nickname-first
               -- member_display_name). Fall back to the display name, then 'Player'.
               'captain_name', COALESCE(
                 NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
                 member_display_name(t.captain_id),
                 'Player'
               ),
               'join_token', t.join_token
             )
             ORDER BY t.team_name
           )
      FROM teams t
      JOIN members m ON m.id = t.captain_id
     WHERE t.league_id = p_league_id
       AND t.status <> 'bye'
       AND m.user_id IS NULL
  ), '[]'::jsonb);
END;
$$;
