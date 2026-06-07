---
title: "feat: Threshold Workshop — third Scoring System work room"
type: feat
status: active
date: 2026-06-07
origin: docs/brainstorms/2026-06-07-threshold-workshop-requirements.md
---

# feat: Threshold Workshop — third Scoring System work room

## Overview

Build the **Threshold Workshop** — the third standalone work room in the Scoring System
"Workshops building," after the per-game allocator room and the trigger room. It lets a League
Operator author **Threshold** modules as DB-row **data** (not code) and save them to a library,
exactly as the trigger room did for triggers.

A threshold is **one agnostic resolver: `home + away → one number`**, written into the match
state bag under a generic key. The LO authors it through one of two interchangeable **views** —
a **formula** (rides an `evaluate_expression` operation, like the allocator) or a **chart** (a
lookup table, reusing the existing `threshold_charts` data layer + a salvaged editor). The
runtime never knows which view produced the value.

Like the trigger room, **this room only builds and saves threshold modules to a library.** It
does **not** wire them onto leagues or into compositions — that's the future assembly room.

## Problem Frame

Compositions today declare their threshold rows **in code** (e.g.
`src/systems/points-system/compositions/points-3-man.ts` builds four `buildThresholdRow(...)`
entries inline). There is no way for an LO to author their own. This room makes thresholds
authorable, validated, and savable — closing the last match-completion-critical module before
the assembly room becomes buildable. (See origin:
`docs/brainstorms/2026-06-07-threshold-workshop-requirements.md`.)

## Requirements Trace

Carried from the origin requirements doc (R1–R13):

- R1. A threshold resolves `home + away → one number` and writes it to the state bag under a
  generic key; no knowledge of consumers.
- R2. Authored via one of two interchangeable views — **formula** or **chart** — both compiling
  to the same resolver; runtime never branches on which.
- R3. A threshold declares its expected input shape (array for a team / scalar for an
  individual); the workshop validates the built math/chart against that declaration.
- R4. Display **label + description** are separate from the generic runtime key the LO never
  edits.
- R5. Input shaping is chosen from a preset menu (difference / single side / sum / pref) or
  built via the expression builder.
- R6. A **"home and away?" toggle**: on → author once from a neutral side perspective, the away
  twin is generated; off → a single side-less value.
- R7. **Formula view** — preset library + use / use-as-template / build-from-scratch, on the
  shared `ExpressionBuilder`.
- R8. **Chart view** — preset library + use / use-as-template / create-your-own, on a unified
  chart-table editor (exact + range, generate-from-games, hand-edit warnings + "use anyway"
  gate).
- R9. A formula can be materialized into an editable chart (generate-from-games); hand-editing a
  cell off-formula makes that chart the authoritative resolver.
- R10. List page = **Templates + Yours**; saved as a **row** in the room's own table.
- R11. **Officials** are read-only + tamper-protected; user rows are author-owned.
- R12. A **save-time guard** (validator + synthetic dry-run) runs before persisting; the loader
  re-validates on read and never throws.
- R13. Own card on the workshop home page, own route, own folder/loader/table — sharing only the
  `ExpressionBuilder` widget and the salvaged chart editor.

## Scope Boundaries

- **NOT applying thresholds to leagues / wiring into compositions.** Library authoring only —
  same call the trigger room made. No `runtime.ts` or composition changes.
- **NOT setting ORDER / position** — a scoring-system concern.
- **NOT building the standings team-bonus or any handicap adapter.** Per origin: adapting the
  incoming handicap is a separate upstream adapter step; the threshold receives `home`/`away`
  already in final form. Do not code, expect, or design around it.
- **NOT touching the live manual-scoring / match-review UI** (already shipped).
- **NOT inline LO-help** (InfoButtons/glossary) — rolls out via the docs phases.

### Deferred to Separate Tasks

- **Apply-to-league wiring** (the salvaged `ThresholdSourceStep` wizard step; the existing
  `preferences.threshold_chart_id` / `seasons.threshold_chart_id` columns; assigning the final
  generic state-bag key): the future **assembly / scoring-system room**.
- **Glossary + InfoButton coverage** for threshold terms: the operator-help docs phases.

## Context & Research

### Relevant Code and Patterns

