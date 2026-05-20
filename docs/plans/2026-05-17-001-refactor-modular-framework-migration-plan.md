---
title: Modular Scoring System — Transform Bundled Code into the Locked-Page Framework
type: refactor
status: active
date: 2026-05-17
origin: docs/brainstorms/2026-05-17-modular-scoring-system-comparison-requirements.md
---

# Modular Scoring System — Transform Bundled Code into the Locked-Page Framework

## What this plan IS

This plan describes **HOW to fundamentally change the existing bundled scoring code into the modular framework the locked pages define.** Not a polish of existing code. Not an alignment-to-tighten-edges. A real structural transformation, done incrementally so the app keeps working between each step.

## The gap

**The locked pages** in `docs/league-system/` define a framework where:
- 9 component Modules (Handicap Systems, Handicap Mechanisms, Points System, Win Calculator, Threshold Charts, Team Geometry, Match Format, Pairings Generator, Tiebreak System) are independent composable primitives with crisp borders
- A Scoring System is a top-level COMPOSITION of those 8 primitives
- The 3 prepackaged systems (Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man) are tested compositions of those primitives, not bundled bespoke implementations
- Per the locked Threshold Charts README: *"Step-2 refactors will lift Charts out as first-class Modules selected by the league configuration"*
- Per the locked Handicap Systems README: *"The current codebase has historical bundlings... these are implementation artifacts from before the modular axes were fully separated — NOT statements of intended architecture. Future refactors will progressively decouple them"*

**The existing code** has 3 bundled `SystemModule` files in `src/systems/`:
- `bca3v3.ts` (~78 lines) implements `rating` + `scoring` + `threshold` + `teamFormat` all inside one bundled SystemModule instance
- `bca5v5.ts` (~61 lines) — same shape, different content
- `fargo5v5.ts` (~292 lines) — same shape, more code because Fargo's threshold math is more involved

Plus runtime scaffolding from v2 (`buildSystemFromPreferences`, calculator registry, snapshot persistence) that dispatches these bundled modules but doesn't itself decompose them. **None of the 8 component Modules exist as first-class composable code primitives today.** They exist as preference columns, capability sections inside SystemModule, or scattered runtime code.

**This plan transforms the second into the first.**

## Strategy: strangler-fig migration

The transformation cannot be a top-to-bottom rewrite because the app must keep scoring matches correctly throughout. The strategy is **strangler-fig**: a pattern where the new framework grows up alongside the existing code, with an adapter layer keeping the rest of the app working while each Module gets extracted, until eventually the old bundled code is dissolved.

### How the strangler-fig works in practice

1. **Keep `SystemModule` as a thin adapter** for the duration of the migration. The rest of the app (`computeMatchRunningTotals`, scoreboards, scoring mutations) continues calling `module.threshold.compute(...)`, `module.rating.validate(...)`, etc. as it does today.
2. **Extract one component Module at a time.** Each component Module gets its own primitive type, files, contract. The SystemModule's capability section for that Module becomes a DELEGATION to the new primitive instead of a direct implementation.
3. **App keeps working between extractions.** Each extraction ships independently. Characterization tests (`src/systems/__tests__/{bca3v3,bca5v5,fargo5v5}.characterization.test.ts`) guard external behavior. If the test still passes byte-identically, the extraction is safe.
4. **When all 9 component Modules are extracted, dissolve `SystemModule`.** The 3 prepackaged Scoring Systems become tiny composition declarations (~15 lines each) instead of bundled files (~78-292 lines). The adapter layer is removed; the runtime consumes the composed Modules directly.

### Extraction order (least entangled → most)

Listed in the order that makes the strangler-fig clean. Earlier extractions create patterns that later ones follow.

