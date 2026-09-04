-- Migration: Tournament Bracket tool — Free Tier v1 (whole feature)
--
-- A standalone, "just names" single-/double-elimination bracket that any
-- logged-in user can run and share via a public link. Built PAID-AWARE — the
-- entity is a BRACKET (NOT the existing `tournament` championship-lookup
-- concept), and the shape (a bracket has participants + a match tree) lets
-- future paid features attach additively.
-- See docs/plans/2026-08-26-001-feat-tournament-bracket-free-tier-plan.md.
--
-- This one migration is the whole schema + server surface:
--   1. Tables: brackets, bracket_participants, bracket_matches (+ realtime).
--   2. get_bracket_share  — the public (anon) names-only read boundary.
--   3. start_bracket      — persist the engine tree + go live (atomic).
--   4. advance_bracket_winner — the guarded advance + propagation.
--   5. sweep_stale_brackets   — the inactivity janitor (cleanup-on-create).
--
-- Data is disposable: a bracket is closed (status='closed' tombstone) then
-- hard-deleted by the inactivity sweep; child rows cascade on bracket delete.
-- The match tree is explicit rows with pointer columns (next_match_id/slot for
-- the winner, loser_next_match_id/slot for double-elim drops), so both formats
-- are one data shape and advancement is pure propagation.
--
-- IMPORTANT (realtime): brackets + bracket_matches are published with REPLICA
-- IDENTITY FULL so filtered UPDATE events (bracket_id=eq.…) carry the full row.
-- After applying locally, run  supabase stop && supabase start  so the realtime
-- container picks up the newly published tables.
--
-- SECURITY: the write RPCs (start_bracket / advance_bracket_winner /
-- sweep_stale_brackets) are authenticated-only — Postgres grants EXECUTE to
-- PUBLIC and Supabase auto-grants new functions to anon, so both are revoked
-- (the public share route is a real anon surface). get_bracket_share stays anon
-- (names only). Ownership (created_by) authorization is deferred to the
-- pre-launch RLS pass; see PRE_LAUNCH_CHECKLIST.md.


-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- brackets — one tournament bracket (the top-level entity)
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
    CONSTRAINT "brackets_seeding_mode_check" CHECK (("seeding_mode" = ANY (ARRAY['seeded'::"text", 'random'::"text"]))),
    CONSTRAINT "brackets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."brackets" OWNER TO "postgres";


-- bracket_participants — the entrants (free tier: plain-text names)
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


-- bracket_matches — the match tree (winners, losers, grand final nodes)
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


-- Indexes: per-bracket reads (the realtime refetch), share-link lookup, sweep.
CREATE INDEX IF NOT EXISTS "brackets_last_activity_at_idx" ON "public"."brackets" ("last_activity_at");
CREATE INDEX IF NOT EXISTS "brackets_created_by_idx" ON "public"."brackets" ("created_by");
CREATE INDEX IF NOT EXISTS "bracket_participants_bracket_id_idx" ON "public"."bracket_participants" ("bracket_id");
CREATE INDEX IF NOT EXISTS "bracket_matches_bracket_id_idx" ON "public"."bracket_matches" ("bracket_id");


-- Comments
COMMENT ON TABLE "public"."brackets" IS 'A standalone tournament bracket (free-tier v1). Ephemeral: closed as a status=closed tombstone then hard-deleted by an inactivity sweep. Distinct from the tournament championship-lookup concept.';
COMMENT ON COLUMN "public"."brackets"."share_token" IS 'Non-enumerable public share-link token (uuid, DB-generated). The public read RPC is the authorization boundary while RLS is off.';
COMMENT ON COLUMN "public"."brackets"."last_activity_at" IS 'Bumped by every organizer mutation; the inactivity sweep hard-deletes brackets past a threshold (and any status=closed).';
COMMENT ON COLUMN "public"."bracket_participants"."member_id" IS 'PAID-AWARE hook — links to a real member when a future paid feature attaches real players. NULL for free-tier plain-text entrants; unused in v1.';
COMMENT ON TABLE "public"."bracket_matches" IS 'The match tree as explicit rows. next_match_id/slot routes the winner; loser_next_match_id/slot routes the loser (double-elim). One shape for both formats; advancement is pure propagation.';
COMMENT ON COLUMN "public"."bracket_matches"."is_reset_match" IS 'The conditional grand-final decider node (double-elim, reset enabled) — activated only if the losers-bracket champion wins game 1.';