**The primitive the workshop authors INTO (exists, current branch):**
- `src/systems/points-system/types.ts` — `ThresholdRow` `{ name, scope?, expectedHandicapType,
  expectedSize, outputType, outputSide, outputRange, operationKind, operationArgs }`;
  `ThresholdOperation`; `ThresholdInputs` `{ homeRatings, awayRatings, homeHandicapDiff,
  awayHandicapDiff, gameCount, prefs, homeTeamHandicap?, awayTeamHandicap? }`; `SizeRequirement`
  = `{kind:'lineup_sizes';sizes} | {kind:'single'} | {kind:'none'}`; the `Expression` tree
  `const | var | op`.
- `src/systems/points-system/threshold-registry.ts` — `registerThresholdOperation` / `getThresholdOperation`.
- `src/systems/points-system/threshold-resolver.ts` — `resolveThreshold(row, inputs)` (does the
  drift-check of row metadata vs. the operation), `buildThresholdRow(...)`.
- `src/systems/points-system/operations/*.ts` — `read_pref`, `chart_lookup_3v3`,
  `fargo_start_points_for_side`, `arithmetic_round_product`.
- `src/systems/points-system/threshold-helpers.ts` — `resolveAllThresholds`.

**Chart data layer (exists, current branch — read path only):**
- `supabase/migrations/20260410000002_threshold_charts.sql` — `threshold_charts` +
  `threshold_chart_rows` (`comp_1, comp_2 → result_1, result_2, result_3`, `lookup_mode
  exact|range`) + `lookup_threshold(chart_id, comp_1, comp_2)` SQL fn.
- `supabase/migrations/20260410000003_seed_threshold_charts.sql` — 4 seeded global charts.
- `src/api/queries/thresholdLookup.ts` — read-path wrapper (`lookupTeamThresholds`,
  `SEEDED_CHART_NAMES`). **Write-path CRUD is absent.**
- `src/systems/threshold-charts/*` — 7 chart implementations + registry + cross-audit tests.

**Formula-as-data pattern to mirror (allocator):**
- `src/systems/points-system/allocator-formula-operations/evaluate-expression.ts` —
  `evaluate_expression` consumes an `Expression` tree from `operationArgs.expression`, resolves
  `this_side_*` / `other_side_*` virtuals, never-throws (warn + 0).
- `src/operator/scoring-workshop/per-game-allocator/formulaTokens.ts` — token ↔ `Expression`
  round-trip.
- `src/systems/points-system/per-game-allocator-loader.ts` — the never-throw load+validate
  loader template.

**Room blueprint (trigger room — the closest sibling):**
- DB backbone: `triggers(id, name, description, scope CHECK('official'|'user'), author_id,
  <jsonb cols>, created_at, updated_at)` + scope/author constraint + tamper trigger
  (`supabase/migrations/20260606000000_trigger_room.sql`).
- `src/systems/points-system/trigger-loader.ts` — `loadTrigger(id) → Trigger | null`.
- `src/operator/scoring-workshop/trigger/` — `TriggerRoomPage`, `TriggerList`, `TriggerEditor`,
  `ConditionBuilder`, `ActionBuilder`, `useTriggerRoom`, `saveTimeGuard`, `availableData`.
- `src/operator/scoring-workshop/_shared/ExpressionBuilder.tsx` — shared widget.
- `src/operator/scoring-workshop/WorkshopHomePage.tsx` — room registry (ROOMS array).
- Plans: `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`,
  `docs/plans/2026-06-06-001-feat-trigger-room-plan.md`.

**Salvage (dead branches — cherry-pick via `git show origin/<branch>:<path>`):**
- `origin/lo-manual-scoring`: `src/components/operator/threshold-editor/*` (the chart-table
  editor with generate-from-games + red/yellow warning cells + "use anyway" gate + SaveChartModal;
  the unified `comp/result` row model in `src/constants/thresholdCharts.ts`) and the chart
  **write** queries/hooks (`useThresholdCharts.ts`, `thresholdCharts.ts`).
