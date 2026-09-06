-- Migration: Tournament paid foundation — Phase C, Unit C3 (start-time conversion)
--
-- finalize_bracket_hopper(bracket_id, include_waiting) — the seam between the
-- hopper (who might play) and the bracket (who IS playing).
--
-- The free flow types names straight into bracket_participants and starts. A
-- paid tournament with "Real players & sign-up" instead fills a hopper over the
-- course of an evening, so something has to convert the official list into
-- seeded participants at Start. This does exactly that, and nothing else:
--
--   1. Optionally admit everyone still waiting, as unpaid (the Start-screen
--      checkbox — the waiting room is, in practice, people standing there
--      wanting to play).
--   2. Assign contiguous seeds 1..N over the official list in arrival order.
--   3. Replace bracket_participants from that list, carrying member_id (so a
--      registered player stays linked), display_name (the walk-up's whole
--      identity), and the organizer's paid call into entry_fee_paid.
--   4. Return the count, which the client feeds to the bracket generator.
--
-- start_bracket is deliberately UNTOUCHED: it already maps
-- bracket_participants.seed → uuid, so once this has run the paid flow starts
-- through exactly the same code path as the free one.
--
-- Replace-then-insert is safe because this only ever runs in 'setup' — no match
-- references a participant yet, and brackets are disposable in both tiers.
--
-- AUTHZ: authenticated-only (revoke anon), like every other bracket write RPC.
-- The caller = brackets.created_by check is deferred to the pre-launch RLS pass.

CREATE OR REPLACE FUNCTION "public"."finalize_bracket_hopper"(
  "p_bracket_id" "uuid",
  "p_include_waiting" boolean DEFAULT false
)
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_status text;
  v_count  integer;
BEGIN
  SELECT status INTO v_status FROM brackets WHERE id = p_bracket_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Tournament not found';
  END IF;

  -- Idempotency guard: a double-tapped Start must not rebuild the participant
  -- list out from under a bracket whose matches already point at it.
  IF v_status <> 'setup' THEN
    RAISE EXCEPTION 'This tournament has already been started';
  END IF;

  -- 1. "Also add everyone still waiting" — admitted as unpaid, since the
  --    organizer hasn't said otherwise. COALESCE so an entry that already had a
  --    paid flag keeps it. The roster trigger fires on these, so a bulk admit
  --    still records registered players as past players.
  IF p_include_waiting THEN
    UPDATE bracket_hopper
       SET status = 'official',
           paid_status = COALESCE(paid_status, 'unpaid')
     WHERE bracket_id = p_bracket_id
       AND status = 'hopper';
  END IF;

  -- 2. Contiguous seeds over the official list, in the order players arrived.
  --    (id breaks ties so the numbering is deterministic for same-instant rows.)
  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
      FROM bracket_hopper
     WHERE bracket_id = p_bracket_id
       AND status = 'official'
  )
  UPDATE bracket_hopper h
     SET seed = o.rn
    FROM ordered o
   WHERE h.id = o.id;

  SELECT count(*)::int INTO v_count
    FROM bracket_hopper
   WHERE bracket_id = p_bracket_id AND status = 'official';

  -- A bracket needs two players; the generator would produce nonsense below that.
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Add at least 2 players before starting';
  END IF;

  -- 3. Materialize the official list as the bracket's participants.
  DELETE FROM bracket_participants WHERE bracket_id = p_bracket_id;

  -- COALESCE, not a bare comparison: paid_status is NULL for an entry the
  -- organizer never flagged, and entry_fee_paid is NOT NULL. "Not marked paid"
  -- is exactly what the entry-fee tracker means by false.
  INSERT INTO bracket_participants (bracket_id, member_id, display_name, seed, entry_fee_paid)
  SELECT p_bracket_id, h.member_id, h.display_name, h.seed,
         COALESCE(h.paid_status = 'paid', false)
    FROM bracket_hopper h
   WHERE h.bracket_id = p_bracket_id
     AND h.status = 'official';

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."finalize_bracket_hopper"("uuid", boolean) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."finalize_bracket_hopper"("uuid", boolean) TO "authenticated";

COMMENT ON FUNCTION "public"."finalize_bracket_hopper"("uuid", boolean) IS
  'Converts a paid tournament''s official hopper list into seeded bracket_participants at Start (optionally admitting everyone still waiting as unpaid first), and returns the player count for the tree generator. Setup-only; leaves start_bracket untouched. See docs/plans/2026-09-04-001.';
