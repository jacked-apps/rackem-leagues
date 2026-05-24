---
title: League System — Implementation Status (sidecar)
status: living
date: 2026-05-24
audience: AI sessions + dev
locked: false
---

# League System — Implementation Status

> **Snapshot in time — verify against current code before relying on anything here.**
> This is the *unlocked, editable* companion to the LOCKED design docs under
> `docs/league-system/modules/`. The design docs describe each Module as the spec
> for a program not yet built — they carry **no** code references, build status, or
> "Source of truth" lists (per [PRINCIPLES § 6](PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary)).
> All of that perishable detail lives **here** instead, so it can be updated as the
> code moves without touching (or unlocking) the canon.

## How to use this sheet

- Each section below mirrors one design doc and is titled with that doc's path.
- Back-pointers reference the design doc's **section heading** (anchor), never a
  line number — so they survive future edits to the canon.
- "Extracted from" notes record where a block previously lived inside the locked
  doc, so the association is never lost.
- This sheet is expected to drift. When code changes, update the relevant section
  here — no unlock ritual required.

## Coverage

Checked = the clear-cut code/status **sections** (`Source of truth`, `Current code state`, `Implementation status`, `(Optional) Code references`, etc.) have been extracted into this sheet (first pass, 2026-05-24). A **borderline pass is still pending** for several docs — inline status qualifiers woven into design prose ("currently wired…", "hardcoded today", "Currently shipped values"), the "architectural intent / modules are orthogonal" notes, and "reserved / stub" framings. Those are handled deliberately in a later round, not in this first pass.

- [x] modules/win-calculator.md
- [x] modules/team-geometry.md
- [x] modules/match-format.md
- [x] modules/pairings-generator.md
- [x] modules/handicap-mechanisms/README.md
- [x] modules/handicap-mechanisms/extra-games.md
- [x] modules/handicap-mechanisms/start-points.md
- [x] modules/handicap-mechanisms/race-length-adjustment.md
- [x] modules/handicap-systems/README.md
- [x] modules/handicap-systems/points.md
- [x] modules/handicap-systems/percentage.md
- [x] modules/handicap-systems/fargorate.md
- [x] modules/handicap-systems/skill-level.md
- [x] modules/threshold-charts/README.md
- [x] modules/threshold-charts/3v3-games-needed.md
- [x] modules/threshold-charts/5v5-games-needed.md
- [x] modules/threshold-charts/fargo-formula.md
- [x] modules/threshold-charts/race-percentage.md
- [x] modules/threshold-charts/race-points.md
- [x] modules/points-system/README.md
- [x] modules/points-system/one-point-scoring.md
- [x] modules/points-system/ten-point-scoring.md
- [x] modules/points-system/trigger.md — *clean; no perishable content to extract*
- [x] modules/tiebreak-system/README.md
- [x] modules/tiebreak-system/coin-flip.md
- [x] modules/tiebreak-system/human-pick.md
- [x] modules/tiebreak-system/mini-match.md
- [x] modules/tiebreak-system/roshambo.md

---

<!-- Extracted sections are appended below, one per design doc, as the ritual proceeds. -->

## modules/win-calculator.md

_Design doc: [win-calculator.md](modules/win-calculator.md). Extracted 2026-05-24._

### Implementation status — BUILT + LIVE (2026-05-24)

_Extracted from the former "Current implementation status" section and **corrected** — the locked doc said "not yet in code," which is no longer true._

The pure-judge model is built and live. The Win Calculator decides the match winner via `decideWinner(state, config)` — winner-chip (`edge`) override first, then the LO-ordered games/points comparators (each `most` or `met_goal`), then a no-winner tie handed up to the runtime.

- Authoritative in `src/components/scoring/MatchEndVerification.tsx`; the legacy inline winner logic (`determineMatchResult` + the points ternary) runs alongside as fallback + divergence auditor (strangler-fig — remove once trusted across more live matches).
- Config is built in code from the league's `win_condition` via `buildWinCalcConfig` (`games` → `met_goal`; `points` → points-`most` then games-`most`). The comparator set is not yet LO-exposed (that is the future workshop).
- The `edge` winner chip / compare-to-target clinch path depends on a Threshold Trigger, which depends on the Threshold Charts Module + the Trigger primitive existing in code. Build order for that path: Threshold Charts → Trigger → the clinch chip. (The match-end comparators already work without it.)
- A full LO-configured comparator-set + integrated Tiebreak System chain evaluator would need new preference column(s) — not built.

### Source of truth (code)

_Extracted from the former "Source of truth" section; corrected to current reality._

- `src/systems/win-calculator/` (singular) — the live pure judge: `judge.ts` (`decideWinner`), `comparators.ts` (`most`/`metGoal`), `configs.ts` (`buildWinCalcConfig`), `types.ts`, `index.ts`. 32 tests incl. characterization parity.
- `src/components/scoring/MatchEndVerification.tsx` — the live winner write (judge authoritative; legacy = fallback + auditor).
- `src/types/preferences.ts`, `src/types/resolvedSystemConfig.ts` — the `win_condition` column type (`'games' | 'points'`), the upstream config input.
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK for `win_condition`.
- `src/systems/buildSystemFromPreferences.ts` — resolves `win_condition` into the league config.
- `src/wizards/league-v2/steps/WinConditionStep.tsx` — wizard UI for selecting the win condition.
- `src/systems/win-calculators/` (plural) — **REMOVED 2026-05-24**; was halted Unit-1 metric-stack scaffolding that never implemented the live model.

### Open-design-space status

_Status tails trimmed from "Remaining open design space"; the design items themselves stay in the locked doc._

