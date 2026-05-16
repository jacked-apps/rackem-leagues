---
title: 3v3 Games-Needed Chart (Variant)
date: 2026-05-16
status: active
audience: developer + AI sessions
---

# 3v3 Games-Needed Chart

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Reading this cold?** A threshold chart is a passive lookup table (or formula) that converts a handicap input into a concrete match-setup benchmark. This page describes the **3v3 Games-Needed Chart** variant: a discrete table that takes a team-aggregate handicap difference (Points encoding) and returns the per-side win/tie/lose game-win targets for an 18-game match. Other Chart variants exist (see the [Module README](README.md) for the full picture).

## What it is

A **discrete table**, looked up by **exact handicap difference**, that returns the target game-wins each side needs in an 18-game team match. The chart is calibrated for a **3-player lineup with double round-robin scheduling** (18 games total per match) where the handicap encoding is the [Points](../handicap-systems/points.md) (-2 to +2 integer) system.

**Picture this** (for the novice-explanation case): Team A's three players sum to +6 stronger than Team B's three players. You look up "+6" in the chart and it tells you: "Team A wins the match if they win at least 13 of the 18 games; if they win exactly 12, it's a tie; 11 or fewer and Team A loses the match." The chart turns the rating gap into a concrete scoreboard rule both teams play to.

## How it works / how it's calculated

**Input:** a single integer — the **signed handicap difference** at team-aggregate scope (home_handicap_sum − away_handicap_sum), in the range -12 to +12. Positive = home team is stronger; negative = home team is weaker.

**Output:** a 3-tuple of integers for the **home side**: `(target_win, target_tie, target_lose)`. Each value is a game-win count out of 18 total games.

- `target_win` — the minimum game wins for home to win the match outright.
- `target_tie` — the exact game wins for a tie. **May be null** at odd handicap differences where no symmetric tie configuration exists in 18 games.
- `target_lose` — the highest game wins where home still loses (i.e., the away side wins the match).

Away side's targets are the **complement** (18 − home target). The chart is centered on the home (or stronger) team; the symmetric away thresholds are derived, not stored.

**Lookup is exact** (not range-based). Every integer in the supported difference range has its own row; the lookup is a direct equality match on `comp_1` (handicap difference). If a difference falls outside the supported range, the lookup is undefined — the calling system either clamps to the range edge or rejects the configuration.

**Why the 3-tuple shape.** With 18 games (an even count), the natural midpoint allows a tie at exactly 9–9, and the surrounding thresholds shift by ±1 as the handicap difference grows. Even handicap differences allow a clean tie row; odd handicap differences leave no symmetric tie configuration, which is why `target_tie` is null at odd diffs.

## When you'd use it / pros

- **Native fit for the [Points](../handicap-systems/points.md) handicap encoding** at 3-player team scope. The integer-range output reads cleanly against integer player handicaps.
- **Operator-readable** — the chart is small (25-ish rows), inspectable, and easy to discuss at a season-setup meeting. An LO can point at a row and say "see, +6 means win at 13, tie at 12, lose at 11."
- **Discrete rows give the LO a place to tweak** — operators can adjust individual rows for their house rules without rewriting any formula.

## When you wouldn't / cons

- **Tied to the 3-player double-round-robin (18-game) match format.** A league with a different game-per-match count needs a different Chart with its own thresholds.
- **Restricted to the Points encoding's integer range.** Pairing with a finer-grained encoding (Percentage, FargoRate) requires either a different Chart or a [Converter](../../PRINCIPLES.md#converter--deep-dive).
- **No interpolation** — exact lookup means handicap differences outside the supported range have no answer. (A formula-shaped variant wouldn't have this constraint.)
- **The 3-tuple output is opinionated** — it bakes a tie-allowed match-decision into the Chart's output shape. A league that wants no-ties needs either a different output shape or a downstream rule that collapses ties.

## Interactions

- **Upstream:** consumes the team-aggregate difference produced by the [Points](../handicap-systems/points.md) Handicap System.
- **Consumed by:** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the 3-tuple and declares the asymmetric per-side win targets for the match.
- **Pairs with:** the [1-Point Scoring System](../points-system/one-point-scoring.md) (race-to-target style) where reaching the win-target ends the match in favor of that side.
- **Not directly pairable** with the [Percentage](../handicap-systems/percentage.md), [FargoRate](../handicap-systems/fargorate.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Points-equivalent integer difference. None exist today.

## Possible modifications

- **Row-level cell edits** — an LO can tweak individual `(target_win, target_tie, target_lose)` triples per handicap difference to match their league's competitive feel.
- **Range extension** — add rows for handicap differences beyond the current ±12 bounds if the league uses an extended Points scale.
- **Tie-row removal** — null out the `target_tie` column to force a no-ties chart (downstream needs a Win Calculator rule for the collapsed case).
- **Round-trip caveat:** once an LO edits individual cells away from any clean formula, the Chart is persisted as a stored table and can no longer be regenerated from a formula. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)

## Current code state

- **Stored Chart:** `chart_type = 'team_points'`, `lookup_mode = 'exact'`. Default rows seeded in `supabase/migrations/20260410000003_seed_threshold_charts.sql`.
- **Schema:** `threshold_charts` + `threshold_chart_rows` (`comp_1` = handicap diff, `result_1/2/3` = win/tie/lose targets) in `supabase/migrations/20260410000002_threshold_charts.sql`. The SQL `lookup_threshold()` function performs the cascade lookup.
- **Legacy hardcoded copy:** `src/utils/handicap/get3v3GamesNeeded.ts` (`HANDICAP_CHART_3V3` constant) — the same data structure embedded directly in TypeScript. Predates the `threshold_charts` table and is what the SQL seed was derived from.
- **Consumer wiring:** the `bca3v3` SystemModule (`src/systems/bca3v3.ts`) currently calls the hardcoded TS chart directly instead of querying the `threshold_charts` table. **Implementation artifact, not architectural intent** — step-2 work will lift the lookup out so the SystemModule queries the Module-level Chart selection per the league configuration.
