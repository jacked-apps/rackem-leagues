---
title: refactor — Move threshold math into the HandicapSystem modules
type: refactor
status: active
date: 2026-06-03
---

# Move Threshold Math Into the HandicapSystem Modules

## Overview

Threshold computation for a match (the `*_to_win/tie/lose` payload) lives in
an inline switch in `src/hooks/lineup/useMatchPreparation.ts:219-309`. It
branches on `handicap_type` × `mechanism` × `winCondition` to pick one of
three shapes:

- **Fargo + points-mode:** read pre-negotiated `*_to_tie` from the matches
  row, set win/lose to null.
- **Fargo + games-won:** call `computeFargoGamesWonThresholds(...)` against
  team-aggregate ratings.
- **Everything else (Points / Percentage):** call
  `calculateHandicapThresholds(...)` which sums lineup handicaps, applies a
  team-bonus rule (Points only), and looks up the trio.

This refactor moves all three shapes into per-system methods on the
HandicapSystem module so callers stop branching. Math stays identical;
dispatch moves into the module layer.

## Goal

A caller building a match's threshold payload does this:

```
const system = getHandicapSystem(handicapType);
const payload = await system.buildMatchThresholds({ myLineup, opponentLineup, matchData, prefs });
```

No `if (handicap_type === ...)` in the caller. Adding a future system
(BCAPL SL, APA Equalizer) is one new file implementing the method — zero
caller edits.

## Non-Goals

- **Swap-recalc cleanup** (`src/api/mutations/matchLineups.ts:424`). Same
  family of leak but on a paused branch (`feat/lineup-swap-recalibration`).
  Returns when swap resumes.
- **Per-player handicap calc** (`src/utils/calculatePlayerHandicap.ts`).
  Different concern (history → rating, not lineup → thresholds). Its own
  future branch.
- **UI cells** (`HandicapCell.tsx`, `useHandicapCalculations.ts`). UI
  branching on system identity for input shapes / display. Lower stakes.
- **Other modular cleanups** flagged by the audit. Each gets its own
  scoped branch.

## Approach

Extend the `HandicapSystem` interface with one new method:

```
buildMatchThresholds(inputs: BuildMatchThresholdsInputs): Promise<ThresholdPayload>
```

Each of the four systems (Points, Percentage, FargoRate, SkillLevel)
implements it. FargoRate handles the games-won vs. start-points fork
internally — that's a Fargo-specific concern, so it belongs in the Fargo
module, not in the caller.

The existing per-system math (`calculateHandicapThresholds`,
`computeFargoGamesWonThresholds`, plus the start-points read) moves into
the corresponding module's implementation. Old helper files either become
private to the module or get deleted.

## Implementation Units

- [ ] **Unit 1: Extend the HandicapSystem interface**

**Files:**
- Modify: `src/systems/handicap-systems/types.ts` — add
  `buildMatchThresholds` method + the inputs/output types
- Test: `src/systems/handicap-systems/__tests__/types.test.ts` (light
  type-level test if useful)

**Approach:** Define `BuildMatchThresholdsInputs` (myLineup,
opponentLineup, matchData, prefs) and `ThresholdPayload` (the
home/away_to_win/tie/lose shape useMatchPreparation already builds).
Method is async because Points needs a DB read for team bonus.

**Verification:** TypeScript compiles. No runtime behavior yet — the
method exists on the interface but each system still throws "not
implemented" until Unit 2.

---

- [ ] **Unit 2: Implement `buildMatchThresholds` per system**

**Files:**
- Modify: `src/systems/handicap-systems/points.ts` — implement using
  the points/percentage chart path
- Modify: `src/systems/handicap-systems/percentage.ts` — same shape,
  different chart
- Modify: `src/systems/handicap-systems/fargorate.ts` — internal fork
  on `winCondition` for points-mode vs games-won
- Modify: `src/systems/handicap-systems/skill-level.ts` — stub (throws
  or returns nulls; the system is reserved and not yet wired)