- `origin/feat/threshold-math-modular`: design archaeology only — the **grain lesson** ("one
  module = one coherent computation that may emit several keys," not one-per-output-value). Do
  not copy its code.

### Institutional Learnings

- **Modules are DATA, not code** — the workshop writes/reads/executes DB rows; no new
  `.ts` "module" files. Output keys are generic; the LO assigns a display label on top.
- **Runtime trusts, Workshop validates** — the save-time guard is where bad combinations get
  caught; the resolver/runtime never branch on system identity.
- **Match ops are system-agnostic** — no `handicap_type` switches in the resolver path.
- **DB-touching tests live under `src/__tests__/database/`** (sequential, jsdom); add the
  `// @vitest-environment jsdom` pragma to any file calling supabase-js writes.
- **RLS is permissive in dev** — ship schema-only; the tamper trigger (not RLS) protects
  officials, matching the prior two rooms.

## Key Technical Decisions

These resolve the five Deferred-to-Planning questions from the origin doc:

- **(Q1) Storage = a new `thresholds` table for the row/wiring; charts reuse the existing
  `threshold_charts` tables.** The `thresholds` row carries the trigger-room backbone (id, name,
  description, scope, author_id, timestamps) plus the authored definition as JSONB mirroring
  `ThresholdRow` (operationKind + operationArgs + expectedSize/output metadata), plus `label`,
  and an `expansion_mode` (`single` / `home_away` / `per_pairing`). The **chart view** stores
  `operationKind: 'chart_lookup'` with `operationArgs: { chart_id, output_field }` → points at a
  `threshold_charts` row; the lookup key(s) come from the **perspective pair** supplied by the
  expansion (`comp_1 = this_side`, `comp_2 = other_side` for a 2D chart; the diff of the pair for
  a 1D chart), not a separate `comp_source`. The **formula view** stores
  `operationKind: 'evaluate_expression'` with
  `operationArgs: { expression: <Expression tree> }`. Rationale: thresholds-as-data is the whole
  point of the room, and the operation-registry indirection already exists; we only add two
  generalized operations + a table.
- **(Q5) Formulas ride a threshold-scoped `evaluate_expression` operation**, modeled on the
  allocator's. It consumes `ThresholdInputs` and evaluates the `Expression` tree against
  threshold-appropriate virtuals (`this_side_handicap`, `other_side_handicap`, `handicap_diff`,
  `this_side_rating_sum`, `game_count`, pref reads). Same token ↔ tree round-trip; same
  never-throw discipline. Rationale: maximal reuse of the proven allocator formula pipeline and
  the shared `ExpressionBuilder`.
- **(Q2) One unified chart editor**, not four. The `threshold_charts` storage is already unified
  (`comp_1/comp_2 → result_1/2/3` + `lookup_mode`); a single editor driven by `chart_type` +
  `exact|range` renders the right columns. Rationale: the four-page split on the dead branch was
  pre-unification; one editor is fewer files and consistent.
- **(Q3) The mirror generalizes to an `expansion_mode`: one stored row fans out over a set of
  side-bindings.** Mirroring is not a home/away special case — it's an "author once, resolve
  under each `(this_side, other_side)` binding, write one key per instance" machine. The
  expansion set is the only thing that varies:
  - `single` → one binding (no perspective) → one key. The side-less milestone.
  - `home_away` → bindings `{home, away}` → two keys. The classic mirror.
  - `per_pairing` → one binding per locked-lineup pairing → one key per game slot.

  The LO authors once from the neutral `this_side / other_side` perspective; the resolver runs
  once per binding. This **also dissolves the 2D race-chart seam**: `comp_1 = this_side` and
  `comp_2 = other_side` *are* the perspective pair, and pairings are fixed at match start (locked
  lineups), so a per-pairing race chart resolves at match start like any other threshold — no
  per-game runtime, no special `comp_source`. Rationale: one mechanism covers single,
  home/away, and per-pairing; the existing `this_side/other_side` virtuals already supply the
  two comps a 2D chart needs.
- **(Q4) `expectedSize` is declared on the row and enforced by the save-time guard.** The editor
  surfaces array-vs-scalar as part of the input-side choice; the guard checks the declared
  `expectedSize` is consistent with the chosen operation's `consumesSize` (reusing the resolver's
  existing drift-check) **and** runs a synthetic dry-run. The resolver's runtime drift-check is
  the backstop. Rationale: "Workshop validates, runtime trusts."

## Open Questions

### Resolved During Planning

- *Most of the data layer already exists* — confirmed `threshold_charts`/`threshold_chart_rows`,
  `lookup_threshold()`, the cascade columns, and 7 chart implementations are on the current
  branch. The plan builds the **authoring** layer, not the data layer.
