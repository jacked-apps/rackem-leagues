-- Migration: Tournament brackets — late entry into a bye
--
-- add_late_entry(match_id, member_id?, display_name?) — someone turns up after
-- the tournament has started and takes an unused bye.
--
-- This is established tournament practice, not an invention: "a common practice
-- allows late entrants to replace a bye after the tournament has already
-- started, but before the first round has concluded." The bye seat is the ONLY
-- place a latecomer can go — every other empty slot belongs to a player who
-- must first win their way into it, and losers-bracket seats belong to someone
-- who has already lost.
--
-- TWO CONDITIONS, both required:
--   1. There is a bye — a settled winners round-1 match with an empty seat.
--   2. Its recipient has not PLAYED or STARTED their next match. You cannot
--      pull someone off a table to make them play a round they already passed.
--
-- The "not played" half is enforced by reopen_bracket_match, which this calls
-- rather than reimplementing: it already refuses when a downstream match is
-- complete, clears the winner, and pulls the advanced player back out. The
-- "not started" half is checked here, because reopen is UNDO — correcting a
-- mis-tapped winner mid-game is legitimate, changing the field is not.
--
-- NOTE on in_progress: it is a manual flag today, so a diligent organizer gets
-- this protection and a distracted one doesn't. That improves on its own once
-- self-scoring lands and both players confirm to start a match. The completed-
-- match check is the real backstop; this is the courtesy one.
--
-- PREMIUM: any paid tournament. Deliberately NOT tied to a particular feature —
-- it is a quality-of-life extra for paying at all, not something to price. So
-- the gate is tier, not a feature key, and that is not a gating leak.

CREATE OR REPLACE FUNCTION "public"."add_late_entry"(
  "p_match_id" "uuid",
  "p_member_id" "uuid" DEFAULT NULL,
  "p_display_name" text DEFAULT NULL
)
RETURNS "jsonb"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  m           bracket_matches%ROWTYPE;
  v_bracket   brackets%ROWTYPE;
  v_member    members%ROWTYPE;
  v_next      bracket_matches%ROWTYPE;
  v_name      text;
  v_seat      text;
  v_seed      integer;
  v_new_id    uuid;
  c_max_name  CONSTANT integer := 24;
BEGIN
  SELECT * INTO m FROM bracket_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO v_bracket FROM brackets WHERE id = m.bracket_id;

  IF v_bracket.tier IS DISTINCT FROM 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_premium');
  END IF;

  -- Before the start, players go in through the hopper; after it ends there is
  -- nothing to join.
  IF v_bracket.status <> 'live' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_live', 'status', v_bracket.status);
  END IF;

  -- A bye: settled winners round 1 with exactly one seat taken.
  IF NOT (
    m.side = 'winners' AND m.round = 1 AND m.status = 'complete'
    AND ((m.home_participant_id IS NULL) <> (m.away_participant_id IS NULL))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_a_bye');
  END IF;

  v_seat := CASE WHEN m.home_participant_id IS NULL THEN 'home' ELSE 'away' END;

  -- Condition 2. Checked before anything is written so a refusal changes nothing.
  IF m.next_match_id IS NOT NULL THEN
    SELECT * INTO v_next FROM bracket_matches WHERE id = m.next_match_id;
    IF v_next.status = 'complete' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_played');
    END IF;
    IF v_next.in_progress THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_started');
    END IF;
  END IF;

  -- Resolve who is arriving. A registered player's name comes from their
  -- profile, exactly as it does everywhere else in this feature.
  IF p_member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM members WHERE id = p_member_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_such_player');
    END IF;
    IF v_member.user_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_registered');
    END IF;
    IF EXISTS (
      SELECT 1 FROM bracket_participants
       WHERE bracket_id = m.bracket_id AND member_id = p_member_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_in');
    END IF;
    v_name := COALESCE(
      NULLIF(btrim(v_member.nickname), ''),
      NULLIF(btrim(concat_ws(' ', v_member.first_name, v_member.last_name)), ''),
      'Player'
    );
  ELSE
    v_name := btrim(COALESCE(p_display_name, ''));
    IF v_name = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
    END IF;
    IF char_length(v_name) > c_max_name THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long', 'max', c_max_name);
    END IF;
  END IF;

  -- Same one-name-per-tournament rule the hopper enforces, for the same reason:
  -- two identical names on a bracket cannot be told apart.
  IF EXISTS (
    SELECT 1 FROM bracket_participants
     WHERE bracket_id = m.bracket_id AND lower(btrim(display_name)) = lower(v_name)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_taken', 'name', v_name);
  END IF;

  -- Seed goes on the end. Seeding is frozen at start; a latecomer is last in.
  SELECT COALESCE(max(seed), 0) + 1 INTO v_seed
    FROM bracket_participants WHERE bracket_id = m.bracket_id;

  INSERT INTO bracket_participants (bracket_id, member_id, display_name, seed, entry_fee_paid)
  VALUES (m.bracket_id, p_member_id, v_name, v_seed, false)
  RETURNING id INTO v_new_id;

  -- Undo the bye: clears the winner and pulls them back out of round 2. Reused
  -- rather than reimplemented so there is one definition of "un-advance".
  PERFORM reopen_bracket_match(p_match_id);

  -- Seat the latecomer opposite them. Both seats filled ⇒ a real game to play.
  IF v_seat = 'home' THEN
    UPDATE bracket_matches SET home_participant_id = v_new_id, status = 'ready'
     WHERE id = p_match_id;
  ELSE
    UPDATE bracket_matches SET away_participant_id = v_new_id, status = 'ready'
     WHERE id = p_match_id;
  END IF;

  UPDATE brackets SET last_activity_at = now() WHERE id = m.bracket_id;

  RETURN jsonb_build_object('ok', true, 'name', v_name, 'participant_id', v_new_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."add_late_entry"("uuid", "uuid", text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."add_late_entry"("uuid", "uuid", text) TO "authenticated";

COMMENT ON FUNCTION "public"."add_late_entry"("uuid", "uuid", text) IS
  'Seat a latecomer in an unused bye (paid tournaments only). Requires a settled winners round-1 match with an empty seat whose recipient has not played OR started their next match. Reuses reopen_bracket_match to un-advance the bye winner. Returns {ok, reason?} with not_found | not_premium | not_live | not_a_bye | already_played | already_started | no_such_player | not_registered | already_in | name_required | name_too_long | name_taken.';
