-- Migration: Tournament paid foundation — organizer search-add
--
-- add_registered_to_hopper(bracket_id, member_id) — the organizer picks a
-- registered player out of search and puts them in the waiting room.
--
-- WHY AN RPC RATHER THAN A CLIENT INSERT: the display name has to be derived
-- the SAME WAY join_bracket_hopper derives it (nickname, else full name, else
-- 'Player'). If the client picked the name instead, the same person would enter
-- under one name when they scan the code and possibly another when the
-- organizer adds them — and since a name may appear only once per tournament,
-- that inconsistency would show up as a phantom collision nobody could explain.
-- One derivation, in one place.
--
-- Mirrors join_bracket_hopper's outcomes so both paths report the same things,
-- including the already_in no-op and name_taken.

CREATE OR REPLACE FUNCTION "public"."add_registered_to_hopper"(
  "p_bracket_id" "uuid",
  "p_member_id" "uuid"
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_member  members%ROWTYPE;
  v_name    text;
BEGIN
  SELECT * INTO v_bracket FROM brackets WHERE id = p_bracket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_accepting', 'status', v_bracket.status);
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_player');
  END IF;

  -- Registered players only. A placeholder belongs to a league's team
  -- structure; a tournament has no relationship with it.
  IF v_member.user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_registered');
  END IF;

  -- Already here? A no-op, answered before the name check so their own row is
  -- never mistaken for somebody else holding their name.
  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = p_bracket_id AND member_id = p_member_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_in', true);
  END IF;

  -- The SAME derivation join_bracket_hopper uses. See the header.
  v_name := COALESCE(
    NULLIF(btrim(v_member.nickname), ''),
    NULLIF(btrim(concat_ws(' ', v_member.first_name, v_member.last_name)), ''),
    'Player'
  );

  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = p_bracket_id
       AND lower(btrim(display_name)) = lower(v_name)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_taken', 'name', v_name);
  END IF;

  INSERT INTO bracket_hopper (bracket_id, member_id, display_name, added_via)
  VALUES (p_bracket_id, p_member_id, v_name, 'search');

  RETURN jsonb_build_object('ok', true, 'name', v_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."add_registered_to_hopper"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_registered_to_hopper"("uuid", "uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."add_registered_to_hopper"("uuid", "uuid") IS
  'Organizer search-add: put a REGISTERED player in a tournament''s waiting room. Derives display_name exactly as join_bracket_hopper does, so a player enters under the same name however they got there. Setup-only; registered-only; returns {ok, reason?} with not_found | not_accepting | no_such_player | not_registered | name_taken, and already_in as a no-op. See docs/plans/2026-09-04-001.';
