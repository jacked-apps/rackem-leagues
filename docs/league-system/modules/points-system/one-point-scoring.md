---
title: 1-Point Scoring System (Variant)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# 1-Point Scoring System

A peer variant of the **[Scoring Systems](README.md)** Module — covering the **Points System** sub-concern (per-game point allocation rule). CSI's published name; also called *Race To* or *win/loss system*.

> **Reading this cold?** The Scoring Systems Module bundles two separate concerns — a **Points System** (how points are allocated per game) and a **Win Calculator** (how match victory is decided). This page describes the **1-Point Scoring System**, which is a *Points System* rule only: each game won = 1 point, each game lost = 0 points. It allocates points; it does NOT decide who won the match (that's the Win Calculator's job). Because the allocation is binary, match-total points always equals games-won counts. The simplest possible per-game allocation rule. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

Per-game allocation: **winner gets 1 point, loser gets 0 points.** Match-total points = number of games won. Because the per-game allocation is binary, the points-axis match total and the games-axis match total are always identical for this scoring system.

**Picture this** (for the novice-explanation case): like keeping score in a tennis tournament — every game won is one tally mark for the winner. Whoever has more tally marks at the end wins. There's no per-game gradation; you either win the game or you don't.

## How it works

At game completion, the [Points System](README.md#points-system) records winner=1 / loser=0. Per-game points accumulate to a match-total points count (which, for this system, equals the games-won count). The [Win Calculator](README.md#win-calculator) consults match-total to determine the winner. With `win_condition='games'`, the games-won counts decide; with `win_condition='points'`, the accumulated points decide — but for 1-Point both produce the same winner.

A typical Win Calculator pairing is `win_condition='games'` with a target ("first to N wins" — CSI's "Race To" framing). When paired with the [`extra_games`](../handicap-mechanisms/extra-games.md) mechanism, the asymmetric per-team targets produce the handicapped match.

## When you'd use it / pros

- **Simplest possible scoring** — no per-game balls-pocketed tracking, no complex point math.
- **Easy to communicate** — players immediately understand "first team to N wins."
- **Match progress is intuitive** — current standings = games won, no separate point counter to track.
- **Pairs naturally with games-counting Win Calculators** — the asymmetric-game-targets mechanism (`extra_games`) maps directly to per-team race targets.

## When you wouldn't / cons

- **No granularity for losses** — a player who loses 4-3 in a long game gets the same 0 points as one who got blasted 8-0. Effort isn't captured.
- **Doesn't differentiate close matches from blowouts** at the per-game level — the only signal is win/loss.
- **Less suited for high-skill leagues** where players want their effort recognized even in losses; 10-Point is more rewarding in that context.

## Interactions

- **Pairs naturally with [`extra_games`](../handicap-mechanisms/extra-games.md) mechanism** — asymmetric per-team game targets feed directly into the games-based win condition.
- **Pairs with games-counting Win Calculator** (`win_condition='games'`) — the natural fit for "first to N wins" matches.
- **Compatible with [Points](../handicap-systems/points.md), [Percentage](../handicap-systems/percentage.md), and [FargoRate](../handicap-systems/fargorate.md) Handicap Systems** when paired with extra_games + a calibrated chart.
- **Compatible with the future "[games on the wire](../handicap-mechanisms/README.md#future-possibilities)" mechanism** — head-start in games-won fits cleanly with 1-Point's games-tally framing.

## Possible modifications

- **Different per-game point value** — e.g., 2 points per win instead of 1 (still binary).
- **Per-game tie/split rule** — each gets 0.5 if a game ties (rare in pool but conceivable).
- **Negative points for losses** — penalty system; uncommon but technically a calculator-param choice.

## Current code state

**Not shipped as a direct configuration.** No current Scoring System uses a calculator that exactly implements CSI's 1-Point Scoring System (winner=1, loser=0, accumulated). The closest in spirit is **Points 3-Man** (`standard_3v3`), which uses `win_condition='games'` (matching 1-Point's victory-by-games-won philosophy) but with `points_calculator='linear_above_threshold'` — a coined calculator that gives points only above a games threshold rather than 1-per-win. So the *match-victory rule* is 1-Point-style; the *per-game point allocation* is different.

A literal CSI 1-Point Scoring System could be implemented as a new calculator (e.g., `accumulated_per_game` with `winner.points=1, loser.points=0`) and selected via the wizard. The infrastructure supports it; no league has requested it yet.

- DB: `'games'` allowed value in `preferences.win_condition` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql:115-117`).
- Win Calculator dispatch: see `src/systems/buildSystemFromPreferences.ts` (the wireup that routes match results based on `win_condition`).
- Cited CSI source: [1-Point Scoring System (CSI)](https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues).
