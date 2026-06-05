-- ============================================================================
-- Captain Re-Up Sheet — schema + dismissal-clearing trigger
--
-- Captures captains' end-of-season "are you returning, captain change?"
-- responses so the next-season wizard can pre-fill team decisions
-- without the operator chasing each captain individually.
--
-- One row per (season_id, team_id). Lifecycle:
--   - INSERT with dismissed_at when captain hits "Not now"
--   - UPDATE with submitted_at + returning_next_season + next_captain_id
--     when captain answers
--   - dismissed_at gets cleared automatically by trg_match_start_clears
--     _reup_dismissals when the captain's team plays its next match —
--     so a "Not now" only suppresses the modal until match #N+1
--
-- Absence of a row = no response yet. Wizard treats "no row" and
-- "row with submitted_at IS NULL" the same — team drops by default
-- unless the captain positively confirms returning.
--
-- See:
--   docs/brainstorms/2026-05-17-captain-reup-sheet-requirements.md
--   docs/plans/2026-05-17-002-feat-captain-reup-sheet-plan.md (Unit 1)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. The table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."season_reup_responses" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "season_id"               uuid NOT NULL REFERENCES "public"."seasons"("id") ON DELETE CASCADE,
  "team_id"                 uuid NOT NULL REFERENCES "public"."teams"("id") ON DELETE CASCADE,
  "captain_id"              uuid NOT NULL REFERENCES "public"."members"("id"),
  -- NULL until captain actually answers; once set it's true/false
  "returning_next_season"   boolean,
  -- NULL = same captain (or no answer yet); non-null = captain change
  "next_captain_id"         uuid REFERENCES "public"."members"("id"),
  "submitted_at"            timestamptz,
  "dismissed_at"            timestamptz,
  -- Audit: who actually submitted (in multi-captain edge cases the
  -- captain at the time of submit may differ from captain_id, which
  -- is who the row was created for at modal-show time)
  "submitted_by_captain_id" uuid REFERENCES "public"."members"("id"),
  "created_at"              timestamptz NOT NULL DEFAULT now(),
  "updated_at"              timestamptz NOT NULL DEFAULT now(),
  -- One re-up row per team per season (UPSERT semantics)
  CONSTRAINT "season_reup_responses_season_team_uniq" UNIQUE ("season_id", "team_id")
);

ALTER TABLE "public"."season_reup_responses" OWNER TO "postgres";

COMMENT ON TABLE "public"."season_reup_responses" IS
  'End-of-season "are you returning, captain change?" responses from captains. One row per (season_id, team_id). Pre-fills the next-season wizard. Absence of row OR submitted_at IS NULL = no response yet → team drops by default at wizard time. See docs/brainstorms/2026-05-17-captain-reup-sheet-requirements.md.';

-- Lookup indices — modal-trigger hook filters by captain_id, LO
-- status card + wizard prefill filter by team_id / season_id.
CREATE INDEX IF NOT EXISTS "season_reup_responses_captain_id_idx"
  ON "public"."season_reup_responses" ("captain_id");
CREATE INDEX IF NOT EXISTS "season_reup_responses_team_id_idx"
  ON "public"."season_reup_responses" ("team_id");
CREATE INDEX IF NOT EXISTS "season_reup_responses_season_id_idx"
  ON "public"."season_reup_responses" ("season_id");

-- ----------------------------------------------------------------------------
-- 2. Match-start trigger that clears dismissals
--
-- When a match transitions to status='in_progress', clear the
-- dismissed_at column for both teams in that match — so a captain
-- who said "Not now" at last week's match sees the modal again at
-- their next match. Scoped (only touches rows where submitted_at
-- IS NULL and dismissed_at IS NOT NULL → 0 rows for matches whose
-- captains have already answered, cheap no-op for out-of-window
-- matches).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."clear_reup_dismissals_on_match_start"()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  UPDATE season_reup_responses
  SET dismissed_at = NULL,
      updated_at   = NOW()
  WHERE submitted_at IS NULL
    AND dismissed_at IS NOT NULL
    AND team_id IN (NEW.home_team_id, NEW.away_team_id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."clear_reup_dismissals_on_match_start"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."clear_reup_dismissals_on_match_start"() IS
  'Trigger fn: when a match enters status=in_progress, clear dismissed_at on the season_reup_responses rows for both teams. Lets a captain who said "Not now" at last match see the modal again at the next match.';

-- Lock-down: SECURITY DEFINER means this runs as postgres, so we revoke
-- direct EXECUTE from anon/authenticated. Only the trigger invokes it.
REVOKE ALL ON FUNCTION "public"."clear_reup_dismissals_on_match_start"() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "trg_match_start_clears_reup_dismissals" ON "public"."matches";
CREATE TRIGGER "trg_match_start_clears_reup_dismissals"
  AFTER UPDATE OF status ON "public"."matches"
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'in_progress' AND NEW.status = 'in_progress')
  EXECUTE FUNCTION "public"."clear_reup_dismissals_on_match_start"();

-- ----------------------------------------------------------------------------
-- 3. updated_at maintenance trigger (standard pattern in this codebase)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."tg_season_reup_responses_updated_at"()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."tg_season_reup_responses_updated_at"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_season_reup_responses_updated_at" ON "public"."season_reup_responses";
CREATE TRIGGER "trg_season_reup_responses_updated_at"
  BEFORE UPDATE ON "public"."season_reup_responses"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."tg_season_reup_responses_updated_at"();
