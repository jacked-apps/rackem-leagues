---
title: Pairings Generator (Module #8) v1 Extraction
type: refactor
status: active
date: 2026-05-25
origin: docs/brainstorms/2026-05-25-pairings-generator-extraction-requirements.md
---

# Pairings Generator (Module #8) v1 Extraction

## Overview

Extract Module #8 (Pairings Generator) from the legacy `src/utils/gameOrder.ts`
into a real, named slot at `src/systems/pairings/`, matching the existing
convention used by Team Geometry (`src/systems/team-geometry/`), Match
Format (`src/systems/match-format/`), and the other extracted Modules. The
new Module takes the lineup geometry + the two locked lineups and emits the
ordered, fully-annotated list of games for the night — slot list with
player_ids, positions, game numbers, and break/rack actions.

The internal work is split into three pure-function stages (Pair
Generation → Game Ordering → Break/Rack Assignment) so each can later be
swapped as an independent dial when the LO Workshop arrives. v1 ships
exactly one variant per stage — today's algorithm, byte-for-byte. Dead
helpers (`GAME_ORDER_3V3` table + `getGameMatchup` / `getAllGames` /
`verifyGameOrder` / `getAllGames5v5` / `isValidGameNumber` /
`isTiebreakerGame`) are deleted; the only live caller
(`src/hooks/lineup/useMatchPreparation.ts`) is migrated to the new import
path. The per-row mapping after the Module returns simplifies (becomes
direct `slot.homePlayerId` / `slot.awayPlayerId` reads — no template-
string property access at that step). The upstream array assembly still
uses the existing `(myLineup as any)['player${n}_id']` lookup pattern
when building `homeLineup` / `awayLineup` arrays to pass into the
Module.

## Problem Frame

Per the locked canon doc (`docs/league-system/modules/pairings-generator.md`),
Pairings Generator is Module #8 of the 9-Module Scoring System framework.
Today it has no real home — the work is bundled inside
`src/utils/gameOrder.ts` alongside dead code paths that no live scoring
consumer reads. This plan creates the Module's named slot so future
variant algorithms (snake order, hand-crafted-per-lineup-size, Swiss,
captain-priority, etc.) can plug in by satisfying the same contract,
without touching today's implementation.

Per the master modular-framework migration plan
(`docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`,
R5 + line 84), Pairings Generator extraction was explicitly deferred from
that plan to "its own focused work after this plan." This plan is that
follow-up.

(see origin: `docs/brainstorms/2026-05-25-pairings-generator-extraction-requirements.md`)

## Requirements Trace

- **R1.** Module lives at `src/systems/pairings/`, matching the existing
  `team-geometry` / `match-format` convention.
- **R2.** Single-purpose contract: `(lineupSize, gameGeneration,
  homeLineup, awayLineup) → GameSlot[]`. One call, one output, no side
  effects.
- **R3.** Module takes the lineups and emits player-id-tagged slots
  (matching the locked canon). No position-only intermediate exposed to
  the caller.
- **R4.** Three internal pure-function stages composed in sequence: Pair
  Generation, Game Ordering, Break/Rack Assignment. Each in its own file
  under `stages/`.
- **R5.** Stages 2 and 3 are decoupled in code. Stage 2 emits records
  annotated with `roundIndex`; Stage 3 reads `roundIndex` to apply
  per-round alternation. Replacing Stage 3 with a different variant later
  does not require touching Stage 1 or 2.
- **R5a.** Caller-facing `GameSlot` shape:
  `{ gameNumber, homePlayerId, awayPlayerId, homePosition, awayPosition,
     homeAction, awayAction }`. The Module strips internal `roundIndex`
  before returning.
- **R6.** Narrow precondition: assert `lineupSize` is a positive integer,
  `gameGeneration` is one of the two enum values, `homeLineup.length ===
  lineupSize`, and `awayLineup.length === lineupSize`; throw a typed
  error on violation. No content validation of array entries — that's
  the caller's responsibility (the Module trusts the caller assembled
  the arrays correctly).
- **R7.** v1 ships exactly one variant per stage — today's behavior,
  byte-for-byte. No new variants.
- **R8.** DRR is "run the SRR rotation twice; break-action alternates by
  round." (Do not lean on "swap between passes" — only true for odd
  lineup sizes.)
- **R9.** Delete from `src/utils/gameOrder.ts`: `GAME_ORDER_3V3`,
  `getGameMatchup`, `getAllGames`, `verifyGameOrder`, `getAllGames5v5`,
  `isValidGameNumber`, `isTiebreakerGame`. Trim corresponding test blocks.
  **Mandatory:** before deletion, inline the 18-entry expected 3v3 DRR
  sequence as a test-only fixture (`EXPECTED_3V3_DRR_SEQUENCE`) in the
  new Module's characterization test so the ordering-regression guard
  survives. The fixture is the existing `GAME_ORDER_3V3` constant's data
  re-shaped to the new GameSlot fields (`homePosition` instead of
  `homePlayerPosition`, etc.) with synthetic-but-consistent player_ids
  (e.g. `'home-p1'`..`'home-p3'`, `'away-p1'`..`'away-p3'`). Not literally
  byte-for-byte (the field names change); the assertion is that the new
  Module's output for those synthetic lineups equals the inlined fixture
  element-by-element.
