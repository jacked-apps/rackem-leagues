---
title: Start Points
date: 2026-05-13
status: active
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Start Points

A peer variant of the **[Handicap Mechanisms](README.md)** Module.

> **Reading this cold?** A handicap mechanism is *how* the league applies a strength difference between teams or players. (If the sides are evenly matched, no handicap is applied.) This page describes the **Start Points** variant: the weaker team starts the match with bonus points already on the scoreboard — a head-start on the *points* axis. (The parallel head-start on the *games* axis is the future "[games on the wire](README.md#future-possibilities)" variant.) Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

The mechanism gives the weaker team a **head start** on the points axis — a number of points credited to the weaker team's match total *before* any games are played. Both teams then play normally; per-game points accumulate as usual. The bonus contributes to the final tally. The size of the head start depends on the strength gap: bigger rating gap = more bonus points.

**Conceptual parallel.** Start Points is the points-axis sibling of the (future) "[games on the wire](README.md#future-possibilities)" variant — both are head-start mechanisms, just on different axes. Where Start Points credits the weaker team with N bonus *points* at the start, games-on-the-wire would credit them with N games-already-won. Same framing, different unit.

**Picture this** (for the novice-explanation case): FargoRate team A (rating sum 2750) plays team B (rating sum 2250). FargoRate's formula computes that the rating gap is worth, say, 56 points. Team B starts the match with 56 points already in their column; team A starts at 0. Now both teams play games; per-game points accumulate normally; whoever has the higher total at the end wins. The weaker team enters with a tangible cushion, but still has to play well enough to defend it.

## How it works

The mechanism's output is a pair `(start_points_for_weaker_team, which_team_is_weaker)`. The weaker team is identified at lineup-lock time by comparing the encoded strength of each lineup; the start_points value comes from a [Threshold Chart](../threshold-charts/README.md) or formula. At match start, the start_points are credited to the weaker team's running point total; subsequent per-game points accumulate on top.

## When you'd use it / pros

- **Pairs naturally with a points-consulting Win Calculator** — when match victory is decided by accumulated points, start_points' initial bonus is directly factored into the winner determination. If the Win Calculator instead consults game-win counts, the bonus is recorded but doesn't decide the match.
- **Feels less punitive than asymmetric goals** — the stronger team isn't forced to win extra games; they just face a starting deficit. The framing is "the weaker team has a leg up" rather than "the stronger team has to work harder."
- **Smooth across a wide skill range** — start_points scales continuously (e.g., 12 points, 56 points, 200 points) rather than in discrete game-target steps. Useful when handicaps are fine-grained.

## When you wouldn't / cons

- **Requires a points-consulting Win Calculator** — the start_points value is in points, so the bonus is meaningless if match victory is decided purely by game-win counts. The underlying *idea* (head-start in whatever unit the Win Calculator consults) could be generalized — e.g., a future variant could credit the weaker team with N games-already-won for a game-counting Win Calculator. That generalization is captured as the "**games on the wire**" entry in the [Module README's Future Possibilities](README.md#future-possibilities).
- **The weaker team's lead can feel "given" rather than "earned"** — some players dislike starting matches at a deficit even when mathematically justified.
- **Requires a calibrated formula or chart for the Handicap System used** — without one, the bonus amount is undefined.

## Interactions

- **Upstream**: works with [any Handicap System](../handicap-systems/README.md) whose chart or formula can produce a point-bonus value from the strength gap.
- **Pairs with** [FargoRate](../handicap-systems/fargorate.md) (via the [Fargo formula chart](../threshold-charts/fargo-formula.md)). Points, Percentage, and Skill Level would each need a calibrated start_points chart to pair.
- **Compatible with [10-Point Scoring System](../points-system/ten-point-scoring.md)** — CSI's flagship handicapped configuration uses FargoRate + Start Points + 10-Point Scoring as a bundled combo.

## Possible modifications

- **Different bonus formulas / charts** — alternative ways to compute the bonus from the strength gap.
- **Cap the bonus** — limit how many points a weaker team can receive regardless of rating gap (some operators prefer a hard cap to keep extreme bonuses from feeling "ridiculous").
- **Scaling-factor variants** — pair with the 50% / 75% / 150% handicap-strength scaling options to dial the mechanism's intensity.
