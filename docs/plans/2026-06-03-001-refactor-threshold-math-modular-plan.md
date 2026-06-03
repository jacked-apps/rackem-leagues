---
title: refactor — Threshold math as modules in the system's chain
type: refactor
status: active
date: 2026-06-03
revised: 2026-06-03 (third pivot — see Decisions)
---

# Threshold Math as Modules in the System's Chain

## Overview

Today's `useMatchPreparation.ts:219-309` builds the threshold payload
via an inline switch on `handicap_type × mechanism × winCondition`.
That's the runtime peeking at system identity — the exact violation
the principles in `CLAUDE.md` forbid.

This refactor makes prep-time threshold computation flow through the
modular pipeline: each Scoring System is an ordered list of modules;
the runtime iterates them against an empty state bag; `useMatchPreparation`
just reads the resulting bag values and hands them to the RPC.

## Anchor: Principles This Plan Honors

(From `CLAUDE.md`, written down so this plan can be checked against them.)

1. A Scoring System is an ordered list of modules. Nothing else.
2. The state bag starts EMPTY. Modules seed it.
3. Modules only know the state bag (and a read-only Context for side
   effects like DB reads).
4. Each module type does ONE specific thing.
5. The Workshop validates the wiring; the runtime trusts.
6. Output is the builder's responsibility.
7. Game win/loss data is sacred; everything else is derived. Module
   failures log and continue — never crash the scoring page.

## Key Decisions

- **Decision:** The runtime is a tiny iterator. It accepts a system
  (an ordered list of modules) and a read-only Context (match ID,
  pre-fetched match data, supabase client — whatever modules may need
  for side effects). It creates an empty bag, runs each module in
  order wrapped in try/catch, returns the populated bag. ~20 lines.
- **Decision:** Each existing system module gets a `chain: Module[]`
  field — the ordered list of modules to run at prep time. The legacy
  `matchPrepThresholds` composition idea from prior drafts is dropped;
  the chain IS the composition.
- **Decision:** Modules are split by SITUATION, not parameterized
  across situations. 3v3 chart lookup and 5v5% chart lookup are two
  separate modules. Fargo "compute home_to_win for games-won" and
  Fargo "compute home_to_tie for games-won" are separate modules.
- **Decision:** Team-bonus becomes its own module (today it's a legacy
  helper called inline). It reads team/season identifiers from the
  bag, queries season standings via Context, writes a team_bonus value
  back to the bag. Other modules that use it read it from the bag.
- **Decision:** The first modules in each chain are "seed modules"
  that populate the bag from the Context (player IDs, ratings, prefs,
  etc.). The runtime never pre-populates the bag.
- **Decision:** On any module throw, the runtime logs via
  `console.warn` and continues with whatever's in the bag so far. The
  bag values that downstream code expects may end up undefined — that's
  acceptable. The scoring page must continue to function. Game
  win/loss recording is independent of this code path entirely.
- **Decision:** `useMatchPreparation` reads named keys from the
  resulting bag (e.g., `bag.home_to_win`) and hands them to the
  existing `prep_match` RPC payload. The RPC and downstream consumers
  are untouched.
- **Decision:** This branch implements ONLY the threshold-payload
  modules + the runtime. Per-game scoring already has its own
  composition path (`points-system/runtime.ts`); we don't refactor
  that. The two paths can converge in a future branch.

## Goal

`useMatchPreparation`'s prep step becomes roughly this shape:

```
const bag = await runSystemChain(systemModule.chain, { matchId, matchData });
const thresholdPayload = {
  home_to_win: bag.home_to_win,
  home_to_tie: bag.home_to_tie,
  home_to_lose: bag.home_to_lose,
  away_to_win: bag.away_to_win,
  away_to_tie: bag.away_to_tie,
  away_to_lose: bag.away_to_lose,
};
await supabase.rpc('prep_match', { p_match_id, p_thresholds: thresholdPayload, p_game_rows });
```

Zero branching on system identity anywhere in `useMatchPreparation`.
Adding a new Scoring System: build its modules, declare its chain,
done. Runtime doesn't change.

