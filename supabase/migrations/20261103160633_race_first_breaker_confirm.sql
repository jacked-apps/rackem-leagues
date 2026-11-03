-- Migration: who breaks first is PROPOSED by one player and CONFIRMED by the other
--
-- Before this, `start_race` was one tap: whoever got there first named who
-- breaks, and game 1 appeared. That let one phone decide for both players. A
-- race has no referee, so the two players must agree, and the app writes down
-- what they agreed — it never settles a disagreement.
--
-- start_race(p_race_id, p_first_breaker_side) now walks this table:
--
--   no proposal yet                      -> record it (status stays 'created',
--                                           no game 1)
--   the proposer calls again (any side)  -> replace the proposal (they changed
--                                           their mind before it was confirmed)
--   the OTHER player, SAME side          -> confirmed: first_breaker_side is
--                                           set, status in_play, game 1 written
--   the OTHER player, DIFFERENT side     -> refused 'not_your_proposal',
--                                           proposal unchanged
--   a non-player                         -> refused 'not_in_race'
--   race already started                 -> ok + 'already_started' (idempotent)
--
-- The refused case is what happens when both players tap different names
-- before realtime shows either phone the other's pick. The proposal that
-- landed first stands; the second phone is told who picked and refetches.
-- There is no "change" for the non-proposer — they confirm, or the two of them
-- sort it out at the table and the proposer changes it.
--
-- WHY NEW COLUMNS rather than reusing first_breaker_side for the proposal:
-- race_breaker_side() and race_advance() read first_breaker_side as "decided".
-- Keeping it NULL until the confirm means neither of them needed to change.
--
-- The proposal columns are KEPT after the start (not cleared). They then say
-- who named the breaker; the confirmer is the other player. Nothing reads them
-- once status leaves 'created'.
--
-- @see docs/plans/2026-11-03-001-feat-room-race-plan.md (Unit 3)


-- ============================================================================
-- 1. The proposal
-- ============================================================================

ALTER TABLE "public"."races"
  ADD COLUMN "first_breaker_proposed_side" "text",
  ADD COLUMN "first_breaker_proposed_by" "uuid",
  ADD CONSTRAINT "races_first_breaker_proposed_side_check"
    CHECK ("first_breaker_proposed_side" IS NULL
           OR "first_breaker_proposed_side" = ANY (ARRAY['home'::"text", 'away'::"text"])),
  -- A proposal is a side AND who said it; one without the other is meaningless.
  ADD CONSTRAINT "races_first_breaker_proposal_complete_check"
    CHECK (("first_breaker_proposed_side" IS NULL) = ("first_breaker_proposed_by" IS NULL)),
  ADD CONSTRAINT "races_first_breaker_proposed_by_fkey"
    FOREIGN KEY ("first_breaker_proposed_by") REFERENCES "public"."members"("id");

COMMENT ON COLUMN "public"."races"."first_breaker_proposed_side" IS
'Who breaks game 1, as PROPOSED by one player and not yet confirmed by the other. NULL until someone picks. Kept after the start as a record of what was named.';
COMMENT ON COLUMN "public"."races"."first_breaker_proposed_by" IS
'The member who made the proposal. The other player confirms it (start_race with the same side) to start the race; the proposer may replace it until then.';
COMMENT ON COLUMN "public"."races"."first_breaker_side" IS
'Who breaks game 1 — set only once BOTH players agree (one proposes, the other confirms). NULL until then; the race cannot start without it.';


-- ============================================================================
-- 2. start_race — propose, change, or confirm who breaks
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."start_race"(p_race_id uuid, p_first_breaker_side text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_member uuid := get_current_member_id();
  v_race   races%ROWTYPE;
  v_side   text;
BEGIN
  IF p_first_breaker_side IS NULL OR p_first_breaker_side NOT IN ('home', 'away') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_side');
  END IF;

  -- The lock serialises the two phones: if both tap at once, one proposes and
  -- the other then sees that proposal and either confirms or is refused.
  SELECT * INTO v_race FROM races WHERE id = p_race_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_race');
  END IF;

  v_side := race_side_of(p_race_id, v_member);
  IF v_side IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_race');
  END IF;

  -- Idempotent: a late tap after the start is a no-op, not an error.
  IF v_race.status <> 'created' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_started');
  END IF;

  -- Nobody has picked yet, or the proposer is changing their own pick.
  IF v_race.first_breaker_proposed_by IS NULL
     OR v_race.first_breaker_proposed_by = v_member THEN
    UPDATE races
    SET first_breaker_proposed_side = p_first_breaker_side,
        first_breaker_proposed_by   = v_member,
        last_activity_at            = now()
    WHERE id = p_race_id;
    RETURN jsonb_build_object('ok', true, 'state', 'proposed', 'side', p_first_breaker_side);
  END IF;

  -- The other player named a different side. The app does not referee: the
  -- proposal stands, and the answer says whose it is so the phone can say so.
  IF v_race.first_breaker_proposed_side <> p_first_breaker_side THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'not_your_proposal',
      'proposed_side', v_race.first_breaker_proposed_side,
      'proposed_by_side', race_side_of(p_race_id, v_race.first_breaker_proposed_by)
    );
  END IF;

  -- Confirmed: both players named the same side. Now the race starts.
  UPDATE races
  SET first_breaker_side = p_first_breaker_side, status = 'in_play', last_activity_at = now()
  WHERE id = p_race_id;

  INSERT INTO race_games (race_id, game_number, home_action, away_action, game_type)
  VALUES (
    p_race_id, 1,
    CASE WHEN p_first_breaker_side = 'home' THEN 'breaks' ELSE 'racks' END,
    CASE WHEN p_first_breaker_side = 'away' THEN 'breaks' ELSE 'racks' END,
    v_race.game_type
  )
  ON CONFLICT (race_id, game_number) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'state', 'started');
END;
$$;

COMMENT ON FUNCTION "public"."start_race"(uuid, text) IS
'Who breaks game 1, agreed by both players. The first call records a proposal; the proposer may re-call to change it; the OTHER player calling with the SAME side starts the race (game 1 written). The other player naming a different side is refused (not_your_proposal). Idempotent once started.';


-- ============================================================================
-- 3. Grants — unchanged, restated
-- ============================================================================
--
-- CREATE OR REPLACE keeps the existing ACL, but restating it here means this
-- file alone shows the function is authenticated-only. Both default grants
-- (PUBLIC from CREATE FUNCTION, anon from this database's default privileges)
-- are revoked, as in the race engine migration.

REVOKE ALL ON FUNCTION "public"."start_race"(uuid, text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_race"(uuid, text) TO authenticated;
