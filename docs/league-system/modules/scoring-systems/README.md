---
title: Scoring Systems (Module)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# Scoring Systems

## Essence

A **scoring system** governs *how points are allocated per game* and *how match victory is determined* from the collected match data. The Module bundles two related but separable sub-concerns:

1. **Points System** — the per-game point-allocation rule (CSI's "1-Point Scoring System," "10-Point Scoring System," "17-Point Scoring System," and our coined custom calculators).
2. **Win Calculator** — which collected metric (games-won counts vs accumulated points, plus tie/cross-axis rules) decides who won the match.

These are bundled here because CSI presents them together, but they're architecturally separable concerns. See [Architectural intent](#architectural-intent) below.

## Why scoring systems exist

Every match produces two streams of data: **games** (winner/loser per game) and **points** (per-game point allocations). The scoring system answers two questions about that data:

- *How are per-game points calculated?* — A scoring system specifies how many points each side gets per game (e.g., 1-Point: winner 1, loser 0; 10-Point: winner 10, loser 0–7).
- *Which metric decides match victory?* — A Win Calculator consults either the games-won counts, the accumulated points, or some combination, to declare a winner.

Without a scoring system, you have raw per-game outcomes but no way to translate them into a match result.

## Boundary

A scoring system is **only** the per-game point allocation rule + the match-victory determination. It is **not**:

- The strength encoding — that's a **[Handicap System](../handicap-systems/README.md)**.
- The kind-of-asymmetry the handicap declares — that's a **[Handicap Mechanism](../handicap-mechanisms/README.md)**.
- The chart/formula that converts handicap differences to benchmark values — that's a **[Threshold Chart](../threshold-charts/README.md)**.
- **Stats metadata about HOW games ended** (early 8-ball, scratch on 8, eight-wrong-pocket, etc.) — these are loss-cause events that belong in a future Stats/Analytics Module. *We care that you won, not how you won, for scoring purposes.*

If a proposed feature changes how per-game points are calculated → Points System (sub-concern below). If it changes which metric decides match victory → Win Calculator (sub-concern below). If it changes how the loss happened (with no impact on who won) → out of scope here.

### Architectural intent: Points System and Win Calculator are separable

The two sub-concerns above are **architecturally distinct**, even though they currently live as sibling fields (`points_calculator` + `win_condition`) inside this Module's preference config. A future Module restructure may extract **Win Calculator** as its own 8th Module — that decision is deferred until we have more downstream evidence (see task #18 / Unit 4 planning notes). For now they're presented as sibling sub-concerns within Scoring Systems.

The current Win Calculator implementation is **primitive**: a binary `win_condition` field (`'games'` | `'points'`) that selects which match-total accumulator decides the winner. The fuller architectural picture (termination semantics, cross-axis conditions, tie resolution, per-game evaluation cadence) is identified for future expansion — see the Win Calculator section below.

## Sub-concern 1: Points System (per-game point allocation) {#points-system}

This is the per-game scoring rule: how many points does each side get for a given game outcome?

**CSI's published named systems** (variant pages exist for the two we ship; 17-Point referenced below):

| CSI Name | Per-game allocation |
|---|---|
| [**1-Point Scoring System**](one-point-scoring.md) (a.k.a. *Race To*) | Winner 1, loser 0. Match-total points = games won. |
| [**10-Point Scoring System**](ten-point-scoring.md) | Winner 10, loser 0–7 (typically based on balls pocketed). |
| **17-Point Scoring System** *(reference only — see below)* | Winner gets 10 + opponent's remaining balls; loser gets balls pocketed. Combined always sums to 17. |

**Our coined calculator implementations** (the actual code):

| Calculator name | Pattern | Used by Division |
|---|---|---|
| `accumulated_per_game` | Per-game accumulation (winner fixed value, loser counter input). Direct match for CSI's 10-Point Scoring System with default params. | FargoRate 10-Point 5-Man (`fargo_5v5`) |
| `linear_above_threshold` | Aggregate calculation — points are a linear function of (games_won − threshold). Below threshold = 0 points. Coined; no direct CSI name match. | Points 3-Man (`standard_3v3`) |
| `accumulate_with_milestone_jumps` | Aggregate calculation — points accumulate with milestone bonuses (e.g., multiplier at tie). Coined; no direct CSI name match. | Percentage 5-Man (`standard_5v5`) |
| `none` | No-op calculator. Used when the league does not track points at all. | None today (selectable for new leagues) |

The CSI-named systems describe **rules**; our calculator implementations are the **runtime code** that implements those rules (or coined alternatives). Variant pages cover the CSI rules; the calculator names are documented here as the implementation layer.

### 17-Point Scoring System (reference only)

CSI also names a **17-Point Scoring System**: winner gets 10 points plus one point per ball the opponent has remaining; loser gets one point per ball pocketed (0–7); combined always sums to 17. CSI's main use case is encouraging losers to play out games to maximize their score even after the win is locked. The app does not currently ship a Division using 17-Point. The same `accumulated_per_game` calculator could implement it with different params (winner formula = `10 + balls_remaining_on_table`); no calibrated chart or shipping Division does so today. No dedicated variant page — this paragraph is the reference.

## Sub-concern 2: Win Calculator (decides match victory) {#win-calculator}

The Win Calculator examines the collected match data (games-won counts per side, accumulated points per side) plus any benchmarks declared by Handicap Mechanisms (e.g., asymmetric game targets from `extra_games`, initial point bonuses from `start_points`), and declares the winner.

**Currently shipping (primitive):**

- `win_condition='games'` — match winner = team with more games won. Mechanism-declared benchmarks (e.g., asymmetric targets from `extra_games`) are consulted as the per-team thresholds.
- `win_condition='points'` — match winner = team with higher accumulated points total. Mechanism-declared benchmarks (e.g., bonus points from `start_points`) are added to the running point totals.

**Future architectural picture** (deferred decisions in task #18):

A fuller Win Calculator would handle:

1. **Axis selection** — which data axis decides victory (games / points / both / cross-axis).
2. **Termination semantics** — does the match end when the win-condition is met (race-mode), or play to a fixed game count and evaluate at end (threshold-mode)?
3. **Tie resolution** — both teams crossed the target / both at zero / tie on one axis.
4. **Cross-axis conditions** — Win Calc rules can consult both axes simultaneously. Example: Points 3-Man's *"positive points only given if game threshold reached; possible to win with zero points."*
5. **Per-game evaluation cadence** — race-mode requires per-game checks; threshold-mode can evaluate at match-end.

Whether Win Calculator stays as a sub-concern here or extracts to its own Module is the architectural decision tracked in task #18 — to be settled when more Modules are written and the cross-Module dependencies are clearer.

## Persisted-but-unconsumed: `points_system` column

The DB has a `points_system` column (`differential | bca_tiered | per_game | manual`) from Phase 1 of the modular system rollout. **No scoring runtime currently consumes the resolved value.** It persists per Ed's "don't drop columns" directive — system has 13 *behavioral* axes; `points_system` is a 14th *persisted-but-unconsumed* column. Future cleanup may rename or drop in a separate branch.

## How this Module interacts

- **Upstream**: [Handicap Mechanisms](../handicap-mechanisms/README.md) declare benchmarks (asymmetric game targets, initial point bonuses, per-pairing race lengths) that the scoring system consults at match-end. [Handicap Systems](../handicap-systems/README.md) produce the encoded strength values that drive the mechanism's benchmarks.
- **Downstream**: [Standings & Tiebreakers](../standings-tiebreakers.md) consume per-team match-totals (games-won + accumulated points) for league-table display. The standings sort order is configured separately (`standings_sort` axis); standings can sort by either accumulator regardless of which the Win Calculator used to declare the match winner.

## Future possibilities

- **Win Calculator as its own 8th Module** — currently a sub-concern within Scoring Systems; future restructure may extract.
- **Race-mode termination on either axis** — match ends when target is reached, instead of playing to a fixed game count.
- **Cross-axis Win Calculator conditions** — explicit DSL for rules like "must hit games threshold AND have more points than opponent."
- **17-Point Scoring System implementation** — could be added as an `accumulated_per_game` config; no shipping Division uses it.
- **LO-customizable per-game allocations** — operators could define new calculator types via a UI rather than requiring code changes. The calculator registry (`src/systems/calculators/index.ts`) already supports `registerCalculator` for arbitrary new calculators; the gap is the LO-facing UI.
- **Hybrid scoring systems** — combinations of CSI-named systems within a single match (e.g., per-game using 10-Point but a cross-axis cap using 1-Point logic).

## Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — `win_condition`, `points_calculator`, `points_calculator_params`, `points_system` column types
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK enumerating allowed values
- `src/systems/calculators/index.ts` — calculator registry (`getCalculator`, `registerCalculator`, `listCalculators`)
- `src/systems/calculators/types.ts` — `PointsCalculator` interface (discriminated by `kind: 'aggregate' | 'per_game'`)
- `src/systems/calculators/{linear_above_threshold,accumulate_with_milestone_jumps,accumulated_per_game}.ts` — per-calculator implementations
- `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` and `WinConditionStep.tsx` — wizard UI for the two sub-concerns
