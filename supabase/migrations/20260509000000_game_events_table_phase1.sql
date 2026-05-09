-- ============================================================================
-- BRANCH B PHASE 1 UNIT 2 — game_events table + RLS, drop 4 boolean columns
-- ============================================================================
--
-- Replaces the 4 boolean event columns on match_games (break_and_run,
-- golden_break, runout, win_by_forfeit) with a row-per-event child table
-- driven by the TypeScript event registry at src/systems/game-events/.
--
-- This is the Phase 1 portion of the Branch B migration. Phase 2 (in a
-- separate later migration) will add `enabled_events jsonb` to preferences,
-- enable RLS on preferences, and rebuild resolved_league_preferences with
-- the per-key jsonb || merge.
--
-- KEY DECISIONS
--
--   * `match_id` denormalized on game_events (not joined through game_id).
--     Postgres realtime can only filter on direct columns; without this,
--     spectators must subscribe per-game-id (25 channels per 5v5 match) or
--     join-then-fanout. Cheap denormalization.
--
--   * `break_fouled` STAYS as a flat column on match_games. It does
--     mechanical work on every modal render (drives B&R / runout role
--     gating) — synchronous read, no join. ALSO writes a game_events row
--     for stat queries. Atomic dual-write enforced by the
--     score_game_with_events rpc (Unit 6).
--
--   * RLS uses a TWO-TIER write predicate: (a) caller is on the locked
--     match lineup as a scorer, OR (b) caller is owner/admin of the league's
--     organization. The org-admin branch mirrors can_write_house_rule_org
--     verbatim. The scorer-on-lineup branch is novel — no prior precedent
--     in this codebase — so the test suite explicitly covers cross-team
--     and unlocked-lineup blocked cases.
--
--   * Disposable test data (per project policy `feedback_dev_data_disposable`).
--     The 4 dropped columns held disposable test values; no backfill needed.
--     `db reset` rebuilds.
--
-- See plan: docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md
-- (Unit 2 Phase 1 portion).
-- ============================================================================

BEGIN;

SET search_path = public;

-- ============================================================================
-- game_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id               UUID NOT NULL REFERENCES match_games(id) ON DELETE CASCADE,
  match_id              UUID NOT NULL REFERENCES matches(id),
  event_name            TEXT NOT NULL,
  attributed_player_id  UUID REFERENCES members(id),
  value                 INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE game_events IS
  'Per-game stat-attribution events. One row per event-fired-on-a-game (e.g., a Break and Run attributed to the winner). Replaces the 4 flat boolean columns on match_games. Event names are registry-defined in src/systems/game-events/.';

COMMENT ON COLUMN game_events.game_id IS
  'The match_games row this event belongs to. ON DELETE CASCADE so deleting a game row also clears its events. The vacate flow uses an explicit DELETE on this column instead of relying on cascade.';

COMMENT ON COLUMN game_events.match_id IS
  'Denormalized for realtime channel filtering — Postgres realtime can only filter on direct columns. Without this, subscribing to game_events for a match would require per-game-id channels (~25 per 5v5 match). See plan 2026-05-09-001 §realtime.';

COMMENT ON COLUMN game_events.event_name IS
  'Stable snake_case event identifier matching the TypeScript registry at src/systems/game-events/. Examples: break_and_run, golden_break, win_by_forfeit. Not foreign-keyed to anything — the registry is the source of truth and lives in code.';

COMMENT ON COLUMN game_events.attributed_player_id IS
  'The member who gets the stat row. Resolved at write time from the registry attributedTo field plus the modal''s winner/loser/breaker context. NULL is allowed for future events that genuinely have no attribution; events declared with attributedTo should always set this non-null at write time.';

COMMENT ON COLUMN game_events.value IS
  'Reserved for future counter-shaped events (e.g., APA innings). Phase 1 events are all boolean flags so this stays NULL.';

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS game_events_game_id_idx
  ON game_events(game_id);

CREATE INDEX IF NOT EXISTS game_events_match_id_idx
  ON game_events(match_id);

