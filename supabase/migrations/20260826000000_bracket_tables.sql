-- Migration: tournament bracket tool — Free Tier v1 (Unit 1)
--
-- Purpose: the three tables (plus one public-read RPC) behind a standalone,
-- "just names" single-/double-elimination bracket that any logged-in user can
-- run and share via a public link. Built PAID-AWARE — the entity is a BRACKET
-- (NOT the existing `tournament` championship-lookup concept), and the shape
-- (a bracket has participants + a match tree) lets future paid features attach
-- additively. See docs/plans/2026-08-26-001-feat-tournament-bracket-free-tier-plan.md.
--
-- Data is disposable: a bracket is closed (status='closed' tombstone) then
-- hard-deleted by an inactivity sweep; child rows cascade on bracket delete.
--
-- The match tree is stored as explicit rows with pointer columns
-- (next_match_id/slot for the winner, loser_next_match_id/slot for double-elim
-- drops), so both formats are one data shape and advancement is pure propagation.
--
-- IMPORTANT (realtime): brackets + bracket_matches are added to the
-- supabase_realtime publication below with REPLICA IDENTITY FULL so filtered
-- UPDATE events (bracket_id=eq.…) carry the full row. After applying this
-- migration to a local instance, run  supabase stop && supabase start  so the
-- realtime container picks up the newly published tables.


