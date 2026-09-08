-- Migration: Tournament paid foundation — Phase C, Unit C2 (self-add join)
--
-- Players self-add to a paid tournament's hopper by scanning a QR / opening a
-- link. That link carries a DISTINCT `join_token` (NOT the public view-only
-- `share_token`, so a spectator holding the share link can't join). The join is
-- an authenticated write that records ONLY the caller's own identity (never a
-- token-supplied id — PF9/PF24).


-- brackets.join_token — the join link/QR token (DB-generated, non-enumerable).
ALTER TABLE "public"."brackets" ADD COLUMN IF NOT EXISTS "join_token" uuid;
UPDATE "public"."brackets" SET "join_token" = gen_random_uuid() WHERE "join_token" IS NULL;
ALTER TABLE "public"."brackets" ALTER COLUMN "join_token" SET DEFAULT gen_random_uuid();
ALTER TABLE "public"."brackets" ALTER COLUMN "join_token" SET NOT NULL;
ALTER TABLE "public"."brackets" DROP CONSTRAINT IF EXISTS "brackets_join_token_key";
ALTER TABLE "public"."brackets" ADD CONSTRAINT "brackets_join_token_key" UNIQUE ("join_token");

COMMENT ON COLUMN "public"."brackets"."join_token" IS
  'Authenticated self-add (hopper) token — distinct from the anon view-only share_token. Encodes only the tournament; the joiner is resolved from auth.uid().';


-- join_bracket_hopper — the caller adds THEMSELVES to the hopper.
CREATE OR REPLACE FUNCTION "public"."join_bracket_hopper"(
  "p_join_token" "uuid",
  "p_via" "text" DEFAULT 'link'
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_member  members%ROWTYPE;
  v_name    text;
  v_via     text;
BEGIN
  v_via := CASE WHEN p_via = 'qr' THEN 'qr' ELSE 'link' END;

  SELECT * INTO v_bracket FROM brackets WHERE join_token = p_join_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Can only join while the tournament is still taking players (setup). Once it
  -- starts / completes / closes, the hopper is done.
  IF v_bracket.status <> 'setup' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_accepting', 'status', v_bracket.status);
  END IF;

  -- The joiner is the CALLER only — resolved from the session, never the token.
  SELECT * INTO v_member FROM members WHERE user_id = auth.uid();
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;

  v_name := COALESCE(
    NULLIF(btrim(v_member.nickname), ''),
    NULLIF(btrim(concat_ws(' ', v_member.first_name, v_member.last_name)), ''),
    'Player'
  );

  -- One identity in a hopper at most once (UNIQUE) — a repeat join is a no-op.
  INSERT INTO bracket_hopper (bracket_id, member_id, display_name, added_via)
  VALUES (v_bracket.id, v_member.id, v_name, v_via)
  ON CONFLICT (bracket_id, member_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'bracket_id', v_bracket.id, 'bracket_name', v_bracket.name);
END;
$$;

-- Authenticated-only: a self-add is a write; anon cannot join (the anon surface is
-- the names-only share view). Postgres/Supabase auto-grant to anon, so revoke.
REVOKE EXECUTE ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") TO "authenticated";

COMMENT ON FUNCTION "public"."join_bracket_hopper"("uuid", "text") IS
  'Self-add: the authenticated caller adds THEMSELVES (member from auth.uid()) to the hopper of the bracket with this join_token, while status=setup. Records only the caller''s identity; repeat join is a no-op. Returns {ok, reason?/bracket_id, bracket_name}. See docs/plans/2026-09-04-001.';
