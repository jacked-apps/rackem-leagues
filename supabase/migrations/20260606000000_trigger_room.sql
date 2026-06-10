-- ============================================================================
-- TRIGGER ROOM — Scoring System Workshop, second standalone work room
-- ============================================================================
--
-- Authors Trigger modules — the if/then primitive that fires at match
-- start/end or during the match. A Trigger has TYPE / CONDITION / ACTION /
-- RE-ARM. Order is NOT stored on the row — it's a scoring system room
-- concern (future). The loader synthesizes a default Order when assembling
-- the in-memory Trigger.
--
-- This room is independent of the per_game_allocators room: separate table,
-- separate loader, separate UI. The only shared piece is a generic
-- ExpressionBuilder widget (UI code, not state).
--
-- Four foundational rows seeded as scope='official', read-only, teaching the
-- LO what TYPE × CONDITION × ACTION combinations are possible:
--   1. Initial credit  — match_start, condition=always, action=set
--   2. Game-N bonus    — anytime, condition=games_played==13, action=expr
--   3. Sweep bonus     — match_end, condition=home_wins>20, action=expr
--   4. Empty starter   — blank template for cloning to build from scratch
--
-- A BEFORE UPDATE/DELETE trigger blocks any modification of scope='official'
-- rows. App-layer guard until table-level RLS is enabled (separate effort
-- per [[project_rls_disabled_in_dev]]).
--
-- See:
--   docs/brainstorms/2026-06-06-trigger-room-requirements.md
--   docs/plans/2026-06-06-001-feat-trigger-room-plan.md (Unit 1)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Trigger variations table
--
-- Backbone columns (id, name, description, scope, author_id, timestamps) +
-- trigger-specific columns (trigger_type, condition JSONB, action JSONB,
-- rearm). Order is intentionally absent — it's set by the scoring system
-- room (future).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."triggers" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"           text NOT NULL,
  "description"    text,
  -- 'official' = read-only seeded row, author_id IS NULL, tamper trigger
  --              below blocks UPDATE/DELETE.
  -- 'user'     = author-owned, editable by its author, requires author_id.
  "scope"          text NOT NULL,
  "author_id"      uuid REFERENCES "public"."members"("id") ON DELETE SET NULL,
  -- 'match_start' | 'match_end' | 'anytime'
  "trigger_type"   text NOT NULL,
  -- Condition JSONB shape per `src/systems/points-system/types.ts`:
  --   { "kind": "always" } OR
  --   { "kind": "compare", "left": ConditionOperand, "op": OperatorSymbol, "right": ConditionOperand }
  "condition"      jsonb NOT NULL,
  -- Action JSONB shape:
  --   { "target": "home_points" | "away_points",
  --     "value": { "kind": "set", "value": <number|bool|string|null> }
  --            | { "kind": "expr", "expr": <Expression tree> } }
  "action"         jsonb NOT NULL,
  -- 'single_shot' | 'periodic' | 'manual'
  "rearm"          text NOT NULL DEFAULT 'single_shot',
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "triggers_scope_check"
    CHECK (scope IN ('official', 'user')),
  CONSTRAINT "triggers_type_check"
    CHECK (trigger_type IN ('match_start', 'match_end', 'anytime')),
  CONSTRAINT "triggers_rearm_check"
    CHECK (rearm IN ('single_shot', 'periodic', 'manual')),
  -- Official rows have no author; user rows must.
  CONSTRAINT "triggers_author_required_for_user"
    CHECK (
      (scope = 'official' AND author_id IS NULL)
      OR
      (scope = 'user'     AND author_id IS NOT NULL)
    )
);

ALTER TABLE "public"."triggers" OWNER TO "postgres";

COMMENT ON TABLE "public"."triggers" IS
  'Saved Trigger variations — second standalone work room of the Scoring System Workshop. Each row defines a self-contained Trigger (TYPE / CONDITION / ACTION / RE-ARM). Order is NOT stored here — it is set by the future scoring system room when triggers get assembled into a composition.';

COMMENT ON COLUMN "public"."triggers"."condition" IS
  'JSONB shape: { kind: "always" } | { kind: "compare", left, op, right }. Mirrors in-memory Condition type.';

COMMENT ON COLUMN "public"."triggers"."action" IS
  'JSONB shape: { target: "home_points" | "away_points", value: { kind: "set", value } | { kind: "expr", expr } }. v1 restricts target to home_points/away_points.';

