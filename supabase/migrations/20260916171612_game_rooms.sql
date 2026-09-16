-- Migration: Game Room — Unit 1 (rooms + room_phones schema, RPCs, realtime)
--
-- A generic, perishable, multi-device room that games plug into. The room
-- knows WHO is in it, WHICH game is being played, and WHICH tables that game
-- writes to. It never reads a game's rows. Games bring their own tables; the
-- room validates them here (at creation), listens to them by room_id (client
-- side), and deletes everything with the room (cascade).
-- See docs/plans/2026-09-16-001-feat-game-room-plan.md (Unit 1) and
-- docs/brainstorms/2026-09-16-game-room-requirements.md.
--
-- Shape:
--   rooms        — host, game_key, game_tables (the list the room listens to),
--                  settings (opaque), shared (free room = false), join_token.
--   room_phones  — ONE ROW PER DEVICE per room. A seat is a device, because
--                  Supabase bills per connected socket; a member on a phone
--                  and a tablet holds two seats. Allowance is per PERSON:
--                  open seats = distinct hosts present × 4 − devices present.
--                  A host's second device takes a seat and adds no allowance.
--
-- Every caller is a signed-in member, resolved auth.uid() → members (the
-- join_bracket_hopper template). No anon paths. RPCs return {ok, reason?}
-- rather than raise, so the page can phrase every outcome.
--
-- Host gate (interim): "may this member host a SHARED room" =
-- members.role IN ('league_operator','developer'). One function
-- (room_member_is_host) to swap when the per-hat designations table lands.
--
-- IMPORTANT (realtime): rooms + room_phones are published with REPLICA IDENTITY
-- FULL so filtered UPDATE/DELETE events (room_id=eq.…) carry the full row.
-- After applying locally, run  supabase stop && supabase start  so the
-- realtime container picks up the newly published tables.
--
-- Dials (each one function, swap the constant, nothing else moves):
--   room_table_cap()            3 tables per game
--   room_seats_per_host()       4 devices per host present (host + 3 guests)
--   room_presence_grace()       2 minutes without a heartbeat = not present
--   room_activity_threshold()   room row bumped at most every 5 minutes

-- ============================================================================
-- 0. DIALS
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."room_table_cap"() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;

CREATE OR REPLACE FUNCTION "public"."room_seats_per_host"() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 4 $$;

CREATE OR REPLACE FUNCTION "public"."room_presence_grace"() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '2 minutes' $$;

CREATE OR REPLACE FUNCTION "public"."room_activity_threshold"() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '5 minutes' $$;

-- ============================================================================
-- 1. TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
    "host_member_id"   uuid        NOT NULL,
    "game_key"         text        NOT NULL,
    "game_tables"      text[]      NOT NULL DEFAULT '{}',
    "settings"         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    "shared"           boolean     NOT NULL DEFAULT false,
    "join_token"       uuid        NOT NULL DEFAULT gen_random_uuid(),
    "last_activity_at" timestamptz NOT NULL DEFAULT now(),
    "created_at"       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rooms_join_token_key" UNIQUE ("join_token"),
    CONSTRAINT "rooms_host_member_id_fkey" FOREIGN KEY ("host_member_id")
        REFERENCES "public"."members"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "rooms_last_activity_at_idx" ON "public"."rooms" ("last_activity_at");
CREATE INDEX IF NOT EXISTS "rooms_host_member_id_idx"   ON "public"."rooms" ("host_member_id");

COMMENT ON TABLE  "public"."rooms" IS 'Game Room: a perishable multi-device container games plug into. Never feeds stats. Swept after inactivity; children cascade.';
COMMENT ON COLUMN "public"."rooms"."game_tables" IS 'The tables the current game writes to — the list the room listens to. Validated at write time by room_validate_tables().';
COMMENT ON COLUMN "public"."rooms"."settings"    IS 'The game''s settings. Opaque to the room; written by the game''s setup screen.';
COMMENT ON COLUMN "public"."rooms"."shared"      IS 'false = free room (one device, no realtime channel). true = shared room (host gate applies, others may join).';
COMMENT ON COLUMN "public"."rooms"."join_token"  IS 'The link/QR token. Encodes only the room; the joiner is resolved from auth.uid().';

