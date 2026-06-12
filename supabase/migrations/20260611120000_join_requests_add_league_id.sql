-- Add league_id to the approver join-requests feed.
--
-- The "Join requests" approval surface now renders at TWO altitudes: the org
-- Operator Dashboard (every team in the org) AND each League page (only that
-- league's teams). The feed already carried league_name (for display) but not
-- league_id, so the league-page surface had nothing to filter on. This adds
-- league_id to the payload; the client filters by it for the league surface and
-- shows everything on the org surface.
--
-- Pure additive change to the existing function's output — same scoping
-- (captain OR org staff), same rows, one extra field.

CREATE OR REPLACE FUNCTION "public"."get_join_requests_for_approver"()
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

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'request_id', jr.id,
               'team_id', t.id,
               'team_name', t.team_name,
               'league_id', t.league_id,
               'league_name', league_display_name(t.league_id),
               'requester_member_id', jr.requested_member_id,
               'requester_name', member_display_name(jr.requested_member_id),
               'claimed_member_id', jr.claimed_member_id,
               'claimed_name', member_display_name(jr.claimed_member_id),
               'has_open_placeholders', EXISTS (
                 SELECT 1 FROM team_players tp2
                   JOIN members m2 ON m2.id = tp2.member_id
                  WHERE tp2.team_id = t.id AND m2.user_id IS NULL
               ),
               'created_at', jr.created_at
             )
             ORDER BY jr.created_at
           )
      FROM team_join_requests jr
      JOIN teams t ON t.id = jr.team_id
      JOIN leagues l ON l.id = t.league_id
     WHERE jr.status = 'pending'
       AND jr.expires_at > now()
       AND (
         t.captain_id = v_actor
         OR EXISTS (
           SELECT 1 FROM organization_staff os
            WHERE os.organization_id = l.organization_id
              AND os.member_id = v_actor
         )
       )
  ), '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION "public"."get_join_requests_for_approver"() IS
  'Onboarding cascade: pending join requests across every team the caller can approve (captain OR org staff), with person + team + league labels AND league_id (for the per-league approval surface). De-duplicated. See docs/plans/2026-05-29-001.';
