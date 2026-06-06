---
title: Per-Game Allocator Room — Workshop architecture
status: living
audience: developer + AI sessions
locked: false
---

# Per-Game Allocator Room — Workshop architecture

> **Unlocked, living doc.** Updates as the room and its surrounding infrastructure evolve. Not the locked Points System spec — that lives in `README.md` next to this file. This doc captures the *workshop side* (LO authoring + persistence + live-scoring wiring), with enough mental model that a future maintainer (or future you) can read code changes without reconstructing the design from git history.

## Foundation — what the workshop is

The Scoring System is the main component of the app. Inside it are smaller, single-responsibility components. The workshop is a building where each module type has its own work room. The Per-Game Allocator Room — the only room built today — is the first concrete application of the modules-as-data principle: the per-game allocator becomes a DB-row variation the LO authors and a league picks, instead of a hardcoded TS factory function.

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

Both fields are independent — base shape (fixed/range) and formula presence (on/off) compose freely. The room's UI mirrors this with two visible sections per side.

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
   - Live scoring reads the embedded object directly. Editing the source row after match start cannot retroactively change scoring (R9 of the room plan).

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

## What lives in this room (file map)

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

## What's NOT in this room (out of scope)

- The trigger room, threshold room, win-calculator room, handicap-mechanism room — separate future plans.
- The assembly surface (a UI where the LO composes a full Scoring System from picks across rooms) — comes after enough rooms exist for the joints to be obvious.
- Authoring new formula recipes — only LO-fillable existing recipes. Recipe development is a dev task.
- Org-shared libraries — variations are user-scoped; cross-staff sharing is future work.
