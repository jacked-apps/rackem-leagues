-- Migration: Tournament paid foundation — Phase C, Unit C3 (walk-up self-add)
--
-- add_self_as_walkup(join_token, display_name) — someone with no account types
-- their name on the tournament page and lands in the waiting room.
--
-- THIS DELIBERATELY OPENS AN ANONYMOUS WRITE, reversing the posture that only
-- an authenticated caller may touch the hopper. The reasoning: the waiting room
-- is a PROPOSAL, not the tournament. Nothing reaches the bracket until the
-- organizer taps admit, so the worst an abuser achieves is a list the organizer
-- has to tidy — annoying, not corrupting. Requiring an account instead would
-- lose exactly the person this whole feature exists for: the walk-in who
-- doesn't use the app.
--
-- What keeps "annoying" from becoming "unusable" — all enforced here, because
-- an input box is trivially bypassed:
--   • setup only — no adding once the tournament starts;
--   • a hard cap per tournament, so nobody can bury the list overnight;
--   • a 12-character name limit, so the list stays readable on a phone;
--   • one name per tournament (the existing unique index), reported as
--     name_taken rather than a constraint error.
--
-- The length limit lives in THIS function rather than on the column: an
-- organizer typing a name and a registered player's nickname both write the
-- same column and are not bound by the self-entry box's rule.

-- Room for a full 64-player bracket plus everyone still waiting to get in.
CREATE OR REPLACE FUNCTION "public"."add_self_as_walkup"(
  "p_join_token" "uuid",
  "p_display_name" text
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_name    text;
  v_count   integer;
  c_max_entries CONSTANT integer := 128;
  c_max_name    CONSTANT integer := 12;
BEGIN
  v_name := btrim(COALESCE(p_display_name, ''));

  IF v_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;

  IF char_length(v_name) > c_max_name THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long', 'max', c_max_name);
  END IF;

  SELECT * INTO v_bracket FROM brackets WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_accepting', 'status', v_bracket.status);
  END IF;

  -- Only tournaments that bought sign-up have a waiting room at all.
  IF NOT (v_bracket.premium_features @> ARRAY['real_players']::text[]) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_accepting', 'status', v_bracket.status);
  END IF;

  SELECT count(*) INTO v_count FROM bracket_hopper WHERE bracket_id = v_bracket.id;
  IF v_count >= c_max_entries THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full', 'max', c_max_entries);
  END IF;

  -- First come, first served. Checked rather than caught so the caller gets a
  -- sentence instead of a unique-violation.
  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = v_bracket.id
       AND lower(btrim(display_name)) = lower(v_name)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_taken', 'name', v_name);
  END IF;

  INSERT INTO bracket_hopper (bracket_id, display_name, added_via)
  VALUES (v_bracket.id, v_name, 'link');

  RETURN jsonb_build_object('ok', true, 'name', v_name, 'bracket_name', v_bracket.name);
END;
$$;

-- Anon by design (see header). The guards above are the whole boundary.
GRANT EXECUTE ON FUNCTION "public"."add_self_as_walkup"("uuid", text) TO "anon", "authenticated";

COMMENT ON FUNCTION "public"."add_self_as_walkup"("uuid", text) IS
  'Anonymous self-add: an accountless walk-up types a name on the tournament page and lands in the waiting room. Anon-callable BY DESIGN — the waiting room is a proposal the organizer must admit from, so abuse is tidying rather than corruption. Guarded by: setup-only, sign-up feature required, a 128-entry cap, a 12-character name limit, and one-name-per-tournament (reported as name_taken). See docs/plans/2026-09-04-001.';
