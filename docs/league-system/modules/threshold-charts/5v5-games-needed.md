---
title: 5v5 Games-Needed Chart (Variant)
date: 2026-05-16
status: active
audience: developer + AI sessions
---

# 5v5 Games-Needed Chart

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Reading this cold?** A threshold chart is a passive lookup table (or formula) that converts a handicap input into a concrete match-setup benchmark. This page describes the **5v5 Games-Needed Chart** variant: a discrete range table that takes a team-aggregate handicap difference (Percentage encoding) and returns each side's race-to target for a 25-game match. Other Chart variants exist (see the [Module README](README.md) for the full picture).

## What it is

A **discrete range table**, looked up by **the bracket the handicap difference falls into**, that returns the per-side race-to game-win target for a 25-game team match. The chart is calibrated for a **5-player lineup with single round-robin scheduling** (25 games per match) where the handicap encoding is the [Percentage](../handicap-systems/percentage.md) (0–100 integer) system.

**Picture this** (for the novice-explanation case): Team A's five-player percentage sum is 60 points stronger than Team B's. You look up the bracket "41–66 diff" in the chart and it tells you: "Team A races to 15 wins, Team B races to 11 wins; first to their number wins the match." The chart maps a chunky range of differences to a fixed pair of targets — neighboring differences in the same bracket give the same answer.

## How it works / how it's calculated

**Input:** a single integer — the **absolute handicap difference** at team-aggregate scope (|home_handicap_sum − away_handicap_sum|). The chart treats positive and negative differences symmetrically; the row identifies the *stronger* and *weaker* sides.

**Output:** a 2-tuple of integers: `(target_higher, target_lower)`.

- `target_higher` — the race-to game-win target for the *stronger* side (the higher-handicap-sum team).
- `target_lower` — the race-to game-win target for the *weaker* side.

The match ends when either side reaches its target; the side that reaches its target first wins.

**Lookup is range-based** (not exact). Each row defines a `[comp_1, comp_2]` inclusive range of handicap differences mapping to a single `(target_higher, target_lower)` pair. The lookup finds the row whose range contains the input difference. The current shipped table uses 7 buckets covering differences from 0 to 145+.

**Why ranges instead of exact rows.** The Percentage encoding (0–100) creates a much wider range of possible differences than the Points encoding's small integer span. Listing every possible exact difference would mean hundreds of rows with imperceptible gradations between neighbors. Bracketing into a handful of meaningful tiers is operator-readable and reflects how the calibration actually behaves (small changes in difference shouldn't change the targets).

**Why no ties.** 25 is odd. There's no symmetric tie configuration available, so the output shape is just the pair of race-to targets. The output has no `target_tie` field.

## When you'd use it / pros

- **Native fit for the [Percentage](../handicap-systems/percentage.md) handicap encoding** at 5-player team scope. The range-bucketed shape suits the wider numeric space Percentage produces.
- **Operator-readable bracket structure** — 7 rows, each labeled by a meaningful difference range. An LO can discuss tiers at a season meeting without enumerating every possible difference.
- **No-tie output simplifies downstream** — a clean race-to model where the [Win Calculator](../win-calculator.md) doesn't need a tie-resolution rule for the Chart's output.

## When you wouldn't / cons

- **Tied to the 5-player single-round-robin (25-game) match format.** A league with a different game-per-match count needs a different Chart.
- **Restricted to the Percentage encoding's range space.** Pairing with Points or FargoRate requires a different Chart or a [Converter](../../PRINCIPLES.md#converter--deep-dive).
- **Coarse-grained** — a difference of 41 and a difference of 66 produce the same targets even though one is 60% bigger. Operators wanting finer-grained tuning need a Chart with more buckets, or a formula-shaped variant.
- **No tie output** — a league running 5v5 that wants tie outcomes (e.g., for half-point standings rules) needs either a different output shape or a downstream rule to interpret tied terminal game counts.

## Interactions

- **Upstream:** consumes the team-aggregate difference produced by the [Percentage](../handicap-systems/percentage.md) Handicap System.
- **Consumed by:** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the 2-tuple and declares the asymmetric per-side race-to targets for the match.
- **Pairs with:** the [1-Point Scoring System](../points-system/one-point-scoring.md) (race-to-target style) where reaching the target ends the match in favor of that side.
- **Not directly pairable** with the [Points](../handicap-systems/points.md), [FargoRate](../handicap-systems/fargorate.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Percentage-equivalent difference. None exist today.

## Possible modifications

- **Bucket boundaries** — narrower or wider ranges per row (more buckets gives finer-grained tuning; fewer gives coarser tiers).
- **Bucket targets** — adjust the `(target_higher, target_lower)` pair per row to dial the competitive tightness up or down.
- **Bucket count** — add more rows for finer gradations or collapse to fewer rows for simpler tiers.
- **Add a tie column** — extend the output shape to `(target_higher, target_tie, target_lower)` if the league wants tie support (would require schema-level handling of the now-non-null `result_2`).
- **Round-trip caveat:** once an LO tweaks individual buckets away from any clean formula, the Chart is persisted as a stored table and can't be regenerated from a formula. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)

## Current code state

- **Stored Chart:** `chart_type = 'team_percentage'`, `lookup_mode = 'range'`. Default rows seeded in `supabase/migrations/20260410000003_seed_threshold_charts.sql`.
- **Schema:** `threshold_charts` + `threshold_chart_rows` (`comp_1` = range min, `comp_2` = range max, `result_1` = higher target, `result_3` = lower target, `result_2` = null) in `supabase/migrations/20260410000002_threshold_charts.sql`. The SQL `lookup_threshold()` function performs the cascade and bracket lookup.
- **Legacy hardcoded copy:** `src/utils/handicap/get5v5GamesNeeded.ts` — the same data structure embedded directly in TypeScript. Predates the `threshold_charts` table and is what the SQL seed was derived from.
- **Default-rows generator:** `getDefaultPercentageChartRows()` in `src/components/PercentageThresholdChartEditor.tsx` — UI-side source of the default rows when an LO copies the global Chart for per-league editing.
- **Consumer wiring:** the `bca5v5` SystemModule (`src/systems/bca5v5.ts`) currently calls the hardcoded TS chart directly. **Implementation artifact, not architectural intent** — step-2 work will lift the lookup out so the SystemModule queries the Module-level Chart selection per the league configuration.
