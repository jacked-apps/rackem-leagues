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

The **Win Calculator** examines the collected match data — the two metrics every match tracks (Games and Points) plus any benchmarks the Handicap Mechanisms declared — and **declares the match winner**. It does not produce a metric and it does not allocate points. It *decides*.

## Why the Win Calculator exists

Every match accumulates two streams of data: **games** (winner/loser recorded per game) and **points** (allocated by the Points System). Something has to look at that data and answer the only question that ultimately matters: *who won the match?* That is the Win Calculator's single job.

Separating this out is load-bearing anti-conflation. It is tempting to assume "the scoring system" both allocates points AND decides victory — but those are two different responsibilities. The [Points System](points-system/README.md) allocates points; the Win Calculator decides the winner. A Points System rule (like CSI's "1-Point Scoring System") never, by itself, declares a winner — it just produces the point data the Win Calculator then consults.

## Boundary

The Win Calculator is **only** the victory-determination step. It is **not**:

- The per-game point allocation — that's the **[Points System](points-system/README.md)**.
- The encoding of player strength — that's a **[Handicap System](handicap-systems/README.md)**.
- The kind-of-asymmetry the handicap declares — that's a **[Handicap Mechanism](handicap-mechanisms/README.md)**.
- The chart/formula that turns a handicap difference into a benchmark — that's a **[Threshold Chart](threshold-charts/README.md)**.
- The structural game-slot list that scaffolds a match — that's the **[Pairings Generator](pairings-generator.md)** (its output is filled by the scoring runtime and the aggregated game data is what the Win Calculator eventually reads).
- The season-standings table or the match-night tiebreaker firing/format — that's **[Standings & Tiebreakers](standings-tiebreakers.md)** (Win Calculator declares the per-match winner; Standings & Tiebreakers consumes that result and either ranks teams across the season or fires extra-play when a single match ends tied).

If a proposed feature changes *which collected metric (or combination) declares the winner, when the match ends, or how a tie resolves* — it belongs here. If it changes *how points get allocated per game* — that's the Points System.

## Current state (primitive)

Today the Win Calculator is a single binary field, `win_condition`:

- `win_condition='games'` — match winner = team with more games won. Benchmarks declared by Handicap Mechanisms (e.g., asymmetric game targets from `extra_games`) are consulted as the per-team game thresholds.
- `win_condition='points'` — match winner = team with the higher accumulated points total. Benchmarks (e.g., bonus points from `start_points`) are folded into the running point totals.

That's the whole current implementation: a switch picking which match-total accumulator decides victory.

## Future architectural picture

A fuller Win Calculator — the design space this Module maps — would handle:

1. **Axis selection** — which data axis decides victory (games / points / both / a cross-axis combination).
2. **Termination semantics** — does the match END when the win-condition is met (race-mode), or play to a fixed game count and evaluate at the end (threshold-mode)?
3. **Tie resolution** — what happens when both sides cross their target, both sit at zero, or tie on one axis.
4. **Cross-axis conditions** — rules that consult both axes at once. Example from the Points 3-Man Scoring System: *"positive points are only awarded if the game threshold is reached; it is possible to win the match with zero points."*
5. **Per-game evaluation cadence** — race-mode requires checking after every game; threshold-mode can evaluate once at match-end.

These are not yet built — `win_condition` is the primitive stand-in. The fuller picture is documented here so future work has the design space already mapped.

## How this Module interacts

- **Upstream**: consumes the two **metrics** (Games and Points data) plus the **benchmarks** declared by [Handicap Mechanisms](handicap-mechanisms/README.md) and the point totals produced by the [Points System](points-system/README.md). The per-game data feeding those metrics arrives via the scoring runtime, which fills in the game slots produced by the [Pairings Generator](pairings-generator.md) — the Win Calculator does not read Pairings Generator's output directly, but its inputs originate downstream of that Module's slot list.
- **Output**: the match result — the declared winner.
- **Downstream**: [Standings & Tiebreakers](standings-tiebreakers.md) consumes the per-match result to build the season standings table and to evaluate whether a match-night tiebreaker should fire. Standings sort order is configured independently of which axis the Win Calculator used to decide any single match — Win Calculator answers *"who won this match,"* Standings & Tiebreakers answers *"given the season's match results, who finishes where,"* and *"if this single match ended tied, what (if anything) happens next."*

## Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — the `win_condition` column type (`'games' | 'points'`)
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK for `win_condition`
- `src/systems/buildSystemFromPreferences.ts` — the dispatch that routes match-result determination based on `win_condition`
- `src/wizards/league-v2/steps/WinConditionStep.tsx` — wizard UI for selecting the win condition