| # | Component Module | Why this order |
|---|---|---|
| 1 | **Win Calculator** | Smallest existing surface (binary `win_condition` preference today). Lowest blast radius — good shakedown for the strangler-fig pattern itself. Extracts as a metric-precedence-stack Module per the locked doc; initial implementation populates the stack with one entry (matching today's `win_condition`). Future expansion (multi-metric stacks, `edge` from Tiebreak System) is enabled but not implemented in this Unit. |
| 2 | **Threshold Charts** | Already partly separated (DB tables + SQL lookup function exist). Hardcoded TS charts in `src/systems/charts/` need lifting into Module shape. |
| 3 | **Handicap Systems** | Rating capability inside SystemModule is self-contained. 4 variants (Points, Percentage, FargoRate, Skill-Level-reserved). |
| 4 | **Handicap Mechanisms** | Already discriminated by mechanism in `SystemModule.threshold` discriminated union. Promote to a real Module type. |
| 5 | **Points System sub-mechanisms** | Calculators are already extracted into a registry (`src/systems/calculators/`). This unit DEcomposes the bundled calculators into their underlying sub-mechanism types (A/B/C/D per the locked Points System README). |
| 6 | **Team Geometry** | Currently mixed into `SystemModule.teamFormat`. Three axes (lineup_size, max_roster_size, game_generation). |
| 7 | **Match Format** | Currently scattered preference fields (pairing_format, race_length). |
| 8 | **Pairings Generator** | Currently runtime-only (no preference columns); hardcoded in `src/utils/gameOrder.ts` (3v3 DRR) and inline elsewhere. Extract as a chain-pattern System with three sub-Mechanisms (pair generation, game ordering, break/rack assignment) per the locked PG blueprint. |
| 9 | **Tiebreak System** | Currently scattered runtime hooks (`MatchEndVerification`, `computeMatchResult` in bca3v3.ts, `ManualTiebreakerDialog`). Extract as a conditional-fallthrough chain Module with 4 Mechanism variants per the locked Tiebreak System blueprint. **Wires the Win Calc metric stack's `edge` entry to fire this Module** — closes the integration the locked Win Calc doc describes. (Note: the season-standings sort, formerly bundled in the old "Standings & Tiebreakers" Module, moves OUT of the modular Scoring System catalog entirely and is captured as a separate future Standings concern — not part of this migration plan.) |
| 10 | **Dissolve `SystemModule`** | After 1-9 extract their primitives, `SystemModule` is just an adapter with no behavior of its own. Dissolve it. The 3 prepackaged systems become composition declarations. |
| 11 | **Decision Record** | What got built, what got deferred, reconsideration triggers. |

## How this plan is written

**Unit 1 (Win Calculator) is defined in detail below.** It's the first extraction; doing it teaches us the pattern for the rest.

**Units 2-10 are sketched only.** Each one is a real unit, but the detailed file list and approach gets filled in WHEN we approach that unit, not all up front. The reason: each extraction will surface things about the code we don't know yet, and pre-specifying all 10 in detail invites the over-planning we just spent a session backing out of. The plan is a roadmap whose detailed segments get drawn as we walk them.

**Unit 11 (Decision Record) is a small documentation unit; defined at a sketch level.**

## Honest sizing

This is multi-week work, possibly multi-month depending on how each extraction surprises us. Each individual unit is probably 2-5 days of focused work; 10 units is many weeks. The strangler-fig approach means you can pause between any two units without leaving the app broken — you're never committed to "finish all 10 before something works."

## Requirements Trace

From the viability brainstorm's R1-R19. Most map to specific extraction units below.

| R-item | Where it lives in this plan |
|---|---|
| R1 — (T+T) framing collapses (A/B/C/D) | Unit 5 (Points System sub-mechanism extraction realizes (T+T) shape) |
| R2 — Threshold WHEN, Trigger WHAT | Unit 5 (same) |
| R3 — Bilateral performer with declared inputs | Already shipped as `ScoringPopupSideSpec` |
| R4 — One threshold per Module instance | Unit 2 (Threshold Charts) + Unit 4 (Mechanisms compose multiple chart instances) |
| R5 — Pairings Generator split from Team Geometry | Decision Record: defer to its own focused work after this plan; pairings are sufficiently isolated in `src/utils/gameOrder.ts` today |
| R6 — Break/Rack bundled as compound output | Stays bundled; not addressed in this plan |
| R7 — Win Calc 4-slot hypothesis | Unit 1 establishes the Module shape; the 4-slot expansion is future work |
| R8 — Win Calc / Points orthogonal | Unit 1 (Win Calc) + Unit 5 (Points) establish the independence in code |
| R9 — Typed thresholds (discriminated by mechanism) | Unit 4 (Mechanisms own the discrimination) |
| R10 — Converters with multiple variants per pair | Deferred — Converter Module gets its own focused plan when cross-handicap composition is actually needed |
| R11 — Frozen-snapshot principle | Already shipped at the schema level; verified incidentally as extraction tests use snapshots |
| R12-R15 — Methodology observations | Not implementable |
| R16-R19 — Architecture-level / display | Inherited as constraints, not separate units |

## Scope Boundaries

- **No new features.** This is structural transformation only. The 3 prepackaged systems produce byte-identical match results before and after — guarded by characterization tests.
- **No new UI.** The dial UI, wizard improvements, and LO-facing customization surfaces are downstream of this work, not part of it. Ed has stated his next brainstorm after this is the dial design.
- **No Converter Module.** R10 is a separate Module kind that gets its own focused plan when needed.
- **No locked-doc edits.** Per Principle 7 + `[[feedback_stop_asking_to_break_protocols]]`. Locked pages describe the target; this plan transforms code to match.
- **No 4th Scoring System.** BCAPL Skill Level (`'skill_level'` handicap type) stays reserved/hidden.

### Deferred to Separate Tasks

- **Dial brainstorm + dial implementation** — Ed's stated next focus after this plan.
- **Converter Module work** — its own focused plan.
- **Pairings Generator split (R5)** — if/when LO custom pairing rules create demand.
- **Threshold chart editor UI (v2 Phase 3.4)** — its own UI-focused branch when needed.
- **BCAPL Skill Level (4th system) wiring + chart** — when Ed has BCAPL contact.
- **Brand rename `bca3v3`/`bca5v5`/`fargo5v5` → CSI-aligned keys** — internal mechanical refactor, can run as its own small branch or fold into Unit 9.

## Context & Research

### Locked pages (the target framework)

- `docs/league-system/PRINCIPLES.md` — meta-policy: 4 Module kinds (Mechanism, System, Chart, Converter) + 10 load-bearing principles + Principle 7 lock procedure
- `docs/league-system/README.md` — vocabulary cheat sheet + 8-Module list + 3 prepackaged Scoring Systems index + classification walkthrough
- `docs/league-system/modules/handicap-systems/README.md` — locked. 4 variants (Points/Percentage/FargoRate/Skill-Level-reserved). Internal-vs-external split.
- `docs/league-system/modules/handicap-mechanisms/README.md` — locked. 2x2 fundamental taxonomy. 3 shipped variants + 'none'.
- `docs/league-system/modules/points-system/README.md` — locked. (A) per-game allocator / (B) trigger / (C) initial points; end-of-match scoring = `match_end` triggers.
- `docs/league-system/modules/points-system/trigger.md` — locked. The authoritative Trigger model (v2): TYPE/CONDITION/ACTION/RE-ARM/ORDER, decoupled from thresholds; full arithmetic on actions.
- `docs/league-system/concept-analogies.md` — locked. Maps each primitive to a programming primitive (Trigger=if/then, per-game allocator=reducer…); flaw-detector lens.
- `docs/league-system/modules/win-calculator.md` — locked. Currently binary; future 4-piece architecture mapped.
- `docs/league-system/modules/threshold-charts/README.md` — describes Charts as a System-kind Module offering Chart-kind variants. Encoding-locked input contract.
- *Pending (not locked):* `modules/team-geometry.md`, `modules/match-format.md`, `modules/standings-tiebreakers.md` — would benefit from being written as the corresponding extraction units approach.

### Existing bundled code (the source)

- `src/systems/types.ts` (~316 lines) — `SystemModule` interface bundling 4 capability groups (teamFormat, rating, scoring, threshold)
- `src/systems/bca3v3.ts` (~78 lines) — bundled Points 3-Man system
- `src/systems/bca5v5.ts` (~61 lines) — bundled Percentage 5-Man system
- `src/systems/fargo5v5.ts` (~292 lines) — bundled FargoRate 10-7 5-Man system
- `src/systems/buildSystemFromPreferences.ts` (~433 lines) — runtime resolver (fast-path + ad-hoc path)
- `src/systems/calculators/` — calculator registry (3 calculators currently, each bundling multiple sub-mechanisms)
- `src/systems/charts/` — hardcoded TS chart files (3v3 games-needed, 5v5 games-needed, etc.)
- `src/systems/__tests__/{bca3v3,bca5v5,fargo5v5}.characterization.test.ts` — **the audit reference per `[[feedback_two_paths_audit_pattern]]`**. These tests are the guarantee that each extraction preserves external behavior.
- `supabase/migrations/20260418000003_add_matches_system_snapshot.sql` — R11 frozen-snapshot column

### Memory entries carried as constraints

- `[[feedback_stop_asking_to_break_protocols]]` — no locked-doc edits in this plan
- `[[feedback_respect_module_boundaries_in_plans]]` — each extraction is one Module; resist bundling
- `[[feedback_default_to_simpler]]` — smallest version of each extraction first
- `[[feedback_plan_from_target_not_existing]]` — locked pages are the target; existing code is the source
- `[[feedback_internal_naming_vs_ui_naming]]` — extractions don't change UI text
- `[[feedback_dev_data_disposable]]` — no backfill plumbing
- `[[feedback_consolidate_migrations_in_pr]]` — clean migrations only
- `[[feedback_two_paths_audit_pattern]]` — preserve characterization tests as audit reference throughout
- `[[project_scoring_accountability]]` — vacate-and-rescore is the only fix path
- `[[project_modular_scoring_works_not_perfect]]` — v1 quality bar

## Implementation Units

> **Status note (2026-05-18):** The Win Calc Unit (detailed below) was attempted but **Phase C was halted** when the consumer-swap surfaced that the locked Win Calc blueprint is incomplete (two mutually-exclusive modes — chip-mode vs cascade-mode — that the blueprint conflates). Architectural direction captured in `docs/brainstorms/2026-05-18-win-calculator-trigger-and-cascade-direction-requirements.md`. Phase A + B infrastructure stays committed as cascade-mode-only scaffolding (commits `7915bcf`, `ff01b68`); full Win Calc extraction is deferred until after the locked blueprint is unlocked + expanded AND after Threshold Charts/Trigger work is in place.
>
> **Team Geometry was extracted as the de facto Unit 1** (a genuinely simple shakedown, per the Win Calc brainstorm's re-ordering recommendation). Full Phases A-D complete (commits `43800ed`, `64fb16d`, `260e9fc`, `c63cef5`). The strangler-fig pattern is proven; ready to repeat. Net code change: +team-geometry Module (3 files, 21 tests), -getMatchTotalGames utility, -teamFormat field + TeamFormatConstants interface. 331 tests pass; zero behavior change.
>
> **In progress:** Match Format extraction — same shape as Team Geometry (passive configuration bundle, low coupling). Phases A-D will follow the same pattern.
>
> **Points System (Unit 5) was decomposed ahead of order (2026-05-20).** `src/systems/points-system/` already exists (data-driven thresholds, per-game allocator, triggers, registries; ~861 tests), built from the points-system decomposition brainstorm. But it predates the finalized trigger-model canon (trigger v2 decoupled from thresholds; EOGA deprecated → `match_end` triggers; full arithmetic on actions; per-game allocator confirmed a distinct primitive). **So Unit 5 is now a *reconciliation* of that existing code to the finalized canon, not a fresh extraction** — and it is **not yet wired into live scoring** (the legacy `src/systems/calculators/` still drives the scoring UI path). See the code-vs-canon audit + the rewritten Unit 5 below.
>
> **Migration plan ordering is being refined as units are reached** rather than re-numbered up front. The detailed Win Calc unit below remains as historical reference; do not act on it without re-reading the Win Calc brainstorm first.

- [ ] **Unit 1 (deferred): Extract Win Calculator as a metric-precedence-stack Module**

**Goal:** Lift the current `win_condition` (binary preference: `'games' | 'points'`) out of being a runtime-resolver branch and into being a first-class Win Calculator Module with its own typed contract — shaped as a **metric precedence stack** per the locked Win Calc doc. The 3 prepackaged Scoring Systems compose this Module instead of dispatching on `win_condition` directly. Establishes the strangler-fig pattern that the next 8 extractions follow.

**Scope discipline:** the locked Win Calculator doc describes a configurable multi-entry metric stack with an optional `edge` entry that fires the Tiebreak System. **Unit 1 implements the metric-stack interface but populates it with exactly ONE entry per league** — the one that corresponds to today's `win_condition` value (`'games'` → one-entry stack `[games_won]`; `'points'` → one-entry stack `[points_earned]`). Multi-entry stacks, the `edge` entry, and the Tiebreak System trigger integration are all enabled by the interface but NOT implemented in this Unit. They land in Unit 9 (Tiebreak System extraction) and beyond. This keeps the strangler-fig pattern clean: extract the Module shape first, validate parity with existing behavior, expand the implementation in later units.

**Requirements:** R8 (Win Calc / Points orthogonal — orthogonality made real in code).

**Dependencies:** None — this is the shakedown extraction.

**Locked-page definition (from `modules/win-calculator.md`):** *"The Win Calculator examines the collected match data — the two metrics every match tracks (Games and Points) plus any benchmarks the Handicap Mechanisms declared — and declares the match winner. It does so by walking a configurable metric precedence stack — an ordered list of metrics — and choosing the first metric on which the two teams differ. Configured stacks may include `edge` as a stack entry; when the walker reaches `edge` (i.e., all higher-precedence metrics tied), the Win Calculator fires the Tiebreak System to produce edge's value, then uses that value as the deciding metric. The Win Calculator does not produce metrics and does not allocate points. It decides."*

**Where it lives in current code:**
- `src/types/preferences.ts` + `src/types/resolvedSystemConfig.ts` — `win_condition` column type (`'games' | 'points'`)
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK for `win_condition`
- `src/systems/buildSystemFromPreferences.ts` — dispatch branches on `win_condition` inline (no Module abstraction)
- `src/wizards/league-v2/steps/WinConditionStep.tsx` — wizard UI for selecting (already exists)
- `src/utils/match/computeMatchRunningTotals.ts` — reads `system_snapshot.win_condition` and branches
- Match-end logic: bundled across `MatchEndVerification`, `computeMatchResult` in scoring.ts files, etc.

**Structural gap:**
- No `WinCalculator` Module type exists. The behavior is a switch on `win_condition` scattered across resolver + runtime.
- No `decideMatchWinner(matchData) -> WinnerDecision` function with a clear contract. Each call site implements its own branching.
- The 3 prepackaged SystemModules don't declare "I use this Win Calculator"; they're invoked via the runtime switch.
- No metric-stack data structure. The architectural intent (configurable ordered list of metrics) has no code shape yet.

**Extraction approach:**
1. **Create primitive type:** new file `src/systems/win-calculators/types.ts` defining the `WinCalculator` Module interface:
   - `metricStack: MetricStackEntry[]` — ordered list of metric entries
   - `MetricStackEntry` is a discriminated union: `'games_won' | 'points_earned' | 'edge'` (the third is enabled but unused in Unit 1)
   - `decide(matchData) -> WinnerDecision` — walks the metric stack and returns a typed winner (or a "tied — no edge entry in stack" sentinel)
2. **Implement the walker:** `src/systems/win-calculators/walker.ts` — a single function that takes a metric stack + match data and returns the decision. For each metric in the stack: compare the two teams' values; if they differ, return that team as winner; if equal, continue. If the stack walks past all entries without producing a winner: return the tied sentinel. (The `edge` case will be wired in Unit 9 when the Tiebreak System extraction lands; for Unit 1, encountering `edge` in the stack is a "not yet implemented" state — but since Unit 1 populates stacks with one entry only, `edge` never appears.)
3. **Create one Module instance per current preference value:** instead of two "variant" files, this is ONE Module with a metric stack populated based on the `win_condition` preference. A factory: `getWinCalculator(win_condition: 'games' | 'points'): WinCalculator` returns a Module with `metricStack: [{ kind: 'games_won' }]` for `'games'` and `metricStack: [{ kind: 'points_earned' }]` for `'points'`. Both share the walker; only the stack content differs.
4. **Create registry:** `src/systems/win-calculators/index.ts` — exports `getWinCalculator` factory. Pattern matches `src/systems/calculators/index.ts` (the existing points calculator registry).
5. **Adapter wiring:** add `winCalculator: WinCalculator` field to the `SystemModule` interface. The 3 bundled SystemModules (`bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`) declare which Win Calculator they use (`getWinCalculator('games')` for the BCA two — they ship with `win_condition='games'`; `getWinCalculator('points')` for fargo5v5 — it ships with `win_condition='points'`).
6. **Runtime consumers:** update `computeMatchRunningTotals.ts` and any other match-end logic to consult `system_snapshot.winCalculator.decide(matchData)` instead of branching on `win_condition` inline. The old branching collapses into the metric-stack walker.
7. **Preserve `win_condition` preference column.** It stays as the LO's selection input; the resolver looks it up to populate `system_snapshot.winCalculator` with the appropriate one-entry metric stack. No DB migration needed in this Unit.

**Why this shape (not two variant Modules):** the locked Win Calc doc describes Win Calculator as a single Module with a configurable stack — not as N variants. Unit 1 must establish that shape correctly even though the initial stacks are degenerate (one entry). Building it as "two variant Modules" now would lock in a wrong architecture that Unit 9 would have to undo.

**Patterns to follow:**
- `src/systems/calculators/index.ts` + `src/systems/calculators/types.ts` — same registry-of-typed-Module pattern (single Module with factory, not N variants).
- Self-registration at module load (the fix from the 2026-05-02 "no points written" bug).
- Discriminated unions for the metric stack entries — match the existing pattern from `SystemModule.threshold` discriminated union.

**Test scenarios:**
- *Regression × 3:* `src/systems/__tests__/bca3v3.characterization.test.ts` (320 lines), `src/systems/__tests__/bca5v5.characterization.test.ts` (334 lines), `src/systems/__tests__/fargo5v5.test.ts` (420 lines — Fargo's actual implementation, not stubs) all pass byte-identical after extraction. This is the gate.
- *Regression × 1 (win-determination):* `src/utils/__tests__/determineMatchResult.characterization.test.ts` — the existing characterization test for the win-determination function (which the new Win Calc walker effectively wraps). Locks the function-level behavior.
- *Happy path × 2:* `getWinCalculator('games').decide({...})` returns the same winner as today's `win_condition='games'` branch. Same for `'points'`.
- *Walker correctness:* the metric stack walker correctly handles the one-entry case (the only case Unit 1 exercises). Tests with `metricStack: [{ kind: 'games_won' }]` and `metricStack: [{ kind: 'points_earned' }]` produce expected results.
- *Tied case sentinel:* with a one-entry `games_won` stack and tied games_won values, the walker returns the tied sentinel (not a winner). Today's runtime handles this case via scattered tie-band logic; the Module's contract says it returns the sentinel and lets the caller handle it. The caller (existing tie-band rule in `linear_above_threshold`) is unchanged in Unit 1.
- *Edge case (tie band):* the locked 3v3 9-9 tie-band rule still produces the same match-end outcome (0 per-match points regardless). This is Points System's rule, not Win Calc's — Unit 1 doesn't touch it.
- *Integration:* `off_preset_combos.test.ts` continues to pass.
- *Contract test:* the walker rejects invalid inputs (empty stack, missing match data) gracefully — never throws, returns a typed error or the tied sentinel.

**Verification:**
- The 3 characterization tests pass byte-identical.
- New files `src/systems/win-calculators/{types,walker,index}.ts` exist with full contract coverage.
- `SystemModule` interface has `winCalculator: WinCalculator` field with a metric stack rather than a binary kind.
- The 3 bundled SystemModule files declare a one-entry metric stack matching their current `win_condition`.
- Runtime consumers (`computeMatchRunningTotals`, match-end logic) consult the Module via `system_snapshot.winCalculator.decide(...)`, not via inline switch on `win_condition`.
- All test suites pass.
- **The `edge` metric stack entry is enabled in the type system but never appears in any league's actual stack in this Unit** — it remains "future use" until Unit 9 wires the Tiebreak System.

---

- [ ] **Unit 2: Extract Threshold Charts as primitive Module(s)**

**Sketch only — to be defined in detail when Unit 1 completes.**

**Goal:** Lift hardcoded TS chart files (`src/systems/charts/`) and the chart compute logic out of being bundled inside SystemModule's `threshold` capability, into being first-class Chart Modules per the locked Threshold Charts README. Each chart (3v3 Games-Needed, 5v5 Games-Needed, FargoRate Formula, Race Points, Race Percentage) becomes its own Chart variant with the encoding-locked input contract.

**Why second:** Already partly separated (DB tables exist for charts; SQL lookup function exists). The locked Threshold Charts README explicitly maps the variants. Charts are the most well-bounded of the remaining Modules.

**To define when we approach:** specific file list, contract shape for `Chart<TInput, TOutput>`, how the SystemModule adapter delegates threshold computes to the active Chart Module, test strategy.

---

- [ ] **Unit 3: Extract Handicap Systems as primitive Module(s)**

**Sketch only — to be defined in detail when Unit 2 completes.**

**Goal:** Lift the `rating` capability section out of SystemModule into a first-class Handicap System Module with 4 variants (Points, Percentage, FargoRate, Skill-Level-reserved). Each variant: encoding spec + validation + display format + history-based computation (for internal variants).

**Why third:** Rating is self-contained inside each bundled SystemModule today. Extracting it doesn't require coordination with other Modules first.

---

- [ ] **Unit 4: Extract Handicap Mechanisms as primitive Module(s)**

**Sketch only.**

**Goal:** Promote the existing `mechanism` preference column + the `ExtraGamesThreshold | StartPointsThreshold | RaceLengthThreshold` discriminated union into a first-class Handicap Mechanism Module with 3 shipped variants + 'none', per the locked 2x2 taxonomy.

**Why fourth:** Builds on Unit 2 (Charts) — Mechanisms consume Chart output, so Charts existing as Modules makes Mechanism extraction cleaner. Also discriminated-union pattern is already in place; this codifies it as proper Module shape.

---

- [ ] **Unit 5: Reconcile the Points System decomposition to the finalized canon + wire it into live scoring**

**Partially built ahead of order — now a *reconciliation*, not a fresh extraction.** `src/systems/points-system/` already decomposes the Points System (data-driven thresholds, per-game allocator, triggers, registries; ~861 tests). It was built to a pre-canon model and must be reconciled to the finalized canon, then cut over from the legacy calculators.

**Final-canon target** (per the locked points-system README + `trigger.md`):
- **(A) Per-game allocator** — stays a distinct primitive (the per-game reducer + ORDER pivot + scorer-input collector). Already built; keep.
- **(B) Trigger** — decoupled from thresholds (no `input`/`inputSpec`): TYPE (match_start/match_end/anytime) + CONDITION (one flat comparison) + ACTION (write one state var via a flat `( ) + − × ÷` expression; `÷` throws on /0 + build warning) + RE-ARM (single-shot/periodic/manual) + ORDER (number + before/after-allocator bool).
- **(C) Initial points** — a match_start trigger.
- **Threshold** — a state setter that writes to the bag directly at match start (drop the "receipt trigger" indirection).
- **End-of-match scoring** — `match_end` triggers (two per side + default-0 tie band); the `endOfMatchAggregate` slot + `aggregate` kind/registry dissolve.

**Reconciliation punch list:** the code-vs-canon audit (2026-05-20) enumerates the gaps — kill `input`/`inputSpec`; add TYPE; CONDITION as a flat comparison; ACTION as a flat-expression evaluator; add RE-ARM; add the ORDER allocator-pivot; dissolve EOGA into match_end triggers; thresholds as direct state setters; rebuild the 5 compositions + validator; reconcile `terminal` → `endmatch`.

**Legacy→new cutover (strand B):** the live scoring path (`computeMatchRunningTotals`, `ScoringDialog`, `ScoreMatch`, `UnifiedScoreboard`, the wizard step) still runs the legacy `src/systems/calculators/`. Wire the reconciled `points-system/` runtime into live scoring and retire the legacy calculators.

**UI-readiness is load-bearing here.** Every shape (conditions, actions, side configs) must stay data-driven + serializable so the future non-coder build/tinker workspace can expose them as dials with no second refactor — that workspace is the entire reason for the modular architecture (`[[project_modular_scoring_build_ui_ready]]`). Do NOT build the workspace in this unit; just don't foreclose it.

**Why this is the largest unit:** the trigger/threshold/allocator reconciliation + the legacy cutover are both substantial. Characterization tests + the 861 existing points-system tests are the parity gate.

---

- [ ] **Unit 6: Extract Team Geometry as primitive Module**

**Sketch only.**

**Goal:** Lift `lineup_size` + `max_roster_size` + `game_generation` from being preference columns + the `SystemModule.teamFormat` capability section into a first-class Team Geometry Module. **First time this Module gets its own locked README** (currently pending — write it as part of this unit, or as a separate locked-doc unlock action if `[[feedback_stop_asking_to_break_protocols]]` requires).

---

- [ ] **Unit 7: Extract Match Format as primitive Module**

**Sketch only.**

**Goal:** Lift `pairing_format` + `race_length` from scattered preference fields into a first-class Match Format Module. **First time this Module gets its own locked README** (currently pending).

---

- [ ] **Unit 8: Extract Standings & Tiebreakers as primitive Module**

**Sketch only.**

**Goal:** Lift `standings_sort` + `tiebreaker_trigger` + `tiebreaker_format` from scattered preference fields + `playoffGenerator.standingsSort.ts` into a first-class Standings & Tiebreakers Module. **First time this Module gets its own locked README** (currently pending).

---

- [ ] **Unit 9: Dissolve `SystemModule` bundle — 3 prepackaged systems become composition declarations**

**Sketch only.**

**Goal:** With all 8 component Modules extracted as primitives, the `SystemModule` adapter has no behavior of its own — it's a pure pass-through. Dissolve it. The 3 prepackaged Scoring Systems become tiny declarations (~15 lines each) that name which Module variants they compose. The runtime consumes the composed Modules directly without going through the `SystemModule` shell.

**End state:** `src/systems/bca3v3.ts` (was 78 lines) becomes `src/systems/scoring-systems/points_3man.ts` (~15 lines: declares the composition). The `SystemModule` interface in `src/systems/types.ts` either becomes much smaller (a list of Module instances) or goes away entirely.

**This is also the natural place to do the internal brand rename** (`bca3v3` → `points_3man` etc.) if not done separately — the file restructure is the moment to apply the CSI-aligned naming.

---

- [ ] **Unit 10: Decision Record**

**Sketch only.**

**Goal:** One markdown file at `docs/plans/decision-records/2026-05-17-modular-migration.md` capturing:
- What got built (which Modules extracted, in what order)
- What got deferred (Converter Module, Pairings Generator split, dial customization, 4th Scoring System, chart editor UI) with reconsideration triggers
- Lessons learned during the migration (any patterns that worked well, any surprises)
- Hand-off to the next phase (Ed's dial brainstorm)

## System-Wide Impact

- **Interaction graph:** Almost every part of the scoring runtime (`computeMatchRunningTotals`, scoreboards, scoring mutations, vacate-and-rescore, match-end verification, snapshot persistence) touches the SystemModule interface. The strangler-fig adapter keeps this surface stable throughout extractions 1-8.
- **Error propagation:** Existing graceful-degradation in `buildSystemFromPreferences` (warn + safe default) stays as the floor. Module-by-Module extraction preserves it.
- **State lifecycle:** `matches.system_snapshot` JSONB column captures the resolved configuration at scheduled→in_progress. As Modules become primitives, the snapshot shape may carry Module identifiers (`winCalculator: 'games_decides'`) rather than raw preference values. Migration-safe per `[[feedback_dev_data_disposable]]`.
- **API surface parity:** Internal types change; external (mobile app) surface stays stable (mobile reads preference columns, not SystemModule internals).
- **Unchanged invariants:** Locked 3v3 9-9 tie-band rule (0 points) byte-identical throughout. 3 characterization tests are the gate for every extraction.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| An extraction reveals deeper coupling than expected; the unit grows mid-flight | High | Med | Each unit's "approach" is sketched ahead of time but only detailed when started; the strangler-fig adapter pattern means partial extractions don't break the app |
| A characterization test breaks during an extraction (real behavior changes accidentally) | Med | High | The characterization tests ARE the gate; don't merge a unit with failing tests; investigate before continuing |
| Locked pages have ambiguities or contradictions that surface during extraction | Med | Med | Surface to Ed for a Principle-7-gated update with the specific change spelled out; do NOT silently interpret |
| The 3-9 month timeline drifts further; partial migration sits indefinitely | Med | Low | Strangler-fig means partial state is workable; pause between units is fine; no "all 10 must finish before anything works" pressure |
| Future plans get drafted against the partial state and reinforce the bundling | Med | Med | Decision Record (Unit 10) cross-references the migration's current state; future planners read it before designing new work |
| Pending locked-page READMEs (Team Geometry, Match Format, Standings) need writing before Units 6/7/8 can land cleanly | High | Low | Write each pending README as part of approaching its extraction unit; treat as Principle-7-gated content the user approves |

## Documentation / Operational Notes

- **Each extraction unit produces its own commit/PR.** The strangler-fig means each unit is independently shippable.
- **Characterization tests are the audit reference.** Per `[[feedback_two_paths_audit_pattern]]`, the `{bca3v3,bca5v5,fargo5v5}.characterization.test.ts` files are not touched during extractions — they prove the external behavior is preserved.
- **Module-by-Module locked READMEs.** The locked README pattern (Essence / Boundary / Variants / How this Module interacts / Source of truth) gets applied to Team Geometry, Match Format, Standings & Tiebreakers as those Modules get extracted. These new READMEs become locked once written (per `[[feedback_lock_only_finished_docs]]`).
- **No backfill for snapshot shape.** Per `[[feedback_dev_data_disposable]]`, `db reset` truncates test data when snapshot shape changes during extractions.
- **The 3 prepackaged systems are the only systems supported throughout.** BCAPL SL stays reserved; no new systems land during this plan.

## Sources & References

- **Origin documents:**
  - [`docs/brainstorms/2026-05-17-modular-scoring-system-comparison-requirements.md`](../brainstorms/2026-05-17-modular-scoring-system-comparison-requirements.md) — verdict: ship the framework
  - [`docs/brainstorms/2026-05-16-modular-scoring-system-viability-requirements.md`](../brainstorms/2026-05-16-modular-scoring-system-viability-requirements.md) — R1-R19 architecture
- **Target framework (locked pages):**
  - [`docs/league-system/PRINCIPLES.md`](../league-system/PRINCIPLES.md)
  - [`docs/league-system/README.md`](../league-system/README.md)
  - [`docs/league-system/modules/handicap-systems/README.md`](../league-system/modules/handicap-systems/README.md)
  - [`docs/league-system/modules/handicap-mechanisms/README.md`](../league-system/modules/handicap-mechanisms/README.md)
  - [`docs/league-system/modules/points-system/README.md`](../league-system/modules/points-system/README.md)
  - [`docs/league-system/modules/win-calculator.md`](../league-system/modules/win-calculator.md)
  - [`docs/league-system/modules/threshold-charts/README.md`](../league-system/modules/threshold-charts/README.md)
- **Prior plans (superseded; pending items deferred per Decision Record):**
  - [`docs/plans/2026-04-28-001-feat-modular-league-system-plan.md`](2026-04-28-001-feat-modular-league-system-plan.md)
  - [`docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md`](2026-05-01-001-feat-modular-league-system-v2-plan.md)
- **Key code seams (the existing bundled code being transformed):**
  - `src/systems/types.ts` — `SystemModule` interface
  - `src/systems/{bca3v3,bca5v5,fargo5v5}.ts` — the 3 bundled SystemModules
  - `src/systems/buildSystemFromPreferences.ts` — runtime resolver
  - `src/systems/calculators/` — calculator registry (Unit 5 decomposes these)
  - `src/systems/charts/` — hardcoded TS charts (Unit 2 lifts these)
  - `src/systems/__tests__/{bca3v3,bca5v5,fargo5v5}.characterization.test.ts` — audit reference
- **Memory entries carried as plan constraints:**
  - `[[feedback_stop_asking_to_break_protocols]]`, `[[feedback_respect_module_boundaries_in_plans]]`, `[[feedback_default_to_simpler]]`, `[[feedback_plan_from_target_not_existing]]`, `[[feedback_internal_naming_vs_ui_naming]]`, `[[feedback_dev_data_disposable]]`, `[[feedback_consolidate_migrations_in_pr]]`, `[[feedback_two_paths_audit_pattern]]`, `[[project_scoring_accountability]]`, `[[project_modular_scoring_works_not_perfect]]`
