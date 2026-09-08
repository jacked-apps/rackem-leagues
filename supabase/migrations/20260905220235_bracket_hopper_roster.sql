-- Migration: Tournament paid foundation — Phase C, Unit C1 (hopper + roster schema)
--
-- The staging model for real players joining a paid tournament:
--   • bracket_hopper — the candidate pool. A registered player is a row with a
--     member_id; a WALK-UP is a row with member_id NULL + display_name (a
--     disposable tournament-scoped entrant — NOT a global members/placeholder
--     row, so it never enters the league merge/never-delete system). `status`
--     flips hopper → official (admitted to the bracket). `seed` is assigned at
--     admit/finalize so start_bracket can materialize the official list into
--     seeded bracket_participants (wired in a later unit).
--   • bracket_roster — the organizer's sticky "past players" (REGISTERED only).
--     Auto-filled on admission by a trigger, never removed on eject.
--
-- Disposable with the tournament (cascades on bracket delete; swept like free).
-- See docs/plans/2026-09-04-001-feat-tournament-paid-foundation-plan.md (C1/B1/B2).
--
-- IMPORTANT (realtime): bracket_hopper is published with REPLICA IDENTITY FULL so
-- filtered UPDATE events (bracket_id=eq.…) carry the row. After applying locally,
-- run  supabase stop && supabase start  so the realtime container picks it up.


-- ============================================================================
-- bracket_hopper — candidates (registered players + walk-ups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."bracket_hopper" (
    "id"           uuid DEFAULT gen_random_uuid() NOT NULL,
    "bracket_id"   uuid NOT NULL,
    -- Registered player → set; WALK-UP → NULL (identity is display_name only).
    "member_id"    uuid,
    "display_name" text NOT NULL,
    "status"       text NOT NULL DEFAULT 'hopper',
    -- Organizer-asserted paid/unpaid (entry fee, money layer is roadmap #3). NULL
    -- while still a candidate; set when admitted.
    "paid_status"  text,
    "added_via"    text,
    -- Assigned at admit/finalize (contiguous 1..N over the official list) so the
    -- client can generate the tree + start_bracket can materialize seeds.
    "seed"         integer,
    "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "bracket_hopper_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bracket_hopper_status_check" CHECK (("status" = ANY (ARRAY['hopper'::text, 'official'::text]))),
    CONSTRAINT "bracket_hopper_paid_status_check" CHECK (("paid_status" IS NULL OR "paid_status" = ANY (ARRAY['paid'::text, 'unpaid'::text]))),
    CONSTRAINT "bracket_hopper_added_via_check" CHECK (("added_via" IS NULL OR "added_via" = ANY (ARRAY['search'::text, 'link'::text, 'qr'::text]))),
    CONSTRAINT "bracket_hopper_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "public"."brackets"("id") ON DELETE CASCADE,
    -- Declared FK so referential integrity holds; ON DELETE CASCADE removes the
    -- hopper row if the member is deleted (rare).
    CONSTRAINT "bracket_hopper_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE,
    -- One REGISTERED identity per bracket at most once (PF9). NULL member_ids are
    -- exempt from UNIQUE in Postgres, so multiple walk-ups are allowed.
    CONSTRAINT "bracket_hopper_bracket_member_key" UNIQUE ("bracket_id", "member_id")
);

ALTER TABLE "public"."bracket_hopper" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "bracket_hopper_bracket_id_idx" ON "public"."bracket_hopper" ("bracket_id");

COMMENT ON TABLE "public"."bracket_hopper" IS
  'Candidate pool for a paid tournament. Registered player = row with member_id; walk-up = member_id NULL + display_name (disposable tournament-scoped entrant, never a global placeholder). status flips hopper→official (admitted); seed assigned at admit/finalize.';
COMMENT ON COLUMN "public"."bracket_hopper"."member_id" IS 'Registered player''s member id, or NULL for a walk-up (identity is display_name only).';
COMMENT ON COLUMN "public"."bracket_hopper"."paid_status" IS 'Organizer-asserted entry-fee paid/unpaid (money tracking is roadmap #3). NULL while a candidate.';


-- ============================================================================
-- bracket_roster — the organizer's sticky "past players" (REGISTERED only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."bracket_roster" (
    "id"                  uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizer_member_id" uuid NOT NULL,
    "player_member_id"    uuid NOT NULL,
    "first_seen_at"       timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "bracket_roster_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bracket_roster_organizer_fkey" FOREIGN KEY ("organizer_member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE,
    CONSTRAINT "bracket_roster_player_fkey" FOREIGN KEY ("player_member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE,
    CONSTRAINT "bracket_roster_organizer_player_key" UNIQUE ("organizer_member_id", "player_member_id")
);

ALTER TABLE "public"."bracket_roster" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "bracket_roster_organizer_idx" ON "public"."bracket_roster" ("organizer_member_id");

COMMENT ON TABLE "public"."bracket_roster" IS
  'An organizer''s sticky roster of past REGISTERED players (pre-fills the hopper next time). Added on admission by a trigger, never removed on eject. Walk-ups are NOT here (tournament-scoped/disposable).';


-- ============================================================================
-- Roster-on-admission trigger — sticky, registered-only, idempotent
-- ============================================================================
-- When a hopper row becomes 'official' (admitted) AND is a registered player,
-- record (organizer, player) in the roster. Fires on INSERT-as-official and on
-- the hopper→official transition; ON CONFLICT keeps it sticky/idempotent. An
-- eject (DELETE of the hopper row) does NOT touch the roster.
CREATE OR REPLACE FUNCTION "public"."add_to_bracket_roster_on_admission"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'official' AND NEW.member_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'official') THEN
    INSERT INTO public.bracket_roster (organizer_member_id, player_member_id)
    SELECT b.created_by, NEW.member_id
      FROM public.brackets b
     WHERE b.id = NEW.bracket_id
    ON CONFLICT (organizer_member_id, player_member_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "bracket_hopper_roster_trg" ON "public"."bracket_hopper";
CREATE TRIGGER "bracket_hopper_roster_trg"
  AFTER INSERT OR UPDATE ON "public"."bracket_hopper"
  FOR EACH ROW EXECUTE FUNCTION "public"."add_to_bracket_roster_on_admission"();


-- ============================================================================
-- Realtime: organizer + joined players watch the hopper live
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bracket_hopper'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bracket_hopper;
  END IF;
END $$;

ALTER TABLE "public"."bracket_hopper" REPLICA IDENTITY FULL;
