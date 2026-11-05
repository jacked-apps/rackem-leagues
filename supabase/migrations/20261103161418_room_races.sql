-- Migration: room_races — the Game Room's link to the races played in it
--
-- A Friends race is a race played inside a Game Room. The race tables stay
-- parent-free (a race points at nobody), so the ROOM owns a small link table
-- instead: one row per race played in the room — game 1, Run it back 1, … —
-- numbered by `seq`.
--
-- This is a GAME table under the room's plug-in contract
-- (room_validate_tables): uuid room_id is the first column of a cascading FK
-- to rooms, it is in the realtime publication, REPLICA IDENTITY FULL. So the
-- race game definition lists ['room_races'] as its one table and create_room
-- accepts it unchanged.
--
-- DELETE WITH THE ROOM (R12). Closing the room cascades to its link rows; an
-- AFTER DELETE trigger then deletes each linked race the room OWNS
-- (owns_race = true, the default), and the race's own cascades take its games
-- and confirmations. Nothing a Friends race did survives the room — no cron.
-- A later tournament door links its race with owns_race = false, so the result
-- outlives the room without this table's delete semantics changing.
--
-- RPCs (every one locks the room row, so two phones are serialised):
--
--   open_room_race(room)                    returns the room's latest race, or
--                                           on first open creates race + link 1
--   request_room_race_rematch(room)         a player of the finished latest
--                                           race asks to Run it back; the
--                                           OTHER player asking while one is
--                                           pending counts as an accept
--   answer_room_race_rematch(room, accept)  the other player accepts (next race,
--                                           same two players + settings) or
--                                           denies (request cleared)
--
-- PLAYERS are fixed at the first open: the room host is home, and the
-- earliest OTHER member on the guest list (room_phones by joined_at — rows
-- persist with left_at, so "left" still counts) is away. A later joiner can
-- read the race but race_side_of refuses them, so they can't score it.
--
-- SETTINGS have ONE source: the race game definition writes them into
-- rooms.settings at create (base, break_rule, game_type). This file holds no
-- defaults — a missing key is refused (`missing_setting`) rather than filled.
--
-- Every RPC returns {ok, reason?} rather than raising.
--
-- After applying locally: supabase stop && supabase start (realtime picks up
-- the newly published table), then regenerate types.
--
-- @see docs/plans/2026-11-03-001-feat-room-race-plan.md (Unit 4)


-- ============================================================================
-- 1. TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."room_races" (
    "id"                    uuid        NOT NULL DEFAULT gen_random_uuid(),
    "room_id"               uuid        NOT NULL,
    "race_id"               uuid        NOT NULL,
    "seq"                   integer     NOT NULL,
    "owns_race"             boolean     NOT NULL DEFAULT true,
    "rematch_requested_by"  uuid,
    "created_at"            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "room_races_pkey" PRIMARY KEY ("id"),
    -- room_id FIRST: room_validate_tables reads the FK's first column.
    CONSTRAINT "room_races_room_id_fkey" FOREIGN KEY ("room_id")
        REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
    -- If something else removes the race, the link to it goes too.
    CONSTRAINT "room_races_race_id_fkey" FOREIGN KEY ("race_id")
        REFERENCES "public"."races"("id") ON DELETE CASCADE,
    CONSTRAINT "room_races_rematch_requested_by_fkey" FOREIGN KEY ("rematch_requested_by")
        REFERENCES "public"."members"("id") ON DELETE SET NULL,
    CONSTRAINT "room_races_seq_check" CHECK ("seq" >= 1)
);

-- The concurrency backstop behind the room lock: one race per number per room,
-- so two opens (or two accepts) can never both write race N.
CREATE UNIQUE INDEX IF NOT EXISTS "room_races_room_seq_key" ON "public"."room_races" ("room_id", "seq");
CREATE INDEX IF NOT EXISTS "room_races_race_id_idx" ON "public"."room_races" ("race_id");

COMMENT ON TABLE  "public"."room_races" IS 'Game Room tenant: one row per race played in the room (seq 1 = the first race, 2 = the first Run it back, …). Cascades with the room; a trigger deletes each race the room owns.';
COMMENT ON COLUMN "public"."room_races"."seq" IS 'Order of the race in the room, from 1. Unique with room_id — the backstop behind the room lock.';
COMMENT ON COLUMN "public"."room_races"."owns_race" IS 'true (default) = deleting this link deletes the race (a Friends race dies with its room). false = the race belongs elsewhere (e.g. a tournament) and survives.';
COMMENT ON COLUMN "public"."room_races"."rematch_requested_by" IS 'The member who asked to Run it back, pending the other player''s answer. NULL = no request. Cleared on accept or deny.';

-- Realtime: published + full replica identity (the plug-in contract).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_races'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_races;
  END IF;
END $$;

ALTER TABLE "public"."room_races" REPLICA IDENTITY FULL;


