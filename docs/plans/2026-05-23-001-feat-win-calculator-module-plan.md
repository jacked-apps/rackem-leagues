---
title: "feat: Win Calculator Module — pure judge (games + points comparators, win-chip override)"
type: feat
status: active
date: 2026-05-23
origin: docs/league-system/modules/win-calculator.md
branch: docs/win-calculator-endgame-brainstorm
---

# Win Calculator Module — pure judge

## Overview

Build the **Win Calculator** as a real, live, isolated module: a "stupid" pure judge that, when a match ends, reads only its own LO-assigned config plus the final values in the shared match-state bag, and returns **a winner (`home`/`away`)** — or **no winner** (a tie, which it hands up to the runtime and forgets about). It replaces today's inline winner logic in `MatchEndVerification.tsx` and deletes the dead, wrong-architecture scaffolding in `src/systems/win-calculators/`.

This plan was built against the Win Calculator v2 draft — now **ratified into the locked [`win-calculator.md`](../league-system/modules/win-calculator.md)** (2026-05-23). Per the [revision protocol](../league-system/revision-protocol.md), this plan served as that draft's **validation gate** — friction surfaced during planning was resolved by changing the plan or by cheap edits to the draft before ratifying. The [v2 Validation Findings](#v2-validation-findings-the-gate-deliverable) section is that gate's output.

The corrected model below **supersedes v2's "LO-ordered set of four comparators" framing** — it emerged from the 2026-05-23 planning dialogue and tightens the design. The two required v2 trims are listed in the findings section.

## Problem Frame

Every match tracks two metrics: **games** (recorded per game) and **points** (allocated by the Points System). Something must read the final state and answer the only question that matters: **who won?** Today that answer is computed inline in one screen file, branching on a binary `win_condition` preference. The whole modular Scoring System exists so that — eventually — a non-coder pool-league expert can assemble win logic from named **dials** in a workshop (Ed writes the dial manual). The Win Calculator is the engine piece those dials drive. It must be:

- **Isolated** — it infers nothing from any other module. It reads its own config + named values from the shared state bag. (Per [PRINCIPLES](../league-system/PRINCIPLES.md) composability / no-bleed; see also institutional memory: "one primitive at a time, no cross-referencing".)
- **Stupid + never-break** — it does exactly what it's told and names a winner; bad/illogical config is the **workshop's** fault (guardrails live there), not this module's. Live scoring must never throw (36 players mid-match); games-won is sacred, the winner is derived + recoverable.
- **Workshop-ready in shape** — its config is a clean, serializable, named-dial structure a future screen can populate, even though a developer sets it in code today.

## The corrected Win Calculator model (the spec this plan builds to)

**When it runs:** the instant the runtime sees the **end-match chip** OR the last game has been played. Not before.

