-- Migration: bracket write RPCs — Free Tier v1 (Unit 3)
--
-- Two operations need to be atomic against the bracket tree, so they live in
-- SECURITY DEFINER functions (mirrors prep_match / swap_player_in_lineup):
--
--   start_bracket(p_bracket_id, p_matches jsonb)
--     Persists the engine-generated match tree in ONE call: inserts every
--     match row, resolves the engine's local string `key` references
--     (next_match_key / loser_next_match_key) into real match uuids in a second
--     pass, maps seed numbers → participant uuids, and flips the bracket to
--     'live'. All-or-nothing (a function body is one transaction).
--
--   advance_bracket_winner(p_match_id, p_winner_participant_id)
--     The GUARDED advance: sets the winner ONLY when the match is still 'ready'
--     with no winner yet (so a stale/duplicate/second-device tap can't
--     overwrite a decided match), propagates the winner into next_match and the
--     loser into loser_next_match, activates a conditional reset match when the
--     LB champion wins the grand final, marks any match with both slots filled
--     'ready', completes the bracket when the active terminal resolves, and
--     bumps last_activity_at. Returns whether it actually advanced.
--
-- Both are granted to authenticated only (never anon — the public share path is
-- read-only via get_bracket_share). Advancement authorization (created_by) is
-- deferred to the pre-launch RLS pass; see PRE_LAUNCH_CHECKLIST.md.


-- ============================================================================
-- start_bracket — persist the generated tree + go live (atomic)
-- ============================================================================
-- p_matches is the engine output: a jsonb array of
--   { key, round, side, slot, home_seed, away_seed, winner_seed, status,
--     next_match_key, next_match_slot, loser_next_match_key,
--     loser_next_match_slot, is_reset_match }
-- Seeds reference bracket_participants.seed; keys are engine-local strings.
CREATE OR REPLACE FUNCTION "public"."start_bracket"(
  "p_bracket_id" "uuid",
  "p_matches" "jsonb"
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_seed_to_id jsonb; -- seed number (text) -> participant uuid
  v_key_to_id  jsonb := '{}'::jsonb; -- engine key -> inserted match uuid
  v_elem       jsonb;
  v_new_id     uuid;
BEGIN
  IF (SELECT status FROM brackets WHERE id = p_bracket_id) <> 'setup' THEN
    RAISE EXCEPTION 'Bracket % is not in setup status', p_bracket_id;
  END IF;

  -- seed -> participant uuid map for this bracket.
  SELECT jsonb_object_agg(seed::text, id) INTO v_seed_to_id
    FROM bracket_participants WHERE bracket_id = p_bracket_id;

  -- Pass 1: insert every match row (pointers null for now), record key -> uuid.
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    INSERT INTO bracket_matches
      (bracket_id, round, side, slot,
       home_participant_id, away_participant_id, winner_participant_id,
       status, is_reset_match)
    VALUES
      (p_bracket_id,
       (v_elem->>'round')::int,
       v_elem->>'side',
       (v_elem->>'slot')::int,
       CASE WHEN v_elem->>'home_seed' IS NOT NULL
            THEN (v_seed_to_id->>(v_elem->>'home_seed'))::uuid END,
       CASE WHEN v_elem->>'away_seed' IS NOT NULL
            THEN (v_seed_to_id->>(v_elem->>'away_seed'))::uuid END,
       CASE WHEN v_elem->>'winner_seed' IS NOT NULL
            THEN (v_seed_to_id->>(v_elem->>'winner_seed'))::uuid END,
       COALESCE(v_elem->>'status', 'pending'),
       COALESCE((v_elem->>'is_reset_match')::boolean, false))
    RETURNING id INTO v_new_id;
    v_key_to_id := v_key_to_id || jsonb_build_object(v_elem->>'key', v_new_id);
  END LOOP;

  -- Pass 2: resolve the engine's local key pointers into real match uuids.
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_matches)
  LOOP
    UPDATE bracket_matches SET
      next_match_id = CASE WHEN v_elem->>'next_match_key' IS NOT NULL
                          THEN (v_key_to_id->>(v_elem->>'next_match_key'))::uuid END,
      next_match_slot = v_elem->>'next_match_slot',
      loser_next_match_id = CASE WHEN v_elem->>'loser_next_match_key' IS NOT NULL
                          THEN (v_key_to_id->>(v_elem->>'loser_next_match_key'))::uuid END,
      loser_next_match_slot = v_elem->>'loser_next_match_slot'
    WHERE id = (v_key_to_id->>(v_elem->>'key'))::uuid;
  END LOOP;

  UPDATE brackets
     SET status = 'live', last_activity_at = now()
   WHERE id = p_bracket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."start_bracket"("uuid", "jsonb") TO "authenticated";