- Race-mode termination: the `endMatch` "end now" trigger semantics are unbuilt; today every match plays its full game count.
- Cross-axis conditions: today this lives inside the Points System calculator `linear_above_threshold`, not the Win Calculator; a future refactor could lift it.
- Per-game evaluation cadence: today only threshold-mode is wired; race-mode cadence is unbuilt.
- Comparator persistence shape: the preference-column shape is an implementation-time choice (not built).

## modules/handicap-mechanisms/README.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-mechanisms/README.md](modules/handicap-mechanisms/README.md)._


### Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — `mechanism` column type union
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` (around lines 122–134) — DB CHECK enumerating allowed values
- `src/systems/buildSystemFromPreferences.ts` — `pickThresholdCapability()` switch (around line 362) plus per-mechanism dispatchers (`pickExtraGamesThreshold`, `pickStartPointsThreshold`, `pickRaceLengthThreshold`)
- `src/systems/types.ts` (around line 137+) — discriminated union of threshold types (`ExtraGamesThreshold`, `StartPointsThreshold`, `RaceLengthThreshold`)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — resolved view applies the cascade for the `mechanism` column

### Inline status & code refs (borderline pass)

- Win Calculator is the binary `win_condition` axis (`games` | `points`) today (referenced in Essence + the Downstream interaction).
- Architectural-intent note: the current codebase has wiring for specific encoding-mechanism combinations only (see variant pages for wired vs unwired) — implementation status, not architectural intent; future work fills the gaps.
- `mechanism='none'` collapses in code to a zero-handicap `extra_games` shape for type-system convenience — callers see `threshold.mode === 'extra_games'` with no per-side delta.
- The `manual_entry` term lives in `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` — a threshold-chart-source classification (not a mechanism).
- Taxonomy realization: shipped variants are `start_points`, `extra_games`, `race_length_adjustment`; the `games-on-the-wire` and `extra_points` cells of the 2×2 are unrealized (future).

## modules/handicap-mechanisms/extra-games.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-mechanisms/extra-games.md](modules/handicap-mechanisms/extra-games.md)._


### Current code state

- DB: `'extra_games'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `ExtraGamesThreshold` in `src/systems/types.ts` (around line 142).
- Dispatch: `pickExtraGamesThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 270). Wired for Points (delegates to `bca3v3.threshold.compute`) and Percentage (delegates to `bca5v5.threshold.compute`). Unwired combinations (Fargo + extra_games, skill_level + extra_games, etc.) return a zero-handicap fallback and emit a warning.
- The actual chart computation for the wired combos lives in `src/utils/handicap/get3v3GamesNeeded.ts` and `src/utils/handicap/get5v5GamesNeeded.ts`. Same architectural-intent flag as in the [Module README](README.md#architectural-intent-modules-are-orthogonal): the current `bca3v3`/`bca5v5` SystemModules bundle the chart call directly — that's a Threshold Charts concern bundled into the rating-system files for historical reasons, not architectural intent.

## modules/handicap-mechanisms/race-length-adjustment.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-mechanisms/race-length-adjustment.md](modules/handicap-mechanisms/race-length-adjustment.md)._


### Current code state

- DB: `'race_length_adjustment'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `RaceLengthThreshold` in `src/systems/types.ts` (around line 180).
- Dispatch: `pickRaceLengthThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 334). Currently returns an equal-race-length fallback (warns: "no chart wired yet — Unit 3.3"). No Handicap System pairing is calibrated for this mechanism.
- **To revive**: a [Threshold Chart](../threshold-charts/README.md) keyed on individual rating pairs must be authored — e.g., an APA SL pair → per-player race lengths chart, or a FargoRate HOT-style chart. The schema and dispatch are in place; only the chart data is missing.

## modules/handicap-mechanisms/start-points.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-mechanisms/start-points.md](modules/handicap-mechanisms/start-points.md)._


### Current code state

- DB: `'start_points'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `StartPointsThreshold` in `src/systems/types.ts` (around line 157).
- Dispatch: `pickStartPointsThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 304). Wired for FargoRate (delegates to `fargo5v5.threshold.compute`); unwired combinations return a zero start-points fallback and emit a warning.
- The actual `computeStartPoints` formula lives in `src/systems/fargo5v5.ts` (around lines 106–153). Same architectural-intent flag noted in [Module README](README.md#architectural-intent-modules-are-orthogonal) and in [`fargorate.md`'s Current code state](../handicap-systems/fargorate.md#current-code-state): the start-points math is currently bundled with the rating-system file (`fargo5v5.ts`) rather than living as a standalone mechanism. That bundling is an implementation artifact — start_points is a Mechanism concern that should be decoupled from the rating-system file in future refactors.

## modules/handicap-systems/README.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-systems/README.md](modules/handicap-systems/README.md)._


### Source of truth

- `src/types/preferences.ts` — `handicap_type` column type
- `src/utils/calculatePlayerHandicap.ts` — `HandicapType` union; calculation dispatch
- `supabase/migrations/20260410000000_extend_preferences_modular.sql` (lines 51–66) — DB CHECK enumerating allowed values
- `src/systems/buildSystemFromPreferences.ts` — per-`handicap_type` SystemModule dispatch
- `src/wizards/league-v2/steps/HandicapSystemStep.tsx` — wizard UI for variant selection

Step-2 rename targets: none at the Module level (the file structure is not being renamed; only the SystemModule keys / prepackaged Scoring System preset keys are).

### Inline status & code refs (borderline pass)

- Architectural-intent: the current codebase has historical bundlings — `bca3v3` calls a threshold chart directly, `fargo5v5` bundles rating math with start-points math — implementation artifacts, not intent; future refactors decouple so any encoding pairs with any downstream Module.
- Skill Level: schema present; wizard card hidden in step 2 until a usable implementation lands.
- The 15-game starting-handicap threshold is hardcoded today (not yet LO-configurable).

## modules/handicap-systems/fargorate.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-systems/fargorate.md](modules/handicap-systems/fargorate.md)._


### Current code state

This handicap system shows up at two code layers, both used by the **FargoRate 10-Point 5-Man** prepackaged Scoring System (the LO-facing name for the bundle of choices that picks this system):

- **`fargo_5v5`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 9 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='fargo'`, plus the values for the other 8 Modules).
- **`fargo5v5`** (in `src/systems/fargo5v5.ts`) is the **SystemModule key** — the runtime code object that does the rating handling (validation, the `2^(rating/100)` transform, the win-expectancy computation, plus — for the current shipping pairing — start-points math).

