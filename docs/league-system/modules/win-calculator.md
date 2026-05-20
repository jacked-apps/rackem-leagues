---
title: Win Calculator (Module)
date: 2026-05-14
status: active
locked: true
audience: developer + AI sessions
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Win Calculator

## Essence

The **Win Calculator** examines the collected match data — the two metrics every match tracks (Games and Points) plus any thresholds the Handicap Mechanisms declared — and **declares the match winner**. It does so by walking a configurable **metric precedence stack** — an ordered list of metrics — and choosing the first metric on which the two teams differ. Configured stacks may include `edge` as a stack entry; when the walker reaches `edge` (i.e., all higher-precedence metrics tied), the Win Calculator fires the [Tiebreak System](tiebreak-system/README.md) to produce edge's value, then uses that value as the deciding metric. The Win Calculator does not produce metrics and does not allocate points. It *decides*.

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
- The atomic methods that produce edge when a tie needs resolving — that's the **[Tiebreak System](tiebreak-system/README.md)**. The Win Calculator owns the *decision to fire* tiebreak when its metric stack ties out; the Tiebreak System owns *how* edge is produced (coin flip, short race, roshambo, etc.). Edge then re-enters the Win Calculator's stack as the lowest-precedence metric.
- The season-standings table — that's a separate Standings concern that lives **outside the modular Scoring System catalog entirely**. Its architectural shape (Module? System? subsystems for personal stats / achievements?) is a separate future brainstorm. The Win Calculator declares the per-match winner; the Standings concern consumes per-match results across the season to rank teams.

If a proposed feature changes *which collected metric (or combination) declares the winner, when the match ends, or how a tie resolves* — it belongs here. If it changes *how points get allocated per game* — that's the Points System.

## The metric precedence stack

The Win Calculator holds a **metric precedence stack** — an LO-configured ordered list of metrics to consult when declaring the match winner. At match end:

1. Walk the stack from the highest-precedence metric down.
2. For each metric, compare the two teams' values.
3. The **first metric on which the teams differ** decides the winner — the team with the higher value (per the metric's comparison rule) wins.
4. If a metric's values are equal, continue to the next metric in the stack.
5. When the walker reaches an `edge` entry in the stack (meaning all higher-precedence metrics tied), fire the **Tiebreak System** (see below); it produces edge's value, which the walker then uses as the deciding metric. If the walker reaches the end of the stack without producing a winner (no `edge` entry was in the stack to fire), the match is recorded as tied.

The simplest possible stack is one metric — equivalent to today's primitive `win_condition` field. A league using `win_condition='games'` has a one-metric stack: `[games_won]`. A league using `win_condition='points'` has `[points_earned]`. Real configurations can chain more metrics — e.g., `[points_above_threshold, games_won, edge]` reads as *"first compare points-above-threshold; if tied, compare games-won; if still tied, fall back to the Tiebreak System's edge."*

The metric stack is what makes Win Calculator *configurable* rather than primitive. Each Scoring System composition picks its stack.

## The Tiebreak System trigger and edge

When the walker reaches `edge` in the LO's metric stack (all higher-precedence metrics having tied), the Win Calculator **fires the Tiebreak System as a trigger**. The Tiebreak System (a chain of LO-configured Tiebreak Mechanisms — coin flip, short race, roshambo, etc., terminated by an auto-appended human-handoff modal) runs until it produces edge for one team. The Win Calculator then uses that edge value as the deciding metric and declares the team with edge the winner.

**Edge is single-valued by construction.** The Tiebreak System guarantees the chain produces edge before exhausting (the auto-appended terminal handoff makes this structural). With edge in the stack, ties always resolve.

**Win Calculator is "dumb" about how edge was produced.** The metric stack just sees a metric value and uses it. The Win Calculator doesn't know or care whether edge came from a coin flip or a single-rack tiebreaker game. This keeps Win Calculator the sole authority on "who won the match" while the Tiebreak System owns the *how* of producing edge.

**Accept-tie as final result.** Some leagues want a tied match to stand as a tied match (no extra play, no edge). Configuration: the LO's metric stack simply does NOT include `edge` as a fallback. The stack runs out, the Tiebreak System never fires, the match is recorded as tied. This is the architectural opposite of "include edge in the stack" — same Module, different LO choice.

## Current implementation status

Today's code is the primitive stand-in: a single binary field, `win_condition`, with values `'games'` or `'points'`. This is equivalent to a one-metric stack with no Tiebreak System trigger; ties at the chosen metric are handled by scattered runtime hooks rather than the structured metric-stack-plus-Tiebreak-trigger model described above. The full metric-stack model — including the Tiebreak System integration and the `edge` metric — is the architectural direction (captured in `docs/brainstorms/2026-05-17-tie-resolution-ownership-requirements.md`) and not yet in code. Implementation will require new preference column(s) describing the LO-configured stack and the integrated Tiebreak System chain evaluator.

## Remaining open design space

Beyond the metric stack and Tiebreak System integration documented above, the Win Calculator's fuller design space still contains genuinely-future items:

1. **Termination semantics** — does the match END when the win-condition is met (race-mode), or play to a fixed game count and evaluate at the end (threshold-mode)? Today every match plays its full game count; race-mode is unbuilt.
2. **Cross-axis conditions** — rules that consult both metric axes at once. Example from the Points 3-Man Scoring System: *"positive points are only awarded if the game threshold is reached; it is possible to win the match with zero points."* Currently this kind of cross-axis condition lives inside the Points System calculator (`linear_above_threshold`), not in Win Calculator. A future refactor could lift it.
3. **Per-game evaluation cadence** — race-mode requires checking the win-condition after every game; threshold-mode can evaluate once at match-end. Today only threshold-mode is wired; race-mode evaluation cadence is unbuilt.

## How this Module interacts

- **Upstream**: consumes the two **metrics** (Games and Points data) plus the **thresholds** declared by [Handicap Mechanisms](handicap-mechanisms/README.md) and the point totals produced by the [Points System](points-system/README.md). The per-game data feeding those metrics arrives via the scoring runtime, which fills in the game slots produced by the [Pairings Generator](pairings-generator.md) — the Win Calculator does not read Pairings Generator's output directly, but its inputs originate downstream of that Module's slot list.
- **Output**: the match result — the declared winner.
- **Trigger target**: when the metric stack ties out and `edge` is the next stack entry, the Win Calculator fires the [Tiebreak System](tiebreak-system/README.md) and consumes the edge metric the System produces. Sequential, not circular: Win Calc fires → Tiebreak System produces value → Win Calc reads the value and continues its stack evaluation.
- **Downstream**: the per-match result feeds the Standings concern (outside the modular Scoring System catalog — its architectural shape is a separate future brainstorm) for season-level ranking. The Win Calculator answers *"who won this match"*; the future Standings concern answers *"given the season's match results, who finishes where."*

## Source of truth

**Current code (the primitive stand-in):**
- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — the `win_condition` column type (`'games' | 'points'`)
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK for `win_condition`
- `src/systems/buildSystemFromPreferences.ts` — the dispatch that routes match-result determination based on `win_condition`
- `src/wizards/league-v2/steps/WinConditionStep.tsx` — wizard UI for selecting the win condition

**The metric stack + Tiebreak System trigger model documented above is not yet in code.** Implementation will replace the binary `win_condition` field with a richer LO-configurable stack representation and integrate the Tiebreak System chain evaluator. See `docs/brainstorms/2026-05-17-tie-resolution-ownership-requirements.md` for the captured architectural direction.