COMMENT ON FUNCTION "public"."start_bracket"("uuid", "jsonb") IS
  'Bracket Unit 3: persist the engine-generated match tree (seed->participant + key->match resolution) and flip the bracket to live, atomically. See docs/plans/2026-08-26-001.';


-- ============================================================================
-- advance_bracket_winner — the guarded advance + propagation
-- ============================================================================
-- Returns true if this call actually advanced the match (false = no-op because
-- it was already decided / not ready — the concurrency + idempotency guard).
CREATE OR REPLACE FUNCTION "public"."advance_bracket_winner"(
  "p_match_id" "uuid",
  "p_winner_participant_id" "uuid"
)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_match   bracket_matches%ROWTYPE;
  v_loser   uuid;
  v_bracket_id uuid;
BEGIN
  -- GUARD: lock + only proceed if still ready and unwon. A second/stale tap
  -- finds status<>'ready' (or a winner already set) and no-ops.
  SELECT * INTO v_match
    FROM bracket_matches
   WHERE id = p_match_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_match.status <> 'ready'
     OR v_match.winner_participant_id IS NOT NULL THEN
    RETURN false;
  END IF;
  IF p_winner_participant_id <> v_match.home_participant_id
     AND p_winner_participant_id <> v_match.away_participant_id THEN
    RAISE EXCEPTION 'Winner % is not a participant in match %', p_winner_participant_id, p_match_id;
  END IF;

  v_bracket_id := v_match.bracket_id;
  v_loser := CASE WHEN p_winner_participant_id = v_match.home_participant_id
                  THEN v_match.away_participant_id ELSE v_match.home_participant_id END;

  UPDATE bracket_matches
     SET winner_participant_id = p_winner_participant_id, status = 'complete'
   WHERE id = p_match_id;

  -- Propagate the winner forward.
  IF v_match.next_match_id IS NOT NULL THEN
    IF v_match.next_match_slot = 'home' THEN
      UPDATE bracket_matches SET home_participant_id = p_winner_participant_id
       WHERE id = v_match.next_match_id;
    ELSE
      UPDATE bracket_matches SET away_participant_id = p_winner_participant_id
       WHERE id = v_match.next_match_id;
    END IF;
  ELSIF v_match.side = 'grand_final' AND NOT v_match.is_reset_match THEN
    -- Grand final (winner pointer is null). A reset match may exist as a
    -- conditional decider. If the LB champion (AWAY slot) won, both players now
    -- have one loss → activate the reset (fill + let the readiness pass flip it
    -- to 'ready'). If the WB champion (HOME) won, the tournament is over →
    -- remove the unused reset row so the bracket can complete.
    IF p_winner_participant_id = v_match.away_participant_id THEN
      UPDATE bracket_matches
         SET home_participant_id = v_match.home_participant_id,
             away_participant_id = v_match.away_participant_id
       WHERE bracket_id = v_bracket_id AND is_reset_match = true;
    ELSE
      DELETE FROM bracket_matches
       WHERE bracket_id = v_bracket_id AND is_reset_match = true;
    END IF;
  END IF;

  -- Propagate the loser into the losers bracket (double-elim).
  IF v_match.loser_next_match_id IS NOT NULL THEN
    IF v_match.loser_next_match_slot = 'home' THEN
      UPDATE bracket_matches SET home_participant_id = v_loser
       WHERE id = v_match.loser_next_match_id;
    ELSE
      UPDATE bracket_matches SET away_participant_id = v_loser
       WHERE id = v_match.loser_next_match_id;
    END IF;
  END IF;

  -- Any match (in this bracket) with both slots filled but still pending
  -- becomes ready to play.
  UPDATE bracket_matches
     SET status = 'ready'
   WHERE bracket_id = v_bracket_id
     AND status = 'pending'
     AND home_participant_id IS NOT NULL
     AND away_participant_id IS NOT NULL;

  -- Complete the bracket when no playable match remains (the active terminal
  -- has resolved — covers single-elim final, GF, and GF-reset uniformly).
  IF NOT EXISTS (
    SELECT 1 FROM bracket_matches
     WHERE bracket_id = v_bracket_id AND status <> 'complete'
  ) THEN
    UPDATE brackets SET status = 'complete', last_activity_at = now()
     WHERE id = v_bracket_id;
  ELSE
    UPDATE brackets SET last_activity_at = now() WHERE id = v_bracket_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."advance_bracket_winner"("uuid", "uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."advance_bracket_winner"("uuid", "uuid") IS
  'Bracket Unit 3: guarded advance (only when still ready+unwon) — propagates winner→next, loser→loser_next, activates the conditional reset match, readies newly-full matches, completes the bracket, bumps last_activity_at. Returns whether it advanced. See docs/plans/2026-08-26-001.';
