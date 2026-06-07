---
title: Threshold Workshop — Requirements (Standalone Work Room)
status: ready-for-planning
created: 2026-06-07
revised: 2026-06-07
foundational_brainstorm: docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md
locked_spec: docs/league-system/modules/threshold-charts/README.md
locked_spec_secondary: docs/league-system/modules/points-system/trigger.md
blueprint_rooms:
  - docs/plans/2026-06-04-001-feat-per-game-allocator-workshop-plan.md
  - docs/plans/2026-06-06-001-feat-trigger-room-plan.md
salvage_branches:
  - origin/lo-manual-scoring  # chart-editor UI + chart data/API layer (NOT the manual-scoring half, which already shipped)
  - origin/feat/threshold-math-modular  # abandoned modular-math attempt — mine the grain lesson, not the code
---

# Threshold Workshop — Requirements

> Third module room in the Scoring System "Workshops building," after the per-game allocator
> room and the trigger room. Thresholds are match-completion-critical, so they're next on the
> path to the assembly room. Same modules-as-data pattern as its two predecessors: an LO
> authors threshold variations as DB-row **data**, not new code.

## What this room is

A standalone work room for authoring **Threshold** modules. A Threshold is a pure
**state setter**: it takes the home and away inputs, produces **one number**, and writes that
number into the match state bag under a generic key (`threshold_1`, `threshold_2`, …). That's
the whole contract. It knows nothing about who reads the number — any consumer (one trigger,
or five different ones) is wired to read `threshold_1` by name.

Compositions today define their threshold rows **in code** (e.g. `points-3-man.ts` builds its
four threshold rows inline). This room makes them **authorable** and **savable to a library**,
exactly as the allocator and trigger rooms did for their module types.

The threshold module knows only its own job. It does not know:
- What scoring system it lives in.
- Which trigger or calculator will read its number.
- What runs before or after it.

That's by design — modules are independent and zero-knowledge. The scoring system room
(future) is where modules get assembled, ordered, and applied to leagues.

## The core model (resolved in brainstorm)

**A threshold is ONE resolver: `home + away → number`.** Everything else is how that one
mapping gets authored. Two construction styles, and the runtime never knows which one was
used — they both compile to the same agnostic resolver:

- **Shape-then-chart** (the BCA pattern). Reduce the two sides to a scalar (e.g. the
  difference of the team handicaps), then look that scalar up in a table. Output: games-to-win,
  etc.
- **Formula** (the Fargo pattern). Run a calculation directly over the inputs. Fargo games-won
  and Fargo points both *calculate* their number from the rating arrays (`2^(rating/100)`
  summed across the lineup) — **no chart at all.** (The captains' start-points negotiation is a
  separate downstream *check* on the math, not an input to it.)

**The chart is a tool used *inside* a resolver, not a peer of the formula.** A chart is just a
formula wearing a table's clothes because a table is easier for a human to read. The chart in
the prior work was *generated from a formula*; it only becomes a genuine standalone lookup
table the moment an LO hand-edits a cell to a value the formula would never produce. So we
stay **agnostic**: we do not assume "most leagues use a chart." Default content can be
formulas, shown as a readable table, hand-editable into a real table when an LO needs to break
the formula.

## The builder — two sides

### 1. Input side — "what feeds the resolver?"

The threshold takes **home and away**. For a team that's an **array** of numbers (the lineup's
handicaps/ratings); for an individual it's a **single** number.

- The threshold **declares** which shape it expects (array vs. scalar). The **workshop
  validates** that the math/chart the LO builds matches that expectation; the **runtime
  trusts** and just runs. (The existing primitive already carries an `expectedSize` field, and
  the resolver already drift-checks row metadata against the operation it names.)
- The LO picks the shaping: **this kind of math, that kind, or invent your own** — a menu of
  presets (difference of the two sides, a single side, a sum, a pref value…) **plus** a
  build-your-own path using the shared expression builder over the available values.