- *Does the room change the runtime?* — No. Library-authoring only; deferred apply-to-league.
- *Do 2D / per-pairing race charts fit?* — Yes. Mirroring generalizes to an `expansion_mode`
  (single / home_away / per_pairing): the `this_side / other_side` perspective pair supplies the
  two comps a 2D chart needs, and locked-lineup pairings are known at match start, so a
  per-pairing chart resolves at match start like any other threshold. No separate `comp_source`
  design; `chart_lookup` serves 1D and 2D charts with no branching.

### Deferred to Implementation

- **Generic key generation** (e.g. `threshold_<shortid>`): a provisional key is fine for the
  save-time dry-run; the *final* assigned key is an assembly-room concern. Exact scheme deferred.
- **Whether `chart_lookup` reuses the `lookup_threshold()` RPC or the pure TS chart
  implementations** for resolution: both already take two comps; confirm the cleaner wiring once
  touching code. (Generalization itself is settled — see Resolved.)
- **The `per_pairing` pairing source at runtime**: `ThresholdInputs` doesn't carry pairings today.
  In-room the dry-run synthesizes them; the real feed is an assembly-room/runtime task, deferred.
- **Exact `availableData` virtual names** for the threshold formula view — finalize against
  `ThresholdInputs` fields when wiring the registry.
- **Whether the chart editor reads via the existing pure TS chart implementations or via the DB
  `lookup_threshold` RPC** for its live preview — decide when cherry-picking the editor.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not
> implementation specification. The implementing agent should treat it as context, not code to
> reproduce.*

A saved threshold row, two views compiling to one resolver:

```
thresholds row (data)
├─ id, label, description, scope, author_id, expansion_mode, expectedSize, output metadata
└─ definition (JSONB, mirrors ThresholdRow.operation*)
   ├─ FORMULA view  → operationKind: 'evaluate_expression'
   │                  operationArgs: { expression: <Expression tree over this_side/other_side> }
   └─ CHART view    → operationKind: 'chart_lookup'
                      operationArgs: { chart_id → threshold_charts, output_field }
                      (comp_1 = this_side, comp_2 = other_side — supplied by the expansion)

resolve(row, ThresholdInputs):
   bindings = expand(expansion_mode, inputs)   # single → [Ø]; home_away → [home, away]; per_pairing → [pairing…]
   for each binding b:
      inputsForB = bind this_side/other_side (→ comp_1/comp_2) from b onto inputs
      getThresholdOperation(operationKind).compute(operationArgs, inputsForB) → number | null
      write one bag key per binding   # existing compute(args, inputs) signature unchanged
```

Authoring flow in the editor (one guided builder):

```
Name + description ─▶ "Home & away?" toggle ─▶ Input side (preset shaping | invent)
                                              └▶ Lookup side ── Formula view (ExpressionBuilder)
                                                            └── Chart view (unified chart editor:
                                                                use / template / create-your-own)
   ─▶ Save  ─▶ save-time guard (expectedSize drift-check + synthetic dry-run) ─▶ thresholds row
```

## Implementation Units

### Phase A — Storage & runtime primitives

- [ ] **Unit 1: `thresholds` table + never-throw loader**

**Goal:** Persist authored threshold rows as data and load them back safely.

