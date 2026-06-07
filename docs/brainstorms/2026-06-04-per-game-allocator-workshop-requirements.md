---
title: Per-Game Allocator Workshop — Requirements
status: ready-for-planning
created: 2026-06-04
locked_spec: `docs/league-system/modules/points-system/README.md`, `docs/league-system/modules/points-system/trigger.md`
---

# Per-Game Allocator Workshop — Requirements

## What this brainstorm is for

The Per-Game Allocator (sub-mechanism A of the Points System) is currently hardcoded inside TypeScript factory files (`src/systems/points-system/compositions/*.ts`). To change `winner = 10` to `winner = 11` for a single League Operator's league, a developer has to edit code.

The workshop is the first concrete application of the **modules-as-data** principle: the allocator becomes a DB row the LO authors, saves, and points their league at — entirely through the UI, no code change. The engine that runs the math stays as code; only where the numbers come from changes.

This is the first module to take this shape. Other modules (triggers, thresholds, win calc) will follow the same pattern later.

## The dials a saved variation has to carry

Per the locked Points System README, an allocator has two sides: **winner** and **loser**. Each side is one of three kinds:

| Kind | What the LO enters | Per-game behavior |
|---|---|---|
| **Fixed** | A number | Side always gets that number (e.g. winner = 11) |
| **Range** | min, max, and a prompt label | Scorer types a value in range each game (e.g. loser = 0–7, "Balls pocketed") |
| **Formula** | Which recipe + the values to fill its blanks | Side's number is computed each game from inputs |

A formula recipe can read from three sources:
1. **The other side's value for this game** (the 17-Point case: winner = 17 minus loser)
2. **The running match-state bag** (e.g. winner = this side's wins-so-far — grows every game)
3. **Constants the LO chooses when saving** (the "7" in `17 − loser`, the multiplier in a behind-boost)

## What the four real cases look like

| Scoring System | Winner side | Loser side |
|---|---|---|
| Percent 5-Man's allocator | Fixed (0.1) | Fixed (0) |
| 10-Point | Fixed (10) | Range (0–7, "Balls pocketed") |
| 17-Point | Formula (10 + (7 − loser)) | Range (0–7, "Balls pocketed") |
| Customer's 11-point | Fixed (11) | Whatever they want |

All four are the same three building blocks composed differently. The workshop is the surface for composing them.

## What's already built (and works)

The math engine and the formula path both exist:

- `SideConfig` shape in `src/systems/points-system/types.ts` already supports fixed / range / formula
- Two formula operations are registered:
  - `add_complement_of_other_side` — covers 17-Point (reads the other side's value)
  - `state_diff_times_constant` — reads the running state bag
- `runtime.ts` + `allocator-evaluator.ts` execute all three side kinds correctly
- Cross-audit tests pin the prepackaged compositions to byte-equivalent legacy output

## What's missing (the workshop pipeline)

1. **DB table for saved variations.** One row per saved allocator. Each row carries: a name, an owner, a scope (user-owned or global/read-only), and the two sides as data (kind + its values). The row shape mirrors the in-memory `SideConfig` so no translation layer is needed.

2. **Per-league pointer.** A new nullable column on the relevant league/preferences row that points at a saved variation. NULL means "use whatever the prepackaged scoring system bundles" (no behavior change for existing leagues).

3. **Loader.** A function that reads a row, runs it through the existing `composition-validator`, and returns an in-memory `PerGameAllocator` the runtime can consume.

4. **One swap point.** Inside `pickPointsSystem` (in `src/systems/buildSystemFromPreferences.ts`), if the league points at a saved variation, replace the prepackaged composition's `perGameAllocator` slot with the loaded one. Triggers + thresholds stay as the prepackaged composition declared them.

5. **Workshop UI.** A page where an LO sees their saved allocators + read-only globals, can clone a global as a starting template, edit the dials, save, and (from league settings) pick one to apply.

6. **Sanity preview at the swap point.** When an LO picks a custom allocator for their league, the workshop runs a quick check against the league's prepackaged composition and flags obvious mismatches (e.g. a 0.1-per-game allocator dropped into a system whose milestone triggers expect 10-point-scale totals). Runtime trusts; workshop validates.

The pre-existing `leagues.system_overrides` JSONB column + `SystemOverrides` type were an earlier attempt at the same problem. They only carry flat numeric tweaks for one league at a time, with no library, no authorship, no formula support — wrong shape. Will be deprecated/removed once the workshop replaces what little it covers.

## The 11-point flow, end to end

1. LO opens **Scoring Workshop → Per-Game Allocators**. Sees globals (read-only) + their own (empty).
2. Clicks the **FargoRate 10-Point** global → **Make a copy I can edit**. A copy appears in their library.
3. Opens the copy. Renames to "FargoRate 11-Point." Changes winner from 10 to 11. **Save.**
4. Goes to league settings → scoring section → "Replace the per-game allocator." Picks **FargoRate 11-Point.** Workshop runs sanity preview; if clean, the league row's pointer is set.
5. Next match in that league: the builder sees the pointer, loads the row, swaps it into the composition's allocator slot. Winner gets 11. Scorekeeper UI unchanged. Done.

## Filing / library affordances

- Each row: name, optional description, owner, created/updated timestamps
- Globals shown read-only with a "Make a copy I can edit" action
- A user sees only their own + the globals
- A row pointed at by a league is non-deletable while in use (soft-checked at delete time)

## Out of scope (intentionally)

- Authoring brand-new formula recipes (only LO-fillable existing recipes — adding new recipes stays a code/dev task)
- Workshop for triggers, thresholds, win calculator, handicap (separate future workshops; same pattern, different module)
- Cross-league sharing beyond globals (a colleague handing you their saved variation — future)
- A "build a Scoring System from scratch" surface (this workshop covers ONE module, not the whole stack)

## Open items handed to planning

- Exact column layout for the variations table (sides as JSONB vs flat columns)
- Exact column to add to `leagues` / `preferences` for the pointer (which side of the preferences cascade owns it)
- Authorship model: just LOs, or any registered user as Ed casually said? (resolved at planning kickoff)
- Sanity-preview's specific checks (concrete rules vs. heuristics)
- Wiring a 17-Point prepackaged composition so the formula path is exercised end to end with the workshop (likely the smoke test for the whole pipeline)
