-- ============================================================================
-- THRESHOLD ROOM — seed official (read-only) templates
-- ============================================================================
--
-- The officials are EVERY threshold the app uses anywhere, converted into the
-- saveable workshop shape (like the allocator room seeds the real allocators).
-- They double as a learning tool: the same answer as a chart AND as a formula,
-- a percent-of-another, Fargo giving start points AND a win threshold, etc.
--
-- Naming is ENCODING-FIRST: a threshold is calibrated for a specific handicap
-- encoding (points / percentage / fargo) and the input must match it. Charts
-- are locked to the lineup size they were built for; formulas scale to any size.
--
-- Chart officials EMBED their rows (clone-to-own, editable inline). Built-in
-- calculations (formulas, fargo, read-a-pref, milestone) are clone-and-use —
-- their math isn't editable in the arithmetic builder.
--
-- See docs/plans/2026-06-07-001-feat-threshold-workshop-plan.md (Unit 8).
-- ============================================================================

-- ---- POINTS encoding -------------------------------------------------------

-- Games to win — Points CHART (3 players). The real points-3-man finish line.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
SELECT 'threshold_official_points_chart_win','Games to win — Points chart (3 players)',
  'How many games each team needs to win, by the points handicap gap, on the 3-player chart. Input must be a POINTS-based handicap. The chart is locked to 3 players / 18 games — clone it and tweak the numbers.',
  'official', NULL,
  jsonb_build_object('operationKind','chart_lookup','operationArgs',jsonb_build_object('output_field','result_1','chart',jsonb_build_object('chartType',tc.chart_type,'lookupMode',tc.lookup_mode,'rows',(SELECT jsonb_agg(jsonb_build_object('comp_1',r.comp_1,'comp_2',r.comp_2,'result_1',r.result_1,'result_2',r.result_2,'result_3',r.result_3) ORDER BY r.sort_order) FROM threshold_chart_rows r WHERE r.chart_id=tc.id)))),
  'home_away'
FROM threshold_charts tc WHERE tc.entity_type='global' AND tc.name='Rackem League 3v3 Points Chart';

-- Games to win — Points FORMULA (any lineup). Same answer, size-agnostic.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_points_formula_win','Games to win — Points formula (any lineup)',
  'The same games-to-win answer as the points chart, but computed by formula so it works for ANY lineup size (it scales with the game count). Input must be a points-based handicap. Built-in calculation.',
  'official', NULL,
  '{"operationKind":"games_needed_3v3_formula","operationArgs":{"output_field":"games_to_win"}}'::jsonb,'home_away'
);

-- Lower edge (tie or win) — Points chart (3 players). The real lower band.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_points_chart_edge','Lower edge (tie or win) — Points chart (3 players)',
  'The lower scoring band on the 3-player points chart: the tie target when a tie is possible, otherwise the win target. Points handicap. Built-in calculation.',
  'official', NULL,
  '{"operationKind":"chart_lookup_3v3","operationArgs":{"side":"home","output_field":"games_to_tie_or_win"}}'::jsonb,'home_away'
);

-- ---- PERCENTAGE encoding ---------------------------------------------------

-- Games to win — Percentage CHART (5 players).
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
SELECT 'threshold_official_pct_chart_win','Games to win — Percentage chart (5 players)',
  'How many games each team needs to win, by the percentage handicap gap, on the 5-player chart. Input must be a PERCENTAGE-based handicap. Locked to its size — clone it and tweak the numbers.',
  'official', NULL,
  jsonb_build_object('operationKind','chart_lookup','operationArgs',jsonb_build_object('output_field','result_1','chart',jsonb_build_object('chartType',tc.chart_type,'lookupMode',tc.lookup_mode,'rows',(SELECT jsonb_agg(jsonb_build_object('comp_1',r.comp_1,'comp_2',r.comp_2,'result_1',r.result_1,'result_2',r.result_2,'result_3',r.result_3) ORDER BY r.sort_order) FROM threshold_chart_rows r WHERE r.chart_id=tc.id)))),
  'home_away'
FROM threshold_charts tc WHERE tc.entity_type='global' AND tc.name='Rackem League 5v5 Percentage Chart';

-- Games to win — Percentage FORMULA (any lineup).
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_pct_formula_win','Games to win — Percentage formula (any lineup)',
  'The same games-to-win answer as the percentage chart, computed by formula so it works for any lineup size. Input must be a percentage-based handicap. Built-in calculation.',
  'official', NULL,
  '{"operationKind":"games_needed_5v5_formula","operationArgs":{"output_field":"games_to_win"}}'::jsonb,'home_away'
);

-- ---- FARGO encoding --------------------------------------------------------

-- Start points — Fargo (any lineup). The real 10/17-point head start.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_fargo_start','Start points — Fargo (any lineup)',
  'Gives the weaker team a head start in points, computed from the lineup Fargo ratings. Input must be FARGO ratings. Any lineup size. Built-in calculation.',
  'official', NULL,
  '{"operationKind":"fargo_start_points_for_side","operationArgs":{"side":"home"}}'::jsonb,'home_away'
);

-- Games to win — Fargo (any lineup). The Fargo win-threshold.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_fargo_win','Games to win — Fargo (any lineup)',
  'How many games each team needs to win, derived from the lineup Fargo ratings (FargoRate win expectancy). Input must be Fargo ratings. Any lineup size. Built-in calculation.',
  'official', NULL,
  '{"operationKind":"fargo_games_won","operationArgs":{"output_field":"games_to_win"}}'::jsonb,'home_away'
);

-- NOTE: there is NO "read a league setting" win threshold and NO prefs-based
-- milestone in our real packages — every package threshold is handicap-derived.
-- The implemented percent-5-man uses read_pref/arithmetic-on-prefs as a STUB;
-- the real 5-man % derives the win from the percentage handicap diff (the
-- percentage chart/formula above), and the milestone is 70% of THAT win (which
-- needs a threshold-reads-threshold mechanism we don't have yet). So neither is
-- seeded as a real template.

-- ---- BLANK -----------------------------------------------------------------

-- Empty Starter — build your own formula from scratch.
INSERT INTO "public"."thresholds" ("name","label","description","scope","author_id","definition","expansion_mode")
VALUES (
  'threshold_official_empty','Empty Starter',
  'A blank threshold that resolves to 0. Clone it and build your own formula from scratch.',
  'official', NULL,
  '{"operationKind":"evaluate_expression","operationArgs":{"expression":{"kind":"const","value":0}}}'::jsonb,'single'
);
