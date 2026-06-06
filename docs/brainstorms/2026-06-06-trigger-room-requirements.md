---
title: Trigger Room — Requirements (Workshop's Second Room)
status: open
created: 2026-06-06
foundational_brainstorm: docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md
locked_spec: docs/league-system/modules/points-system/trigger.md
predecessor_room: docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md
---

# Trigger Room — Requirements

> **Rewritten 2026-06-06.** First draft tried to define the trigger room in terms of how it integrated with the per-game allocator workshop. That was wrong-framed. Modules talk only via the state bag — the trigger room is its own concern with its own architecture. This rewrite treats the trigger room as a standalone module the same way the allocator room was a standalone module.

The Workshop building's second room. Authors **Triggers** — the if/then primitive that does jumps, edge markers, end-of-match scoring formulas, and start-points award patterns inside today's prepackaged compositions. Same pattern as the per-game allocator room: turn what's TS code today into LO-authorable data.

The first room (Per-Game Allocator) shipped via [PR #179](https://github.com/jacked-apps/rackem-leagues/pull/179). This room reuses every guard-layer pattern that room established; what's new is the trigger primitive's own shape.

## Why this room is the right next step

- It's the next module that needs LO authoring. Compositions today bundle 5-8 triggers each; the LO can't customize any of them without code changes.
- It only reads/writes through the state bag — same independence the allocator has. No new cross-module coupling to design.
- The patterns from the allocator room (storage, loader, save-time guard, snapshot freeze, four guards) carry over directly. The genuinely new design surface is small.

## Foundation (locked, carries from the building brainstorm)

- The Scoring System is the main component. Inside it are smaller modules; one room per module type.
- Modules talk ONLY through the state bag. A trigger reads names; a trigger writes one name. Nothing else couples it to other modules.
- Two non-negotiables: lineup/scoring pages always render; per-game W/L always recorded.
- Four guard layers between a saved row and the runtime: save-time guard (editor), read-time validator (loader), snapshot freeze (at match start), runtime backstop (try/catch in the runtime).

## Locked spec — `trigger.md`

The canonical Trigger model is locked. A Trigger is six parts:

- **TYPE** — `match_start` / `match_end` / `anytime`. When it fires.
- **CONDITION** — a single flat comparison (`==`, `>`, `<`, `>=`, `<=`) between two operands, or `always`. Operands are state-bag vars or literals.
- **ACTION** — writes ONE state-bag var. Value is either a literal `set` or an `Expression` tree.
- **RE-ARM** — `single_shot` (default), `periodic`, `manual`.
- **ORDER** — fire-order number + `beforeAllocator` bool (only meaningful for `anytime` type).
- **DISPLAY** — minor; flagged in the locked doc as likely to relocate. Ignore for v1.

The runtime already executes triggers (see `runtime.ts` `fireTrigger`). This room makes them AUTHORABLE; the engine stays unchanged.

## Universal-only data — same principle the allocator room follows

Per the architectural correction during the allocator room's audit: the picker exposes ONLY data that's universally in the state bag regardless of which other modules are wired into the league's scoring system. Composition-specific names (thresholds, start-points credits, edge/endmatch signals) belong to OTHER modules' contracts and surface here only once those modules formalize how to expose them.

### Read targets (CONDITION operands + ACTION expression vars)

Universal state-bag names every match has, regardless of composition:

- `home_wins`, `away_wins` — running team wins
- `home_points`, `away_points` — running team points
- `home_team_handicap`, `away_team_handicap` — locked totals from `match_lineups`
- `games_played`, `total_games` — match progress
- Per-player counters the runtime maintains: `home_player_N_wins`, `home_player_N_points` (N = 1–5), same for away

Triggers are not side-agnostic the way the allocator is — a trigger fires at a fixed phase of the match, not "per side." So the role-based virtuals (`this_side_*`) don't apply here. The trigger picker uses team-named entries directly.

### Write targets (ACTION target picker)

Triggers WRITE one state-bag name per fire. The write-target picker is the trickiest piece — most useful targets are composition-specific (the `edge` signal that declares a winner, the `endmatch` flag that terminates early, custom milestone bonus names compositions invent). Exposing them here means coupling to those compositions.

v1 candidates for the universal-only write list:

- `home_points`, `away_points` — running team points. Always present; always meaningful.

That's basically it. Other useful write targets exist (custom state vars, control signals) but aren't universal.

**Open Question 1 (write-target picker):**

- **1a.** v1 only allows writing to `home_points` / `away_points`. LO can build "give the home team 5 extra points when X happens" triggers, but nothing more elaborate. Smallest, safest.
- **1b.** v1 also allows the LO to **introduce a custom state-var name** (free-text but namespaced — e.g., the LO's variation declares `clutch_bonus` as a new var). Other triggers in the same variation set can read/write it. Lets the LO build more interesting interlocking trigger sets at the cost of one free-text input (mitigated by namespacing rules — say, "must start with `custom_`").

Recommendation: **1a for v1**. Custom var names are powerful but introduce a footgun footprint; defer to when the composition-assembly room exists.

## What carries over from the per-game allocator room

Same precedent, no re-debate. Lists them briefly so reviewers don't burn cycles re-deciding:

- **Storage shape.** New table `triggers` — same backbone columns (id, name, description, scope, author_id, timestamps) plus trigger-specific JSONB columns mirroring the in-memory `Trigger` type 1:1.
- **Library + officials.** User-scope authoring + read-only seeded officials. Tamper trigger blocks UPDATE/DELETE on official rows.
- **Loader.** `loadTrigger(id)` mirrors `loadPerGameAllocator(id)` — fetch, validate, return `Trigger | null`, never throws.
- **Workshop UI shape.** List view (Yours + Templates) + editor + save-time guard. Lives under `src/operator/scoring-workshop/trigger/`.
- **Save-time guard.** Validator + synthetic-match dry-run via `evaluatePointsSystem`. Refuses bad rows inline.
- **Snapshot freeze.** Trigger variations applied to a league are embedded as resolved Trigger objects in `match.system_snapshot` at match start. Editing a row later cannot retroactively change historical scoring (R9).
- **Runtime backstop.** Already exists. `fireTrigger` has had the never-throw discipline since the original runtime — LO-authored triggers ride this without any new code.
- **Four-guard contract** unchanged.

## What's new (trigger-specific)

### Editor sub-components

Triggers compose differently from allocators. The editor needs:

- **TYPE picker** — 3 choices.
- **CONDITION builder** — a small two-operand-plus-comparator picker. Each operand is either a state-bag var (from the read-targets list above) or a typed-in number. New component; smaller than the allocator's `FormulaBuilder`.
- **ACTION builder** — target picker (Open Question 1) + value: either a literal `set` (typed-in number) OR an `Expression` tree (built from the same click-to-build UI the allocator uses for its formula).
- **RE-ARM** dropdown — 3 choices.
- **ORDER** inputs — number input + a `beforeAllocator` checkbox (only meaningful for `anytime` triggers; greyed out for the other types).

### Reusable ExpressionBuilder (refactor)

The allocator's `FormulaBuilder` builds expressions for one specific side; labels flip with perspective. The trigger's ACTION expression has NO side perspective — it's just an arithmetic expression over state-bag names.

**Open Question 2:** extract a sharable `ExpressionBuilder` from `FormulaBuilder`?

- **2a.** Yes — `ExpressionBuilder` takes optional `perspective`. The allocator's `FormulaBuilder` becomes a thin wrapper that always passes a perspective. The trigger's ACTION expression uses the bare `ExpressionBuilder` with no perspective.
- **2b.** No — duplicate the relevant pieces. Smaller PR diff but two copies to maintain.

Recommendation: **2a (extract)**. Small refactor; pays dividends as more rooms use the click-to-build pattern.

## League integration — how a trigger gets onto a league's scoring system

This IS the trigger room's own concern (not borrowed from anywhere else's pattern). Two v1 options:

### Model A — Library only

The room ships authoring + saving. League-side integration deferred to a future "composition assembly" room (or whichever room ends up owning the "how do I customize my league's full trigger list" UI).

- Pro: smallest scope. Decouples authoring from integration. Ships a clean library.
- Con: LO can build but can't USE on a real league. Less satisfying. Hard to test end-to-end through live scoring without a synthetic integration.

### Model B — Additive "extra triggers" slot

Add a new league preference `extra_triggers UUID[]`. When non-null, the runtime APPENDS the resolved triggers to whatever the prepackaged composition declares. Same fire-order rules apply (the runtime sorts everything by `order.number` within each phase, so LO triggers interleave by their declared order).

- Pro: end-to-end usable. LO can layer custom behavior on top of any prepackaged composition.
- Con: LO can't REMOVE a prepackaged trigger (so no way to, say, drop Percent 5-Man's milestone jumps). Order interleaving with prepackaged triggers means the LO has to know what `order.number` values the prepackaged composition uses (or we document the convention — see Open Question 4).

**Open Question 3:** Model A or Model B for v1?

Recommendation: **Model B**. Same shape decision as the allocator room's slot-swap — additive is the smallest end-to-end usable scope.

**Open Question 4 (only if Model B):** How do LO-added triggers interleave with prepackaged ones by ORDER?

- **4a.** Strict by `order.number`. LO has to know prepackaged numbers to fire at the right time. Hard for an LO to reason about.
- **4b.** LO triggers always run AFTER prepackaged triggers in the same phase, regardless of `order.number`. Predictable; LO sees post-prepackaged state.
- **4c.** Document a convention (e.g., "prepackaged compositions use order.number 1-100; LO triggers should use 101+"). The LO picks an order.number knowing where they sit.

Recommendation: **4b**. Most predictable; LO doesn't need to reverse-engineer prepackaged numbering.

## Tentative v1 scope (assuming the recommended answers)

In scope:

- DB table `triggers` + tamper trigger + ~5–6 seeded officials (one example per TYPE × interesting pattern: a match_start initial-credit trigger, an anytime "give 5 points at game 13" trigger, a match_end "double points if you swept" trigger, etc.).
- Loader + tightened validator + save-time guard.
- Workshop room UI: list + editor (TYPE picker + CONDITION builder + ACTION builder + RE-ARM dropdown + ORDER inputs).
- Refactor: extract `ExpressionBuilder` from `FormulaBuilder` (Open Question 2 = 2a).
- League-side: `extra_triggers UUID[]` preference + multi-select picker in League Settings. Apply-time preview runs the composition with the appended triggers.
- Snapshot extension: `system_snapshot.extra_triggers` stores resolved `Trigger[]` at match start.
- Live-scoring: `match-adapter.ts` `buildComposition` accepts `extraTriggers: Trigger[]`; appends to composition's `triggers` array (with Open Question 4's rule for ordering).
- Tests: schema + loader + validator + runtime backstop already covers + apply-time + snapshot R9.
- Architectural doc update (`docs/league-system/modules/points-system/workshop.md`) noting the second room and the universal-only principle applied to triggers.

Out of scope:

- Removing or disabling prepackaged triggers (would need wholesale list replacement — a separate decision).
- Custom state-var name introduction (Open Question 1 = 1b).
- Threshold-derived names in the picker (composition-specific; future).
- Composition-control signals like `edge` / `endmatch` as write targets (composition-specific; future).
- The composition-assembly surface.
- Inline LO-help on the trigger room UI (lives in the doc-inventory file; rolls out via Phase 3-5 of the docs work).

## Open questions summary (what I need from you)

1. **Write-target picker scope: 1a (home_points/away_points only) or 1b (allow custom namespaced names)?** Recommendation: 1a.
2. **Refactor: extract `ExpressionBuilder` from `FormulaBuilder` (2a) or duplicate (2b)?** Recommendation: 2a.
3. **League integration: Model A (library only) or Model B (additive extra_triggers slot)?** Recommendation: B.
4. **(Only if B) Order interleave: 4a strict by number / 4b LO after prepackaged / 4c documented convention?** Recommendation: 4b.

Greenlight the four → I move to planning. Push back on any → we iterate here.
