---
title: Points System Decomposition — Requirements
status: ready-for-execution
created: 2026-05-18
resolved: 2026-05-18
unit: Unit 5 (Points System) of `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`
locked_spec: `docs/league-system/modules/points-system/README.md`
---

> **Status (2026-05-18):** All 7 decisions resolved through walkthrough with Ed. See the "Final consolidated model" section near the end for the locked design shape ready for Phase A execution. The decision-by-decision walkthrough is preserved for trace-ability.

# Points System Decomposition — Requirements

## What this brainstorm is for

Unit 5 of the modular-framework migration plan calls for decomposing the 3 existing bundled point calculators into the locked spec's 4 sub-mechanism primitives — **(A) per-game allocator / (B) threshold trigger / (C) initial points / (D) end-of-match aggregate** — so that a Scoring System's Points System is a *composition of primitives*, not a pre-bundled calculator.

The existing `src/systems/calculators/` directory has a working calculator registry that predates this taxonomy. The temptation is to wrap it as the Points System Module ("kinda fits"). That's the wrong move — composition needs rigid typed contracts at every primitive boundary, and every "kinda fits" shortcut leaks rigor in a way that compounds into instability when LOs actually swap sub-mechanisms in the future. (See [`feedback_rigor_over_kinda_fits`](../../../../../.claude/projects/-Users-edpoplet-Programming-rackem-leagues/memory/feedback_rigor_over_kinda_fits.md).)

This doc maps the existing bundled behavior onto the locked primitives explicitly, and surfaces the architectural decisions that need to be pinned down BEFORE any code gets written.

## Existing state — what `src/systems/calculators/` ships today

| Calculator | Kind | Input | What it bundles | Used by |
|---|---|---|---|---|
| `linear_above_threshold` | aggregate | `(gamesWon, thresholds, params: { multiplier })` | (D) — three-band linear with locked tie-band rule | Points 3-Man |
| `accumulate_with_milestone_jumps` | aggregate | `(gamesWon, thresholds, params: { per_game_increment, milestone_percent, milestone_jump_value, win_threshold_jump_value })` | (A) baseline + (B) milestone trigger + (B) win-threshold trigger | Percentage 5-Man |
| `accumulated_per_game` | per_game | `(games, teamId, params: { winner: SideConfig, loser: SideConfig })` | (A) per-game allocator (no triggers, no initial points) | FargoRate 10-Point 5-Man |

Plus a calculator registry + `getCalculator(name)` dispatch, the `PointsCalculator` discriminated-union interface, scoring-popup-field spec, and display-hints meta.

## Target state — what the locked README says the Points System IS

A Points System is a **composition of single-purpose sub-mechanisms**:

- **(A) Per-game allocator** — ONE generic mechanism, configurable per side. Winner gets X, loser gets Y. Each side: integer (fixed) | array `[min, max]` (scorer input) | formula (computed from game data — *not yet in code*).
- **(B) Threshold + Trigger** — DECOMPOSED into two independent primitives per Ed's refinement (2026-05-18; see Decomposition Mapping → Decision 2):
  - **(B-W) Threshold (WHEN)** — a condition check ("has this fired yet?"). Kinds include `side_wins_reached(N)`, `total_games_played(N)`, `match_progress(%)`, `elapsed_time(min)`, future event-based.
  - **(B-T) Trigger / Action (WHAT)** — a transformation on the running totals. Kinds include `jump_to_value(V)`, `add_bonus(B)`, `multiply(M)`, `switch_allocator(ref)`.
  - Triggers in a composition are *pairs* of `{ when: Threshold, then: Action }`. Same threshold primitive can also be referenced standalone for non-trigger uses (e.g., scoreboard markers).
- **(C) Initial points** — handicap-driven, awarded once at match start. Currently exists as the `start_points` Handicap Mechanism; its output feeds the Points System's running totals.
- **(D) End-of-match aggregate** — alternative to per-game accumulation. Computes `team_points = f(games_won, threshold)` once at match end. Carries the locked 3v3 9-9 tie-band rule (per-match points = 0 for both sides regardless of tiebreaker outcome).

