-- Migration: Tournament paid foundation — Phase C, Unit C3 (roster housekeeping)
--
-- forget_bracket_roster_entry(...) — lets an organizer drop one person from
-- their remembered past-players list.
--
-- The list is sticky by design: being ejected from a tournament never removes
-- anyone, because removal-as-a-side-effect is how a roster silently rots. But
-- sticky-forever needs a deliberate way out, or the list fills with a name typo,
-- a one-night visitor, or someone who moved away.
--
-- ONE AT A TIME, by design. There is no "clear my roster" and no bulk delete:
-- the blast radius is wrong for a list the organizer built up over months, and
-- the UI pairs each call with a confirm.
--
-- SAFETY: the organizer is resolved from auth.uid(), never passed in — with RLS
-- off, a client-side delete on these tables would let anyone empty anyone
-- else's roster. Deleting a row that isn't there is a no-op returning false, not
-- an error, so a double tap is harmless.
--
-- Which list is targeted follows the same rule as everywhere else in this
-- feature: p_member_id given = the registered roster; otherwise p_display_name
-- names a remembered walk-up (matched case-insensitively, as it is stored).

CREATE OR REPLACE FUNCTION "public"."forget_bracket_roster_entry"(
  "p_member_id" "uuid" DEFAULT NULL,
  "p_display_name" text DEFAULT NULL
)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_organizer uuid;
  v_deleted   integer := 0;
BEGIN
  SELECT id INTO v_organizer FROM members WHERE user_id = auth.uid();
  IF v_organizer IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change your past players';
  END IF;

  IF p_member_id IS NOT NULL THEN
    DELETE FROM bracket_roster
     WHERE organizer_member_id = v_organizer
       AND player_member_id = p_member_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

  ELSIF btrim(COALESCE(p_display_name, '')) <> '' THEN
    DELETE FROM bracket_walkup_roster
     WHERE organizer_member_id = v_organizer
       AND lower(btrim(display_name)) = lower(btrim(p_display_name));
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'Nothing to forget: give a player or a name';
  END IF;

  RETURN v_deleted > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."forget_bracket_roster_entry"("uuid", text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."forget_bracket_roster_entry"("uuid", text) TO "authenticated";

COMMENT ON FUNCTION "public"."forget_bracket_roster_entry"("uuid", text) IS
  'Removes ONE person from the calling organizer''s remembered past players — a registered player (p_member_id) or a remembered walk-up name (p_display_name, case-insensitive). Organizer resolved from auth.uid(); returns false (not an error) if there was nothing to remove. Deliberately single-target: no bulk clear. See docs/plans/2026-09-04-001.';