CREATE TABLE IF NOT EXISTS "public"."room_phones" (
    "id"           uuid        NOT NULL DEFAULT gen_random_uuid(),
    "room_id"      uuid        NOT NULL,
    "member_id"    uuid        NOT NULL,
    "device_id"    uuid        NOT NULL,
    "display_name" text        NOT NULL,
    "is_host"      boolean     NOT NULL DEFAULT false,
    "last_seen_at" timestamptz NOT NULL DEFAULT now(),
    "joined_at"    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "room_phones_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "room_phones_room_device_key" UNIQUE ("room_id", "device_id"),
    CONSTRAINT "room_phones_room_id_fkey" FOREIGN KEY ("room_id")
        REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
    CONSTRAINT "room_phones_member_id_fkey" FOREIGN KEY ("member_id")
        REFERENCES "public"."members"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "room_phones_room_id_idx"   ON "public"."room_phones" ("room_id");
CREATE INDEX IF NOT EXISTS "room_phones_member_id_idx" ON "public"."room_phones" ("member_id");

COMMENT ON TABLE  "public"."room_phones" IS 'One row per DEVICE per room (a seat = a device = a socket). member_id on every row; a member on two devices is two rows.';
COMMENT ON COLUMN "public"."room_phones"."device_id" IS 'Client-minted once per browser (localStorage). A refresh is the same device; a tablet is a new one.';
COMMENT ON COLUMN "public"."room_phones"."is_host"   IS 'Whether this member passed the host gate at join. Allowance = distinct is_host members present × room_seats_per_host().';
COMMENT ON COLUMN "public"."room_phones"."last_seen_at" IS 'Heartbeat. Present = within room_presence_grace(). A sleeping phone keeps its seat for the grace window.';

-- Realtime: filtered UPDATE/DELETE events need the table published + REPLICA
-- IDENTITY FULL (mirrors 20260904160417_tournament_brackets.sql). Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_phones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_phones;
  END IF;
END $$;

ALTER TABLE "public"."rooms"       REPLICA IDENTITY FULL;
ALTER TABLE "public"."room_phones" REPLICA IDENTITY FULL;

-- ============================================================================
-- 2. INTERNAL HELPERS (not callable by clients)
-- ============================================================================

-- The caller as a members row, or NULL. Every RPC starts here.
CREATE OR REPLACE FUNCTION "public"."room_current_member"()
RETURNS "public"."members"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT m.* FROM members m WHERE m.user_id = auth.uid() LIMIT 1 $$;

-- THE HOST GATE (interim). "May this member host a shared room?"
-- Today: league operators and developers. Swap this body when the per-member
-- designations table lands; nothing else references the rule.
CREATE OR REPLACE FUNCTION "public"."room_member_is_host"("p_member_id" uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE id = p_member_id AND role IN ('league_operator', 'developer')
  )
$$;

-- Display name for a room: nickname, else "First Last", else 'Player'.
CREATE OR REPLACE FUNCTION "public"."room_display_name"("p_member" "public"."members")
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(btrim(p_member.nickname), ''),
    NULLIF(btrim(concat_ws(' ', p_member.first_name, p_member.last_name)), ''),
    'Player'
  )
$$;

