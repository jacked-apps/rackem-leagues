---
title: Start Points (Variant)
date: 2026-05-13
status: active
audience: developer + AI sessions
---

# Start Points

A peer variant of the **[Handicap Mechanisms](README.md)** Module.

> **Reading this cold?** A handicap mechanism is *how* the league applies a strength difference during actual play. This page describes the **Start Points** variant: the weaker team starts the match with bonus points already on the scoreboard. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

The mechanism gives the weaker team a **head start** — a number of points credited to the weaker team's match total *before* any games are played. Both teams then play normally; per-game points accumulate as usual. The bonus contributes to the final tally. The size of the head start depends on the strength gap: bigger rating gap = more bonus points.

**Picture this** (for the novice-explanation case): FargoRate team A (rating sum 2750) plays team B (rating sum 2250). FargoRate's formula computes that the rating gap is worth, say, 56 points. Team B starts the match with 56 points already in their column; team A starts at 0. Now both teams play games; per-game points accumulate normally; whoever has the higher total at the end wins. The weaker team enters with a tangible cushion, but still has to play well enough to defend it.

## How it works

The mechanism's output is a pair `(start_points_for_weaker_team, which_team_is_weaker)`. The weaker team is identified at lineup-lock time by comparing the encoded strength of each lineup; the start_points value comes from a [Threshold Chart](../threshold-charts/README.md) or formula (currently a formula in the FargoRate case). At match start, the start_points are credited to the weaker team's running point total; subsequent per-game points accumulate on top.

## When you'd use it / pros

- **Pairs naturally with points-based scoring systems** — the bonus is in the same unit (points) as the scoring system, so the integration is mathematically clean.
- **Feels less punitive than asymmetric goals** — the stronger team isn't forced to win extra games; they just face a starting deficit. The framing is "the weaker team has a leg up" rather than "the stronger team has to work harder."
- **Smooth across a wide skill range** — start_points scales continuously (e.g., 12 points, 56 points, 200 points) rather than in discrete game-target steps. Useful when handicaps are fine-grained.

## When you wouldn't / cons

- **Requires a points-based scoring system** — start_points is meaningless when match victory is decided purely by games-won (no point accumulator to add to).
- **The weaker team's lead can feel "given" rather than "earned"** — some players dislike starting matches at a deficit even when mathematically justified.
- **Requires a calibrated formula or chart for the Handicap System used** — without one, the bonus amount is undefined.

## Interactions

- **Upstream**: works with [any Handicap System](../handicap-systems/README.md) whose chart or formula can produce a point-bonus value from the strength gap.
- **Currently wired in code** for [FargoRate](../handicap-systems/fargorate.md) (via the [Fargo formula chart](../threshold-charts/fargo-formula.md)). Unwired for Points, Percentage, and Skill Level — those combos would need calibrated start_points charts.
- **Compatible with [10-Point Scoring System](../scoring-systems/ten-point-scoring.md)** — CSI's flagship handicapped configuration uses FargoRate + Start Points + 10-Point Scoring as a bundled combo.

## Possible modifications

- **Different bonus formulas / charts** — alternative ways to compute the bonus from the strength gap.
- **Cap the bonus** — limit how many points a weaker team can receive regardless of rating gap (some operators prefer a hard cap to keep extreme bonuses from feeling "ridiculous").
- **Scaling-factor variants** — pair with the 50% / 75% / 150% handicap-strength scaling options to dial the mechanism's intensity.

## Current code state

- DB: `'start_points'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `StartPointsThreshold` in `src/systems/types.ts` (around line 157).
- Dispatch: `pickStartPointsThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 304). Wired for FargoRate (delegates to `fargo5v5.threshold.compute`); unwired combinations return a zero start-points fallback and emit a warning.
- The actual `computeStartPoints` formula lives in `src/systems/fargo5v5.ts` (around lines 106–153). Same architectural-intent flag noted in [Module README](README.md#architectural-intent-modules-are-orthogonal) and in [`fargorate.md`'s Current code state](../handicap-systems/fargorate.md#current-code-state): the start-points math is currently bundled with the rating-system file (`fargo5v5.ts`) rather than living as a standalone mechanism. That bundling is an implementation artifact — start_points is a Mechanism concern that should be decoupled from the rating-system file in future refactors.
