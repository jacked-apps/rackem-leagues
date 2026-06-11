-- Migration: game_confirmations (live-scoring Layer-2 "many-eyes")
--
-- Purpose: an append-only record of every vouch for a game result — the FULL
-- result the person vouched for — plus vacate markers. The existing
-- match_games.confirmed_by_home / confirmed_by_away columns stay the
-- OFFICIALITY signal (unchanged); this table is purely additive audit/witness
-- data, so none of the ~16 counting/running-total readers need to change.
--
-- Append-only by convention (no UPDATE/DELETE from app code): a change of mind
-- is a NEW row (history preserved); an identical re-tap is a no-op (enforced in
-- the write helper, not the schema). `action` distinguishes a 'confirm' vouch
-- from a 'vacate' marker (the latter gives R10 its score->vacate->rescore
-- history and anchors dissent derivation).
--
-- Snapshot columns (winner_team_id, winner_player_id, the flags, the values)
-- are intentionally FK-FREE: they are a historical snapshot of what was
-- vouched, and an FK would let a later team/player delete mutate that history.
-- Only the actor + live-entity links (confirmer_id, match_id, game_id) carry FKs.
--
-- IMPORTANT (realtime): this table is added to the supabase_realtime
-- publication below. After applying this migration to a local instance, run
--   supabase stop && supabase start
-- so the realtime container picks up the newly published table (otherwise the
-- match subscription will show WebSocket close-loops for game_confirmations).

CREATE TABLE IF NOT EXISTS "public"."game_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "game_id" "uuid" NOT NULL,
    "game_number" integer NOT NULL,
    "confirmer_id" "uuid" NOT NULL,
    "side" "text" NOT NULL,
    "action" "text" DEFAULT 'confirm'::"text" NOT NULL,
    -- Full result snapshot (no FKs — historical, must not mutate on parent delete)
    "winner_team_id" "uuid",
    "winner_player_id" "uuid",
    "break_and_run" boolean DEFAULT false NOT NULL,
    "golden_break" boolean DEFAULT false NOT NULL,
    "break_fouled" boolean DEFAULT false NOT NULL,
    "runout" boolean DEFAULT false NOT NULL,
    "win_by_forfeit" boolean DEFAULT false NOT NULL,
    "winner_value" integer,
    "loser_value" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "game_confirmations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "game_confirmations_side_check" CHECK (("side" = ANY (ARRAY['home'::"text", 'away'::"text"]))),
    CONSTRAINT "game_confirmations_action_check" CHECK (("action" = ANY (ARRAY['confirm'::"text", 'vacate'::"text"]))),
    CONSTRAINT "game_confirmations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE,
    CONSTRAINT "game_confirmations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."match_games"("id") ON DELETE CASCADE,
    CONSTRAINT "game_confirmations_confirmer_id_fkey" FOREIGN KEY ("confirmer_id") REFERENCES "public"."members"("id")
);


ALTER TABLE "public"."game_confirmations" OWNER TO "postgres";


-- Per-match and per-game reads (the realtime refetch + the derive paths).
CREATE INDEX IF NOT EXISTS "game_confirmations_match_id_idx" ON "public"."game_confirmations" ("match_id");
CREATE INDEX IF NOT EXISTS "game_confirmations_game_id_idx" ON "public"."game_confirmations" ("game_id");


COMMENT ON TABLE "public"."game_confirmations" IS 'Append-only "many-eyes" record: every vouch for a game result (full result snapshot) plus vacate markers. Officiality stays on match_games.confirmed_by_home/away; this is additive audit/witness data.';
COMMENT ON COLUMN "public"."game_confirmations"."side" IS 'Which side the confirmer vouches for: home | away.';
COMMENT ON COLUMN "public"."game_confirmations"."action" IS 'confirm = a vouch for the result; vacate = a marker that the game was vacated/wiped (R10 history + anchors dissent derivation).';


-- Add to the realtime publication (idempotent guard — mirrors
-- 20251212000000_enable_realtime.sql so re-running is safe).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_confirmations;
  END IF;
END $$;


-- Full row payloads in realtime events (consistent with the other published tables).
ALTER TABLE "public"."game_confirmations" REPLICA IDENTITY FULL;