- The **home/away mirror toggle** lives here: *"Is this for home and away?"*
  - **Yes** → the LO authors it once from a neutral **"my side / their side"** perspective, and
    we generate the away twin automatically → two entries in the bag.
  - **No** → a single value, no side (e.g. a side-less milestone like
    `round(total_games × 0.75)`).

### 2. Lookup side — "resolve to the number"

A fork between the two **authoring views**, and each view follows the established workshop
three-way (**use / use-as-template / build-from-scratch**):

- **Formula view** → a library of preset formulas: **use** as-is · **use as template**
  (copy + edit) · **build from scratch**. Uses the shared `ExpressionBuilder` widget.
- **Chart view** → a library of preset charts: **use** · **use as template** ·
  **create your own**. Uses the salvaged chart-table editor.

The **generate-from-games** button is the bridge between the two: start from a formula, spit
out a chart, hand-edit if you want. Both views save into the same agnostic resolver.

## Naming — display vs. identity

Like every module, a threshold carries a human **label + description**. These are
**display only**. The thing code and consumers reference is the stable generic key
(`threshold_N`), assigned by us, never changed.

We cannot use the LO's label as the variable name for two reasons (both raised in brainstorm):
1. **Collisions** — free text could clash with another threshold's label or a system variable
   (`home_points`), silently overwriting in the bag.
2. **Stability under rename** — consumers wire to `threshold_1`; if the label *were* the name,
   renaming it would break every reader. A stable key lets the LO relabel freely.

## Requirements

**Core authoring model**
- R1. A threshold resolves `home + away → one number` and writes it to the state bag under a
  generic key. It carries no knowledge of its consumers.
- R2. A threshold's number is authored via one of two interchangeable views — **formula** or
  **chart** — that both compile to the same resolver. The runtime never branches on which.
- R3. A threshold declares its expected input shape (array for a team / scalar for an
  individual); the workshop validates the built math/chart against that declaration.
- R4. A threshold carries a display **label + description**; the runtime/consumer identity is a
  separate generic key the LO never edits.

**Input side**
- R5. The LO chooses the input shaping from a preset menu (difference / single side / sum /
  pref / …) or builds a custom shaping via the expression builder.
- R6. A **"home and away?" toggle**: when on, the LO authors once from a neutral side
  perspective and the away twin is generated automatically (two bag entries); when off, a
  single side-less value.

**Lookup side**
- R7. The **formula view** offers a library of preset formulas with use / use-as-template /
  build-from-scratch, built on the shared `ExpressionBuilder`.
- R8. The **chart view** offers a library of preset charts with use / use-as-template /
  create-your-own, built on the salvaged chart-table editor (exact + range lookup, generate
  -from-games, hand-edit warnings + "use anyway" gate).
- R9. A formula can be materialized into an editable chart (generate-from-games); hand-editing
  a cell off-formula makes that chart the authoritative resolver.

**Workshop wrapper (consistent with allocator + trigger rooms)**
- R10. List page = **Templates + Yours**; an editor; saved as a **row** in the room's own table.
- R11. **Officials** are read-only and tamper-protected; user rows are author-owned.
- R12. A **save-time guard** (validator + synthetic dry-run) runs before persisting; the loader
  re-validates on read and never throws.
- R13. The room gets its own card on the workshop home page, its own route, its own
  folder/loader/table — sharing only the `ExpressionBuilder` widget and the salvaged chart
  editor with its siblings.

## Success Criteria

- An LO can author a threshold end to end — name it, set the mirror toggle, pick/invent the
  input shaping, and pick/clone/build a chart **or** a formula — save it, and have it persist as
  a row the resolver runs.
- All three real cases express **without special-casing**: BCA (shape → chart), Fargo games-won
  (formula over arrays), Fargo points (formula).
- The runtime stays **agnostic** — no branch on chart-vs-formula or on system identity anywhere
  in the resolver path.
- The workshop catches an array/scalar mismatch at author time (drift check), not at runtime.
- The room looks and feels like the allocator + trigger rooms: same list+editor shape, same
  expression-builder hands, same save-time guard, same officials/tamper pattern.

