-- Migration: races / race_games / race_confirmations (individual-race scoring)
--
-- Purpose: storage for a RACE — two players playing games until one of them
-- reaches their goal number. A race is self-sufficient: it carries its two
-- players, a goal per side, the break rule and the game type, and it points at
-- no parent. Whoever wants a race points AT it (a bracket match at its race, a
-- league pairing at its several). Nothing here knows what a bracket is.
--
-- WHY THESE COLUMN NAMES. `race_games` deliberately mirrors `match_games`'
-- vocabulary column-for-column — home_action/away_action, winner_player_id,
-- winner_team_id, the achievement flags, winner_value/loser_value,
-- confirmed_by_home/away, vacate_requested_by. That is not cosmetic. It is what
-- lets the existing scoring + confirmation layer (ScoringDialog,
-- ConfirmationDialog, deriveDissents, deriveDisputes, pendingConfirmations)
-- read a race game with no translation shim, and what lets a league later
-- adopt races without a second scoring implementation. `winner_team_id` is
-- carried and left NULL here precisely so a league — where a race DOES sit
-- under two teams and a lineup — has the column already waiting.
--
-- Equal goals is the unhandicapped case; unequal goals is what a handicap
-- feature sets. Nothing about the loop changes between them.
--
-- Games are APPENDED, never pre-created: the next game is written only once
-- every existing game is confirmed and neither side has met its goal. A game
-- that was never played must never exist as a row. The unique constraint on
-- (race_id, game_number) makes a double-append impossible rather than merely
-- unlikely.
--
-- IMPORTANT (realtime): these tables join the supabase_realtime publication
-- below. After applying locally, run `supabase stop && supabase start` so the
-- realtime container picks them up — otherwise the race subscription shows
-- WebSocket close-before-established loops that look like app bugs.
--
-- @see docs/plans/2026-09-09-001-feat-self-scoring-individual-races-plan.md


-- ============================================================================
-- 1. races
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."races" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,

    -- The two players. Both are members today (a sandbox race is scored by two
    -- logged-in people). Walk-up identity arrives later as an additional,
    -- nullable participant column per side — not as a change to these.
    "home_member_id" "uuid" NOT NULL,
    "away_member_id" "uuid" NOT NULL,

    -- Goal per side. Equal = unhandicapped. The race ends when a side reaches
    -- its own number; the two numbers are independent by design.
    "goal_home" integer NOT NULL,
    "goal_away" integer NOT NULL,

    "break_rule" "text" DEFAULT 'alternate'::"text" NOT NULL,
    "game_type" character varying(20) NOT NULL,

    -- Who breaks game 1. NULL until someone taps a name (however it was decided
    -- at the table — lag, flip, roshambo). After that the break rule takes over
    -- and nobody is asked again.
    "first_breaker_side" "text",

    "status" "text" DEFAULT 'created'::"text" NOT NULL,

    -- Set when a side reaches its goal. Cleared if a vacate un-finishes the
    -- race. FK-free: this is the race's own announcement, not a live link.
    "winner_player_id" "uuid",

    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "races_distinct_players_check" CHECK ("home_member_id" <> "away_member_id"),
    CONSTRAINT "races_goal_home_check" CHECK ("goal_home" >= 1),
    CONSTRAINT "races_goal_away_check" CHECK ("goal_away" >= 1),
    CONSTRAINT "races_break_rule_check" CHECK (("break_rule" = ANY (ARRAY['alternate'::"text", 'winner_breaks'::"text"]))),
    CONSTRAINT "races_game_type_check" CHECK ((("game_type")::"text" = ANY ((ARRAY['eight_ball'::character varying, 'nine_ball'::character varying, 'ten_ball'::character varying])::"text"[]))),
    CONSTRAINT "races_first_breaker_side_check" CHECK (("first_breaker_side" IS NULL OR "first_breaker_side" = ANY (ARRAY['home'::"text", 'away'::"text"]))),
    CONSTRAINT "races_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'in_play'::"text", 'finished'::"text", 'abandoned'::"text"]))),
    CONSTRAINT "races_home_member_id_fkey" FOREIGN KEY ("home_member_id") REFERENCES "public"."members"("id"),
    CONSTRAINT "races_away_member_id_fkey" FOREIGN KEY ("away_member_id") REFERENCES "public"."members"("id")
);

ALTER TABLE "public"."races" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "races_home_member_id_idx" ON "public"."races" ("home_member_id");
CREATE INDEX IF NOT EXISTS "races_away_member_id_idx" ON "public"."races" ("away_member_id");