The prepackaged compositions per the locked README:

| Scoring System | Composition |
|---|---|
| Points 3-Man | **(D)** `points = games_won − threshold` (with tie-band) |
| Percentage 5-Man | **(A)** `winner = 0.1, loser = 0` + **(B)** milestone trigger 1 + **(B)** milestone trigger 2 |
| FargoRate 10-Point 5-Man | **(C)** handicap-driven start_points + **(A)** `winner = 10, loser = [0, 7]` |

## Decomposition mapping — proposed per-calculator

### 1. `linear_above_threshold` → just **(D)**

A pure end-of-match aggregate. Composition shape: **[D]** (no other primitives).

The locked tie-band rule is the (D) primitive's invariant — when extracted, the (D) primitive carries it. The `multiplier` param stays on (D).

### 2. `accumulate_with_milestone_jumps` → **(A) + (B)*N**

Today it bundles a per-game-increment baseline with two milestone jumps. Decomposed:

- (A) — `winner = per_game_increment, loser = 0`. (Aggregate-input today, so the math is `gamesWon * per_game_increment` rather than per-game iteration, but the same semantics.)
- (B) #1 — at `games_won = round(games_to_win × milestone_percent)`, jump to `milestone_jump_value` (then continue linearly).
- (B) #2 — at `games_won = games_to_win`, jump to `win_threshold_jump_value` (then continue linearly).

Composition shape: **[A, B, B]**. Question: are the two (B)s identical primitive instances with different params, or do they need different shapes?

### 3. `accumulated_per_game` → just **(A)**

Pure per-game allocator with per-side configs. Composition shape: **[A]**.

The FargoRate Scoring System adds (C) start_points on top via the `fargo5v5.ts` runtime path (not via the calculator). So the FULL FargoRate composition is **[C, A]**, even though the calculator is just (A).

## Decisions that need pinning down (this is the "front work")

Each decision below is one I can't make without your input — picking wrong here means re-doing Phase A.

### D1. Primitive interface shape — common base or 4 distinct interfaces? — ✅ RESOLVED (2026-05-18)

**Resolution:** Internal-only decision; Claude's call. Going with D1c (shared base + per-kind variants), matches the pattern from `HandicapMechanism` and `ThresholdChart`.



The 4 primitives have meaningfully different I/O:

- (A) takes per-game records (or aggregate games-won), produces per-game point contributions
- (B) takes (games_won, threshold), conditionally fires a transformation on running total
- (C) takes (handicapDiff or roster) at match-start, produces a one-shot initial number
- (D) takes (gamesWon, threshold), produces a final aggregate