- **R10.** Migrate `src/hooks/lineup/useMatchPreparation.ts` to import
  from the new Module location. The per-row mapping after the Module
  returns simplifies (becomes direct `slot.homePlayerId` /
  `slot.awayPlayerId` reads). The two `generateGameOrder(...).length`
  count-only call sites (lines ~151 and ~271) become
  `computeGameCount(lineupSize, gameGeneration)` from
  `@/systems/team-geometry` — required after Unit 8 deletes
  `generateGameOrder`, not an optional optimization. The third call
  site (line ~306) becomes `generatePairings({ lineupSize,
  gameGeneration, homeLineup, awayLineup })`.
- **R11.** Update `TABLE_OF_CONTENTS.md` for the new file paths and the
  removed file paths.

## Scope Boundaries

- No preference columns. No schema migration. No
  `resolved_league_preferences` view changes. No wizard work.
- No `match_games` schema change. The DB's
  `match_games_home_position_check` / `match_games_away_position_check`
  CHECK constraints cap positions at 1..5 (preexisting). The new Module
  is `lineupSize`-agnostic at the TS level, but persistence through the
  `prep_match` RPC still requires `lineupSize <= 5`. Any future support
  for 6v6+ would need a separate schema-relaxation migration; not in
  v1's scope.
- No Workshop UI work. Future.
- No new variants. Snake, hand-crafted-per-lineup, Swiss,
  captain-priority, seeded-random, fairness-table, coin-flip-then-alternate
  — all explicitly deferred until the Workshop slot needs them.
- No race-mode pairings (per-pairing replication: X plays Y for
  multiple consecutive games as in a race-to-N) and no other
  non-round-robin variants. Future. The GameSlot output shape
  intentionally does NOT bake in round-robin assumptions (see Key
  Technical Decisions: "Output shape is variant-agnostic"), so
  race-mode and other variants can be added later as different Stage 1
  variants without changing the Module's outer contract.
