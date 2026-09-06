-- Migration: Tournament paid foundation — Phase C, Unit C3 (remembered walk-ups)
--
-- A walk-up is an entrant with no account: identity is the name the organizer
-- typed, and nothing else. The original design treated them as fully disposable
-- — "just gone" when the tournament ends.
--
-- That was wrong about the real room. A walk-up who never wants an app can
-- still be a regular, and re-typing the same twenty names every week is exactly
-- the busywork this tool exists to remove. So the organizer's "past players"
-- list now remembers walk-up NAMES too.
--
-- What it deliberately does NOT do: create a global placeholder or member row.
-- A remembered walk-up is a private note in one organizer's list — no identity
-- reaches the rest of the app, which keeps the Resolved Decision (walk-ups are
-- tournament-scoped, LOs use their existing placeholder tools separately) intact.
-- The handicap column is RESERVED, not implemented: nothing on a tournament
-- entrant produces a handicap yet (that arrives with the handicap_races premium
-- feature, whose own description already promises "players we already know keep
-- theirs"). It is here so remembering one costs no migration later, and is free
-- text because the handicap SYSTEM is that feature's decision to make, not this
-- one's. Expect it to be NULL on every row until then.
--
-- Three parts: the table, a trigger mirroring the registered-roster one, and a
-- rewritten get_bracket_roster that returns both kinds as one list.

-- ============================================================================
-- bracket_walkup_roster — an organizer's remembered walk-up names
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."bracket_walkup_roster" (
    "id"                  uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizer_member_id" uuid NOT NULL,
    -- The whole identity of a walk-up. Stored as the organizer typed it.
    "display_name"        text NOT NULL,
    -- RESERVED for handicap_races (see header). Free text, always NULL today.
    "handicap"            text,
    "first_seen_at"       timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "bracket_walkup_roster_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bracket_walkup_roster_organizer_fkey"
      FOREIGN KEY ("organizer_member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."bracket_walkup_roster" OWNER TO "postgres";

-- Case-insensitive uniqueness per organizer: "Slim" and "slim" are one regular,
-- not two entries cluttering the list. The stored casing is whatever was typed
-- first; a later spelling is simply not re-added.
CREATE UNIQUE INDEX IF NOT EXISTS "bracket_walkup_roster_organizer_name_key"
  ON "public"."bracket_walkup_roster" ("organizer_member_id", lower(btrim("display_name")));

COMMENT ON COLUMN "public"."bracket_walkup_roster"."handicap" IS
  'RESERVED for the handicap_races feature — no code writes this yet. Free text because the handicap system is that feature''s decision.';

COMMENT ON TABLE "public"."bracket_walkup_roster" IS
  'An organizer''s remembered WALK-UP names (entrants with no account), so regulars who never register do not have to be re-typed every week. Added on admission by a trigger, never removed on eject. Private to one organizer — creates no global member or placeholder.';

-- ============================================================================
-- Walk-up-roster-on-admission trigger — mirrors the registered-roster one
-- ============================================================================
-- Recorded on ADMISSION, not on being added, for the same reason as the
-- registered roster: the list is "people who have actually played my
-- tournaments", not "names I once typed and thought better of".
CREATE OR REPLACE FUNCTION "public"."add_walkup_to_bracket_roster_on_admission"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'official' AND NEW.member_id IS NULL
     AND btrim(COALESCE(NEW.display_name, '')) <> ''
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'official') THEN
    INSERT INTO public.bracket_walkup_roster (organizer_member_id, display_name)
    SELECT b.created_by, btrim(NEW.display_name)
      FROM public.brackets b
     WHERE b.id = NEW.bracket_id
    ON CONFLICT (organizer_member_id, lower(btrim(display_name))) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "bracket_hopper_walkup_roster_trg" ON "public"."bracket_hopper";
CREATE TRIGGER "bracket_hopper_walkup_roster_trg"
  AFTER INSERT OR UPDATE ON "public"."bracket_hopper"
  FOR EACH ROW EXECUTE FUNCTION "public"."add_walkup_to_bracket_roster_on_admission"();

-- ============================================================================
-- get_bracket_roster — now returns registered players AND remembered walk-ups
-- ============================================================================
-- One list, because "past players" is one idea to an organizer. The two kinds
-- are told apart exactly as everywhere else in this feature: member_id set =
-- registered (with member fields joined for display), member_id NULL =
-- walk-up (display_name is the whole identity).
--
-- Both halves exclude anyone already in THIS bracket's hopper, which is what
-- keeps the setup screen's three groups duplicate-free. For walk-ups that
-- comparison is by trimmed, case-insensitive name — the only identity they have.
CREATE OR REPLACE FUNCTION "public"."get_bracket_roster"("p_bracket_id" "uuid")
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_organizer uuid;
  v_rows jsonb;
BEGIN
  SELECT b.created_by INTO v_organizer
    FROM brackets b
   WHERE b.id = p_bracket_id;

  IF v_organizer IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(row_data ORDER BY sort_name)
    INTO v_rows
    FROM (
      -- Registered past players.
      SELECT lower(COALESCE(m.nickname, m.first_name, '')) AS sort_name,
             jsonb_build_object(
               'member_id', m.id,
               'display_name', NULL,
               'handicap', NULL,
               'nickname', m.nickname,
               'first_name', m.first_name,
               'last_name', m.last_name,
               'system_player_number', m.system_player_number,
               'city', m.city,
               'state', m.state,
               'first_seen_at', r.first_seen_at
             ) AS row_data
        FROM bracket_roster r
        JOIN members m ON m.id = r.player_member_id
       WHERE r.organizer_member_id = v_organizer
         AND NOT EXISTS (
           SELECT 1 FROM bracket_hopper h
            WHERE h.bracket_id = p_bracket_id
              AND h.member_id = r.player_member_id
         )

      UNION ALL

      -- Remembered walk-ups. Matched to the hopper by name, since that is all
      -- the identity they have.
      SELECT lower(w.display_name) AS sort_name,
             jsonb_build_object(
               'member_id', NULL,
               'display_name', w.display_name,
               'handicap', w.handicap,
               'nickname', NULL,
               'first_name', NULL,
               'last_name', NULL,
               'system_player_number', NULL,
               'city', NULL,
               'state', NULL,
               'first_seen_at', w.first_seen_at
             ) AS row_data
        FROM bracket_walkup_roster w
       WHERE w.organizer_member_id = v_organizer
         AND NOT EXISTS (
           SELECT 1 FROM bracket_hopper h
            WHERE h.bracket_id = p_bracket_id
              AND h.member_id IS NULL
              AND lower(btrim(h.display_name)) = lower(btrim(w.display_name))
         )
    ) past;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_bracket_roster"("uuid") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_bracket_roster"("uuid") TO "authenticated";

COMMENT ON FUNCTION "public"."get_bracket_roster"("uuid") IS
  'The bracket organizer''s past players — registered members AND remembered walk-up names — as one list, filtered to those NOT already in this bracket''s hopper (it is an add-source). member_id set = registered; NULL = walk-up, identified by display_name. SECURITY DEFINER, authenticated-only; caller=created_by authz deferred to the RLS pass. See docs/plans/2026-09-04-001.';
