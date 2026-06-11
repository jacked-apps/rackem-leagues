---
title: Trigger Room — Requirements (Standalone Work Room)
status: ready-for-planning
created: 2026-06-06
revised: 2026-06-06
foundational_brainstorm: docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md
locked_spec: docs/league-system/modules/points-system/trigger.md
blueprint_room: docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md
---

# Trigger Room — Requirements

> **Revised 2026-06-06.** Two earlier drafts mis-scoped this room — first by treating it as integrated with the allocator workshop, then by talking about "inner/outer rooms" as if there were nesting. Both wrong. This revision treats the trigger room as a **standalone work room**: builds a single self-contained module type, saves it to a library, that's it. No nesting, no implicit connection to other rooms, no league-apply step.

## What this room is

A standalone work room for authoring **Trigger** modules. A Trigger is a self-contained "if/then" rule — TYPE / CONDITION / ACTION / RE-ARM — that the runtime fires at the right phase of a match. Compositions today bundle 5-8 hardcoded triggers each; this room lets an LO build their own and save them to their library.

The trigger module knows only its own job. It does not know:
- What runs before it.
- What runs after it.
- What scoring system it lives in.
- What other modules sit alongside it.

That's by design — modules are independent. The scoring system room (future, doesn't exist yet) is where modules get assembled together, ordered, and applied to leagues.

## What this room is NOT

- **NOT inside the allocator room.** The allocator room and the trigger room are independent work rooms, each in its own folder, each with its own page, list, library, save flow, DB table, loader, validator. They share zero state.
- **NOT a "version" or extension of the allocator room.** Same patterns, different module.
- **NOT a place that applies triggers to leagues.** The trigger sits in the LO's library. Applying it to a league happens later, in the scoring system room.
- **NOT where ORDER gets set.** Order is a scoring system concern. A trigger by itself has no position number.
- **NOT a place where composition-specific data (thresholds, start-points credits) is referenced.** Same universal-only principle the allocator room follows: the picker exposes only state-bag names every match has regardless of which other modules are wired in.

The allocator room is a **blueprint** — same SHAPE we follow (storage, loader, save-time guard, snapshot freeze when applicable, library + officials, list + editor UI, etc.) — but it's a reference, not a parent or sibling we reach into at runtime.

## Foundation (locked, carries from the building brainstorm)

- Modules talk ONLY through the state bag. A trigger reads state-bag names; a trigger writes one name. Nothing else couples it to other modules.
- Two non-negotiables: lineup/scoring pages always render; per-game W/L always recorded.
- Four guard layers between a saved row and the runtime: save-time guard (editor), read-time validator (loader), snapshot freeze (at match start — applies once triggers get used through a scoring system in the future), runtime backstop (already exists in `fireTrigger`).

## Locked spec — `trigger.md`

The canonical Trigger model is locked. A Trigger has six parts; only the first four matter for this room. ORDER and DISPLAY are out of scope.

- **TYPE** — `match_start` / `match_end` / `anytime`. When it fires.
- **CONDITION** — `always`, or a single flat comparison (`==`, `>`, `<`, `>=`, `<=`) between two operands (state-bag var or literal).
- **ACTION** — writes ONE state-bag var. Value is either a literal `set` or an `Expression` tree.
- **RE-ARM** — `single_shot` (default), `periodic`, `manual`.
- ~~**ORDER**~~ — set by the scoring system room (future). Not the trigger module's concern.
- ~~**DISPLAY**~~ — minor; flagged in the locked doc as likely to relocate. Skip.

The runtime already executes triggers (see `runtime.ts` `fireTrigger` — has had the never-throw discipline since the original implementation). This room makes them AUTHORABLE; the engine stays unchanged.

## Universal-only data — same principle the allocator room follows

The picker exposes ONLY state-bag names every match has regardless of which other modules are wired in. Composition-specific names (thresholds, start-points credits, edge/endmatch signals) belong to OTHER modules' contracts and become available only once those modules formalize how to expose them.

### Read targets (CONDITION operands + ACTION expression vars)

Universal state-bag names every match has, regardless of composition:

- `home_wins`, `away_wins` — running team wins
- `home_points`, `away_points` — running team points
- `home_team_handicap`, `away_team_handicap` — locked totals from `match_lineups`
- `games_played`, `total_games` — match progress
- Per-player counters the runtime maintains: `home_player_N_wins`, `home_player_N_points` (N = 1–5), same for away

**Note: no role-based virtuals.** Triggers fire at fixed phases of the match, not "per side." The allocator's `this_side_*` / `other_side_*` virtuals don't apply here — the trigger picker uses team-named entries (`home_wins`, `away_wins`) directly.

### Write targets (ACTION target picker)

Triggers WRITE one state-bag name per fire. v1 restricts the write-target picker to the two universal team running totals:

- `home_points` — labeled "Home team points"
- `away_points` — labeled "Away team points"