Options:
- **D1a.** Single `PointsSubMechanism` discriminated union with `kind: 'allocator' | 'trigger' | 'initial' | 'aggregate'` (similar to current PointsCalculator's `kind: 'aggregate' | 'per_game'`).
- **D1b.** 4 distinct typed interfaces (`Allocator`, `Trigger`, `Initial`, `Aggregate`) with no shared base — composition references them by their interface.
- **D1c.** Hybrid: base interface for things they share (`name`, `paramSchema`), variant-specific compute signatures.

My lean: **D1c** — matches how Handicap Mechanisms / Threshold Charts work (discriminated union by `kind`, variant-specific compute). Easy to extend. **Need your confirm or pick.**

### D2. Composition shape — Stack[primitive] or structured? — RESOLVED (2026-05-18) — D2b with threshold/trigger decomposition

**Resolution: D2b — structured slots.** Plus Ed's additional refinement: the `triggers` slot contains pairs `{ when: Threshold, then: Action }`, not bundled "threshold-trigger" units.

**Slot structure:**

```
PointsSystem = {
  initialPoints?: (C) InitialPoints
  perGameAllocator?: (A) PerGameAllocator
  triggers?: Array<{ when: Threshold, then: Action }>
  endOfMatchAggregate?: (D) EndOfMatchAggregate
}
```

**Prepackaged compositions:**

```
Points 3-Man          = { endOfMatchAggregate: D }
Percentage 5-Man      = {
                          perGameAllocator: A (winner: 0.1, loser: 0),
                          triggers: [
                            { when: side_wins_reached(milestoneTarget), then: jump_to_value(1.5) },
                            { when: side_wins_reached(games_to_win),    then: jump_to_value(3.0) },
                          ],
                        }
FargoRate 10-Point    = {
                          initialPoints: C (handicap-driven start_points),
                          perGameAllocator: A (winner: 10, loser: counter 0-7),
                        }
```

**Why structured slots beat open list:**

1. The locked spec assigns each primitive a distinct ROLE in per-match flow (initial → per-game → triggers fire as conditions hit → final aggregate read at end). Named slots reflect that.
2. Invalid compositions become structurally impossible (two end-of-match aggregates, two initial-points awards — both nonsense per spec).
3. Future LO wizard UI maps 1:1 to slot sections ("Start Points: ...", "Per-Game Scoring: ...", "Triggers: ...", "End-of-Match Scoring: ...").

**Why decompose threshold from trigger:**

Today's bundled milestone calculator only supports `side_wins_reached(N)` thresholds paired with `jump_to_value(V)` actions, so bundling looks natural. But the moment a Scoring System wants `total_games_played(6) → multiply(2)`, or `match_progress(50%) → switch_allocator(ref)`, the threshold half and the action half are obviously independent: different threshold kinds, different action kinds, mix-and-match. Bundling them today blocks every one of those future configurations.

Same threshold primitive can also be referenced standalone (e.g., scoreboard milestone markers) without needing a paired action.



Two valid shapes for "a Points System is X primitives":

- **D2a.** Ordered stack: `PointsSystem = SubMechanism[]`. Runtime walks the stack in order, applying each primitive's contribution. Flexible (any number of any kind in any order) but requires clarity on "what does it mean to put (D) after (A)?"
- **D2b.** Structured slot record: `PointsSystem = { initial?: Initial; allocator?: Allocator; triggers?: Trigger[]; aggregate?: Aggregate }`. Each slot has a clear role; "stacking" only applies to the `triggers` array. Less flexible, more semantically clear.

My lean: **D2b**. The 4 primitive types each have a CLEAR ROLE in the per-match flow (initial → per-game allocator → triggers fire as thresholds met → final aggregate read at end). Putting them in a flat stack hides that structure. **Need your input.**

### D3. (C) Initial Points — identity question — RESOLVED (2026-05-18) — collapse into (B)

**Resolution: (C) is not its own primitive type — it's a SPECIAL CASE of (B) threshold/trigger machinery.**

Ed's insight (2026-05-18): if you think about it, (C) Initial Points is just a threshold lookup ("at match start") paired with a trigger action ("give handicap-driven points to the weaker side, 0 to the other"). Structurally identical to (B), with a special threshold kind (`match_start`) and a special action kind (`award_handicap_initial`).

**Three real primitive kinds, not four:**

- **(A) Per-game allocator** — unchanged
- **(B) Threshold + Trigger pairs** — now covers initial points as `{ when: match_start(), then: award_handicap_initial(...) }`
- **(D) End-of-match aggregate** — unchanged

**FargoRate 10-Point 5-Man composition becomes:**

```
{
  perGameAllocator: A (winner: 10, loser: counter 0-7),
  triggers: [
    {
      when: match_start(),
      then: award_handicap_initial(to: weaker_side, source: handicapMechanism)
    }
  ]
}
```

**Dual-identity resolution:** the `start_points` Handicap Mechanism stays exactly where it is (declares the kind-of-asymmetry — that's a Mechanism's job per its locked README). The Points System trigger action DELEGATES to the Mechanism at runtime to get the actual value to award. Same delegation pattern Mechanisms use for Charts. Each Module owns its concern; one consults the other.

**Action vocabulary extensions this requires:**

- Actions take a `side` parameter (`'home' | 'away' | 'weaker' | 'stronger' | 'both'`) — generalizes beyond initial points; useful for any side-asymmetric action
- Actions can CONSULT other Modules at runtime (e.g., the Handicap Mechanism for the value). The runtime context the action receives includes the active SystemModule reference.

**One ordering note:** `match_start()` thresholds fire BEFORE per-game allocator processing starts (game 1). Other thresholds fire as conditions are met during games. Explicit in the runtime contract.

**Why this is the rigor answer:** keeping (C) as a separate primitive type when it's structurally identical to (B) is the "kinda fits" leak — extra surface, no extra power, forces future authors to ask "is initial-points its own thing or a trigger?". Collapsing them keeps the taxonomy lean and the composition machinery uniform. (Note: the locked README's (A/B/C/D) framing remains valid CONCEPTUALLY as a description of what kinds of behavior exist; in CODE we implement them with 3 primitives where (B) absorbs (C).)

