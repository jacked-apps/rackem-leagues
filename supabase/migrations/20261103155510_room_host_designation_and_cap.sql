-- @fileoverview Game Room — host gate moves to the Host designation; rooms
-- stop self-deleting; each owner may keep at most room_cap_per_host() rooms.
--
-- Plan: docs/plans/2026-11-03-001-feat-room-race-plan.md (Unit 2).
--
-- Three changes, one theme: who may hold rooms, and how many.
--
-- 1. HOST GATE. room_member_is_host() used to read members.role
--    (league_operator / developer) as a stand-in until designations existed.
--    They exist now (20260919172451_add_designations_store.sql) and 'host' is
--    in the catalog (20260919182736_add_host_designation.sql), so the gate
--    asks the store instead: an ACTIVE 'host' designation, with the developer
--    master key passing as it does everywhere. Being a league operator no
--    longer makes you a host by itself. Every caller (create_room,
--    set_room_shared) keeps calling the same function, so nothing else moves.
--
-- 2. NO SWEEP. Rooms used to be deleted after a day without activity
--    (20260916184405_game_rooms_sweep.sql). A room now holds a race, and a
--    race nobody finished should not vanish overnight, so the owner deletes
--    rooms themselves (close_room). The cron job is unscheduled and the
--    function dropped — dead code once nothing calls it.
--
-- 3. ROOM CAP. With no sweep, something must stop rooms piling up forever.
--    create_room counts EVERY room the caller owns — free and shared — and
--    refuses `too_many_rooms` at the cap. Free rooms count because tidying
--    them was the sweep's other job. The count runs under the same per-member
--    advisory lock join_room takes ('room_house:' || member id), so two quick
--    taps cannot both slip under the cap.
--
-- Dial: room_cap_per_host() — swap the constant, nothing else moves.

-- ============================================================================
-- 1. HOST GATE — the designation store decides
-- ============================================================================
-- member_has_designation() takes the AUTH user id (members.user_id), so the
-- member is resolved first. A member with no user_id resolves to NULL, which
-- matches nothing → not a host.
CREATE OR REPLACE FUNCTION "public"."room_member_is_host"("p_member_id" uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT member_has_designation(m.user_id, 'host')
       FROM members m
      WHERE m.id = p_member_id),
    false
  )
$$;

-- Internal helper, not a client surface (same as before).
REVOKE EXECUTE ON FUNCTION "public"."room_member_is_host"(uuid) FROM PUBLIC, "anon", "authenticated";

COMMENT ON FUNCTION "public"."room_member_is_host"(uuid) IS
  'Game Room host gate: true when the member holds an active ''host'' designation (developer passes every designation check). Decides who may open a shared room.';

-- ============================================================================
-- 2. RETIRE THE SWEEP
-- ============================================================================
-- Guarded: pg_cron may be absent on an environment, or the job may already be
-- gone. Either way there is nothing to remove, and that is fine.
DO $$
BEGIN
  PERFORM cron.unschedule('game-room-sweep');
EXCEPTION
  WHEN others THEN NULL; -- no pg_cron, or no such job
END $$;

DROP FUNCTION IF EXISTS "public"."sweep_stale_rooms"(integer);

-- ============================================================================
-- 3. ROOM CAP — dial + check in create_room
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."room_cap_per_host"() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

COMMENT ON FUNCTION "public"."room_cap_per_host"() IS
  'Game Room dial: the most rooms one member may own at once (free and shared together). Rooms no longer self-delete, so this is what keeps them from piling up; create_room refuses too_many_rooms at the cap.';

-- Body copied from 20261010225123_room_occupancy.sql; the ONLY addition is the
-- locked cap check just before the insert.
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
  v_owned  integer;
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

  -- One house, one door at a time — the same key join_room locks on, so a
  -- create and a join for the same owner also queue behind each other. Held
  -- to the end of the transaction, i.e. past the insert below.
  PERFORM pg_advisory_xact_lock(hashtext('room_house:' || v_member.id::text));

  -- Every room this member owns counts, free or shared.
  SELECT count(*)::int INTO v_owned FROM rooms WHERE host_member_id = v_member.id;
  IF v_owned >= room_cap_per_host() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'too_many_rooms', 'max', room_cap_per_host()
    );
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
-- 4. GRANTS — mirror room_occupancy_cap() / create_room
-- ============================================================================
REVOKE EXECUTE ON FUNCTION "public"."room_cap_per_host"() FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."room_cap_per_host"() TO "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) FROM PUBLIC, "anon";
GRANT  EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) TO "authenticated";

COMMENT ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean, integer) IS
  'Game Room: the caller becomes host + first screen. Validates the game''s table list and its declared occupancy (1..room_occupancy_cap(), else bad_occupancy). Shared rooms need the Host designation (not_a_host). An owner may keep at most room_cap_per_host() rooms, free and shared together (too_many_rooms, with max). Returns {ok, reason?/room_id, join_token}.';
