-- Migration: Tournament paid foundation — Phase C, Unit C3 (one name per tournament)
--
-- A name may appear at most ONCE in a tournament's hopper, first come first
-- served.
--
-- This deliberately REVERSES the earlier position that walk-up de-duplication
-- is the organizer's judgment rather than a constraint. That was right for the
-- free tier, where the organizer types every name, reads the bracket themselves,
-- and can tell two Tim Ps apart by memory. It is wrong the moment automation
-- reads the list: self-scoring, "you're up, Table 4" alerts, and handicap
-- lookups all identify a player by their display name, and two identical names
-- break every one of them the same way. The free tier is untouched — it has no
-- hopper.
--
-- WHY A DATABASE CONSTRAINT AND NOT A UI CHECK: "first come first served" is
-- only true if the database decides it. Two people tapping join at the same
-- moment would each read a list without the other in it and both insert. The
-- index is what makes the race resolve instead of both slipping through.
--
-- Comparison is case-insensitive and trim-insensitive: "Tim P", "tim p" and
-- " Tim P " are the same person's worth of confusion on a scoresheet.

CREATE UNIQUE INDEX IF NOT EXISTS "bracket_hopper_bracket_name_key"
  ON "public"."bracket_hopper" ("bracket_id", lower(btrim("display_name")));

COMMENT ON INDEX "public"."bracket_hopper_bracket_name_key" IS
  'One display name per tournament, first come first served. Case- and trim-insensitive. Enforced in the database because a UI check cannot decide a race between two simultaneous joins.';


-- ============================================================================
-- join_bracket_hopper — report a taken name instead of failing on the index
-- ============================================================================
-- Adds a `name_taken` outcome. The order of checks matters: a player who is
-- ALREADY in this hopper must still be a silent no-op (they re-scanned, or
-- double-tapped), and that has to be answered before the name check — otherwise
-- their own row would be read as someone else holding their name.
CREATE OR REPLACE FUNCTION "public"."join_bracket_hopper"(
  "p_join_token" "uuid",
  "p_via" "text" DEFAULT 'link'
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
  v_via     text;
BEGIN
  v_via := CASE WHEN p_via = 'qr' THEN 'qr' ELSE 'link' END;

  SELECT * INTO v_bracket FROM brackets WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_accepting', 'status', v_bracket.status);
  END IF;

  -- The joiner is the CALLER only — resolved from the session, never the token.
  SELECT * INTO v_member FROM members WHERE user_id = auth.uid();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  -- Already in? Nothing to do. Answered FIRST so a re-scan never reports that
  -- the player's own name is taken.
  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = v_bracket.id AND member_id = v_member.id
  ) THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_in', true,
      'bracket_id', v_bracket.id, 'bracket_name', v_bracket.name
    );
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(v_member.nickname), ''),
    NULLIF(btrim(concat_ws(' ', v_member.first_name, v_member.last_name)), ''),
    'Player'
  );

  -- Somebody else got here first with this name. The caller changes their
  -- nickname in their profile and comes back; we never rename anyone.
  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = v_bracket.id
       AND lower(btrim(display_name)) = lower(btrim(v_name))
  ) THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'name_taken', 'name', v_name,
      'bracket_id', v_bracket.id, 'bracket_name', v_bracket.name
    );
  END IF;

  INSERT INTO bracket_hopper (bracket_id, member_id, display_name, added_via)
  VALUES (v_bracket.id, v_member.id, v_name, v_via)
  ON CONFLICT (bracket_id, member_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'bracket_id', v_bracket.id, 'bracket_name', v_bracket.name);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") TO "authenticated";

COMMENT ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") IS
  'Self-add: the authenticated caller adds THEMSELVES (member from auth.uid()) to the hopper of the bracket with this join_token, while status=setup. Records only the caller''s identity; a repeat join is a no-op (already_in). Returns {ok, reason?} where reason is not_found | not_accepting | not_signed_in | name_taken. See docs/plans/2026-09-04-001.';