The two layers connect via `handicap_type='fargo'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `fargo5v5` SystemModule at runtime. Step 2 collapses both names into `fargo_10pt_5man` for consistency across layers.

**Implementation-vs-intent flag:** the `fargo5v5` SystemModule today bundles rating-system math (validation, transform, win-expectancy) AND start-points math in one file. The start-points portion is a **Handicap Mechanism concern**, not a rating-system concern, and the bundling is an accident of how the code grew before modular axes were fully separated. This is an **implementation artifact, not architectural intent**: any rating encoding should be composable with any mechanism. Future refactors should decouple to keep the rating variant clean and allow FargoRate to pair with mechanisms other than start_points (e.g., a future FargoRate + Race-To Scoring System using `extra_games`). See the [Module README → Boundary](README.md#boundary) for the orthogonality intent.

- Code anchors today: `src/systems/fargo5v5.ts` (SystemModule — rating validation, `2^(rating/100)` transform, start-points formula); `src/utils/calculatePlayerHandicap.ts:110+` (`calculateFargoHandicap` three-step fallback); `src/utils/handicap/fargoGamesWonThresholds.ts` (formula chart)
- DB: `'fargo'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:60`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`
- Calibration: see `docs/research/fargo-games-won-threshold.md` and `docs/research/fargorate-formula.md` for the formula derivation against FargoRate's published HOT race chart

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target |
|---|---|
| `fargo5v5.ts` (filename) | `fargo_10pt_5man.ts` |
| `fargo5v5` (SystemModule key) | `fargo_10pt_5man` |
| `fargo_5v5` (wizard preset key) | `fargo_10pt_5man` |

The new name `fargo_10pt_5man` makes the bundled choices explicit: FargoRate handicap **+** 10-Point Scoring **+** 5-Man lineup. This anticipates a future second Fargo Scoring System (e.g., `fargo_1pt_5man` for the Race-To variant) where the disambiguation matters.

### Inline status & code refs (borderline pass)

- Rating sourcing (`calculateFargoHandicap` three-step fallback): the FargoRate API is not yet integrated (TODO); the live fallback reads the last stored rating from the most recent `match_lineups` row, flagged `stale: true`; no data returns `null`.

## modules/handicap-systems/percentage.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-systems/percentage.md](modules/handicap-systems/percentage.md)._


### Current code state

This handicap system shows up at two code layers, both used by the **Percentage 5-Man** prepackaged Scoring System (the LO-facing name for the bundle of choices that picks this system):

- **`standard_5v5`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 9 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='percentage'`, plus the values for the other 8 Modules).
- **`bca5v5`** (in `src/systems/bca5v5.ts`) is the **SystemModule key** — the runtime code object handling the Percentage rating math (validation, history-based computation). The same file *also* currently calls the [5v5 games-needed chart](../threshold-charts/5v5-games-needed.md) directly — that's a separate Module's concern (Threshold Charts) bundled into this file for historical reasons. The bundling is an **implementation artifact, not architectural intent**: future refactors should decouple so any rating encoding can pair with any chart. See the [Module README → Boundary](README.md#boundary) for the orthogonality intent.

The two layers connect via `handicap_type='percentage'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `bca5v5` SystemModule at runtime. Step 2 collapses both names into `percentage_5man` for consistency across layers.

- Code anchors today: `src/systems/bca5v5.ts` (SystemModule); `src/utils/calculatePlayerHandicap.ts` (history-based computation, lines ~93–95); `src/utils/handicap/get5v5GamesNeeded.ts` (threshold chart lookup)
- DB: `'percentage'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:59`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target |
|---|---|
| `bca5v5.ts` (filename) | `percentage_5man.ts` |
| `bca5v5` (SystemModule key) | `percentage_5man` |
| `standard_5v5` (wizard preset key) | `percentage_5man` |

