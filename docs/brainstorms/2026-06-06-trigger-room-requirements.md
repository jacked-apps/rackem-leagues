---
title: Trigger Room — Requirements (Workshop's Second Room)
status: open
created: 2026-06-06
foundational_brainstorm: docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md
locked_spec: docs/league-system/modules/points-system/trigger.md
predecessor_room: docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md
---

# Trigger Room — Requirements

The Workshop building's second room. Authors **Triggers** — the if/then primitive that drives milestone jumps, edge markers, end-of-match scoring formulas, start-points credit awards, etc. Today these are baked into the prepackaged TypeScript compositions; the trigger room makes them LO-authorable data, like the per-game allocator before it.

The first room (Per-Game Allocator) shipped via [PR #179](https://github.com/jacked-apps/rackem-leagues/pull/179). The trigger room reuses every pattern that room set; the only genuinely new architectural question is **slot vs list** — see "What's different" below.

## What this brainstorm is for

Lock the v1 scope of the trigger room and answer the slot-vs-list question before planning. Three buckets:

1. **What carries over from the per-game allocator room** — almost everything. List it briefly so reviewers see the precedent isn't being re-invented.
2. **What's genuinely new** — triggers compose differently (a composition has a LIST of triggers, in order, not a single slot). This shapes the picker UX, the league preferences shape, and the live-scoring wiring.
3. **What's deferred** — keep v1 small. The full "compose anything from scratch" surface comes later when the assembly room exists.

## Foundation (locked, carries from the building brainstorm)

The Scoring System is the main component. Inside it are smaller, single-responsibility modules. The workshop building has one room per module type. The runtime is code; module variations are data; the workshop is the guardrail. The four guard layers (save-time, read-time, snapshot, runtime backstop) and the two non-negotiables (lineup/scoring pages always render; W/L always recorded) apply unchanged.

## Locked spec we're building from

`docs/league-system/modules/points-system/trigger.md` is the canonical Trigger model. A Trigger has six parts:

- **TYPE** — `match_start` / `match_end` / `anytime` — when it fires.
- **CONDITION** — single flat comparison (or `always`) between state-bag operands.
- **ACTION** — writes one state variable; value is either a literal `set` or an `Expression` tree (the same one the allocator's `evaluate_expression` recipe consumes).
- **RE-ARM** — `single_shot` (default), `periodic`, or `manual`.
- **ORDER** — fire-order number + `beforeAllocator` bool (for `anytime` triggers).
- **DISPLAY** (minor) — label + target value, mostly unused today.

The runtime already executes triggers (and has been doing so since the Points System extraction). The trigger room makes them AUTHORABLE through the UI; the engine is unchanged.

## What carries over from the Per-Game Allocator Room

Everything except the live-scoring composition shape question. To keep the reviewer's mental load down, here's the list (none of these need re-debating):

- **Storage shape.** New table `triggers`. Same backbone columns as `per_game_allocators` (id, name, description, scope, author_id, timestamps) + room-specific columns. Trigger-specific data stored as JSONB columns mirroring the in-memory `Trigger` type 1:1.
- **Library + officials model.** User-scope authoring + read-only seeded officials. Tamper trigger blocks UPDATE/DELETE on `scope='official'` rows.
- **Loader.** `loadTrigger(id)` mirrors `loadPerGameAllocator(id)` — fetch, validate, return `Trigger | null`, never throws.
- **Workshop room UI shape.** List view (Yours + Templates) + editor + save-time guard. Lives under `src/operator/scoring-workshop/trigger/`.
- **Click-to-build sub-editors.** TYPE picker (3 choices), CONDITION builder (reuses the same Expression / comparison tokens the allocator room uses for the condition's left/right + operator picker), ACTION builder (state-var-name picker for target + Expression tree for the value, or a literal for `set`-kind), RE-ARM dropdown (3 choices), ORDER inputs (number + before/after-allocator checkbox).
- **Available data registry.** Same side-agnostic + match-locked + match-cumulative split. Trigger conditions and actions can reference all the same names the allocator's formulas already can.
- **Save-time guard.** Validator + synthetic match dry-run via `evaluatePointsSystem`. Refuses bad rows inline.
- **Apply-time preview.** Same as allocator — run the league's composition with the trigger included, surface NaN / scale-mismatch / engine-throw warnings.
- **Snapshot freeze.** Trigger variations applied to a league are embedded as resolved Trigger objects in `match.system_snapshot` at match start; editing the source row later cannot retroactively change historical scoring (R9).
- **Runtime backstop.** Already exists. `fireTrigger` has had the never-throw discipline since the original runtime — the workshop's user-authored triggers ride this without any new code.
- **Four-guard contract** unchanged.

## What's genuinely new (the slot-vs-list question)

The per-game allocator is a **single slot** on the composition (`composition.perGameAllocator`). Replacing it is a 1:1 swap.

Triggers are a **list** on the composition (`composition.triggers: readonly Trigger[]`). A prepackaged composition like Percent 5-Man ships with ~6 triggers (per-side milestone jumps, per-side win jumps, edge markers). The LO can't just "swap the trigger" — they're adding to, removing from, or reordering a list.

Three v1 application models, in increasing ambition:

### Model A — Library only (smallest)

The room lets LOs author Trigger variations and save them to their library. No league-side application path in v1. The trigger doesn't run until a later room (the composition assembly room, future) lets the LO pick a full set.

- **Pro:** smallest scope; locks in the authoring pattern without committing to a league integration shape.
- **Con:** the LO can build but can't use. Less satisfying. Hard to test end-to-end through live scoring.

### Model B — Additive "extra triggers" slot (middle)

A new league preference `extra_triggers` (UUID array) lists trigger variations to APPEND to the prepackaged composition's `triggers` array. The runtime sees the union: prepackaged triggers + LO-added triggers.

- **Pro:** end-to-end usable; LO can layer in their own behavior (e.g., "give 5 extra points to the home team at game 13") on top of any prepackaged composition. The picker UX is just a multi-select.
- **Con:** can't disable a prepackaged trigger (so the LO can't, say, remove the milestone jump from Percent 5-Man). Order interleaving with prepackaged triggers needs a rule (probably: LO triggers append at the end of their phase, with default order numbers).

### Model C — Full list replacement (biggest)

A new league preference `triggers_override` (UUID array). When non-null, the runtime IGNORES the prepackaged composition's triggers and uses ONLY the LO's list.

- **Pro:** maximum LO power.
- **Con:** the LO has to author every trigger they want (no piggy-backing on prepackaged behavior). High footgun risk (forgetting the win-edge trigger means the match never decides a winner). The save-time guard's synthetic dry-run helps but won't catch every interaction.

### Recommended v1 — Model B

Additive only. The "remove a prepackaged trigger" and "wholesale replace" needs are real but rare; full composition authoring is the assembly room's job (future). Model B is the natural next step on the build-the-building-room-by-room path: it's bigger than just authoring, smaller than full composition replacement, ships a complete usable feature.

If Ed prefers Model A (defer all league wiring to the assembly room), the trigger room becomes ~60% the size and the assembly room's plan does the integration work. That's also reasonable.

If Ed prefers Model C (full replacement), the trigger room becomes maybe 30% larger than Model B, mostly in the league-settings UX (the LO needs a "build my trigger list in order" UI, which is a real piece of work).

**Open Question 1:** Pick A, B, or C. (Recommendation: B.)

## Other open questions

### Open Question 2: ACTION's target-name picker

A trigger's ACTION writes one state-var. The current `evaluate_expression` recipe surfaces 18+ readable virtuals to the LO; writes are different. The LO needs to pick a state-var NAME to write into. Three sub-options:

- **2a.** Free-text input. Same footgun the allocator room avoided.
- **2b.** Picker showing canonical writeable names (e.g., `home_points`, `away_points`, `home_edge_chip`, `endmatch`). Curated list per the existing prepackaged compositions.
- **2c.** Picker that also accepts a new custom name the LO defines. This lets the LO introduce a private state-var (e.g., `home_clutch_bonus`) that other triggers in their library can read.

Recommendation: **2b for v1, leave 2c as a clearly-marked future extension.** The "introduce a custom var" pattern is what the assembly room or a future "composition" room will lean on; not needed for individual trigger authoring.

### Open Question 3: How does ORDER interleave with prepackaged triggers?

In Model B (recommended), LO-added triggers append to the same phase's list as the prepackaged ones. Two sub-options:

- **3a.** LO triggers always run AFTER prepackaged triggers in the same phase, regardless of their `order.number`. Predictable; LO triggers can read everything prepackaged just wrote.
- **3b.** LO and prepackaged triggers interleave by `order.number` ascending. More flexible but invites unexpected ordering.

Recommendation: **3a for v1.** Simpler to reason about; LO doesn't need to know what `order.number` values the prepackaged composition uses. (`beforeAllocator` is still respected — LO triggers can choose to fire before or after the allocator within their phase.)

### Open Question 4: Which Expression-tree builder is used?

The allocator room ships `FormulaBuilder` (click-to-build, cursor, side-agnostic available data, role-based labels). The trigger's CONDITION needs a two-operand+comparison picker; the trigger's ACTION needs either an Expression tree (just like the allocator) or a literal value.

For the CONDITION picker, the existing FormulaBuilder isn't a fit (it builds expressions, not comparisons). Need a new `ConditionBuilder` component — much simpler than the FormulaBuilder (two operand pickers + an operator dropdown).

For the ACTION's expression value, the existing FormulaBuilder MIGHT be reusable as-is. The labels would flip from "Winner base / Loser base" (per-game role) to neutral (triggers don't compute per-side). This means the `perspective` prop on the FormulaBuilder either becomes optional or we add a third value (`'no_side'`).

Recommendation: extract a sharable `ExpressionBuilder` from the allocator's `FormulaBuilder` that takes optional `perspective`. The allocator's `FormulaBuilder` becomes a thin wrapper that always passes a perspective. The trigger's ACTION expression uses the bare `ExpressionBuilder` with no perspective. (Estimated effort: small refactor.)

## Tentative v1 scope (assuming Model B + the recommended sub-options)

In scope:
- DB table `triggers` + tamper trigger + ~6 seeded officials (one example of each TYPE × interesting pattern).
- Loader + validator + save-time guard.
- Workshop room UI: list + editor with TYPE picker + ConditionBuilder + ACTION builder + RE-ARM dropdown + ORDER inputs.
- Refactor: extract `ExpressionBuilder` from `FormulaBuilder`.
- League-side: new preference `extra_triggers UUID[]`. AllocatorPicker-style picker (multi-select) on LeagueSettings. Apply-time preview runs the composition with the trigger list appended.
- Snapshot extension: `system_snapshot.extra_triggers` stores resolved `Trigger[]` at match start.
- Live-scoring: `match-adapter.ts` `buildComposition` accepts `extraTriggers: Trigger[]`; appends to composition's triggers list (with the Open Question 3 rule for ordering).
- Tests: schema + loader + condition/expression args validation + runtime backstop (existing `fireTrigger` covers it) + apply-time + snapshot R9.
- Architectural doc update (`docs/league-system/modules/points-system/workshop.md`) mentioning the second room.

Out of scope:
- Model A's "library only" deferred-application — the brainstorm proposes Model B.
- Model C's full list replacement.
- Removing or disabling prepackaged triggers.
- Custom state-var name introduction (Open Question 2c).
- Workshop home page updates beyond adding the trigger room card.
- Inline LO-help (lives in the doc-inventory file from the allocator room work).

## Open questions summary (for the reply)

1. **Application model: A, B, or C?** (Recommendation: B.)
2. **ACTION target-name picker: 2a, 2b, or 2c?** (Recommendation: 2b.)
3. **LO triggers' ORDER vs prepackaged: 3a (after) or 3b (interleave)?** (Recommendation: 3a.)
4. **Sharable ExpressionBuilder refactor: extract from FormulaBuilder?** (Recommendation: yes.)

Greenlight all four recommendations → I move to planning.
Push back on any → we iterate here first.