**Composition slot naming:** unresolved internal detail (Claude's call). Two options:
- Option (i): Keep a distinct `initialPoints` slot in the composition record that's syntactic sugar for "a trigger with `when: match_start()`" — gives the wizard UI a clean role label.
- Option (ii): All triggers live in one `triggers` list, ordered by their threshold kind — uniform but less explicit.

Either works; will pick during Phase A implementation based on what reads better in the SystemModule construction sites.



Today `start_points` is a Handicap Mechanism (which is correct — it's an in-match-setup asymmetry). But the locked Points System README says (C) is a Points System sub-mechanism whose output feeds the Points System's running totals. So `start_points` has a **dual identity**: it's both a Mechanism AND a Points System primitive.

Options:
- **D3a.** Keep `start_points` solely as a Handicap Mechanism; the Points System's (C) slot references it (rather than re-implementing). At runtime, the (C) slot's output IS `handicapMechanism.compute(...)`'s `startPointsForWeakerTeam`.
- **D3b.** Move `start_points` ENTIRELY to the Points System (delete from Handicap Mechanisms). Loses the "Mechanism declares asymmetry kind" framing.
- **D3c.** Implement (C) Initial Points as its own primitive in the Points System, with the Handicap Mechanism continuing to also exist — the primitive's `compute` delegates to the Mechanism. (Same delegation pattern Mechanism uses for Charts.)

My lean: **D3c**. Matches the precedent set by Mechanism→Chart delegation. The dual identity is real; the primitive lives on both sides and one delegates to the other. **Need your call.**

### D4. (A) `formula` shape — include now or defer? — ✅ RESOLVED (2026-05-18) — D4a

**Resolution:** Include the `formula` shape now. The 17-Point Scoring System is a known, fully-specified entity (similar to 10-Point, per-game total always 17), not speculative.

**17-Point spec (Ed-provided + Ed-corrected, 2026-05-18):**

The constant `10` does NOT live inlined inside the formula. It lives as a separate `base` field on the side config; the formula REFERENCES it via a context variable. This keeps the base value editable as data while the formula expresses only the rule shape.

```
winner_side: {
  kind: 'formula',
  base: 10,                                          // the configurable constant
  formula: (ctx) => ctx.winner + (7 − ctx.loser),    // the rule shape
}
loser_side: {
  kind: 'counter',
  min: 0,
  max: 7,
  label: "Balls pocketed by loser",
}
```

At evaluation time the context bag exposes each side's resolved input/base:
- `ctx.winner` = the winner side's base/input value (= 10 for this config)
- `ctx.loser` = the loser side's counter input (= balls pocketed, 0–7)

Per-game evaluation: winner contribution = `ctx.winner + (7 − ctx.loser)` = `10 + (7 − loser_balls)`. Loser contribution = `ctx.loser` = loser_balls. Per-game total = `10 + 7 = 17` regardless of how many balls the loser pocketed.

**Why this decomposition matters compositionally:** an LO who wants "modified 17-Point with base 12 instead of 10" changes one number (`base: 12`) and the formula stays untouched. Inlining the `10` into the formula collapses the rule-shape and the constant into one blob, breaking that future customization. The formula expresses the RULE; the base expresses the CONSTANT; the context variables wire them together.

CSI 10-Point comparison: 10-Point has winner side `{ kind: 'fixed', points: 10 }`. 17-Point has winner side `{ kind: 'formula', base: 10, formula: (ctx) => ctx.winner + (7 − ctx.loser) }`. The loser side is identical in both (counter 0–7).

The (A) per-side config type union becomes: `fixed | counter | formula`.

**Formula shape (Ed-clarified, 2026-05-18):** the formula is NOT a fixed signature. It's a function that receives a CONTEXT BAG of whatever variables are available at evaluation time, and returns the points contribution for that side. Each formula declares what it needs from the context.

The context bag spans TWO distinct axes of variables:

**Axis 1 — Per-game role context** (values that change each game based on who won):
- `ctx.winner` — the winner side's base/input value (e.g., 17-Point winner side's `base: 10`)
- `ctx.loser` — the loser side's base/input value (e.g., 17-Point loser side's counter input, the balls-pocketed number)

