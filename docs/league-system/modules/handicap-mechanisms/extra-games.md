---
title: Extra Games
date: 2026-05-13
status: active
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

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
- **Pairs naturally with a game-counting Win Calculator** — when match victory is decided by reaching game-win targets, extra_games' asymmetric targets directly determine the winner. If the Win Calculator instead consults accumulated points, the asymmetric targets are recorded but don't decide the match.
- **Clear and intuitive for players** — "your team needs to win 8 games, theirs needs 5" is easy to communicate at lineup time.

## When you wouldn't / cons

- **Can feel punitive to the stronger side** — even when mathematically fair, the stronger team may feel like the system is "rigging against them."
- **Doesn't work cleanly when the total game count is small** — a 6-game match where one side needs 5 and the other needs 1 effectively eliminates the weaker side's risk; the asymmetry is too coarse to be balanced.
- **Requires a calibrated chart for the specific Handicap System used** — the chart is what turns the difference value into meaningful targets.

## Interactions

- **Upstream**: works with [any Handicap System](../handicap-systems/README.md) whose chart can produce a per-team target-wins pair.
- **Pairs with** [Points](../handicap-systems/points.md) (via the [3v3 games-needed chart](../threshold-charts/3v3-games-needed.md)) and [Percentage](../handicap-systems/percentage.md) (via the [5v5 games-needed chart](../threshold-charts/5v5-games-needed.md)). FargoRate and Skill Level would each need a calibrated extra_games chart to pair.
- **Compatible with [1-Point Scoring System](../points-system/one-point-scoring.md)** — the asymmetric target wins map cleanly to a "first team to its target" victory rule.

## Possible modifications

- **Different chart granularities** — finer or coarser steps between target counts.
- **Scaling-factor variants** — pair with the 50% / 75% / 150% handicap-strength scaling options of Handicap Systems to dial the mechanism's intensity.
