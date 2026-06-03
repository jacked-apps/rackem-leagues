---
title: refactor — Threshold math composes through HandicapMechanism
type: refactor
status: active
date: 2026-06-03
revised: 2026-06-03 (document review pivot — see Decisions)
---

# Threshold Math Composes Through HandicapMechanism

## Overview

The match-prep threshold payload (the `*_to_win/tie/lose` JSONB written
to the matches row) is built today by an inline switch in
`src/hooks/lineup/useMatchPreparation.ts:219-309` keyed on
`handicap_type × mechanism × winCondition`. That switch is the leak —
operation-level code branching on system identity.

The fix is a free-function orchestrator that **composes through the
existing `systemModule.handicapMechanism` registry** to do the dispatch.
The caller becomes a single function call with no inline branching on
system identity.

## Problem Frame

The original draft of this plan put the dispatch as a new method on the
`HandicapSystem` interface. Document review caught that as wrong:

- `HandicapSystem` (per the locked doc at
  `docs/league-system/modules/handicap-systems/README.md`) is
  per-player strength encoding: validate, displayFormat,
  computeFromHistory.
- The new threshold-payload dispatch is per-match, per-mechanism — it
  takes both lineups + match state + prefs. That's exactly what the
  locked `HandicapMechanism` doc is for: "the in-match application of a
  strength difference."
- The precedent the original plan cited —
  `src/utils/handicap/index.ts:31` `getGamesNeeded` — already composes
  through `systemModule.handicapMechanism`. The pivoted plan follows
  that pattern instead of inventing a new one.

## Key Decisions

- **Decision:** Dispatch lives on `HandicapMechanism`, not
  `HandicapSystem`. Rationale: matches the locked module-boundary
  docs; respects the existing `getGamesNeeded` precedent;
  start-points-vs-games-won is a mechanism distinction (not a
  handicap-type one).
- **Decision:** The caller-facing entry is a **free function**
  `buildMatchThresholdPayload(systemModule, inputs)` in
  `src/utils/match/`. Rationale: keeps the per-mechanism `compute`
  signatures pure (each returns its native shape), with a single
  orchestrator that translates each mechanism's output into the unified
  match-row payload.
- **Decision:** Inputs use explicit `homeLineup` / `awayLineup` keys,
  not `myLineup` / `opponentLineup`. Rationale: document review found
  the today-code accidentally relies on a caller-side `isHomeTeam`
  gate at one of three branches; using home/away explicitly makes the
  orchestrator usable by any caller (including the future swap path)
  without re-inventing the convention.
- **Decision:** `shouldUseTeamBonus` (currently exported from
  `calculateHandicapThresholds.ts` and consumed by `MatchLineup.tsx`)
  gets a new home before Unit 4 deletes its container. New home:
  a small capability flag on the Points module (e.g., a
  `usesTeamBonus: true` field on `pointsHandicapSystem`), which is a
  legitimate per-system metadata addition (similar to the existing
  `requiresManualEntry`).
- **Decision:** "Byte-identical" is verified by **call-shape
  equivalence** to the existing math primitives (
  `getTeamHandicapBonus`, `computeFargoGamesWonThresholds`, chart
  lookups) plus a handful of golden outputs per axis. Document review
  flagged the original "byte-identical for every combo" framing as
  rhetorical — the team-bonus DB read varies by season state and
  can't be brute-force enumerated.

## Goal

A caller building a match's threshold payload does this:

```
const payload = await buildMatchThresholdPayload(systemModule, {
  homeLineup, awayLineup, matchData, prefs,
});
```