**Axis 2 — Cumulative match-state context** (values reflecting the match-so-far, available when the runtime walks games in order):
- `ctx.home.wins` / `ctx.away.wins` — running game-win counts
- `ctx.home.points` / `ctx.away.points` — running point totals
- `ctx.thisSide` — identifies which team this formula is being evaluated for (`'home' | 'away'`)
- *(Future additions go here as new metrics get tracked.)*

**Ed-provided cumulative-state example (2026-05-18):** a "diminishing returns" handicap built into the per-game allocator:

```
winner_side: {
  kind: 'formula',
  base: 10,
  formula: (ctx) =>
    ctx.thisSide === 'home'
      ? 10 - (ctx.home.wins - ctx.away.wins)
      : 10 - (ctx.away.wins - ctx.home.wins),
}
```

Behavior: a team's per-game points decrease as they pull further ahead in wins; equivalently, the lagging team's per-game payout stays at 10 or increases. Built-in soft handicapping at the per-game-allocator level, separate from match-setup handicap (Handicap Mechanisms).

**Three implementation considerations** flagged by Ed-introduced cumulative-state usage (Phase A scope; not blockers):

1. **Game-order evaluation** — formulas referencing `ctx.home.wins` etc. must evaluate games in order; the state at game N is the state from games 1..N−1 (not including N itself). Today's per-game accumulation pipeline already does this; the formula primitive's contract must be explicit that `ctx.<side>.wins` is the state BEFORE this game.
2. **Vacate-and-rescore** — state-dependent formulas break the "pure function of inputs" property today's calculators have. The re-score pipeline must replay games in order rather than recomputing from final state. Manageable but architecturally distinct.
3. **Tiebreaker games + ctx state** — per the locked tie-band rule, tiebreaker games don't add per-match points. Do they count toward `ctx.home.wins` in cumulative-state ctx? Pinpoint when implementing; lean toward "no" (tiebreaker is a separate phase).

