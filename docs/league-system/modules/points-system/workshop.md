---
title: Workshops — architecture (Points System modules)
status: living
audience: developer + AI sessions
locked: false
---

# Workshops — architecture (Points System modules)

> **Unlocked, living doc.** Updates as the workshops and their surrounding infrastructure evolve. Not the locked Points System spec — that lives in `README.md` next to this file. This doc captures the *workshop side* (LO authoring + persistence + live-scoring wiring), with enough mental model that a future maintainer (or future you) can read code changes without reconstructing the design from git history. Two module workshops are open today: the Per-Game Allocator workshop and the Trigger workshop.

## Foundation — what the workshops building is

The Scoring System is the main component of the app. Inside it are smaller, single-responsibility components. The Workshops building houses one module workshop per component type — somewhere an LO can build variations of that single piece. The Per-Game Allocator workshop was the first one open; the Trigger workshop is the second. A future "Scoring System workshop" will be itself a workshop in this building — the one where an LO grabs a whole scoring system and edits all its module slots in one place; until that workshop exists there's no *system-level* assembly surface, only the *module-level* workshops listed below.

The framing in three sentences:

1. **The runtime is code.** It runs the math, never edited by LOs.
2. **A variation is data.** A row in `per_game_allocators` carries the dials. LOs author it, save it, apply it to leagues.
3. **The workshop is the guardrail.** The runtime trusts whatever the workshop ships. The workshop refuses to ship anything that would crash live scoring.

Locked foundational framing brainstorm: `docs/brainstorms/2026-06-04-scoring-system-workshop-building-requirements.md`. Plan: `docs/plans/2026-06-04-002-feat-per-game-allocator-room-plan.md`.

## SideConfig — base + formula

A per-game allocator has two sides (winner, loser). Each side is a `SideConfig` shape (defined in `src/systems/points-system/types.ts`):

```text
SideConfig {
  base: number | { min, max, label },
  formula: null | { operationKind, operationArgs }
}
```

- **Base** — the side's starting value for the game. Either a fixed number (e.g., winner = 10) or a scorer-input range (e.g., loser = 0–7 balls pocketed, clamped on entry).
- **Formula** — optional transformation. When present, the formula's return value IS the side's final value (the base flows through `this_side_value` if the formula references it). When absent, the resolved base IS the final value.

Both fields are independent — base shape (fixed/range) and formula presence (on/off) compose freely. The workshop's UI mirrors this with two visible sections per side.

**Runtime resolution order** (in `allocator-evaluator.ts`):
1. Resolve `base` to a number (the scorer input for ranges; the literal otherwise).
2. Build a `FormulaContext` carrying the resolved bases + game metadata.
3. If formula present, call `operation.compute(args, ctx, state)`; otherwise return the resolved base.

## Side-agnostic / role-based design

The allocator runs per side (winner / loser of **this** game), not per team (home / away). A formula that says "winner gets `home_wins` points" would be unfair to away winners every game. Instead, the LO sees **role-based virtual names** that the runtime resolves at compute time:

- `this_side_*` → the role this formula is currently computing for (winner side formula: this side IS the winner this game)
- `other_side_*` → the opposite role

The Proxy in `evaluate-expression.ts` (`virtualStateAliases`) maps `this_side_wins` → `${thisTeam}_wins` where `thisTeam` is derived from `ctx.thisSide × ctx.winnerSide`. The runtime maintains the team-keyed entries; the formula reads the role-keyed virtuals.

UI labels also flip with perspective: the same virtual `this_side_wins` reads as "Winner team games" in the winner-side editor and "Loser team games" in the loser-side editor. Implementation: `availableData.ts` entries' `label` field is a function of `SidePerspective`.

## Available data — three categories

Every entry in the available-data dropdown falls into one of three categories. Knowing which category an entry belongs to predicts when its value is meaningful:

1. **Per-game role values** — `this_side_value`, `other_side_value`, `this_side_handicap`, `other_side_handicap`. Resolve from `FormulaContext` (set per game by `allocator-evaluator.ts`). Always present when the runtime has positions; otherwise fall back to 0.

2. **Match-locked values** — `this_side_team_handicap`, `other_side_team_handicap`, `total_games`, threshold names (`winTarget`, `tieTarget`, `milestoneTarget`). Written into the state bag once at match start. Constant across all games. Thresholds depend on the league's prepackaged composition writing them.

3. **Match-cumulative running totals** — `this_side_wins`, `this_side_points`, `this_side_player_wins`, `this_side_player_points`, `games_played`. Updated by the runtime as each game is processed. Per-player counters use the position on the game record to index `${team}_player_${pos}_wins` style state-bag entries.

