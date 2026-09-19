-- Migration: Game Room — Unit 8 (the HOUSE model: seats belong to the host, not the room)
--
-- Ed, 2026-09-19: "my capacity should envelope my house, not the room."
--
-- BEFORE (Unit 1): each room had its own seats, funded by whichever hosts
-- were PRESENT in it (hosts present × 4 − devices). Two holes:
--   1. One host could open a room for Mike + friend, another for Steve + Jim,
--      twenty more — standing at each door for a second — and leave 40 other
--      people on websockets against the app's connection limit, for one
--      host's payment.
--   2. Hosts stacked: five hosts in one room = 20 seats.
--
-- NOW: a host owns a HOUSE. The house has room_guest_seats() guest seats
-- (3). Rooms are doors inside it — open as many as you like. Guests spend
-- HOUSE seats: distinct PEOPLE present across every room the host owns. The
-- same person in two of the host's rooms is one seat. The host's own devices
-- are not guests. A friend who is also a host is just a guest in your house —
-- only the room's OWNER (rooms.host_member_id) funds anything, present or
-- not. So one paid host = at most 1 + 3 concurrent screens, and room count
-- is irrelevant to cost (no room cap needed).
--
-- "Present" still means a heartbeat within room_presence_grace(); a guest
-- who has been gone 2 minutes frees their seat — even from another room.
--
-- room_phones.is_host now means "this member OWNS the room" (the tag the
-- phone list shows), not "passed the host gate". The gate
-- (room_member_is_host) still decides who may open a shared room at all.
--
-- Concurrency: two guests joining two different rooms of the same house at
-- the same instant must not both take the last seat, so join_room takes a
-- transaction-scoped advisory lock keyed on the OWNER rather than locking the
-- room row.
--
-- Dial: room_guest_seats() — swap the constant, nothing else moves.
-- room_seats_per_host() is kept for compatibility but no longer read.

-- ============================================================================
-- 1. DIAL
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."room_guest_seats"() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;

COMMENT ON FUNCTION "public"."room_guest_seats"() IS
  'Game Room dial: guest seats per HOST, across every room the host owns (the house model). Host''s own devices are not guests.';