Both Ed-provided 17-Point forms work under this shape, BUT with the base separated from the formula (per Ed's correction):

- Form 1: `base: 10, formula: (ctx) => ctx.winner + (7 − ctx.loser)` — the base is parameterized; the rule is generic
- Form 2: `base: 0, formula: (ctx) => 17 − ctx.loser` — works numerically but inlines the `17` constant into the formula, losing the base-as-data benefit

Form 1 is the preferred form because it preserves the "base value is editable data; formula is the rule" separation.

**Out of scope today:** LO-edited formulas (formula-as-string editable in a wizard). The function-shape we pick now doesn't preclude later evolution to `formula: string | function` — that's a separate Unit when wizard formula authoring lands.



### D5. (D) tie-band rule — invariant of (D), or separate concern? — RESOLVED (2026-05-18) — D5a (tie-band stays inside (D)'s formula)

**Resolution:** The tie-band rule stays a built-in invariant of (D)'s formula. NOT a composable trigger.

**Why this is right (after the walkthrough):** the cleaner trigger model that emerged in D2/D3 made me reach for "tie-band = a composable trigger" (`when: both_sides_reach(tie_value), then: force_per_match_points(0, both)`). Ed pushed back: ties don't need their own trigger. The threshold chart produces win/tie/lose values; only the WIN value drives a trigger (the win-chip signal). A tie is the IMPLICIT ABSENCE of a win chip when all games are played — Win Calc waits for a chip; if it doesn't arrive by match end, that's a tie. Same logic as "two thresholds simultaneously meeting" but doesn't require inter-dependent triggers.

The tie-band absorption (per-match points = 0 for both at the tie threshold) lives inside (D)'s formula as a property of how (D) computes end-of-match points — not as a trigger event.

**Refined: (D) reads variables, not charts directly.** The chart values (win/tie/lose targets per side) get assigned to named variables via receipt-triggered triggers at match start (same mechanism as initial points). (D) consumes those variables (homeWinTarget, homeTieTarget, homeLoseTarget, awayWinTarget, awayTieTarget, awayLoseTarget) when applying its formula. This keeps (D)'s input contract uniform with everything else and ensures no separate "chart-reading" code path could drift from the trigger-assigned values.



The locked tie-band rule ("both teams get 0 per-match points when games_won = tie threshold") currently lives inside `linear_above_threshold`. When extracted as a (D) primitive, the question is whether the rule is:

- **D5a.** A built-in invariant of every (D) primitive — any aggregate calculator MUST apply the tie-band absorption rule. Locked. Non-configurable.
- **D5b.** A separate composable rule that sits alongside (D) (e.g., a `TieBandAbsorber` primitive that runs before/after (D)'s compute).
- **D5c.** A parameter on (D) — `applyTieBandAbsorption: boolean`. Default true; LOs can disable.

My lean: **D5a**. The locked spec calls the rule a "locked invariant"; it's not LO-configurable. Building it into (D) is honest. **But this affects future LO composition** — if someone wanted aggregate WITHOUT tie-band, they couldn't. **Need your call.**

### D6. Param flow through composition

Each primitive has its own params (`MilestoneJumpsParams` becomes maybe `TriggerParams` for each of the two triggers in the decomposed Percentage 5-Man). The composition needs a way to store and route these:

- **D6a.** Each composition slot stores its primitive's params inline. `PointsSystem.triggers = [{ kind: 'trigger', name: 'milestone_1', params: {...} }, ...]`.
- **D6b.** Params live in a separate `params` blob on the composition keyed by slot.

My lean: **D6a**. Co-locates params with the primitive that uses them. **Need your input.**

### D7. Cross-audit shape

Same pattern as Threshold Charts Phase A.5:

- For every (gamesWon, thresholds) input the existing calculator was tested with:
- composed_points_system.evaluate(input, params) should equal calculator.compute(input, params)
- Drift → red test, surfaced with the specific input that diverged.

This is non-negotiable; it's the safety net. Just confirming the shape.

## Resolve before planning (blocking)

The 7 decisions above (D1–D7). Once those are pinned, Phase A is mechanical: build the 4 primitive types per the chosen interface shape, write a composition declaration for each prepackaged system, write cross-audit tests, commit.

## Final consolidated model

All 7 decisions resolved (2026-05-18). The Points System Module has the following shape:

### Core primitives

1. **Threshold** — a pure function `(inputs) → number`. No firing logic. No side attribution. Just: feed inputs (rosters, handicaps, chart references, other constants), get back a single number. Same architectural shape as the existing Threshold Charts Module (the Module we already built reuses naturally here).

2. **Per-game allocator (A)** — per-side configs that allocate points each game. Each side: `fixed` (integer), `counter` (scorer input with min/max), or `formula` (function over a context bag). The context bag spans two axes: per-game role data (`ctx.winner`/`ctx.loser` base+input values) AND cumulative match-state data (`ctx.home.wins`, `ctx.away.wins`, `ctx.home.points`, `ctx.away.points`, etc.). New context variables can be added later without breaking existing formulas.

3. **Trigger** — `{ when, action }`. Single action per trigger (multiple triggers can share the same `when`). Both halves can reference thresholds and named variables.

4. **When-condition** — a firing-semantics primitive. Kinds: `receipt` (fires immediately at match start when its referenced threshold is computed), `side_reaches(threshold, side)` (fires when a tracked variable for that side hits the threshold), `all_sides_reach(threshold)` (fires when all sides simultaneously hit it), `total_games_played(threshold)`, future event-based kinds.

5. **Action** — a uniform `{ target, op, value }` shape. NO action categories.
   - `target` = a named variable in the system's mutable-state namespace (`home_points`, `away_points`, `homeWinTarget`, `winChip`, `endgame_chip`, anything that can be assigned)
   - `op` = `assign | add | multiply` (= | += | *=)
   - `value` = constant, threshold reference, or expression involving variables

6. **End-of-match aggregate (D)** — computes per-match points at match end. Reads named variables (homeWins/homeTieTarget/etc.) populated by triggers; applies its formula including the locked tie-band absorption invariant (when games_won equals tie threshold, per-match points = 0 for both sides). Stays as a distinct primitive type because it has a clear single-fire-at-end role.

### Single-mechanism-for-everything principle (Ed-emphasized 2026-05-18)

Every value the system tracks gets assigned via the SAME trigger machinery — including values that are "only for display." Chart-computed win/tie/lose targets, initial points, milestone jumps, win signals: all flow through `triggers → action → named variable`. Different consumers (display, (D) aggregate, Win Calc) read from the same variables. Structurally impossible for display to drift from operational values because there's literally one place each value is assigned.

### How ties work (clean)

- Threshold chart computes (win, tie, lose) per side
- Receipt triggers assign all six values (per-side win/tie/lose) to named variables
- Only the WIN target drives a play-time trigger: `{ when: side_reaches(winTarget, side), action: { target: winChip, op: assign, value: side } }`
- If all games are played and winChip is still unassigned → Win Calc interprets that as a tie (absence of chip = tie)
- (D) aggregate uses homeTieTarget/awayTieTarget internally for its tie-band absorption math
- No tie chip; no tie-band trigger; no inter-dependent simultaneity check

### How (C) Initial Points is implemented

Not a separate primitive type. A receipt-triggered trigger:

```
threshold: (lineupA, lineupB) → number  // Fargo start-points formula, returns 0 if not the weaker side
trigger:   { when: receipt, action: { target: <side>_points, op: add, value: <threshold> } }
```

The Handicap Mechanism start_points stays where it is (declares the kind-of-asymmetry); the trigger DELEGATES to the Mechanism for the value. Same delegation pattern Mechanism uses for Chart.

### Composition shape (D2b structured slots, finalized)

```
PointsSystem = {
  thresholds:           Record<name, Threshold>,        // shared, named, all computed at receipt
  perGameAllocator?:    Allocator,                      // optional; the linear baseline
  triggers:             Array<Trigger>,                 // ordered list; each {when, action}
  endOfMatchAggregate?: Aggregate,                      // optional; reads variables, applies formula
}
```

### Cross-audit (D7)

For every (inputs, params, scenario) the existing bundled calculator was tested with, the composed Points System's output must equal calculator.compute(...) row-for-row. Same shape as Threshold Charts Phase A.5 cross-audit.

## Out of scope for this brainstorm

- LO-customization UI for composition (future Unit; brainstorm separately)
- 17-Point formula shape implementation (D4b path)
- New calculators for new Scoring Systems (the decomposition unblocks this, but adding any specific new one is separate)
- Persisted `points_system` DB column cleanup (own branch per locked README)
- Tiebreak System interaction (separate Module extraction)

## Next step

Walk D1–D7. Mark each ✅ (proceed with my lean) or change my lean. Once all 7 are pinned, I'll execute Phase A.
