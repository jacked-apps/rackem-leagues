-- Migration: Game Room — remove a screen from the room (the host's "kick")
--
-- Ed, 2026-10-09, reviewing the room on two windows: the players list should
-- be where you drop someone from the room.
--
-- What it is: the OWNER deletes one phone row. The seat frees at once (seats
-- count present rows — see house_seats) and the list stops showing them. The
-- removed device's page falls back to "this device isn't in the room yet"
-- because its row is gone; the room row still exists, so it is not an "ended"
-- screen.
--
-- What it is NOT: a ban. The removed member can walk back in with the invite
-- link they already have. The common case this serves is a screen left on a
-- table holding a seat, not a hostile guest — a real block list would be a
-- small room_bans table plus one check in join_room, and it is deliberately
-- not built yet.
--
-- Cascade note: room_coin_flips.caller_phone_id / flipper_phone_id are
-- ON DELETE CASCADE to room_phones, so removing a screen removes the flips it
-- was part of. Correct for a perishable room: a flip with a missing side is
-- not a flip. Future games inherit the same contract.
--
-- The owner may remove any screen INCLUDING their own spare devices (a stale
-- tablet), but not the device they are calling from — that would be "leave",
-- which is just navigating away and needs no RPC.

CREATE OR REPLACE FUNCTION "public"."remove_room_phone"(
  "p_phone_id"  uuid,
  "p_device_id" uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_phone  room_phones%ROWTYPE;
  v_room   rooms%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  SELECT * INTO v_phone FROM room_phones WHERE id = p_phone_id;
  IF NOT FOUND THEN
    -- Already gone (two taps, or they left on their own) — nothing to do, and
    -- nothing the host needs told about.
    RETURN jsonb_build_object('ok', true, 'already_gone', true);
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = v_phone.room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_room.host_member_id <> v_member.id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_host');
  END IF;
  -- Removing the screen you are holding is "leave", not a removal.
  IF v_phone.device_id = p_device_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'is_self');
  END IF;

  DELETE FROM room_phones WHERE id = p_phone_id;
  UPDATE rooms SET last_activity_at = now() WHERE id = v_room.id;

  RETURN jsonb_build_object('ok', true, 'already_gone', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."remove_room_phone"(uuid, uuid) FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."remove_room_phone"(uuid, uuid) TO "authenticated";

COMMENT ON FUNCTION "public"."remove_room_phone"(uuid, uuid) IS
  'Game Room: the room OWNER drops one screen (phone row). Frees its house seat at once and clears it from the list. NOT a ban — the member may rejoin with the invite link. Refuses the caller''s own device (is_self) and non-owners (not_host); an already-deleted row returns ok with already_gone.';