## The expression tree

The click-to-build formula UI emits `evaluate_expression` recipes. The args carry an `Expression` tree — the same tree shape triggers use, defined in `types.ts`:

```text
Expression =
  | { kind: 'const', value: number }
  | { kind: 'var', name: string }
  | { kind: 'op', op: '+' | '-' | '*' | '/', left: Expression, right: Expression }
```

The token-builder UI maintains a flat array of build tokens (var/const/op/paren) for display + edit. On every change it parses the tokens into a tree via `formulaTokens.ts`'s recursive-descent parser. Successful parse → the tree is pushed into `SideConfig.formula.operationArgs.expression`. Failed parse (mid-build state) → the tree stays at its last good value; the parse-error message renders inline.

Grammar (informal): `expr := term (op term)*`. Left-associative chain with no precedence — `a + b * c` parses as `((a + b) * c)`. LOs use parens to force grouping. Parens for the LO are an explicit operator with their own pills; they're not merely visual.

The Proxy in `evaluate-expression.ts` wraps the state bag so var lookups resolve through:
1. **`virtualCtxValues`** — direct injection from FormulaContext (this_side_value, other_side_value, handicap virtuals)
2. **`virtualStateAliases`** — name-to-name mapping (this_side_wins → home_wins / away_wins based on ctx)
3. **Raw state lookup** — for any other name (the threshold names like `winTarget` work this way)

## The four guard layers

Between a saved variation row and the runtime there are four guards. Each catches a different failure mode. Each fails closed (the runtime never sees an uncertified row, and a row that throws at compute is contained).

