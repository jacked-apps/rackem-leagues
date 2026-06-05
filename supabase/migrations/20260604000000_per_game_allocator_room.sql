-- ============================================================================
-- PER-GAME ALLOCATOR ROOM — Scoring System Workshop, first room
-- ============================================================================
--
-- This migration lands the storage layer for the first room of the Scoring
-- System Workshop building. A "variation" is one row in the new
-- `per_game_allocators` table; a league picks one by setting
-- `preferences.per_game_allocator_id`. NULL pointer = today's behavior
-- (the prepackaged composition's allocator slot is used unchanged).
--
-- Four foundational rows are seeded as `scope='official'`, read-only,
-- byte-equivalent to the current TypeScript factory defaults:
--   1. Percent 5-Man         (winner fixed 0.1, loser fixed 0)
--   2. 10-Point              (winner fixed 10,  loser range 0-7 "Balls pocketed by loser")
--   3. 17-Point              (winner formula 10 + (7 − loser), loser range 0-7)
--   4. Empty Starter         (winner fixed 0,   loser fixed 0)
--
-- A BEFORE UPDATE/DELETE trigger blocks any modification of `scope='official'`
-- rows. This is the app-layer guard until table-level RLS is enabled
-- (RLS is a separate planned effort per `[[project_rls_disabled_in_dev]]`).
--
-- See:
--   docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md
--   docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md (Unit 1)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Per-game allocator variations table
--
-- Backbone columns (id, name, description, scope, author_id, timestamps) +
-- room-specific columns (winner_side, loser_side as JSONB mirroring the
-- in-memory SideConfig shape from src/systems/points-system/types.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."per_game_allocators" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"           text NOT NULL,
  "description"    text,
  -- 'official' = read-only seeded row, author_id IS NULL, can be cloned but
  --              never updated or deleted (tamper trigger below blocks).
  -- 'user'     = author-owned, editable by its author, requires author_id.
  "scope"          text NOT NULL,
  "author_id"      uuid REFERENCES "public"."members"("id") ON DELETE SET NULL,
  -- SideConfig shape per `src/systems/points-system/types.ts`:
  --   { "base": <number> | { "min": N, "max": N, "label": "..." },
  --     "formula": null | { "operationKind": "...", "operationArgs": {...} } }
  "winner_side"    jsonb NOT NULL,
  "loser_side"     jsonb NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "per_game_allocators_scope_check"
    CHECK (scope IN ('official', 'user')),
  -- Official rows have no author; user rows must.
  CONSTRAINT "per_game_allocators_author_required_for_user"
    CHECK (
      (scope = 'official' AND author_id IS NULL)
      OR
      (scope = 'user'     AND author_id IS NOT NULL)
    )
);

ALTER TABLE "public"."per_game_allocators" OWNER TO "postgres";

COMMENT ON TABLE "public"."per_game_allocators" IS
  'Saved per-game allocator variations — first room of the Scoring System Workshop. Each row defines a winner-side + loser-side dial configuration mirroring src/systems/points-system/types.ts SideConfig. Scope=official rows are seeded read-only templates; scope=user rows are author-owned editable variations.';

COMMENT ON COLUMN "public"."per_game_allocators"."winner_side" IS
  'JSONB shape: { base: number | { min, max, label }, formula: null | { operationKind, operationArgs } }. Mirrors in-memory SideConfig.';

COMMENT ON COLUMN "public"."per_game_allocators"."loser_side" IS
  'JSONB shape: { base: number | { min, max, label }, formula: null | { operationKind, operationArgs } }. Mirrors in-memory SideConfig.';

-- Quick lookup by author for the workshop UI's "Yours" list.
CREATE INDEX IF NOT EXISTS "per_game_allocators_author_id_idx"
  ON "public"."per_game_allocators" ("author_id")
  WHERE author_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. Tamper trigger — block UPDATE / DELETE on scope='official' rows
--
-- App-layer guard until table-level RLS lands. The seeded officials are the
-- foundational templates every LO can clone; allowing them to be modified
-- by any logged-in user would silently rewrite every league's scoring.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_official_per_game_allocator_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot UPDATE official per_game_allocators row (id=%, name=%). Clone it instead.', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot DELETE official per_game_allocators row (id=%, name=%).', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  -- Defensive: this trigger should only ever fire on UPDATE/DELETE.
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER per_game_allocators_block_official_modification
  BEFORE UPDATE OR DELETE ON "public"."per_game_allocators"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_official_per_game_allocator_modification();


-- ----------------------------------------------------------------------------
-- 3. Per-league pointer column on preferences
--
-- Lives alongside the other modular axes (points_calculator,
-- threshold_chart_id). NULL = today's behavior (use the prepackaged
-- composition's allocator slot). Non-NULL = the live-scoring path loads
-- and swaps in the variation at match start.
--
-- ON DELETE RESTRICT prevents accidental orphaning of a pointer while a
-- league is still pointing at the row. (Historical match replay does NOT
-- depend on the row existing — the snapshot embeds the resolved object
-- at match start. See plan Unit 5.)
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."preferences"
  ADD COLUMN IF NOT EXISTS "per_game_allocator_id" uuid
    REFERENCES "public"."per_game_allocators"("id") ON DELETE RESTRICT;

COMMENT ON COLUMN "public"."preferences"."per_game_allocator_id" IS
  'FK to per_game_allocators table — picks which variation the league uses for the per-game allocator slot of its Scoring System. NULL = use the prepackaged composition default.';


-- ----------------------------------------------------------------------------
-- 4. Extend resolved_league_preferences view with the new cascade column
--
-- Pattern matches the existing modular axes: league override → org default
-- → COALESCE'd. Adding the new column at the END preserves column order
-- for the prior columns.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.resolved_league_preferences;

CREATE VIEW public.resolved_league_preferences AS
SELECT
  l.id AS league_id,
  l.organization_id,

  -- Original columns (unchanged)
  COALESCE(league_prefs.handicap_variant, org_prefs.handicap_variant, l.handicap_variant, 'standard')
    AS handicap_variant,
  COALESCE(league_prefs.team_handicap_variant, org_prefs.team_handicap_variant, org_prefs.handicap_variant, l.handicap_variant, 'standard')
    AS team_handicap_variant,
  COALESCE(league_prefs.game_history_limit, org_prefs.game_history_limit, 200)
    AS game_history_limit,
  COALESCE(league_prefs.golden_break_counts_as_win, org_prefs.golden_break_counts_as_win, l.golden_break_counts_as_win, true)
    AS golden_break_counts_as_win,

  -- Phase 1 modular columns
  COALESCE(league_prefs.max_roster_size, org_prefs.max_roster_size, 8)
    AS max_roster_size,
  COALESCE(league_prefs.lineup_size, org_prefs.lineup_size, 3)
    AS lineup_size,
  COALESCE(league_prefs.handicap_type, org_prefs.handicap_type, 'points')
    AS handicap_type,
  COALESCE(league_prefs.game_generation, org_prefs.game_generation, 'double_round_robin')
    AS game_generation,
  COALESCE(league_prefs.points_system, org_prefs.points_system, 'differential')
    AS points_system,
  COALESCE(league_prefs.threshold_chart_id, org_prefs.threshold_chart_id)
    AS threshold_chart_id,

  -- Phase 2 modular columns
  COALESCE(league_prefs.pairing_format, org_prefs.pairing_format, 'single_rack')
    AS pairing_format,
  COALESCE(league_prefs.points_calculator, org_prefs.points_calculator, 'linear_above_threshold')
    AS points_calculator,
  COALESCE(league_prefs.points_calculator_params, org_prefs.points_calculator_params, '{}'::jsonb)
    AS points_calculator_params,
  COALESCE(league_prefs.win_condition, org_prefs.win_condition, 'games')
    AS win_condition,
  COALESCE(league_prefs.mechanism, org_prefs.mechanism, 'extra_games')
    AS mechanism,
  COALESCE(league_prefs.standings_sort, org_prefs.standings_sort, ARRAY['match_wins','games_won','points_earned']::TEXT[])
    AS standings_sort,
  COALESCE(league_prefs.tiebreaker_trigger, org_prefs.tiebreaker_trigger, 'never')
    AS tiebreaker_trigger,
  COALESCE(league_prefs.tiebreaker_format, org_prefs.tiebreaker_format, 'accept_tie')
    AS tiebreaker_format,
  COALESCE(league_prefs.race_length, org_prefs.race_length)
    AS race_length,

  -- Scoring System Workshop — Per-Game Allocator Room
  COALESCE(league_prefs.per_game_allocator_id, org_prefs.per_game_allocator_id)
    AS per_game_allocator_id

FROM public.leagues l
LEFT JOIN public.preferences org_prefs
  ON org_prefs.entity_type = 'organization' AND org_prefs.entity_id = l.organization_id
LEFT JOIN public.preferences league_prefs
  ON league_prefs.entity_type = 'league' AND league_prefs.entity_id = l.id;

COMMENT ON VIEW public.resolved_league_preferences IS
  'Final resolved preferences for each league with full fallback chain: league → org → system default. Includes original columns, Phase 1 + Phase 2 modular columns, and the per-game allocator workshop pointer (per_game_allocator_id).';


-- ----------------------------------------------------------------------------
-- 5. Seed four official rows (read-only templates)
--
-- Dial values are 1:1 with the current TypeScript factory defaults in
-- src/systems/points-system/compositions/*.ts. The official rows are the
-- cloneable templates the workshop UI presents alongside a user's own
-- variations. They are protected from modification by the tamper trigger
-- installed above.
--
-- JSONB shapes mirror the in-memory `SideConfig` discriminated union:
--   { base: <number> | { min, max, label }, formula: null | { operationKind, operationArgs } }
-- ----------------------------------------------------------------------------

-- Percent 5-Man: winner 0.1 per game, loser 0. (Compositions/percent-5-man.ts default.)
INSERT INTO "public"."per_game_allocators" ("name", "description", "scope", "author_id", "winner_side", "loser_side")
VALUES (
  'Percent 5-Man — Official',
  'CSI BCAPL Percentage 5-Man per-game allocation. Winner gets 0.1 per game; loser gets 0. The milestone jumps to 1.5 / 3.0 live in the trigger room, not here.',
  'official',
  NULL,
  '{"base": 0.1, "formula": null}'::jsonb,
  '{"base": 0,   "formula": null}'::jsonb
);

-- 10-Point: winner 10, loser scorer-input 0-7. (Compositions/10-point.ts default.)
INSERT INTO "public"."per_game_allocators" ("name", "description", "scope", "author_id", "winner_side", "loser_side")
VALUES (
  '10-Point — Official',
  'CSI 10-Point Scoring System per-game allocation. Winner gets 10; loser gets a scorer-entered value 0-7 (balls pocketed before losing).',
  'official',
  NULL,
  '{"base": 10, "formula": null}'::jsonb,
  '{"base": {"min": 0, "max": 7, "label": "Balls pocketed by loser"}, "formula": null}'::jsonb
);

-- 17-Point: winner = (17 - other_side_value), so winner gets 17 minus
-- the balls the loser pocketed. Per-game total is always 17. The formula
-- is self-contained — it doesn't reference the base — so the editor
-- shows a clean expression without hidden state. Stored as
-- evaluate_expression so the click-to-build editor renders and edits
-- a clone faithfully.
INSERT INTO "public"."per_game_allocators" ("name", "description", "scope", "author_id", "winner_side", "loser_side")
VALUES (
  '17-Point — Official',
  'CSI 17-Point Scoring System per-game allocation. Winner gets 17 minus the balls the loser pocketed, so per-game total is always 17.',
  'official',
  NULL,
  '{"base": 0, "formula": {"operationKind": "evaluate_expression", "operationArgs": {"expression": {"kind": "op", "op": "-", "left": {"kind": "const", "value": 17}, "right": {"kind": "var", "name": "other_side_value"}}}}}'::jsonb,
  '{"base": {"min": 0, "max": 7, "label": "Balls pocketed by loser"}, "formula": null}'::jsonb
);

-- Empty Starter: a clean slate template. Both sides at 0; the LO fills in.
INSERT INTO "public"."per_game_allocators" ("name", "description", "scope", "author_id", "winner_side", "loser_side")
VALUES (
  'Empty Starter',
  'Blank template. Both sides start at 0. Clone this and build a variation from scratch.',
  'official',
  NULL,
  '{"base": 0, "formula": null}'::jsonb,
  '{"base": 0, "formula": null}'::jsonb
);
