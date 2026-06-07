-- ============================================================================
-- THRESHOLD ROOM — seed official (read-only) templates
-- ============================================================================
--
-- The officials are the REAL thresholds the app already uses, converted into
-- the saveable/editable workshop shape (just like the allocator room seeds the
-- real 10-Point / 17-Point allocators). An LO clones one to get an editable
-- copy and tweak it.
--
-- The chart-based officials EMBED the chart's rows directly in the definition
-- (operationArgs.chart), exactly like the allocator embeds winner_side /
-- loser_side — so a cloned copy is self-contained and editable inline, owned by
-- the cloner. The embedded rows are built from the seeded global charts so they
-- stay faithful to today's hard-coded behavior.
--
--   - 3v3 — Games to win   : the BCA 3v3 finish line (points-3-man's
--                            homeWinTarget/awayWinTarget), chart_lookup over the
--                            3v3 Points chart, result_1, mirrored home_away.
--   - 5v5 — Games to win   : the same idea on the 5v5 Percentage chart.
--   - Empty Starter        : a blank formula (const 0) to build from scratch.
--
-- See docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md (Unit 8).
-- ============================================================================

-- Blank build-from-scratch starter (formula view).
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

-- Real chart-based finish lines, with the chart rows embedded from the seeded
-- global charts (chart_lookup, result_1 = games to win, mirrored home/away).
INSERT INTO "public"."thresholds" ("name", "label", "description", "scope", "author_id", "definition", "expansion_mode")
SELECT
  'threshold_official_3v3_finish',
  '3v3 — Games to win (finish line)',
  'How many games each team needs to win the match, by the handicap gap, on the BCA 3v3 points chart. This is the real 3v3 finish line — clone it and tweak the numbers.',
  'official',
  NULL,
  jsonb_build_object(
    'operationKind', 'chart_lookup',
    'operationArgs', jsonb_build_object(
      'output_field', 'result_1',
      'chart', jsonb_build_object(
        'chartType', tc.chart_type,
        'lookupMode', tc.lookup_mode,
        'rows', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'comp_1', r.comp_1, 'comp_2', r.comp_2,
              'result_1', r.result_1, 'result_2', r.result_2, 'result_3', r.result_3
            ) ORDER BY r.sort_order
          )
          FROM threshold_chart_rows r WHERE r.chart_id = tc.id
        )
      )
    )
  ),
  'home_away'
FROM threshold_charts tc
WHERE tc.entity_type = 'global' AND tc.name = 'Rackem League 3v3 Points Chart';

INSERT INTO "public"."thresholds" ("name", "label", "description", "scope", "author_id", "definition", "expansion_mode")
SELECT
  'threshold_official_5v5_finish',
  '5v5 — Games to win (finish line)',
  'How many games each team needs to win the match, by the handicap gap, on the 5v5 percentage chart. Clone it and tweak the numbers.',
  'official',
  NULL,
  jsonb_build_object(
    'operationKind', 'chart_lookup',
    'operationArgs', jsonb_build_object(
      'output_field', 'result_1',
      'chart', jsonb_build_object(
        'chartType', tc.chart_type,
        'lookupMode', tc.lookup_mode,
        'rows', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'comp_1', r.comp_1, 'comp_2', r.comp_2,
              'result_1', r.result_1, 'result_2', r.result_2, 'result_3', r.result_3
            ) ORDER BY r.sort_order
          )
          FROM threshold_chart_rows r WHERE r.chart_id = tc.id
        )
      )
    )
  ),
  'home_away'
FROM threshold_charts tc
WHERE tc.entity_type = 'global' AND tc.name = 'Rackem League 5v5 Percentage Chart';