## Non-Goals

- **Workshop UI** for editing chains. Future feature.
- **Migrating per-game scoring** to share this runtime. Already has its
  own composition path; future convergence is a separate branch.
- **Swap-recalc cleanup** (paused `feat/lineup-swap-recalibration`).
  When it resumes, it adopts the new runtime.
- **Per-player handicap calc** (`calculatePlayerHandicap.ts`). Future
  branch; this refactor doesn't touch the "player → number" path.
- **UI cell branching** (`HandicapCell.tsx`, `MatchLineup.tsx`'s
  team-bonus gating). UI-side modularity is its own branch.
- **Validating module compatibility at runtime.** Workshop's job; the
  runtime just runs.
- **Adapter modules.** Forward-looking concept; not built in this branch.

## Module Interface (Decided)

Every module implements this single shape:

```
interface Module {
  name: string;                                 // For logs
  run: (bag: StateBag, context: Context) => Promise<void> | void;
}
```

- `bag` is the only read/write surface. Modules read keys, write keys,
  do nothing else observable.
- `context` is read-only. Carries match ID, pre-fetched match data,
  supabase client, and any other side-effect handles modules need. The
  runtime decides what goes in Context; modules just receive it.
- `run` may be sync or async. The runtime awaits it either way.
- Modules return nothing. Any side effects go into the bag.

`StateBag` is a typed key/value record. Keys are strings; values are
whatever the producing module writes. The runtime doesn't validate
types — workshop catches type mismatches at composition time.

## Implementation Units

- [ ] **Unit 1: The runtime iterator (~30 lines)**

**Goal:** A tiny function that accepts a chain + context, creates an
empty bag, runs modules in order with per-module try/catch, returns
the bag.

**Files:**
- Create: `src/systems/chain-runtime/runSystemChain.ts`
- Create: `src/systems/chain-runtime/types.ts` (`Module`, `StateBag`,
  `Context` definitions)
- Test: `src/systems/chain-runtime/__tests__/runSystemChain.test.ts`

**Approach:**
- Single exported async function: `runSystemChain(chain, context) → StateBag`
- Creates `const bag: StateBag = {}`
- `for (const mod of chain) { try { await mod.run(bag, context) } catch (err) { console.warn(\`[chain] module \${mod.name} threw\`, err) } }`
- Returns the bag

**Test scenarios:**
- Empty chain → returns empty bag, no throws
- Chain with one module that writes a key → bag has that key after running
- Chain with three modules in order → each one's writes visible to the next
- One module throws → that module's writes don't land, others continue, runtime returns the bag with whatever ran successfully
- Async module → awaited correctly; downstream module sees its writes
- Sync module → runs synchronously; no unhandled promise

**Verification:**
- The runtime file has zero references to `handicap_type`,
  `mechanism`, `winCondition`, `points`, `fargo`, `percentage`,
  `skill_level`, or any system identity.

---

- [ ] **Unit 2: Seed modules (the empty-bag starting point)**

**Goal:** Modules that populate the bag with raw inputs every system
needs: player IDs, ratings, team IDs, season ID, lineup metadata.

**Files:**
- Create: `src/systems/modules/seed/seedLineupPlayers.ts`
- Create: `src/systems/modules/seed/seedLineupHandicaps.ts`
- Create: `src/systems/modules/seed/seedMatchIdentity.ts` (writes
  `home_team_id`, `away_team_id`, `season_id` from context's matchData
  into the bag)
- Test: per-module co-located characterization tests

**Approach:**
- Each seed module reads from `context.matchData` (passed in by
  `useMatchPreparation` from the React Query cache).
- Writes a single specific key (or small set of related keys) to the
  bag. E.g., `seedLineupPlayers` writes `home_player_ids` and
  `away_player_ids`. `seedLineupHandicaps` writes `home_handicaps`
  and `away_handicaps`.

**Test scenarios:**
- Each seed module: given a known matchData shape, writes the expected
  keys with the expected values
- Each seed module: given missing/null matchData fields, writes
  defined defaults (empty arrays / null) — does NOT throw