**What it does, in order:**
1. **Win chip set?** If a winner (`home`/`away`) is already written into the shared bag under `edge`, that side won. Stop. (The chip is an unconditional override — usually written by a clinch trigger; the Win Calc neither knows nor cares who wrote it.)
2. **No chip?** Walk the LO-assigned comparators in the LO-assigned **order** (the LO may enable only one). There are exactly two possible comparators:
   - a **games comparator** with a mode dial: **most** (higher count wins; equal → no decision) or **met goal** (a side reaching its games target wins; neither → no decision),
   - a **points comparator** with the same **most**/**met goal** mode dial.
   The first comparator that names a winner decides.
3. **Still no winner?** Report **"no winner → tied"** up to the runtime. Done.

**What it never does:** peek at handicaps/thresholds/triggers to infer anything; hold a tie slot, tie chip, or Allow-Ties setting; decide what to *do* about a tie; or validate whether the LO's setup is sensible.

**Two distinct chips (both are workshop choices, neither is built here):**
- **Win chip** — "who won" (the override the judge honors first). Produced by a trigger; the games **met-goal** comparator is a deliberate **safety net** behind it (re-derives "met goal" from the bag so the right winner is still named if the chip wasn't written in some edge case — games-won is sacred, so it gets a redundant path).
- **End-match chip** — "stop playing, no more games needed" (e.g. best-2-of-3: win the first two, skip game 3). A flow-control token the **runtime** consumes to stop play; the Win Calc only treats its presence as one of the two "now run" triggers.

**Comparator math (directional):**
- **most** ≈ `if (a === b) return no-winner; return a > b ? home : away` — the trivial two-number compare (head-start handicaps fold the advantage into the totals, so raw compare is fair).
- **met goal** ≈ `if (home >= homeTarget) return home; if (away >= awayTarget) return away; return no-winner` — easier-path handicaps put the advantage in the differing targets.

Head start and easier path are the same math seen from opposite ends (race-to-10 with 2 on the wire ≡ home-to-10/away-to-8); the workshop picks the mode that matches the handicap it handed out. The Win Calc just runs the assigned mode.

## Requirements Trace

- **R1.** Win Calc is a pure function over (its own config) + (the shared state bag); it imports/queries no other module and infers nothing from handicap/threshold/trigger modules.
- **R2.** Output is a **winner only** (`home`/`away`) or **no-winner** (tie residue). It never stores/produces a "tie" value and holds no tie slot/chip.
- **R3.** Win-chip override: if `edge` is set in the bag, return that side and skip comparators.
- **R4.** Exactly two comparators (games, points), each with a `most`/`met_goal` mode, plus an LO order that may enable one or both.
- **R5.** Never throws. On any internal error it logs and bypasses (treats that comparator as "no decision"), consistent with the engine's never-break contract.
- **R6.** Live: it is the source of truth for the recorded match winner (`matches.winner_team_id` / `matches.match_result`), replacing the inline logic in `MatchEndVerification.tsx`.
- **R7.** Behavioral parity at cutover: for every shipped configuration it produces the identical winner today's code does, proven by characterization tests, with legacy kept as fallback + divergence auditor (mirror the points cutover).
- **R8.** Config is a serializable, named-dial shape a future workshop screen can populate; no DB/wizard work is required now.
- **R9.** The dead `src/systems/win-calculators/` (metric-stack/edge) and dead `fargo5v5.computeMatchResult`/`calculateFargoMatchTotals` paths are removed; doc source-of-truth anchors updated.

## Scope Boundaries

- **Not** the per-game point allocation (Points System), the handicap encoding (Handicap System), the asymmetry kind (Handicap Mechanism), or the chart that turns a handicap into a target (Threshold Charts).
- **Not** the production of the win chip (that's a trigger, configured in a Points composition) — this module only *reads* the chip.
- **Not** the end-match chip's "stop play" execution (runtime/race-mode termination).
- **Not** tie *resolution* — what happens after "no winner" (accept the tie, or break it). That is a separate, isolated module (the future Tiebreak System) and the runtime's orchestration.
- **Not** the season Standings concern.
- **Not** the workshop UI, the dial instruction manual, or a data-driven DB config column for comparator sets.

### Deferred to Separate Tasks

- **Prerequisites (sequence first; not planned here):** Threshold Charts (as first-class modules) → the Trigger primitive → this Module. Build order per Ed. *Nuance:* the match-end judge itself has only a soft dependency — at match-end it compares final values already present, and with no clinch trigger configured the win-chip path is simply dormant (correct, comparators decide). The **win-chip clinch feature** is what hard-depends on the Trigger primitive; building Win Calc after the prereqs lets that path light up. The cutover in this plan preserves parity with the chip path dormant.
- **Tiebreak System Module** (consumes "no winner", produces a winner that re-enters as the chip): its own future work. This plan only defines the seam where the judge hands a tie to the runtime; existing scattered tiebreaker hooks stay untouched.
- **Data-driven comparator-set config + workshop UI + dial manual:** future. This plan ships the serializable config *shape* so those are a bolt-on, not a rewrite.
- **End-match chip / race-mode termination:** future flow-control work.
- **Points met-goal target substrate:** there is no `points_to_win`/`points_to_tie` source field today (see Key Technical Decisions). A points `met_goal` comparator needs that plumbing added before it can be configured — out of scope here (shipped points leagues use `points → most`).

## Context & Research

### Relevant Code and Patterns

- **Live winner chokepoint (to replace):** `src/components/scoring/MatchEndVerification.tsx` — reads `win_condition` from `system_snapshot` (frozen-at-first-score); games-mode calls `determineMatchResult(...)`; points-mode is an inline ternary (most points, games as tiebreak, home favored on exact tie, never a tie); maps to `winnerTeamId`; persists `winner_team_id` + `match_result` via `useUpdateMatch` after both scorekeepers verify (first-verifier device writes).
- **Games-mode logic (today = compare-to-target / "met goal"):** `src/utils/determineMatchResult.ts` — home reaches win target → home; away reaches win target → away; both at tie targets → tie; default tie. Has a characterization test already: `src/utils/__tests__/determineMatchResult.characterization.test.ts`.
- **Wired-but-inert, wrong-architecture scaffolding (to replace, NOT `rm`):** `src/systems/win-calculators/{types,walker,index}.ts` implements the **old** "metric precedence stack + `edge`" model v2 deletes. Important correction (from feasibility review): `getWinCalculator()` IS called in four live files (`src/systems/bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`, `buildSystemFromPreferences.ts`) and populates `SystemModule.winCalculator` — a **required (non-optional) field** on the `SystemModule` interface at `src/systems/types.ts`. But `.decide()` is never invoked and `.winCalculator` is never read at runtime, so the field is **inert**. Removing it is therefore **interface surgery across ~5 files + dropping the required field from `SystemModule` + updating its characterization tests** — not a directory delete.
- **Orphaned vs live-assigned Fargo winner code:** `src/utils/fargoMatchTotals.ts` `calculateFargoMatchTotals` has zero non-test callers (truly orphaned). But `fargo5v5.scoring.computeMatchResult` is still **assigned live** into the SystemModule at `src/systems/buildSystemFromPreferences.ts` (the `scoring` capability). Whether that assignment is dead depends on whether `SystemModule.scoring.computeMatchResult` is ever invoked — grep-confirm before deleting it; do not assume.
- **The shared state bag (the "shared pile"):** `MatchStateBag = Record<string, MatchStateValue>` defined at `src/systems/points-system/types.ts`; created/seeded in `src/systems/points-system/runtime.ts` `evaluatePointsSystem` with keys `home_wins`, `away_wins`, `home_points`, `away_points`, `games_played`, `total_games`, plus every resolved threshold written by name, plus trigger-written keys. The engine NEVER-THROWS (`fireTrigger` warns + skips on failure). Today the bag is discarded after each totals computation — only `home_points`/`away_points` are harvested by `src/systems/points-system/match-adapter.ts`.
- **Live points engine = source of truth (the cutover precedent to mirror):** `src/api/queries/matches.ts` `updateMatchRunningTotals` runs the engine via `src/utils/match/engineRunningTotals.ts`, uses engine output as source of truth, keeps legacy `computeMatchRunningTotals` as fallback + reverse-auditor (logs divergence), and runs `auditMatchScoringConsistency` post-completion.
- **Points compositions (the code-defined-config pattern to match):** `src/systems/points-system/compositions/{points-3-man,percent-5-man,10-point}.ts`, selected by `points_calculator` in `src/systems/buildSystemFromPreferences.ts`. The Win Calc config builder mirrors this shape.
- **Resolver wiring:** `src/systems/buildSystemFromPreferences.ts:429` builds the (dead) `winCalculator` field via `getWinCalculator(prefs.win_condition)`. This plan replaces that with the new module.

### Institutional Learnings (from auto-memory; repo has no `docs/solutions/`)

- **Scoring engine must never break** — judge returns a safe degraded verdict / "no decision", never throws; collect errors for a future notify hook rather than only `console.warn`.
- **Plan from the target (v2), not the existing code** — map the structural gap backward; the halted scaffolding is wrong-architecture to replace, not a base to extend.
- **Two-paths-audit + characterization parity** — prove the flip invisible by parity; keep legacy as fallback + auditor.
- **Build it UI-ready / workshop is the north star** — config must be a serializable named-dial shape; engine flawless first, workshop after.
- **Explicit string sentinels, not NULL** — applies if/when a DB config column is added (deferred); note the `resolved_league_preferences` COALESCE cascade silently collapses NULL.
- **Frozen-snapshot rule** — the judge reads targets/ratings frozen at prep, never recomputed live.

### External References

None needed — this is internal architecture against an internal spec, mirroring an already-proven internal cutover.

## Key Technical Decisions

- **The judge is a pure function `decideWinner(state, config) → Verdict`** where `Verdict = { winner: 'home' | 'away' } | { tie: true }`. No I/O, no module imports, no throws.
- **Config shape (serializable, named dials):** `{ order: ('games'|'points')[]; games?: { mode: 'most'|'met_goal' }; points?: { mode: 'most'|'met_goal' } }`. A metric absent from `order` is "off" (the "look at only one" case). The win-chip check is implicit and always first. This is exactly the shape a future workshop screen fills in.
- **Config is built in code for now, keyed off today's `win_condition`** — mirroring how Points compositions are picked by `points_calculator`. This reproduces *current* behavior exactly for every league (preset and ad-hoc); the most/met-goal *choice* is not yet exposed to LOs (that's the workshop). No DB/wizard/RLS work. (Decided with Ed: code-defined interim, serializable shape for easy workshop bolt-on later.)
- **State the judge reads** (sourced from the live engine bag / values already in `MatchEndVerification`): `home_games`, `away_games`, `home_points`, `away_points`, per-side games/points targets, and the optional `edge` chip (the winner chip). For met-goal, only the **win** target affects the outcome — today's `determineMatchResult` returns `'tie'` on both its tie-target and default branches, so the comparator needs only `home/away win target` to be parity-exact (the tie target is cosmetic in current code; documented).
- **Doc concept names vs code symbols.** The doc names the *concept* with a stable canonical name; code symbols may differ to dodge clashes, tied by a single-sourced mapping. The one hard contract is the **state-bag key** — every module touching a value must use the same key, so it lives as one shared constant. Concretely: the winner chip's key is **`edge`** (the doc term + the key existing clinch triggers already write), deliberately distinct from `MatchEndVerification`'s existing local `result` var (the DB string `'home_win'|'away_win'|'tie'`). Using `edge` for the chip matches the established key and avoids colliding with that `result` var.
- **Points met-goal has no target substrate today (feasibility-review finding).** `HandicapThresholds` (`src/types/match.ts`) carries only `games_to_win`/`games_to_tie`/`games_to_lose`; there is **no `points_to_win`/`points_to_tie` field**, and `games_to_win` (which doubles as a points target) is null in shipped points formats (Fargo plays all games). This is fine for parity because the points config uses `points → most` (needs no target). But it means a points **`met_goal`** comparator is **unbuilt plumbing**, not merely deferred config — `WinCalcState.home/away_points_target` will be null/absent until a points-target source is added (workshop-era). Document this on the type; do not pretend the substrate exists.
- **Full live cutover, phased** (decided with Ed): build + parity in isolation (Phase 1–2), then swap the live path with legacy as fallback + auditor (Phase 3). Avoids re-creating dead scaffolding.
- **New module directory `src/systems/win-calculator/` (singular)** signals the clean break from the dead plural `win-calculators/`. Internal naming is a developer call.

## v2 Validation Findings (the gate deliverable)

Running this plan against v2 surfaced the following. None blocks building. Items 1–2 were **applied to the v2 draft (2026-05-23)**; item 3 records the **gate step 2 (puzzle-fit) outcome**; items 4–5 are clarifications.

1. **Comparator structure is tighter than v2 says — v2 trim APPLIED (2026-05-23).** v2 §"The comparator switch" describes "an LO-ordered set of comparators" as "a 2×2 of four." The real model is **two comparators (one games, one points), each with a `most`/`met_goal` mode, plus an order filter** (and each may be off). Same capability, cleaner shape. Replace the "ordered set of four" framing accordingly. (The 2×2 of *what×how* survives as "two metrics × two modes"; it just isn't four independent, repeatable list entries.)
2. **No tie slot / Allow-Ties inside Win Calc — v2 trim APPLIED (2026-05-23).** v2 §"Ties and the Tiebreak System" adds an "**Allow-Ties** module" that "occupies the tie slot" and says tie-handling "**Config lives here**." Per Ed, the Win Calc holds *no* tie config of any kind — it only reports "no winner," and what to do about it belongs to a separate isolated module. Delete the Allow-Ties-module / tie-slot / "config lives here" content from the Win Calc doc (it moves to the future tie-resolution module). v2's correct, surviving framing: a tie is the *absence* of a winner, concluded only at match-end, handed to the runtime.
3. **Cross-doc puzzle-fit — gate step 2 RAN (2026-05-23); outcome recorded here.** Four parallel cold reads checked v2 against the locked docs. Keeping the winner chip named **`edge`** (its established term across the puzzle) dissolved most apparent conflicts — `trigger.md`, points-system README, threshold-charts, and the league README already use `edge`, so they now agree with v2's vocabulary. The one real remaining mismatch: a few docs still say the **Win Calc fires** the tiebreak, whereas v2 moves firing to the **runtime** (pure judge). Resolution by doc:
   - **team-geometry.md** — was a *finished* module blurring into the tiebreak (it described the Win Calc's stack + edge-as-fallback + firing). **Trimmed via the Principle-7 gate (2026-05-23)** to state only its own fact (even game counts can tie on games, odd can't).
   - **threshold-charts/5v5-games-needed.md** (the universal Percentage Games-Needed formula — misleadingly named) — same finished-module over-reach (it narrated the Win Calc's metric stack / tiebreak firing / edge metric, plus a peek at the Points tie-band rule). **Trimmed via the Principle-7 gate (2026-05-23)** at 4 spots to state only its own parity-output facts + clean hand-off disclaimers; the formula, calibration, and I/O are untouched.
   - **tiebreak-system/README.md** and **pairings-generator.md** — both are *not finished* (each pending its own modular v2). Their firing-ownership fix is **DEFERRED and logged** as a required delta for those future v2s — NOT a blocker on win-calculator ratification (don't hold a finished module hostage to unfinished siblings). **Logged delta for both:** the Win Calculator does not fire the tiebreak — it concludes a tie; the *runtime* fires the tiebreak; `edge` is the winner chip the Win Calc consumes (not a lowest-precedence stack metric). pairings-generator keeps its legitimate `mini_match`-uses-pairings link.
   - **migration plan** `2026-05-17-001-...` (Units 1 & 9) still uses metric-stack/`edge` language — superseded; update when those units are next touched.
4. **Where the win chip lives between clinch and match-end — clarification.** v2 doesn't say. In threshold-mode (full game count always played) the engine re-runs over all games on each evaluation, so a clinch trigger re-fires deterministically and the chip is **reconstructed in the bag at match-end** — no new persistence needed. Chip persistence becomes necessary only for the **end-match chip / race-mode early-stop** (deferred). Recommend a one-line v2 note tying this to the open "race-mode" item.
5. **Input substrate — clarification.** v2 stays conceptual ("examines the collected match data"). The concrete substrate is the engine's `MatchStateBag`. For *this* cutover the judge reads the same scalars `MatchEndVerification` already has (no bag-surfacing needed); reading the richer bag is the future chip/clinch path. Recommend naming `MatchStateBag` in v2's "Current implementation status".

## Output Structure

    src/systems/win-calculator/                 # new (singular) — replaces dead win-calculators/
      types.ts            # Verdict, ComparatorMode, WinCalcConfig, WinCalcState
      comparators.ts      # pure most() + metGoal() per-metric resolvers
      judge.ts            # decideWinner(state, config) — chip-first → ordered comparators → no-winner
      configs.ts          # buildWinCalcConfig(win_condition) → WinCalcConfig (code-defined, serializable)
      index.ts            # public exports + factory
      __tests__/
        comparators.test.ts
        judge.test.ts
        parity.test.ts    # characterization: new judge ≡ today's winner for all shipped configs

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
runtime sees end-match chip OR last game played
        │
        ▼
decideWinner(state, config):
    if state.edge in {home, away}:          # win-chip override
        return { winner: state.edge }
    for metric in config.order:             # e.g. ['points','games'] or ['games']
        mode = config[metric].mode          # 'most' | 'met_goal'
        w = comparator(metric, mode, state) # → 'home' | 'away' | null   (null = no decision)
        if w: return { winner: w }
    return { tie: true }                    # no winner → handed up to runtime, then forgotten

comparator(metric, 'most', s):
    a, b = s[home_<metric>], s[away_<metric>]
    return a === b ? null : (a > b ? 'home' : 'away')

comparator(metric, 'met_goal', s):
    homeMet = s[home_<metric>] >= s[home_<metric>_target]
    awayMet = s[away_<metric>] >= s[away_<metric>_target]
    if homeMet and awayMet: flag('both-met-target — impossible w/ correct targets'); return null
    if homeMet: return 'home'
    if awayMet: return 'away'
    return null   # neither met → no decision (normal tie path)

# every comparator call wrapped: on throw → log + return null (never-break)
```

Parity mapping (today's fixed behavior, reproduced by `buildWinCalcConfig`):

| `win_condition` | Config produced | Reproduces |
|---|---|---|
| `games` | `{ order: ['games'], games: { mode: 'met_goal' } }` | `determineMatchResult` (per-side game targets; no-winner ⇒ tie) |
| `points` | `{ order: ['points','games'], points: { mode: 'most' }, games: { mode: 'most' } }` | inline points ternary (most points; games tiebreak; exact-tie home-favored branch is unreachable in shipped odd-game formats — documented) |

## Implementation Units

### Phase 1 — Build the judge (isolated; no live wiring)

- [ ] **Unit 1: Types + serializable config shape**

**Goal:** Define the module's contract: `Verdict`, `ComparatorMode`, `WinCalcConfig` (the named-dial shape), and `WinCalcState` (the exact slice of the bag the judge reads).

**Requirements:** R1, R2, R4, R8

**Dependencies:** None

**Files:**
- Create: `src/systems/win-calculator/types.ts`

**Approach:**
- `Verdict = { winner: 'home' | 'away' } | { tie: true }`.
- `ComparatorMode = 'most' | 'met_goal'`.
- `WinCalcConfig = { order: ('games'|'points')[]; games?: { mode: ComparatorMode }; points?: { mode: ComparatorMode } }` — metric absent from `order` = off. Document that this is the future workshop's dial shape.
- `WinCalcState = { home_games; away_games; home_points; away_points: number; home_games_target; away_games_target; home_points_target; away_points_target: number | null; edge?: 'home' | 'away' | null }` (the `edge` field is the winner chip — same key the existing clinch triggers write).
- Full `@fileoverview` + JSDoc per repo docs standard; name each field as a "dial" where it maps to one.

**Patterns to follow:** `src/systems/points-system/types.ts` (state-bag types, doc density).

**Test scenarios:** Test expectation: none — pure type declarations, no behavior.

**Verification:** `pnpm run build` (typecheck) passes; types referenced by later units compile.

- [ ] **Unit 2: The two comparator modes (pure)**

**Goal:** Implement `most` and `met_goal` as pure per-metric resolvers returning `'home' | 'away' | null`.

**Requirements:** R4, R5

**Dependencies:** Unit 1

**Files:**
- Create: `src/systems/win-calculator/comparators.ts`
- Test: `src/systems/win-calculator/__tests__/comparators.test.ts`

**Approach:**
- `most(homeVal, awayVal)`: equal → `null`; else higher → that side.
- `metGoal(homeVal, homeTarget, awayVal, awayTarget)`: **exactly one** side ≥ its target → that side; neither → `null`. **Both** ≥ their targets → `null` **and raise an anomaly flag** ("both met target — impossible with correct targets"): never throw, never pick a side. Diagnosing/routing the bad targets is not this module's job (the comparator reads targets from state, agnostic to which chart produced them). A `null` target ⇒ that side can't meet a goal ⇒ contributes no decision.
- No throws in normal paths; guard division/`NaN` only if any arithmetic is introduced (none expected here).

**Patterns to follow:** small pure utilities under `src/utils/` / `src/systems/`.

**Test scenarios:**
- Happy path (most): `most(12,6)→home`; `most(6,12)→away`.
- Edge (most): `most(9,9)→null` (equal = no decision); `most(0,0)→null`.
- Happy path (met_goal): home 10 / target 10 → `home`; away 8 / target 8, home 7 / target 10 → `away`.
- Edge (met_goal): neither meets (home 7/10, away 6/8) → `null`; **both meet (home 10/10, away 8/8) → `null` + anomaly flag raised** (NOT an arbitrary home win); `null` win target → no decision from that side.

**Verification:** `pnpm test:run` green for `comparators.test.ts`; outputs match the table above.

- [ ] **Unit 3: The judge (chip-first → ordered comparators → no-winner)**

**Goal:** `decideWinner(state, config)` implementing the full contract, never-throws.

**Requirements:** R1, R2, R3, R5

**Dependencies:** Units 1–2

**Files:**
- Create: `src/systems/win-calculator/judge.ts`
- Test: `src/systems/win-calculator/__tests__/judge.test.ts`

**Approach:**
- Win-chip override first: `if (state.edge === 'home' || state.edge === 'away') return { winner: state.edge }`.
- Else walk `config.order`; for each metric, dispatch to `most`/`met_goal` per its mode using the matching state fields; first non-null → `{ winner }`.
- Exhausted → `{ tie: true }`.
- Wrap each comparator dispatch in try/catch: on error, log (structured, for a future notify hook) + treat as no-decision. The judge itself never throws.

**Execution note:** Implement test-first — the contract (chip override, order, residue, never-throw) is well-defined and small.

**Patterns to follow:** never-break style of `src/systems/points-system/runtime.ts` `fireTrigger`.

**Test scenarios:**
- Happy: chip `edge='away'` set → `{winner:'away'}` even though comparators would say home (override proven).
- Happy: no chip, `order:['games'], games:met_goal`, home meets target → `{winner:'home'}`.
- Happy: no chip, `order:['points','games']` both `most`, points decide → winner from points; points tied, games decide → winner from games.
- Edge: no chip, single comparator, no decision → `{tie:true}`.
- Edge: empty `order` (degenerate) + no chip → `{tie:true}`.
- Edge: metric in `order` but its config entry missing/off → skipped safely.
- Error path: a comparator throws (inject) → judge logs, treats as no-decision, continues; never throws.
- Integration: order matters — same state, `['points','games']` vs `['games','points']` can yield different winners; assert both.

**Verification:** `pnpm test:run` green; never-throw asserted via injected fault.

- [ ] **Unit 4: Code-defined config builder**

**Goal:** `buildWinCalcConfig(win_condition)` → `WinCalcConfig`, reproducing today's fixed behavior; factory/exports in `index.ts`.

**Requirements:** R7, R8

**Dependencies:** Unit 1

**Files:**
- Create: `src/systems/win-calculator/configs.ts`
- Create: `src/systems/win-calculator/index.ts`

**Approach:**
- `'games'` → `{ order: ['games'], games: { mode: 'met_goal' } }`.
- `'points'` → `{ order: ['points','games'], points: { mode: 'most' }, games: { mode: 'most' } }`.
- Unknown value → log + safest default (`games` met-goal), per graceful-degradation pattern.
- Document that this is the *interim* config source; the most/met-goal choice is not yet LO-exposed (workshop). Keep the returned object plainly serializable.

**Patterns to follow:** `pickPointsSystem` dispatch in `src/systems/buildSystemFromPreferences.ts`; the composition builders' shape.

**Test scenarios:**
- Happy: `buildWinCalcConfig('games')` and `('points')` return the exact shapes above.
- Edge: unknown string → default config + a single warn.

**Verification:** `pnpm test:run` green; shapes feed Unit 5 parity tests.

### Phase 2 — Prove parity

- [ ] **Unit 5: Characterization parity tests**

**Goal:** Lock today's winner behavior and prove the new judge (config + `decideWinner`) reproduces it for every shipped configuration, before any live swap.

**Requirements:** R7

**Dependencies:** Units 1–4

**Files:**
- Create: `src/systems/win-calculator/__tests__/parity.test.ts`
- Reference: `src/utils/__tests__/determineMatchResult.characterization.test.ts`

**Approach:**
- Build a case matrix over the shipped presets (BCA 3v3 → games/met-goal with per-side targets; BCA 5v5 → games/met-goal; Fargo 5v5 → points/most + games/most) plus boundary cases: clear wins each side, both-meet-target, neither-meets (tie residue), points-equal-games-differ, and the points exact-tie branch.
- **Tiebreaker re-entry (feasibility-review finding):** `MatchEndVerification` is reused for tiebreaker rounds via `src/components/scoring/TiebreakerScoreboard.tsx` with hardcoded `homeWinThreshold=2, tieThreshold=null, isTiebreakerMode=true`. Add a parity case for this second pass: `buildWinCalcConfig('games')` → games met-goal with target 2 must reproduce the current best-of-3 tiebreaker winner. This shadow path is NOT one of the three presets — call it out explicitly.
- For games cases, assert the judge's verdict matches `determineMatchResult` outcome 1:1.
- For points cases, assert the judge's verdict matches the current inline ternary outcome 1:1.
- Map judge `Verdict` → the legacy `'home_win'|'away_win'|'tie'` for comparison.

**Execution note:** Characterization-first — capture current behavior as the oracle, then assert equivalence.

**Test scenarios:**
- Happy: each preset's representative final score → identical winner old vs new.
- Happy: tiebreaker re-entry (target 2, best-of-3) → identical winner old vs new.
- Edge: BCA tie (e.g. 9–9 at tie targets) → both produce tie/no-winner.
- Edge: Fargo points-equal → both fall to games; games decide identically.
- Known divergence (NOT strictly unreachable — feasibility/scope finding): points exact-tie (points AND games equal). New judge → `tie` (v2-correct: residue handed to the future tie-resolution module); legacy → `home` (home-favored fallback). This **cannot** occur in odd-game formats (Fargo 5v5 = 25 games), but **can** occur in even-game points formats (4v4/3v3). Assert the odd-game case never reaches it; for an even-game synthetic case, assert the intended `tie` and document that the live divergence auditor will (correctly) flag it if such a league exists — it is the v2 fix replacing a latent home-favored bug, not a regression.
- Known divergence (met-goal both-met): if both sides reach their games-target — impossible with correct targets — the new judge returns no-winner **plus an anomaly flag** (→ tie), whereas legacy `determineMatchResult` returns `home` (home-first). Unreachable with correct charts; if synthetically forced, assert the new `tie` + flag and document it as intended v2 anomaly-handling, not a regression. (This means the games/met-goal parity claim holds for all chart-valid scorelines; the only old/new difference is this malformed-target case.)

**Verification:** `pnpm test:run` green; matrix covers all three presets + tiebreaker re-entry + boundaries; the only old/new divergences are the two documented, unreachable-with-correct-config cases (points exact-tie; met-goal both-met).

### Phase 3 — Live cutover (strangler-fig)

- [ ] **Unit 6: Cut the live winner path over to the judge**

**Goal:** Make the judge the source of truth for the recorded winner in `MatchEndVerification.tsx`; keep legacy as fallback + divergence auditor; wire the resolver to the new module.

**Requirements:** R6, R7, R5

**Dependencies:** Unit 5 green

**Files:**
- Modify: `src/components/scoring/MatchEndVerification.tsx`
- Modify: `src/systems/buildSystemFromPreferences.ts`
- Test: `src/components/scoring/__tests__/MatchEndVerification.winner.test.tsx` (new) or extend existing scoring tests

**Approach:**
- Build `WinCalcState` from values already in scope (4 totals from the match row; per-side targets from the same source `determineMatchResult` uses; `edge` chip absent today). Build config via `buildWinCalcConfig(snapshot.win_condition)`.
- Call `decideWinner`; map `Verdict` → existing `result: 'home_win'|'away_win'|'tie'` + `winnerTeamId`. The judge is authoritative.
- Keep `determineMatchResult` + the points ternary computed in parallel as **legacy**; log any divergence (reuse/mirror `auditMatchScoringConsistency`); if the judge somehow returns malformed output, fall back to legacy (never-break).
- A `{ tie: true }` verdict feeds the **existing** tiebreaker branches unchanged (manual dialog / auto short-race, keyed off `tiebreaker_format`). This plan does not touch tie resolution.
- **Wiring (resolved, not implementer's choice):** call `buildWinCalcConfig(winCondition)` **directly** in `MatchEndVerification` — it reads `snapshot.win_condition` today and does NOT build a `SystemModule`. Do **not** route through `buildSystemFromPreferences` (it needs full prefs, not a snapshot field, and adds coupling for no gain). The resolver's old `winCalculator` field is removed in Unit 7, so don't wire the new module into it.
- **Tiebreaker re-entry interaction:** `MatchEndVerification` re-renders for tiebreaker rounds (`isTiebreakerMode`, via `TiebreakerScoreboard.tsx`, `homeWinThreshold=2`/`tieThreshold=null`). The judge must produce the same winner on that pass; confirm the tiebreaker completion branch (different verification columns: `*_tiebreaker_verified_by`) is untouched by the cutover.

**Execution note:** Land behind the parity gate; verify divergence logging shows zero divergence on the shipped presets before considering it done.

**Patterns to follow:** the points cutover in `src/api/queries/matches.ts` `updateMatchRunningTotals` (engine = source of truth, legacy = fallback + auditor).

**Test scenarios:**
- Happy: a games match and a points match each complete → recorded `winner_team_id`/`match_result` identical to pre-cutover for the same inputs.
- Edge: BCA tie still routes into the existing tiebreaker branch (manual vs auto) exactly as before.
- Integration: two-scorekeeper verify flow still completes once both verify; first-verifier-writes guard intact; no double-write.
- Error path: judge fault → legacy fallback used; match still completes; divergence/fault logged.

**Verification:** Manual end-to-end: complete a games match, a points match, and a BCA tie in dev; recorded winner matches expectation; UI verify flow unaffected. **Machine-verified:** add a test fixture asserting the judge-vs-legacy divergence counter is zero across the shipped presets (don't rely on a human reading logs).

- [ ] **Unit 7: Remove dead scaffolding + update doc anchors**

**Goal:** Remove the wrong-architecture v1 scaffolding (interface surgery, not a directory delete) and the orphaned Fargo winner path; update source-of-truth anchors so docs point at the live module.

**Requirements:** R9

**Dependencies:** Unit 6 live and verified

**Files:**
- Delete: `src/systems/win-calculators/{index,walker,types}.ts` + its `__tests__`
- Modify: `src/systems/types.ts` — drop the **required** `winCalculator` field from the `SystemModule` interface (and the old `WinCalculator`/`MetricStackEntry` types)
- Modify: `src/systems/{bca3v3,bca5v5,fargo5v5}.ts` and `src/systems/buildSystemFromPreferences.ts` — remove the `getWinCalculator(...)` import + the `winCalculator:` assignment on each module (this is the "~5 files" surgery the field touches)
- Modify: `src/utils/fargoMatchTotals.ts` — remove orphaned `calculateFargoMatchTotals` (zero non-test callers); `src/systems/fargo5v5.ts` — remove `computeMatchResult` **only after** grep-confirming `SystemModule.scoring.computeMatchResult` is never invoked (it is still live-assigned)
- Modify (docs): `TABLE_OF_CONTENTS.md`; update the "Source of truth" anchors in `win-calculator.md` to reference `src/systems/win-calculator/`

**Approach:**
- Order matters: drop the `winCalculator` field from the `SystemModule` interface first, let the compiler point at every assignment to remove, then delete the `win-calculators/` dir.
- Grep to confirm zero remaining references (and zero runtime invocation for `scoring.computeMatchResult`) before each delete — avoid orphan breakage and don't delete live-assigned code on assumption.
- Consolidate per the "disposable dev data" + "consolidate within PR" norms — no dual-shape readers, no compatibility shims.

**Test scenarios:** Test expectation: none new — deletion of dead code; the existing suite + Unit 5/6 tests must stay green (regression guard).

**Verification:** `pnpm run build` + `pnpm test:run` green; grep shows no references to the deleted symbols; TOC updated.

## System-Wide Impact

- **Interaction graph:** Only `MatchEndVerification.tsx` (winner write) and `buildSystemFromPreferences.ts` (module wiring) change behavior. Spectate/scoreboard read the recorded `match_result`/`winner_team_id` unchanged.
- **Error propagation:** Judge never throws; on internal fault it logs + bypasses, and the live path falls back to legacy — match completion never blocked.
- **State lifecycle risks:** Two-scorekeeper verify + first-verifier-writes guard must remain intact; the cutover changes *what* winner is computed, not *when/how* it's persisted.
- **API surface parity:** DB shape unchanged (`matches.winner_team_id`, `matches.match_result` stay `'home_win'|'away_win'|'tie'`); the judge's win-only `Verdict` is mapped at the boundary.
- **Integration coverage:** Tie → existing tiebreaker branches must behave exactly as today (manual dialog / auto short-race), proven by the BCA-tie integration scenario.
- **Unchanged invariants:** games-won recording (sacred) untouched; points engine untouched; tie-resolution hooks untouched; `win_condition`/`tiebreaker_format` columns unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Cutover silently changes a winner | Characterization parity gate (Unit 5) + live divergence auditor (Unit 6) before relying on the judge |
| "Dead" code is actually wired-but-inert | `getWinCalculator`/`winCalculator` are assigned across ~5 files and `winCalculator` is a **required** `SystemModule` field — removal is interface surgery, not an `rm`. `fargo5v5.scoring.computeMatchResult` is still live-assigned. Grep-confirm each symbol's runtime invocation before deleting (Unit 7) |
| Per-side targets unavailable at match-end for met-goal | They already feed `determineMatchResult` today; the judge reads the same values |
| Reintroducing cross-module inference (drift) | Judge reads only its config + named bag values; no handicap/threshold/trigger imports — enforced by the isolated test suite |
| v2 ratified before plan-driven trims | RESOLVED — the two trims were applied to the draft and the 3-cold-read gate passed before the swap into `win-calculator.md` (2026-05-23) |
| Prereq ordering (Threshold Charts → Trigger → Win Calc) | Sequenced as named prerequisites; cutover preserves parity with the chip path dormant if built earlier |

## Documentation / Operational Notes

- **v2 ratification — DONE (2026-05-23):** trims #1 and #2 were applied to the draft, it passed the [revision-protocol](../league-system/revision-protocol.md) 3-cold-read gate, and the body was swapped into the locked `win-calculator.md` (draft file removed). The `tiebreak-system/README.md` + `pairings-generator.md` firing-ownership drift (finding #3) was **deferred** to those docs' own v2s — not reconciled at this ratification.
- **No DB migration** in this plan (config is code-defined). If/when a data-driven comparator column is added later: NOT-NULL string sentinels + CHECK, and verify it survives the `resolved_league_preferences` COALESCE cascade.
- **Notes files** (`TABLE_OF_CONTENTS.md`, memory-bank, any LIST_FOR_*) ride with the working commits.

## Sources & References

- **Spec:** [docs/league-system/modules/win-calculator.md](../league-system/modules/win-calculator.md) — the ratified pure-judge canon (was the v2 draft this plan validated); the corrected 2-comparator model is captured above.
- **Revision protocol:** [docs/league-system/revision-protocol.md](../league-system/revision-protocol.md)
- **Locked v1 (do not edit):** [docs/league-system/modules/win-calculator.md](../league-system/modules/win-calculator.md)
- **Trigger primitive (prereq spec):** [docs/league-system/modules/points-system/trigger.md](../league-system/modules/points-system/trigger.md)
- **Threshold Charts (prereq spec):** [docs/league-system/modules/threshold-charts/README.md](../league-system/modules/threshold-charts/README.md)
- **Cross-doc drift to reconcile at ratification:** [docs/league-system/modules/tiebreak-system/README.md](../league-system/modules/tiebreak-system/README.md), `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md` (Units 1 & 9)
- **Live winner code:** `src/components/scoring/MatchEndVerification.tsx`, `src/utils/determineMatchResult.ts`
- **State bag / engine cutover precedent:** `src/systems/points-system/{types,runtime,match-adapter}.ts`, `src/api/queries/matches.ts`
- **Dead scaffolding to remove:** `src/systems/win-calculators/`, `src/systems/fargo5v5.ts` (computeMatchResult), `src/utils/fargoMatchTotals.ts`
