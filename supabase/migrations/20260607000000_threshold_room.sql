-- ============================================================================
-- THRESHOLD ROOM — Scoring System Workshop, third standalone work room
-- ============================================================================
--
-- Authors Threshold modules — the state-setter primitive that resolves
-- `home + away → one number` at match start and writes it into the match
-- state bag under a generic key. A saved threshold names an operation
-- (operationKind + operationArgs) from the code-side threshold registry and
-- carries an `expansion_mode` describing how it fans out:
--   single     — one value (a side-less milestone)
--   home_away  — author once from this_side/other_side, fan out to two values
--   per_pairing — one value per locked-lineup pairing
--
-- The row stores ONLY identity + the operation reference; the operation's
-- consumes/produces metadata is re-derived at load time by `buildThresholdRow`
-- (the registry is the single source of truth — no drift possible). The LO's
-- display `label` is separate from the generic `name` (the resolvable key):
-- the label is editable decoration, the name is the stable identity consumers
-- reference, so renaming never breaks a reader.
--
-- This room is independent of the per_game_allocators and triggers rooms:
-- separate table, separate loader, separate UI. It is library-authoring only —
-- applying a threshold to a league is a future scoring-system-room concern.
--
-- Official seed rows (read-only teaching templates) are added by Unit 8, not
-- here. A BEFORE UPDATE/DELETE trigger blocks any modification of
-- scope='official' rows (app-layer guard until table-level RLS lands, per
-- [[project_rls_disabled_in_dev]]).
--
-- See:
--   docs/brainstorms/2026-06-07-threshold-workshop-requirements.md
--   docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md (Unit 1)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Threshold variations table
--
-- Backbone columns (id, name, description, scope, author_id, timestamps) +
-- threshold-specific columns (label, definition JSONB, expansion_mode).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."thresholds" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Generic resolvable key (the state-bag name consumers reference). Assigned
  -- by us, stable, never edited by the LO. e.g. 'threshold_<shortid>'.
  "name"           text NOT NULL,
  -- Human-facing display name. Editable decoration; never used as a key.
  "label"          text NOT NULL,
  "description"    text,
  -- 'official' = read-only seeded row, author_id IS NULL, tamper trigger
  --              below blocks UPDATE/DELETE.
  -- 'user'     = author-owned, editable by its author, requires author_id.
  "scope"          text NOT NULL,
  "author_id"      uuid REFERENCES "public"."members"("id") ON DELETE SET NULL,
  -- Operation reference. JSONB shape:
  --   { "operationKind": <registered threshold operation name>,
  --     "operationArgs": { ... } }
  -- The operation's consumes/produces metadata is re-derived at load time via
  -- buildThresholdRow — NOT stored here, so it can never drift from the
  -- registry.
  "definition"     jsonb NOT NULL,
  -- 'single' | 'home_away' | 'per_pairing' — how the authored definition fans
  -- out into state-bag values at resolve time.
  "expansion_mode" text NOT NULL DEFAULT 'single',
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "thresholds_scope_check"
    CHECK (scope IN ('official', 'user')),
  CONSTRAINT "thresholds_expansion_mode_check"
    CHECK (expansion_mode IN ('single', 'home_away', 'per_pairing')),
  -- Official rows have no author; user rows must.
  CONSTRAINT "thresholds_author_required_for_user"
    CHECK (
      (scope = 'official' AND author_id IS NULL)
      OR
      (scope = 'user'     AND author_id IS NOT NULL)
    )
);

ALTER TABLE "public"."thresholds" OWNER TO "postgres";

COMMENT ON TABLE "public"."thresholds" IS
  'Saved Threshold variations — third standalone work room of the Scoring System Workshop. Each row defines a state setter (home + away -> one number) by naming an operation + args; expansion_mode controls fan-out. Library-authoring only — applying a threshold to a league is a future scoring-system-room concern.';

COMMENT ON COLUMN "public"."thresholds"."name" IS
  'Generic resolvable key (state-bag name consumers reference). Stable identity, never edited by the LO. Distinct from the display label.';

COMMENT ON COLUMN "public"."thresholds"."definition" IS
  'JSONB shape: { operationKind: <registered threshold op>, operationArgs: { ... } }. Metadata re-derived at load via buildThresholdRow, never stored, so it cannot drift from the registry.';

COMMENT ON COLUMN "public"."thresholds"."expansion_mode" IS
  'single | home_away | per_pairing — how the authored definition fans out into state-bag values at resolve time.';

-- Quick lookup by author for the workshop UI's "Yours" list.
CREATE INDEX IF NOT EXISTS "thresholds_author_id_idx"
  ON "public"."thresholds" ("author_id")
  WHERE author_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. Tamper trigger — block UPDATE / DELETE on scope='official' rows
--
-- App-layer guard until table-level RLS lands. The seeded officials are the
-- foundational templates every LO clones; allowing any logged-in user to
-- modify them would silently rewrite every scoring system that picks them up.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_official_threshold_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot UPDATE official thresholds row (id=%, name=%). Clone it instead.', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.scope = 'official' THEN
      RAISE EXCEPTION 'Cannot DELETE official thresholds row (id=%, name=%).', OLD.id, OLD.name
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thresholds_block_official_modification
  BEFORE UPDATE OR DELETE ON "public"."thresholds"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_official_threshold_modification();