- Test: `src/systems/handicap-systems/__tests__/buildMatchThresholds.test.ts`

**Approach:** Each implementation moves the relevant math out of
useMatchPreparation. Points imports the team-bonus helper internally
(no longer at the call site). Percentage uses the same chart path
without team bonus. Fargo's implementation reads `winCondition` and
dispatches between the two shapes within the module — same switch as
today, but it lives inside the Fargo system, not in the caller.

**Patterns to follow:**
- Existing `getGamesNeeded` modular path
  (`src/utils/handicap/index.ts`) for the "ask the module, not the
  caller" shape.

**Test scenarios:**
- Happy path for each system: 3v3 Points BCA, 5v5 Percentage BCA, 5v5
  Fargo points-mode, 5v5 Fargo games-won, all-zeros for SkillLevel
  stub
- Edge: empty lineups → defined fallback
- Edge: Fargo without confirmed start-points → defined behavior
- Characterization: byte-identical output to the current inline
  switch for every supported configuration

---

- [ ] **Unit 3: Rewire `useMatchPreparation` to call the module**

**Files:**
- Modify: `src/hooks/lineup/useMatchPreparation.ts:219-309` — replace
  the switch with a single `system.buildMatchThresholds(...)` call
- Test: `src/hooks/lineup/__tests__/useMatchPreparation.test.ts` (or
  whatever exists) — verify the inline switch is gone

**Approach:** Resolve the HandicapSystem from `handicapType`, build
the inputs, await `buildMatchThresholds`, write the result into
`thresholdPayload`. Delete the three branches and the helpers they
called from this file.

**Verification:** Grep `useMatchPreparation.ts` for `'fargo'`,
`'points'`, `'percentage'`, `isFargoStartPoints`, `isFargoGamesWon` —
zero hits.

---

- [ ] **Unit 4: Clean up dead helpers**

**Files:**
- Delete or privatize: `src/utils/calculateHandicapThresholds.ts` —
  contents move into Points/Percentage module implementations
- Delete or privatize: `src/utils/getTeamHandicapBonus.ts` — used only
  by the points module after Unit 2
- Keep: `src/utils/handicap/fargoGamesWonThresholds.ts` — pure math
  utility, used by the Fargo module; keep but no longer system-aware

**Verification:** No file in `src/` outside `src/systems/handicap-systems/`
contains a switch keyed on `handicap_type` for threshold purposes.
TODO list of remaining leaks (calculatePlayerHandicap, HandicapCell,
etc.) survives untouched — flagged as separate-branch work.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Characterization output drift in a corner config | Unit 2 tests assert byte-identical output for every (handicap_type × mechanism × winCondition × lineup_size) combo before Unit 3 lands |
| Team-bonus DB read inside Points module creates a perf surprise | The same read happens today inside `calculateHandicapThresholds`; the call moves but the round-trip count is unchanged |
| SkillLevel stub throws and someone tries to use SkillLevel | The system is documented "reserved" today; stub matches the current behavior of "would crash anyway" — improvement is not in scope here |
| Paused swap branch's recalc bug still ships when swap resumes | When swap resumes, that branch's recalc gets rewritten to call `system.buildMatchThresholds` — at which point the same fix lands automatically |

## Success Criteria

- Zero literal `'fargo'` / `'points'` / `'percentage'` / `'skill_level'`
  strings in `useMatchPreparation.ts` outside of comments.
- Characterization test suite passes for all four systems × all supported
  mechanisms × all supported win conditions.
- Adding a new handicap system in a hypothetical follow-up requires only
  a new module file + a one-line registry edit — no caller changes (this
  is the modularity bar Ed asked for).

## Sources & References

- Audit findings (this session): module audit + consumer audit dated
  2026-06-03.
- Modular framework reference: `src/systems/handicap-systems/` Phase A-D
  extraction plan (interface already in place; this branch is the
  "Phase B for threshold math" piece).
- Existing modular precedent: `src/utils/handicap/index.ts` —
  `getGamesNeeded` already routes through SystemModule cleanly.
