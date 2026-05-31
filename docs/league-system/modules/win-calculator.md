---
title: Win Calculator (Module)
date: 2026-05-23
status: active
locked: true
audience: developer + AI sessions
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

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

## The winner chip and `edge`

The Win Calculator's output is **`edge`**, holding a **winner only** (`home` or `away`) — never "tie" (a tie is the absence of a winner; see [Ties](#ties-and-the-tiebreak-system)). The **winner chip** is any affirmative write of a winner into `edge`. It can come from three interchangeable producers, all meaning the same thing to the judge:

- a **win-threshold trigger** during play (a side met its win-target — a clinch), firing mid-match or on the final game;
- a **comparator**, at match end;
- the **[Tiebreak System](tiebreak-system/README.md)**, after a tie has been concluded.

The chip is **checked first — an override**: if `edge` is already set, the comparators do not run. This is mandatory because compare-to-target targets are asymmetric per side, so comparing raw counts across sides is meaningless — a clinch must bind unconditionally. **Recalc** is simply re-running the judge after a producer has written `edge`; the Tiebreak path is guaranteed to terminate it (the Tiebreak System always produces a winner — its chain auto-appends a terminal human-handoff).

## Ties and the Tiebreak System

A tie is a **conclusion, not a signal**. A win is an event a side achieves and gets *written*; a tie is what remains when nothing decisive happened, and is only ever *concluded* at match end. Concluding it only at the end is what prevents a premature tie — with games still to play, a side that has not yet won might still win.

- In a **compare-to-target** rule, a tie is recognized only at match end, when no winner chip fired and neither side reached its win-target.
- In a **compare-totals** rule, a tie is simply equal totals at the end.

When the comparators yield no winner, the **scoring runtime** runs the LO's configured Tiebreak System. It produces a winner, which is written as the `edge` chip; the Win Calculator then recalcs and declares that side the winner.

**Win Calculator is "dumb" about how the tiebreak winner was produced.** It just sees a winner in `edge` and uses it; it doesn't know or care whether that came from a coin flip or a single-rack tiebreaker game. This keeps Win Calculator the sole authority on "who won the match" while the Tiebreak System owns the *how*.

**A concluded tie is handed off, not handled here.** The Win Calculator reports one of two findings — a winner, or no winner. What becomes of a no-winner result — broken or allowed to stand — belongs to a separate module, executed by the runtime (a mini-match tiebreaker is literally a second match, and matches are runtime-run).

## Remaining open design space

Beyond the comparator switch and Tiebreak System integration documented above, the Win Calculator's fuller design space still contains genuinely-future items:

1. **Race-mode termination** — the `endMatch` token models early termination; its "end now" trigger semantics are open design space.
2. **Cross-axis conditions** — rules that consult both metric axes at once. Example from the Points 3-Man Scoring System: *"positive points are only awarded if the game threshold is reached; it is possible to win the match with zero points."* Whether such a cross-axis condition lives in the Win Calculator or the Points System is open design space.
3. **Per-game evaluation cadence** — race-mode requires checking after every game; threshold-mode can evaluate once at match-end — the cadence model is open design space.
4. **Comparator persistence shape** — how the two comparators, their modes, and the order are stored as data is an open design question.

## How this Module interacts

- **Upstream**: consumes the two **metrics** (Games and Points data) plus the **thresholds** declared by [Handicap Mechanisms](handicap-mechanisms/README.md) and the point totals produced by the [Points System](points-system/README.md). The per-game data feeding those metrics arrives via the scoring runtime, which fills in the game slots produced by the [Pairings Generator](pairings-generator.md). The Win Calculator does not read the Pairings Generator's slot list directly — it reads the game data that later fills those slots.
- **Output**: the match result — the declared winner, or a tie when no winner is produced.
- **Tiebreak**: when the comparators yield no winner, the scoring runtime fires the [Tiebreak System](tiebreak-system/README.md); the winner it produces re-enters as the `edge` chip and the Win Calculator recalcs. Sequential, not circular: comparators conclude tie → runtime runs Tiebreak System → winner written → Win Calc recalcs.
- **Downstream**: the per-match result feeds the Standings concern (outside the modular Scoring System catalog — its architectural shape is a separate future brainstorm) for season-level ranking. The Win Calculator answers *"who won this match"*; the future Standings concern answers *"given the season's match results, who finishes where."*