-- Realtime: filtered UPDATE events need the table published + REPLICA IDENTITY
-- FULL (mirrors 20251212000000_enable_realtime.sql). Idempotent guards.
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
-- 2. get_bracket_share — the PUBLIC read (names only)
-- ============================================================================
-- SECURITY DEFINER + granted to anon: with RLS off, THIS FUNCTION IS THE
-- BOUNDARY. Column-projected to exclude created_by, member_id, and every
-- non-public column. Mirrors the get_team_join_view pattern.
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


-- ============================================================================
-- 3. start_bracket — persist the generated tree + go live (atomic)
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

-- EXECUTE is granted to PUBLIC (Postgres default) AND to anon (Supabase's
-- ALTER DEFAULT PRIVILEGES). Revoke both so a write RPC is NOT anon-callable —
-- the public share route is a real anon surface. Only authenticated organizers
-- persist a bracket.
REVOKE EXECUTE ON FUNCTION "public"."start_bracket"("uuid", "jsonb") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."start_bracket"("uuid", "jsonb") TO "authenticated";

COMMENT ON FUNCTION "public"."start_bracket"("uuid", "jsonb") IS
  'Bracket: persist the engine-generated match tree (seed->participant + key->match resolution) and flip the bracket to live, atomically. See docs/plans/2026-08-26-001.';


-- ============================================================================
-- 4. advance_bracket_winner — the guarded advance + propagation
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

-- Not anon-callable (see start_bracket note): revoke PUBLIC + anon defaults.
REVOKE EXECUTE ON FUNCTION "public"."advance_bracket_winner"("uuid", "uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."advance_bracket_winner"("uuid", "uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."advance_bracket_winner"("uuid", "uuid") IS
  'Bracket: guarded advance (only when still ready+unwon) — propagates winner→next, loser→loser_next, activates the conditional reset match, readies newly-full matches, completes the bracket, bumps last_activity_at. Returns whether it advanced. See docs/plans/2026-08-26-001.';


-- ============================================================================
-- 5. sweep_stale_brackets — the inactivity janitor (cleanup-on-create)
-- ============================================================================
-- Hard-deletes (cascade) any bracket that is closed OR has had no organizer
-- activity for p_idle_days. Called opportunistically at createBracket time —
-- zero scheduling infrastructure for the ephemeral tool. An explicit close
-- still tombstones immediately; this is what eventually removes closed +
-- abandoned rows.
CREATE OR REPLACE FUNCTION "public"."sweep_stale_brackets"(
  "p_idle_days" integer DEFAULT 7
)
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH gone AS (
    DELETE FROM brackets
     WHERE status = 'closed'
        OR last_activity_at < now() - make_interval(days => p_idle_days)
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM gone;
  RETURN v_deleted;
END;
$$;

-- Not anon-callable: a destructive bulk delete must never be anon-callable.
REVOKE EXECUTE ON FUNCTION "public"."sweep_stale_brackets"(integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."sweep_stale_brackets"(integer) TO "authenticated";

COMMENT ON FUNCTION "public"."sweep_stale_brackets"(integer) IS
  'Bracket: hard-delete (cascade) closed or idle (>p_idle_days) brackets. Called opportunistically at createBracket time — the ephemeral tool''s janitor, no cron. See docs/plans/2026-08-26-001.';
