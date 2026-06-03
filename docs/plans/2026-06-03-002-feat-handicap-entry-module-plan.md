---
title: feat — Handicap-entry module (UI peeks the lineup-side at system identity → asks the module instead)
type: feat
status: active
date: 2026-06-03
origin: docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md
---

# Handicap-Entry Module

## Overview

First Phase-1 module from the UI modularity audit. Replaces ~14 of 18
lineup-side peeks at `handicap_type` with calls into a per-system
`HandicapEntryModule`. The lineup UI stops asking "what kind of system
is this?" and starts asking "module, what input should I render?"

Locks in Ed's reframing: **Fargo today = manual-entry module with dials
set to {min:100, max:1000, integer, source:'manual'}.** When the
FargoRate API lands, source flips to `'api'` and an adapter wires in —
same module, different dials. Same shape also serves as the fallback
for LOs with unrecognized systems (letter-grade scales, custom enums).

## Problem Frame

`HandicapCell.tsx` alone has 6 peeks on `handicap_type` to decide:
input widget type (select vs number), min/max bounds, placeholder
text, display format. `MatchLineup.tsx` has 6 more (column width,
"Fargo" vs "H/C" header, manual rating widget gate, banners). The
lineup-side hooks (`useHandicapCalculations`, `useLineupValidation`)
branch on Fargo for manual rating overrides and validation rules.

Per CLAUDE.md principle 5: runtime trusts; Workshop validates.
The lineup UI is runtime — it should ask the system, not branch.

## Key Decisions

- **Decision:** Add a `handicapEntry: HandicapEntryModule` field to
  the existing `HandicapSystem` interface in
  `src/systems/handicap-systems/types.ts`. Rationale: that's where
  per-system input/display concerns belong (the existing
  `displayFormat`, `validate`, `requiresManualEntry` fields already
  live there). This extends those, doesn't compete with them.
- **Decision:** The module exposes data, not React components. Dial
  fields: `inputKind`, `range` or `enum`, `displayFormat`,
  `placeholderText`, `columnHeader`, `source`. The UI components
  read these and render their own JSX. Workshop will eventually edit
  the dials.
- **Decision:** `Fargo` and `Manual` are the same module shape. Fargo
  preset = manual module configured with Fargo dials. The future
  API-backed Fargo is the same module with source flipped to `'api'`
  + an adapter. No separate Fargo-specific module type.
- **Decision:** `inputKind: 'select'` for Points (the -2..+2 enum);
  `inputKind: 'number'` for Percentage and Fargo. Future systems
  declare their own shape.
- **Decision:** This refactor doesn't touch the Fargo
  start-points negotiation flow (different concern). It touches only
  the per-player handicap entry surface.

## Goal

Every UI component that needs to know how to render a handicap input
or display does this:

```
const entry = systemModule.handicapSystem.handicapEntry;
// entry.inputKind, entry.range, entry.placeholderText, entry.displayFormat(value), ...
```

No `if (handicapType === 'fargo')` anywhere on the lineup-side render
path. Adding a new handicap system: write its `HandicapEntryModule`
config and the UI renders automatically.

## Non-Goals

- **Workshop UI** for editing the dials. Future feature.
- **`MatchEndVerification` / scoreboard / score-entry** peeks. Those
  are different modules in the audit (match-end module, scoreboard
  display module). Future branches.
- **Sub-handling modules.** Anonymous + double-duty are their own
  module type per the audit. Next branch after this.
- **Team-bonus modularization.** Ed's invention; its own future
  brainstorm.
- **Touching `useMatchPreparation.ts`'s threshold dispatch.** Already
  handled on `feat/threshold-math-modular`.
- **`MatchLineup.tsx`'s `shouldUseTeamBonus` import.** Will be cleaned
  up when threshold-math merges; not this branch.

## Implementation Units

- [ ] **Unit 1: Define `HandicapEntryModule` + per-system configs**

**Files:**
- Modify: `src/systems/handicap-systems/types.ts` — add the
  `HandicapEntryModule` interface and reference it from `HandicapSystem`
- Modify: `src/systems/handicap-systems/points.ts` — add
  `handicapEntry` config
- Modify: `src/systems/handicap-systems/percentage.ts` — same
- Modify: `src/systems/handicap-systems/fargorate.ts` — same (Fargo
  dials: min 100, max 1000, integer, source 'manual')
- Modify: `src/systems/handicap-systems/skill-level.ts` — stub
- Test: `src/systems/handicap-systems/__tests__/handicapEntry.test.ts`

**Approach:** Interface fields:
- `inputKind: 'select' | 'number' | 'text'`
- `range: { min: number; max: number; integer: boolean } | null`
- `enumValues: ReadonlyArray<{ value: number; label: string }> | null`
  (for select widgets)
- `placeholderText: string`
- `columnHeader: string` (e.g. `'Fargo'` for FargoRate, `'H/C'` for
  Points)
- `displayFormat: (value: number | null) => string`
- `columnWidth: 'narrow' | 'wide'` (Fargo needs more room for
  3-digit values)