-- ============================================================================
-- 2. HOUSE SEATS — the one place the math lives
-- ============================================================================
-- guests = distinct members present (heartbeat within grace) in ANY room owned
--          by p_owner, excluding the owner.
-- seats  = room_guest_seats()
-- open   = seats − guests
CREATE OR REPLACE FUNCTION "public"."house_seats"("p_owner" uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH guests AS (
    SELECT DISTINCT rp.member_id
      FROM room_phones rp
      JOIN rooms r ON r.id = rp.room_id
     WHERE r.host_member_id = p_owner
       AND rp.member_id <> p_owner
       AND rp.last_seen_at > now() - room_presence_grace()
  )
  SELECT jsonb_build_object(
    'guests', (SELECT count(*)::int FROM guests),
    'seats',  room_guest_seats(),
    'open',   room_guest_seats() - (SELECT count(*)::int FROM guests)
  )
$$;

-- room_seats keeps its name and callers (room_state, the pages) but now
-- reports the ROOM's devices alongside its OWNER's house picture.
--   devices = rows in this room seen within the grace window
--   guests / seats / open = the owner's house (see house_seats)
CREATE OR REPLACE FUNCTION "public"."room_seats"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT house_seats(r.host_member_id) || jsonb_build_object(
    'devices', (
      SELECT count(*)::int FROM room_phones rp
       WHERE rp.room_id = r.id
         AND rp.last_seen_at > now() - room_presence_grace()
    )
  )
  FROM rooms r WHERE r.id = p_room_id
$$;

-- ============================================================================
-- 3. RPCs — create_room / join_room / set_room_shared under the house model
-- ============================================================================

-- create_room: unchanged except is_host = true (the creator OWNS the room).
CREATE OR REPLACE FUNCTION "public"."create_room"(
  "p_game_key"  text,
  "p_tables"    text[],
  "p_device_id" uuid,
  "p_settings"  jsonb    DEFAULT '{}'::jsonb,
  "p_shared"    boolean  DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member  members%ROWTYPE;
  v_room    rooms%ROWTYPE;
  v_err     jsonb;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;
  IF p_game_key IS NULL OR btrim(p_game_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;

  IF p_shared AND NOT room_member_is_host(v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_host');
  END IF;

  v_err := room_validate_tables(p_tables);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  INSERT INTO rooms (host_member_id, game_key, game_tables, settings, shared)
  VALUES (v_member.id, p_game_key, p_tables, COALESCE(p_settings, '{}'::jsonb), COALESCE(p_shared, false))
  RETURNING * INTO v_room;

  INSERT INTO room_phones (room_id, member_id, device_id, display_name, is_host)
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), true);

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'join_token', v_room.join_token);
END;
$$;

-- join_room — the caller's DEVICE takes a seat in the OWNER's house.
--   • the owner's own devices never consume a guest seat;
--   • a member already present in another of the owner's rooms is already
--     counted — joining a second room costs nothing;
--   • otherwise the house must have an open seat.
-- Same device again = a refresh, not a new seat.
CREATE OR REPLACE FUNCTION "public"."join_room"(
  "p_join_token" uuid,
  "p_device_id"  uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member   members%ROWTYPE;
  v_room     rooms%ROWTYPE;
  v_phone    room_phones%ROWTYPE;
  v_is_owner boolean;
  v_counted  boolean;
  v_seats    jsonb;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT v_room.shared THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_shared');
  END IF;

  -- One house, one door at a time (across all its rooms).
  PERFORM pg_advisory_xact_lock(hashtext('room_house:' || v_room.host_member_id::text));

  v_is_owner := v_room.host_member_id = v_member.id;

  -- Already here on this device → refresh, no seat consumed.
  SELECT * INTO v_phone FROM room_phones
   WHERE room_id = v_room.id AND device_id = p_device_id;
  IF FOUND THEN
    UPDATE room_phones
       SET last_seen_at = now(),
           member_id    = v_member.id,
           display_name = room_display_name(v_member),
           is_host      = v_is_owner
     WHERE id = v_phone.id;
    RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', true);
  END IF;

  IF NOT v_is_owner THEN
    -- Already a counted guest of this house (present in another of its rooms)?
    SELECT EXISTS (
      SELECT 1 FROM room_phones rp
        JOIN rooms r ON r.id = rp.room_id
       WHERE r.host_member_id = v_room.host_member_id
         AND rp.member_id = v_member.id
         AND rp.last_seen_at > now() - room_presence_grace()
    ) INTO v_counted;

    IF NOT v_counted THEN
      v_seats := house_seats(v_room.host_member_id);
      IF (v_seats->>'open')::int <= 0 THEN
        RETURN jsonb_build_object(
          'ok', false, 'reason', 'full', 'seats', room_seats(v_room.id),
          'hint', 'a seat frees up when one of the host''s guests leaves'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO room_phones (room_id, member_id, device_id, display_name, is_host)
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), v_is_owner)
  RETURNING * INTO v_phone;

  UPDATE rooms SET last_activity_at = now() WHERE id = v_room.id;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', false);
END;
$$;

-- set_room_shared: unchanged except it no longer rewrites is_host (that is
-- ownership now, fixed at insert).
CREATE OR REPLACE FUNCTION "public"."set_room_shared"(
  "p_room_id" uuid,
  "p_shared"  boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_room.host_member_id <> v_member.id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_host');
  END IF;
  IF p_shared AND NOT room_member_is_host(v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_host');
  END IF;

  UPDATE rooms SET shared = COALESCE(p_shared, false), last_activity_at = now()
   WHERE id = v_room.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================
REVOKE EXECUTE ON FUNCTION "public"."room_guest_seats"()   FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."house_seats"(uuid)    FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."room_guest_seats"()   TO "authenticated";
GRANT  EXECUTE ON FUNCTION "public"."house_seats"(uuid)    TO "authenticated";

COMMENT ON FUNCTION "public"."house_seats"(uuid) IS
  'Game Room house model: {guests, seats, open} for a host — distinct people present across every room the host owns, excluding the host. The ONLY seat math.';
COMMENT ON FUNCTION "public"."room_seats"(uuid) IS
  'Game Room: the room''s present device count + its OWNER''s house picture ({devices, guests, seats, open}). What room_state and the seat counter read.';
COMMENT ON FUNCTION "public"."join_room"(uuid, uuid) IS
  'Game Room (house model): the caller''s DEVICE takes a seat in the room owner''s house — distinct people across all the owner''s rooms, room_guest_seats() max. Owner''s devices are free; a person already present in another of the owner''s rooms is already counted. Same device = refresh. Returns {ok, reason?/room_id, phone_id, rejoined}.';
COMMENT ON COLUMN "public"."room_phones"."is_host" IS 'Whether this member OWNS the room (rooms.host_member_id). The phone list''s "host" tag. Not the host gate.';