-- ============================================================================
-- brackets — one tournament bracket (the top-level entity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."brackets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "format" "text" NOT NULL,
    "status" "text" DEFAULT 'setup'::"text" NOT NULL,
    "seeding_mode" "text" DEFAULT 'seeded'::"text" NOT NULL,
    "grand_final_reset" boolean DEFAULT false NOT NULL,
    -- Public share link token. uuid = non-enumerable (matches teams.join_token);
    -- generated at the DB level, never in application code.
    "share_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    -- Bumped by every organizer action; the inactivity sweep reads this.
    "last_activity_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "brackets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "brackets_share_token_key" UNIQUE ("share_token"),
    CONSTRAINT "brackets_format_check" CHECK (("format" = ANY (ARRAY['single_elimination'::"text", 'double_elimination'::"text"]))),
    CONSTRAINT "brackets_status_check" CHECK (("status" = ANY (ARRAY['setup'::"text", 'live'::"text", 'complete'::"text", 'closed'::"text"]))),
    CONSTRAINT "brackets_seeding_mode_check" CHECK (("seeding_mode" = ANY (ARRAY['seeded'::"text", 'ranked'::"text", 'random'::"text"]))),
    CONSTRAINT "brackets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."brackets" OWNER TO "postgres";


-- ============================================================================
-- bracket_participants — the entrants (free tier: plain-text names)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."bracket_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bracket_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "seed" integer NOT NULL,
    -- PAID-AWARE hook: links to a real member when a paid feature attaches real
    -- players later. NULL for free-tier plain-text entrants. Unused in v1.
    "member_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bracket_participants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bracket_participants_bracket_seed_key" UNIQUE ("bracket_id", "seed"),
    CONSTRAINT "bracket_participants_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "public"."brackets"("id") ON DELETE CASCADE,
    CONSTRAINT "bracket_participants_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."bracket_participants" OWNER TO "postgres";


-- ============================================================================
-- bracket_matches — the match tree (winners, losers, grand final nodes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."bracket_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bracket_id" "uuid" NOT NULL,
    "round" integer NOT NULL,
    "side" "text" NOT NULL,
    "slot" integer NOT NULL,
    "home_participant_id" "uuid",
    "away_participant_id" "uuid",
    "winner_participant_id" "uuid",
    -- Winner advances here; loser drops here (double-elim only). Self-referential.
    "next_match_id" "uuid",
    "next_match_slot" "text",
    "loser_next_match_id" "uuid",
    "loser_next_match_slot" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    -- The conditional grand-final decider (only "played" if the LB champ wins G1).
    "is_reset_match" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bracket_matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bracket_matches_side_check" CHECK (("side" = ANY (ARRAY['winners'::"text", 'losers'::"text", 'grand_final'::"text"]))),
    CONSTRAINT "bracket_matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'complete'::"text"]))),
    CONSTRAINT "bracket_matches_next_slot_check" CHECK (("next_match_slot" IS NULL OR "next_match_slot" = ANY (ARRAY['home'::"text", 'away'::"text"]))),
    CONSTRAINT "bracket_matches_loser_slot_check" CHECK (("loser_next_match_slot" IS NULL OR "loser_next_match_slot" = ANY (ARRAY['home'::"text", 'away'::"text"]))),
    CONSTRAINT "bracket_matches_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "public"."brackets"("id") ON DELETE CASCADE,
    CONSTRAINT "bracket_matches_home_fkey" FOREIGN KEY ("home_participant_id") REFERENCES "public"."bracket_participants"("id") ON DELETE SET NULL,
    CONSTRAINT "bracket_matches_away_fkey" FOREIGN KEY ("away_participant_id") REFERENCES "public"."bracket_participants"("id") ON DELETE SET NULL,
    CONSTRAINT "bracket_matches_winner_fkey" FOREIGN KEY ("winner_participant_id") REFERENCES "public"."bracket_participants"("id") ON DELETE SET NULL,
    CONSTRAINT "bracket_matches_next_match_fkey" FOREIGN KEY ("next_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE SET NULL,
    CONSTRAINT "bracket_matches_loser_next_match_fkey" FOREIGN KEY ("loser_next_match_id") REFERENCES "public"."bracket_matches"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."bracket_matches" OWNER TO "postgres";


-- ---------------------------------------------------------------------------
-- Indexes: per-bracket reads (the realtime refetch), share-link lookup, sweep.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "brackets_last_activity_at_idx" ON "public"."brackets" ("last_activity_at");
CREATE INDEX IF NOT EXISTS "brackets_created_by_idx" ON "public"."brackets" ("created_by");
CREATE INDEX IF NOT EXISTS "bracket_participants_bracket_id_idx" ON "public"."bracket_participants" ("bracket_id");
CREATE INDEX IF NOT EXISTS "bracket_matches_bracket_id_idx" ON "public"."bracket_matches" ("bracket_id");


-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
COMMENT ON TABLE "public"."brackets" IS 'A standalone tournament bracket (free-tier v1). Ephemeral: closed as a status=closed tombstone then hard-deleted by an inactivity sweep. Distinct from the tournament championship-lookup concept.';
COMMENT ON COLUMN "public"."brackets"."share_token" IS 'Non-enumerable public share-link token (uuid, DB-generated). The public read RPC is the authorization boundary while RLS is off.';
COMMENT ON COLUMN "public"."brackets"."last_activity_at" IS 'Bumped by every organizer mutation; the inactivity sweep hard-deletes brackets past a threshold (and any status=closed).';
COMMENT ON COLUMN "public"."bracket_participants"."member_id" IS 'PAID-AWARE hook — links to a real member when a future paid feature attaches real players. NULL for free-tier plain-text entrants; unused in v1.';
COMMENT ON TABLE "public"."bracket_matches" IS 'The match tree as explicit rows. next_match_id/slot routes the winner; loser_next_match_id/slot routes the loser (double-elim). One shape for both formats; advancement is pure propagation.';
COMMENT ON COLUMN "public"."bracket_matches"."is_reset_match" IS 'The conditional grand-final decider node (double-elim, reset enabled) — activated only if the losers-bracket champion wins game 1.';


-- ---------------------------------------------------------------------------
-- Realtime: filtered UPDATE events need the table published + REPLICA IDENTITY
-- FULL (mirrors 20251212000000_enable_realtime.sql). Idempotent guards.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'brackets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE brackets;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bracket_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bracket_matches;
  END IF;
END $$;

ALTER TABLE "public"."brackets" REPLICA IDENTITY FULL;
ALTER TABLE "public"."bracket_matches" REPLICA IDENTITY FULL;


-- ============================================================================
-- get_bracket_share — the PUBLIC read (names only). SECURITY DEFINER + granted
-- to anon: with RLS off, THIS FUNCTION IS THE BOUNDARY. Column-projected to
-- exclude created_by, member_id, and every non-public column. Mirrors the
-- get_team_join_view pattern.
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_bracket_share"("p_share_token" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_bracket brackets%ROWTYPE;
  v_participants jsonb;
  v_matches jsonb;
BEGIN
  -- Unknown / swept token → a clean "not found" the page renders as an
  -- ended/invalid state (never an error).
  SELECT * INTO v_bracket FROM brackets b WHERE b.share_token = p_share_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Names + seeds only — no member_id.
  SELECT jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'display_name', p.display_name,
             'seed', p.seed
           ) ORDER BY p.seed
         )
    INTO v_participants
    FROM bracket_participants p
   WHERE p.bracket_id = v_bracket.id;

  -- The match tree structure needed to render read-only.
  SELECT jsonb_agg(
           jsonb_build_object(
             'id', mch.id,
             'round', mch.round,
             'side', mch.side,
             'slot', mch.slot,
             'home_participant_id', mch.home_participant_id,
             'away_participant_id', mch.away_participant_id,
             'winner_participant_id', mch.winner_participant_id,
             'next_match_id', mch.next_match_id,
             'next_match_slot', mch.next_match_slot,
             'loser_next_match_id', mch.loser_next_match_id,
             'loser_next_match_slot', mch.loser_next_match_slot,
             'status', mch.status,
             'is_reset_match', mch.is_reset_match
           ) ORDER BY mch.side, mch.round, mch.slot
         )
    INTO v_matches
    FROM bracket_matches mch
   WHERE mch.bracket_id = v_bracket.id;

  RETURN jsonb_build_object(
    'found', true,
    'bracket', jsonb_build_object(
      'id', v_bracket.id,
      'name', v_bracket.name,
      'format', v_bracket.format,
      'status', v_bracket.status,
      'grand_final_reset', v_bracket.grand_final_reset
    ),
    'participants', COALESCE(v_participants, '[]'::jsonb),
    'matches', COALESCE(v_matches, '[]'::jsonb)
  );
END;
$$;

-- Pre-auth readable: the public share page resolves the token before sign-in.
GRANT EXECUTE ON FUNCTION "public"."get_bracket_share"("uuid") TO "anon", "authenticated";

COMMENT ON FUNCTION "public"."get_bracket_share"("uuid") IS
  'Public bracket share read: resolve a share_token to {found, bracket{id,name,format,status,grand_final_reset}, participants[], matches[]}. Names only — the authorization boundary while RLS is off. See docs/plans/2026-08-26-001.';