- `source: 'manual' | 'auto-from-history' | 'api'`

Each system declares its config. Points: select + enum + 'H/C' header
+ narrow column. Percentage: number + 0..100 range + '%' suffix +
narrow column. Fargo: number + 100..1000 range + 'Fargo' header +
wide column + manual source.

**Test scenarios:**
- Each system's `handicapEntry` config validates (required fields
  present)
- `displayFormat` for each system matches today's output for
  representative values
- Fargo config matches Ed's reframing (range 100-1000, integer,
  source 'manual')

**Verification:** TypeScript compiles. No runtime behavior change
yet — modules expose the field but no UI reads it.

---

- [ ] **Unit 2: Refactor `HandicapCell.tsx` to read from the module**

**Files:**
- Modify: `src/components/lineup/HandicapCell.tsx`
- Test: characterization test (`HandicapCell.test.tsx`) — for each
  system, the rendered widget shape matches today's output

**Approach:** Replace the 6 peeks with reads from
`handicapSystem.handicapEntry`. Use `inputKind` to choose between
`<Select>` and `<Input type="number">`. Use `range` for `min`/`max`.
Use `placeholderText`, `columnHeader`, `displayFormat`, `columnWidth`
as appropriate.

The component needs access to the resolved `handicapSystem` module.
Caller plumbs it down OR the component imports `getHandicapSystem`
and calls it with the passed `handicapType` prop. **Implementer pick:**
caller-plumb is cleaner; import-and-resolve is less plumbing. Start
with import-and-resolve to keep diff small.

**Test scenarios:**
- Points: renders `<Select>` with the -2..+2 enum
- Percentage: renders `<Input type="number">` with min 0 max 100,
  '%' placeholder
- Fargo: renders `<Input type="number">` with min 100 max 1000,
  'Fargo' column header
- No literal `'fargo'` / `'points'` / `'percentage'` strings in code
  (only in the per-system module configs)

**Verification:** Grep `HandicapCell.tsx` for handicap-type strings →
zero hits in render code. Existing tests pass.

---

- [ ] **Unit 3: Refactor remaining lineup-side peeks**

**Files:**
- Modify: `src/components/lineup/HandicapSummary.tsx` — read
  `displayFormat` from the module instead of branching
- Modify: `src/hooks/lineup/useHandicapCalculations.ts` — read Fargo
  manual-rating overrides via the module's `source === 'manual'`
  flag (5 peeks across positions 1-5 become one loop)
- Modify: `src/hooks/lineup/useLineupValidation.ts` — read sub
  validation rules from the module (`enumValues` presence implies
  "sub handicap required")
- Modify: `src/player/MatchLineup.tsx` — column header text, column
  width, "Fargo coming soon" banner, manual-rating widget gate all
  read from the module
- Test: characterization tests for each affected hook/component

**Approach:** Each peek becomes a read from the same
`handicapEntry` config. The banner that today shows for Fargo only
checks `module.handicapEntry.source === 'manual'` — generalizes to
any future system that uses manual entry.

**Test scenarios:**
- Each hook/component renders / computes identically to today for
  Points, Percentage, Fargo configurations
- No literal handicap-type strings in code

**Verification:** Grep each touched file for handicap-type strings →
zero hits in code (comments / type unions fine). All existing tests
still pass.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Refactor changes UI output subtly | Characterization tests per file lock today's output; each system's `displayFormat` test asserts byte-equivalence |
| Caller doesn't have `handicapSystem` module available | Components/hooks import `getHandicapSystem(handicapType)` and resolve locally — same pattern `getGamesNeeded` already uses |
| Future API-backed Fargo needs more than dials can express | `source: 'api'` future Unit adds an `apiAdapter` field; existing manual-mode code paths stay identical |
| `MatchLineup.tsx`'s `shouldUseTeamBonus` import stays for now | Acknowledged; threshold-math branch removes it. Cross-branch coordination, not blocking |

## Success Criteria

- Zero literal `'fargo'` / `'points'` / `'percentage'` / `'skill_level'`
  strings in code in `HandicapCell.tsx`, `HandicapSummary.tsx`,
  `useHandicapCalculations.ts`, `useLineupValidation.ts`, and the
  lineup-row-rendering portions of `MatchLineup.tsx`.
- Each shipping HandicapSystem module exports a populated
  `handicapEntry: HandicapEntryModule`.
- Adding a new handicap system in a hypothetical follow-up requires
  writing the system's `HandicapEntryModule` config + a one-line
  registry edit; zero edits to `HandicapCell` / `HandicapSummary` /
  the lineup hooks.
- Existing characterization tests pass; no UI output regressions for
  any of Points / Percentage / Fargo.

## Sources & References

- Origin: `docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md`
- Architectural principles: top of `CLAUDE.md`
- Modular precedent: `feat/threshold-math-modular` branch — same
  pattern applied to prep-time threshold math
- The existing `HandicapSystem` interface:
  `src/systems/handicap-systems/types.ts`
