-- Migration: Game Room — the guest list and "who's here" are two things
--
-- Ed, 2026-10-10: "exiting a room you are invited to should not remove the
-- room from your view. You were invited to that room by your host — you have
-- locked the door for me to re-enter, unless I get a new invite. Once I'm
-- invited to a room it should have a guest list? Who is in the room is
-- separate from the guest list perhaps?"
--
-- He is right, and the previous migration conflated them. `leave_room` DELETED
-- the phone row — but that row is two facts at once:
--
--   the ROW        = "this device was let into this room" (the guest list).
--                    It is what puts the room in the member's /rooms list, and
--                    what lets them walk back in without the invite link.
--   the HEARTBEAT  = "this screen is looking at it right now" (presence).
--                    It is what costs a socket and holds a seat.
--
-- So leaving should retire the HEARTBEAT and keep the ROW. The seat frees
-- immediately (presence is heartbeat-based), the room stays on the guest's
-- list, and re-entering is a free rejoin on the same device. Deleting the row
-- is a different act with a different meaning — and it already has an owner:
-- `remove_room_phone`, the host's ×. That is now the real removal: off the
-- guest list, and back in only with a new invite.
--
-- `left_at` is added so the list can tell the two kinds of absence apart:
--
--   left_at set   → "left"  (they walked out on purpose)
--   otherwise     → "away"  (phone asleep, tab backgrounded, battery dead)
--
-- Same seat behaviour either way — both are simply not present. It is only
-- the word on screen, and the words are the whole accessibility story here
-- (nothing in this feature conveys state by colour).

-- ============================================================================
-- 1. A COLUMN FOR THE KIND OF ABSENCE
-- ============================================================================
ALTER TABLE "public"."room_phones"
  ADD COLUMN IF NOT EXISTS "left_at" timestamptz;

COMMENT ON COLUMN "public"."room_phones"."left_at" IS
  'Set when this screen used Exit (leave_room); cleared when it comes back. Only distinguishes "left" from "away" on screen — presence is last_seen_at either way.';

-- ============================================================================
-- 2. LEAVING RETIRES THE HEARTBEAT, IT DOES NOT DELETE THE ROW
-- ============================================================================
-- Backdating last_seen_at past the grace window is exactly "not present", so
-- the seat is free on the next read with no special case anywhere else: the
-- seat math, the seat counter and the player list all already work off
-- presence. Nothing new learns about leaving.
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

  UPDATE room_phones
     SET last_seen_at = now() - room_presence_grace() - interval '1 second',
         left_at      = now()
   WHERE room_id = p_room_id
     AND device_id = p_device_id
     AND member_id = v_member.id;

  -- Not on the list at all (the host removed them, or they never joined) is
  -- still "I am not in that room", which is what the caller wanted.
  RETURN jsonb_build_object('ok', true, 'left', FOUND);
END;
$$;

COMMENT ON FUNCTION "public"."leave_room"(uuid, uuid) IS
  'Game Room: this screen steps out — retires its heartbeat (seat frees at once) and stamps left_at, but KEEPS the row so the room stays on the member''s guest list and re-entering needs no new invite. Only ever the caller''s own row. Deleting a row is remove_room_phone (the host''s removal).';

-- ============================================================================
-- 3. COMING BACK CLEARS THE "LEFT" MARK
-- ============================================================================
-- join_room's rejoin branch already refreshes last_seen_at for a device that
-- is on the list; it now also clears left_at, so walking back in reads as
-- here rather than as left. The seat check is still skipped on a rejoin: the
-- row already exists, so this is the same screen coming back, not a new one.
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
  -- consumed: the row is the invitation, and this is the same screen.
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

  -- A new screen in the house: is there a seat for it? (The owner's own
  -- devices are screens too — the bill does not know whose they are.)
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
-- 4. THE ROOM STATE CARRIES THE KIND OF ABSENCE
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

COMMENT ON FUNCTION "public"."remove_room_phone"(uuid, uuid) IS
  'Game Room: the room OWNER drops one screen OFF THE GUEST LIST (deletes the row). Frees its seat, clears it from the list, and the member needs a NEW INVITE to come back — unlike leave_room, which keeps the row so they can walk back in. Refuses the caller''s own device (is_self) and non-owners (not_host); an already-deleted row returns ok with already_gone.';