**Verification:**
- These are the only modules in the codebase that read from anything
  other than the bag. Every subsequent module reads only the bag.

---

- [ ] **Unit 3: Threshold modules — one per situation per output value**

**Goal:** Build the threshold modules each existing system needs.
Each module does ONE specific thing.

**Files (one file per module):**

For BCA 3v3 (Points handicap):
- `src/systems/modules/threshold/bca3v3/teamBonus.ts` — reads
  team/season IDs from bag, queries season standings via context's
  supabase client, writes `home_team_bonus` and `away_team_bonus` to
  bag
- `src/systems/modules/threshold/bca3v3/handicapDiff.ts` — reads
  handicaps + team bonuses from bag, writes `home_handicap_diff` and
  `away_handicap_diff` to bag
- `src/systems/modules/threshold/bca3v3/homeToWin.ts` — reads
  `home_handicap_diff` from bag, looks up 3v3 chart, writes
  `home_to_win` to bag
- `src/systems/modules/threshold/bca3v3/homeToTie.ts` — same pattern,
  writes `home_to_tie`
- `src/systems/modules/threshold/bca3v3/homeToLose.ts` — writes
  `home_to_lose`
- `src/systems/modules/threshold/bca3v3/awayToWin.ts`,
  `awayToTie.ts`, `awayToLose.ts` — mirror for away side

For BCA 5v5 Percentage:
- Same shape as 3v3 but using 5v5% chart. Eight separate modules
  (handicap diff + 6 threshold values; no team bonus for percentage).

For Fargo points-mode:
- `src/systems/modules/threshold/fargoPoints/homeToTie.ts` — reads
  matchData.home_to_tie (already-negotiated start points) and writes
  it through to the bag. Pure passthrough — the negotiation has
  already happened upstream.
- `src/systems/modules/threshold/fargoPoints/awayToTie.ts` — same.
- (No other thresholds written — `home_to_win`, `home_to_lose`,
  `away_to_win`, `away_to_lose` stay unset, which surfaces as null in
  the matches row, which is today's behavior for Fargo points-mode.)

For Fargo games-won:
- `src/systems/modules/threshold/fargoGames/homeToWin.ts` — reads
  ratings from bag, computes home games-to-win, writes to bag
- Five sibling modules for the other five threshold values
- Each module does its specific computation; if shared intermediate
  values are useful, they're cached via the bag itself (one upstream
  "compute weighting matrix" module writes the matrix; the six
  threshold modules read it)

**Test scenarios per module:**
- Happy path: given the inputs the module declares, it writes the
  expected output value
- Edge: input missing or null — module writes defined fallback (or
  silently skips writing) without throwing
- Module is pure w.r.t. the bag: same inputs always produce same
  outputs

**Verification:**
- Each module file references ONE chart or formula or DB query.
- No module file branches on `handicap_type`, mechanism, etc.

---

- [ ] **Unit 4: Declare each system's chain**

**Goal:** Each shipping system module declares its ordered chain of
modules.

**Files:**
- Modify: `src/systems/bca3v3.ts` — add `chain: Module[]` field with
  the seed modules + bca3v3 threshold modules in dependency order
- Modify: `src/systems/bca5v5.ts` — same shape with 5v5% modules
- Modify: `src/systems/fargo5v5.ts` — declare BOTH chains (points-mode
  and games-won). `buildSystemFromPreferences` picks which chain the
  ad-hoc-resolved system gets based on winCondition (this single
  decision lives in `buildSystemFromPreferences`, NOT in the runtime).
- Modify: `src/systems/types.ts` — add `chain: Module[]` to the
  `SystemModule` interface as a required field

**Approach:**
- Order matters: seeds first, then anything that depends on seeds,
  then anything that depends on those, etc.
- Workshop-future-ready: the chain shape (an array) is what a future
  workshop UI will edit.

**Verification:**
- Each system has a working chain.
- Each chain's modules' read-keys all have a matching write-key from
  an upstream module in the same chain. (This is what the workshop
  will eventually enforce automatically; for now, the implementer
  checks by hand and the tests in Unit 5 catch mistakes.)

---

