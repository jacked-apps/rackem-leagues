---
title: Race Length Adjustment (Reserved)
date: 2026-05-13
status: reserved
audience: developer + AI sessions
---

# Race Length Adjustment

A peer variant of the **[Handicap Mechanisms](README.md)** Module. **Reserved**: schema present, no calibrated chart exists for any current Handicap System pairing, so no shipping Scoring System uses this mechanism today.

> **Reading this cold?** A handicap mechanism is *how* the league applies a strength difference between teams or players. (If the sides are evenly matched, no handicap is applied.) This page describes the **Race Length Adjustment** variant: per-pairing race lengths differ by the individual skill gap between the two paired players. Of the currently-defined mechanisms, this is the one that operates at the *per-pairing* level (the others — extra_games and start_points — work at the team level). Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

The mechanism gives the weaker player in each **individual head-to-head pairing** a shorter race-to target than the stronger player. Each pairing has its own asymmetric race length, set from the rating gap between the two paired players (not the team-vs-team aggregate).

**Same fundamental shape as `extra_games`.** Race Length Adjustment and Extra Games both live in the *Games / Extended-finish* cell of the [Module's 2x2 taxonomy](README.md#variants-index--the-2x2-fundamental-taxonomy) — same fundamental mechanism (stronger side has a farther finish line on the games axis). The differences are **mode flags**, not kind:

- **Scope**: per-pairing (this variant) vs team-aggregate (`extra_games`). Per-pairing means each individual matchup gets its own asymmetric finish lines, computed from the *individual* rating pair rather than the team-sum difference.
- **Termination**: race (this variant — pairing ends when either player hits their target) vs threshold (`extra_games` — play all games to the team-level fixed count, evaluate at end).

Both of these are aggregation/timing choices on top of the same fundamental shape, not different kinds of mechanism.

**Picture this** (for the novice-explanation case): An APA SL7 vs SL5 matchup. With a standard race-to of 5 for both players, the SL5 has almost no chance. With Race Length Adjustment, a chart says SL7 must win 5 games of their head-to-head while SL5 needs only 3. APA's well-known "SL race chart" is exactly this pattern — different cells for every possible (your-SL, their-SL) pair. The mechanism applies per matchup; team-level victory is then aggregated from the pairing outcomes.

## How it works

The mechanism's output is a per-pairing tuple `(race_for_player_A, race_for_player_B)`, computed from the *individual* rating pair (not the team aggregate). Each pairing is **inherently race-mode**: it terminates when either player reaches their respective race target, regardless of how many games remain unplayed in the pairing. (This is structurally different from extra_games and start_points, which operate at the team level with currently-threshold-mode semantics.) The pairing outcomes (who won each head-to-head) are then handed off to the **[Win Calculator](../win-calculator.md)** for team-level match victory determination.

A [Threshold Chart](../threshold-charts/README.md) keyed on individual rating pairs would be required for any Handicap System using this mechanism. None currently exists in the codebase.

## When you'd use it / pros

- **Aligns with how APA leagues are conventionally run** — APA's SL race chart is widely known and a familiar UX for APA players.
- **Preserves the per-pairing structural identity** — each head-to-head feels like its own real race, with a clear target the player can see and pursue.
- **Per-pairing granularity** — adjustments are matched to the actual matchup, not the team aggregate; can feel "more fair" in lineups with mixed skill levels.

## When you wouldn't / cons

- **More complex to administer and explain** — every pairing has different race targets; players need a chart or app lookup at lineup time.
- **Doesn't apply cleanly to team-aggregate scoring** — the mechanism's outputs are per-pairing, so team-level victory rules need to consume pairing outcomes (not raw points).
- **No calibrated chart currently exists** — for this mechanism to ship, someone would need to author or import a per-pairing race chart for the chosen Handicap System.

## Interactions

- **Upstream**: works with [any Handicap System](../handicap-systems/README.md) whose chart can produce per-pairing race lengths from individual rating pairs.
- **No current shipping pairing.** Theoretically pairs naturally with [Skill Level](../handicap-systems/skill-level.md) — APA's SL race chart is the canonical real-world example of this mechanism. Could also pair with [FargoRate](../handicap-systems/fargorate.md) (FargoRate has chart precedent for per-pairing matchups in their "HOT race chart").
- **Compatible with [1-Point Scoring System](../points-system/one-point-scoring.md)** — pairing-level race-to outcomes map cleanly to a Win Calculator rule that counts how many pairings each side won and declares the team with more pairing wins the match winner.

## Possible modifications

- **Per-pairing minimum race length** — to avoid pathologically short races (e.g., race to 1).
- **Aggregate-level scaling** — apply a global scaling factor that adjusts how much the per-pairing race lengths diverge.
- **Game-type-dependent chart** — APA's chart values differ for 8-ball vs 9-ball (matching their SL range differences); a future implementation would need to handle game-type-keyed charts.

## Current code state

- DB: `'race_length_adjustment'` allowed value in `preferences.mechanism` CHECK (`supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`, around lines 122–134).
- Type: `RaceLengthThreshold` in `src/systems/types.ts` (around line 180).
- Dispatch: `pickRaceLengthThreshold()` in `src/systems/buildSystemFromPreferences.ts` (around line 334). Currently returns an equal-race-length fallback (warns: "no chart wired yet — Unit 3.3"). No Handicap System pairing is calibrated for this mechanism.
- **To revive**: a [Threshold Chart](../threshold-charts/README.md) keyed on individual rating pairs must be authored — e.g., an APA SL pair → per-player race lengths chart, or a FargoRate HOT-style chart. The schema and dispatch are in place; only the chart data is missing.