-- Composite index for stats COUNT-by-player-and-event queries — every
-- sample stats query in the plan filters on (attributed_player_id, event_name).
-- Standalone (event_name) index NOT added — full-table count-by-event without
-- a player filter is not a documented use case.
CREATE INDEX IF NOT EXISTS game_events_attributed_player_event_idx
  ON game_events(attributed_player_id, event_name);

-- ============================================================================
-- Authorization predicate: can_write_game_event(target_game_id)
-- ============================================================================
-- Returns true iff the caller is allowed to write events for the game.
-- Two-tier check:
--   (a) caller is on the locked lineup of the game's match (scorer branch), OR
--   (b) caller is owner/admin of the league's organization (LO branch — mirrors
--       can_write_house_rule_org).
-- Both branches require auth.uid() to be set; anonymous callers always fail.
-- ============================================================================

CREATE OR REPLACE FUNCTION can_write_game_event(target_game_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_match_id UUID;
  v_org_id UUID;
  v_caller_member_id UUID;
BEGIN
  IF target_game_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Resolve the match_id and organization_id chain from the game.
  SELECT mg.match_id, l.organization_id
    INTO v_match_id, v_org_id
    FROM match_games mg
    JOIN matches mt ON mt.id = mg.match_id
    JOIN seasons s ON s.id = mt.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE mg.id = target_game_id;

  IF v_match_id IS NULL THEN
    RETURN FALSE; -- game does not exist
  END IF;

  -- Resolve the caller's member_id (if any).
  SELECT id INTO v_caller_member_id
    FROM members
    WHERE user_id = auth.uid();

  IF v_caller_member_id IS NULL THEN
    RETURN FALSE; -- caller has no member row
  END IF;

  -- Branch (a): scorer on the locked match lineup.
  IF EXISTS (
    SELECT 1
      FROM match_lineups ml
      WHERE ml.match_id = v_match_id
        AND ml.locked = TRUE
        AND v_caller_member_id IN (
          ml.player1_id, ml.player2_id, ml.player3_id, ml.player4_id, ml.player5_id
        )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Branch (b): owner/admin of the league's organization.
  IF EXISTS (
    SELECT 1
      FROM organization_staff os
      WHERE os.member_id = v_caller_member_id
        AND os.organization_id = v_org_id
        AND os.position IN ('owner', 'admin')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION can_write_game_event(UUID) IS
  'True iff the caller is on the locked match lineup of the game OR is owner/admin of the league''s organization. league_rep is excluded from the LO branch (matches can_write_house_rule_org policy).';

-- ============================================================================
-- RLS policies
-- ============================================================================

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

-- SELECT is open (matches existing match_games posture — events are not
-- sensitive data and stat queries need broad read access).
CREATE POLICY game_events_select_public
  ON game_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY game_events_insert_authorized
  ON game_events
  FOR INSERT
  TO authenticated
  WITH CHECK (can_write_game_event(game_id));

CREATE POLICY game_events_update_authorized
  ON game_events
  FOR UPDATE
  TO authenticated
  USING (can_write_game_event(game_id))
  WITH CHECK (can_write_game_event(game_id));

CREATE POLICY game_events_delete_authorized
  ON game_events
  FOR DELETE
  TO authenticated
  USING (can_write_game_event(game_id));

-- ============================================================================
-- Drop the 4 boolean columns from match_games
-- ============================================================================
-- These are replaced by registry-driven event rows in game_events. Per
-- project policy `feedback_dev_data_disposable`, no backfill plumbing —
-- existing values are disposable test data, db reset rebuilds.
--
-- `break_fouled` is intentionally KEPT as a flat column — it drives modal
-- role-gating on every render and needs synchronous read access.
-- ============================================================================

ALTER TABLE match_games DROP COLUMN IF EXISTS break_and_run;
ALTER TABLE match_games DROP COLUMN IF EXISTS golden_break;
ALTER TABLE match_games DROP COLUMN IF EXISTS runout;
ALTER TABLE match_games DROP COLUMN IF EXISTS win_by_forfeit;

-- ============================================================================
-- Grants
-- ============================================================================
-- Mirror match_games posture (anon SELECT + authenticated full access via RLS).

GRANT SELECT ON TABLE game_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE game_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE game_events TO service_role;

GRANT EXECUTE ON FUNCTION can_write_game_event(UUID) TO authenticated;

COMMIT;
