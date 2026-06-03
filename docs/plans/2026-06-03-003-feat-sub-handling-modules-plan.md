---
title: feat — Sub-handling modules (anonymous + double-duty as plug-in SubModules)
type: feat
status: active
date: 2026-06-03
origin: docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md
---

# Sub-Handling Modules

## Overview

Second Phase-1 module from the UI modularity audit. Anonymous sub and
double-duty sub each become their own `SubModule` instance. League
selects which sub modules are enabled (LO setting); MatchLineup reads
the enabled set and renders its dropdown accordingly.

Today both sub types are hardcoded in MatchLineup as constants
(`ANON_SUB_VALUE`, `DOUBLE_DUTY_VALUE`) and the dropdown always shows
both options. After this refactor, the dropdown enumerates the
league's enabled SubModules — workshop will eventually edit which.

## Problem Frame

Ed: "the anonymous sub and double duty subs are also each their own
thing. they maybe both available or either or not at all depending on
a LO setting."

Today the codebase assumes both are always available everywhere. To
let an LO say "this league disables double-duty subs," that has to be
data-driven. Step 1 is making each sub type its own module; step 2
(future) is wiring a UI to toggle them.

## Key Decisions

- **Decision:** `SubModule` is a single interface with a `kind`
  discriminator (`'anonymous' | 'double_duty'`), not two separate
  interfaces. Rationale: the dials are common today
  (kind, displayLabel, dropdownValue, maxPerLineup). When they
  diverge, split.
- **Decision:** Enablement lives on the system module — a
  `enabledSubs: SubModule[]` field on `SystemModule`. Rationale:
  consistent with `chain: Module[]` (added in the threshold-math
  refactor) and `handicapEntry` (handicap-entry branch). Workshop
  will eventually edit these per league.
