---
title: FargoRate Formula Chart (Variant)
date: 2026-05-16
status: active
audience: developer + AI sessions
---

# FargoRate Formula Chart

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Reading this cold?** A threshold chart is a passive lookup that converts a handicap input into a concrete match-setup benchmark. This page describes the **FargoRate Formula** variant: a continuous mathematical function (not a discrete table) that takes a set of FargoRate ratings and computes asymmetric match-setup thresholds. Other Chart variants exist as discrete tables (see the [Module README](README.md) for the full picture).

## What it is

A **formula-shaped Chart** — a continuous function over the FargoRate rating space, not a discrete row table. The underlying mathematical primitive is FargoRate's own published win-expectancy formula. Given any set of player ratings on both sides, the formula computes a single-game win probability for each side; from that probability plus the match's structural parameters (game count, scoring rule), it derives an asymmetric per-side match threshold — what form that threshold takes depends on which [Handicap Mechanism](../handicap-mechanisms/README.md) is consuming the Chart.

**Picture this** (for the novice-explanation case): Team A's five players have FargoRate ratings averaging 600; Team B's five average 525. The formula says "Team A is expected to win about 62% of single games against Team B." Plug that win probability into the match's 25-game structure plus its points-per-game scoring rule, and the formula tells you how many points to spot the weaker team at the start of the match — say, 56 points. The chart is a math function, not a printed table.

## How it works / how it's calculated

**Step 1 — The base transform.** Each rating becomes a "T-value":

> **T = 2 ^ (rating / 100)**

A 100-point rating gap doubles the T-value. This is FargoRate's canonical primitive (Mike Page's published form).

**Step 2 — Sum per side.** Sum the T-values of the active players on each side: `T_home_sum`, `T_away_sum`.

**Step 3 — Single-game win probability.**

> **P(home wins single game) = T_home_sum / (T_home_sum + T_away_sum)**

**Step 4 — Project into the desired threshold shape.** The same single-game probability projects into different per-match thresholds depending on what the consuming Mechanism expects:

