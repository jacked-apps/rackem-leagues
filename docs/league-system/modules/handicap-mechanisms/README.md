---
title: Handicap Mechanisms (Module)
date: 2026-05-13
status: active
locked: true
audience: developer + AI sessions
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Handicap Mechanisms

## Essence

A **handicap mechanism** declares the *kind of asymmetry* the handicap creates in a match's setup — what shape the advantage to the weaker side takes. Mechanisms operate on different data axes:

- **Games axis** — asymmetric game-win targets (`extra_games`), or asymmetric per-pairing race lengths (`race_length_adjustment`)
- **Points axis** — asymmetric initial point totals (`start_points`)

The [Handicap Systems](../handicap-systems/README.md) Module produces a **number** (each player's encoded strength); this Module declares the *kind* of threshold that number drives in match setup. The actual threshold **values** come from a [Threshold Chart](../threshold-charts/README.md). The mechanism does NOT decide who wins the match — that's the responsibility of a separate concern called the **Win Calculator** (see [How this Module interacts](#how-this-module-interacts) for the separation). Mechanisms can declare thresholds at the **team** level or the **per-pairing** level depending on the variant.

## Why mechanisms exist

Without a mechanism, a handicap encoding is inert — it's just a number stored against each player with no effect on the match. The mechanism is the *kind of threshold* the handicap drives in match setup, so that two sides (whether team-vs-team or player-vs-player) play to different targets, starting positions, or per-pairing race lengths. The mechanism *declares* the asymmetry; the match plays out under that asymmetry; the Win Calculator (separate concern) consults the played data plus thresholds to decide the winner. There are multiple ways a league can choose to shape that asymmetry:

- Give the weaker side fewer games to win (asymmetric goals — *extra_games*)
- Give the weaker side bonus points at the start (asymmetric initial state — *start_points*)
- Make individual head-to-head pairings race to different game counts (asymmetric structure — *race_length_adjustment*)

Each option *feels* different in play. Choosing a mechanism is a real operational decision with its own social and competitive character (see variant pages). A league can also run **without a mechanism** (`mechanism='none'`) — typically because there's no handicap encoding to apply (`handicap_type='none'`).

## Boundary

A handicap mechanism is **only** the in-match application of a strength difference. It is **not**:

- The strength encoding itself — that's a **[Handicap System](../handicap-systems/README.md)** (Points, Percentage, FargoRate, Skill Level).
- The lookup table or formula that maps a difference value to a target/spot — that's a **[Threshold Chart](../threshold-charts/README.md)**. Mechanisms *consume* a chart's output; they don't compute it.
- The rule that decides who wins the match — that's the **[Win Calculator](../win-calculator.md)**.

If a proposed feature changes *what kind of advantage the weaker side gets during play*, it belongs here. If it changes how that advantage is *computed from the strength gap*, it belongs in Threshold Charts. If it changes how match victory is determined, it belongs in the Win Calculator.

### Architectural intent: modules are orthogonal

Any Handicap Mechanism should be **composable** with any Handicap System, any Threshold Chart, and any Scoring System (assuming a calibrated chart exists for the specific encoding-mechanism pair). Wiring a specific combination only requires that a calibrated chart exist for that encoding-mechanism pair; the composability is a property of the design, not of any one pairing being realized.

## Catalog — the 2x2 fundamental taxonomy

The fundamental kinds of handicap mechanism are organized by two axes:

- **Data axis** — does the mechanism modify the *games* or the *points* dimension of match data?
- **Shape** — does it move the *start line* (head-start: weaker side starts ahead) or the *finish line* (extended-finish: stronger side has farther to go)?

That gives **four fundamental cells**. Each cell can host multiple variant implementations that differ on **mode flags** (scope, termination); see below the grid.

| | **Games axis** | **Points axis** |
|---|---|---|
| **Head-start** *(start line varies)* | *Future:* games on the wire | [**Start Points**](start-points.md) — `start_points` *(current)* |
| **Extended-finish** *(finish line varies)* | [**Extra Games**](extra-games.md) — `extra_games` *(current)* <br> [**Race Length Adjustment**](race-length-adjustment.md) — `race_length_adjustment` *(current)* | *Future:* extra_points |

### Mode flags within a cell

Variants within the same cell share the fundamental mechanism shape but differ on:

- **Scope** — *team-aggregate* (sum team handicaps, apply to the whole team match) vs *per-pairing* (use individual handicap, apply per head-to-head). Scope is just an aggregation choice at the input stage; the downstream sequence (find diff → apply formula → produce target) is the same.
- **Termination** — *threshold* (play to a fixed game count and evaluate at end) vs *race* (match ends when someone hits the target).

Currently-shipping variant implementations:

| Variant | Cell | Scope | Termination |
|---|---|---|---|
| `extra_games` | Games / Extended-finish | team | threshold |
| `start_points` | Points / Head-start | team | threshold |
| `race_length_adjustment` | Games / Extended-finish | per-pairing | race |

So `extra_games` and `race_length_adjustment` are **siblings within the same cell** — same fundamental mechanism, different mode flags.

### The `'none'` case

No mechanism applied. Used when `handicap_type='none'` (the league runs without handicapping). Covered here, no separate page. Conceptually, it's just the absence of a mechanism.

## How this Module interacts

Mechanisms sit in the middle of the handicap chain:

- **Upstream**: [Handicap Systems](../handicap-systems/README.md) produce encoded strength values. The **difference** that feeds a mechanism is computed at the appropriate scope — team-vs-team for team-level mechanisms (`extra_games`, `start_points`), individual player-vs-player for per-pairing mechanisms (`race_length_adjustment`). For some encodings, the upstream input may be a derived value (e.g., FargoRate's win-expectancy probability) rather than a raw difference.
- **Internal partner**: [Threshold Charts](../threshold-charts/README.md) produce the actual numbers a mechanism needs — target wins (for extra_games), starting points (for start_points), per-pairing race lengths (for race_length_adjustment). A mechanism with no calibrated chart (or formula) for the encoding-side has nothing meaningful to apply. *Note:* "chart" is shorthand — a **formula** can fill the same role (e.g., FargoRate's start-points uses the `2^(rating/100)` formula in place of a lookup table; the 3v3 hardcoded chart could likewise be expressed as a formula). Charts and formulas are interconvertible expressions of the same mapping; the Threshold Charts Module covers both shapes. **Formulas are generally preferred** for their versatility — continuous coverage, easier LO customization, can generate any specific chart on demand.
- **Downstream**: A separate concern — the **[Win Calculator](../win-calculator.md)** — examines the collected match data (games won per side, accumulated points per side) plus the thresholds the mechanism declared, and decides who wins the match. **The mechanism does NOT decide the winner** — it declares the threshold; what's done with the threshold plus played data is the Win Calculator's job.

## Future possibilities

- **Games on the wire** (Games / Head-start) — head-start on the games axis. The weaker team starts the match with N games already credited (e.g., "race to 9, but the weaker team starts with 3 wins"). The gambler's framing of handicapping. Same shape as `start_points` but on the games axis instead of the points axis.
- **Extra points** (Points / Extended-finish) — extended finish on the points axis. Both teams start at zero; the stronger team needs to reach a higher points target to win the match (e.g., "race to 100, but the stronger team needs 120"). Same shape as `extra_games` but on the points axis instead of the games axis. Completes the 2x2 taxonomy.
- **Hybrid mechanisms** — partial start_points + partial race-length adjustment; or extra_games at the team-aggregate level combined with race_length_adjustment at the pairing level.
- **LO-defined custom mechanisms** — operators wanting a non-standard advantage (e.g., extra time per shot, sequence-of-play priority, additional racks added back) would invent new mechanisms outside the currently-shipped three.
- **Winner-takes-all variants** — a mechanism that gives the weaker team a single high-stakes advantage (e.g., one match-deciding game) rather than spreading the advantage across the whole match.

## Anti-conflation note

**Clarifying note** (anti-conflation): the **threshold-chart-source** classification *manual entry* — is the chart auto-generated by the app, or LO-entered manually? — is **NOT** a handicap mechanism. Easy to misread; do not conflate.
