-- ============================================================================
-- THRESHOLD ROOM — seed official (read-only) templates
-- ============================================================================
--
-- Teaching templates the LO clones to start a variation. These are the
-- FORMULA-view officials (definition.operationKind = 'evaluate_expression');
-- the chart-view official lands with the chart editor.
--
-- Each demonstrates one pattern:
--   - Empty Starter        — single, constant 0 (clone-and-build-from-scratch)
--   - Head start by gap    — home_away, mirrored formula over the handicap totals
--   - Three-quarter mark   — single, side-less milestone over game_count
--
-- `name` is the generic resolvable key (assigned by us); `label` is what the LO
-- sees. Official rows have author_id IS NULL and are tamper-protected.
--
-- See docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md (Unit 8).
-- ============================================================================

INSERT INTO "public"."thresholds" ("name", "label", "description", "scope", "author_id", "definition", "expansion_mode")
VALUES (
  'threshold_official_empty',
  'Empty Starter',
  'A blank threshold that always resolves to 0. Clone this and build your own formula from scratch.',
  'official',
  NULL,
  '{"operationKind": "evaluate_expression", "operationArgs": {"expression": {"kind": "const", "value": 0}}}'::jsonb,
  'single'
);

INSERT INTO "public"."thresholds" ("name", "label", "description", "scope", "author_id", "definition", "expansion_mode")
VALUES (
  'threshold_official_head_start',
  'Head start by handicap gap',
  'Each side starts with points equal to how far ahead its team handicap is. Built once from "my side"; the away mirror is generated automatically.',
  'official',
  NULL,
  '{"operationKind": "evaluate_expression", "operationArgs": {"expression": {"kind": "op", "op": "-", "left": {"kind": "var", "name": "this_side_team_handicap"}, "right": {"kind": "var", "name": "other_side_team_handicap"}}}}'::jsonb,
  'home_away'
);

INSERT INTO "public"."thresholds" ("name", "label", "description", "scope", "author_id", "definition", "expansion_mode")
VALUES (
  'threshold_official_three_quarter',
  'Three-quarter mark',
  'A side-less milestone at three quarters of the match (total games x 0.75). The same number for everyone.',
  'official',
  NULL,
  '{"operationKind": "evaluate_expression", "operationArgs": {"expression": {"kind": "op", "op": "*", "left": {"kind": "var", "name": "game_count"}, "right": {"kind": "const", "value": 0.75}}}}'::jsonb,
  'single'
);