- **Start-points projection** — compute the per-game expected points for each side (using the league's per-game scoring rule), multiply by match game count, take the absolute difference, floor: that's the start-points spot for the weaker team. (Output: `(start_points, weaker_side)`.)
- **Games-won projection** — multiply the win probability by the total game count to get each side's expected wins; add a calibrated spread to set the asymmetric per-side targets. (Output: per-side games-to-win thresholds.)

Both projections share the underlying T-formula and win-probability primitive; they differ in what they do with the probability afterward.

**Input:** a list of FargoRate ratings per side (one per active player). Ratings are integers in the FargoRate-published range (100–850).

**Output (variant-specific projection):**

- For the **start-points projection**: `{ start_points: integer, weaker_side: 'home' | 'away' | 'even' }`. Used by leagues running [`start_points` Mechanism](../handicap-mechanisms/start-points.md).
- For the **games-won projection**: per-side asymmetric game-win targets. Used by leagues running [`extra_games` Mechanism](../handicap-mechanisms/extra-games.md).

**Continuous, not bracketed.** Any rating combination produces an output — no buckets, no ranges. This is one of the key advantages of formula-shaped Charts over discrete tables.

**Calibration.** The start-points projection includes one empirically-calibrated constant (the average loser-points-per-game value, fit against a single real-match data point from the official FargoRate calculator). Future calibration may replace the constant with a gap-sensitive interpolation. The games-won projection is calibrated against FargoRate's published HOT race chart for individual matchups (a 96-point gap on a 10-game race produces 7-4, which the formula reproduces exactly).

## When you'd use it / pros

- **Native fit for the [FargoRate](../handicap-systems/fargorate.md) encoding** — the formula is FargoRate's own published math, applied as the league wants to use it.
- **Continuous coverage** — any rating combination has an answer; no "outside the supported range" gaps that discrete charts have.
- **Single source of truth** — no chart-formula sync issues; the formula IS the canonical form.
- **Generative** — can produce any specific chart for display, inspection, or LO-customization on demand.
- **Smaller storage** — one formula in code vs N table rows.
- **Easy LO knob tuning** — adjusting a parameter (e.g., the avg-loser-points constant) re-derives the entire mapping; no row-by-row editing.

## When you wouldn't / cons

- **Tied to the [FargoRate](../handicap-systems/fargorate.md) encoding's published math.** Pairing with [Points](../handicap-systems/points.md), [Percentage](../handicap-systems/percentage.md), or [Skill Level](../handicap-systems/skill-level.md) encodings requires a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a FargoRate-equivalent rating.
- **Calibration is partly empirical** — the avg-loser-points constant in the start-points projection is fit against a single official data point. Future calibration data may shift the value.
- **LO cell-edits break the formula** — once an LO tweaks individual rows away from the formula's output, the Chart must be persisted as a stored discrete table; the formula can no longer regenerate it. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)
- **Requires accurate ratings** — FargoRate ratings are externally sourced (until FargoRate API access lands, captains enter them at lineup time); the formula's outputs are only as good as the rating inputs.

## Interactions

- **Upstream:** consumes per-player ratings produced by the [FargoRate](../handicap-systems/fargorate.md) Handicap System.
- **Consumed by (start-points projection):** the [Start Points](../handicap-mechanisms/start-points.md) Handicap Mechanism, which reads the start-points value and weaker-side designation and declares the asymmetric initial points for the match.
- **Consumed by (games-won projection):** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the per-side targets and declares the asymmetric per-side game-win goals for the match.
- **Pairs with:** the [10-Point Scoring System](../points-system/ten-point-scoring.md) (start-points projection — used by the FargoRate 10-Point 5-Man Scoring System) and the [1-Point Scoring System](../points-system/one-point-scoring.md) (games-won projection — for race-style FargoRate leagues).
- **Not directly pairable** with [Points](../handicap-systems/points.md), [Percentage](../handicap-systems/percentage.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive).

## Possible modifications

- **Avg-loser-points constant** — the empirically-fit value in the start-points projection. An LO with their own historical data could re-fit this for their league.
- **Gap-sensitive avg-loser-points** — replace the constant with an interpolation over the rating gap. Removes the single-data-point calibration limitation.
- **Race spread** — adjustable spread parameter in the games-won projection that controls how asymmetric the per-side targets are at a given probability.
- **Ratings source** — captain-entered (current); future: live API pull from FargoRate's published ratings (when access lands).
- **Round-trip caveat:** the formula generates the threshold value continuously, but any LO override at the per-row or per-cell level falls back to discrete-table persistence and loses the round-trip. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)

## Current code state

- **Underlying primitive:** `2^(rating/100)` — implemented in two parallel files since the two projections are wired into different runtime paths.
- **Start-points projection** (wired to the FargoRate 10-Point 5-Man Scoring System): `src/systems/fargo5v5.ts` (`computeStartPoints()` function and surrounding `threshold.compute` capability). The `FargoStartPointsResult` type lives in `src/systems/types.ts`.
- **Games-won projection** (scaffolded, not wired to any shipped Scoring System): `src/utils/handicap/fargoGamesWonThresholds.ts`. Forward-looking implementation for an eventual FargoRate + `extra_games` Scoring System.
- **Not in the `threshold_charts` SQL tables.** Formula-shaped Charts live in code, not as rows in the `threshold_charts` table — there's no per-row data to seed. (The cascade-by-scope behavior described in the [Module README](README.md#cascade-behavior) applies to discrete-table Charts; formula-shaped Charts are currently selected by the league configuration but not stored per-scope. An LO who wants per-league formula-parameter overrides would need either parameter columns on `preferences` or a new storage shape — design open.)
- **Architectural note:** the two projections share the T-transform primitive but have different output shapes and different consumer Mechanisms. Per [PRINCIPLES § Module — § 8](../../PRINCIPLES.md#8-io-contracts-at-module-boundaries), distinct output types argue for splitting these into two peer Chart variants in a later iteration. Treating them as one variant here reflects their shared mathematical origin; the split would surface naturally when LO-customization UI distinguishes the two consumer Mechanisms. **Implementation artifact, not architectural intent** — flag for step-2+ review.
- **Reference research:** `docs/research/fargo-games-won-threshold.md`, `docs/research/fargorate-formula.md`.
