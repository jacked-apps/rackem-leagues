---
date: 2026-05-25
topic: pairings-generator-extraction
status: ready-for-planning
audience: developer + AI sessions
---

# Pairings Generator (Module #8) — v1 Extraction

## Problem Frame

The locked Module catalog recognizes **Pairings Generator** as Module #8 with
its own design doc (`docs/league-system/modules/pairings-generator.md`), but
the Module does not yet exist as a real, named slot in the code tree. The work
it does — turning lineup size + game-generation rule into the ordered list of
games for the night — lives in `src/utils/gameOrder.ts`, mixed in with a dead
hardcoded 18-game table (`GAME_ORDER_3V3`) and lookup helpers
(`getGameMatchup`, `getAllGames`, `verifyGameOrder`) that no live scoring code
calls anymore.

The point of v1 is **not** to change the algorithm — it's already correct and
already what scoring uses. The point is to create the **Module identity**: one
named, single-responsibility slot in the system where today's algorithm lives
*and* where tomorrow's alternative algorithms (snake, hand-crafted-per-lineup,
Swiss, etc.) can later plug in by satisfying the same input/output contract.

The unbuilt LO Workshop will eventually be what lets a league operator pick
between algorithm variants. v1 builds the slot the Workshop will plug into —
nothing further.

## Surprising findings from the scan (background for the reader)

1. **The "hardcoded 18-game table" is already dead code in the live scoring
   path.** The only live consumer (`src/hooks/lineup/useMatchPreparation.ts`)
   already calls `generateGameOrder(lineupSize, useDoubleRoundRobin)` — the
   algorithmic generator. The hardcoded table and its `getGameMatchup` /
   `getAllGames` helpers exist but have no live callers in scoring.
   `verifyGameOrder` proves the algorithm matches the table byte-for-byte.
2. **Stage 2 (Game Ordering) and Stage 3 (Break/Rack Assignment) are entangled
   in current code.** `generateGameOrder` computes `homeBreaks = round % 2 ===
   0` — the break-action is derived from the round number that Stage 2 walks.
   To make Stage 3 a real independent dial later, the stages must be
   untangled inside the Module during extraction.