- [ ] **Unit 5: Rewire useMatchPreparation + delete dead code**

**Goal:** Replace the inline switch with a single `runSystemChain`
call. Delete the helpers that are now redundant.

**Files:**
- Modify: `src/hooks/lineup/useMatchPreparation.ts:219-309` — replace
  the 90-line switch with: build context from matchData, call
  `runSystemChain(systemModule.chain, context)`, read six named keys
  from the resulting bag into the threshold payload, hand to RPC
- Delete: `src/utils/calculateHandicapThresholds.ts` (replaced by the
  bca3v3/bca5v5 threshold modules)
- Delete: `src/utils/getTeamHandicapBonus.ts` (its body moves into
  the `teamBonus` module)
- Delete: `src/utils/handicap/fargoGamesWonThresholds.ts` (its math
  moves into the fargoGames threshold modules — or stays as a private
  helper imported only by those modules)
- Modify: `src/player/MatchLineup.tsx:64,244` — replace
  `shouldUseTeamBonus(handicapType)` with an inline check (flagged in
  PR description as future UI-side modular cleanup, separate branch)
- Test: characterization test runs each shipping preset through
  `useMatchPreparation` and asserts the threshold payload equals
  today's output for each configuration

**Verification:**
- Grep `useMatchPreparation.ts` for `'fargo'`, `'points'`,
  `'percentage'`, `'skill_level'`, `isFargoStartPoints`,
  `isFargoGamesWon` → zero hits in code
- Characterization test passes for BCA 3v3, BCA 5v5%, Fargo points-mode,
  Fargo games-won
- TypeScript compiles with no orphan imports

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A threshold module produces wrong output vs. today's helper | Per-module characterization tests in Unit 3 lock byte-equivalence against the current helpers' outputs for the same inputs. Unit 5's end-to-end characterization catches integration-level drift. |
| A module throws at runtime | Runtime catches and logs; the bag entry for that module's output stays undefined; matches row gets a null for that column. Scoring page continues. Game-recording is untouched. (Honors principle 7.) |
| Module count is high (e.g., ~30 modules for 4 systems) | True. Each module is small (5–30 lines). Total LOC across all modules is comparable to the helpers they replace, but each module is self-contained and discoverable. Better for future contributors than one big switch. |
| Adding a new system means many new module files | Each new module is small. The cost is the cost of doing it modularly. Tradeoff is explicit in principle 4 — "different situations are different modules." |
| `buildSystemFromPreferences` still branches on winCondition for Fargo | Yes — it has to choose between Fargo's two chains. This is a single decision in one named place (Workshop-config in spirit; it'll be data-driven once the workshop exists). Centralizing this one decision is worth the residual coupling. |
| Modules-reaching-DB (team bonus) introduces I/O at points the inline switch didn't | The DB call exists today, just inside `getTeamHandicapBonus`. Moving it into a module doesn't add I/O — it relocates it. Workshop's future job is ensuring chains don't accidentally fire expensive I/O multiple times. |

## Success Criteria

- `useMatchPreparation.ts` contains zero literal handicap-type /
  mechanism / winCondition strings in code (comments allowed).
- The `runSystemChain` runtime file contains zero references to any
  system identity.
- Each system has a working `chain: Module[]` field; running the chain
  produces the same threshold payload today's inline switch produces.
- A failing module logs and does NOT throw out of the runtime; the
  scoring page continues to function.
- Adding a hypothetical new system requires only new module files +
  declaring its chain on a new system module. Zero edits to
  `useMatchPreparation`, the runtime, or any other system's modules.

## Sources & References

- Architectural principles: top of `CLAUDE.md` (the seven principles
  pinned 2026-06-03).
- Existing modular patterns referenced (not copied):
  `src/systems/points-system/runtime.ts` (per-game scoring runtime —
  similar shape, different scope), `src/utils/handicap/index.ts:31`
  (`getGamesNeeded` — the existing modular-routing utility for the
  separate per-side games-needed lookup).
- Locked module docs: `docs/league-system/modules/*/README.md` (read
  before placing any logic; principle from `[[respect-locked-docs]]`).