1. **Save-time guard** (`saveTimeGuard.ts`, inside the editor's Save button).
   - Runs `validatePerGameAllocator` on the in-memory object.
   - Runs a synthetic 5-game dry-run through `evaluatePointsSystem`.
   - Returns `{ok}` or `{ok:false, reason}` rendered inline. Refuses to persist on failure.

2. **Read-time validator** (`per-game-allocator-loader.ts`).
   - Loader runs `validatePerGameAllocator` on every read.
   - Failure → console.warn + return `null`. Loader is never-throw.
   - Catches rows that bypass the editor (direct DB writes, schema drift).

3. **Snapshot freeze** (`populateMatchSnapshotIfNeeded` in `matches.ts`).
   - At match start, the snapshot writer calls `loadPerGameAllocator(id)` and **embeds the resolved object** in `match.system_snapshot.per_game_allocator`.
   - Live scoring reads the embedded object directly. Editing the source row after match start cannot retroactively change scoring (R9 of the workshop's plan).

4. **Runtime backstop** (`runtime.ts`, wrapping `evaluateAllocator`).
   - Mirrors the existing `fireTrigger` never-throw discipline.
   - On any throw inside the allocator path: console.warn + skip this game's points contribution + continue.
   - The W/L tick already happened above the catch; games-won always records.

The non-negotiables: lineup/scoring pages always render; each game's W/L is always recorded.

## Live-scoring wiring

The path from "LO sets pointer" to "match scores with the variation":

```
preferences.per_game_allocator_id
        ↓ (resolved_league_preferences view cascades)
ResolvedSystemConfig.per_game_allocator_id
        ↓ (snapshot writer: loadPerGameAllocator + embed)
match.system_snapshot.per_game_allocator (resolved PerGameAllocator object)
        ↓ (engineRunningTotals.ts reads snapshot)
computeMatchRunningTotalsViaEngine({..., perGameAllocatorOverride})
        ↓ (match-adapter.ts buildComposition swaps the slot)
PointsSystem with override in perGameAllocator slot
        ↓
evaluatePointsSystem → runtime → final totals
```

**Critical:** `buildSystemFromPreferences.pickPointsSystem` ALSO accepts the override (for parity with the snapshot-write path + future consumers), but the live-scoring SOURCE OF TRUTH is the `match-adapter` swap. `pickPointsSystem` isn't on the live-scoring hot path today; the parity exists so the two paths can't silently drift.

When `preferences.per_game_allocator_id` is `NULL`, both paths produce byte-equivalent output to today's prepackaged compositions — proven by `cross-audit-*.test.ts`.

## Tests pinning the contract

- `__tests__/database/per-game-allocator-schema.test.ts` — DB schema, seeded officials, CHECK constraints, tamper trigger, FK cascade.
- `__tests__/database/17-point-smoke.test.ts` — full pipeline DB → loader → adapter → engine for both 17-Point templates.
- `__tests__/per-game-allocator-loader.test.ts` — every loader failure path (missing row, malformed JSONB, args mismatch, unregistered op).
- `__tests__/composition-validator-args.test.ts` — every argsShape rejection case.
- `__tests__/evaluate-expression-side-agnostic.test.ts` — side-agnostic resolution for this/other side virtuals.
- `__tests__/evaluate-expression-handicap.test.ts` — per-game handicap resolution.
- `__tests__/runtime-allocator-safety.test.ts` — Unit 4 never-throw discipline; a thrown allocator can't escape into the scoring loop.
- `__tests__/snapshot-and-swap.test.ts` — R9 historical replay stability; override applied / absent; parity.
- `__tests__/17-point-via-match-adapter.test.ts` — R10 acceptance through the live-path adapter.

## Persistence — forward compatibility

The JSONB stored in `winner_side` / `loser_side` mirrors `SideConfig` byte-for-byte. New available-data entries are just new string names variations can reference; old variations that don't reference them are unaffected. New formula operations (added later) register themselves at import time; old variations using `evaluate_expression` keep working because the tree shape doesn't change.

What WOULD break old variations: removing an `operationKind` they reference, or changing the `evaluate_expression` recipe's expression-arg shape. Both are explicit choices the maintainer can avoid.

## What lives in this workshop (file map)

```text
src/operator/scoring-workshop/per-game-allocator/
  AllocatorRoomPage.tsx        # page container; list <-> edit mode
  AllocatorList.tsx            # Yours + Templates sections
  AllocatorEditor.tsx          # name, description, two SideEditors, save
  SideEditor.tsx               # Base section + Formula section
  FormulaBuilder.tsx           # click-to-build + cursor + arrow keys
  formulaTokens.ts             # token <-> Expression tree round-trip
  availableData.ts             # curated registry with perspective-aware labels
  useAllocatorRoom.ts          # data hook (list, clone, upsert, remove)
  saveTimeGuard.ts             # validator + dry-run before save
  AllocatorPicker.tsx          # league-settings picker
  applyTimePreview.ts          # league-side preview helper

src/systems/points-system/
  per-game-allocator-loader.ts                      # row -> in-memory PerGameAllocator
  composition-validator.ts                          # validatePerGameAllocator + args shape
  runtime.ts                                        # never-throw backstop around allocator call
  match-adapter.ts                                  # live-scoring swap point
  allocator-formula-operations/
    evaluate-expression.ts                          # the recipe + virtual name Proxy
    add-complement-of-other-side.ts                 # legacy recipe (kept for back-compat)
    state-diff-times-constant.ts                    # behind-boost recipe
    read-state-var.ts                               # legacy single-var recipe

supabase/migrations/
  20260604000000_per_game_allocator_room.sql        # table + officials + trigger
```

# Trigger workshop

Second standalone module workshop. Authors `Trigger` modules — the if/then primitive that fires at match start, mid-match, or match end. Brainstorm: `docs/brainstorms/2026-06-06-trigger-room-requirements.md`. Plan: `docs/plans/2026-06-06-001-feat-trigger-room-plan.md`.

## What a Trigger is

A trigger has four LO-visible parts (the spec lives in `docs/league-system/modules/points-system/trigger.md`):

- **TYPE** — `match_start | anytime | match_end`. Which phase the runtime fires it in.
- **CONDITION** — `{ kind: 'always' }` OR `{ kind: 'compare', left, op, right }`. Pure boolean check; never computes.
- **ACTION** — writes ONE named state-bag variable. The value is either a literal (`{ kind: 'set', value }`) or an `Expression` tree (`{ kind: 'expr', expr }`).
- **RE-ARM** — `single_shot | periodic | manual`. Controls re-firing within a match.

Order is intentionally NOT a row column. The trigger workshop never controls fire order — that's a *Scoring System workshop* concern (future). The loader synthesizes `order: { number: 0, beforeAllocator: false }` on every read; assembly later overrides.

## Universal-only available data

The trigger workshop's CONDITION and ACTION pickers expose **only** state-bag entries the runtime maintains in every match regardless of which other modules are wired in. `trigger/availableData.ts` enumerates the read universe:

- Team totals: `home_wins`, `away_wins`, `home_points`, `away_points`.
- Team handicap totals: `home_team_handicap`, `away_team_handicap` (set at match start).
- Match-level counters: `games_played`, `total_games`.
- Per-position counters: `home_player_N_wins` / `home_player_N_points` / `away_player_N_wins` / `away_player_N_points` for `N` ∈ 1..5 (20 entries).

Composition-specific names (threshold outputs like `winTarget`, allocator-and-trigger semantics like `edge` / `endmatch`) are deliberately excluded. They depend on other modules being plugged in. Once a future Threshold workshop exposes those names, that workshop — not this one — surfaces them in its own pickers. Locking the universal-only contract here keeps the trigger module honest about what's actually going to be in the state bag at runtime.

## Write-target whitelist (v1)

The ACTION's target field is restricted to a small set: `home_points` and `away_points`. `trigger/availableData.ts` exports `TRIGGER_WRITE_TARGETS`; the save-time guard passes that list to `validateTrigger`'s `allowedTargets` option; the loader passes the same list at read time. This is intentionally narrow for v1 — it covers the universal scoring outcome a trigger can write without depending on other modules. The future Scoring System workshop can widen the write universe (e.g., allow writing to threshold-introduced markers like `edge`) once those modules are formalized.

`validateTrigger` defaults to allowing any target when no whitelist is provided. Prepackaged compositions (which legitimately write to `edge` / `endmatch` / custom milestone names) get the default behavior; only the trigger workshop passes the whitelist.

## ExpressionBuilder reuse

The trigger workshop's ACTION expression UI imports `src/operator/scoring-workshop/_shared/ExpressionBuilder.tsx` directly. The widget is perspective-free — it takes a flat list of available data (already-resolved label strings) plus a `labelForVar` callback. The per-game allocator's `FormulaBuilder.tsx` is now a thin wrapper that adds Winner/Loser perspective on top before forwarding to the same widget.

This is the only piece of code the two workshops share. State, types, persistence, and runtime paths stay completely independent.

## The four guard layers (same shape)

The trigger workshop follows the same four-layer guard discipline as the per-game allocator workshop:

1. **Save-time guard** (`trigger/saveTimeGuard.ts`).
   - Runs `validateTrigger(trigger, { allowedTargets })`.
   - Runs a synthetic 5-game dry-run through `evaluatePointsSystem` with the trigger as the only one in a stub composition.
   - Returns `{ok}` or `{ok:false, reason}` rendered inline.

2. **Read-time validator** (`src/systems/points-system/trigger-loader.ts`).
   - Loader runs `validateTrigger` on every read.
   - Failure → console.warn + return `null`. Loader is never-throw.

3. **Snapshot freeze** — deferred. There's no apply-to-league surface yet; that lands when the Scoring System workshop exists. Until then, R9 historical replay isn't load-bearing for triggers because they aren't yet attached to leagues.

4. **Runtime backstop** (`src/systems/points-system/runtime.ts`, inside `fireTrigger`). Pre-existing — wraps every trigger evaluation in try/catch. A trigger that throws gets logged + skipped; the match continues.

## What lives in this workshop (file map)

```text
src/operator/scoring-workshop/trigger/
  TriggerRoomPage.tsx          # page container; list <-> edit mode
  TriggerList.tsx              # Yours + Templates sections
  TriggerEditor.tsx            # name, desc, TYPE, condition, action, rearm
  ConditionBuilder.tsx         # always | compare picker
  ActionBuilder.tsx            # target + value (set | expr)
  availableData.ts             # universal-only registry + write whitelist
  useTriggerRoom.ts            # data hook (list, clone, upsert, remove)
  saveTimeGuard.ts             # validator + dry-run before save

src/operator/scoring-workshop/_shared/
  ExpressionBuilder.tsx        # perspective-free widget shared with the allocator

src/systems/points-system/
  trigger-loader.ts            # row -> in-memory Trigger
  composition-validator.ts     # validateTrigger (called from loader, guard, and validatePointsSystem)

supabase/migrations/
  20260606000000_trigger_room.sql   # table + 4 officials + tamper trigger
```

## Why the workshops are independent

The trigger workshop and the per-game allocator workshop each own their own table, loader, validator path, and UI components. The decision is structural: a module talks to the rest of the system only via the state bag ([[feedback_state_bag_starts_empty]] / [[feedback_modules_are_data_not_code]]). Coupling two workshops at the UI layer would smuggle that violation back in.

The only shared code is `_shared/ExpressionBuilder.tsx`. It's pure UI — no state, no validation, no persistence. Sharing it doesn't couple the workshops; it just avoids duplicating cursor + token logic.

## What's NOT in this workshop (out of scope today)

- The Threshold workshop, Win Calculator workshop, Handicap Mechanism workshop, and the Scoring System workshop itself — separate future plans.
- The assembly surface (a UI where the LO composes a full Scoring System from picks across module workshops) — IS the future Scoring System workshop. Comes after enough module workshops exist for the joints to be obvious. The trigger workshop intentionally has NO apply-to-league surface today; that's an assembly concern.
- Authoring new formula recipes — only LO-fillable existing recipes. Recipe development is a dev task.
- Org-shared libraries — variations are user-scoped; cross-staff sharing is future work.