3. **The canon doc's specific code references are examples, not
   requirements.** The canon
   (`docs/league-system/modules/pairings-generator.md`) was written as a
   recipe for the system as it should be — deliberately without leaning on
   today's half-cooked code. When the canon mentions `gameOrder.ts` /
   `getGameMatchup` / "computed inline" / etc., those are examples of how
   today's code happens to do it — not a contract that those exact
   names/files must survive a rebuild. After this extraction the canon's
   examples become stale (refer to code that's moved or gone), but the
   recipe itself is still right. A future canon refresh can update the
   examples; no lock-gate work is required for this extraction.

## Requirements

**Module identity**

- **R1.** Create a real Module folder: `src/systems/pairings/`. This is the
  single named slot. Today's algorithm is one file inside it; future
  alternative algorithms are peer files in the same folder.
- **R2.** The Module's single-purpose contract: given `lineupSize`,
  `gameGeneration` (`'single_round_robin' | 'double_round_robin'`), and the
  two locked lineups (each an ordered array of `player_id`, length
  `lineupSize`), produce an ordered list of game records (the "GameSlot
  list"). One call, one output, no side effects. (Naming convention: the
  Module's TS API uses camelCase — `lineupSize`, `gameGeneration`,
  `homePlayerId`, etc.; the caller maps these to the existing snake_case
  DB column names — `lineup_size`, `game_generation`, `home_player_id`,
  etc. — when building rows for the `prep_match` RPC. Standard TS-API /
  DB-column boundary.)
- **R3.** The Module **takes the lineups and emits player-id-tagged slots**
  (matches the locked canon doc). Each output slot names the specific home
  player and the specific away player for that game, so the scoring runtime
  consumes the slot list directly with no extra lookup step. Internally the
  Module may still organize its work in positions (Stage 1 rotation
  arithmetic) and resolve to player_ids at composition — that's an
  implementation choice, not a contract choice; the outer contract is
  player-id-shaped per the canon. Substitutions happen by direct in-place
  updates to `match_games.home_player_id` rows AFTER the Module has run;
  the Module is not re-invoked, so substitution-awareness is not in
  Module scope.

**Internal shape (the three stages, untangled)**

- **R4.** Inside the Module, the work is split into three pure functions
  composed in sequence. The inter-stage contracts:
  1. **Pair Generation** — `lineupSize` + `gameGeneration` + the two
     lineups → unordered bag of pairs, each
     `{ homePlayerId, awayPlayerId, homePosition, awayPosition }`. (Stage 1
     internally rotates positions and looks up the player_ids from the
     lineups — both shapes are carried through so downstream stages and the
     final output can present player identity AND positional context.)
  2. **Game Ordering** — unordered bag → ordered list of records, each
     `{ homePlayerId, awayPlayerId, homePosition, awayPosition,
        gameNumber, roundIndex }`, where `gameNumber` is 1..N (1-indexed,
     no gaps) and `roundIndex` is 0..totalRounds-1 (the round this slot
     belongs to, used by Stage 3). No break/rack info yet.
  3. **Break/Rack Assignment** — ordered list → final GameSlot list with
     `homeAction` / `awayAction` ('breaks' | 'racks') attached. Today's
     variant reads `roundIndex` from each input record and assigns
     `homeAction = roundIndex % 2 === 0 ? 'breaks' : 'racks'`.
- **R5.** Stages 2 and 3 must be **decoupled in code.** Stage 2 produces an
  ordered list of pairs annotated with `roundIndex` (a structural anchor),
  but no break/rack info. Stage 3 reads `roundIndex` (or whatever other
  structural anchor its variant cares about) and decides break/rack from
  its own rule. The point is that Stage 3's RULE — "per-round alternation"
  — lives ONLY in Stage 3; replacing Stage 3 with a different variant (e.g.
  "strict per-game alternation" that ignores `roundIndex` and uses
  `gameNumber % 2`) does not require touching Stage 1 or 2. This is the
  structural cost v1 pays so that Stage 3 can become an independent dial
  later without rewriting Stage 1 or 2.
- **R5a.** The caller-facing `GameSlot` output is:
  `{ gameNumber, homePlayerId, awayPlayerId, homePosition, awayPosition,
     homeAction, awayAction }` — player identity AND positional context,
  matching the existing `match_games` row shape that scoring already reads.
  `roundIndex` is a Stage-2-to-Stage-3 internal field and is NOT exposed in
  the outer output; the Module's composer strips it before returning. This
  keeps `useMatchPreparation`'s mapping into `match_games` rows
  straightforward (the Module hands back records whose fields line up
  directly with the DB columns; no position→player_id lookup step needed
  at the call site).
- **R6.** Narrow precondition only — assert `lineupSize` is a positive
  integer and `gameGeneration` is one of the two enum values; throw a typed
  error otherwise. No further validation inside the Module. The Workshop UI
  will be the LO-facing guardrail layer that prevents bad configurations
  from ever reaching the Module; the in-Module precondition is the
  belt-and-suspenders defense against accidental misuse by *any* caller
  (test fixtures, dev scripts, future code) before the Workshop exists.

**Today's algorithm ships as the single variant**

- **R7.** v1 ships exactly **one variant per stage** — today's behavior, byte
  for byte:
  - Pair Generation: full round-robin (Cartesian product), single or double.
  - Game Ordering: round-based rotation. Round `r` pairs home position `i`
    with away position `((i + r) % lineupSize)`.
  - Break/Rack Assignment: per-round alternation. Even-numbered rounds → home
    breaks; odd-numbered rounds → away breaks.
- **R8.** Double round-robin is conceptually "run the SRR rotation twice;
  break-action alternates by round." This is what today's code already
  does; capture it explicitly so the Stage 1 implementation can be simpler
  (generate single-pass pairs; duplicate for DRR) and Stage 3 still gets
  the same per-round alternation. (Note: the "breaker swap between passes"
  is only incidental for odd lineup sizes — 3v3, 5v5 — and does NOT hold
  for even sizes; the rule that holds for all sizes is per-round
  alternation. Don't lean on "swap between passes" as a design property.)

**Cleanup**

- **R9.** Delete from `gameOrder.ts` the symbols that have no live scoring
  callers:
  - `GAME_ORDER_3V3` (the hardcoded 18-game table)
  - `getGameMatchup` (table lookup by game number)
  - `getAllGames` (returns the hardcoded table)
  - `verifyGameOrder` (cross-check that the algorithm matches the table)
  - `getAllGames5v5` (thin wrapper around `generateGameOrder(5, false)`)
  - `isValidGameNumber` (hardcoded 1..18 — 3v3-only)
  - `isTiebreakerGame` (hardcoded 19..21 — 3v3-only; functionally
    superseded by `src/utils/tiebreaker/gameNumbers.ts`)

  Trim the characterization-test halves that test those specific helpers
  (the `getGameMatchup`, `getAllGames`, `isValidGameNumber`,
  `isTiebreakerGame`, and `getAllGames5v5` describe blocks). Lines that test
  the *new* Module's behavior — round-robin coverage, break alternation,
  cross-combos for any lineup size — stay.

  **Mandatory before the deletion lands:** the existing test
  `'produces exactly the same matchup pairs as the hardcoded GAME_ORDER_3V3'`
  uses `GAME_ORDER_3V3` as the comparison fixture pinning the *specific*
  pair ordering (not just round-robin coverage). Before deleting the
  constant, inline its 18-entry sequence into the new characterization test
  as a test-only fixture (e.g. `EXPECTED_3V3_DRR_SEQUENCE`) so the
  ordering-regression guard survives. Deleting the constant without inlining
  loses the only sequence-pinning assertion in the suite.
- **R10.** Update the one live caller `src/hooks/lineup/useMatchPreparation.ts`
  to import from the new Module location.
- **R11.** Update `TABLE_OF_CONTENTS.md` for the new file paths and the
  removed file paths.

(R12 was removed during refinement: the canon doc's specific code-name
references — `gameOrder.ts`, `getGameMatchup`, "computed inline", etc. —
are examples of how today's half-cooked code happens to do it, NOT
requirements to preserve. After extraction those examples become stale
but the canon's structural content stays right. Future canon refresh can
update the examples; no lock-gate work is required for this extraction.)

## Success Criteria

- The `match_games` rows created at lineup-lock are **column-identical**
  to what ships today for every shipped scoring system (3v3 DRR = 18
  games, 5v5 SRR = 25 games, same player_ids in same positions, same
  break/rack actions, same game numbers — the exact column values written
  to the table match today). The characterization tests for round-robin
  coverage and break alternation pass unchanged. ("Column-identical" not
  "byte-identical" because the Module's internal record shape may carry
  extra Stage-2-to-Stage-3 fields like `roundIndex` that the composer
  strips before output; what matters is the DB columns scoring actually
  reads.)
- After v1 lands, adding a second pair-gen / ordering / break-rack variant in
  the future is a **single-file addition** under `src/systems/pairings/`
  — not a refactor of the Module itself.
- A future Workshop UI can plug into the Module without code changes to the
  Module itself — just by selecting which variant to load. (Selector wiring
  is future work; the Module's contract is what makes it possible.)
- This Module earns its place in the 9-ingredient recipe **regardless of
  Workshop timing.** The Workshop is the shelf where LOs grab different
  brands of this ingredient (variant selection UI); building the
  ingredient correctly is a standalone win even if the shelf gets built
  much later. The typed contract + dead-code cleanup + Module slot are
  value on their own (less surface area, clearer boundaries, no live code
  pointing at dead helpers).

## Scope Boundaries

- **No preference columns.** No `pair_generation_variant` /
  `game_ordering_variant` / `break_rack_assignment_variant` columns on
  `preferences`. No schema migration. No wizard work.
- **No Workshop UI work.** Future.
- **No new variants in v1.** Only today's algorithm is implemented. Snake,
  hand-crafted-per-lineup, Swiss, captain-priority, etc. are future
  *peer Modules* that the Workshop will eventually let LOs pick from.
- **No race_to_n pairings.** Match Format's `pairing_format` axis is read by
  other code but NOT by Pairings Generator. The slot list shape is the same
  whether a slot terminates as single rack or as a race-to-N.
- **No tiebreaker pairings.** Already cleanly separated in
  `src/utils/tiebreaker/gameNumbers.ts`. Stays separate; not this Module's
  concern.
- **No scoring runtime changes.** Consumers of the slot list (the scoring
  popup, scoresheet renderer, win-calc) are untouched. They read pre-baked
  `match_games` rows; v1 doesn't change what gets written into those rows.
- **No mid-match re-pairing.** Module runs once at lineup-lock; output is
  immutable for the match. Substitutions mutate `match_games.home_player_id`
  in place without re-running the Module — same as today.

## Key Decisions

- **One Module = one cohesive slot; three internal stages untangled in
  code.** Matches Ed's framing: "single purpose, give me a list of games" at
  the Module level, while still allowing Stage 1 / Stage 2 / Stage 3 to each
  be a future independent dial because the stages are not entangled
  internally.
- **Module takes `lineupSize` + `gameGeneration` + the two lineups; emits
  player-id-tagged slots.** Matches the locked canon doc verbatim. Today's
  code happens to do position-resolution at the caller out of historical
  accident (the rotation function was written before the Module concept
  existed); v1 corrects that arrangement so the Module's outer contract
  matches the canon and `useMatchPreparation` simplifies. Substitution
  awareness stays out of Module scope — it's handled by direct
  `match_games.home_player_id` row updates after the Module has run.
- **DRR = SRR rotation repeated; break-action alternates by round so the
  second pass naturally swaps the breaker.** Explicit restatement of today's
  implicit behavior. Lets Stage 1 generate single-pass pairs and have Stage 3
  produce per-round alternation independently.
- **Zero variants ship in v1.** The Module slot itself is the deliverable.
  Alternative algorithms are future work the Workshop will enable.
- **No input validation inside the Module.** Guardrails are a Workshop
  concern. The Module trusts its inputs.

## Dependencies / Assumptions

- The `match_games` row shape and the `prep_match` RPC stay unchanged. The
  caller (`useMatchPreparation.ts`) is the only seam being modified: its
  import path changes AND its per-slot mapping simplifies (the Module now
  returns player_id-tagged slots directly, so the call site stops doing
  `(homeLineup as any)['player${pos}_id']` lookups inline). The mapped
  `match_games` row columns are the same as today.
- The locked canon doc (`docs/league-system/modules/pairings-generator.md`)
  needs no edit for this extraction. Its specific code-name references
  are examples, not requirements; stale examples in the canon do not
  block the rebuild. A future canon refresh can update the examples when
  convenient.
- Tiebreaker pairings (`src/utils/tiebreaker/gameNumbers.ts`) remain a peer
  concern. The Pairings Generator Module does not absorb them. Noted
  duplication: `tiebreakerGameSpecs()` independently implements the same
  `index % 2 === 0` per-round-alternation rule that the new Module's
  Stage 3 will own. v1 leaves the tiebreaker helper alone; a future
  tiebreaker-pairings convergence is expected to call into Stage 3 rather
  than re-implement, but that's out of scope here.

## Outstanding Questions

### Resolve Before Planning

(none — all product decisions are settled)

### Deferred to Planning

- [Affects R1] [Technical] File naming polish — `pairingsGenerator.ts` +
  `GameSlot` (new names matching the canon doc) vs. keep `gameOrder.ts` +
  `GameMatchup` (less churn at the caller). Either works; planner picks to
  minimize import diff.
- [Affects R4] [Technical] Whether the three internal stages live in one file
  under `~100` lines each (per Ed's file-size preference) or in
  `src/systems/pairings/stages/` subfolder. Planner picks based on resulting
  file sizes after the untangle.
(R9's "keep GAME_ORDER_3V3 as test fixture vs. delete outright" question
was resolved upward during refinement: R9 now mandates inlining the
18-entry sequence as a test-only fixture BEFORE deletion. No planner pick
needed.)

## Visual: where the dials slot in

```
┌──────────── Pairings Generator Module ─────────────┐
│                                                    │
│ Input: { lineupSize, gameGeneration,                │
│          homeLineup, awayLineup }                  │
│                  │                                 │
│                  ▼                                 │
│   ┌─── Stage 1: Pair Generation ────────────┐      │
│   │  Today: full RR (Cartesian × SRR|DRR)   │ ← dial 1
│   │  (future variants plug in here)         │      │
│   └─────────────────────────────────────────┘      │
│                  │  unordered pairs                │
│                  ▼                                 │
│   ┌─── Stage 2: Game Ordering ──────────────┐      │
│   │  Today: round-based rotation            │ ← dial 2
│   │  (future variants plug in here)         │      │
│   └─────────────────────────────────────────┘      │
│                  │  ordered pairs, no breaks       │
│                  ▼                                 │
│   ┌─── Stage 3: Break/Rack Assignment ──────┐      │
│   │  Today: per-round alternation           │ ← dial 3
│   │  (future variants plug in here)         │      │
│   └─────────────────────────────────────────┘      │
│                  │                                 │
│                  ▼                                 │
│ Output: GameSlot[] — ordered, fully annotated      │
└────────────────────────────────────────────────────┘

GameSlot shape (matches match_games row columns):
  { gameNumber,
    homePlayerId, awayPlayerId,
    homePosition, awayPosition,
    homeAction: 'breaks'|'racks',
    awayAction: 'breaks'|'racks' }

Caller (useMatchPreparation) maps these slots directly
into match_games rows via the prep_match RPC. No more
inline position→player_id lookup at the call site.
```

## Next Steps

→ `/ce:plan` for structured implementation planning