- No tiebreaker pairings absorption.
  `src/utils/tiebreaker/gameNumbers.ts` stays as a peer concern. (Noted:
  `tiebreakerGameSpecs()` independently implements the same
  `index % 2 === 0` alternation rule the new Stage 3 will own; future
  tiebreaker-pairings convergence is expected to call into Stage 3
  rather than re-implement, but that's out of scope here.)
- No scoring runtime changes. Scoring reads pre-baked `match_games` rows;
  v1 doesn't change what gets written into those rows.
- No mid-match re-pairing. Module runs once at lineup-lock; output is
  immutable. Substitutions update `match_games.home_player_id` in place
  after the Module has run.
- No canon-doc edits required. The canon's specific code-name references
  are examples of how today's code happens to do it, not requirements
  to preserve.

## Context & Research

### Relevant Code and Patterns

- **`src/systems/team-geometry/index.ts`** + `types.ts` — exact pattern
  to follow: `index.ts` exposes the factory function + small helpers +
  re-exports; `types.ts` holds the public types with JSDoc. The factory
  is a pure construction function with no validation (validation is the
  caller's job).
- **`src/systems/match-format/index.ts`** + `types.ts` — second exemplar
  with the same shape; confirms the convention.
- **`src/systems/team-geometry/index.ts:42-48`** — `computeGameCount`
  function that the new caller (`useMatchPreparation`) should consume
  instead of running the rotation algorithm just for `.length`.
- **`src/utils/gameOrder.ts`** — the existing source; algorithm to lift
  (rename inputs from `playersPerTeam` to `lineupSize`, `doubleRoundRobin`
  to `gameGeneration` enum). Stages 2 and 3 are entangled today via
  `round % 2`; untangle by moving break/rack decision into a separate
  function that reads `roundIndex` from Stage 2's output.
- **`src/hooks/lineup/useMatchPreparation.ts`** lines 145–320 — the one
  live caller. Three call sites for `generateGameOrder` (lines 151, 271,
  306); two of them (151, 271) just need a count; the third (306) needs
  the full list.
- **`src/utils/tiebreaker/gameNumbers.ts`** — peer concern; do NOT
  touch. The new Module's Stage 3 will mirror its alternation pattern,
  but the helpers stay separate.

### Institutional Learnings

- `docs/solutions/` does not contain prior Pairings-Generator-specific
  solutions. (Searched; none matched.)
- Master modular-framework plan
  (`docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`)
  established the extraction pattern with Team Geometry, Match Format,
  Handicap Mechanisms, Threshold Charts, Handicap Systems. Each used the
  same shape: `src/systems/<module>/{index.ts, types.ts, __tests__/}`.

### External References

- None. Local patterns sufficient.

## Key Technical Decisions

- **One Module folder, three internal stage files.** Composer in
  `index.ts` calls each stage in sequence. Matches the canon's
  three-stage decomposition and keeps per-stage code under the ~100-line
  size preference. Variants land later as peer Modules at the same slot
  OR as alternate stage files swapped via the composer (decision deferred
  to when the first variant lands).
- **`computeGameCount` reuse in `useMatchPreparation`.** Two of the three
  current `generateGameOrder(...).length` calls just want the count.
  After Unit 8 deletes `generateGameOrder`, those sites can't call it
  anymore — `computeGameCount` is the natural and required replacement
  (it already exists in `@/systems/team-geometry`).
- **`GameSlot` carries both positions AND player_ids.** Matches today's
  `match_games` row shape; lets downstream consumers use whichever
  field is most natural (positions for UI grids; player_ids for scoring).
  No translation step at the call site.
- **`roundIndex` is internal to Stages 2→3; not exposed in the outer
  `GameSlot`.** The composer strips it before returning. Keeps the
  external contract clean while enabling Stage 3's per-round rule.
- **Position type widens from `1|2|3` to `number`.** The existing
  `as any` casts in `gameOrder.ts` lines 148–149 exist because the type
  was hardcoded to 3v3. With the new Module supporting any
  `lineupSize`, the type widens to `number`. Verified no runtime impact:
  no consumer in `src/` does `case 1 | 2 | 3` exhaustiveness narrowing
  over `GameMatchup` positions; all position usages are array indexing
  (`g.homePlayerPosition - 1`) or template-string concatenation
  (`player${g.homePlayerPosition}_id`), both of which accept `number`.
- **Test posture: characterization-first.** The existing characterization
  test in `src/utils/__tests__/gameOrder.characterization.test.ts` is
  the byte-for-byte safety net for the live shipped behavior. The new
  Module's characterization test (with the inlined fixture) must pass
  BEFORE the composer is wired in Unit 5, so the algorithm is
  test-pinned before any caller-facing change lands.
- **Output shape is variant-agnostic.** GameSlot's flat-list shape is
  intentionally generic — each record represents ONE game (one rack
  to be played), regardless of how the variant arrived at that list.
  v1's round-robin variant produces one record per unique
  (homePos, awayPos) pair (twice for DRR). Future variants would
  produce different lists using the SAME record shape:
    - **Race-mode** (per-pairing replication, e.g. "X plays Y up to 4
      games in a race-to-3") would emit up to N records for the same
      (X, Y) pair, all with the same player_ids but distinct
      gameNumbers and alternating break actions.
    - **Swiss / brackets / partial RR** would emit other variant-
      specific subsets.
  v1 ships only the round-robin algorithm, but the GameSlot output
  contract intentionally does NOT bake in "one game per unique
  pairing" or any other round-robin-specific assumption. A future
  variant lives as a different Stage 1 (or peer Module) that emits
  a different GameSlot list — same record shape, different
  cardinality and content.
- **Stage 2 in v1 is a thin gameNumber annotation pass.** Today's
  rotation algorithm produces play order naturally as it iterates
  rounds and positions; Stage 1's emit order IS the eventual game
  order. Stage 2's job in v1 is just to attach `gameNumber =
  arrayIndex + 1`. The three-stage Module structure is real (each
  stage has its own pure function and contract), but the v1 Stage 2
  implementation is intentionally thin. A future variant (snake
  order, standings-driven, etc.) would put real sorting logic into
  Stage 2; the slot is reserved.

## Open Questions

### Resolved During Planning

- **File layout** — `src/systems/pairings/{index.ts, types.ts,
  stages/{pairGeneration,gameOrdering,breakRackAssignment}.ts,
  __tests__/pairings.test.ts}`. Matches team-geometry pattern + handles
  the three-stage internal split via subdir.
- **Per-stage test files vs. one Module test file** — one Module-level
  test file (`__tests__/pairings.test.ts`) covers Stage outputs through
  the composer + characterization fixtures. Per-stage isolation tests
  can be added later if variants demand it.
- **GAME_ORDER_3V3 fate** — already resolved upward in the brainstorm:
  inline the 18-entry expected sequence as a test-only fixture
  (`EXPECTED_3V3_DRR_SEQUENCE`) in Unit 6, then delete the original
  constant in Unit 8.
- **Naming** — `generatePairings()` factory function (not
  `getPairings()` — this is computation, not construction);
  `GameSlot` for the output record; `PairingsInput` for the input
  contract. Aligns with canon doc's terminology.

### Deferred to Implementation

- **Whether `src/utils/gameOrder.ts` becomes empty after Unit 8.** If
  the file has nothing left after deleting the dead helpers, delete
  the file entirely. If anything still imports from it, leave a thin
  stub. Determine at implementation time after Unit 7 lands.
- **Exact wording of the precondition error message** in Unit 5.
  Implementer chooses (e.g., `'lineupSize must be a positive integer,
  got: <value>'`).
- **Whether to add per-stage isolation test files.** If the
  Module-level test file in Unit 6 exceeds the ~100-line preference,
  split into per-stage test files; otherwise keep consolidated.

## Output Structure

```
src/systems/pairings/
├── index.ts                                    # composer + factory + re-exports
├── types.ts                                    # PairingsInput, GameSlot, stage record types
├── stages/
│   ├── pairGeneration.ts                       # Stage 1
│   ├── gameOrdering.ts                         # Stage 2
│   └── breakRackAssignment.ts                  # Stage 3
└── __tests__/
    └── pairings.test.ts                        # Module-level + characterization tests
```

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for
> review, not implementation specification. The implementing agent should
> treat it as context, not code to reproduce. The exact arithmetic lives
> in Unit 2; this diagram shows the flow shape only.*

```
generatePairings(input: PairingsInput): GameSlot[]
  │
  │  input: { lineupSize, gameGeneration, homeLineup, awayLineup }
  │
  ├── precondition (Unit 5)
  │
  ├── Stage 1 — pairGeneration(input)  [Unit 2]
  │      │     produces PairRecord[]:
  │      │     { homePlayerId, awayPlayerId,
  │      │       homePosition, awayPosition, roundIndex }
  │      ▼
  ├── Stage 2 — gameOrdering(pairs)    [Unit 3]
  │      │     attaches gameNumber, produces OrderedPairRecord[]
  │      ▼
  ├── Stage 3 — breakRackAssignment(ordered)  [Unit 4]
  │      │     attaches homeAction/awayAction by roundIndex % 2,
  │      │     produces internal slots
  │      ▼
  └── composer strips internal roundIndex, returns GameSlot[]

GameSlot = { gameNumber, homePlayerId, awayPlayerId,
             homePosition, awayPosition,
             homeAction: 'breaks'|'racks',
             awayAction: 'breaks'|'racks' }
```

(Single authoritative source for the rotation arithmetic is Unit 2's
Approach block, which references today's `gameOrder.ts` lines 148–149.
Today's `generateGameOrder` happens to produce Stage 1 + Stage 2's
combined output in one loop pass — the rotation algorithm naturally
produces an ordered list. The "untangle" is conceptual: Stage 1's
function returns the pairs annotated with `roundIndex`; Stage 2 attaches
`gameNumber`; Stage 3 reads `roundIndex` for the break/rack rule. The
data flows through three functions composed in sequence, not one
monolithic loop.)

## Implementation Units

- [ ] **Unit 1: Module scaffolding + public types**

**Goal:** Create the Module folder structure and the public type
contract.

**Requirements:** R1, R2, R3, R5a

**Dependencies:** None.

**Files:**
- Create: `src/systems/pairings/types.ts`
- Create: `src/systems/pairings/index.ts` (factory skeleton with
  `generatePairings()` signature; throws "not implemented" body for now)

**Approach:**
- `types.ts` exports `PairingsInput`, `GameSlot`, and internal stage
  record types (`PairRecord`, `OrderedPairRecord`).
- `PairingsInput`:
  `{ lineupSize: number, gameGeneration: GameGeneration,
     homeLineup: string[], awayLineup: string[] }` (player_ids).
  Reuse `GameGeneration` from `@/systems/team-geometry/types`.
- `GameSlot`:
  `{ gameNumber: number, homePlayerId: string, awayPlayerId: string,
     homePosition: number, awayPosition: number,
     homeAction: 'breaks'|'racks', awayAction: 'breaks'|'racks' }`.
- Internal `PairRecord` (Stage 1 output):
  `{ homePlayerId, awayPlayerId, homePosition, awayPosition,
     roundIndex }`.
- Internal `OrderedPairRecord` (Stage 2 output): `PairRecord & { gameNumber }`.
- `index.ts` exports `generatePairings(input: PairingsInput):
  GameSlot[]` (throws stub for now) and re-exports types.

**Patterns to follow:**
- `src/systems/team-geometry/types.ts` — JSDoc style + `readonly`
  fields on Module output.
- `src/systems/team-geometry/index.ts` — re-exports pattern + JSDoc
  fileoverview pointing at canon doc.

**Test scenarios:**
- Test expectation: none — scaffolding only, no behavior to test yet.
  (The stub `throw new Error('not implemented')` proves the signature
  compiles; behavior tests land in Units 2–6.)

**Verification:**
- TypeScript compiles cleanly. Imports from
  `@/systems/pairings` resolve. The factory signature matches what
  Unit 7 will call.

---

- [ ] **Unit 2: Stage 1 — Pair Generation**

**Goal:** Implement the pure function that produces the unordered bag
of pairs annotated with `roundIndex`.

**Requirements:** R2, R3, R4, R7

**Dependencies:** Unit 1.

**Files:**
- Create: `src/systems/pairings/stages/pairGeneration.ts`

**Approach:**
- Pure function:
  `generatePairs(input: PairingsInput): PairRecord[]`.
- For each `round` in `0..(totalRounds - 1)` where `totalRounds =
  lineupSize × (gameGeneration === 'double_round_robin' ? 2 : 1)`:
  - For each `homePos` in `1..lineupSize`:
    - `awayPos = ((homePos - 1 + round) % lineupSize) + 1`
    - Emit `{ homePlayerId: homeLineup[homePos-1], awayPlayerId:
      awayLineup[awayPos-1], homePosition: homePos, awayPosition:
      awayPos, roundIndex: round }`.
- Each emitted record carries BOTH player_ids AND positions (no
  optional fields on PairRecord — every record has all five fields
  populated).
- Returns the array in the loop's natural order (which IS the eventual
  game order; Stage 2 just attaches `gameNumber`).

**Execution note:** Match today's `generateGameOrder` arithmetic
exactly. The rotation pattern (`(homePos-1 + round) % lineupSize`) is
the byte-for-byte equivalent of today's `awayOffset = round %
playersPerTeam; awayPosition = ((i + awayOffset) % playersPerTeam) +
1`. **Pin the OUTER-loop structure:** Stage 1 MUST iterate a single
outer loop `round in 0..(totalRounds - 1)` and tag each emitted pair
with that `round` value as `roundIndex`. Do NOT factor as "generate
SRR pairs (rounds 0..N-1) then duplicate them with the same
roundIndex" — that breaks Stage 3's per-round alternation for even
lineup sizes (4v4 DRR: pair (P1, P1) at round 0 and at round N must
have DIFFERENT roundIndex values so Stage 3's `roundIndex % 2 === 0`
flips the breaker between the two passes).

**Patterns to follow:**
- `src/systems/handicap-mechanisms/extra-games.ts` (or similar) for
  per-stage pure-function file style.

**Test scenarios:**
- *(Tests for this stage land in Unit 6 as part of the Module-level
  characterization fixture. Per-stage isolation tests are optional and
  deferred until variants demand them.)*

**Verification:**
- TypeScript compiles cleanly. Function is importable from
  `src/systems/pairings/stages/pairGeneration` and from the index via
  composition.

---

- [ ] **Unit 3: Stage 2 — Game Ordering**

**Goal:** Implement the pure function that attaches `gameNumber` to the
ordered pair records.

**Requirements:** R2, R4, R5

**Dependencies:** Unit 2.

**Files:**
- Create: `src/systems/pairings/stages/gameOrdering.ts`

**Approach:**
- Pure function:
  `orderGames(pairs: PairRecord[]): OrderedPairRecord[]`.
- Input is assumed to be in the Module's intended play order (Stage 1
  produces it that way). Stage 2's only job today is to attach
  `gameNumber = index + 1`.
- Carry through all input fields (`homePlayerId`, `awayPlayerId`,
  `homePosition`, `awayPosition`, `roundIndex`) plus the new
  `gameNumber`.
- v1 just attaches `gameNumber`; no re-ordering. (Today's algorithm
  naturally produces the play order in Stage 1's loop; Stage 2's job
  in v1 is the `gameNumber` annotation pass.)

**Patterns to follow:** same as Unit 2.

**Test scenarios:**
- *(Tests land in Unit 6; see note in Unit 2.)*

**Verification:**
- TypeScript compiles cleanly. Output preserves input cardinality and
  ordering; every record has `gameNumber` 1..N with no gaps.

---

- [ ] **Unit 4: Stage 3 — Break/Rack Assignment**

**Goal:** Implement the pure function that attaches `homeAction` /
`awayAction` based on `roundIndex`.

**Requirements:** R2, R4, R5, R7, R8

**Dependencies:** Unit 3.

**Files:**
- Create: `src/systems/pairings/stages/breakRackAssignment.ts`

**Approach:**
- Pure function:
  `assignBreakRack(ordered: OrderedPairRecord[]): InternalSlot[]`
  where `InternalSlot = OrderedPairRecord & { homeAction, awayAction
  }`.
- For each input record:
  - `const homeBreaks = record.roundIndex % 2 === 0;`
  - `homeAction = homeBreaks ? 'breaks' : 'racks'`
  - `awayAction = homeBreaks ? 'racks' : 'breaks'`
- Stage 3 reads ONLY `roundIndex` from each record — does not look at
  `gameNumber` or positions.
- **Note on field-name choice:** the canon doc's example uses
  `breaker` / `racker` fields ('home' | 'away'); this plan uses
  `homeAction` / `awayAction` ('breaks' | 'racks') to match the
  existing `match_games.home_action` / `away_action` DB columns. Per
  the brainstorm's recipe-vs-example framing, the canon's specific
  field names are illustrative examples of how today's code happens
  to do it; we follow the installed DB shape.

**Patterns to follow:** same as Unit 2.

**Test scenarios:**
- *(Tests land in Unit 6; see note in Unit 2.)*

**Verification:**
- TypeScript compiles cleanly. Every input record gets `homeAction`
  and `awayAction`; they are always opposites.

---

- [ ] **Unit 5: Composer + precondition guard**

**Goal:** Wire Stages 1→2→3 in `index.ts`, add the precondition
guard, strip internal `roundIndex` from the final output.

**Requirements:** R2, R5a, R6, R7

**Dependencies:** Units 1, 2, 3, 4.

**Files:**
- Modify: `src/systems/pairings/index.ts`

**Approach:**
- Replace the stub `generatePairings(input)` with the composer:
  ```
  precondition checks (throw on violation)
  const pairs = generatePairs(input)
  const ordered = orderGames(pairs)
  const internalSlots = assignBreakRack(ordered)
  return internalSlots.map(strip roundIndex) → GameSlot[]
  ```
- Precondition logic:
  - `if (!Number.isInteger(input.lineupSize) || input.lineupSize < 1)
    throw new Error(...)`
  - `if (input.gameGeneration !== 'single_round_robin' &&
    input.gameGeneration !== 'double_round_robin') throw new Error(...)`
  - `if (input.homeLineup.length !== input.lineupSize ||
    input.awayLineup.length !== input.lineupSize) throw new Error(...)`
  - No checks on array element contents (null/undefined player_ids
    inside the arrays are the caller's responsibility to prevent).
- The `roundIndex` strip is a `.map()` that constructs the outer
  `GameSlot` shape explicitly (no spread of internal fields).

**Patterns to follow:**
- `src/systems/team-geometry/index.ts:62-73` — factory style, JSDoc
  with examples.

**Test scenarios:**
- (Tests land in Unit 6.) Unit 6 will end-to-end pin the composed
  Module behavior. Precondition tests also live in Unit 6.

**Verification:**
- The composer compiles + can be called from a test harness without
  crashing on valid input. Unit 6's tests validate behavior.

---

- [ ] **Unit 6: Module characterization tests (with inlined 3v3 fixture)**

**Goal:** Comprehensive test suite for the new Module. INCLUDES the
inlined `EXPECTED_3V3_DRR_SEQUENCE` fixture (mandatory per R9) and the
characterization tests that pin today's shipped behavior byte-for-byte.

**Requirements:** R7, R9

**Dependencies:** Units 1–5 (the Module must be wired before tests
can exercise it).

**Files:**
- Create: `src/systems/pairings/__tests__/pairings.test.ts`

**Approach:**
- Test file structure:
  1. **`EXPECTED_3V3_DRR_SEQUENCE` fixture** — inline the 18-entry
     expected sequence from today's `GAME_ORDER_3V3` constant (copy
     the literal contents of `src/utils/gameOrder.ts` lines 35–65,
     adapt the field names to the new `GameSlot` shape, add fake but
     consistent player_ids like `'home-p1'`, `'home-p2'`, ...,
     `'away-p3'`). This fixture is the byte-for-byte regression
     guard.
  2. **3v3 DRR characterization** — call `generatePairings({
     lineupSize: 3, gameGeneration: 'double_round_robin', homeLineup:
     ['home-p1','home-p2','home-p3'], awayLineup:
     ['away-p1','away-p2','away-p3'] })`; assert the output equals
     `EXPECTED_3V3_DRR_SEQUENCE` element-by-element.
  3. **5v5 SRR characterization** — 25 games; assert
     coverage matrix (every home position plays every away position
     exactly once) + per-round break alternation.
  4. **Cross-combos (scope-pure)** — 4v4 DRR (justifies the R8
     reword; locks the OUTER-loop factoring) and 5v5 DRR (50 games;
     exercises largest persistable DRR matrix). Each: correct
     cardinality, full coverage matrix, per-round alternation. 4v4
     additionally pins a specific game-ordering fixture so a wrong
     Stage-1 factoring would fail. (1v1 and 6v6 NOT tested in v1 — no
     shipped use and 6v6 isn't persistable per the DB position CHECK
     constraint.)
  5. **Precondition tests** — `lineupSize = 0` throws; `lineupSize =
     -1` throws; `lineupSize = 2.5` throws; `gameGeneration =
     'unknown'` throws; valid input does NOT throw.
  6. **Output shape contract** — every GameSlot has all 7 fields;
     `homePlayerId` matches `homeLineup[homePosition - 1]`;
     `awayPlayerId` matches `awayLineup[awayPosition - 1]`;
     `homeAction` and `awayAction` are always opposites.
  7. **`roundIndex` is NOT exposed** — assert outer GameSlot has no
     `roundIndex` property (it's an internal field stripped by
     the composer).

**Execution note:** Characterization-first. This unit's tests must
pass against the wired composer (Units 1–5) before Unit 7's caller
migration lands. If any test fails, fix the Module before touching
`useMatchPreparation`.

**Patterns to follow:**
- `src/utils/__tests__/gameOrder.characterization.test.ts` — the
  existing characterization style + assertion patterns; lift those
  patterns into the new test file.
- `src/systems/team-geometry/__tests__/team-geometry.test.ts` — the
  conventions for testing a Module (file-level docstring, describe
  blocks, etc.).

**Test scenarios:**
- *Happy path:* 3v3 DRR produces 18 GameSlots matching
  `EXPECTED_3V3_DRR_SEQUENCE` element-by-element including player_id
  resolution from `homeLineup` / `awayLineup`.
- *Happy path:* 5v5 SRR produces 25 GameSlots covering every (home,
  away) position pair exactly once.
- *Edge case:* 4v4 DRR produces 32 GameSlots, per-round alternation
  holds (NOT per-pair-across-passes — only true for odd lineup
  sizes; locks the R8 reword). Additionally pin a 4v4 DRR
  ordering-fixture assertion so a wrong "SRR-then-duplicate" Stage 1
  factoring would fail the test.
- *Edge case:* 5v5 DRR (50 games — not a shipped combo but exercises
  the largest persistable DRR matrix) coverage matrix + per-round
  alternation.
- *Error path:* `lineupSize = 0`, `-1`, `2.5`, `'3'` (string) each
  throw with descriptive message.
- *Error path:* `gameGeneration = 'unknown'` throws.
- *Output shape:* every GameSlot has exactly the 7 fields
  (gameNumber, homePlayerId, awayPlayerId, homePosition,
  awayPosition, homeAction, awayAction); no extra fields including
  `roundIndex`.
- *Integration:* `homePlayerId === homeLineup[homePosition - 1]` and
  `awayPlayerId === awayLineup[awayPosition - 1]` for every slot.

**Verification:**
- All test scenarios pass. The Module produces byte-for-byte the
  same play order as today's `generateGameOrder` for 3v3 DRR + 5v5
  SRR (the two shipped combos).

---

- [ ] **Unit 7: Migrate `useMatchPreparation` to the new Module**

**Goal:** Cut the live caller over to the new Module location and
simplify the per-slot mapping. THIS is the moment the rebuild is
live in production scoring.

**Requirements:** R10

**Dependencies:** Units 1–6 (Module must be fully wired + tested).
**Unit 6 characterization tests MUST PASS before Unit 7 begins.** If any
Unit 6 test fails, abort Unit 7 and fix the Module in Units 1–5 first.
This is the cutover gate — the live scoring path is at stake.

**Files:**
- Modify: `src/hooks/lineup/useMatchPreparation.ts` (lines ~16, 151,
  271, 306–318)
- Test: existing tests in `src/hooks/lineup/__tests__/` (if any)
  must still pass; add new test if none exists (see scenarios
  below).

**Approach:**
- Replace `import { generateGameOrder } from '@/utils/gameOrder'`
  with `import { generatePairings } from '@/systems/pairings'`.
- Also add `import { computeGameCount } from '@/systems/team-geometry'`
  if not already present.
- At lines ~151 and ~271 (game count derivations): replace
  `generateGameOrder(lineupSize, useDoubleRoundRobin).length` with
  `computeGameCount(lineupSize, gameGeneration ?? 'double_round_robin')`.
- At line 306 (the build-game-rows block): replace `const allGames =
  generateGameOrder(lineupSize, useDoubleRoundRobin)` with:
  ```
  // Normalize gameGeneration to a strict enum value before passing
  // to the Module (Module precondition is strict; today's prefs
  // field is permissive string). Matches today's silent
  // "anything-not-DRR is SRR" fallback behavior.
  const safeGameGen: GameGeneration =
    gameGeneration === 'double_round_robin'
      ? 'double_round_robin'
      : 'single_round_robin';

  const allSlots = generatePairings({
    lineupSize,
    gameGeneration: safeGameGen,
    homeLineup: [/* resolve from myLineup / opponentLineup via
                    existing (lineup as any)['player${n}_id']
                    pattern; slice to lineupSize */],
    awayLineup: [/* same */],
  })
  ```
- Replace the `gameRows` mapping (lines 309–318): the per-slot
  `home_player_id` / `away_player_id` come directly from `slot.homePlayerId`
  / `slot.awayPlayerId` — no more `(homeLineup as any)['player${pos}_id']`
  lookups inline.
- The mapped `match_games` row columns stay identical (game_number,
  game_type, home_player_id, away_player_id, home_position,
  away_position, home_action, away_action).

**Execution note:** The double-duty placeholder pre-insert guard
(lines 320–339) stays — it checks the *output* of the mapping for
sentinel IDs; that logic doesn't move into the Module.

**Patterns to follow:**
- Lookup of lineup player ids — keep the same access pattern
  (`(myLineup as any)['player${n}_id']`) when building the
  `homeLineup` / `awayLineup` arrays passed into `generatePairings`.

**Test scenarios:**
- *Integration:* full prep-match flow with realistic 3v3 lineup
  (using existing test fixtures if available) produces 18
  `match_games` rows with player_ids and break/rack matching today's
  output exactly.
- *Integration:* full prep-match flow with 5v5 lineup produces 25
  rows.
- *Integration:* if a lineup contains a double-duty sentinel, the
  existing pre-insert guard still fires and aborts (no change to
  guard behavior).
- *Edge case:* lineupSize from preferences is the source of truth
  (Module doesn't recompute it).

**Verification:**
- Run `pnpm test:run` — all existing tests pass.
- Run `pnpm run typecheck` — no type errors.
- Manual smoke (Ed via browser refresh after push): start a 3v3
  match, lock lineups, scoring page renders the expected 18 game
  slots with the expected players in each. Same for 5v5 if a 5v5
  fixture is available.

---

- [ ] **Unit 8: Delete dead helpers + trim old characterization tests**

**Goal:** Remove the dead code that the live path no longer touches.
Decide whether `src/utils/gameOrder.ts` survives as a stub or gets
deleted entirely.

**Requirements:** R9, R11

**Dependencies:** Unit 7 (live caller must already use the new
Module; the file must be unreferenced before deletion).

**Files:**
- Delete from `src/utils/gameOrder.ts`: `GAME_ORDER_3V3`,
  `getGameMatchup`, `getAllGames`, `verifyGameOrder`,
  `getAllGames5v5`, `isValidGameNumber`, `isTiebreakerGame`. If
  nothing remains exported from the file, delete the file entirely.
- Modify: `src/utils/__tests__/gameOrder.characterization.test.ts` —
  delete the describe blocks that tested the deleted helpers
  (`GAME_ORDER_3V3`, `getGameMatchup`, `getAllGames`,
  `isValidGameNumber`, `isTiebreakerGame`, `getAllGames5v5`). If
  the file becomes empty, delete it.
- Modify: `TABLE_OF_CONTENTS.md` — add the new
  `src/systems/pairings/*` paths; remove the deleted file paths;
  bump "Last Updated".

**Approach:**
- Before deletion, grep the whole repo for each symbol to confirm no
  surviving callers outside the test file:
  - `GAME_ORDER_3V3`, `getGameMatchup`, `getAllGames`,
    `verifyGameOrder`, `getAllGames5v5`, `isValidGameNumber`,
    `isTiebreakerGame`.
- **`isTiebreakerGame` extra step:** `src/utils/tiebreaker/gameNumbers.ts`
  lines 17–21 contain a docstring reference to `isTiebreakerGame` as
  the canonical test locking "games 19-21 are tiebreakers." Before
  deleting `isTiebreakerGame`: (a) verify
  `src/utils/tiebreaker/__tests__/gameNumbers.test.ts` covers the same
  semantics — i.e. `tiebreakerGameNumbers(18, 3)` returns `[19, 20,
  21]` (if absent, add the assertion); (b) update the
  `tiebreaker/gameNumbers.ts:17-21` docstring to point at the new
  test location.
- Then delete the symbols + their tests.
- Decide remaining-file fate based on whether `generateGameOrder` and
  `GameMatchup` are still imported anywhere. If not, delete the file.
  If yes (unlikely but possible), leave a minimal stub re-exporting
  from the new Module location.

**Patterns to follow:** none — straightforward deletion.

**Test scenarios:**
- *Verification:* `pnpm run typecheck` passes (no broken imports).
- *Verification:* `pnpm test:run` passes (the deleted test blocks
  are no longer asserted; the new Module's tests in Unit 6 carry
  the coverage forward).
- *Verification:* `grep -r "GAME_ORDER_3V3" src/` returns no
  matches.

**Verification:**
- File is deleted OR contains only the symbols actually imported
  elsewhere. TOC is up to date. All tests pass.

## System-Wide Impact

- **Interaction graph:** the only live consumer is
  `useMatchPreparation`, whose `prep_match` RPC writes `match_games`
  rows. Scoring (`ScoreMatch.tsx`) reads those rows from the DB and is
  untouched. The scoresheet renderer, scoring popup, tiebreaker
  handling, and `computeMatchRunningTotals` all consume `match_games`
  rows and are untouched.
- **Error propagation:** the new Module throws on invalid input
  (precondition). The only live caller's preconditions (`lineupSize`
  from validated preferences) make this throw effectively dead code
  in production today — but it protects against accidental misuse if
  any other caller emerges before the Workshop ships.
- **State lifecycle risks:** `match_games` rows are written
  transactionally via the `prep_match` RPC with 3-attempt exponential
  backoff. The Module produces the row payload; the RPC handles
  partial-write avoidance. v1 doesn't change this.
- **API surface parity:** the Module's output shape matches the
  `match_games` DB column shape. The TS-API uses camelCase
  (`homePlayerId`); the row mapping in `useMatchPreparation` translates
  to snake_case (`home_player_id`) for the RPC. Standard boundary; no
  new surface concerns.
- **Integration coverage:** Unit 7's integration tests cover the
  end-to-end seam (lineups → Module → `match_games` rows). Existing
  characterization tests in the legacy `gameOrder.characterization.test.ts`
  remain as the cross-check until Unit 8 retires them (after Unit 6's
  new Module tests prove byte-for-byte equivalence).
- **Unchanged invariants:** `match_games` row column set, the
  `prep_match` RPC contract, the substitution flow (in-place updates
  to `match_games.home_player_id`), the scoring runtime, the
  tiebreaker helpers, and Match Format's `pairing_format` consumption
  are all explicitly NOT changed by this plan.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Subtle mis-translation of the rotation arithmetic when lifting from `generateGameOrder` produces a different play order than today. | Unit 6's `EXPECTED_3V3_DRR_SEQUENCE` fixture is byte-for-byte from today's `GAME_ORDER_3V3` constant; any divergence fails the test. The 5v5 SRR coverage matrix tests provide secondary regression protection. Characterization-first execution posture (Unit 6 before Unit 7) catches it pre-cutover. |
| Per-round alternation fails for 4v4 DRR (even lineup size) in a way the existing test suite doesn't catch. | Unit 6 explicitly tests 4v4 DRR cross-combo with per-round alternation assertion. Locks the R8 reword. |
| `isTiebreakerGame` deletion breaks something downstream that grep didn't surface. | Unit 8 explicit grep before deletion. If anything turns up, evaluate at implementation time (move to tiebreaker module, or replace caller with `tiebreakerGameNumbers(...).includes(n)` from `src/utils/tiebreaker/gameNumbers.ts`). |
| The position-to-`as any` widening in current `generateGameOrder` masks a type issue in a downstream consumer when the new Module emits `homePosition: number`. | Unit 7's typecheck + integration tests catch any consumer that depended on the literal `1|2|3` type. Implementer's first check after the caller migration. |
| `useMatchPreparation` lineup-array assembly (passing `[homePlayer1Id, ..., homePlayerNId]`) misses a sentinel/null player_id, causing the Module to emit garbage slots without the call-site pre-insert guard catching it. | The pre-insert guard (`useMatchPreparation:325-339`) checks the *output* slot list for double-duty sentinels; it still runs after the new Module call. Behavior unchanged. Confirm in Unit 7 integration tests. |
| Branch ancestry: this branch was forked from `chore/stack-test-plan`, not `main`. Eventually rebasing onto main may surface conflicts in the test files Unit 8 modifies. | **Before Unit 1 starts:** run `git log main..chore/stack-test-plan -- src/utils/__tests__/gameOrder.characterization.test.ts src/hooks/lineup/useMatchPreparation.ts`. If chore touches either file, either rebase the pairings branch onto main now (skipping the chore-branch dependency), OR wait for chore to merge before starting Unit 8 (the destructive deletion unit). |
| Cutover safety relies on the `prep_match` RPC's idempotency hardening from migration `20260504000000_harden_prep_match_write_guards.sql`. If a future migration relaxes that idempotency, the browser-refresh-mid-prep scenario this plan considers safe could no longer be safe. | Note the dependency; if anyone touches that migration's guards before this plan ships, re-validate the cutover analysis. |

## Documentation / Operational Notes

- No canon-doc edit required for this extraction. The canon's
  specific code-name references (`gameOrder.ts`, `getGameMatchup`,
  "computed inline", etc.) are examples of how today's code happened
  to do it, not requirements. A future canon refresh can update the
  examples; no urgency, no lock-gate ritual.
- After Unit 7 lands, Ed should refresh the browser to pick up the
  new code (Vite hot-reload). No `git pull` needed — Ed and Claude
  share the same local repo per the workflow memory.
- After Unit 8 lands, run `pnpm run lint` once to catch any stale
  imports the typecheck missed.

## Sources & References

- **Origin document:**
  [`docs/brainstorms/2026-05-25-pairings-generator-extraction-requirements.md`](../brainstorms/2026-05-25-pairings-generator-extraction-requirements.md)
- **Canon doc:**
  [`docs/league-system/modules/pairings-generator.md`](../league-system/modules/pairings-generator.md)
  (LOCKED — read-only reference)
- **Pattern references:**
  - `src/systems/team-geometry/{index.ts, types.ts}` — Module shape
    convention
  - `src/systems/match-format/{index.ts, types.ts}` — second exemplar
  - `src/utils/gameOrder.ts` — source algorithm being lifted
  - `src/utils/__tests__/gameOrder.characterization.test.ts` —
    existing characterization tests + style
  - `src/hooks/lineup/useMatchPreparation.ts` lines 145–320 — live
    caller seam
- **Predecessor plan:**
  [`docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`](2026-05-17-001-refactor-modular-framework-migration-plan.md)
  (R5 + line 84 — explicitly deferred Pairings Generator extraction
  to this plan)
