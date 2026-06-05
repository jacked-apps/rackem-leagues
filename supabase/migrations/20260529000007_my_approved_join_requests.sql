-- Onboarding cold-start cascade — Unit 3 (notify-on-approval).
--
-- After a captain/LO approves a join request, the joiner — who may have closed
-- the tab or switched devices — needs to learn they're in. We reuse the
-- poll-and-popup PATTERN (like get_my_pending_invites) but NOT that RPC, which
-- is bound to invite_tokens. These two functions feed a sibling modal:
--
--   get_my_approved_join_requests() — the caller's approved-but-unacknowledged
--     requests, with team + league labels.
--   acknowledge_join_request(id)    — stamps acknowledged_at so the modal shows
--     once and never again.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).

CREATE OR REPLACE FUNCTION "public"."get_my_approved_join_requests"()
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
             jsonb_build_object(
               'request_id', jr.id,
               'team_id', t.id,
               'team_name', t.team_name,
               'league_name', league_display_name(t.league_id)
             )
             ORDER BY jr.resolved_at
           )
      FROM team_join_requests jr
      JOIN teams t ON t.id = jr.team_id
     WHERE jr.requested_by_user_id = v_user
       AND jr.status = 'approved'
       AND jr.acknowledged_at IS NULL
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_my_approved_join_requests"() TO "authenticated";

COMMENT ON FUNCTION "public"."get_my_approved_join_requests"() IS
  'Onboarding cascade (Unit 3 notify): the caller''s approved-but-unacknowledged join requests + team/league labels, for the "you''re in" popup. See docs/plans/2026-05-29-001.';

-- Stamp acknowledged_at so the "you're in" popup shows once. Scoped to the
-- caller's own request via auth.uid().
CREATE OR REPLACE FUNCTION "public"."acknowledge_join_request"("p_request_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  UPDATE team_join_requests
     SET acknowledged_at = now()
   WHERE id = p_request_id
     AND requested_by_user_id = v_user
     AND acknowledged_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_count > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."acknowledge_join_request"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."acknowledge_join_request"("uuid") IS
  'Onboarding cascade (Unit 3 notify): mark an approved join request acknowledged (own request only) so the "you''re in" popup shows once. See docs/plans/2026-05-29-001.';