- **Decision:** Today every shipping system enables BOTH subs.
  Hardcoded defaults match current behavior — no LO toggle UI yet
  (that's the workshop / LO settings dashboard work in the pathway).
- **Decision:** The sentinel UUIDs (`getAnonSubId`,
  `getDoubleDutySubId`, etc.) stay where they are — they're the
  persisted encoding. The SubModule's `dropdownValue` is the
  in-memory option value for the React dropdown. Two concerns.
- **Decision:** `maxPerLineup: 1` for both today (matches current "at
  most one sub of either type" rule). Future workshop can dial higher.

## Goal

MatchLineup's sub dropdown looks roughly like:

```
const enabledSubs = systemModule.enabledSubs;
// In the player-selection dropdown:
{enabledSubs.map(sub => (
  <SelectItem key={sub.kind} value={sub.dropdownValue}>
    {sub.displayLabel}
  </SelectItem>
))}
```

Adding a third sub type later: write a `SubModule` config, add it to
each system's `enabledSubs` list, done. No edits to MatchLineup.

## Non-Goals

- **LO settings dashboard / Workshop UI for editing enabled subs.**
  Future feature.
- **Per-league sub enablement.** Today everything's hardcoded per
  system module preset. Per-league dial editing happens when the
  workshop ships.
- **Refactoring `OpponentSubstituteModal`, `SubResolutionBanner`, or
  the per-sub resolution flow.** Those still work; their UI is
  intrinsically per-sub-type and doesn't need module-driven dispatch
  yet.
- **Migrating sentinel UUID helpers** (`getAnonSubId`,
  `isAnonSubSentinel`, etc.). Those are the persisted encoding;
  separate concern.
- **Adding new sub types** (substitute pools, ghost subs, etc.).
  Future. The infrastructure supports it.

## Implementation Units

- [ ] **Unit 1: SubModule interface + instances + system wiring**

**Files:**
- Create: `src/systems/sub-modules/types.ts` — the `SubModule`
  interface
- Create: `src/systems/sub-modules/anonymous.ts` — the anonymous
  SubModule instance
- Create: `src/systems/sub-modules/doubleDuty.ts` — the double-duty
  SubModule instance
- Create: `src/systems/sub-modules/index.ts` — registry exports +
  defaults
- Modify: `src/systems/types.ts` — add `enabledSubs: SubModule[]` to
  the `SystemModule` interface
- Modify: `src/systems/bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`,
  `buildSystemFromPreferences.ts` — declare `enabledSubs:
  [anonymousSubModule, doubleDutySubModule]`
- Test: `src/systems/sub-modules/__tests__/subModules.test.ts`

**Approach:**

```typescript
export type SubKind = 'anonymous' | 'double_duty';

export interface SubModule {
  readonly kind: SubKind;
  /** Display label shown in the player-selection dropdown. */
  readonly displayLabel: string;
  /** In-memory option value used by the React dropdown. */
  readonly dropdownValue: string;
  /** Max instances of this sub kind allowed in a single lineup. */
  readonly maxPerLineup: number;
}
```

Two instances:
- `anonymousSubModule`: kind 'anonymous', label 'Anonymous Sub',
  dropdownValue `__anonymous_sub__`, maxPerLineup 1
- `doubleDutySubModule`: kind 'double_duty', label 'Double Duty',
  dropdownValue `__double_duty__`, maxPerLineup 1

The `__anonymous_sub__` / `__double_duty__` constants in
MatchLineup are still the values used (matches today's behavior);
they just live on the modules now instead of inline.

**Test scenarios:**
- Each module exports the expected `kind`, `displayLabel`,
  `dropdownValue`, `maxPerLineup`
- Each shipping system (bca3v3, bca5v5, fargo5v5) declares both subs
  enabled
- `buildSystemFromPreferences` for ad-hoc-resolved systems also
  includes both subs

**Verification:** TypeScript compiles. Tests pass. No runtime
behavior change yet — modules exist but the existing dropdown still
uses its hardcoded constants.

---

- [ ] **Unit 2: Refactor MatchLineup dropdown to read enabled modules**

**Files:**
- Modify: `src/player/MatchLineup.tsx` — replace the inline
  `ANON_SUB_VALUE` / `DOUBLE_DUTY_VALUE` constants and the dropdown
  option literals with iteration over the enabled modules
- Test: characterization test verifies the rendered dropdown for the
  three shipping system presets

**Approach:**
- Resolve `enabledSubs` from `leaguePrefs` (today: hardcoded both
  via `getEnabledSubModulesForLeague(prefs)` helper)
- Wherever `ANON_SUB_VALUE` / `DOUBLE_DUTY_VALUE` constants are used,
  resolve via the module: `anonymousSubModule.dropdownValue` /
  `doubleDutySubModule.dropdownValue`
- The dropdown options now come from `enabledSubs.map(s => <SelectItem
  key={s.kind} value={s.dropdownValue}>{s.displayLabel}</SelectItem>)`
- `handlePlayerChange`'s switch on `value === ANON_SUB_VALUE` etc. now
  reads the value-to-sentinel mapping from the modules

**Test scenarios:**
- With both modules enabled (today's default), dropdown shows both
  options labeled correctly
- With only anonymous enabled (synthetic case for the test), dropdown
  shows only that option
- Sentinel value still maps to the right sentinel UUID after the
  module-driven dispatch (sentinel encoding unchanged)

**Verification:** Grep `MatchLineup.tsx` for literal `'__anonymous_sub__'`,
`'__double_duty__'` strings → zero hits in code (they live on the
modules now). Existing lineup tests pass.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| MatchLineup is a large file; refactoring sub-dropdown logic may touch unrelated state | Touch only the dropdown values and `handlePlayerChange`'s value-decoding switch. Sentinel-UUID handling stays as-is |
| `substituteType` React state still tracks `'anonymous' | 'double_duty' | null` — that's per-module-kind hardcoded | Acceptable for now; this is the "which one did the captain pick?" state. Generalizing to `SubKind | null` is fine but the literal types stay |
| Future cross-branch merge conflicts with handicap-entry-module | Both touch MatchLineup but in different sections (handicap-entry refactors the column header / banner; this branch refactors the sub dropdown). Conflicts will be small and mechanical |

## Success Criteria

- Zero literal `'__anonymous_sub__'` / `'__double_duty__'` strings in
  `MatchLineup.tsx` code (they live on the SubModules now).
- Each shipping `SystemModule` exports `enabledSubs:
  [anonymousSubModule, doubleDutySubModule]`.
- Adding a hypothetical new sub kind requires writing the new
  `SubModule`, adding it to system modules' `enabledSubs`, and
  handling its sentinel-decode case in `handlePlayerChange` — zero
  edits to the dropdown render itself.
- Existing lineup tests continue to pass.

## Sources & References

- Origin: `docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md`
- Architectural principles: top of `CLAUDE.md`
- Sibling Phase-1 module: `feat/handicap-entry-module` branch