-- Quick lookup by author for the workshop UI's "Yours" list.
CREATE INDEX IF NOT EXISTS "triggers_author_id_idx"
  ON "public"."triggers" ("author_id")
  WHERE author_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. Tamper trigger — block UPDATE / DELETE on scope='official' rows
--
-- App-layer guard until table-level RLS lands. The seeded officials are the
-- foundational templates every LO can clone; allowing any logged-in user to
-- modify them would silently rewrite every scoring system that picks them up.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_official_trigger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot UPDATE official triggers row (id=%, name=%). Clone it instead.', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot DELETE official triggers row (id=%, name=%).', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER triggers_block_official_modification
  BEFORE UPDATE OR DELETE ON "public"."triggers"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_official_trigger_modification();


-- ----------------------------------------------------------------------------
-- 3. Seed four official rows (read-only templates)
--
-- Each one teaches the LO a different TYPE × CONDITION × ACTION combination.
-- ----------------------------------------------------------------------------

-- "Initial credit" — match_start, condition=always, set home_points to 50.
-- Pattern: the start-points award (10-Point's start credit). Demonstrates
-- the simplest possible trigger.
INSERT INTO "public"."triggers" ("name", "description", "scope", "author_id", "trigger_type", "condition", "action", "rearm")
VALUES (
  'Initial credit — Official',
  'At match start, set home points to 50. Demonstrates a match_start trigger with an always-true condition and a literal set action. Clone this to build any "give the home team N points at the start" rule.',
  'official',
  NULL,
  'match_start',
  '{"kind": "always"}'::jsonb,
  '{"target": "home_points", "value": {"kind": "set", "value": 50}}'::jsonb,
  'single_shot'
);

-- "Game-N bonus" — anytime, condition=games_played==13, action adds 5 to home_points.
-- Pattern: per-game milestone (give a team a bonus at a specific point in the match).
INSERT INTO "public"."triggers" ("name", "description", "scope", "author_id", "trigger_type", "condition", "action", "rearm")
VALUES (
  'Game-13 bonus — Official',
  'When game 13 has been played, give the home team 5 extra points. Demonstrates an anytime trigger with a compare condition and an arithmetic action. Clone this to build any "at game N, add bonus points" rule.',
  'official',
  NULL,
  'anytime',
  '{"kind": "compare", "left": {"kind": "var", "name": "games_played"}, "op": "==", "right": {"kind": "const", "value": 13}}'::jsonb,
  '{"target": "home_points", "value": {"kind": "expr", "expr": {"kind": "op", "op": "+", "left": {"kind": "var", "name": "home_points"}, "right": {"kind": "const", "value": 5}}}}'::jsonb,
  'single_shot'
);

-- "Sweep bonus" — match_end, condition=home_wins > 20, action adds 10 to home_points.
-- Pattern: end-of-match formula (give the home team a bonus if they won big).
INSERT INTO "public"."triggers" ("name", "description", "scope", "author_id", "trigger_type", "condition", "action", "rearm")
VALUES (
  'Sweep bonus — Official',
  'At match end, if the home team won more than 20 games, give them 10 extra points. Demonstrates a match_end trigger with a compare condition and an arithmetic action.',
  'official',
  NULL,
  'match_end',
  '{"kind": "compare", "left": {"kind": "var", "name": "home_wins"}, "op": ">", "right": {"kind": "const", "value": 20}}'::jsonb,
  '{"target": "home_points", "value": {"kind": "expr", "expr": {"kind": "op", "op": "+", "left": {"kind": "var", "name": "home_points"}, "right": {"kind": "const", "value": 10}}}}'::jsonb,
  'single_shot'
);

-- "Empty starter" — minimal placeholder for the LO to clone and customize.
INSERT INTO "public"."triggers" ("name", "description", "scope", "author_id", "trigger_type", "condition", "action", "rearm")
VALUES (
  'Empty Starter',
  'Blank template. Fires at match start with an always-true condition and a no-op action. Clone this and build a trigger from scratch.',
  'official',
  NULL,
  'match_start',
  '{"kind": "always"}'::jsonb,
  '{"target": "home_points", "value": {"kind": "set", "value": 0}}'::jsonb,
  'single_shot'
);
