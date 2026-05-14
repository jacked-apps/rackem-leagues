---
title: Points System (Module)
date: 2026-05-14
status: active
audience: developer + AI sessions
---

# Points System

## Essence

The **Points System** governs *how points are allocated per game*. It is a **composition of small single-purpose sub-mechanisms** that combine to produce per-team match-total points. A given Scoring System's full Points System is a configured stack of these sub-mechanisms.

The Points System **only allocates points**. It does not decide who won the match — that is exclusively the [Win Calculator](../win-calculator.md)'s job.

## Why the Points System exists

Every match tracks two metrics: **Games** (primary data — recorded directly) and **Points** (derived data — they do not exist until a mechanism computes them). The Points System is the set of mechanisms that *produce* the points metric. Without it, a match has game outcomes but no point totals.

## Boundary

The Points System is **only** the per-game point-allocation rule set. It is **not**:

- The encoding of player strength — that's a **[Handicap System](../handicap-systems/README.md)**.
- The kind-of-asymmetry the handicap declares — that's a **[Handicap Mechanism](../handicap-mechanisms/README.md)**.
- The chart/formula that converts a handicap difference into a benchmark — that's a **[Threshold Chart](../threshold-charts/README.md)**.
- **The rule that decides who won the match** — that's the **[Win Calculator](../win-calculator.md)**. The Points System produces point data; the Win Calculator consults it (along with games and benchmarks) to declare a winner.
- **Stats metadata about HOW games ended** (early 8-ball, scratch on 8, eight-wrong-pocket, etc.) — loss-cause events that belong in a future Stats/Analytics Module. *We care that a game was won, not how, for point-allocation purposes.*

If a proposed feature changes *how points are calculated per game* → Points System. If it changes *which metric decides victory* → Win Calculator.

## The composable sub-mechanism types

The Points System is a composition of small single-purpose sub-mechanisms. A given Scoring System's Points System is a configured stack of these.

