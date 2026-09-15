-- Migration: Tournament paid foundation — Phase C, Unit C1 (hopper read RPC)
--
-- get_bracket_hopper(bracket_id) — the organizer's read of the candidate pool,
-- with each registered player's member fields joined for display + same-name
-- disambiguation (nickname, player number, home). A SECURITY DEFINER,
-- column-projected RPC (the read boundary while RLS is off), mirroring
-- get_bracket_share's shape.
--
-- AUTHZ: authenticated-only (revoke anon). The strict caller = brackets.created_by
-- check is deferred to the pre-launch RLS pass, consistent with the free-tier
-- write RPCs — see PRE_LAUNCH_CHECKLIST.md.

CREATE OR REPLACE FUNCTION "public"."get_bracket_hopper"("p_bracket_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT jsonb_agg(
           jsonb_build_object(
             'id', h.id,
             'member_id', h.member_id,
             'display_name', h.display_name,
             'status', h.status,
             'paid_status', h.paid_status,
             'added_via', h.added_via,
             'seed', h.seed,
             'created_at', h.created_at,
             -- Registered player's member fields for display + disambiguation
             -- (null for walk-ups).
             'nickname', m.nickname,
             'first_name', m.first_name,
             'last_name', m.last_name,
             'system_player_number', m.system_player_number,
             'city', m.city,
             'state', m.state
           ) ORDER BY h.created_at
         )
    INTO v_rows
    FROM bracket_hopper h
    LEFT JOIN members m ON m.id = h.member_id
   WHERE h.bracket_id = p_bracket_id;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

-- Authenticated-only: the hopper carries player PII (names, numbers, home), so
-- it is NOT an anon surface (unlike the names-only public share view).
REVOKE EXECUTE ON FUNCTION "public"."get_bracket_hopper"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bracket_hopper"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_bracket_hopper"("uuid") IS
  'Organizer read of a bracket''s hopper (candidates) with registered players'' member fields joined for display/disambiguation. SECURITY DEFINER, authenticated-only; caller=created_by authz deferred to the RLS pass. See docs/plans/2026-09-04-001.';