-- Validate a game's table list. Returns NULL when every table is ready, else
-- the {ok:false, ...} jsonb to hand straight back to the caller.
--
-- A table is READY when it: is not a reserved room table; exists in public;
-- has a uuid room_id column; that column is a FK to rooms ON DELETE CASCADE
-- (so cleanup is free and orphans are impossible); is in the realtime
-- publication; has REPLICA IDENTITY FULL (so filtered UPDATE/DELETE events —
-- a race's rollback is a DELETE — actually reach the other devices). Any of
-- these missing would fail silently AT PLAY, so we refuse AT SETUP and name
-- what is missing. Only names that pass here are ever interpolated into the
-- wipe (set_room_game), which is what makes that dynamic SQL safe.
CREATE OR REPLACE FUNCTION "public"."room_validate_tables"("p_tables" text[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t       text;
  v_rel   oid;
  v_seen  text[] := '{}';
BEGIN
  IF p_tables IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_tables');
  END IF;
  IF cardinality(p_tables) > room_table_cap() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_tables', 'max', room_table_cap());
  END IF;

  FOREACH t IN ARRAY p_tables LOOP
    IF t = ANY (v_seen) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_table', 'table', t);
    END IF;
    v_seen := v_seen || t;

    IF t IN ('rooms', 'room_phones') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_reserved', 'table', t);
    END IF;

    SELECT c.oid INTO v_rel
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r';
    IF v_rel IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_not_ready', 'table', t, 'missing', 'table');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute a
       WHERE a.attrelid = v_rel AND a.attname = 'room_id'
         AND NOT a.attisdropped AND a.atttypid = 'uuid'::regtype
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_not_ready', 'table', t, 'missing', 'room_id_uuid');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint k
       WHERE k.conrelid = v_rel AND k.contype = 'f'
         AND k.confrelid = 'public.rooms'::regclass AND k.confdeltype = 'c'
         AND (SELECT attname FROM pg_attribute WHERE attrelid = v_rel AND attnum = k.conkey[1]) = 'room_id'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_not_ready', 'table', t, 'missing', 'cascade_fk');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_not_ready', 'table', t, 'missing', 'publication');
    END IF;

    IF (SELECT relreplident FROM pg_class WHERE oid = v_rel) <> 'f' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'table_not_ready', 'table', t, 'missing', 'replica_identity');
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Seat math, in ONE place, so join_room and the pages never disagree.
--   devices = rows seen within the grace window
--   hosts   = DISTINCT members among those rows with is_host (a host on two
--             devices is one host — allowance is per person)
--   open    = hosts × room_seats_per_host() − devices
CREATE OR REPLACE FUNCTION "public"."room_seats"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH present AS (
    SELECT member_id, is_host
      FROM room_phones
     WHERE room_id = p_room_id
       AND last_seen_at > now() - room_presence_grace()
  ),
  counts AS (
    SELECT count(*)::int AS devices,
           count(DISTINCT member_id) FILTER (WHERE is_host)::int AS hosts
      FROM present
  )
  SELECT jsonb_build_object(
    'devices', devices,
    'hosts',   hosts,
    'open',    hosts * room_seats_per_host() - devices
  ) FROM counts
$$;

-- The room as the pages see it: the row (minus nothing secret — there is
-- nothing secret), derived seats, and every device with a server-computed
-- is_present so a phone with a skewed clock never disagrees with the count.
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
        'last_seen_at', rp.last_seen_at,
        'joined_at',    rp.joined_at
      ) ORDER BY rp.joined_at)
      FROM room_phones rp WHERE rp.room_id = p_room.id
    ), '[]'::jsonb)
  )
$$;

-- ============================================================================
-- 3. RPCs
-- ============================================================================

-- create_room — the caller becomes the host and the first device.
-- A FREE room (p_shared=false) needs only a signed-in member. A SHARED room
-- needs the host gate. Tables are validated here so a game that forgot its
-- realtime setup fails now, with the reason, not silently at play.
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
  v_is_host boolean;
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

  v_is_host := room_member_is_host(v_member.id);
  IF p_shared AND NOT v_is_host THEN
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
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), v_is_host);

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'join_token', v_room.join_token);
END;
$$;

