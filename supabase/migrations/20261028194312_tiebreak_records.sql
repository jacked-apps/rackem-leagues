-- @fileoverview The tiebreak record: a tiebreaker persisted as its own
-- mini-match, alongside (never inside) the match it decides.
--
-- Unit 1 of docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
-- Requirements: docs/brainstorms/2026-10-28-tiebreaker-requirements.md (D0-D6).
--
-- Why two NEW tables rather than reusing matches / match_lineups (D0):
-- today a tie UNLOCKS both match lineups so captains can pick a tiebreak order,
-- and re-locking recalculates handicaps and the team bonus from data that now
-- includes tonight's games (audit F1). A separate record means the match lineup
-- is never unlocked at all, so that whole bug class becomes impossible rather
-- than guarded against.
--
-- The pair mirrors matches / match_lineups:
--   match_tiebreakers         -- one row per tied match (the "match")
--   match_tiebreaker_lineups  -- one row per side      (the "lineups")
--
-- This record is also where the anti-sandbagging credit lives (D1/D2): the
-- winning side's tiebreak lineup IS the list of players credited with a win.
-- It is written at resolution time and not touched again, so a later hand-edit
-- of match_lineups cannot change who was credited.
--
-- Forward-only (D5): the historical tiebreak match_games rows get no record.

-- ---------------------------------------------------------------------------
-- The tiebreaker itself. Every number that shapes it is FROZEN on the row at
-- creation, so match operations read what the record declares instead of
-- branching on format (a 5v5 tiebreak needing 3 wins is a different number, not
-- a new code path).
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_tiebreakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: a match has at most one tiebreaker; a re-fired tie must not create
  -- a second.
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  -- Wins required to take the tiebreaker (2 for best-of-3).
  games_needed integer NOT NULL CHECK (games_needed > 0),
  -- How many games the tiebreaker lays out (3 for best-of-3). Whether the last
  -- one is actually played is not tracked.
  game_count integer NOT NULL CHECK (game_count >= games_needed),
  -- How many players per side take part AND get credited. Needed because a 5v5
  -- match seeds five players but a best-of-3 tiebreaker only uses three, so
  -- "non-null slots" cannot tell the handicap step who to credit.
  players_per_side integer NOT NULL CHECK (players_per_side BETWEEN 1 AND 5),
  -- Handicaps are per game type, so a credited win must carry one to be routed.
  -- Same values as match_games.game_type, which denormalizes it for the same
  -- reason.
  game_type character varying(20) NOT NULL CHECK (
    game_type IN ('eight_ball', 'nine_ball', 'ten_ball')
  ),
  -- NULL until resolved. The winning side's tiebreak lineup is the credit list.
  -- RESTRICT, like every team FK since 20260501000001: deleting a team must not
  -- silently destroy history. (League teardown deletes matches first, and this
  -- row goes with its match.)
  winning_team_id uuid REFERENCES public.teams(id) ON DELETE RESTRICT,
  -- When it was resolved — places a credited win inside the handicap lookback
  -- window.
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.match_tiebreakers IS
  'A tiebreaker as its own mini-match. Never modifies the match or its lineups. '
  'The winning side''s match_tiebreaker_lineups row is the list of players '
  'credited with a handicap win (anti-sandbagging rule).';

-- ---------------------------------------------------------------------------
-- One lineup per side, mirroring match_lineups (five slots, as match_lineups
-- has, because 4v4 / 5v5 formats already exist). Players are seeded from the
-- MATCH LINEUP rows, so only people who played the match can appear.
--
-- Player ids reference members exactly as match_lineups does
-- (20260422000003); substitute sentinels are real member rows
-- (20260526000000), so a sub who played can be seeded. Handicaps are
-- snapshotted here so the record keeps the numbers the tiebreaker was played
-- under, immune to later lineup edits (D0).
-- ---------------------------------------------------------------------------
CREATE TABLE public.match_tiebreaker_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tiebreaker_id uuid NOT NULL REFERENCES public.match_tiebreakers(id) ON DELETE CASCADE,
  -- RESTRICT, matching match_lineups.team_id (20260501000001).
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  player1_id uuid REFERENCES public.members(id) ON DELETE NO ACTION,
  player1_handicap numeric(5,1),
  player2_id uuid REFERENCES public.members(id) ON DELETE NO ACTION,
  player2_handicap numeric(5,1),
  player3_id uuid REFERENCES public.members(id) ON DELETE NO ACTION,
  player3_handicap numeric(5,1),
  player4_id uuid REFERENCES public.members(id) ON DELETE NO ACTION,
  player4_handicap numeric(5,1),
  player5_id uuid REFERENCES public.members(id) ON DELETE NO ACTION,
  player5_handicap numeric(5,1),
  -- The tiebreak lineup's OWN lock — the match lineup's lock is never touched.
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tiebreaker_id, team_id)
);

COMMENT ON TABLE public.match_tiebreaker_lineups IS
  'Tiebreak shooting order per side. Seeded from match_lineups; slots beyond '
  'match_tiebreakers.players_per_side stay NULL.';

-- ---------------------------------------------------------------------------
-- updated_at / locked_at stamping, same behaviour as match_lineups.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_match_tiebreakers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_match_tiebreaker_lineups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  -- Stamp the moment a captain locks, mirroring update_match_lineups_updated_at.
  IF NEW.locked = true AND OLD.locked = false THEN
    NEW.locked_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_match_tiebreakers_updated_at
  BEFORE UPDATE ON public.match_tiebreakers
  FOR EACH ROW EXECUTE FUNCTION public.update_match_tiebreakers_updated_at();

CREATE TRIGGER trigger_update_match_tiebreaker_lineups_updated_at
  BEFORE UPDATE ON public.match_tiebreaker_lineups
  FOR EACH ROW EXECUTE FUNCTION public.update_match_tiebreaker_lineups_updated_at();

-- ---------------------------------------------------------------------------
-- Access posture: same as match_lineups / match_games today — RLS NOT enabled,
-- full grants to the API roles. Scoring pages gate who can write (UI-gated, DB
-- relaxed). RLS enablement is a separate planned pass across all tables.
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.match_tiebreakers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.match_tiebreaker_lineups TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime: one captain's tiebreak pick must reach the other captain's phone,
-- exactly as match_lineups does today (20251212000000_enable_realtime.sql).
-- Idempotent guard so a re-run is safe.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'match_tiebreakers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_tiebreakers;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'match_tiebreaker_lineups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_tiebreaker_lineups;
  END IF;
END $$;

-- UPDATE events carry every column (not just the changed ones), as the
-- existing realtime tables do.
ALTER TABLE public.match_tiebreakers REPLICA IDENTITY FULL;
ALTER TABLE public.match_tiebreaker_lineups REPLICA IDENTITY FULL;
