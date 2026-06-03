-- Onboarding cold-start cascade — Unit 7: distribution.
--
--   rotate_team_join_token(team_id)      — regenerate a team's join_token (e.g.
--     the link leaked); already-submitted requests are unaffected (they key on
--     team_id, not the token). Captain/org-staff gated.
--   get_org_teams_for_onboarding(org_id) — one row per team in the org with its
--     assigned captain + the team's join link, so an LO can hand each captain
--     the RIGHT link with no manual matching. Org-staff gated.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 7).

CREATE OR REPLACE FUNCTION "public"."rotate_team_join_token"("p_team_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_actor   uuid;
  v_captain uuid;
  v_org     uuid;
  v_token   uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  SELECT t.captain_id, l.organization_id
    INTO v_captain, v_org
    FROM teams t JOIN leagues l ON l.id = t.league_id
   WHERE t.id = p_team_id;

  IF NOT (
    (v_captain IS NOT NULL AND v_captain = v_actor)
    OR EXISTS (SELECT 1 FROM organization_staff os
                WHERE os.organization_id = v_org AND os.member_id = v_actor)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  UPDATE teams SET join_token = gen_random_uuid()
   WHERE id = p_team_id
   RETURNING join_token INTO v_token;

  RETURN jsonb_build_object('ok', true, 'join_token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."rotate_team_join_token"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."rotate_team_join_token"("uuid") IS
  'Onboarding cascade (Unit 7): regenerate a team join_token (leak rotation); captain/org-staff gated. Submitted requests are unaffected. See docs/plans/2026-05-29-001.';

-- One row per team in the org: team + assigned captain + the join link.
CREATE OR REPLACE FUNCTION "public"."get_org_teams_for_onboarding"("p_org_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_actor uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Org staff only.
  IF NOT EXISTS (
    SELECT 1 FROM organization_staff os
     WHERE os.organization_id = p_org_id AND os.member_id = v_actor
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'team_id', t.id,
               'team_name', t.team_name,
               'league_name', league_display_name(t.league_id),
               'captain_name', member_display_name(t.captain_id),
               'join_token', t.join_token
             )
             ORDER BY league_display_name(t.league_id), t.team_name
           )
      FROM teams t
      JOIN leagues l ON l.id = t.league_id
     WHERE l.organization_id = p_org_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_org_teams_for_onboarding"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_org_teams_for_onboarding"("uuid") IS
  'Onboarding cascade (Unit 7): one row per org team — team + assigned captain + join link — for the LO''s "onboard my captains" list. Org-staff gated. See docs/plans/2026-05-29-001.';