-- join_room — the caller's DEVICE takes a seat.
-- Refuses a free room. Locks the room row so two devices cannot both take the
-- last seat. A device already in the room just refreshes (a refresh or rejoin
-- is not a new device); a second device of the same member IS a new device.
CREATE OR REPLACE FUNCTION "public"."join_room"(
  "p_join_token" uuid,
  "p_device_id"  uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_phone  room_phones%ROWTYPE;
  v_seats  jsonb;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_device_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_device');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE join_token = p_join_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT v_room.shared THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_shared');
  END IF;

  -- Already here on this device → refresh, no seat consumed.
  SELECT * INTO v_phone FROM room_phones
   WHERE room_id = v_room.id AND device_id = p_device_id;
  IF FOUND THEN
    UPDATE room_phones
       SET last_seen_at = now(),
           member_id    = v_member.id,
           display_name = room_display_name(v_member),
           is_host      = room_member_is_host(v_member.id)
     WHERE id = v_phone.id;
    RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', true);
  END IF;

  v_seats := room_seats(v_room.id);
  IF (v_seats->>'open')::int <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'full', 'seats', v_seats,
      'hint', 'another host joining opens more seats'
    );
  END IF;

  INSERT INTO room_phones (room_id, member_id, device_id, display_name, is_host)
  VALUES (v_room.id, v_member.id, p_device_id, room_display_name(v_member), room_member_is_host(v_member.id))
  RETURNING * INTO v_phone;

  UPDATE rooms SET last_activity_at = now() WHERE id = v_room.id;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'phone_id', v_phone.id, 'rejoined', false);
END;
$$;

-- room_heartbeat — "this device is still here." Bumps the phone row every
-- call; bumps the ROOM row only when it is older than the threshold so the
-- room row's realtime event is rare (the client also ignores it, but rare
-- writes are cheaper than ignored events). Activity is room-owned: games
-- contribute nothing, so a free room is never swept mid-play.
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

  UPDATE room_phones SET last_seen_at = now()
   WHERE room_id = p_room_id AND device_id = p_device_id AND member_id = v_member.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_room');
  END IF;

  UPDATE rooms SET last_activity_at = now()
   WHERE id = p_room_id AND last_activity_at < now() - room_activity_threshold();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- set_room_game — a NEW game in the same room: validate the new table list,
-- WIPE the old game's rows (by room_id, from each previously listed table),
-- then update the row. The new list is validated before anything is deleted,
-- so a refused switch leaves the old game intact. The names interpolated are
-- read from the STORED row (already validated), schema-qualified, %I-quoted.
CREATE OR REPLACE FUNCTION "public"."set_room_game"(
  "p_room_id"  uuid,
  "p_game_key" text,
  "p_tables"   text[],
  "p_settings" jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_err    jsonb;
  t        text;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_game_key IS NULL OR btrim(p_game_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_game');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_room.host_member_id <> v_member.id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_host');
  END IF;

  v_err := room_validate_tables(p_tables);
  IF v_err IS NOT NULL THEN
    RETURN v_err;
  END IF;

  FOREACH t IN ARRAY v_room.game_tables LOOP
    EXECUTE format('DELETE FROM public.%I WHERE room_id = $1', t) USING v_room.id;
  END LOOP;

  UPDATE rooms
     SET game_key = p_game_key,
         game_tables = p_tables,
         settings = COALESCE(p_settings, '{}'::jsonb),
         last_activity_at = now()
   WHERE id = v_room.id;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id);
END;
$$;

