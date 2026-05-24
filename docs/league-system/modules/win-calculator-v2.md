---
title: Win Calculator (Module) — v2 DRAFT
date: 2026-05-23
status: draft
supersedes: win-calculator.md (pending ratification)
audience: developer + AI sessions
---

> ## ✍️ DRAFT — NOT YET CANON
>
> Proposed v2 replacement for the locked [`win-calculator.md`](win-calculator.md), from the 2026-05-23 Win Calculator / endgame brainstorm. **Built as a surgical diff of v1**: every section not touched by a listed delta is preserved verbatim; only the [6 deltas](#changes-vs-the-locked-v1-draft-only--remove-at-ratification) are changed, for stated reasons. Unlocked by design; carries no locked banner; not authoritative. Ratify by swapping this body into the locked file via the [Principle 7](../PRINCIPLES.md#7-canonical-docs-as-policy) unlock→swap→relock cycle, only after it passes the cold-read gate.

# Win Calculator

## Essence

The **Win Calculator** examines the collected match state — the two metrics every match tracks (Games and Points) plus any per-side targets present in that state — and **declares the match winner**. It is a **pure judge**: given the match state it returns one verdict — a winning side, or a tie — and does nothing else (it allocates no points, ends no match, records nothing). It reaches the verdict in a fixed order: if a **winner chip** has already been set during play, that side won; otherwise it consults its two configurable **comparators** (one games, one points) in the LO's order and takes the first that yields a winner; if none does, the verdict is a **tie** — a conclusion, never a stored value. The Win Calculator does not produce metrics and does not allocate points. It *decides*.

## Why the Win Calculator exists

Every match accumulates two streams of data: **games** (winner/loser recorded per game) and **points** (allocated by the Points System). Something has to look at that data and answer the only question that ultimately matters: *who won the match?* That is the Win Calculator's single job.

Separating this out is load-bearing anti-conflation. It is tempting to assume "the scoring system" both allocates points AND decides victory — but those are two different responsibilities. The [Points System](points-system/README.md) allocates points; the Win Calculator decides the winner. A Points System rule (like CSI's "1-Point Scoring System") never, by itself, declares a winner — it just produces the point data the Win Calculator then consults.

## Boundary

The Win Calculator is **only** the victory-determination step. It is **not**:

- The per-game point allocation — that's the **[Points System](points-system/README.md)**.
- The encoding of player strength — that's a **[Handicap System](handicap-systems/README.md)**.
- The kind-of-asymmetry the handicap declares — that's a **[Handicap Mechanism](handicap-mechanisms/README.md)**.
- The chart/formula that turns a handicap difference into a threshold — that's a **[Threshold Chart](threshold-charts/README.md)**.
- The structural game-slot list that scaffolds a match — that's the **[Pairings Generator](pairings-generator.md)** (its output is filled by the scoring runtime and the aggregated game data is what the Win Calculator eventually reads).
- The atomic methods that produce a winner when a tie needs resolving — that's the **[Tiebreak System](tiebreak-system/README.md)**. The Win Calculator *concludes* a tie when its comparators yield no winner; the **scoring runtime** then runs the Tiebreak System, which produces a winner that re-enters as the winner chip. The Tiebreak System owns *how* that winner is produced (coin flip, short race, roshambo, etc.).
- Ending the match early (race-mode termination) — that's the separate **`endMatch`** flow-control token, set by a trigger and consumed by the scoring runtime, not the Win Calculator.
- The post-verdict sequence — match-end point awards, two-scorekeeper confirmation, undo, and final recording — sequenced by the scoring runtime (the "director") and living **outside the modular Scoring System catalog**. The Win Calculator returns the verdict; it orchestrates none of this.
- The season-standings table — that's a separate Standings concern that lives **outside the modular Scoring System catalog entirely**. Its architectural shape (Module? System? subsystems for personal stats / achievements?) is a separate future brainstorm. The Win Calculator declares the per-match winner; the Standings concern consumes per-match results across the season to rank teams.

If a proposed feature changes *which collected metric (or combination) declares the winner, or how a tie resolves* — it belongs here. If it changes *how points get allocated per game* — that's the Points System. If it changes *when the match stops* — that's the `endMatch` token and the scoring runtime.

## The comparator switch

The Win Calculator holds **two comparators — one for games, one for points**. Each carries **one mode** (how that metric is judged), and an **order filter** says which to use and in what order — either may be off. When no winner chip is present, at match end:

1. Walk the enabled comparators in the LO's order.
2. For each, inspect the match data; the comparator returns a winner, or "no decision."
3. The **first comparator that returns a winner** decides.
4. If a comparator cannot decide, continue to the next.
5. If the enabled comparators are exhausted with no winner, the verdict is a **tie** (see [Ties and the Tiebreak System](#ties-and-the-tiebreak-system)).

A comparator's mode is one of two — a 2×2 of *what* is compared and *how* (two metrics, two modes each):

| | **compare-totals** (symmetric) | **compare-to-target** (asymmetric) |
|---|---|---|
| **games** | most games | games vs per-side games-target |
| **points** | most points | points vs per-side points-target |

- **compare-totals** — the side with the higher total wins; "no decision" on equal totals.
- **compare-to-target** — each side is measured against its own win-target. **Exactly one** side reaching its target wins; neither reaching → "no decision." Both reaching is impossible with correct targets; should it occur, the Win Calculator names no winner (it cannot single one out) and **flags the anomaly** rather than breaking or picking arbitrarily — diagnosing or routing that flaw is not this module's job.

A configuration may enable just one comparator or both, in the LO's chosen order. For example: points compare-totals, then games compare-totals, with a concluded tie handed off (Fargo 10-7); or games compare-to-target alone (BCA 3v3).

The two comparators, their modes, and the order are what make the Win Calculator *configurable*. Each Scoring System composition picks them, and they are stored as data so the build/tinker workspace can expose them.

## The winner chip and `result`

The Win Calculator's output is **`result`**, holding a **winner only** (`home` or `away`) — never "tie" (a tie is the absence of a winner; see [Ties](#ties-and-the-tiebreak-system)). The **winner chip** is any affirmative write of a winner into `result`. It can come from three interchangeable producers, all meaning the same thing to the judge:

- a **win-threshold trigger** during play (a side met its win-target — a clinch), firing mid-match or on the final game;
- a **comparator**, at match end;
- the **[Tiebreak System](tiebreak-system/README.md)**, after a tie has been concluded.

The chip is **checked first — an override**: if `result` is already set, the comparators do not run. This is mandatory because compare-to-target targets are asymmetric per side, so comparing raw counts across sides is meaningless — a clinch must bind unconditionally. **Recalc** is simply re-running the judge after a producer has written `result`; the Tiebreak path is guaranteed to terminate it (the Tiebreak System always produces a winner — its chain auto-appends a terminal human-handoff).

## Ties and the Tiebreak System

A tie is a **conclusion, not a signal**. A win is an event a side achieves and gets *written*; a tie is what remains when nothing decisive happened, and is only ever *concluded* at match end. Concluding it only at the end is what prevents a premature tie — with games still to play, a side that has not yet won might still win.

- In a **compare-to-target** rule, a tie is recognized only at match end, when no winner chip fired and neither side reached its win-target.
- In a **compare-totals** rule, a tie is simply equal totals at the end.

When the comparators yield no winner, the **scoring runtime** runs the LO's configured Tiebreak System. It produces a winner, which is written as the `result` chip; the Win Calculator then recalcs and declares that side the winner.

**Win Calculator is "dumb" about how the tiebreak winner was produced.** It just sees a winner in `result` and uses it; it doesn't know or care whether that came from a coin flip or a single-rack tiebreaker game. This keeps Win Calculator the sole authority on "who won the match" while the Tiebreak System owns the *how*.

**A concluded tie is handed off, not handled here.** The Win Calculator reports one of two findings — a winner, or no winner. What becomes of a no-winner result — broken or allowed to stand — belongs to a separate module, executed by the runtime (a mini-match tiebreaker is literally a second match, and matches are runtime-run).

## Current implementation status

Today's code is the primitive stand-in: a single binary field, `win_condition`, with values `'games'` or `'points'`. This is equivalent to a one-entry comparator set with no winner chip and no Tiebreak System; ties at the chosen metric are handled by scattered runtime hooks rather than the structured comparator-set-plus-chip model described above. The full model — the comparator switch, the winner chip, and the Tiebreak System integration — is the architectural direction developed in the 2026-05-23 Win Calculator / endgame brainstorm and not yet in code. Notably, **compare-to-target / the clinch chip requires a Threshold Trigger**, which requires the **[Threshold Charts](threshold-charts/README.md)** Module and the **[Trigger](points-system/trigger.md)** primitive to exist in code first; the build order is therefore Threshold Charts → Trigger → this Module. Implementation will require new preference column(s) describing the LO-configured comparator set and the integrated Tiebreak System chain evaluator.

## Remaining open design space

Beyond the comparator switch and Tiebreak System integration documented above, the Win Calculator's fuller design space still contains genuinely-future items:

1. **Race-mode termination** — the `endMatch` token models early termination, but its "end now" trigger semantics are unbuilt; today every match plays its full game count.
2. **Cross-axis conditions** — rules that consult both metric axes at once. Example from the Points 3-Man Scoring System: *"positive points are only awarded if the game threshold is reached; it is possible to win the match with zero points."* Currently this kind of cross-axis condition lives inside the Points System calculator (`linear_above_threshold`), not in Win Calculator. A future refactor could lift it.
3. **Per-game evaluation cadence** — race-mode requires checking after every game; threshold-mode can evaluate once at match-end. Today only threshold-mode is wired; race-mode evaluation cadence is unbuilt.
4. **Comparator persistence shape** — how the two comparators, their modes, and the order are stored as data (preference column shape) is an implementation-time choice.

## How this Module interacts

- **Upstream**: consumes the two **metrics** (Games and Points data) plus the **thresholds** declared by [Handicap Mechanisms](handicap-mechanisms/README.md) and the point totals produced by the [Points System](points-system/README.md). The per-game data feeding those metrics arrives via the scoring runtime, which fills in the game slots produced by the [Pairings Generator](pairings-generator.md) — the Win Calculator does not read Pairings Generator's output directly, but its inputs originate downstream of that Module's slot list.
- **Output**: the match result — the declared winner, or a tie when no winner is produced.
- **Tiebreak**: when the comparators yield no winner, the scoring runtime fires the [Tiebreak System](tiebreak-system/README.md); the winner it produces re-enters as the `result` chip and the Win Calculator recalcs. Sequential, not circular: comparators conclude tie → runtime runs Tiebreak System → winner written → Win Calc recalcs.
- **Downstream**: the per-match result feeds the Standings concern (outside the modular Scoring System catalog — its architectural shape is a separate future brainstorm) for season-level ranking. The Win Calculator answers *"who won this match"*; the future Standings concern answers *"given the season's match results, who finishes where."*

## Changes vs the locked v1 (draft-only — remove at ratification)

The complete diff against [`win-calculator.md`](win-calculator.md). Everything not listed here is preserved verbatim.

1. **One judge, not a two-mode split.** The 2026-05-18 chip-mode/cascade-mode framing is gone; the judge is chip-checked-first + an LO-ordered comparator switch. ("chip-mode" = a compare-to-target comparator configured; "cascade-mode" = compare-totals comparators.)
2. **`result` is win-only; a tie is a concluded residue.** v1's "metric precedence stack with `edge` as the lowest entry" is replaced by the winner chip (override) + recalc; there is no `edge`-as-bottom-metric.
3. **Two comparators (games, points), each with a compare-totals/compare-to-target mode, plus an order filter** — in place of the abstract "metric precedence stack." Not an open-ended set: exactly one comparator per metric, either may be off.
4. **`endMatch` is its own flow-control token**, separate from the winner declaration (v1 did not model termination as a token; the 2026-05-18 draft lumped "end game now" onto the chip).
5. **Orchestration removed from Win Calculator.** v1 had it "own the decision to fire" the tiebreak; here the Win Calculator is a pure judge that *concludes* a tie, and the **scoring runtime/director** fires the tiebreak and sequences point awards, confirmation, undo, and recording.
6. **No tie-handling config in the Win Calculator** — it reports only winner / no-winner; whether a concluded tie is broken or allowed to stand lives in a separate module and the runtime (v1 folded this into the stack as "omit `edge`").

## Source of truth

**Current code (the primitive stand-in):**
- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — the `win_condition` column type (`'games' | 'points'`)
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK for `win_condition`
- `src/systems/buildSystemFromPreferences.ts` — the dispatch that routes match-result determination based on `win_condition`
- `src/systems/win-calculators/` — cascade-mode-only scaffolding from the halted Unit 1 extraction
- `src/wizards/league-v2/steps/WinConditionStep.tsx` — wizard UI for selecting the win condition

**The comparator-switch + winner-chip model documented above is not yet in code.** Prior direction (superseded by this v2): `docs/brainstorms/2026-05-18-win-calculator-trigger-and-cascade-direction-requirements.md`, developed forward in the 2026-05-23 Win Calculator / endgame brainstorm.
