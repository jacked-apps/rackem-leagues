-- Migration: Game Room — a room seats as many screens as its GAME says
--
-- Ed, 2026-10-10, looking at "Players 2 of 4" in a room holding one person:
-- "2 of 4 when only 1 is present seems wrong… I think rooms should have an
-- occupancy allowance. For instance a coin flip only needs 2 people, one
-- flipper one caller, so having 4 people just kind of makes it weird — if
-- there are 3 or 4 who is flipping against who?"
--
-- Right on both counts, and they are the same fix. Until now the only
-- capacity in the system was the HOUSE (4 screens per host, across all their
-- rooms). That is a billing limit, and it was being shown as if it were a
-- room limit — so a coin-flip room advertised space for four people who would
-- have had nothing to do, and the chip's denominator described a different
-- room than the one you were looking at.
--
-- Now there are two capacities, and they answer different questions:
--
--   rooms.max_screens  — how many screens this GAME can use. Declared by the
--                        game (GameDefinition.screens) and written here at
--                        creation, exactly like game_tables: the client says
--                        what shape the game is, the server validates and
--                        stores it, and from then on the server enforces it
--                        without knowing anything about games.
--   house_seats()      — how many screens the HOST may have live at once,
--                        anywhere. Unchanged; still what you pay for.
--
-- Joining must clear BOTH, and the refusals are separate so the copy can be
-- too: `room_full` ("this game seats two") is a different sentence from
-- `full` ("your seats are all taken").
--
-- Dials: room_occupancy_cap() is the ceiling a game may ask for.

-- ============================================================================
-- 1. DIAL + COLUMN
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."room_occupancy_cap"() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 8 $$;

COMMENT ON FUNCTION "public"."room_occupancy_cap"() IS
  'Game Room dial: the largest occupancy a game may declare for one room. A sanity ceiling, not a product limit — the binding limit in practice is the host''s house (room_house_seats).';

-- Existing rooms predate occupancy; the old behaviour was "whatever the house
-- allows", so they get the house size rather than a number that would shrink
-- a room somebody is sitting in.
ALTER TABLE "public"."rooms"
  ADD COLUMN IF NOT EXISTS "max_screens" integer NOT NULL DEFAULT 4;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rooms_max_screens_check'
  ) THEN
    ALTER TABLE "public"."rooms"
      ADD CONSTRAINT "rooms_max_screens_check"
      CHECK ("max_screens" >= 1 AND "max_screens" <= 8);
  END IF;
END $$;

COMMENT ON COLUMN "public"."rooms"."max_screens" IS
  'How many screens this room''s GAME can use (GameDefinition.screens.max), stored at creation like game_tables. Enforced by join_room as room_full. Separate from the host''s house seats, which is the billing limit.';

-- ============================================================================
-- 2. SEAT PICTURE — the room's own capacity alongside the house's
-- ============================================================================
-- devices / max_screens  = THIS room (what the chip shows: "Players 1 of 2")
-- used / seats / open    = the OWNER's house (what the panel shows)
CREATE OR REPLACE FUNCTION "public"."room_seats"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT house_seats(r.host_member_id) || jsonb_build_object(
    'devices', (
      SELECT count(*)::int FROM room_phones rp
       WHERE rp.room_id = r.id
         AND rp.last_seen_at > now() - room_presence_grace()
    ),
    'room_max', r.max_screens
  )
  FROM rooms r WHERE r.id = p_room_id
$$;

COMMENT ON FUNCTION "public"."room_seats"(uuid) IS
  'Game Room: {devices, room_max} for THIS room (its game''s occupancy) plus {used, seats, open} for its OWNER''s house. Two capacities, two questions: can this game take another player, and may this host have another screen live.';

-- ============================================================================
-- 3. CREATE — the game declares its occupancy
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."create_room"(
  "p_game_key"    text,
  "p_tables"      text[],
  "p_device_id"   uuid,
  "p_settings"    jsonb    DEFAULT '{}'::jsonb,
  "p_shared"      boolean  DEFAULT false,
  "p_max_screens" integer  DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_err    jsonb;
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
  IF p_max_screens IS NULL
     OR p_max_screens < 1
     OR p_max_screens > room_occupancy_cap() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'bad_occupancy', 'max', room_occupancy_cap()
    );
  END IF;

  IF p_shared AND NOT room_member_is_host(v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_host');
  END IF;

  v_err := room_validate_tables(p_tables);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  INSERT INTO rooms (host_member_id, game_key, game_tables, settings, shared, max_screens)
  VALUES (
    v_member.id, p_game_key, p_tables,
    COALESCE(p_settings, '{}'::jsonb), COALESCE(p_shared, false), p_max_screens
  )
  RETURNING * INTO v_room;

  INSERT INTO room_phones (room_id, member_id, device_id, display_name, is_host)
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), true);

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'join_token', v_room.join_token);
END;
$$;