-- ============================================================================
-- 2. DELETE THE LINK → DELETE THE RACE (only a race the room owns)
-- ============================================================================
-- SECURITY DEFINER because the room's cascade may run as the closing host,
-- who has no DELETE on races (writes go through RPCs only).
CREATE OR REPLACE FUNCTION "public"."room_races_delete_owned_race"()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.owns_race THEN
    DELETE FROM races WHERE id = OLD.race_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "room_races_delete_owned_race" ON "public"."room_races";
CREATE TRIGGER "room_races_delete_owned_race"
  AFTER DELETE ON "public"."room_races"
  FOR EACH ROW EXECUTE FUNCTION "public"."room_races_delete_owned_race"();


-- ============================================================================
-- 3. INTERNAL: make race N of this room
-- ============================================================================
-- Reads the race's settings from the room and inserts the race + its link row.
-- Shared by the first open and by a Run it back accept, so the two can never
-- disagree about what a race in this room looks like. The validation mirrors
-- create_race's (goal >= 1, known break rule, known game type) — but the race
-- is inserted directly: create_race's "caller must be a player" check would
-- be the wrong question when a third member opens the room's race.
--
-- Returns {ok:true, race_id, seq} or the refusal to hand back.
CREATE OR REPLACE FUNCTION "public"."room_race_create"(
  "p_room"   "public"."rooms",
  "p_home"   uuid,
  "p_away"   uuid,
  "p_seq"    integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key        text;
  v_base_json  jsonb;
  v_base       integer;
  v_break_rule text;
  v_game_type  text;
  v_race_id    uuid;
BEGIN
  -- No fallback: the race definition is the single source of these values.
  FOREACH v_key IN ARRAY ARRAY['base', 'break_rule', 'game_type'] LOOP
    IF NOT (p_room.settings ? v_key) OR jsonb_typeof(p_room.settings -> v_key) = 'null' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'missing_setting', 'setting', v_key);
    END IF;
  END LOOP;

  -- base must be a whole number >= 1 (a string or 4.5 is a bad goal, not 0).
  v_base_json := p_room.settings -> 'base';
  IF jsonb_typeof(v_base_json) <> 'number'
     OR (v_base_json #>> '{}')::numeric <> floor((v_base_json #>> '{}')::numeric)
     OR (v_base_json #>> '{}')::numeric < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_goal');
  END IF;
  v_base := (v_base_json #>> '{}')::integer;

  v_break_rule := p_room.settings ->> 'break_rule';
  IF v_break_rule NOT IN ('alternate', 'winner_breaks') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_break_rule');
  END IF;

  v_game_type := p_room.settings ->> 'game_type';
  IF v_game_type NOT IN ('eight_ball', 'nine_ball', 'ten_ball') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_game_type');
  END IF;

  IF p_home = p_away THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'need_opponent');
  END IF;

  INSERT INTO races (home_member_id, away_member_id, goal_home, goal_away, break_rule, game_type)
  VALUES (p_home, p_away, v_base, v_base, v_break_rule, v_game_type)
  RETURNING id INTO v_race_id;

  INSERT INTO room_races (room_id, race_id, seq)
  VALUES (p_room.id, v_race_id, p_seq);

  RETURN jsonb_build_object('ok', true, 'race_id', v_race_id, 'seq', p_seq);
END;
$$;


-- ============================================================================
-- 4. open_room_race — the room's race, made once
-- ============================================================================
-- Either phone calls it; both get the same race. If the room already has a
-- race, the LATEST is returned whatever its status — only a Run it back accept
-- makes the next one, so a phone reopening after the finish sees the result.
CREATE OR REPLACE FUNCTION "public"."open_room_race"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_link   room_races%ROWTYPE;
  v_away   uuid;
  v_made   jsonb;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  -- The lock serialises both phones' first open: the second waits here, then
  -- finds the link the first one wrote.
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM room_phones WHERE room_id = p_room_id AND member_id = v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_room');
  END IF;

  SELECT * INTO v_link FROM room_races WHERE room_id = p_room_id ORDER BY seq DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'race_id', v_link.race_id, 'seq', v_link.seq, 'created', false);
  END IF;

  -- Home = the host. Away = the earliest other member on the guest list. A
  -- host's second device is the host, not an opponent.
  SELECT p.member_id INTO v_away
    FROM room_phones p
   WHERE p.room_id = p_room_id AND p.member_id <> v_room.host_member_id
   ORDER BY p.joined_at, p.id
   LIMIT 1;
  IF v_away IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'need_opponent');
  END IF;

  v_made := room_race_create(v_room, v_room.host_member_id, v_away, 1);
  IF (v_made ->> 'ok')::boolean THEN
    RETURN v_made || jsonb_build_object('created', true);
  END IF;
  RETURN v_made;
END;
$$;


-- ============================================================================
-- 5. Run it back — request, and answer
-- ============================================================================