COMMENT ON TABLE "public"."races" IS
'A race: two players playing games until one reaches their goal. Self-sufficient and parent-free — a bracket match or a league pairing points AT a race, never the reverse. Games are appended as they are played (see race_games).';
COMMENT ON COLUMN "public"."races"."goal_home" IS 'Games the home player must win. Equal to goal_away = unhandicapped; unequal is what a handicap feature sets.';
COMMENT ON COLUMN "public"."races"."goal_away" IS 'Games the away player must win. See goal_home.';
COMMENT ON COLUMN "public"."races"."break_rule" IS 'alternate = break passes each game; winner_breaks = the previous game''s winner breaks. Applied by the append, so a game''s breaker is decided when it is actually knowable.';
COMMENT ON COLUMN "public"."races"."first_breaker_side" IS 'Who breaks game 1 — set by a tap when the race opens (however it was decided at the table). NULL until then; the race cannot start without it.';
COMMENT ON COLUMN "public"."races"."status" IS 'created = players known, no first breaker yet | in_play = game 1 exists | finished = a side reached its goal | abandoned = walked away, no result.';
COMMENT ON COLUMN "public"."races"."winner_player_id" IS 'The member who reached their goal first, in game order. FK-free: the race''s own announcement. Cleared when a vacate drops the score back below the goal.';


-- ============================================================================
-- 2. race_games — one row per game actually played
-- ============================================================================
--
-- Column names mirror match_games on purpose (see header). The differences are
-- only what a race genuinely lacks: no match_id, no lineup positions.

CREATE TABLE IF NOT EXISTS "public"."race_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "race_id" "uuid" NOT NULL,
    "game_number" integer NOT NULL,

    -- Break/rack assignment, same vocabulary as match_games. Written by the
    -- append from the race's break rule.
    "home_action" "text" NOT NULL,
    "away_action" "text" NOT NULL,

    "game_type" character varying(20) NOT NULL,

    -- Result. winner_player_id is the member who won the game.
    -- winner_team_id is carried, and stays NULL for a standalone race, so a
    -- league race (which sits under two teams) needs no schema change.
    "winner_player_id" "uuid",
    "winner_team_id" "uuid",
    "break_and_run" boolean DEFAULT false NOT NULL,
    "golden_break" boolean DEFAULT false NOT NULL,
    "early_eight" boolean DEFAULT false NOT NULL,
    "break_fouled" boolean DEFAULT false NOT NULL,
    "runout" boolean DEFAULT false NOT NULL,
    "win_by_forfeit" boolean DEFAULT false NOT NULL,
    "winner_value" integer,
    "loser_value" integer,

    -- Officiality, same shape as match_games: the member id of whoever
    -- confirmed for that side.
    "confirmed_by_home" "uuid",
    "confirmed_by_away" "uuid",
    "confirmed_at" timestamp with time zone,
    "vacate_requested_by" character varying(10),

    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "race_games_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "race_games_race_id_game_number_key" UNIQUE ("race_id", "game_number"),
    CONSTRAINT "race_games_game_number_check" CHECK ("game_number" >= 1),
    CONSTRAINT "race_games_home_action_check" CHECK (("home_action" = ANY (ARRAY['breaks'::"text", 'racks'::"text"]))),
    CONSTRAINT "race_games_away_action_check" CHECK (("away_action" = ANY (ARRAY['breaks'::"text", 'racks'::"text"]))),
    CONSTRAINT "race_games_actions_differ_check" CHECK ("home_action" <> "away_action"),
    CONSTRAINT "race_games_game_type_check" CHECK ((("game_type")::"text" = ANY ((ARRAY['eight_ball'::character varying, 'nine_ball'::character varying, 'ten_ball'::character varying])::"text"[]))),
    CONSTRAINT "race_games_check" CHECK ((NOT (("break_and_run" = true) AND ("golden_break" = true)))),
    -- A game ends exactly one way. These are rival descriptions of the same
    -- game, not facts that stack: an 8 down on the break is a golden break,
    -- a table cleared from the break is a break and run. Two at once would say
    -- the ending is unknown, not that both happened. Mirrors
    -- match_games_early_eight_excludes_feats.
    CONSTRAINT "race_games_early_eight_excludes_feats" CHECK (NOT ("early_eight" AND ("break_and_run" OR "golden_break" OR "runout"))),
    CONSTRAINT "race_games_vacate_requested_by_check" CHECK ((("vacate_requested_by")::"text" = ANY ((ARRAY['home'::character varying, 'away'::character varying])::"text"[]))),
    CONSTRAINT "race_games_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."race_games" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "race_games_race_id_idx" ON "public"."race_games" ("race_id");

COMMENT ON TABLE "public"."race_games" IS
'One row per game actually played in a race. Appended, never pre-created — the next game is written only when every existing game is confirmed and neither side has met its goal. Column names mirror match_games so the existing scoring/confirmation components read both with no shim.';
COMMENT ON COLUMN "public"."race_games"."home_action" IS 'breaks | racks — same vocabulary as match_games. Written by the append from the race''s break rule.';
COMMENT ON COLUMN "public"."race_games"."winner_team_id" IS 'Always NULL for a standalone race. Carried so a league race — which does sit under two teams — needs no schema change to adopt this table.';
COMMENT ON COLUMN "public"."race_games"."vacate_requested_by" IS 'home | away — the side that asked to wipe this game. Same shape as match_games.';


