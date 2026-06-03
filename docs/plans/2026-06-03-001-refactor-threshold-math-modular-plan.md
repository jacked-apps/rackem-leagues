---
title: refactor — Threshold math via per-system compositions of registered operations
type: refactor
status: active
date: 2026-06-03
revised: 2026-06-03 (second pivot — see Decisions)
---

# Threshold Math via Per-System Compositions of Registered Operations

## Overview

The match-prep threshold payload (`home_to_win/tie/lose` etc. written to
the matches row) is built today by an inline switch in
`src/hooks/lineup/useMatchPreparation.ts:219-309` keyed on
`handicap_type × mechanism × winCondition`.

This refactor removes that switch by leveraging the **existing
ThresholdOperation registry pattern** the codebase already uses for
points-system scoring. Each system module declares a composition
listing which operations produce its prep-time thresholds. The runtime
resolves and runs them. Zero branching on system identity.

## Problem Frame

Two prior drafts of this plan got rejected by review:

1. First draft placed dispatch on `HandicapSystem` — wrong module per
   locked docs (HandicapSystem is per-player encoding).
2. Second draft moved dispatch to a free-function orchestrator with a
   switch on `mechanism.kind` — still over-complicated. The switch
   approach also breaks down for Fargo (both Fargo modes have
   `mechanism.kind === 'start_points'`).

The principle Ed taught me through three corrections:

> **Runtime is dumb and trusting.** Read the system's declared
> composition (a list of operations to run), run them, log silently on
> failure. The Workshop is the only place that validates "do these
> modules fit together?" and inserts adapters. Runtime never peeks,
> never switches on system identity, never validates module fit.

The codebase already implements this for points-system scoring. Same
pattern, applied to prep-time threshold writes.

## Key Decisions

- **Decision:** Each system module declares its prep-time threshold
  composition as an array of `ThresholdRow` (operationKind +
  operationArgs). Rationale: data-driven; the workshop will eventually
  edit these declarations; runtime never branches.
- **Decision:** The orchestrator is a tiny iterator that calls
  `resolveThreshold(row, inputs)` (which already exists at
  `src/systems/points-system/threshold-resolver.ts:67`) for each row in
  the composition, then maps named outputs to the matches row column
  shape. Total orchestrator size: ~30 lines, no conditionals.
- **Decision:** **Never throws.** Each row's `resolveThreshold` call
  is wrapped in a try/catch that logs the failure and sets that row's
  value to null. A failed row produces a null in the matches row column
  (which is the existing schema default) — scoring still works,
  someone investigates later. Honors Ed's hard rule.
- **Decision:** Missing operations get built as registered modules. The
  registry already has `chart_lookup_3v3` and `fargo_start_points_for_side`.
  We need to add: `chart_lookup_5v5_percentage` (BCA 5v5),
  `fargo_games_won_per_side` (Fargo games-won), and a `team_bonus_adjustment`
  operation (BCA Points 3v3 currently bakes team bonus into a separate
  helper). Each new operation is its own file, self-registers, single
  purpose.
- **Decision:** Inputs the orchestrator passes to operations are the
  existing `ThresholdInputs` shape — already defined at
  `src/systems/points-system/types.ts`. No new types needed.
- **Decision:** `shouldUseTeamBonus` and `getTeamHandicapBonus` get
  absorbed into the new `team_bonus_adjustment` operation. The
  Points 3v3 composition declares this operation in its row list;
  other systems just don't include it. The `handicapType === 'points'`
  check disappears — it's replaced by "is this operation in the
  composition?" Workshop owns deciding whether a system uses team
  bonuses.
- **Decision:** `MatchLineup.tsx`'s use of `shouldUseTeamBonus` for UI
  gating gets handled inline (`handicapType === 'points'` for now) and
  flagged as future cleanup — UI branching is its own concern (Non-Goal).

## Goal

A caller building a match's threshold payload does this:

```
const payload = await composeMatchThresholds(systemModule, inputs);
```

The orchestrator iterates `systemModule.matchPrepThresholds` (the
declared composition), resolves each row via the existing resolver,
catches any failures, maps named values to column shape, returns.

Zero `if (handicap_type === ...)` anywhere. Adding a new system: write
its operations, register them, declare its composition. Workshop wires
it up. Runtime trusts and runs.

## Non-Goals

- **Workshop UI** for editing compositions. Future feature.
- **Swap-recalc cleanup** (`feat/lineup-swap-recalibration` paused).
  Will use the new orchestrator when it resumes.
- **Per-player handicap calc** (`src/utils/calculatePlayerHandicap.ts`).
  Different concern; future branch.
- **UI cell branching** (`HandicapCell.tsx`,
  `useHandicapCalculations.ts`). Same per-system display gating that
  also exists in `MatchLineup.tsx`; future "UI modularity" branch.
- **Adapter modules.** The locked-doc concept of "adapter inserted by
  workshop when modules don't fit" is forward-looking. No adapters get
  built in this branch.

## Implementation Units

