---
title: Points System (Module)
date: 2026-05-14
status: active
locked: true
audience: developer + AI sessions
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

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
- The chart/formula that converts a handicap difference into a threshold — that's a **[Threshold Chart](../threshold-charts/README.md)**.
- **The rule that decides who won the match** — that's the **[Win Calculator](../win-calculator.md)**. The Points System produces point data; the Win Calculator consults it (along with games and thresholds) to declare a winner.
- **Stats metadata about HOW games ended** (early 8-ball, scratch on 8, eight-wrong-pocket, etc.) — loss-cause events that belong in a future Stats/Analytics concern (outside this catalog). *We care that a game was won, not how, for point-allocation purposes.*

If a proposed feature changes *how points are calculated per game* → Points System. If it changes *which metric decides victory* → Win Calculator.

## The composable sub-mechanism types

The Points System is a composition of small single-purpose sub-mechanisms. A given Scoring System's Points System is a configured stack of these.

- **(A) Per-game allocator** — ONE generic mechanism, configurable per side. On each game, give winner X and loser Y. Each side's value can be expressed as:
  - **Integer** — a set number, no input needed (e.g., `winner = 10`)
  - **Array `[min, max]`** — a range; the scorer inputs the actual value per game (e.g., `loser = [0, 7]` for balls pocketed)
  - **Formula** — derived from game data (e.g., `winner = 10 + (7 − loser)` — the 17-Point case where winner gets 10 plus opponent's remaining balls). *Not yet supported in code; the calculator interface would need a `formula` kind.*

  The data shape implies the input behavior — integer = no input, array = scorer input, formula = computed. No explicit `input` or `formula` flags needed.
- **(B) Trigger** — fires on a condition (or at match start/end) and writes a value into match state via a flat expression. A trigger is NOT bound to a threshold — it reads state by name (a threshold may set that state; the two are decoupled). Multiple triggers stack, each independent, firing in a defined order. Full model: [trigger.md](trigger.md). Currently bundled inside the `accumulate_with_milestone_jumps` calculator.
- **(C) Initial points** — given once at match start, handicap-driven amount. Currently lives as the [`start_points`](../handicap-mechanisms/start-points.md) Handicap Mechanism; its output feeds the Points System's running totals. (start_points is *both* a handicap mechanism in the current taxonomy AND a Points System sub-mechanism architecturally.)

**End-of-match scoring (a `match_end` trigger pattern).** Some Scoring Systems compute a side's match points once at match end from its final `games_won`, rather than accumulating per-game. This is a use of (B): per side, two `match_end` triggers (see [trigger.md](trigger.md)) — `IF games_won > winTarget THEN points = (games_won − winTarget) × multiplier` (above-win) and `IF games_won < tieTarget THEN points = (games_won − tieTarget) × multiplier` (below-tie) — with the tie band as the default-0 (neither fires).

**Tie-band rule (the default-0 of the `match_end` pattern; today enforced in `linear_above_threshold`).** When both teams' `games_won` equals the threshold (e.g., 9–9 in 18-game 3v3), both teams receive 0 per-match points regardless of whether the [Tiebreak System](../tiebreak-system/README.md) subsequently fires or which side it produces edge for. The rule lives in `src/systems/calculators/linear_above_threshold.ts` and is fixed in code, not configurable. Two adjacent concerns lean on this rule: the Tiebreak System's tiebreaker games (when one fires) produce game outcomes that drive edge but do NOT add per-match points (the tie-band rule fixes per-match points at 0 for both sides regardless), and the future Standings concern (outside the modular Scoring System catalog — its architectural shape is a separate brainstorm) consumes the per-team accumulated points for season-level aggregation, where the tie-band rule's "tiebreaker games don't add points" guarantee is what makes the season totals coherent.

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
| Points 3-Man (`standard_3v3`) | **(B)** `match_end` triggers — `points = games_won − threshold` (tie band → 0) |
| Percentage 5-Man (`standard_5v5`) | **(A)** `winner = 0.1, loser = 0` + **(B)** milestone trigger 1: jump to 1.5 at games-X + **(B)** milestone trigger 2: jump to 3 at games-Y |
| FargoRate 10-Point 5-Man (`fargo_5v5`) | **(C)** handicap-driven start_points + **(A)** `winner = 10, loser = [0, 7]` (CSI's 10-Point Scoring System) |

The compositions above are **conceptual**. Current code bundles them differently — see the calculator implementations table below.

## How this Module interacts

- **Upstream**: [Handicap Mechanisms](../handicap-mechanisms/README.md) can contribute point values — e.g., the `start_points` mechanism's handicap-driven initial bonus feeds the Points System's running totals (sub-mechanism type C).
- **Sibling**: the [Win Calculator](../win-calculator.md) consults the point totals this Module produces (alongside the games metric) to declare the match winner. The Points System *produces*; the Win Calculator *decides*.
- **Downstream**: the future Standings concern (outside the modular Scoring System catalog — its architectural shape is a separate brainstorm) consumes per-team accumulated points for the league table.

## Future possibilities

- **Race-mode termination** — currently the point total is evaluated at match-end; a future option would end the match when a point target is reached.
- **17-Point Scoring System implementation** — needs the `formula` shape for the per-game allocator (see (A) above); no shipping Scoring System uses it.
- **LO-customizable per-game allocations** — operators defining new calculator types via UI rather than code. The calculator registry (`src/systems/calculators/index.ts`) already supports `registerCalculator`; the gap is the LO-facing UI.
- **Decoupled sub-mechanism composition** — the current calculators bundle (A)+(B) etc.; a future refactor would let an LO stack sub-mechanisms freely (milestone triggers on any per-game allocator, etc.).
