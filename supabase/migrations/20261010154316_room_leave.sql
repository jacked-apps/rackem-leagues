-- Migration: Game Room — leaving frees the seat NOW, and one screen is never
-- worth two seats
--
-- Ed, 2026-10-10, on being told Exit waits out the 2-minute grace: "why the
-- 2 minutes? That would mean I could be in 2 rooms at the same time, leaving
-- one room and entering another during the 2 min wait?" — and then: "it needs
-- to show that when I leave it triggers the socket, exits me out of the room
-- so I can enter another and I am not wasted space for the next person in
-- line."
--
-- He is right, and the flaw was in the unit. The presence grace
-- (room_presence_grace(), 2 min) exists so a phone that goes dark is not
-- kicked while its owner is looking at the table. But it also meant a screen
-- that MOVED counted in both rooms until it aged out: one websocket, two
-- seats charged against the host's four. A host bouncing between their own
-- two rooms could block a guest for no reason.
--
-- Two fixes, because there are two ways a screen leaves:
--
--   1. ON PURPOSE — leave_room(). Exit room deletes this device's row at
--      once: the seat is free before the person has finished walking away,
--      and the list stops showing them. (The socket was never the problem —
--      navigating away unmounts the page, which removes the channel.)
--
--   2. EVERY OTHER WAY — tab closed, back button, dead battery, a second
--      room opened without using Exit. Those leave a row behind, so
--      house_seats now counts DISTINCT device_id rather than rows. A device
--      shows one page at a time, so one device id is one seat no matter how
--      many stale rows it owns. Rows still linger for the grace window
--      (bouncing back does not cost a re-join), they just cannot
--      double-charge.
--
-- What is deliberately unchanged: the grace window itself. A sleeping phone
-- still keeps its seat, which is the whole reason it exists.

-- ============================================================================
-- 1. ONE SCREEN, ONE SEAT — distinct device_id, not rows
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."house_seats"("p_owner" uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH screens AS (
    -- DISTINCT device_id: a screen shows one room page at a time, so a device
    -- with a stale row in the room it just left is still only one connection.
    SELECT DISTINCT rp.device_id
      FROM room_phones rp
      JOIN rooms r ON r.id = rp.room_id
     WHERE r.host_member_id = p_owner
       AND rp.last_seen_at > now() - room_presence_grace()
  )
  SELECT jsonb_build_object(
    'used',  (SELECT count(*)::int FROM screens),
    'seats', room_house_seats(),
    'open',  room_house_seats() - (SELECT count(*)::int FROM screens)
  )
$$;

COMMENT ON FUNCTION "public"."house_seats"(uuid) IS
  'Game Room house model: {used, seats, open} for a host — DISTINCT present device ids across every room the host owns, the host''s own included. One screen = one seat however many rooms it has rows in. The ONLY seat math.';

-- ============================================================================
-- 2. LEAVING ON PURPOSE
-- ============================================================================
-- leave_room — this device steps out of this room, now. Deletes only the
-- caller's OWN row (member_id must match), so it can never be used to drop
-- somebody else; that is remove_room_phone, and only the owner may call it.
--
-- Does NOT touch rooms.last_activity_at: leaving is not use, and bumping it
-- would keep an abandoned room alive against the sweep.
--
-- Cascade note: the leaver's game rows go with their phone row (the FKs are
-- ON DELETE CASCADE), so walking out mid-flip ends that flip. Correct for a
-- perishable room — a flip with a missing side is not a flip.
CREATE OR REPLACE FUNCTION "public"."leave_room"(
  "p_room_id"   uuid,
  "p_device_id" uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  DELETE FROM room_phones
   WHERE room_id = p_room_id
     AND device_id = p_device_id
     AND member_id = v_member.id;

  -- Already gone (left twice, or the host dropped them first) is a success:
  -- the caller wanted to not be in the room, and they are not.
  RETURN jsonb_build_object('ok', true, 'left', FOUND);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."leave_room"(uuid, uuid) FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."leave_room"(uuid, uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."leave_room"(uuid, uuid) IS
  'Game Room: this device steps out of this room immediately — frees its house seat and clears it from the list. Deletes only the caller''s own row. Returns {ok:true, left} (left=false when the row was already gone). Does not bump room activity.';
