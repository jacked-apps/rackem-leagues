-- Migration: Game Room — Unit 6 (the first tenant: a two-phone coin flip)
--
-- One phone calls, the other throws, and the DATABASE picks the face — so no
-- phone can lean on it, and two screens can never disagree about who won.
-- See docs/plans/2026-09-16-001-feat-game-room-plan.md (Unit 6).
--
-- This table is a GAME table under the room's plug-in contract
-- (room_validate_tables): uuid room_id with a cascading FK to rooms, in the
-- realtime publication, REPLICA IDENTITY FULL. The room wipes it by room_id
-- on a game switch and the cascade removes it when the room dies. The room
-- never reads it.
--
-- Shape: one row per flip. `call` is set by the caller phone, `face` by the
-- flipper phone's throw. Both go through RPCs — nothing about the flip is a
-- plain update:
--   start_room_coin_flip(room, caller_phone, flipper_phone) → a fresh row
--   call_room_coin(flip, call)   the caller phone only; refused once thrown
--   throw_room_coin(flip)        the flipper phone only; needs a call; once
-- "Flip again" is a new row. History is fine; it dies with the room.
--
-- Every caller is a signed-in member resolved via room_current_member(); a
-- phone "belongs" to the caller when room_phones.member_id matches. RPCs
-- return {ok, reason?} rather than raise.
--
-- After applying locally: supabase stop && supabase start (realtime picks up
-- the newly published table), then pnpm run db:types.

-- ============================================================================
-- 1. TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."room_coin_flips" (
    "id"               uuid        NOT NULL DEFAULT gen_random_uuid(),
    "room_id"          uuid        NOT NULL,
    "caller_phone_id"  uuid        NOT NULL,
    "flipper_phone_id" uuid        NOT NULL,
    "call"             text,
    "face"             text,
    "thrown_at"        timestamptz,
    "created_at"       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "room_coin_flips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "room_coin_flips_room_id_fkey" FOREIGN KEY ("room_id")
        REFERENCES "public"."rooms"("id") ON DELETE CASCADE,
    CONSTRAINT "room_coin_flips_caller_phone_id_fkey" FOREIGN KEY ("caller_phone_id")
        REFERENCES "public"."room_phones"("id") ON DELETE CASCADE,
    CONSTRAINT "room_coin_flips_flipper_phone_id_fkey" FOREIGN KEY ("flipper_phone_id")
        REFERENCES "public"."room_phones"("id") ON DELETE CASCADE,
    CONSTRAINT "room_coin_flips_call_check" CHECK ("call" IS NULL OR "call" IN ('heads', 'tails')),
    CONSTRAINT "room_coin_flips_face_check" CHECK ("face" IS NULL OR "face" IN ('heads', 'tails')),
    CONSTRAINT "room_coin_flips_two_phones_check" CHECK ("caller_phone_id" <> "flipper_phone_id")
);
CREATE INDEX IF NOT EXISTS "room_coin_flips_room_id_idx" ON "public"."room_coin_flips" ("room_id", "created_at" DESC);

COMMENT ON TABLE  "public"."room_coin_flips" IS 'Game Room tenant: one row per two-phone coin flip. call by the caller phone, face by the database on the flipper phone''s throw. Wiped by room_id on game switch; cascades with the room.';
COMMENT ON COLUMN "public"."room_coin_flips"."call" IS 'heads|tails, set via call_room_coin by the caller phone. Frozen once face is set.';
COMMENT ON COLUMN "public"."room_coin_flips"."face" IS 'heads|tails, set ONCE via throw_room_coin from random(). Never client-supplied.';

-- Realtime: published + full replica identity (the plug-in contract).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_coin_flips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_coin_flips;
  END IF;
END $$;

ALTER TABLE "public"."room_coin_flips" REPLICA IDENTITY FULL;

-- ============================================================================
-- 2. RPCs
-- ============================================================================

-- Does this phone row belong to the calling member, in this room?
CREATE OR REPLACE FUNCTION "public"."room_phone_is_mine"("p_phone_id" uuid, "p_room_id" uuid, "p_member_id" uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_phones
    WHERE id = p_phone_id AND room_id = p_room_id AND member_id = p_member_id
  )
$$;

