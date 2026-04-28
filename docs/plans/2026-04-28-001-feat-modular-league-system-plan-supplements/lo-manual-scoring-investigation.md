# Investigation: `lo-manual-scoring` branch (Phase 0a research)

**Date:** 2026-04-28
**Question this answers:** Cherry-pick or rebuild for Unit 3.4 (threshold-chart editor UI)?
**Recommendation:** **Hybrid — port the UI components, rebuild the data layer.**

## What's on the branch

The `lo-manual-scoring` branch (latest commit `1fce578`, 9 commits diverged from `main`, 28 commits behind) contains two distinct workstreams:

### 1. Threshold-chart editor UI (10 component files, ~4,200 lines)

| File | Lines | Purpose |
|---|---|---|
| `PointsThresholdChartEditor.tsx` | 928 | Edit BCA points (-12..+12) chart |
| `PercentageThresholdChartEditor.tsx` | 862 | Edit BCA 5v5 percentage range chart |
| `RaceThresholdChartEditor.tsx` | 1530 | Edit race-based chart (individual races) |
| `RacePercentageThresholdChartEditor.tsx` | 851 | Race + percentage variant |
| `ChartTypeSelector.tsx`, `DatabaseStatusCard.tsx`, `SaveChartModal.tsx`, `ThresholdChartPageLayout.tsx`, `useThresholdChartPage.ts`, `index.ts` | (smaller) | Supporting components and hooks |

Quality assessment from spot-checking `PointsThresholdChartEditor.tsx`:
- Uses shadcn components correctly (Card, Button, Input, Label, Checkbox)
- Imports `get3v3GamesNeeded` from main's existing util path (no broken import)
- Has clear feature set: view/edit rows, add to top/bottom, delete, pattern-following, reset to default
- File-header comments are thorough
- Code structure is reasonable (though 1530 lines for the race editor is large — likely needs a split)

### 2. Data layer (DB migrations, hooks, queries)

| File | Status |
|---|---|
| `supabase/migrations/20260119000000_threshold_charts.sql` | **OBSOLETE** — `main` already has `20260410000002_threshold_charts.sql` for the same purpose |
| `supabase/migrations/20260119000001_seed_threshold_charts.sql` | **OBSOLETE** — `main` has `20260410000003_seed_threshold_charts.sql` |
| `supabase/migrations/20260119000002_league_format_settings.sql` | **OBSOLETE / SUPERSEDED** — main has modular preferences via `preferences` table |
| `src/api/hooks/useThresholdCharts.ts` (405 lines) | **NEEDS REVIEW** — built against obsolete schema; queries probably need rewriting against main's schema |
| `src/api/hooks/useLeagueFormatSettings.ts` (279 lines) | **OBSOLETE** — replaced by `useResolvedLeaguePrefs` on main |
| `src/api/queries/thresholdCharts.ts` | **NEEDS REVIEW** — same caveat as hooks |
| `src/api/queries/leagueFormatSettings.ts` | **OBSOLETE** |

### 3. Match-editor UI (operator/match-editor/, ~10 files)

This is a separate workstream the branch builds (LO-side match editing). Out of scope for Unit 3.4 (which is just the threshold-chart editor) but worth noting it exists.

## Compatibility with main's schema

`main` shipped its own `threshold_charts` infrastructure on 2026-04-10:
- `threshold_charts` parent table with `entity_type` cascade (global / organization / league)
- `threshold_chart_rows` child table with `comp_1, comp_2, result_1, result_2, result_3`
- `lookup_threshold(chart_id, comp_1, comp_2)` SQL function with exact + range modes
- 4 chart types seeded as global templates: `team_points`, `team_percentage`, `race_points`, `race_percentage`

The `lo-manual-scoring` branch's schema is **structurally similar** — same chart types, same lookup modes, same result-column shape. But it's a different file with a different timestamp and likely different exact SQL. Running both would conflict.

## Recommendation: hybrid port

**For Unit 3.4 implementation, plan to:**

1. **Keep the UI components** (the 10 files in `src/components/operator/threshold-editor/`). They're well-built, they use shadcn correctly, they import existing utilities from main. Roughly ~4,200 lines saved by not rebuilding.

2. **Discard the data layer entirely** — migrations and hooks. Build the data layer fresh against main's existing `threshold_charts` schema and the `lookup_threshold()` SQL function. The schemas are similar enough that the UI components should adapt without major restructuring; the hook/query rewrite is unavoidable but localized.

3. **Defer the `match-editor` workstream** — separate concern from Unit 3.4. If/when LO match editing becomes a feature, that can revive then.

## How to actually cherry-pick

```bash
# Approximate workflow (NOT to be run blindly — verify in a scratch branch first):

# 1. Create a scratch branch off main for the port attempt
git checkout -b feature/threshold-editor-ui-port main

# 2. Cherry-pick only the UI files from the most polished commit (1fce578)
#    — but use checkout, not cherry-pick, so we don't pull in the obsolete
#    migrations or hooks that came with the same commits.
git checkout 1fce578 -- src/components/operator/threshold-editor/

# 3. Resolve imports (the components likely import the obsolete
#    useThresholdCharts hook). Stub or rewrite those imports against
#    main's schema.

# 4. Build, run typecheck, fix what breaks. Iterate until the editor
#    pages render without errors when navigated to.

# 5. Wire the Save action to call lookup_threshold() and the
#    threshold_charts table per main's schema.
```

## Effort estimate revision for Unit 3.4

| Path | Estimate |
|---|---|
| Pure rebuild from scratch | 3-5 days |
| Hybrid port (this recommendation) | 1.5-2.5 days |
| Pure cherry-pick (NOT viable due to schema mismatch) | n/a |

The hybrid port saves ~1.5-2.5 days vs rebuilding.

## What this resolves in the plan

This memo answers the "Resolve Before Planning" item from
`docs/plans/2026-04-28-001-feat-modular-league-system-plan.md` Phase 0a
research bucket: **Investigate `lo-manual-scoring` branch viability**.

Outcome: **viable for UI components, not for data layer**. Unit 3.4
sized at hybrid port (1.5-2.5 days) rather than rebuild (3-5 days).
