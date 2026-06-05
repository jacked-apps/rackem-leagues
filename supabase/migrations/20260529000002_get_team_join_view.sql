-- Onboarding cold-start cascade — Unit 2: the join-view read.
--
-- Resolves a per-team join_token (from Unit 1) into the small, public-safe
-- payload the /join/:token page needs BEFORE the joiner signs in: the team
-- name, a composed league name, the roster size, and the roster "spots" (each
-- flagged open = an unclaimed placeholder, or taken = a real member). It also
-- reports whether the *authenticated* caller already has a pending/approved
-- request here, which drives the page's "you're already waiting" state.
--
-- SECURITY DEFINER + granted to anon: the page is readable pre-auth. With RLS
-- intentionally off project-wide until launch, THIS FUNCTION IS THE BOUNDARY —
-- it is column-projected to display NAMES ONLY (no email/phone/address), so a
-- forwarded link never leaks contact info. Roster names are accepted as
-- shareable-within-team per the plan's design.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 2).

CREATE OR REPLACE FUNCTION "public"."get_team_join_view"("p_token" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_team        teams%ROWTYPE;
  v_league      leagues%ROWTYPE;
  v_league_name text;
  v_game_type   text;
  v_day_name    text;
  v_spots       jsonb;
  v_status      text;
BEGIN
  -- Invalid / unknown token → a clean "not found" the page renders as an
  -- invalid-link state (never an error).
  SELECT * INTO v_team FROM teams t WHERE t.join_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_league FROM leagues l WHERE l.id = v_team.league_id;

  -- Compose the league display name: "{Day} {Game-type}{ - Division}".
  -- day_of_week is stored as a lowercase day NAME ("tuesday") → capitalize it;
  -- game_type "eight_ball" → "Eight-ball"; division optional.
  v_day_name := initcap(COALESCE(v_league.day_of_week, ''));
  v_game_type := replace(COALESCE(v_league.game_type, ''), '_', '-');
  IF v_game_type <> '' THEN
    v_game_type := upper(left(v_game_type, 1)) || substr(v_game_type, 2);
  END IF;
  v_league_name := NULLIF(trim(v_day_name || ' ' || v_game_type), '')
    || CASE WHEN COALESCE(v_league.division, '') <> ''
            THEN ' - ' || v_league.division ELSE '' END;

  -- Roster spots: every team_players row, name only, flagged open (an unclaimed
  -- placeholder = member.user_id IS NULL) vs. taken (a registered member).
  -- Nickname is the display primary; fall back to first+last.
  SELECT jsonb_agg(
           jsonb_build_object(
             'member_id', m.id,
             'display_name', COALESCE(
               NULLIF(trim(m.nickname), ''),
               NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
               'Open spot'
             ),
             'is_open', (m.user_id IS NULL)
           )
           ORDER BY (m.user_id IS NULL) DESC, m.first_name, m.last_name
         )
    INTO v_spots
    FROM team_players tp
    JOIN members m ON m.id = tp.member_id
   WHERE tp.team_id = v_team.id;

  -- Does the signed-in caller already have a live request here? (auth.uid() is
  -- readable inside a DEFINER fn; NULL for an anonymous pre-auth read.)
  SELECT jr.status INTO v_status
    FROM team_join_requests jr
   WHERE jr.team_id = v_team.id
     AND jr.requested_by_user_id = auth.uid()
     AND jr.status IN ('pending', 'approved')
   ORDER BY jr.created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'team_id', v_team.id,
    'team_name', v_team.team_name,
    'league_name', v_league_name,
    'roster_size', v_team.roster_size,
    'spots', COALESCE(v_spots, '[]'::jsonb),
    'viewer_request_status', v_status
  );
END;
$$;

-- Pre-auth readable: the join page resolves the token before sign-in.
GRANT EXECUTE ON FUNCTION "public"."get_team_join_view"("uuid") TO "anon", "authenticated";

COMMENT ON FUNCTION "public"."get_team_join_view"("uuid") IS
  'Onboarding cascade (Unit 2): resolve a team join_token to {found, team_id, team_name, league_name, roster_size, spots[], viewer_request_status}. Names only — the authorization boundary while RLS is off. See docs/plans/2026-05-29-001.';