-- start_room_coin_flip — a fresh flip between two phones in the room. The
-- caller must be one of the two (you cannot set up a flip you are not in).
CREATE OR REPLACE FUNCTION "public"."start_room_coin_flip"(
  "p_room_id"          uuid,
  "p_caller_phone_id"  uuid,
  "p_flipper_phone_id" uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_flip_id uuid;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE id = p_room_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF p_caller_phone_id = p_flipper_phone_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_phone');
  END IF;
  -- Both phones must be in THIS room.
  IF (SELECT count(*) FROM room_phones
       WHERE room_id = p_room_id AND id IN (p_caller_phone_id, p_flipper_phone_id)) <> 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'phone_not_in_room');
  END IF;
  IF NOT room_phone_is_mine(p_caller_phone_id, p_room_id, v_member.id)
     AND NOT room_phone_is_mine(p_flipper_phone_id, p_room_id, v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_flip');
  END IF;

  INSERT INTO room_coin_flips (room_id, caller_phone_id, flipper_phone_id)
  VALUES (p_room_id, p_caller_phone_id, p_flipper_phone_id)
  RETURNING id INTO v_flip_id;

  RETURN jsonb_build_object('ok', true, 'flip_id', v_flip_id);
END;
$$;

-- call_room_coin — the caller phone names a side. May be changed until the
-- throw; refused after, so nobody rewrites the call having seen the face.
CREATE OR REPLACE FUNCTION "public"."call_room_coin"(
  "p_flip_id" uuid,
  "p_call"    text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_flip room_coin_flips%ROWTYPE;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  IF p_call IS NULL OR p_call NOT IN ('heads', 'tails') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_call');
  END IF;

  SELECT * INTO v_flip FROM room_coin_flips WHERE id = p_flip_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT room_phone_is_mine(v_flip.caller_phone_id, v_flip.room_id, v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_caller');
  END IF;
  IF v_flip.face IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_thrown');
  END IF;

  UPDATE room_coin_flips SET call = p_call WHERE id = p_flip_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- throw_room_coin — the flipper phone throws; the DATABASE picks the face.
-- Needs a call on record (a throw before the call would let the caller pick
-- after seeing the face) and happens exactly once.
CREATE OR REPLACE FUNCTION "public"."throw_room_coin"("p_flip_id" uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_flip room_coin_flips%ROWTYPE;
  v_face text;
BEGIN
  v_member := room_current_member();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  SELECT * INTO v_flip FROM room_coin_flips WHERE id = p_flip_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT room_phone_is_mine(v_flip.flipper_phone_id, v_flip.room_id, v_member.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_flipper');
  END IF;
  IF v_flip.call IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_call');
  END IF;
  IF v_flip.face IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_thrown');
  END IF;

  v_face := CASE WHEN random() < 0.5 THEN 'heads' ELSE 'tails' END;
  UPDATE room_coin_flips SET face = v_face, thrown_at = now() WHERE id = p_flip_id;
  RETURN jsonb_build_object('ok', true, 'face', v_face);
END;
$$;

-- ============================================================================
-- 3. GRANTS — signed-in members only; the helper is internal.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION "public"."room_phone_is_mine"(uuid, uuid, uuid)          FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."start_room_coin_flip"(uuid, uuid, uuid)        FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."call_room_coin"(uuid, text)                    FROM PUBLIC, "anon";
REVOKE EXECUTE ON FUNCTION "public"."throw_room_coin"(uuid)                         FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."start_room_coin_flip"(uuid, uuid, uuid)         TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."call_room_coin"(uuid, text)                     TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."throw_room_coin"(uuid)                          TO "authenticated";

COMMENT ON FUNCTION "public"."start_room_coin_flip"(uuid, uuid, uuid) IS
  'Game Room coin flip: a fresh flip between two phones in the room; the caller must be one of them. Returns {ok, flip_id} or {ok:false, reason}.';
COMMENT ON FUNCTION "public"."call_room_coin"(uuid, text) IS
  'Game Room coin flip: the caller phone names heads|tails. Changeable until the throw; refused after (already_thrown).';
COMMENT ON FUNCTION "public"."throw_room_coin"(uuid) IS
  'Game Room coin flip: the flipper phone throws; the database sets face from random() exactly once. Needs a call (no_call).';
