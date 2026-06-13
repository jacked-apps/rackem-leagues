-- Approve surface, richer cards — data layer.
--
-- The "Join requests" approve cards (captain + LO) need enough context to answer
-- the door at scale. Two additive reads:
--
-- 1. get_join_requests_for_approver() gains a per-request CAPTAIN SUMMARY:
--    captain_name + captain_is_placeholder. Lets the collapsed card flag "this
--    team's captain spot is still open" WITHOUT a per-team fetch — every team
--    always has a captain, so captain_id is populated; the only question is
--    whether that captain is still an unregistered placeholder.
--
-- 2. get_team_roster_for_approver(team_id) — NEW — returns a team's FULL roster
--    (registered members as recognition context + placeholder spots as the
--    tap-to-connect replacement targets), each marked. Fetched only when a card
--    is expanded, so the collapsed list stays light. Same captain-OR-org-staff
--    gate as get_team_placeholders_for_claim — anyone else gets an empty list.
--
-- Both are additive; existing output/scoping is unchanged (the feed keeps
-- league_id + the captain-OR-org-staff scope from 20260611120000).
--
-- See docs/plans/2026-06-11-003-feat-onboarding-approve-surface-plan.md (Unit 1).

-- 1) Feed + captain summary -------------------------------------------------

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
               -- Captain summary: the name always resolves (a team can't exist
               -- without a captain); captain_is_placeholder is true while that
               -- captain has no user account yet — the "seat the captain" signal.
               'captain_name', member_display_name(t.captain_id),
               'captain_is_placeholder', EXISTS (
                 SELECT 1 FROM members mc
                  WHERE mc.id = t.captain_id AND mc.user_id IS NULL
               ),
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
  'Onboarding cascade: pending join requests across every team the caller can approve (captain OR org staff), with person + team + league labels, league_id, and a captain summary (captain_name + captain_is_placeholder). De-duplicated. See docs/plans/2026-06-11-003.';

-- 2) Full roster for the expanded card --------------------------------------

CREATE OR REPLACE FUNCTION "public"."get_team_roster_for_approver"("p_team_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_actor   uuid;
  v_org     uuid;
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

  -- Captain OR org staff, else nothing (mirrors get_team_placeholders_for_claim).
  IF NOT (
    (v_captain IS NOT NULL AND v_captain = v_actor)
    OR EXISTS (SELECT 1 FROM organization_staff os
                WHERE os.organization_id = v_org AND os.member_id = v_actor)
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Whole roster, captain first, then other open placeholders, then registered
  -- members — so the card surfaces the connect targets (captain especially)
  -- ahead of the already-registered recognition context.
  --
  -- The captain is authoritatively teams.captain_id — NOT necessarily a
  -- team_players row (a freshly-seeded team can have its captain only in
  -- teams.captain_id). We UNION the captain in so the "seat the captain" target
  -- always appears, and the member-id UNION de-dupes both the captain-also-in-
  -- team_players case and a member carried across multiple seasons.
  RETURN COALESCE((
    WITH roster_members AS (
      SELECT tp.member_id FROM team_players tp WHERE tp.team_id = p_team_id
      UNION
      SELECT v_captain WHERE v_captain IS NOT NULL
    )
    SELECT jsonb_agg(
             jsonb_build_object(
               'member_id', m.id,
               'display_name', member_display_name(m.id),
               'is_captain', (m.id = v_captain),
               'is_registered', (m.user_id IS NOT NULL),
               'claimable', (m.user_id IS NULL),
               'has_stats', placeholder_has_stats(m.id)
             )
             ORDER BY (m.id = v_captain) DESC,
                      (m.user_id IS NULL) DESC,
                      m.first_name, m.last_name
           )
      FROM roster_members rm
      JOIN members m ON m.id = rm.member_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."get_team_roster_for_approver"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_team_roster_for_approver"("uuid") IS
  'Approve surface: a team''s full roster (registered members + claimable placeholders), each marked is_captain/is_registered/claimable/has_stats, captain first. Captain/org-staff gated. See docs/plans/2026-06-11-003.';
