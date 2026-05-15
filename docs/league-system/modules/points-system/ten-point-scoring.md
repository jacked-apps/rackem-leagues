---
title: 10-Point Scoring System (Variant)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# 10-Point Scoring System

A peer variant of the **[Points System](README.md)** Module — covering the per-game point allocation rule. CSI's published name; one of CSI's flagship per-game scoring rules for handicapped FargoRate divisions.

> **Reading this cold?** The Points System governs *how points are allocated per game* (it does NOT decide who wins the match — that's the [Win Calculator](../win-calculator.md)'s separate job). This page describes the **10-Point Scoring System** variant of the per-game allocator: the winner gets 10 points, the loser gets 0–7 points based on how many balls they pocketed before losing. The accumulated point totals are then read by the Win Calculator (`win_condition='points'`) to declare the match winner. Used today by the FargoRate 10-Point 5-Man Scoring System. Other Points System variants exist (see the [Module README](README.md) for the full picture).

## What it is

Per-game allocation: **winner gets 10 points (fixed). Loser gets 0–7 points based on how many balls they pocketed before losing the game.** Per-game totals can range from 10 (winner sweeps with loser pocketing nothing) to 17 (winner finishes with loser having pocketed 7 of their 7 balls — a close game). Match victory is decided by accumulated team points.

**Picture this** (for the novice-explanation case): a 10-point pie per game. Winner takes 10 every time. The loser gets a slice based on how close they came to winning — a player who lost on the 8-ball after pocketing all 7 of their balls earns 7 points, even though they technically lost the game. So even losing games can earn meaningful points if you played well.

## How it works

At game completion:
- The Points System records `winner_points = 10` (configurable via params) and `loser_points = balls_pocketed_by_loser` (typically 0–7, configurable max).
- Per-game points accumulate to match-total points per side.
- The [Win Calculator](../win-calculator.md) consults match-total points (`win_condition='points'`) to declare the winner.

When paired with the [`start_points`](../handicap-mechanisms/start-points.md) Handicap Mechanism (the canonical FargoRate combo), the weaker team's match total starts non-zero — the bonus is added to their accumulating point total before the first game.

A subtle property: **mathematically possible to win the match without winning a single game.** If team A wins all 25 games but team B's losers pocket 7 balls each game, team B accumulates 25×7 = 175 points while team A accumulates 25×10 = 250 points — A wins. But if team B has Start Points credit (e.g., 100 points) bringing them to 275, B wins despite losing every game. This isn't a hypothetical — it's a real possibility under the rules and a known characteristic of points-based scoring.

## When you'd use it / pros

- **Rewards effort even in losses** — players are motivated to keep playing well after the win is out of reach. A player who pockets 6 balls before losing earns 6 points; this matters for match totals.
- **Per-game granularity** — match outcomes can be expressed as close (final scores like 200-185) or lopsided (200-100), capturing the actual flow of the match beyond just W/L counts.
- **CSI's flagship for FargoRate handicapped divisions** — the canonical pairing of FargoRate handicap + Start Points mechanism + 10-Point scoring is used widely in BCAPL handicapped leagues.

## When you wouldn't / cons

- **Requires per-game balls-pocketed tracking** — the scorekeeper has to count balls at the end of each game. More overhead than 1-Point's binary W/L recording.
- **Win-without-winning-a-game is possible** (with Start Points) — some operators find this counterintuitive even though it's mathematically fair under the handicap.
- **Less intuitive for new players** — "first to N wins" is easier to explain than "highest accumulated points."

## Interactions

- **Pairs naturally with [`start_points`](../handicap-mechanisms/start-points.md) mechanism** — the head-start bonus is in the same unit (points) as the per-game accumulation; integration is clean. This is the canonical FargoRate combo.
- **Pairs with points-consulting Win Calculator** (`win_condition='points'`) — the natural fit for accumulated-totals-decide matches.
- **Compatible with [FargoRate](../handicap-systems/fargorate.md) Handicap System** — the most prominent BCAPL handicapped configuration today.
- **Could also pair with [Points](../handicap-systems/points.md) or [Percentage](../handicap-systems/percentage.md) Handicap Systems** if a calibrated start_points chart for those handicap types existed; none currently does.
- **Future pairing with [extra_points](../handicap-mechanisms/README.md#future-possibilities)** — the (Points / Extended-finish) mechanism would set asymmetric points targets for the two teams (e.g., "stronger team needs 120, weaker needs 100"), pairing naturally with this scoring system.

## Possible modifications

- **Different `winner_points` value** — e.g., 12 or 15 instead of 10. The proportional structure (loser 0 to winner_points−3) would be preserved.
- **Different `loser_points_max`** — e.g., 5 instead of 7 (some leagues prefer a tighter loser range).
- **Different `loser_points_method`** — fixed value (always 5), formula-based (computed from rating gap), or balls-pocketed (current default).
- **Achievement-based bonuses** — break-and-run, golden-break, etc. (currently league-preference-driven, separate from this Points System variant; achievements compose with this calculator in the per-game scoring popup).

## Current code state

Used by the **`fargo_5v5`** wizard preset (a.k.a. the **FargoRate 10-Point 5-Man** prepackaged Scoring System). Implemented as the `accumulated_per_game` calculator.

- Calculator: `src/systems/calculators/accumulated_per_game.ts` — registered name `'accumulated_per_game'`. Per-game-input calculator (`kind: 'per_game'`); takes the list of stored game records and computes per-team match totals.
- Default params: `{ winner: { kind: 'fixed', points: 10 }, loser: { kind: 'counter', min: 0, max: 7, label: 'Balls pocketed' } }` — these are the 10-7 defaults; configurable per league.
- Storage: per-game data stores only `match_games.loser_balls_pocketed`; winner_points and loser_points are derived at read time from the snapshotted dials.
- Start-points integration: lives in `src/systems/fargo5v5.ts` (currently bundled with FargoRate's rating math; flagged as an [implementation artifact](../handicap-systems/fargorate.md#current-code-state) — a future refactor should decouple).
- DB: `'accumulated_per_game'` allowed value in `preferences.points_calculator` CHECK; `'points'` allowed value in `preferences.win_condition` CHECK.
- Cited CSI source: [10-Point Scoring System (CSI)](https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system).
