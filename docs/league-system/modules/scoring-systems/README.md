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

The Points System is a **composition of small single-purpose sub-mechanisms** that combine to produce per-team match-total points. A Division's full Points System is a configured stack of these sub-mechanisms.

### The composable sub-mechanism types

- **(A) Per-game allocator** — ONE generic mechanism, configurable per side. On each game, give winner X and loser Y. Each side's value can be expressed as:
  - **Integer** — a set number, no input needed (e.g., `winner = 10`)
  - **Array `[min, max]`** — a range; the scorer inputs the actual value per game (e.g., `loser = [0, 7]` for balls pocketed)
  - **Formula** — derived from game data (e.g., `winner = 10 + (7 − loser)` — the 17-Point case where winner gets 10 plus opponent's remaining balls). *Not yet supported in code; the calculator interface would need a `formula` kind.*

  The data shape implies the input behavior — integer = no input, array = scorer input, formula = computed. No explicit `input` or `formula` flags needed.
- **(B) Threshold trigger** — at games-threshold N, change or add to the running point total. Multiple triggers can stack (one at threshold X, another at threshold Y, etc.). Currently bundled inside the `accumulate_with_milestone_jumps` calculator.
- **(C) Initial points** — given once at match start, handicap-driven amount. Currently lives as the [`start_points`](../handicap-mechanisms/start-points.md) Handicap Mechanism; its output feeds the Points System's running totals. (start_points is *both* a handicap mechanism in the current taxonomy AND a Points System sub-mechanism architecturally.)
- **(D) End-of-match aggregate** — alternative to per-game accumulation. Computes team_points = f(games_won, threshold) once at match end, rather than accumulating per-game. Implementation: the `linear_above_threshold` calculator.

### CSI's named scoring systems are configurations of (A)

| CSI Name | Per-game allocator config |
|---|---|
| [**1-Point Scoring System**](one-point-scoring.md) (a.k.a. *Race To*) | `winner = 1, loser = 0`. ***Degenerate*** — match-total points always equals games-won; functionally equivalent to just counting games. CSI gives it a name; in our system it's effectively `win_condition='games'` with no separate calculator. |
| [**10-Point Scoring System**](ten-point-scoring.md) | `winner = 10, loser = [0, 7]` (balls pocketed; scorer input per game). |
| **17-Point Scoring System** *(reference only)* | `winner = 10 + (7 − loser), loser = [0, 7]`. **Key difference from 10-Point:** winner is a FORMULA (10 + opponent's remaining balls); 10-Point's winner is FIXED at 10. Per-game total always = 17 (vs 10–17 in 10-Point). Not yet implementable — needs the `formula` shape. |

CSI's main use case for 17-Point: incentivizes the loser to keep pocketing balls even after the win is locked, since each ball they fail to pocket adds to the winner's score.

### Each Division's Points System composition

| Division | Composition |
|---|---|
| Points 3-Man (`standard_3v3`) | **(D)** `points = games_won − threshold` |
| Percentage 5-Man (`standard_5v5`) | **(A)** winner=`fixed:0.1`, loser=`fixed:0` + **(B)** milestone trigger 1: jump to 1.5 at games-X + **(B)** milestone trigger 2: jump to 3 at games-Y |
| FargoRate 10-Point 5-Man (`fargo_5v5`) | **(C)** handicap-driven start_points + **(A)** winner=`fixed:10`, loser=`counter:0–7` (CSI's 10-Point Scoring System) |

The compositions above are **conceptual**. Current code bundles them differently — see the calculator implementations table below.

### Our coined calculator implementations (current code)

| Calculator (in code) | What it actually contains | Used by Division |
|---|---|---|
| `accumulated_per_game` | (A) generic per-game allocator | FargoRate 10-Point 5-Man (also wired with start_points logic in `fargo5v5.ts`) |
| `accumulate_with_milestone_jumps` | (A) + (B) bundled into one calculator | Percentage 5-Man |
| `linear_above_threshold` | (D) end-of-match aggregate | Points 3-Man |
| `none` | No-op (no points tracked at all) | None today (selectable for new leagues) |

**Implementation artifact, not architectural intent.** The current per-Division bundling means the "calculator" picked in the wizard is a pre-built combination matching that Division. Architecturally, a future refactor should decouple these into composable sub-mechanisms — so an LO could mix-and-match (e.g., milestone triggers stacked on top of any per-game allocator config; start_points combined with any per-game allocator; new compositions for new Divisions without writing new calculator types).

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