-- set_room_settings — change a game's settings mid-play WITHOUT wiping.
CREATE OR REPLACE FUNCTION "public"."set_room_settings"(
  "p_room_id"  uuid,
  "p_settings" jsonb
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

  UPDATE rooms SET settings = COALESCE(p_settings, '{}'::jsonb), last_activity_at = now()
   WHERE id = v_room.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- set_room_shared — open (or shut) the door in place. The game in progress
-- does not notice. Opening needs the host gate; shutting never does.
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
  -- The host's own phone row(s) carry the gate result too.
  UPDATE room_phones SET is_host = room_member_is_host(v_member.id)
   WHERE room_id = v_room.id AND member_id = v_member.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- close_room — the host ends it. Deleting the row cascades to phones and to
-- every game table (their FKs are validated cascade). Other devices receive
-- the rooms DELETE and render "this room has ended"; a device that was asleep
-- learns the same thing when its next room read comes back empty.
CREATE OR REPLACE FUNCTION "public"."close_room"("p_room_id" uuid)
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

  DELETE FROM rooms WHERE id = v_room.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- get_room_by_token — what the join page shows before joining. Unknown or
-- swept token → {found:false}, which the page renders as "this room has
-- ended", never as an error.
CREATE OR REPLACE FUNCTION "public"."get_room_by_token"("p_join_token" uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN room_state(v_room);
END;
$$;

-- get_room — the room page's read. Same shape; {found:false} once deleted.
CREATE OR REPLACE FUNCTION "public"."get_room"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  RETURN room_state(v_room);
END;
$$;

-- ============================================================================
-- 4. GRANTS — every caller is a signed-in member. Nothing for anon.
-- Postgres grants EXECUTE to PUBLIC and Supabase auto-grants to anon; revoke.
-- ============================================================================
-- Internal helpers: not even authenticated may call these directly. They run
-- inside the SECURITY DEFINER RPCs as the owner, which is all they are for.
-- (Supabase default privileges grant new functions to authenticated as well as
-- anon, so both are revoked.)
REVOKE EXECUTE ON FUNCTION "public"."room_current_member"()                              FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_member_is_host"(uuid)                          FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_display_name"("public"."members")              FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_validate_tables"(text[])                       FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_state"("public"."rooms")                       FROM PUBLIC, "anon", "authenticated";
-- room_seats is the one helper a page may read directly (the seat counter).
REVOKE EXECUTE ON FUNCTION "public"."room_seats"(uuid)                                   FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean)    FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."join_room"(uuid, uuid)                              FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."room_heartbeat"(uuid, uuid)                         FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."set_room_game"(uuid, text, text[], jsonb)           FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."set_room_settings"(uuid, jsonb)                     FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."set_room_shared"(uuid, boolean)                     FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."close_room"(uuid)                                   FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."get_room_by_token"(uuid)                            FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."get_room"(uuid)                                     FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."room_seats"(uuid)                                    TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean)     TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."join_room"(uuid, uuid)                               TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."room_heartbeat"(uuid, uuid)                          TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_room_game"(uuid, text, text[], jsonb)            TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_room_settings"(uuid, jsonb)                      TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_room_shared"(uuid, boolean)                      TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."close_room"(uuid)                                    TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_room_by_token"(uuid)                             TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_room"(uuid)                                      TO "authenticated";

COMMENT ON FUNCTION "public"."create_room"(text, text[], uuid, jsonb, boolean) IS
  'Game Room: the caller becomes host + first device. Validates the game''s table list (room_validate_tables). Shared rooms need the host gate. Returns {ok, reason?/room_id, join_token}.';
COMMENT ON FUNCTION "public"."join_room"(uuid, uuid) IS
  'Game Room: the caller''s DEVICE takes a seat (distinct hosts present × 4 − devices present). Refuses free rooms; same device = refresh. Returns {ok, reason?/room_id, phone_id, rejoined}.';
COMMENT ON FUNCTION "public"."room_heartbeat"(uuid, uuid) IS
  'Game Room: keeps a device present (grace window) and bumps room activity at most every 5 minutes.';
COMMENT ON FUNCTION "public"."set_room_game"(uuid, text, text[], jsonb) IS
  'Game Room: host switches game. Validates the new tables, WIPES the old game''s rows by room_id, updates the row.';
COMMENT ON FUNCTION "public"."room_validate_tables"(text[]) IS
  'Game Room plug-in contract check: reserved? exists? uuid room_id? cascade FK to rooms? published? REPLICA IDENTITY FULL? NULL when ready, else {ok:false, reason, table, missing}.';
