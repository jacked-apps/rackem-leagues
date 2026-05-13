---
title: Handicap Mechanisms (Module)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# Handicap Mechanisms

## Essence

A **handicap mechanism** is *how* the league applies a handicap difference during actual play — the in-match adjustment that makes the match competitive between unequal sides. Mechanisms can apply at the **team** level (one team gets an asymmetric goal or bonus relative to the other) or at the **per-pairing** level (each individual head-to-head matchup gets its own asymmetric race length). The [Handicap Systems](../handicap-systems/README.md) Module produces a **number** (each player's encoded strength); this Module is what turns that number into an **advantage** for the weaker side, whether "side" means a team or a paired player.

## Why mechanisms exist

Without a mechanism, a handicap encoding is inert — it's just a number stored against each player with no effect on how a match plays out. The mechanism is the *thing that actually happens* because the handicap encoding says two sides (whether team-vs-team or player-vs-player) are unequal. There are multiple ways a league can choose to apply that inequality:

- Give the weaker side fewer games to win (asymmetric goals — *extra_games*)
- Give the weaker side bonus points at the start (asymmetric initial state — *start_points*)
- Make individual head-to-head pairings race to different game counts (asymmetric structure — *race_length_adjustment*)

Each option *feels* different in play. Choosing a mechanism is a real operational decision with its own social and competitive character (see variant pages). A league can also run **without a mechanism** (`mechanism='none'`) — typically because there's no handicap encoding to apply (`handicap_type='none'`).

## Boundary

A handicap mechanism is **only** the in-match application of a strength difference. It is **not**:

- The strength encoding itself — that's a **[Handicap System](../handicap-systems/README.md)** (Points, Percentage, FargoRate, Skill Level).
- The lookup table or formula that maps a difference value to a target/spot — that's a **[Threshold Chart](../threshold-charts/README.md)**. Mechanisms *consume* a chart's output; they don't compute it.
- The rule that decides who wins the match — that's a **[Scoring System](../scoring-systems/README.md)**.

If a proposed feature changes *what kind of advantage the weaker side gets during play*, it belongs here. If it changes how that advantage is *computed from the strength gap*, it belongs in Threshold Charts. If it changes how match victory is determined, it belongs in Scoring Systems.

### Architectural intent: modules are orthogonal

Any Handicap Mechanism should be **composable** with any Handicap System, any Threshold Chart, and any Scoring System (assuming a calibrated chart exists for the specific encoding-mechanism pair). The current codebase has wiring for specific combinations only — see variant pages for what's wired vs unwired. **This is an implementation status, not architectural intent.** Future work will fill in the gaps.

## Variants index

Three active mechanisms, plus the `'none'` case. Listed as peers — no variant is the "default."

| Variant | Code value | In-match effect |
|---|---|---|
| [**Extra Games**](extra-games.md) | `'extra_games'` | Stronger team's target wins > weaker team's target wins |
| [**Start Points**](start-points.md) | `'start_points'` | Weaker team starts with bonus points already scored |
| [**Race Length Adjustment**](race-length-adjustment.md) | `'race_length_adjustment'` | Per-pairing race lengths differ by individual skill gap |

### The `'none'` case

No mechanism applied. Used when `handicap_type='none'` (the league runs without handicapping). Covered here, no separate page. In code, `mechanism='none'` collapses to a zero-handicap `extra_games` shape for type-system convenience — callers consistently see `threshold.mode === 'extra_games'` with no per-side delta. Conceptually, it's just the absence of a mechanism.

## How this Module interacts

Mechanisms sit in the middle of the handicap chain:

- **Upstream**: [Handicap Systems](../handicap-systems/README.md) produce encoded strength values. The **difference** that feeds a mechanism is computed at the appropriate scope — team-vs-team for team-level mechanisms (`extra_games`, `start_points`), individual player-vs-player for per-pairing mechanisms (`race_length_adjustment`). For some encodings, the upstream input may be a derived value (e.g., FargoRate's win-expectancy probability) rather than a raw difference.
- **Internal partner**: [Threshold Charts](../threshold-charts/README.md) produce the actual numbers a mechanism needs — target wins (for extra_games), starting points (for start_points), per-pairing race lengths (for race_length_adjustment). A mechanism with no calibrated chart (or formula) for the encoding-side has nothing meaningful to apply. *Note:* "chart" is shorthand — a **formula** can fill the same role (e.g., FargoRate's start-points uses the `2^(rating/100)` formula in place of a lookup table; the 3v3 hardcoded chart could likewise be expressed as a formula). Charts and formulas are interconvertible expressions of the same mapping; the Threshold Charts Module covers both shapes. **Formulas are generally preferred** for their versatility — continuous coverage, easier LO customization, can generate any specific chart on demand.
- **Downstream**: [Scoring Systems](../scoring-systems/README.md) decide match victory based on accumulated games/points. The mechanism's effect (asymmetric goal, bonus head-start, structural difference) shapes what the scoring system reads at match end.

## Future possibilities

- **Hybrid mechanisms** — partial start_points + partial race-length adjustment; or extra_games at the team-aggregate level combined with race_length_adjustment at the pairing level.
- **LO-defined custom mechanisms** — operators wanting a non-standard advantage (e.g., extra time per shot, sequence-of-play priority, additional racks added back) would invent new mechanisms outside the current three.
- **Winner-takes-all variants** — a mechanism that gives the weaker team a single high-stakes advantage (e.g., one match-deciding game) rather than spreading the advantage across the whole match.

## Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — `mechanism` column type union
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` (around lines 122–134) — DB CHECK enumerating allowed values
- `src/systems/buildSystemFromPreferences.ts` — `pickThresholdCapability()` switch (around line 362) plus per-mechanism dispatchers (`pickExtraGamesThreshold`, `pickStartPointsThreshold`, `pickRaceLengthThreshold`)
- `src/systems/types.ts` (around line 137+) — discriminated union of threshold types (`ExtraGamesThreshold`, `StartPointsThreshold`, `RaceLengthThreshold`)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — resolved view applies the cascade for the `mechanism` column

**Clarifying note** (anti-conflation): the term `manual_entry` that appears in `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` is a **threshold-chart-source** classification (is the chart auto-generated by the app, or LO-entered manually?) — it is **NOT** a handicap mechanism. Easy to misread; do not conflate.
