-- Onboarding cold-start cascade — Unit 3: the secure join-request submit.
--
-- request_team_join(token, claimed_member_id?) is the ONLY way the /join page
-- creates a team_join_requests row. It is SECURITY DEFINER and derives the two
-- trust-sensitive values server-side:
--   * requested_by_user_id := auth.uid()      (never client input)
--   * team_id              := resolved from the token (never client input)
-- so a forwarded link / spoofed body can't file a request as someone else or
-- against a team the caller never opened. It also pre-checks the guard states
-- (not signed in / invalid token / no profile yet / already on the team /
-- already waiting / roster full / bad-or-taken claim) and returns a friendly
-- {ok, reason, status} the page maps to copy — rather than leaking a raw
-- constraint error. The two partial-unique indexes from Unit 1 remain the
-- last-line race backstop.
--
-- See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).

CREATE OR REPLACE FUNCTION "public"."request_team_join"(
  "p_token" "uuid",
  "p_claimed_member_id" "uuid" DEFAULT NULL
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_team      teams%ROWTYPE;
  v_member_id uuid;
  v_active    int;
  v_request   team_join_requests%ROWTYPE;
BEGIN
  -- Must be signed in: the request is keyed to the caller's identity.
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Resolve the team from the token (not from the client).
  SELECT * INTO v_team FROM teams t WHERE t.join_token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;

  -- The caller must already be a registered member (the page sends them
  -- through the short profile form first; this is the server-side guard).
  SELECT m.id INTO v_member_id
    FROM members m
   WHERE m.user_id = v_user
   LIMIT 1;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_member');
  END IF;

  -- Already on this team → nothing to request.
  IF EXISTS (
    SELECT 1 FROM team_players tp
     WHERE tp.team_id = v_team.id
       AND tp.member_id = v_member_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member');
  END IF;

  -- Already has a live request here → surface its state (idempotent for the
  -- "I tapped the link again" case; the page shows "waiting" / "you're in").
  SELECT * INTO v_request
    FROM team_join_requests jr
   WHERE jr.team_id = v_team.id
     AND jr.requested_by_user_id = v_user
     AND jr.status IN ('pending', 'approved')
   ORDER BY jr.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', v_request.status = 'pending',
      'reason', CASE v_request.status WHEN 'pending' THEN 'already_pending'
                                       ELSE 'already_approved' END,
      'status', v_request.status,
      'request_id', v_request.id
    );
  END IF;

  IF p_claimed_member_id IS NOT NULL THEN
    -- Claiming a specific spot: it must be an unclaimed placeholder ON THIS
    -- team (a team_players row whose member has no user account yet).
    IF NOT EXISTS (
      SELECT 1 FROM team_players tp
        JOIN members m ON m.id = tp.member_id
       WHERE tp.team_id = v_team.id
         AND tp.member_id = p_claimed_member_id
         AND m.user_id IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_claim');
    END IF;

    -- Someone else already has a pending claim on this spot (per-spot guard).
    IF EXISTS (
      SELECT 1 FROM team_join_requests jr
       WHERE jr.team_id = v_team.id
         AND jr.claimed_member_id = p_claimed_member_id
         AND jr.status = 'pending'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'spot_taken');
    END IF;
  ELSE
    -- Self-add (no claim): there must be room. A claim, by contrast, reuses an
    -- existing placeholder spot, so it's allowed even when nominally "full".
    SELECT count(*) INTO v_active
      FROM team_players tp
     WHERE tp.team_id = v_team.id
       AND tp.status = 'active';
    IF v_team.roster_size IS NOT NULL AND v_active >= v_team.roster_size THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'full');
    END IF;
  END IF;

  -- File the request. The partial-unique indexes are the last-line race
  -- backstop if two submits interleave past the pre-checks above.
  BEGIN
    INSERT INTO team_join_requests
      (team_id, requested_by_user_id, requested_member_id, claimed_member_id)
    VALUES
      (v_team.id, v_user, v_member_id, p_claimed_member_id)
    RETURNING * INTO v_request;
  EXCEPTION WHEN unique_violation THEN
    -- A concurrent submit won the race; report the same friendly states.
    RETURN jsonb_build_object('ok', false, 'reason',
      CASE WHEN p_claimed_member_id IS NOT NULL THEN 'spot_taken'
           ELSE 'already_pending' END);
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'submitted',
    'status', 'pending',
    'request_id', v_request.id
  );
END;
$$;

-- Signed-in callers only — the request is identity-keyed.
GRANT EXECUTE ON FUNCTION "public"."request_team_join"("uuid", "uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."request_team_join"("uuid", "uuid") IS
  'Onboarding cascade (Unit 3): file a pending team_join_request from a shared link. Derives requested_by_user_id from auth.uid() and team_id from the token (never client input); returns {ok, reason, status, request_id} covering the guard states. See docs/plans/2026-05-29-001.';