- **(A) Per-game allocator** — ONE generic mechanism, configurable per side. On each game, give winner X and loser Y. Each side's value can be expressed as:
  - **Integer** — a set number, no input needed (e.g., `winner = 10`)
  - **Array `[min, max]`** — a range; the scorer inputs the actual value per game (e.g., `loser = [0, 7]` for balls pocketed)
  - **Formula** — derived from game data (e.g., `winner = 10 + (7 − loser)` — the 17-Point case where winner gets 10 plus opponent's remaining balls). *Not yet supported in code; the calculator interface would need a `formula` kind.*

  The data shape implies the input behavior — integer = no input, array = scorer input, formula = computed. No explicit `input` or `formula` flags needed.
- **(B) Threshold trigger** — at games-threshold N, change or add to the running point total. Multiple triggers can stack (one at threshold X, another at threshold Y, etc.). Currently bundled inside the `accumulate_with_milestone_jumps` calculator.
- **(C) Initial points** — given once at match start, handicap-driven amount. Currently lives as the [`start_points`](../handicap-mechanisms/start-points.md) Handicap Mechanism; its output feeds the Points System's running totals. (start_points is *both* a handicap mechanism in the current taxonomy AND a Points System sub-mechanism architecturally.)
- **(D) End-of-match aggregate** — alternative to per-game accumulation. Computes team_points = f(games_won, threshold) once at match end, rather than accumulating per-game. Implementation: the `linear_above_threshold` calculator.

## CSI's named scoring systems are configurations of (A)

**Vocabulary note (anti-conflation).** CSI uses the term **"Scoring System"** for what we call a **Points System per-game allocator rule** — i.e., just the per-game point-allocation piece. CSI's "Scoring System" does NOT include victory determination (CSI implicitly assumes "highest accumulated total wins"). In *our* vocabulary, a **Scoring System** is the whole configured rule set (handicap + games + points + win), and per-game point allocation is *this* Module — the **Points System**. So when CSI says "Scoring System," they mean our Points System's (A) per-game allocator only.

| CSI Name | Per-game allocator config |
|---|---|
| [**1-Point Scoring System**](one-point-scoring.md) (a.k.a. *Race To*) | `winner = 1, loser = 0`. ***Degenerate*** — match-total points always equals games-won; functionally equivalent to just counting games. CSI gives it a name; in our system it's effectively `win_condition='games'` with no separate calculator. |
| [**10-Point Scoring System**](ten-point-scoring.md) | `winner = 10, loser = [0, 7]` (balls pocketed; scorer input per game). |
| **17-Point Scoring System** *(reference only)* | `winner = 10 + (7 − loser), loser = [0, 7]`. **Key difference from 10-Point:** winner is a FORMULA (10 + opponent's remaining balls); 10-Point's winner is FIXED at 10. Per-game total always = 17 (vs 10–17 in 10-Point). Not yet implementable — needs the `formula` shape. |

CSI's main use case for 17-Point: incentivizes the loser to keep pocketing balls even after the win is locked, since each ball they fail to pocket adds to the winner's score.

## Each prepackaged Scoring System's Points System composition

| Prepackaged Scoring System | Composition |
|---|---|
| Points 3-Man (`standard_3v3`) | **(D)** `points = games_won − threshold` |
| Percentage 5-Man (`standard_5v5`) | **(A)** `winner = 0.1, loser = 0` + **(B)** milestone trigger 1: jump to 1.5 at games-X + **(B)** milestone trigger 2: jump to 3 at games-Y |
| FargoRate 10-Point 5-Man (`fargo_5v5`) | **(C)** handicap-driven start_points + **(A)** `winner = 10, loser = [0, 7]` (CSI's 10-Point Scoring System) |

The compositions above are **conceptual**. Current code bundles them differently — see the calculator implementations table below.

## Our coined calculator implementations (current code)

| Calculator (in code) | What it actually contains | Used by Scoring System |
|---|---|---|
| `accumulated_per_game` | (A) generic per-game allocator | FargoRate 10-Point 5-Man (also wired with start_points logic in `fargo5v5.ts`) |
| `accumulate_with_milestone_jumps` | (A) + (B) bundled into one calculator | Percentage 5-Man |
| `linear_above_threshold` | (D) end-of-match aggregate | Points 3-Man |
| `none` | No-op (no points tracked at all) | None today (selectable for new leagues) |

**Implementation artifact, not architectural intent.** The current per-Scoring-System bundling means the "calculator" picked in the wizard is a pre-built combination matching that Scoring System. Architecturally, a future refactor should decouple these into composable sub-mechanisms — so an LO could mix-and-match (e.g., milestone triggers stacked on top of any per-game allocator config; start_points combined with any per-game allocator; new compositions for new Scoring Systems without writing new calculator types).

## Persisted-but-unconsumed: `points_system` column

The DB has a `points_system` column (`differential | bca_tiered | per_game | manual`) from Phase 1 of the modular system rollout. **No scoring runtime currently consumes the resolved value.** It persists per Ed's "don't drop columns" directive. Future cleanup may rename or drop in a separate branch.

## How this Module interacts

- **Upstream**: [Handicap Mechanisms](../handicap-mechanisms/README.md) can contribute point values — e.g., the `start_points` mechanism's handicap-driven initial bonus feeds the Points System's running totals (sub-mechanism type C).
- **Sibling**: the [Win Calculator](../win-calculator.md) consults the point totals this Module produces (alongside the games metric) to declare the match winner. The Points System *produces*; the Win Calculator *decides*.
- **Downstream**: [Standings & Tiebreakers](../standings-tiebreakers.md) consumes per-team accumulated points for the league table.

## Future possibilities

- **Race-mode termination** — currently the point total is evaluated at match-end; a future option would end the match when a point target is reached.
- **17-Point Scoring System implementation** — needs the `formula` shape for the per-game allocator (see (A) above); no shipping Scoring System uses it.
- **LO-customizable per-game allocations** — operators defining new calculator types via UI rather than code. The calculator registry (`src/systems/calculators/index.ts`) already supports `registerCalculator`; the gap is the LO-facing UI.
- **Decoupled sub-mechanism composition** — the current calculators bundle (A)+(B) etc.; a future refactor would let an LO stack sub-mechanisms freely (milestone triggers on any per-game allocator, etc.).

## Source of truth

- `src/types/preferences.ts` and `src/types/resolvedSystemConfig.ts` — `points_calculator`, `points_calculator_params`, `points_system` column types
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` — DB CHECK enumerating allowed `points_calculator` values
- `src/systems/calculators/index.ts` — calculator registry (`getCalculator`, `registerCalculator`, `listCalculators`)
- `src/systems/calculators/types.ts` — `PointsCalculator` interface (discriminated by `kind: 'aggregate' | 'per_game'`)
- `src/systems/calculators/{linear_above_threshold,accumulate_with_milestone_jumps,accumulated_per_game}.ts` — per-calculator implementations
- `src/wizards/league-v2/steps/PointsCalculatorStep.tsx` — wizard UI for selecting the points calculator
