-- Migration: Game Room — being here cancels "left"
--
-- Ed, testing 2026-10-10: "when I'm in it it says host left but I'm there.
-- (It took a second — at first it said that I left.)"
--
-- The bug: `leave_room` stamps `left_at`, but nothing cleared it except
-- `join_room`'s rejoin branch — and the room page does NOT call join_room
-- when a row already exists. It finds the row, starts the heartbeat, and
-- renders. So a screen that had ever used Exit stayed flagged "left" for the
-- life of the room, and read "host · left" while its owner sat looking at it.
--
-- The fix belongs in the heartbeat, because the heartbeat is the statement
-- that means "this screen is here" — and you cannot be here and have left.
-- Clearing it here covers every way of arriving (a rejoin, a page load on an
-- existing row, a tab waking up), not just the one path join_room sees.
--
-- A welcome side effect: `left_at` is NOT one of the columns the client's
-- realtime filter ignores (only `last_seen_at` / `last_activity_at` are), so
-- the one beat that clears it DOES reach every other screen — they see the
-- person come back at once instead of waiting out the 15 s poll. Steady-state
-- beats still change nothing but `last_seen_at`, so they stay silent, which
-- is exactly what that filter is for.
CREATE OR REPLACE FUNCTION "public"."room_heartbeat"(
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

  -- Here now, so not gone: last_seen_at AND left_at together.
  UPDATE room_phones SET last_seen_at = now(), left_at = NULL
   WHERE room_id = p_room_id AND device_id = p_device_id AND member_id = v_member.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_room');
  END IF;

  UPDATE rooms SET last_activity_at = now()
   WHERE id = p_room_id AND last_activity_at < now() - room_activity_threshold();

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION "public"."room_heartbeat"(uuid, uuid) IS
  'Game Room: keeps a screen present (grace window) and clears its left_at — being here cancels having left. Bumps room activity at most every 5 minutes.';
