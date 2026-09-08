-- Migration: Tournament paid foundation — Phase C, Unit C3 (roster read RPC)
--
-- get_bracket_roster(bracket_id) — the organizer's sticky "past players" list,
-- which is the bottom group of the hopper screen (a one-tap re-add source).
--
-- Two things make this more than a plain select on bracket_roster:
--   1. It joins members so the row can render nickname-primary with the
--      same-name disambiguators (player number + home), exactly like
--      get_bracket_hopper does for candidates.
--   2. It EXCLUDES anyone already in THIS bracket's hopper (waiting or
--      official). "Past players" is an add-source, so a player who has already
--      scanned in or been admitted must drop out of it — otherwise the
--      organizer taps a name that is already in the tournament and hits the
--      UNIQUE(bracket_id, member_id) constraint as an error.
--
-- The organizer is derived from brackets.created_by rather than passed in, so a
-- caller can't ask for someone else's roster by id.
--
-- AUTHZ: authenticated-only (revoke anon) — this carries player PII. The strict
-- caller = brackets.created_by check is deferred to the pre-launch RLS pass,
-- consistent with get_bracket_hopper and the free-tier write RPCs. See
-- PRE_LAUNCH_CHECKLIST.md.

CREATE OR REPLACE FUNCTION "public"."get_bracket_roster"("p_bracket_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_organizer uuid;
  v_rows jsonb;
BEGIN
  SELECT b.created_by INTO v_organizer
    FROM brackets b
   WHERE b.id = p_bracket_id;

  -- Unknown bracket → an empty list, never an error (the hopper screen renders
  -- the other two groups fine without this one).
  IF v_organizer IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'member_id', m.id,
             'nickname', m.nickname,
             'first_name', m.first_name,
             'last_name', m.last_name,
             'system_player_number', m.system_player_number,
             'city', m.city,
             'state', m.state,
             'first_seen_at', r.first_seen_at
           ) ORDER BY COALESCE(m.nickname, m.first_name, ''), m.last_name
         )
    INTO v_rows
    FROM bracket_roster r
    JOIN members m ON m.id = r.player_member_id
   WHERE r.organizer_member_id = v_organizer
     AND NOT EXISTS (
       SELECT 1
         FROM bracket_hopper h
        WHERE h.bracket_id = p_bracket_id
          AND h.member_id = r.player_member_id
     );

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_bracket_roster"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bracket_roster"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_bracket_roster"("uuid") IS
  'The bracket organizer''s sticky past-players roster, joined to members for display and filtered to those NOT already in this bracket''s hopper (it is an add-source). SECURITY DEFINER, authenticated-only; caller=created_by authz deferred to the RLS pass. See docs/plans/2026-09-04-001.';