-- ============================================================================
-- 4. JOIN — clear the ROOM's occupancy as well as the HOUSE's seats
-- ============================================================================
-- Order matters for the sentence the joiner reads: the room's own limit is
-- checked first, because "this game seats two" is the more useful thing to be
-- told than "the host is out of seats" when both happen to be true.
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
  v_here     integer;
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

  -- Already on the guest list on this device → walk straight back in. No seat
  -- consumed and no occupancy check: the row is the invitation, and this is
  -- the same screen reclaiming a place it already had.
  SELECT * INTO v_phone FROM room_phones
   WHERE room_id = v_room.id AND device_id = p_device_id;
  IF FOUND THEN
    UPDATE room_phones
       SET last_seen_at = now(),
           left_at      = NULL,
           member_id    = v_member.id,
           display_name = room_display_name(v_member),
           is_host      = v_is_owner
     WHERE id = v_phone.id;
    RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', true);
  END IF;

  -- Does the GAME have room for another screen?
  SELECT count(*)::int INTO v_here
    FROM room_phones rp
   WHERE rp.room_id = v_room.id
     AND rp.last_seen_at > now() - room_presence_grace();
  IF v_here >= v_room.max_screens THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'room_full', 'seats', room_seats(v_room.id),
      'hint', 'this game seats ' || v_room.max_screens
    );
  END IF;

  -- Does the HOST have a seat left, anywhere?
  v_seats := house_seats(v_room.host_member_id);
  IF (v_seats->>'open')::int <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'full', 'seats', room_seats(v_room.id),
      'hint', 'a seat frees up when a screen in the host''s house closes'
    );
  END IF;

  INSERT INTO room_phones (room_id, member_id, device_id, display_name, is_host)
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), v_is_owner)
  RETURNING * INTO v_phone;

  UPDATE rooms SET last_activity_at = now() WHERE id = v_room.id;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', false);
END;
$$;

-- ============================================================================
-- 5. ROOM STATE — carry max_screens so the pages can read it
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."room_state"("p_room" "public"."rooms")
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'found', true,
    'room', jsonb_build_object(
      'id',               p_room.id,
      'host_member_id',   p_room.host_member_id,
      'game_key',         p_room.game_key,
      'game_tables',      to_jsonb(p_room.game_tables),
      'settings',         p_room.settings,
      'shared',           p_room.shared,
      'max_screens',      p_room.max_screens,
      'join_token',       p_room.join_token,
      'last_activity_at', p_room.last_activity_at,
      'created_at',       p_room.created_at
    ),
    'seats', room_seats(p_room.id),
    'phones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',           rp.id,
        'member_id',    rp.member_id,
        'device_id',    rp.device_id,
        'display_name', rp.display_name,
        'is_host',      rp.is_host,
        'is_present',   rp.last_seen_at > now() - room_presence_grace(),
        'has_left',     rp.left_at IS NOT NULL,
        'last_seen_at', rp.last_seen_at,
        'joined_at',    rp.joined_at
      ) ORDER BY rp.joined_at)
      FROM room_phones rp WHERE rp.room_id = p_room.id
    ), '[]'::jsonb)
  )
$$;

-- ============================================================================
-- 6. GRANTS — the signature changed, so the old one must go
-- ============================================================================
DROP FUNCTION IF EXISTS "public"."create_room"(text, text[], uuid, jsonb, boolean);

REVOKE EXECUTE ON FUNCTION "public"."room_occupancy_cap"() FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."room_occupancy_cap"() TO "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) TO "authenticated";

COMMENT ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) IS
  'Game Room: the caller becomes host + first screen. Validates the game''s table list and its declared occupancy (1..room_occupancy_cap(), else bad_occupancy). Shared rooms need the host gate. Returns {ok, reason?/room_id, join_token}.';
COMMENT ON FUNCTION "public"."join_room"(uuid, uuid) IS
  'Game Room: this screen takes a place. Clears TWO limits — the room''s own occupancy (room_full, "this game seats N") and the owner''s house seats (full). A rejoin on a device already on the guest list skips both. Returns {ok, reason?/room_id, phone_id, rejoined}.';