Same [BCA vs BCAPL rule](../../README.md#brand-naming) applies — the current `bca5v5` identifier is non-compliant with CSI's published name guidelines.

## modules/handicap-systems/points.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-systems/points.md](modules/handicap-systems/points.md)._


### Current code state

This handicap system shows up at two code layers, both used by the **Points 3-Man** prepackaged Scoring System (the LO-facing name for the bundle of choices that picks this system):

- **`standard_3v3`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 9 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='points'`, plus the values for the other 8 Modules).
- **`bca3v3`** (in `src/systems/bca3v3.ts`) is the **SystemModule key** — the runtime code object handling the Points rating math (validation, history-based computation). The same file *also* currently calls the [3v3 games-needed chart](../threshold-charts/3v3-games-needed.md) directly — that's a separate Module's concern (Threshold Charts) bundled into this file for historical reasons. The bundling is an **implementation artifact, not architectural intent**: future refactors should decouple so any rating encoding can pair with any chart. See the [Module README → Boundary](README.md#boundary) for the orthogonality intent.

The two layers connect via `handicap_type='points'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `bca3v3` SystemModule at runtime. Step 2 collapses both names into `points_3man` for consistency across layers.

- Code anchors today: `src/systems/bca3v3.ts` (SystemModule); `src/utils/calculatePlayerHandicap.ts` (history-based computation, lines ~78–90); `src/utils/handicap/get3v3GamesNeeded.ts` (threshold chart lookup)
- DB: `'points'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:58`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target | Reason |
|---|---|---|
| `bca3v3.ts` (filename) | `points_3man.ts` (snake_case per repo precedent) | "BCA" alone is incorrect per [BCA vs BCAPL rule](../../README.md#brand-naming) |
| `bca3v3` (SystemModule key) | `points_3man` | Same |
| `standard_3v3` (wizard preset key) | `points_3man` | Names the actual handicap system + lineup size |

CSI's *BCA Pool League Operators' Handbook* (June 2020, p.41 "Name Guidelines") explicitly states "BCA" alone is an incorrect reference — only "BCAPL" or "BCA Pool League" are valid. The current `bca3v3` identifiers literally violate CSI's published guidance, independently of the also-true motivation that the new names better describe what each prepackaged Scoring System actually is.

## modules/handicap-systems/skill-level.md

_Extracted 2026-05-24 from the locked design doc [modules/handicap-systems/skill-level.md](modules/handicap-systems/skill-level.md)._

### Current code state (and the step-2 hide)

The variant is **scaffolded but not usable**:

- DB allows the value: `'skill_level'` in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:61`)
- `HandicapType` union member: `src/utils/calculatePlayerHandicap.ts:22`
- Stub branch in `src/systems/buildSystemFromPreferences.ts:135` (`case 'skill_level':`)
- Wizard card currently visible: `src/wizards/league-v2/steps/HandicapSystemStep.tsx:43`

**Step 2 will:**

1. **Hide the wizard card** in `HandicapSystemStep.tsx` so operators cannot select Skill Level until a usable implementation exists. The schema, stub, and union member stay intact — per the project's *hide-but-preserve* rule for half-built features (don't ship broken; don't strip scaffolding).
2. **Add an early-return guard in `src/utils/calculatePlayerHandicap.ts`** for `handicap_type === 'skill_level'`. Today the function silently falls through to a percentage-style starting handicap (returning `player.starting_handicap_5v5 ?? 40`), which is wrong data, not a visible failure. The guard should return `{ value: null, stale: false }` with a `logger.warn` — turning silent miscalculation into an explicit "no data" state.


## modules/match-format.md

_Extracted 2026-05-24 from the locked design doc [modules/match-format.md](modules/match-format.md)._

### Implementation status

The locked [`README.md`](../README.md) and [Handicap Mechanisms README's orthogonality section](handicap-mechanisms/README.md#architectural-intent-modules-are-orthogonal) both establish the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Match Format's situation in current code:

- The two axes live as columns on the `preferences` table (`pairing_format`, `race_length`).
- All three currently-shipped prepackaged Scoring Systems use `pairing_format='single_rack'`; no shipping system uses `race_to_n`. **The race-to-N runtime code path is partially implemented but not end-to-end tested** — it exists in service of a future race-tradition Scoring System (a BCAPL skill-level-style format would be the natural first shipped consumer).
- The `RaceLengthThreshold` type in `src/systems/types.ts` is wired (it's the third arm of the threshold discriminated union per Phase 1 Unit 1.3 of the v2 plan), but no SystemModule currently produces a `RaceLengthThreshold` at runtime because no shipped system uses `race_length_adjustment` as its Mechanism.
- [Pairings Generator](pairings-generator.md) is recognized in the locked Module catalog as Module #8 but is not yet extracted as a centralized implementation; per-system game-order code in `src/utils/gameOrder.ts` and inlined scoring-runtime logic together cover the single_rack case for the shipped systems. Race_to_n pairing generation would need to extend this when BCAPL SL or similar formats ship.
- Wizard UI: `pairing_format` and `race_length` are currently derived from preset selection rather than independently chosen for the LO (the preset implies single_rack); a Step-2 refactor opportunity is to expose the axes independently once `race_to_n` has a shipping consumer.

The Step-2 refactor lifts Match Format out as a first-class Module, extracts [Pairings Generator](pairings-generator.md) as a centralized runtime instantiator with its three sub-Mechanisms as first-class stages, and dissolves any remaining bundling between Team Geometry's `teamFormat` constants and Match Format's per-pairing axes inside the per-system SystemModule files. The new Module's typed contract is small — two fields with the existence invariant — but the runtime code paths it gates (especially the unfinished `race_to_n` termination logic) are substantive.


### Source of truth

- `src/types/preferences.ts` — `pairing_format`, `race_length` column types in the `preferences` row shape
- `src/types/resolvedSystemConfig.ts` — `ResolvedSystemConfig` carries the resolved Match Format tuple post-cascade
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` (lines 52–60 for `pairing_format`, lines 181–187 for `race_length`) — schema definitions + CHECK constraints
- `supabase/migrations/20260418000002_lock_tier1_preferences.sql` — Postgres trigger enforcing season-stability immutability (Match Format's axes are in the lock set)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — `resolved_league_preferences` view applies the 3-tier cascade for Match Format's axes
- `src/systems/types.ts` (around line 179+) — `RaceLengthThreshold` interface; the discriminated-union arm corresponding to `race_length_adjustment` Mechanism (not directly the Match Format Module, but the typed contract for the Threshold output shape Match Format's `race_to_n` variant implies downstream)
- `src/systems/buildSystemFromPreferences.ts` — `pickThresholdCapability` switch including the `race_length_adjustment` branch (consumer of `race_length` when paired with the matching Mechanism)
- `src/utils/gameOrder.ts` — currently hardcoded for single_rack 3v3 DRR; race_to_n pairings would extend this
- `src/wizards/league-v2/steps/` — wizard step(s) for `pairing_format` and `race_length`; currently derived from preset selection rather than independently chosen
- `src/components/scoring/` — scoring popup and scoresheet renderer; current code branches implicitly on single_rack assumption, race_to_n branches are partial

## modules/pairings-generator.md

_Extracted 2026-05-24 from the locked design doc [modules/pairings-generator.md](modules/pairings-generator.md)._

### Implementation status

The locked [`README.md`](../README.md) and [Handicap Systems README's "Architectural intent: modules are orthogonal" section](handicap-systems/README.md#architectural-intent-modules-are-orthogonal) both establish the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Pairings Generator's situation in current code matches:

- There is no standalone `PairingsGenerator` Module type in `src/systems/`. The work happens but is bundled inside per-Scoring-System code paths.
- `src/utils/gameOrder.ts` contains a hardcoded 18-game DRR table for 3v3 that bundles all three sub-Mechanisms (pair generation + game ordering + break/rack assignment) into one lookup table. Helper functions (`getGameMatchup(game_number)` etc.) read from this table at scoring time.
- The 5v5 SRR case is computed inline elsewhere in the scoring runtime (not centralized; specific algorithm location is implicit in code).
- No preference columns exist for any of the three sub-Mechanisms today. The choices are implicit in per-Scoring-System code rather than LO-configurable.
- The race_to_n + race_length_adjustment combination is the case where Match Format + Handicap Mechanism downstream consumption of this Module's output diverges from the single_rack assumption — implementation is partial there because no shipped Scoring System uses race_to_n.

The Step-2 refactor lifts Pairings Generator out as a first-class Module with its own typed contract, splits the three sub-Mechanisms into separately-implemented stages, and centralizes the previously-scattered runtime code. The new Module's typed contract is small but load-bearing (the slot-list shape is consumed by every scoring code path). Per-sub-Mechanism preference columns may be added in a later phase as LO customization at any of the three stages becomes a real product need; the Module's design accommodates this extension without restructuring.


### Source of truth

- `src/utils/gameOrder.ts` — current hardcoded 18-game DRR table for 3v3 bundling all three sub-Mechanisms; `getGameMatchup(game_number)` and related helpers read from this table
- `src/utils/__tests__/gameOrder.characterization.test.ts` — characterization tests locking the current 3v3 DRR sequence; the Step-2 refactor preserves byte-identical output
- 5v5 SRR pair-and-order generation is computed inline in the scoring runtime (location implicit; centralizing this is part of the Step-2 refactor)
- No preference columns currently exist for any of the three sub-Mechanisms; addition would require a schema migration adding `pair_generation_variant`, `game_ordering_variant`, `break_rack_assignment_variant` to `preferences` with appropriate CHECK constraints
- `src/types/match.ts` — `GameSlot` (or equivalent) is the output record shape; each slot carries pairing + game_number + break/rack annotations consumed by the scoring runtime
- No wizard step currently collects Pairings Generator configuration (the sub-Mechanism choices are bundled implicitly in per-Scoring-System code); a Step-2-or-later wizard step would expose the three stages as dials

## modules/points-system/README.md

_Extracted 2026-05-24 from the locked design doc [modules/points-system/README.md](modules/points-system/README.md)._

### Our coined calculator implementations (current code)

| Calculator (in code) | What it actually contains | Used by Scoring System |
|---|---|---|
| `accumulated_per_game` | (A) generic per-game allocator | FargoRate 10-Point 5-Man (also wired with start_points logic in `fargo5v5.ts`) |
| `accumulate_with_milestone_jumps` | (A) + (B) bundled into one calculator | Percentage 5-Man |
| `linear_above_threshold` | end-of-match scoring — computes a side's match points once at match end from games-won vs thresholds (incl. the tie-band rule) | Points 3-Man |
| `none` | No-op (no points tracked at all) | None today (selectable for new leagues) |

**Implementation artifact, not architectural intent.** The current per-Scoring-System bundling means the "calculator" picked in the wizard is a pre-built combination matching that Scoring System. Architecturally, a future refactor should decouple these into composable sub-mechanisms — so an LO could mix-and-match (e.g., milestone triggers stacked on top of any per-game allocator config; start_points combined with any per-game allocator; new compositions for new Scoring Systems without writing new calculator types).

### Persisted-but-unconsumed: `points_system` column

The DB has a `points_system` column (`differential | bca_tiered | per_game | manual`) from Phase 1 of the modular system rollout. **No scoring runtime currently consumes the resolved value.** It persists per Ed's "don't drop columns" directive. Future cleanup may rename or drop in a separate branch.


### Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — `points_calculator`, `points_calculator_params`, `points_system` column types
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK enumerating allowed `points_calculator` values
- `src/systems/calculators/index.ts` — calculator registry (`getCalculator`, `registerCalculator`, `listCalculators`)
- `src/systems/calculators/types.ts` — `PointsCalculator` interface (discriminated by `kind: 'aggregate' | 'per_game'`)
- `src/systems/calculators/{linear_above_threshold,accumulate_with_milestone_jumps,accumulated_per_game}.ts` — per-calculator implementations
- `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` — wizard UI for selecting the points calculator

## modules/points-system/one-point-scoring.md

_Extracted 2026-05-24 from the locked design doc [modules/points-system/one-point-scoring.md](modules/points-system/one-point-scoring.md)._


### Current code state

**Not shipped as a direct configuration.** No current Scoring System uses a calculator that exactly implements CSI's 1-Point Scoring System (winner=1, loser=0, accumulated). The closest in spirit is **Points 3-Man** (`standard_3v3`), which uses `win_condition='games'` (matching 1-Point's victory-by-games-won philosophy) but with `points_calculator='linear_above_threshold'` — a coined calculator that gives points only above a games threshold rather than 1-per-win. So the *match-victory rule* is 1-Point-style; the *per-game point allocation* is different.

A literal CSI 1-Point Scoring System could be implemented as a new calculator (e.g., `accumulated_per_game` with `winner.points=1, loser.points=0`) and selected via the wizard. The infrastructure supports it; no league has requested it yet.

- DB: `'games'` allowed value in `preferences.win_condition` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql:115-117`).
- Win Calculator dispatch: see `src/systems/buildSystemFromPreferences.ts` (the wireup that routes match results based on `win_condition`).
- Cited CSI source: [1-Point Scoring System (CSI)](https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues).

## modules/points-system/ten-point-scoring.md

_Extracted 2026-05-24 from the locked design doc [modules/points-system/ten-point-scoring.md](modules/points-system/ten-point-scoring.md)._


### Current code state

Used by the **`fargo_5v5`** wizard preset (a.k.a. the **FargoRate 10-Point 5-Man** prepackaged Scoring System). Implemented as the `accumulated_per_game` calculator.

- Calculator: `src/systems/calculators/accumulated_per_game.ts` — registered name `'accumulated_per_game'`. Per-game-input calculator (`kind: 'per_game'`); takes the list of stored game records and computes per-team match totals.
- Default params: `{ winner: { kind: 'fixed', points: 10 }, loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' } }` — these are the 10-7 defaults; configurable per league.
- Storage: per-game data stores only `match_games.loser_balls_pocketed`; winner_points and loser_points are derived at read time from the snapshotted dials.
- Start-points integration: lives in `src/systems/fargo5v5.ts` (currently bundled with FargoRate's rating math; flagged as an [implementation artifact](../handicap-systems/fargorate.md#current-code-state) — a future refactor should decouple).
- DB: `'accumulated_per_game'` allowed value in `preferences.points_calculator` CHECK; `'points'` allowed value in `preferences.win_condition` CHECK.
- Cited CSI source: [10-Point Scoring System (CSI)](https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system).

## modules/team-geometry.md

_Extracted 2026-05-24 from the locked design doc [modules/team-geometry.md](modules/team-geometry.md)._

### Implementation status

The locked [`README.md`](../README.md) and [Handicap Systems README's "Architectural intent: modules are orthogonal" section](handicap-systems/README.md#architectural-intent-modules-are-orthogonal) both establish the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Team Geometry's situation in current code matches:

- The triple lives partly in `preferences` columns (`lineup_size`, `max_roster_size`, `game_generation`) and partly bundled inside `SystemModule.teamFormat` (a `TeamFormatConstants` interface in `src/systems/types.ts`).
- The three prepackaged Scoring System triples are wired into the three bundled SystemModule files (`bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`).
- Game-order generation for 3v3 is hardcoded in `src/utils/gameOrder.ts` (the 18-game DRR table); 5v5 SRR generation is computed inline elsewhere. **There is no unified [Pairings Generator](pairings-generator.md) engine today** — the Module is recognized in the locked Module catalog, but the implementation is still bundled inside per-Scoring-System code awaiting Step-2 extraction.
- Validation invariants are partly schema-enforced, partly application-enforced, and not centralized.

The Step-2 refactor (per the comparison brainstorm's verdict) lifts Team Geometry out as a first-class Module with its own typed contract, extracts [Pairings Generator](pairings-generator.md) as the centralized runtime instantiator with its three sub-Mechanisms as first-class stages, and dissolves the `SystemModule.teamFormat` bundling. The 3 prepackaged Scoring System triples become declarations on the composition pages.


### Source of truth

- `src/types/preferences.ts` — `lineup_size`, `max_roster_size`, `game_generation` column types in the `preferences` row shape
- `src/types/resolvedSystemConfig.ts` — `ResolvedSystemConfig` carries the resolved Team Geometry triple post-cascade
- `supabase/migrations/20260410000000_extend_preferences_modular.sql` — original `lineup_size`, `max_roster_size`, `game_generation` columns + initial CHECK constraints + `preferences_max_roster_size_check`
- `supabase/migrations/20260418000002_lock_tier1_preferences.sql` — Postgres trigger enforcing season-stability immutability (Team Geometry's `lineup_size` and `game_generation` are in the lock set; `max_roster_size` is NOT in the lock set and remains mutable mid-season)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — `resolved_league_preferences` view applies the 3-tier cascade for Team Geometry's axes
- `src/systems/types.ts` — `TeamFormatConstants` interface (bundled inside `SystemModule.teamFormat`; the Step-2 refactor lifts this out)
- `src/systems/{bca3v3,bca5v5,fargo5v5}.ts` — `teamFormat` declarations for the three prepackaged Scoring System triples
- `src/utils/gameOrder.ts` — hardcoded 18-game DRR table for 3v3 (the current bundled implementation that [Pairings Generator](pairings-generator.md) will extract from); the 5v5 SRR case is computed inline in the scoring runtime
- `src/wizards/league-v2/steps/` — wizard step(s) collecting `lineup_size` + `max_roster_size`; `game_generation` is currently derived from preset selection rather than independently chosen (a Step-2 refactor opportunity)
- `src/__tests__/database/lock_tier1_preferences.db.test.ts` (if present, naming approximate) — characterization of the lock trigger's behavior

## modules/threshold-charts/3v3-games-needed.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/3v3-games-needed.md](modules/threshold-charts/3v3-games-needed.md)._

### Filename note

Named `3v3-games-needed.md` for historical reasons; the formula is universal (parameterized by `game_count`). Rename to `points-games-needed.md` deferred to avoid breaking inbound doc/code links.


### (Optional) Code references

*Supplementary pointers to one prior implementation that approximates this Chart's shape. Per [PRINCIPLES § 6](../../PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary), this section is illustrative only — the architectural definition is the prose above, independent of any specific code.*

- **A prior implementation stored this Chart as a discrete table calibrated specifically for 3v3 DRR's 18 games** (`src/utils/handicap/get3v3GamesNeeded.ts`, the seeded DB rows in `supabase/migrations/20260410000003_seed_threshold_charts.sql`). That implementation is the human-convenience artifact described above and is **not** the source of truth under the formula-first architecture this variant page now codifies. The Step-2 refactor replaces hardcoded table values with formula evaluation parameterized by `game_count`, removing the team-size-specific constraint baked into the prior implementation.
- A prior implementation also stored the Chart shape with a 3-column output (`result_1/2/3` interpreted as win/tie/lose), conflating downstream tie-handling into the Chart's storage. The architectural definition above intentionally narrows the Chart's output to the per-side target pair; tie / unresolved-band semantics belong to the [Win Calculator](../win-calculator.md), not the Chart.
- Other prior code pointers: `supabase/migrations/20260410000002_threshold_charts.sql` (table schema + `lookup_threshold()` SQL function), `src/utils/handicap/get3v3GamesNeeded.ts` (TypeScript hardcoded copy).

## modules/threshold-charts/5v5-games-needed.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/5v5-games-needed.md](modules/threshold-charts/5v5-games-needed.md)._

### Filename note

Named `5v5-games-needed.md` for historical reasons; the formula is universal (parameterized by `game_count`). Rename to `percentage-games-needed.md` deferred to avoid breaking inbound doc/code links.


### (Optional) Code references

*Supplementary pointers to one prior implementation that approximates this Chart's shape. Per [PRINCIPLES § 6](../../PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary), this section is illustrative only — the architectural definition is the prose above, independent of any specific code.*

- **A prior implementation stored this Chart as a discrete 7-bucket range table calibrated specifically for 5v5 SRR's 25 games** (`src/utils/handicap/get5v5GamesNeeded.ts`, the seeded DB rows in `supabase/migrations/20260410000003_seed_threshold_charts.sql`). That implementation is the human-convenience artifact described above and is **not** the source of truth under the formula-first architecture this variant page now codifies. The Step-2 refactor replaces hardcoded bucket values with formula evaluation parameterized by `game_count`, removing the team-size-specific constraint baked into the prior implementation.
- **The original calibration source:** `docs/BCA_HANDICAP_SYSTEM.md` — describes BCAPL's published Standard Handicap System chart, "Validated from actual league scoring sheet." The 7-bucket table the prior implementation transcribed comes from BCAPL's printed materials for the 8-man / 5v5 format.
- A prior implementation also stored the Chart shape with a 3-column output (`result_1/2/3` interpreted as win/tie/lose), conflating downstream tie-handling into the Chart's storage. The architectural definition above intentionally narrows the Chart's output to the per-side target pair; tie / unresolved-band semantics belong to the [Win Calculator](../win-calculator.md), not the Chart.
- Other prior code pointers: `supabase/migrations/20260410000002_threshold_charts.sql` (table schema + `lookup_threshold()` SQL function).

## modules/threshold-charts/README.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/README.md](modules/threshold-charts/README.md)._


### Source of truth

- `supabase/migrations/20260410000002_threshold_charts.sql` — `threshold_charts` and `threshold_chart_rows` table definitions; the `lookup_threshold()` SQL function that performs the scope-cascade query
- `supabase/migrations/20260410000003_seed_threshold_charts.sql` — global default rows for the currently-shipped Charts
- `supabase/migrations/20260410000004_add_threshold_chart_fk.sql` — `preferences.threshold_chart_id` foreign key
- `supabase/migrations/20260429000004_threshold_charts_rls_production.sql` — row-level security
- Per-Chart code anchors live in each variant page's *Current code state* section
- `src/utils/handicap/fargoGamesWonThresholds.ts` — Fargo formula entry point (formula-shaped Chart, not stored in the SQL tables)

### Inline status & code refs (borderline pass)

- Converter capability: no Converter implementations exist in code yet — the prepackaged Scoring Systems' internal types already line up, so it hasn't been exercised.
- Implementation status: the current codebase couples specific Charts to specific encoding-runners (e.g., the 3v3 Points Chart is hardcoded inside the `bca3v3` SystemModule rather than queried as an independent Chart Module) — implementation artifact; Step-2 lifts Charts out as first-class Modules selected by the league config.
- Cascade store: stored Charts live in the `threshold_charts` table; the schema's `comp_1`/`comp_2` pair supports 2D lookups today.

## modules/threshold-charts/fargo-formula.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/fargo-formula.md](modules/threshold-charts/fargo-formula.md)._


### Current code state

- **Underlying primitive:** `2^(rating/100)` — implemented in two parallel files since the two projections are wired into different runtime paths.
- **Start-points projection** (wired to the FargoRate 10-Point 5-Man Scoring System): `src/systems/fargo5v5.ts` (`computeStartPoints()` function and surrounding `threshold.compute` capability). The `FargoStartPointsResult` type lives in `src/systems/types.ts`.
- **Games-won projection** (scaffolded, not wired to any shipped Scoring System): `src/utils/handicap/fargoGamesWonThresholds.ts`. Forward-looking implementation for an eventual FargoRate + `extra_games` Scoring System.
- **Not in the `threshold_charts` SQL tables.** Formula-shaped Charts live in code, not as rows in the `threshold_charts` table — there's no per-row data to seed. (The cascade-by-scope behavior described in the [Module README](README.md#cascade-behavior) applies to discrete-table Charts; formula-shaped Charts are currently selected by the league configuration but not stored per-scope. An LO who wants per-league formula-parameter overrides would need either parameter columns on `preferences` or a new storage shape — design open.)
- **Architectural note:** the two projections share the T-transform primitive but have different output shapes and different consumer Mechanisms. Per [PRINCIPLES § Module — § 8](../../PRINCIPLES.md#8-io-contracts-at-module-boundaries), distinct output types argue for splitting these into two peer Chart variants in a later iteration. Treating them as one variant here reflects their shared mathematical origin; the split would surface naturally when LO-customization UI distinguishes the two consumer Mechanisms. **Implementation artifact, not architectural intent** — flag for step-2+ review.
- **Reference research:** `docs/research/fargo-games-won-threshold.md`, `docs/research/fargorate-formula.md`.

## modules/threshold-charts/race-percentage.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/race-percentage.md](modules/threshold-charts/race-percentage.md)._


### Current code state

- **Stored Chart:** `chart_type = 'race_percentage'`, `lookup_mode = 'range'`. Default rows seeded in `supabase/migrations/20260410000003_seed_threshold_charts.sql`.
- **Schema:** `threshold_charts` + `threshold_chart_rows` (`comp_1` = gap bracket upper bound, `comp_2` = tier lower bound, `result_1` = higher player race, `result_3` = lower player race, `result_2` = null) in `supabase/migrations/20260410000002_threshold_charts.sql`. The SQL `lookup_threshold()` function performs the cascade and 2D bracket lookup.
- **Algorithm helper:** `calculateRaceLengths()` (or similarly named) helper in `src/utils/handicap/` — generates default rows from `(base, max, min, gap_divisions)` parameters. Shared with [Race Points](race-points.md).
- **Consumer wiring:** not currently wired to a shipped Scoring System (the three shipped Scoring Systems all use team-aggregate Charts). The Chart is scaffolded for future per-pairing race-mode Scoring Systems. **This is expected scaffolding** — the Module exists for the design space, not for the shipped wiring.

## modules/threshold-charts/race-points.md

_Extracted 2026-05-24 from the locked design doc [modules/threshold-charts/race-points.md](modules/threshold-charts/race-points.md)._


### Current code state

- **Stored Chart:** `chart_type = 'race_points'`, `lookup_mode = 'exact'`. Default rows seeded in `supabase/migrations/20260410000003_seed_threshold_charts.sql`. Upper-triangle storage; lookup-side handles the swap when the home/away assignment is reversed.
- **Schema:** `threshold_charts` + `threshold_chart_rows` (`comp_1` = higher player handicap, `comp_2` = lower player handicap, `result_1` = higher player race, `result_3` = lower player race, `result_2` = null) in `supabase/migrations/20260410000002_threshold_charts.sql`. The SQL `lookup_threshold()` function performs the cascade and 2D lookup.
- **Algorithm helper:** `calculateRaceLengths()` (or similarly named) helper in `src/utils/handicap/` — generates the default rows from `(base, max, min)` parameters. Used to seed the chart and (per-LO) to regenerate cells when parameters change.
- **Consumer wiring:** not currently wired to a shipped Scoring System (the three shipped Scoring Systems all use team-aggregate Charts). The Chart is scaffolded for future per-pairing race-mode Scoring Systems. **This is expected scaffolding** — the Module exists for the design space, not for the shipped wiring. Step-2+ work will wire it to a per-pairing race-mode Scoring System when one is built.

## modules/tiebreak-system/README.md

_Extracted 2026-05-24 from the locked design doc [modules/tiebreak-system/README.md](modules/tiebreak-system/README.md)._


### Source of truth

This Module is new — it does not yet exist in code. Implementation will require:

- New preference column(s) describing the LO-configured chain (e.g., `tiebreak_chain JSONB` or a separate `tiebreak_chain_links` table)
- New runtime evaluator that walks the chain when Win Calc fires the trigger, with the terminal human-handoff modal auto-appended at evaluation time
- Per-Mechanism implementations matching the variant pages

Currently the closest existing code is the scattered tiebreaker-firing runtime hooks (`MatchEndVerification`, `computeMatchResult` in `bca3v3.ts`, `ManualTiebreakerDialog.tsx` — legacy of the prior `tiebreaker_format='manual'` preference, before the Tiebreak System refactor). The implementation phase will consolidate these into the Tiebreak System chain evaluator. The auto-appended terminal modal will likely reuse the existing scoring-game confirmation handoff pattern.

## modules/tiebreak-system/coin-flip.md

_Extracted 2026-05-24 from the locked design doc [modules/tiebreak-system/coin-flip.md](modules/tiebreak-system/coin-flip.md)._


### Status

Stub. Not yet implemented. Full design (RNG source, seed persistence for reproducibility, UI surface for the result reveal) is implementation-phase work.

## modules/tiebreak-system/human-pick.md

_Extracted 2026-05-24 from the locked design doc [modules/tiebreak-system/human-pick.md](modules/tiebreak-system/human-pick.md)._


### Status

Stub. Not yet implemented. The existing `src/components/scoring/ManualTiebreakerDialog.tsx` (legacy of the prior `tiebreaker_format='manual'` preference, before the Tiebreak System refactor) may provide reusable UI scaffolding — the new Mechanism targets the teams' scorekeepers rather than the operator. The prior `manual` Mechanism (operator-decides) was deliberately removed during the Tiebreak System slimming pass; we don't want operators doing this work.

## modules/tiebreak-system/mini-match.md

_Extracted 2026-05-24 from the locked design doc [modules/tiebreak-system/mini-match.md](modules/tiebreak-system/mini-match.md)._


### Status

Stub. Not yet implemented. The closest existing code is the hardcoded `bca3v3.ts` tiebreaker logic (games 19-21 for the 3v3 best-of-3) which the implementation pass will replace. Mini Match's implementation will reuse the Pairings Generator's mini-match invocation path and the Threshold Trigger pattern.

## modules/tiebreak-system/roshambo.md

_Extracted 2026-05-24 from the locked design doc [modules/tiebreak-system/roshambo.md](modules/tiebreak-system/roshambo.md)._


### Status

Stub. Not yet implemented. Requires new in-app UI for the simultaneous pick-and-reveal flow. Implementation cost is small because each Mechanism is independent — adding this doesn't touch any other Module.