**Requirements:** R1, R4, R10, R11, R12

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/<next-version>_threshold_room.sql`
- Create: `src/systems/points-system/threshold-row-loader.ts`
- Test: `src/__tests__/database/thresholdRoom.roundtrip.db.test.ts`
- Test: `src/systems/points-system/__tests__/threshold-row-loader.test.ts`

**Approach:**
- Mirror the `triggers`/`per_game_allocators` backbone: `id, name (generic key), label,
  description, scope CHECK('official'|'user'), author_id, definition JSONB (operationKind +
  operationArgs + expectedHandicapType + expectedSize + outputType + outputSide + outputRange),
  `expansion_mode text CHECK('single'|'home_away'|'per_pairing')`, created_at, updated_at`;
  scope/author constraint; tamper trigger on `official` rows.
- Loader fetches, unmarshals the JSONB into a `ThresholdRow`-shaped object, validates shape,
  returns `ThresholdRow | null`, never throws (warn + null), exactly like
  `per-game-allocator-loader.ts`.

**Patterns to follow:** `supabase/migrations/20260606000000_trigger_room.sql`;
`src/systems/points-system/per-game-allocator-loader.ts`.

**Test scenarios:**
- Happy path: insert a user-scope threshold row, load it, get a well-formed `ThresholdRow`.
- Edge case: official row tamper trigger blocks UPDATE and DELETE.
- Edge case: scope/author constraint rejects `official`+author_id and `user`+null author_id.
- Error path: malformed/missing JSONB definition → loader returns `null` + warns, never throws.

**Verification:** A round-trip db test inserts and loads a row; loader unit test proves
never-throw on a corrupt row.

- [ ] **Unit 2: threshold-scoped `evaluate_expression` operation (formula view backend)**

**Goal:** Let a stored `Expression` tree resolve into a threshold number over `ThresholdInputs`.

**Requirements:** R2, R5, R7

**Dependencies:** None (registers alongside existing operations).

**Files:**
- Create: `src/systems/points-system/operations/evaluate-threshold-expression.ts`
- Modify: `src/systems/points-system/threshold-registry.ts` (register the operation)
- Test: `src/systems/points-system/operations/__tests__/evaluate-threshold-expression.test.ts`

**Approach:**
- Implement a `ThresholdOperation` named `evaluate_expression` whose `compute(args, inputs)`
  evaluates `args.expression` against a resolver that maps threshold virtuals
  (`this_side_handicap`, `other_side_handicap`, `handicap_diff`, `this_side_rating_sum`,
  `game_count`, pref reads) to `ThresholdInputs` fields, driven by the active binding's `side`.
- Never-throw: bad expression → warn + return `null` (so the resolver/bag records `null`).
- Reuse the evaluation core from
  `src/systems/points-system/allocator-formula-operations/evaluate-expression.ts` where shared;
  only the virtual-name → input mapping differs.

**Patterns to follow:** `allocator-formula-operations/evaluate-expression.ts`; the `Expression`
type in `types.ts`.

**Test scenarios:**
- Happy path: `this_side_handicap - other_side_handicap` over given inputs → correct number for
  side=home and the mirrored value for side=away.
- Edge case: a constant-only expression (side-less) resolves regardless of `side`.
- Error path: unknown var name or divide-by-zero → `null` + warn, no throw.

**Verification:** Unit test resolves representative formulas for both sides and proves
never-throw.

- [ ] **Unit 3: generalized `chart_lookup` operation + chart write-path CRUD (chart view backend)**

**Goal:** Let a threshold point at any `threshold_charts` row, and let the workshop create/copy/
replace charts.

**Requirements:** R2, R8, R9

**Dependencies:** None.

**Files:**
- Create: `src/systems/points-system/operations/chart-lookup.ts`
- Modify: `src/systems/points-system/threshold-registry.ts` (register)
- Create: `src/api/queries/thresholdCharts.ts` (cherry-pick from `origin/lo-manual-scoring`, adapt)
- Create: `src/api/hooks/useThresholdCharts.ts` (cherry-pick, adapt)
- Test: `src/systems/points-system/operations/__tests__/chart-lookup.test.ts`
- Test: `src/__tests__/database/thresholdChartsCrud.db.test.ts`

**Approach:**
- `chart_lookup` operation: `operationArgs { chart_id, output_field }`. It does **not** carry a
  `comp_source` or `side` — the comps come from the **perspective pair** the expansion already
  binds: `comp_1 = this_side`, `comp_2 = other_side`. A 1D team chart reads the diff of the pair;
  a 2D race chart reads both comps directly. The same operation therefore serves team charts and
  race charts with no branching — the only difference is the chart's own dimensionality and the
  threshold's `expansion_mode` (`home_away` vs `per_pairing`). Reuse the existing
  `lookup_threshold(chart_id, comp_1, comp_2)` SQL (it already takes two comps and normalizes the
  race upper-triangle swap), or the pure TS implementations — decide in-unit. Leave
  `chart_lookup_3v3` in place for the existing compositions.
- Cherry-pick the chart **write** layer (create chart, copy global → user, replace rows) from the
  dead branch; the **read** path (`thresholdLookup.ts`) already exists — wrap, don't duplicate.
- The `per_pairing` expansion needs the pairing set; in this room the save-time dry-run synthesizes
  it, and feeding *real* locked-lineup pairings is an assembly-room/runtime concern (deferred).

**Patterns to follow:** existing `operations/chart-lookup-3v3.ts`;
`src/api/queries/thresholdLookup.ts`; the `lookup_threshold` SQL fn in
`supabase/migrations/20260410000002_threshold_charts.sql`.

**Test scenarios:**
- Happy path: `chart_lookup` against a seeded **1D** team chart returns the expected
  `output_field` for a given diff, for both `home_away` bindings.
- Happy path: `chart_lookup` against a seeded **2D** race chart returns the expected value for a
  `this_side`/`other_side` handicap pair, and gives the same value when the pair is swapped
  (upper-triangle normalization).
- Edge case: range-mode chart returns the correct band; out-of-domain input → `null` + warn.
- Integration (db): create a user chart, copy a global chart, replace its rows, read them back.

**Verification:** Operation test passes against both a 1D and a 2D seeded chart; db CRUD test
round-trips a user-owned chart.

### Phase B — Workshop UI

- [ ] **Unit 4: Room shell — page, list, data hook, route, home-page card**

**Goal:** Stand up the room skeleton consistent with the other two rooms.

**Requirements:** R10, R11, R13

**Dependencies:** Unit 1.

**Files:**
- Create: `src/operator/scoring-workshop/threshold/ThresholdRoomPage.tsx`
- Create: `src/operator/scoring-workshop/threshold/ThresholdList.tsx`
- Create: `src/operator/scoring-workshop/threshold/useThresholdRoom.ts`
- Modify: `src/operator/scoring-workshop/WorkshopHomePage.tsx` (add the threshold room card)
- Modify: the workshop route registrations (mirror where the trigger room route is registered)
- Test: `src/operator/scoring-workshop/threshold/__tests__/ThresholdList.test.tsx`

**Approach:**
- List view with **Templates** (officials, read-only, "Make a copy I can edit") + **Yours**
  (user rows), mirroring `TriggerList`. Data hook does list / clone / upsert / delete against the
  `thresholds` table. Add the home-page card with the same `status` field the prior rooms use
  (follow their gating; flag in `LIST_FOR_ED.md` if gated).

**Patterns to follow:** `src/operator/scoring-workshop/trigger/TriggerRoomPage.tsx`,
`TriggerList.tsx`, `useTriggerRoom.ts`; `WorkshopHomePage.tsx` ROOMS array.

**Test scenarios:**
- Happy path: list renders Templates + Yours from hook data; "Make a copy" clones an official to
  a user row.
- Edge case: empty "Yours" state renders the build-from-scratch affordance.

**Verification:** Room reachable from the workshop home; list renders both sections.

- [ ] **Unit 5: Threshold editor — identity, expansion mode, input side, formula view**

**Goal:** The guided builder up through the formula view.

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** Units 2, 4.

**Files:**
- Create: `src/operator/scoring-workshop/threshold/ThresholdEditor.tsx`
- Create: `src/operator/scoring-workshop/threshold/InputSidePicker.tsx`
- Create: `src/operator/scoring-workshop/threshold/availableData.ts`
- Test: `src/operator/scoring-workshop/threshold/__tests__/ThresholdEditor.test.tsx`

**Approach:**
- Editor sections in order: name + description (label is display-only); **expansion mode**
  selector (R6) — `single` (side-less value) / `home & away` (the mirror) / `per pairing`
  (one value per locked-lineup matchup); **input side** — preset shaping menu (difference /
  single side / sum / pref) + an "invent your own" path; **lookup side** fork with the **formula
  view** using the shared `ExpressionBuilder` fed by the threshold `availableData` registry (the
  `this_side_*` virtuals Unit 2 resolves). Expose array-vs-scalar (`expectedSize`) as part of the
  input-side choice (R3).
- The expansion-mode selector replaces a bare home/away toggle: `single` authors from no
  perspective; `home & away` and `per pairing` both author once from the neutral
  `this_side / other_side` perspective and fan out at resolve time. (Surface `per pairing` only
  when the chosen chart/formula is per-pairing-shaped; otherwise offer `single` + `home & away`.)

**Patterns to follow:** `src/operator/scoring-workshop/trigger/TriggerEditor.tsx` and its
`ActionBuilder` use of `ExpressionBuilder`; `per-game-allocator/availableData.ts` for the
perspective-aware data registry; **all UI uses shadcn components** per project rules.

**Test scenarios:**
- Happy path: build a formula threshold from scratch with `home & away` expansion; editor state
  holds a valid `Expression` + `expansion_mode='home_away'` + chosen `expectedSize`.
- Edge case: `single` expansion hides the perspective framing and produces a side-less definition.
- Edge case: `per pairing` is offered only for a per-pairing-shaped lookup; otherwise hidden.
- Edge case: switching input-shaping preset updates the formula's available vars accordingly.

**Verification:** Editor produces a well-formed in-memory threshold definition for the formula
view across all applicable expansion modes.

- [ ] **Unit 6: Chart view — unified chart-table editor + use/template/create**

**Goal:** The chart authoring half of the lookup-side fork.

**Requirements:** R2, R8, R9

**Dependencies:** Units 3, 5.

**Files:**
- Create: `src/operator/scoring-workshop/threshold/ChartView.tsx`
- Create: `src/operator/scoring-workshop/threshold/ThresholdChartEditor.tsx` (cherry-pick + collapse 4→1)
- Create: `src/operator/scoring-workshop/threshold/chartTypes.ts` (from dead branch `constants/thresholdCharts.ts`)
- Test: `src/operator/scoring-workshop/threshold/__tests__/ThresholdChartEditor.test.tsx`

**Approach:**
- One editor driven by `chart_type` + `lookup_mode (exact|range)`, rendering the right columns
  over the unified `comp_1/comp_2 → result_1/2/3` row model. Cherry-pick the dead branch's
  table-of-inputs UX, **generate-from-games**, red/yellow warning cells, and the "I understand,
  use anyway" gate; collapse the four type-specific editors into this one.
- **Use / use-as-template / create-your-own**: pick a preset chart (read-only), copy it to a
  user chart (Unit 3 CRUD), or start blank. Generate-from-formula is the bridge (R9); hand-editing
  a cell off-formula marks the chart authoritative.

**Patterns to follow:** `origin/lo-manual-scoring:src/components/operator/threshold-editor/PointsThresholdChartEditor.tsx`
(UX, warnings, generate) and `SaveChartModal.tsx` (name/description on save).

**Test scenarios:**
- Happy path: clone a global chart, edit a cell, save → a user chart row with the edit.
- Edge case: generate-from-games rescales the whole table and preserves the symmetry invariant.
- Edge case: a critical cell (e.g. win == total games) shows the red warning and gates save until
  acknowledged.
- Edge case: exact vs range `lookup_mode` renders the correct column set.

**Verification:** LO can produce a saved user chart a threshold can reference; warnings + gate fire
on extreme edits.

- [ ] **Unit 7: Save-time guard — expectedSize drift-check + synthetic dry-run**

**Goal:** Refuse to persist a threshold that won't resolve.

**Requirements:** R3, R12

**Dependencies:** Units 2, 3, 5, 6.

**Files:**
- Create: `src/operator/scoring-workshop/threshold/saveTimeGuard.ts`
- Modify: `src/operator/scoring-workshop/threshold/useThresholdRoom.ts` (call the guard before upsert)
- Test: `src/operator/scoring-workshop/threshold/__tests__/saveTimeGuard.test.ts`

**Approach:**
- Validate the authored definition's declared `expectedSize`/output metadata is consistent with
  the chosen operation's declared `consumes*` (reuse the resolver's drift-check), then run a
  **synthetic dry-run**: build fake `ThresholdInputs` (synthesizing a pairing set for
  `per_pairing`) and call `resolveThreshold` once per binding in the `expansion_mode`, confirming
  every instance returns a finite number (or an intentional `null`). Return `{ok}` or
  `{ok:false, reason}` inline; refuse to persist on failure — mirrors the allocator/trigger guards.

**Patterns to follow:** `src/operator/scoring-workshop/trigger/saveTimeGuard.ts`;
`src/operator/scoring-workshop/per-game-allocator/saveTimeGuard.ts`.

**Test scenarios:**
- Happy path: a valid formula threshold and a valid chart threshold both pass and persist.
- Error path: a formula referencing an array input while `expectedSize` says `single` → guard
  fails with a clear reason; nothing persists.
- Edge case: a `home_away` threshold dry-runs both bindings; failure on the away side blocks save.
- Edge case: a `per_pairing` threshold dry-runs every synthesized pairing; one failing pairing blocks save.

**Verification:** Guard blocks the mismatched cases and admits the valid ones; upsert is gated on
it.

- [ ] **Unit 8: Seed officials + TOC/docs**

**Goal:** Teaching templates + housekeeping.

**Requirements:** R10, R11

**Dependencies:** Units 1, 6.

**Files:**
- Modify: the Unit 1 migration (append seeded `official` rows) or a sibling seed migration
- Modify: `TABLE_OF_CONTENTS.md`
- Modify: `LIST_FOR_ED.md` (only if the room ships gated — per the feature-gating workflow)
- Test: `src/__tests__/database/thresholdRoomSeed.db.test.ts`

**Approach:**
- Seed 3–4 read-only officials, each teaching one pattern: a **BCA finish-line** (chart view,
  mirrored), a **Fargo head-start** (formula view over rating arrays, mirrored), a **side-less
  milestone** (formula, `expansion_mode='single'`, e.g. `round(game_count * 0.75)`), and an
  **empty starter**
  for cloning. Exact values finalized in-unit.
- TOC entry for every new file; if gated, add the `LIST_FOR_ED.md` gated-section entry and tell
  Ed in chat.

**Patterns to follow:** the seed block in `20260606000000_trigger_room.sql`.

**Test scenarios:**
- Happy path (db): each seeded official loads via the Unit 1 loader and dry-run-resolves to a
  number.
- Edge case: the side-less milestone resolves once; the mirrored officials resolve to two values.

**Verification:** All officials load + resolve; TOC updated in the same commit.

## System-Wide Impact

- **Interaction graph:** Self-contained. New operations register into the existing threshold
  registry; no composition, `runtime.ts`, or live-scoring path changes (apply-to-league is
  deferred). The only shared-file edits are additive: `threshold-registry.ts` (register two
  operations), `WorkshopHomePage.tsx` (one card), the route registry.
- **Error propagation:** Every new boundary is never-throw — loader returns `null`+warn,
  operations return `null`+warn, the save-time guard returns a typed reason. Matches the prior
  rooms' discipline.
- **State lifecycle risks:** None at runtime in this room — nothing is wired into a live match
  yet. Charts are copy-on-write (clone before edit), so editing never mutates a shared/global row.
- **API surface parity:** The generalized `chart_lookup` sits beside `chart_lookup_3v3` (kept for
  existing compositions); no existing operation changes signature.
- **Unchanged invariants:** Existing compositions, the resolver, the live scoring path, and the
  `threshold_charts` read path are untouched. The new `thresholds` table and operations are purely
  additive.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Cherry-picked chart editor is large (~900 lines on the dead branch) and pre-unification | Collapse to one editor in Unit 6; pull UX patterns, not the four-file structure; keep it under the project's file-size guidance by splitting sub-components |
| `chart_lookup` generalization could subtly diverge from `chart_lookup_3v3` math | Keep `chart_lookup_3v3` untouched for existing compositions; cover the new op with tests against the same seeded charts; cross-check the `lookup_threshold` SQL |
| Stacked on `feat/trigger-room` (unmerged) | This is the established stacked-PR cadence; branch per the workflow and keep stacking; don't block on merge order |
| Expansion semantics (one row → N keys) could confuse the eventual assembly room | Document `expansion_mode` (single / home_away / per_pairing) in the row's definition; final key assignment is explicitly deferred to the assembly room |
| `per_pairing` expansion needs a pairing set that `ThresholdInputs` doesn't carry today | In-room is unaffected — the save-time dry-run synthesizes pairings; feeding real locked-lineup pairings is an assembly-room/runtime task, called out as deferred (Unit 3 approach + Deferred to Implementation) |

## Documentation / Operational Notes

- New files → `TABLE_OF_CONTENTS.md` updated in the same commit (Unit 8).
- If the room ships gated, add it to `LIST_FOR_ED.md`'s gated section and tell Ed to review on
  staging (per the feature-gating workflow).
- Glossary / InfoButton coverage for threshold terms is deferred to the operator-help docs phases.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-06-07-threshold-workshop-requirements.md`
- Blueprint plans: `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`,
  `docs/plans/2026-06-06-001-feat-trigger-room-plan.md`
- Locked specs: `docs/league-system/modules/threshold-charts/README.md`,
  `docs/league-system/modules/points-system/trigger.md`
- Primitive: `src/systems/points-system/{types.ts,threshold-registry.ts,threshold-resolver.ts,threshold-helpers.ts,operations/}`
- Formula pattern: `src/systems/points-system/allocator-formula-operations/evaluate-expression.ts`,
  `src/operator/scoring-workshop/per-game-allocator/formulaTokens.ts`
- Salvage branches: `origin/lo-manual-scoring` (chart editor + chart write CRUD),
  `origin/feat/threshold-math-modular` (grain lesson only)