- [ ] **Unit 1: Build the missing operations**

**Goal:** Three new ThresholdOperation modules, each self-registering,
each does ONE thing.

**Files:**
- Create: `src/systems/points-system/operations/chart-lookup-5v5-percentage.ts`
- Create: `src/systems/points-system/operations/fargo-games-won-per-side.ts`
- Create: `src/systems/points-system/operations/team-bonus-adjustment.ts`
- Test: co-located characterization tests per operation that match the
  current helpers' output (e.g., `team-bonus-adjustment.test.ts`
  produces the same value `getTeamHandicapBonus` returns for the same
  inputs)

**Approach:**
- Each operation declares its `consumesHandicapType`, `consumesSize`,
  `producesOutputType`, etc., per the existing `ThresholdOperation`
  contract.
- `team_bonus_adjustment` calls today's `getTeamHandicapBonus` helper
  internally (same DB read; just relocated). On DB error: returns 0
  (matches today's catch behavior).
- `fargo_games_won_per_side` wraps today's
  `computeFargoGamesWonThresholds` math.
- `chart_lookup_5v5_percentage` mirrors `chart_lookup_3v3`'s shape but
  with the 5v5 percentage chart.

**Patterns to follow:**
- `src/systems/points-system/operations/chart-lookup-3v3.ts` —
  canonical example
- `src/systems/points-system/operations/fargo-start-points-for-side.ts`
  — for Fargo-shaped inputs

**Test scenarios:**
- Each operation: happy path with realistic inputs → expected output
- Each operation: edge case (empty/null inputs) → defined behavior
- `team_bonus_adjustment`: DB error from `getTeamHandicapBonus` →
  returns 0, logs warning (matches today)

**Verification:**
- Each new operation appears in the registry after import.
- Per-operation tests pass.

---

- [ ] **Unit 2: Declare prep-time compositions on each system module**

**Goal:** Each shipping system module (BCA 3v3, BCA 5v5, Fargo
points-mode, Fargo games-won) declares its
`matchPrepThresholds: ThresholdRow[]` — the list of named rows the
runtime resolves to fill the matches row columns.

**Files:**
- Modify: `src/systems/bca3v3.ts` — add `matchPrepThresholds` field
  with rows for `home_to_win`, `home_to_tie`, `home_to_lose`,
  `away_to_win`, `away_to_tie`, `away_to_lose` using
  `chart_lookup_3v3` (plus `team_bonus_adjustment` rows on the
  appropriate sides)
- Modify: `src/systems/bca5v5.ts` — same shape using
  `chart_lookup_5v5_percentage`
- Modify: `src/systems/fargo5v5.ts` — declare BOTH composition variants
  (points-mode uses `fargo_start_points_for_side`; games-won uses
  `fargo_games_won_per_side`). Per-system Fargo will need to decide at
  composition-build time which variant applies based on
  `winCondition` — that decision lives on the system module (a
  workshop-config concern), NOT in the orchestrator
- Modify: `src/systems/buildSystemFromPreferences.ts` —
  ad-hoc-resolved systems build compositions the same way as the
  shipping presets

**Approach:**
- Use the existing `buildThresholdRow` helper at
  `src/systems/points-system/threshold-resolver.ts:91` — copies
  operation metadata onto the row, validates at build time.
- A composition for a 6-field payload has 6 rows (one per column).
  Fargo points-mode: 2 rows (only `home_to_tie` and `away_to_tie`
  populated; others omitted from composition → null in the payload).
- The `handicap_type='none'` case: empty composition → all-null
  payload, which matches today's behavior.

**Patterns to follow:**
- `src/systems/points-system/compositions/points-3-man.ts:91-127` —
  the canonical composition shape

**Test scenarios:**
- Each system's composition validates at build time
  (`validatePointsSystem` or equivalent — adapt the existing validator
  if needed)
- The declared rows reference operations that are actually registered

**Verification:**
- Each system module exports a `matchPrepThresholds` array
- No system module imports `getTeamHandicapBonus` or any
  threshold-math helper directly — only operation references

---

- [ ] **Unit 3: Tiny composeMatchThresholds orchestrator**

**Goal:** A small function that takes a system module + runtime inputs,
iterates the system's prep-time composition, resolves each row, maps
named outputs to the matches row column shape. Never throws.

**Files:**
- Create: `src/utils/handicap/composeMatchThresholds.ts` (located
  alongside `getGamesNeeded`, the existing modular-routing utility)
- Test: `src/utils/handicap/__tests__/composeMatchThresholds.test.ts`

**Approach:**
- Inputs: `systemModule: SystemModule`, `inputs: ThresholdInputs`
- For each row in `systemModule.matchPrepThresholds`:
  - try { result[row.name] = await resolveThreshold(row, inputs) }
  - catch (err) { log via console.warn with row name + error; set
    result[row.name] = null }
- Map `result.home_to_win` → `payload.home_to_win`, etc. Rows not in
  the composition default to null (today's behavior for omitted
  fields).
- Return payload.
- ~30 lines total. No conditionals on system identity.

**Patterns to follow:**
- `src/utils/handicap/index.ts:31` `getGamesNeeded` — the same
  thin-routing-utility pattern, just slightly more iteration.

**Test scenarios:**
- Happy path × each shipping system: composition runs, payload matches
  today's inline switch output for the same inputs
- "Never throws" verification: an operation that throws produces a
  null for that row in the payload + a console.warn, NOT a thrown
  error from the orchestrator
- Empty composition (`handicap_type='none'`) → all-null payload
- One row throws, others succeed → that one is null, others have
  their values

**Verification:**
- All tests pass.
- Orchestrator file contains zero literal `'fargo'` / `'points'` /
  `'percentage'` / `'skill_level'` strings (verified by file grep).

---

- [ ] **Unit 4: Rewire `useMatchPreparation` to call the orchestrator**

**Goal:** Replace the 90-line switch with a single
`await composeMatchThresholds(systemModule, inputs)` call.

**Files:**
- Modify: `src/hooks/lineup/useMatchPreparation.ts:219-309`
- Test: characterization test (run real preset configs through the
  prep flow; assert the `thresholdPayload` matches today's inline
  output)

**Approach:**
- Build the `inputs` object once from the existing hook state (lineup
  ratings, matchData, prefs).
- Call the orchestrator. Use its returned payload directly.
- Delete the three branches, the local discriminator booleans, the
  helper-function imports.

**Verification:**
- Grep `useMatchPreparation.ts` for literal handicap-type strings →
  zero hits in code (comments allowed per existing style).
- Characterization test confirms identical output for all shipping
  preset configurations.

---

- [ ] **Unit 5: Delete dead helpers**

**Goal:** Remove the now-unused legacy code.

**Files:**
- Delete: `src/utils/calculateHandicapThresholds.ts`
- Delete: `src/utils/getTeamHandicapBonus.ts` (its sole caller is now
  the `team_bonus_adjustment` operation, which can either inline the
  body or keep the import — implementer pick)
- Delete: `src/utils/handicap/fargoGamesWonThresholds.ts` (body moves
  into the `fargo_games_won_per_side` operation, OR kept as a pure
  helper imported by that operation — implementer pick)
- Modify: `src/player/MatchLineup.tsx:64,244` — replace
  `shouldUseTeamBonus(handicapType)` with inline
  `handicapType === 'points'`. Flag in PR description that UI-side
  branching cleanup is its own future branch.

**Verification:**
- TypeScript compiles with no remaining importers of deleted files.
- The UI gate in MatchLineup.tsx still renders the team-bonus chunk
  for BCA 3v3 leagues, exactly as today.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A new operation produces different output than the legacy helper it replaces | Per-operation characterization tests in Unit 1 assert byte-equivalence against the existing helpers' outputs for the same inputs, before Unit 4 rewires anything |
| An operation throws at runtime (DB error, bad math, missing input) | Orchestrator's per-row try/catch logs and sets that row to null; scoring continues with null thresholds (today's schema default). Honors the "never break scoring" hard rule. |
| Fargo system needs two compositions (points-mode vs games-won) | The system module decides at composition-build time, NOT the orchestrator. The decision is encoded in `buildSystemFromPreferences` based on `winCondition`. Future workshop UI is where users would tweak this. |
| `MatchLineup.tsx`'s inline `handicapType === 'points'` survives as a UI leak | Acknowledged; explicit Non-Goal and PR description note. UI-side modular cleanup is its own future branch. |
| Adding the new operations + compositions is more code than the original "free function with switch" plan | Yes, but per Ed: simpler in the DURABLE way. Each module is small, single-purpose, registered. Adding a new system later is one file + one composition declaration. Zero edits to the orchestrator. |

## Success Criteria

- The orchestrator file contains zero literal handicap-type strings.
- `useMatchPreparation.ts` contains zero literal handicap-type strings
  (in code).
- Each shipping system has a working `matchPrepThresholds` composition.
- The new operations are registered and discoverable via the registry.
- Characterization tests pass: today's threshold output for every
  preset config equals tomorrow's output.
- The orchestrator never throws — verified by a test that feeds it a
  composition with an intentionally-throwing operation and asserts the
  failed row produces null without an uncaught exception.

## Sources & References

- Existing pattern reference:
  `src/systems/points-system/compositions/points-3-man.ts` —
  data-driven composition of registered operations.
- Existing resolver:
  `src/systems/points-system/threshold-resolver.ts:67` —
  `resolveThreshold(row, inputs)`.
- Existing operations:
  `src/systems/points-system/operations/chart-lookup-3v3.ts`,
  `fargo-start-points-for-side.ts`.
- Modular-routing precedent: `src/utils/handicap/index.ts:31`
  `getGamesNeeded`.
- Architectural principles in memory:
  `feedback_runtime_trusts_workshop_validates.md`,
  `feedback_respect_locked_docs.md`,
  `feedback_match_ops_system_agnostic.md`.