-- ============================================================================
-- 3. race_confirmations — the many-eyes record
-- ============================================================================
--
-- Mirrors game_confirmations exactly, including the FK-free result snapshot
-- (an FK would let a later delete mutate history). `side` is the literal text
-- 'home' / 'away': deriveDissents silently skips any other value, which would
-- disable the whole dissent/dispute layer invisibly.

CREATE TABLE IF NOT EXISTS "public"."race_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "race_id" "uuid" NOT NULL,
    "game_id" "uuid" NOT NULL,
    "game_number" integer NOT NULL,
    "confirmer_id" "uuid" NOT NULL,
    "side" "text" NOT NULL,
    "action" "text" DEFAULT 'confirm'::"text" NOT NULL,
    "is_initiator" boolean DEFAULT false NOT NULL,
    "auto_confirmed" boolean DEFAULT false NOT NULL,
    "reason" "text",

    -- Result snapshot (no FKs — historical)
    "winner_player_id" "uuid",
    "winner_team_id" "uuid",
    "break_and_run" boolean DEFAULT false NOT NULL,
    "golden_break" boolean DEFAULT false NOT NULL,
    -- How a game ended is exactly the sort of call one player sees and the
    -- other does not, so it belongs in the compared snapshot rather than being
    -- applied after agreement is reached.
    "early_eight" boolean DEFAULT false NOT NULL,
    "break_fouled" boolean DEFAULT false NOT NULL,
    "runout" boolean DEFAULT false NOT NULL,
    "win_by_forfeit" boolean DEFAULT false NOT NULL,
    "winner_value" integer,
    "loser_value" integer,

    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

    CONSTRAINT "race_confirmations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "race_confirmations_side_check" CHECK (("side" = ANY (ARRAY['home'::"text", 'away'::"text"]))),
    CONSTRAINT "race_confirmations_action_check" CHECK (("action" = ANY (ARRAY['confirm'::"text", 'vacate'::"text"]))),
    CONSTRAINT "race_confirmations_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE CASCADE,
    CONSTRAINT "race_confirmations_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "public"."race_games"("id") ON DELETE CASCADE,
    CONSTRAINT "race_confirmations_confirmer_id_fkey" FOREIGN KEY ("confirmer_id") REFERENCES "public"."members"("id")
);

ALTER TABLE "public"."race_confirmations" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "race_confirmations_race_id_idx" ON "public"."race_confirmations" ("race_id");
CREATE INDEX IF NOT EXISTS "race_confirmations_game_id_idx" ON "public"."race_confirmations" ("game_id");

COMMENT ON TABLE "public"."race_confirmations" IS
'Append-only many-eyes record for races — every vouch for a game result (full snapshot) plus vacate markers. Mirrors game_confirmations so deriveDissents / deriveDisputes work untouched.';
COMMENT ON COLUMN "public"."race_confirmations"."side" IS 'home | away, literal text. deriveDissents SKIPS any other value without throwing, which would disable dissent detection invisibly — never store anything else here.';


-- ============================================================================
-- 4. Writes go through RPCs only
-- ============================================================================
--
-- The baseline runs ALTER DEFAULT PRIVILEGES ... IN SCHEMA public GRANT ALL ON
-- TABLES TO anon, so a table created in public is born anon-writable. Left
-- alone, the anon key that ships in the client bundle could insert a game 6,
-- flip a winner or forge a confirmation directly — bypassing the serialized
-- append, the confirmation gate and the goal check the whole design rests on.
-- The exposure comes from default privileges, so there is nothing to find by
-- grepping for GRANT. SELECT is kept: realtime and the race room read these.

-- REVOKE ALL then GRANT SELECT, rather than naming the write verbs: the
-- default grant includes TRUNCATE, so revoking INSERT/UPDATE/DELETE alone
-- leaves anon able to wipe every race in one statement and makes the lock
-- decorative. Revoking everything is also immune to privilege types added
-- later.
REVOKE ALL ON "public"."races" FROM "anon", "authenticated";
REVOKE ALL ON "public"."race_games" FROM "anon", "authenticated";
REVOKE ALL ON "public"."race_confirmations" FROM "anon", "authenticated";

GRANT SELECT ON "public"."races" TO "anon", "authenticated";
GRANT SELECT ON "public"."race_games" TO "anon", "authenticated";
GRANT SELECT ON "public"."race_confirmations" TO "anon", "authenticated";


-- ============================================================================
-- 5. Realtime
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'races') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE races;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'race_games') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE race_games;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'race_confirmations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE race_confirmations;
  END IF;
END $$;

ALTER TABLE "public"."races" REPLICA IDENTITY FULL;
ALTER TABLE "public"."race_games" REPLICA IDENTITY FULL;
ALTER TABLE "public"."race_confirmations" REPLICA IDENTITY FULL;
