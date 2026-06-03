-- Onboarding cold-start cascade — Unit 5: the approver's request feed.
--
-- get_join_requests_for_approver() returns every PENDING join request across
-- the teams the caller may approve — teams they captain OR teams in an org they
-- staff — as one de-duplicated list (each request is a single row; the OR only
-- gates inclusion, so an LO who also captains a team in their own org never
-- sees a request twice). It's the read behind both the approve surface (the
-- list, Unit 5) and the doorbell count (Unit 6).
--
-- Two small STABLE helpers (league_display_name / member_display_name) compose
-- the display strings so the feed and any future caller share one definition.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 5).

-- Compose a league's display name: "{Day} {Game-type}{ - Division}".
-- day_of_week is a lowercase day NAME; game_type "eight_ball" → "Eight-ball".
CREATE OR REPLACE FUNCTION "public"."league_display_name"("p_league_id" "uuid")
RETURNS "text"
LANGUAGE "sql"
STABLE
AS $$
  SELECT NULLIF(
           trim(
             initcap(COALESCE(l.day_of_week, '')) || ' ' ||
             CASE WHEN COALESCE(l.game_type, '') <> '' THEN
               upper(left(replace(l.game_type, '_', '-'), 1)) ||
               substr(replace(l.game_type, '_', '-'), 2)
             ELSE '' END
           ),
           ''
         )
         || CASE WHEN COALESCE(l.division, '') <> ''
                 THEN ' - ' || l.division ELSE '' END
  FROM leagues l
  WHERE l.id = p_league_id;
$$;

-- A member's display label — nickname first, then first+last (no contact info).
CREATE OR REPLACE FUNCTION "public"."member_display_name"("p_member_id" "uuid")
RETURNS "text"
LANGUAGE "sql"
STABLE
AS $$
  SELECT COALESCE(
           NULLIF(trim(m.nickname), ''),
           NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
           'Player'
         )
  FROM members m
  WHERE m.id = p_member_id;
$$;

-- The approver's pending-request feed (captain OR org staff scope).
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
               'league_name', league_display_name(t.league_id),
               'requester_member_id', jr.requested_member_id,
               'requester_name', member_display_name(jr.requested_member_id),
               'claimed_member_id', jr.claimed_member_id,
               'claimed_name', member_display_name(jr.claimed_member_id),
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

GRANT EXECUTE ON FUNCTION "public"."get_join_requests_for_approver"() TO "authenticated";

COMMENT ON FUNCTION "public"."get_join_requests_for_approver"() IS
  'Onboarding cascade (Unit 5): pending join requests across every team the caller can approve (captain OR org staff), de-duplicated, with person + team + league labels. Backs the approve surface and the doorbell count. See docs/plans/2026-05-29-001.';
