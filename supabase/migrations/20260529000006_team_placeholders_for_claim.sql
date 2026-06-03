-- Onboarding cold-start cascade — Unit 5: the Replace picker's data.
--
-- get_team_placeholders_for_claim(team_id) returns a team's unclaimed
-- placeholder spots (team_players whose member has no user account yet), each
-- flagged with whether it carries a match record (placeholder_has_stats) so the
-- approver sees "Jon Smyth · has record" before an irreversible merge — the
-- guard that stops a misspelled placeholder's history from being stranded.
--
-- Gated to the team's captain OR its org staff (same authz as the approve
-- engine); anyone else gets an empty list.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).

CREATE OR REPLACE FUNCTION "public"."get_team_placeholders_for_claim"("p_team_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_actor  uuid;
  v_org    uuid;
  v_captain uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT id INTO v_actor FROM members WHERE user_id = v_user LIMIT 1;
  IF v_actor IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT t.captain_id, l.organization_id
    INTO v_captain, v_org
    FROM teams t JOIN leagues l ON l.id = t.league_id
   WHERE t.id = p_team_id;

  -- Captain OR org staff, else nothing.
  IF NOT (
    (v_captain IS NOT NULL AND v_captain = v_actor)
    OR EXISTS (SELECT 1 FROM organization_staff os
                WHERE os.organization_id = v_org AND os.member_id = v_actor)
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'member_id', m.id,
               'display_name', member_display_name(m.id),
               'has_stats', placeholder_has_stats(m.id)
             )
             ORDER BY m.first_name, m.last_name
           )
      FROM team_players tp
      JOIN members m ON m.id = tp.member_id
     WHERE tp.team_id = p_team_id
       AND m.user_id IS NULL
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_team_placeholders_for_claim"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_team_placeholders_for_claim"("uuid") IS
  'Onboarding cascade (Unit 5): a team''s unclaimed placeholders + has_stats record flag, for the Replace picker. Captain/org-staff gated. See docs/plans/2026-05-29-001.';