-- request_room_race_rematch — a player of the room's latest race, once it is
-- finished, asks to play again. If the OTHER player already asked, this is an
-- accept (both tapped at once: they both want it). Asking twice yourself is a
-- harmless repeat.
CREATE OR REPLACE FUNCTION "public"."request_room_race_rematch"("p_room_id" uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_link   room_races%ROWTYPE;
  v_race   races%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_link FROM room_races WHERE room_id = p_room_id ORDER BY seq DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_race');
  END IF;
  SELECT * INTO v_race FROM races WHERE id = v_link.race_id;

  IF race_side_of(v_race.id, v_member.id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_player');
  END IF;
  IF v_race.status <> 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finished');
  END IF;

  -- The other player asked first: two requests are one agreement.
  IF v_link.rematch_requested_by IS NOT NULL AND v_link.rematch_requested_by <> v_member.id THEN
    RETURN room_race_rematch_accept(v_room, v_link, v_race);
  END IF;

  UPDATE room_races SET rematch_requested_by = v_member.id WHERE id = v_link.id;
  RETURN jsonb_build_object('ok', true, 'state', 'requested');
END;
$$;

-- Internal: accept a pending Run it back. Same two players, same sides; the
-- settings come from the room (the single source), so the next race matches.
-- The caller holds the room lock.
CREATE OR REPLACE FUNCTION "public"."room_race_rematch_accept"(
  "p_room" "public"."rooms",
  "p_link" "public"."room_races",
  "p_race" "public"."races"
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_made jsonb;
BEGIN
  v_made := room_race_create(p_room, p_race.home_member_id, p_race.away_member_id, p_link.seq + 1);
  IF NOT (v_made ->> 'ok')::boolean THEN
    RETURN v_made; -- request left pending; nothing was written
  END IF;
  UPDATE room_races SET rematch_requested_by = NULL WHERE id = p_link.id;
  RETURN v_made || jsonb_build_object('state', 'accepted');
END;
$$;

-- answer_room_race_rematch — the player who did NOT ask says yes (the next
-- race opens) or no (the request is cleared, nothing is made).
CREATE OR REPLACE FUNCTION "public"."answer_room_race_rematch"("p_room_id" uuid, "p_accept" boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_room   rooms%ROWTYPE;
  v_link   room_races%ROWTYPE;
  v_race   races%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_accept IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_answer');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_link FROM room_races WHERE room_id = p_room_id ORDER BY seq DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_race');
  END IF;
  SELECT * INTO v_race FROM races WHERE id = v_link.race_id;

  IF race_side_of(v_race.id, v_member.id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_player');
  END IF;
  IF v_link.rematch_requested_by IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_request');
  END IF;
  -- You can't say yes to yourself; the other player answers.
  IF v_link.rematch_requested_by = v_member.id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'own_request');
  END IF;

  IF NOT p_accept THEN
    UPDATE room_races SET rematch_requested_by = NULL WHERE id = v_link.id;
    RETURN jsonb_build_object('ok', true, 'state', 'denied');
  END IF;

  -- A vacate after the request could have un-finished the race.
  IF v_race.status <> 'finished' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_finished');
  END IF;
  RETURN room_race_rematch_accept(v_room, v_link, v_race);
END;
$$;


-- ============================================================================
-- 6. GRANTS — mirror the race tables: read-only, writes via RPCs
-- ============================================================================
-- REVOKE ALL (not just the write verbs): the default privileges include
-- TRUNCATE and DELETE, and a direct DELETE here would — through the trigger —
-- delete a race. SELECT for signed-in members; no RLS (relaxed-RLS convention,
-- same as races).
REVOKE ALL ON "public"."room_races" FROM "anon", "authenticated";
GRANT SELECT ON "public"."room_races" TO "authenticated";

REVOKE EXECUTE ON FUNCTION "public"."room_races_delete_owned_race"()                              FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_race_create"("public"."rooms", uuid, uuid, integer)       FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."room_race_rematch_accept"("public"."rooms", "public"."room_races", "public"."races") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."open_room_race"(uuid)                                        FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."request_room_race_rematch"(uuid)                             FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."answer_room_race_rematch"(uuid, boolean)                     FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."open_room_race"(uuid)                                         TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."request_room_race_rematch"(uuid)                              TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."answer_room_race_rematch"(uuid, boolean)                      TO "authenticated";

COMMENT ON FUNCTION "public"."open_room_race"(uuid) IS
  'Game Room race: the room''s latest race, or (first open) a new race — host home vs the earliest other guest-list member away, goals/break rule/game type from rooms.settings (base, break_rule, game_type). Returns {ok, race_id, seq, created} or {ok:false, reason: not_signed_in|not_found|not_in_room|need_opponent|missing_setting(+setting)|bad_goal|bad_break_rule|bad_game_type}.';
COMMENT ON FUNCTION "public"."request_room_race_rematch"(uuid) IS
  'Game Room race: a player of the finished latest race asks to Run it back → {ok, state:requested}. If the other player already asked, this accepts → {ok, state:accepted, race_id, seq}. Refusals: not_signed_in|not_found|no_race|not_a_player|not_finished (+ the open refusals on accept).';
COMMENT ON FUNCTION "public"."answer_room_race_rematch"(uuid, boolean) IS
  'Game Room race: the player who did not ask answers a Run it back. accept → {ok, state:accepted, race_id, seq} (same players, room settings); deny → {ok, state:denied}. Refusals: not_signed_in|bad_answer|not_found|no_race|not_a_player|no_request|own_request|not_finished.';