Other useful write targets exist (composition control signals like `edge` / `endmatch`, custom milestone bonus names) but aren't universal. They become available only once the relevant modules formalize their contracts.

Decision (locked with Ed during brainstorm): no custom state-var names in v1. A custom name without a corresponding reader is dead code; if a real use case shows up later we revisit.

## Shared UI: reusable formula widget

The allocator room ships `FormulaBuilder` — click-to-build expression UI with cursor, available-data dropdown, click-to-remove pills, keyboard arrows, paren handling. It currently bundles role-perspective stuff ("Winner base" vs "Loser base" labels).

Refactor: peel the role perspective out. The bottom layer becomes a generic `ExpressionBuilder` widget. The allocator room wraps it with role-perspective logic; the trigger room uses the bare widget directly.

This keeps the two rooms independent (own DB / own loader / own page / own logic) while making the LO's hands feel identical when building expressions in either room. Same look, same feel, same cursor behavior, same click-to-remove.

The widget takes available data as a prop. Each room provides its own list; the widget just renders + handles cursor + tokens. No coupling beyond the shared widget API.

## What carries over from the per-game allocator room

Same precedent, no re-debate (the allocator room set these patterns; the trigger room follows them in a parallel codepath):

- **Storage shape.** New table `triggers` — same backbone columns (id, name, description, scope, author_id, timestamps) plus trigger-specific JSONB columns mirroring the in-memory `Trigger` type 1:1.
- **Library + officials.** User-scope authoring + read-only seeded officials. Tamper trigger blocks UPDATE/DELETE on official rows.
- **Loader.** `loadTrigger(id)` mirrors `loadPerGameAllocator(id)` — fetch, validate, return `Trigger | null`, never throws.
- **Workshop UI shape.** List view (Yours + Templates) + editor + save-time guard. Lives under `src/operator/scoring-workshop/trigger/`.
- **Save-time guard.** Validator + a small in-isolation dry-run (one fake match-start fire) before persisting. Refuses bad rows inline.
- **Workshop home page entry.** The workshop list page gets a new card for the trigger room.

## Editor sub-components

The trigger editor's UI surface, in order:

- **Name + description** — text inputs.
- **TYPE picker** — three radio choices: Fires at match start / Fires at match end / Fires during the match (anytime).
- **CONDITION builder** — a small "always | when {operand} {comparator} {operand}" picker. Each operand is either a state-bag read (from the universal list above) or a typed number. The comparator is a dropdown of the five locked operators.
- **ACTION builder** — target picker (Home team points / Away team points) + value: either a literal number (set kind) OR an `ExpressionBuilder` tree (expr kind).
- **RE-ARM** dropdown — Fires once per match / Fires every time the condition is true / Resets manually.
- **Save / Cancel.**

The "Save" button runs the same kind of save-time guard the allocator room does — validator + a small synthetic firing test.

## Seeded officials (templates)

Four or five seeded read-only triggers as starting templates. Each demonstrates one of the trigger model's interesting patterns:

- **"Initial credit" template** — TYPE match_start, CONDITION always, ACTION set home_points to (some literal). Pattern: the start-points award.
- **"Game-N bonus" template** — TYPE anytime, CONDITION games_played == 13, ACTION add 5 to home_points. Pattern: per-game milestone.
- **"Sweep bonus" template** — TYPE match_end, CONDITION home_wins > X, ACTION add Y to home_points. Pattern: end-of-match formula.
- **"Empty starter" template** — minimal placeholder for cloning to build from scratch.

(Exact templates can be finalized in the plan; the goal is to teach the LO what TYPE × CONDITION combinations are possible by example.)

## What's out of scope

Everything below belongs to future rooms, not this one:

- **Applying triggers to leagues.** Belongs to the scoring system room (future).
- **Setting ORDER (fire-order number, beforeAllocator bool).** Belongs to the scoring system room.
- **Per-trigger configuration in a specific scoring system context** (e.g., letting the LO re-bind a generic trigger to reference `milestoneTarget` once a threshold module is also plugged in). Belongs to a future per-trigger-in-system config room.
- **Custom state-var names.** Deferred — useless without a reader.
- **Threshold/start-points/composition-specific names in the picker.** Future, when other module rooms formalize their contracts.
- **Composition-control signals (`edge`, `endmatch`) as write targets.** Future, when the win-calc room formalizes its contract.
- **Inline LO-help (InfoButtons, glossary entries).** Lives in the doc-inventory file from the allocator room; rolls out via Phases 3-5 of the docs work.

## Decisions, locked

All four "open questions" from the previous drafts are now closed:

1. **Write-target picker scope:** `home_points` / `away_points` only. No custom names.
2. **Refactor:** extract a generic `ExpressionBuilder` from `FormulaBuilder`. Both rooms use it.
3. **League integration:** N/A — out of scope for this room.
4. **Order interleave with prepackaged:** N/A — out of scope for this room.

Ready for planning.
