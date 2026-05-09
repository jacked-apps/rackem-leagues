-- ============================================================================
-- BRANCH B PHASE 1 UNIT 6 — atomic scoring RPCs
-- ============================================================================
--
-- Two SECURITY DEFINER RPCs that implement the dual-write atomicity Branch B
-- requires (per `feedback_two_paths_audit_pattern`):
--
--   1. `score_game_with_events`: writes the score row on match_games AND
--      the corresponding game_events rows in one PL/pgSQL transaction. Any
--      failure rolls back both — the modal cannot leave the database in a
--      state where the column says one thing and the event rows say another.
--
--   2. `clear_game_with_events`: nulls the score row on match_games AND
--      deletes all game_events rows for that game. Used by vacate-accept
--      and deny paths.
--
-- Authorization: both RPCs call `can_write_game_event` defensively before
-- doing any writes. RLS on the underlying tables also enforces — these
-- checks are belt-and-suspenders.
--
-- Pattern: mirrors set_match_lineup_rating shape from
-- supabase/migrations/20260429000005_rating_mutation_rpcs.sql.
--
-- Atomicity verification: see src/__tests__/database/scoreGameWithEvents.rls.test.ts
-- which exercises a deliberate FK violation and asserts the match_games
-- UPDATE rolls back. This test is REQUIRED — the codebase has not used
-- multi-table PL/pgSQL transactional rollback before, and assumed-but-untested
-- rollback is exactly the failure mode `feedback_two_paths_audit_pattern` warns
-- about.
--
-- See plan: docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 6)
-- ============================================================================

BEGIN;

SET search_path = public;

-- ----------------------------------------------------------------------------
-- score_game_with_events — score-path atomic writer
-- ----------------------------------------------------------------------------
-- Updates match_games with winner / values / break_fouled / confirmed_by,
-- replaces game_events for this game with the provided event payload.
-- Idempotent: re-scoring a game cleanly clears prior events first.
--
-- p_events shape: jsonb array of `{"event_name": "...", "attributed_player_id": "uuid|null"}`.
-- Empty array writes no event rows (game scored without any tracked event).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION score_game_with_events(
  p_game_id            UUID,
  p_winner_team_id     UUID,
  p_winner_player_id   UUID,
  p_winner_value       INTEGER,
  p_loser_value        INTEGER,
  p_break_fouled       BOOLEAN,
  p_confirmed_by_home  UUID,
  p_confirmed_by_away  UUID,
  p_events             JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_match_id UUID;
  v_event JSONB;
BEGIN
  IF p_game_id IS NULL THEN
    RAISE EXCEPTION 'score_game_with_events: game_id is required';
  END IF;

  -- Authorization (defense-in-depth — RLS also enforces).
  IF NOT can_write_game_event(p_game_id) THEN
    RAISE EXCEPTION 'score_game_with_events: caller is not authorized to score this game';
  END IF;

  -- Resolve match_id for the events.match_id denormalization.
  SELECT match_id INTO v_match_id FROM match_games WHERE id = p_game_id;
  IF v_match_id IS NULL THEN
    RAISE EXCEPTION 'score_game_with_events: game % not found', p_game_id;
  END IF;

  -- Atomic write 1: update the match_games row.
  -- Confirmed-by passed as full values (caller decides which side they
  -- represent based on which team is scoring). NULL means "do not change
  -- this side's confirmation" — we COALESCE against the existing value.
  UPDATE match_games SET
    winner_team_id    = p_winner_team_id,
    winner_player_id  = p_winner_player_id,
    winner_value      = p_winner_value,
    loser_value       = p_loser_value,
    break_fouled      = p_break_fouled,
    confirmed_by_home = COALESCE(p_confirmed_by_home, confirmed_by_home),
    confirmed_by_away = COALESCE(p_confirmed_by_away, confirmed_by_away)
  WHERE id = p_game_id;

  -- Atomic write 2: replace events for this game.
  -- DELETE first (idempotent re-score path) then INSERT new rows. Any FK
  -- violation on the INSERT (e.g., an attributed_player_id pointing at a
  -- non-existent member) raises and rolls back the entire function — both
  -- the UPDATE above AND any partial INSERTs.
  DELETE FROM game_events WHERE game_id = p_game_id;

  IF p_events IS NOT NULL AND jsonb_typeof(p_events) = 'array' THEN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      INSERT INTO game_events (game_id, match_id, event_name, attributed_player_id)
      VALUES (
        p_game_id,
        v_match_id,
        v_event->>'event_name',
        NULLIF(v_event->>'attributed_player_id', '')::UUID
      );
    END LOOP;
  END IF;
END;
$$;

COMMENT ON FUNCTION score_game_with_events(UUID, UUID, UUID, INTEGER, INTEGER, BOOLEAN, UUID, UUID, JSONB) IS
  'Atomic score writer: updates the match_games row AND replaces game_events for the game in one transaction. RAISE EXCEPTION rolls back both writes. p_events is a jsonb array of {event_name, attributed_player_id} objects (empty array OK). Mirrors set_match_lineup_rating shape.';

REVOKE EXECUTE ON FUNCTION score_game_with_events(UUID, UUID, UUID, INTEGER, INTEGER, BOOLEAN, UUID, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION score_game_with_events(UUID, UUID, UUID, INTEGER, INTEGER, BOOLEAN, UUID, UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION score_game_with_events(UUID, UUID, UUID, INTEGER, INTEGER, BOOLEAN, UUID, UUID, JSONB) TO authenticated;

-- ----------------------------------------------------------------------------
-- clear_game_with_events — vacate-accept and deny path
-- ----------------------------------------------------------------------------
-- Nulls the match_games scoring fields (winner, values, break_fouled,
-- confirmations) AND deletes all game_events for the game. Used by:
--   - vacate-accept: opponent confirmed a vacate request → game returns to
--     unscored state. Caller separately clears `vacate_requested_by`.
--   - deny: opponent denied a score → game returns to unscored state.
--     Caller separately clears `confirmed_at`.
-- Auxiliary fields (vacate_requested_by, confirmed_at) are left to the
-- caller because their handling differs between the two paths.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION clear_game_with_events(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_game_id IS NULL THEN
    RAISE EXCEPTION 'clear_game_with_events: game_id is required';
  END IF;

  IF NOT can_write_game_event(p_game_id) THEN
    RAISE EXCEPTION 'clear_game_with_events: caller is not authorized';
  END IF;

  UPDATE match_games SET
    winner_team_id    = NULL,
    winner_player_id  = NULL,
    winner_value      = NULL,
    loser_value       = NULL,
    break_fouled      = FALSE,
    confirmed_by_home = NULL,
    confirmed_by_away = NULL
  WHERE id = p_game_id;

  DELETE FROM game_events WHERE game_id = p_game_id;
END;
$$;

COMMENT ON FUNCTION clear_game_with_events(UUID) IS
  'Atomic clearer: nulls the score on match_games AND deletes all game_events for the game in one transaction. Used by vacate-accept and deny paths. Auxiliary fields (vacate_requested_by, confirmed_at) are left to the caller.';

REVOKE EXECUTE ON FUNCTION clear_game_with_events(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION clear_game_with_events(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION clear_game_with_events(UUID) TO authenticated;

COMMIT;