## Scope Boundaries (out of scope for this room)

- **Applying thresholds to leagues.** Belongs to the scoring system / assembly room (future) —
  same call the trigger room made. The salvaged `ThresholdSourceStep` wizard step and the
  `season.threshold_chart_id` link are set aside for that room, available if we want them sooner.
- **Setting ORDER / position.** A scoring system concern; a threshold by itself has no order.
- **Adapting the incoming handicap.** Anything that *transforms* the input before it reaches the
  threshold — changing the handicap type, or the not-yet-built standings team-bonus — is a
  separate **adapter** step inserted between the Handicap System and the threshold. It has
  nothing to do with thresholds; the threshold receives its `home`/`away` already in final form
  and never knows an adapter ran. **Do not code for it, expect it, or design around it here.**
- **The manual-scoring / match-review UI** from the salvage branch — already shipped and live;
  untouched here.
- **Inline LO-help (InfoButtons, glossary entries).** Rolls out via the docs phases, as with the
  prior rooms.

## Key Decisions (locked with Ed in brainstorm)

- **One agnostic resolver, two authoring views.** Chart and formula are not two runtime modes;
  they are two ways to author the same `input → number` mapping. Rationale: the prior "chart"
  was a formula underneath, and the runtime never needs to know the difference.
- **Stay agnostic on chart-vs-formula prevalence.** No assumption that charts are the common
  case. Rationale: Fargo (both modes) uses no chart at all.
- **Generic key, display-only label.** Rationale: collision safety + rename stability.
- **Mirror via a toggle, authored from a neutral perspective.** Rationale: most thresholds are
  home/away pairs over the same math; side-less milestones must still fit.
- **Reuse, don't rebuild.** Take the chart-editor UI + chart data/API layer from
  `origin/lo-manual-scoring`; take the `ExpressionBuilder` from the allocator/trigger rooms;
  take the default-chart formulas (`src/systems/threshold-charts/*`) as seed content.
- **Module grain = one coherent computation.** From the abandoned `threshold-math-modular`
  branch: "one module per output value" was too fine and was dropped. A chart lookup that emits
  win/tie/lose together is *one* resolver, not three.

## Dependencies / Assumptions

- The threshold **primitive already exists** and is the target the workshop authors into:
  `ThresholdRow` / `ThresholdOperation`, `threshold-registry.ts`, `threshold-resolver.ts`
  (operation kind + args + output metadata + `expectedSize`; resolver does the drift-check).
- The chart **storage already exists**: `threshold_charts` + `threshold_chart_rows` tables (with
  a generic `comp_1/comp_2 → result_1/2/3` row and an `exact | range` lookup mode), plus the
  `useThresholdCharts` hooks and `thresholdCharts` queries on the salvage branch.
- The four guard layers carry over from the prior rooms (save-time guard, read-time validator,
  snapshot freeze when used through a system, runtime backstop).

## Outstanding Questions

### Resolve Before Planning
- _(none — core product model is resolved.)_

### Deferred to Planning
- [Affects R10/R12][Technical] **Storage shape**: a new `thresholds` table for the row/wiring
  (mirroring the in-memory `ThresholdRow`), and how its rows reference `threshold_chart_rows`
  for the chart view vs. carry an expression tree for the formula view. Confirm whether formulas
  ride an `evaluate_expression`-style operation as the allocator's formulas do.
- [Affects R8][Technical] **Collapse the four chart editors** (`points` / `percentage` /
  `race-points` / `race-percentage`) into **one** editor driven by the `exact | range` toggle —
  recommended in brainstorm; confirm in planning.
- [Affects R6][Technical] **How the mirror materializes**: two generated rows, or one row with a
  per-side flag the resolver expands at match start?
- [Affects R3][Technical] How the array/scalar `expectedSize` declaration is surfaced in the
  editor and enforced by the save-time guard.

## Next Steps
-> `/ce:plan` for structured implementation planning.