No `if (handicap_type === ...)` in the caller. Future systems plug in
by implementing the appropriate `HandicapMechanism` variant (`compute`
method, already defined). The orchestrator's switch on `mechanism.kind`
stays — but that switch dispatches on a genuine shape difference (each
mechanism's `compute` has a different signature), not on system
identity. That's the legitimate place for the switch per the locked
docs.

## Non-Goals

- **Swap-recalc cleanup** (`src/api/mutations/matchLineups.ts:424`).
  Paused branch (`feat/lineup-swap-recalibration`). Will adopt the new
  orchestrator when swap resumes.
- **Per-player handicap calc** (`src/utils/calculatePlayerHandicap.ts`).
  Different concern (history → rating). Own future branch.
- **UI cell branching** (`HandicapCell.tsx`,
  `useHandicapCalculations.ts`). UI input-shape per system. Lower
  stakes; own future branch.

### Open question — Fargo games-won as a new mechanism kind?

Today's `computeFargoGamesWonThresholds` is not wrapped in any
`HandicapMechanism`. It computes per-team thresholds from
team-aggregate ratings + totalGames. Two options:

- **Option A (in scope):** Add a new mechanism kind (e.g.,
  `team_rating_threshold`) for Fargo games-won. The orchestrator's
  switch then gains that case, but the formula moves into the
  mechanism module. Fully modular.
- **Option B (deferred):** Keep `computeFargoGamesWonThresholds` as a
  freestanding utility called from the orchestrator's Fargo branch.
  Honest intermediate state; flag for future extraction.

This is a planning-time call. Default to **Option B** for branch size;
flag in the plan summary so the reviewer (Ed) can flip it before
implementation.

## Implementation Units

- [ ] **Unit 1: Build the orchestrator + add `usesTeamBonus` capability**

**Goal:** New free function
`buildMatchThresholdPayload(systemModule, inputs)` that composes
through `systemModule.handicapMechanism`. Add `usesTeamBonus` flag to
HandicapSystem so the team-bonus path doesn't need to read a literal
handicap_type string from anywhere.

**Files:**
- Create: `src/utils/match/buildMatchThresholdPayload.ts`
- Create: `src/utils/match/__tests__/buildMatchThresholdPayload.test.ts`
- Modify: `src/systems/handicap-systems/types.ts` — add
  `usesTeamBonus: boolean` to the interface
- Modify: `src/systems/handicap-systems/points.ts` — set
  `usesTeamBonus: true`
- Modify: `src/systems/handicap-systems/percentage.ts`,
  `fargorate.ts`, `skill-level.ts` — set `usesTeamBonus: false`

**Approach:**
- The orchestrator switches on `mechanism.kind`:
  - `extra_games` → if `systemModule.handicapSystem.usesTeamBonus`,
    fetch team bonus via existing helper; sum lineup handicaps + bonus;
    diff → `mechanism.compute(diff, overrides)` per side; combine.
  - `start_points` → for Fargo points-mode: read
    `matchData.home_to_tie`/`away_to_tie` (the negotiated values) and
    build a payload of `{*_to_win: null, *_to_tie: <value>, *_to_lose:
    null}`. For Option B (Fargo games-won), call
    `computeFargoGamesWonThresholds` inline.
  - `race_length_adjustment` → RESERVED stub; throws or returns nulls
    matching today's "this mechanism not in any shipping league yet"
    behavior.
- Returns a `ThresholdPayload` (the six-field shape the matches row
  expects).
- The function is async because the team-bonus path issues a DB read.
- DB-reading helper (`getTeamHandicapBonus`) imported directly inside
  the orchestrator — same call shape as today, just relocated.

**Patterns to follow:**
- `src/utils/handicap/index.ts:31` `getGamesNeeded` — the canonical
  precedent: free function, switches on `handicapMechanism.kind`,
  delegates to mechanism's `compute`.

**Test scenarios:**
- Happy path × each mechanism kind:
  - Points 3v3, even handicap totals → matches today's chart output
  - Percentage 5v5, mixed totals → matches today's chart output
  - Fargo points-mode with confirmed `*_to_tie` values → preserves
    them; sets win/lose to null
  - Fargo games-won (Option B) → matches
    `computeFargoGamesWonThresholds` output for the same lineups
- Call-shape equivalence: orchestrator calls
  `getTeamHandicapBonus(homeTeamId, awayTeamId, seasonId,
  handicapType)` for the Points path, verified via
  `toHaveBeenCalledWith`
- Edge: empty lineups → defined per-mechanism behavior:
  - Points all-zero → Points chart at diff=0 (the even-match trio)
  - Percentage all-zero → Percentage chart at diff=0
  - Fargo points-mode with null `*_to_tie` → returns all nulls
- Edge: SkillLevel league (handicap_type='skill_level') → today this
  doesn't reach prep_match because it's reserved; the orchestrator
  surfaces a clear error so a future contributor knows where to add it
- Per-system flag check: `pointsHandicapSystem.usesTeamBonus === true`,
  all others false

**Verification:**
- All tests pass.
- The Points-path branch of the orchestrator reads only
  `systemModule.handicapSystem.usesTeamBonus`, not any literal
  `'points'` string.

---

- [ ] **Unit 2: Rewire `useMatchPreparation` to use the orchestrator**

**Goal:** Replace the inline switch in
`useMatchPreparation.ts:219-309` with a single
`buildMatchThresholdPayload(...)` call.

**Files:**
- Modify: `src/hooks/lineup/useMatchPreparation.ts`
- Test: characterization test asserting the prep flow's
  `thresholdPayload` matches today's value for every supported
  configuration

**Approach:**
- Build the `homeLineup`/`awayLineup` (caller does the
  `isHomeTeam ? myLineup : opponentLineup` swap once, before the
  orchestrator call).
- Call `buildMatchThresholdPayload(systemModule, { homeLineup,
  awayLineup, matchData, prefs })`.
- Delete the three branches and the local `isFargoStartPoints` /
  `isFargoGamesWon` booleans.

**Verification:**
- Grep `useMatchPreparation.ts` for `'fargo'`, `'points'`,
  `'percentage'`, `isFargoStartPoints`, `isFargoGamesWon` — zero hits
  in code (comments still allowed per the locked-doc style).
- Characterization test (golden output per axis combo) passes.

---

- [ ] **Unit 3: Relocate `shouldUseTeamBonus` and prep MatchLineup.tsx**

**Goal:** Move the team-bonus-applies decision off of
`calculateHandicapThresholds.ts` (which Unit 4 will delete) and onto
the Points system module (`usesTeamBonus` flag from Unit 1).

**Files:**
- Modify: `src/player/MatchLineup.tsx` — replace
  `shouldUseTeamBonus(handicapType)` call with
  `systemModule.handicapSystem.usesTeamBonus`

**Approach:** The call site already has `handicapType` in scope; it
needs the resolved `systemModule` instead. If `systemModule` isn't
already available there, plumb it from the parent (it's loaded by
the same prefs hook the rest of the lineup page uses).

**Verification:**
- No remaining importer of `shouldUseTeamBonus` outside the file Unit 4
  deletes.

---

- [ ] **Unit 4: Delete dead helpers**

**Goal:** Remove the now-unused legacy utilities.

**Files:**
- Delete: `src/utils/calculateHandicapThresholds.ts`
- Delete: `src/utils/getTeamHandicapBonus.ts` (its sole remaining
  consumer is the orchestrator from Unit 1; move into the orchestrator
  file or keep as a small utility — implementation pick)
- Verify: nothing in `src/` outside `src/systems/` and the orchestrator
  contains a switch keyed on `handicap_type` for threshold purposes
  (stale comment in `engineRunningTotals.ts:126` referencing
  `calculateHandicapThresholds` gets updated as part of this unit)

**Verification:**
- TypeScript compiles with no remaining importers.
- Grep against the audit's enumerated dirty files shows the threshold
  family is now clean.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| The orchestrator's switch on `mechanism.kind` is just the inline switch relocated | True — and that's correct. Switching on mechanism is dispatching on real shape differences (different `compute` signatures), not on system identity. The locked-doc-correct location for the switch. |
| Plumbing `systemModule` into `MatchLineup.tsx` causes unintended re-render churn | The component already consumes resolved league prefs; `systemModule` is built from the same source — same render dependency, no new subscriptions |
| Fargo games-won deferred (Option B) means one branch of the orchestrator stays inline | Honest intermediate state; flagged in plan as future extraction. The orchestrator's Fargo branch still removes the `handicap_type === 'fargo'` check from the caller (useMatchPreparation); the inline `computeFargoGamesWonThresholds` call moves into the orchestrator's `start_points` case |
| Characterization tests can't enumerate the full input space | Replaced "byte-identical for every combo" success criterion with "call-shape equivalence to underlying primitives + per-axis golden outputs." Provable and tractable. |
| Swap-recalc path defers; when it resumes it needs to call the new orchestrator | Today's swap-recalc heuristic at `matchLineups.ts:424` was already going to be rewritten when swap resumes; this refactor's orchestrator is the rewrite target. No new dependency. |

## Success Criteria

- Zero literal `'fargo'` / `'points'` / `'percentage'` / `'skill_level'`
  strings in `useMatchPreparation.ts` outside comments — that's the
  caller staying clean.
- Adding a new handicap system requires only a new module file + one
  registry edit + (if it needs a different mechanism) a new mechanism
  variant. **Zero edits to the orchestrator** for systems that fit an
  existing mechanism kind. For systems that need a new mechanism kind,
  the orchestrator gains one switch case — that's the legitimate
  extension point per the locked docs.
- The orchestrator never reads a literal handicap-type string; it asks
  `systemModule.handicapSystem.usesTeamBonus` and
  `systemModule.handicapMechanism.kind`.
- Existing characterization tests for `calculateHandicapThresholds`
  pass against the new orchestrator path (run them through the new
  call site).

## Sources & References

- Audit findings (this session, 2026-06-03): module audit + consumer
  audit.
- Document review (this session, 2026-06-03): six findings, key pivot
  was the wrong-module placement.
- Locked architecture docs:
  - `docs/league-system/modules/handicap-systems/README.md` — defines
    HandicapSystem as encoding-only.
  - `docs/league-system/modules/handicap-mechanisms/README.md` —
    defines Mechanism as in-match application; the correct home.
- Precedent: `src/utils/handicap/index.ts:31` `getGamesNeeded` — the
  same orchestrator pattern, already shipped.
