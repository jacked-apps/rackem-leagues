-- Migration: a late entrant can see their own tournament
--
-- THE BUG. A walk-in the organizer seats into a bye with `add_late_entry` is
-- written into `bracket_participants` and nowhere else. But the player-facing
-- page does not read that table: `get_bracket_player_view` builds its `waiting`
-- and `official` lists from `bracket_hopper`. So the latecomer is playing in a
-- tournament their own phone cannot see them in.
--
-- It gets worse than invisible. `JoinHopperPage` keeps a local note of the name
-- someone typed, and deletes that note when the lists no longer back it up —
-- correctly, because that is how a player learns the organizer removed them. A
-- latecomer has no hopper row, so the page concludes they were removed, wipes
-- their name, and offers the "add my name" box again. That is refused with
-- `not_accepting`, because `add_self_as_walkup` only runs while the bracket is
-- in setup and this one is live. They are in the bracket, playing matches, and
-- locked out of the page entirely with no way back in.
--
-- THE FIX. Give the latecomer the hopper row everyone else has, marked
-- `official` with the seed they were just given, so every player-facing read
-- treats them exactly like a player who signed up before the start.
--
-- WHY THIS IS AN UPDATE-OR-INSERT AND NOT A PLAIN INSERT. `bracket_hopper`
-- carries two unique indexes that `add_late_entry`'s guards were never written
-- to satisfy, because until now it never touched the table:
--   • (bracket_id, lower(btrim(display_name)))
--   • (bracket_id, member_id)
-- Its `already_in` and `name_taken` checks query `bracket_participants` only.
-- Someone who joined the sign-up list during setup and was never admitted has a
-- hopper row and NO participant row — so they pass both checks, and a plain
-- insert would then hit an unhandled unique violation and turn a routine add
-- into a server error.
--
-- That person is also the most likely latecomer there is: they were standing
-- there the whole time waiting to be let in. So the right answer is not to
-- refuse them — it is to admit the row they already have. A genuine collision
-- with SOMEONE ELSE's row is a different thing and is refused with a reason
-- that says so, rather than the misleading "already in this tournament" — they
-- are on the sign-up list, not in the bracket, and an organizer sent looking
-- for them in the bracket will not find them.
--
-- @see src/brackets/paid/JoinHopperPage.tsx — the note-wiping effect
-- @see supabase/migrations/20260906172524_bracket_player_view.sql — the reads

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
  v_hopper_id uuid;
  v_hopper_name text;
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

  -- Does this arrival already have a sign-up row? A registered player is found
  -- by who they are; a walk-up only by the name they typed, and only against
  -- another walk-up — matching a name to a registered player's row would hand
  -- one person's identity to another.
  IF p_member_id IS NOT NULL THEN
    SELECT id INTO v_hopper_id FROM bracket_hopper
     WHERE bracket_id = m.bracket_id AND member_id = p_member_id;
  ELSE
    SELECT id, display_name INTO v_hopper_id, v_hopper_name FROM bracket_hopper
     WHERE bracket_id = m.bracket_id
       AND member_id IS NULL
       AND lower(btrim(display_name)) = lower(v_name);

    -- Adopt the spelling the PLAYER typed, not the organizer's. JoinHopperPage
    -- matches the name it remembered against this list with an exact string
    -- compare, so admitting "Rocket" as "rocket" would wipe their note and lock
    -- them out just as surely as having no row at all. Their own spelling is
    -- also the one they will recognise on the sign-up list.
    IF v_hopper_id IS NOT NULL THEN
      v_name := v_hopper_name;
    END IF;
  END IF;

  -- The name held by SOMEONE ELSE's sign-up row. Refused before any write, and
  -- named distinctly: "already in this tournament" would send the organizer
  -- looking through a bracket this person is not in.
  IF EXISTS (
    SELECT 1 FROM bracket_hopper
     WHERE bracket_id = m.bracket_id
       AND lower(btrim(display_name)) = lower(v_name)
       AND (v_hopper_id IS NULL OR id <> v_hopper_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_waiting', 'name', v_name);
  END IF;

  -- Seed goes on the end. Seeding is frozen at start; a latecomer is last in.
  SELECT COALESCE(max(seed), 0) + 1 INTO v_seed
    FROM bracket_participants WHERE bracket_id = m.bracket_id;

  INSERT INTO bracket_participants (bracket_id, member_id, display_name, seed, entry_fee_paid)
  VALUES (m.bracket_id, p_member_id, v_name, v_seed, false)
  RETURNING id INTO v_new_id;

  -- The sign-up row, so the player-facing page can see them. Admitted as unpaid
  -- for the same reason finalize_bracket_hopper does it: the organizer has not
  -- said otherwise, and an existing paid flag is never downgraded.
  IF v_hopper_id IS NOT NULL THEN
    UPDATE bracket_hopper
       SET status       = 'official',
           seed         = v_seed,
           display_name = v_name,  -- unchanged for a walk-up; profile name for a member
           paid_status  = COALESCE(paid_status, 'unpaid')
     WHERE id = v_hopper_id;
  ELSE
    INSERT INTO bracket_hopper (bracket_id, member_id, display_name, status, paid_status, seed)
    VALUES (m.bracket_id, p_member_id, v_name, 'official', 'unpaid', v_seed);
  END IF;

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
'Seat a latecomer into an unused bye. Writes BOTH a bracket_participants row and an official bracket_hopper row — the player-facing view reads the hopper, so a participant-only entrant is invisible to their own phone and gets their stored name wiped. Admits an existing sign-up row rather than colliding with it.';
