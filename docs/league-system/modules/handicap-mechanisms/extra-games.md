---
title: Extra Games (Variant)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# Extra Games

A peer variant of the **[Handicap Mechanisms](README.md)** Module.

> **Reading this cold?** A handicap mechanism is *how* the league applies a strength difference between teams or players. (If the sides are evenly matched, no handicap is applied.) This page describes the **Extra Games** variant: the stronger team must win more games than the weaker team to win the match. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

The mechanism gives the weaker team an **asymmetric win target** — the stronger team must win *more games* than the weaker team to win the match. The size of the asymmetry depends on the strength gap: bigger rating gap = more games the stronger side must win.

**Picture this** (for the novice-explanation case): Team A is rated +3 stronger than Team B. Without a handicap, both teams might race to 5 wins. With Extra Games, a chart says Team A needs to win 8 games to win the match while Team B needs only 5. Effort and execution matter more than the raw skill gap — the underdog has fewer hills to climb, the favorite has more.

## How it works

The mechanism's output is a pair of per-team target wins (`target_home`, `target_away`). A team that reaches its target first wins the match. The targets come from a [Threshold Chart](../threshold-charts/README.md) that consumes the encoded strength difference:

- A [Handicap System](../handicap-systems/README.md) produces the team-vs-team difference (or rating pair).
- A Threshold Chart converts the difference into the asymmetric target pair.
- This mechanism *applies* those targets; it doesn't compute them.

## When you'd use it / pros

- **Operators preferring a "you have to earn it" feel** — the stronger team can't coast; they have to outperform the rating gap on the table.
- **Pairs naturally with a game-counting Win Calculator** — when match victory is decided by reaching game-win targets (currently `win_condition='games'`), extra_games' asymmetric targets directly determine the winner. If the Win Calculator instead consults accumulated points, the asymmetric targets are recorded but don't decide the match.
- **Clear and intuitive for players** — "your team needs to win 8 games, theirs needs 5" is easy to communicate at lineup time.

## When you wouldn't / cons

- **Can feel punitive to the stronger side** — even when mathematically fair, the stronger team may feel like the system is "rigging against them."
- **Doesn't work cleanly when the total game count is small** — a 6-game match where one side needs 5 and the other needs 1 effectively eliminates the weaker side's risk; the asymmetry is too coarse to be balanced.
- **Requires a calibrated chart for the specific Handicap System used** — the chart is what turns the difference value into meaningful targets.

## Interactions

- **Upstream**: works with [any Handicap System](../handicap-systems/README.md) whose chart can produce a per-team target-wins pair.
- **Currently wired in code** for [Points](../handicap-systems/points.md) (via [3v3 games-needed chart](../threshold-charts/3v3-games-needed.md)) and [Percentage](../handicap-systems/percentage.md) (via [5v5 games-needed chart](../threshold-charts/5v5-games-needed.md)). Unwired for FargoRate and Skill Level — those combos would need calibrated extra_games charts.
- **Compatible with [1-Point Scoring System](../points-system/one-point-scoring.md)** — the asymmetric target wins map cleanly to a "first team to its target" victory rule.

## Possible modifications

- **Different chart granularities** — finer or coarser steps between target counts.
- **Scaling-factor variants** — pair with the 50% / 75% / 150% handicap-strength scaling options of Handicap Systems to dial the mechanism's intensity.

## Current code state

- DB: `'extra_games'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `ExtraGamesThreshold` in `src/systems/types.ts` (around line 142).
- Dispatch: `pickExtraGamesThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 270). Wired for Points (delegates to `bca3v3.threshold.compute`) and Percentage (delegates to `bca5v5.threshold.compute`). Unwired combinations (Fargo + extra_games, skill_level + extra_games, etc.) return a zero-handicap fallback and emit a warning.
- The actual chart computation for the wired combos lives in `src/utils/handicap/get3v3GamesNeeded.ts` and `src/utils/handicap/get5v5GamesNeeded.ts`. Same architectural-intent flag as in the [Module README](README.md#architectural-intent-modules-are-orthogonal): the current `bca3v3`/`bca5v5` SystemModules bundle the chart call directly — that's a Threshold Charts concern bundled into the rating-system files for historical reasons, not architectural intent.
