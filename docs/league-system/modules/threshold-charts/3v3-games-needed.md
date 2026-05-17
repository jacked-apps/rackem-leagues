---
title: 3v3 Games-Needed Chart (Variant)
date: 2026-05-16
status: active
audience: developer + AI sessions
---

# 3v3 Games-Needed Chart

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Reading this cold?** A threshold chart is a passive lookup table (or formula) that converts a handicap input into a concrete match-setup benchmark. This page describes the **3v3 Games-Needed Chart** variant: a discrete table that takes a team-aggregate handicap difference (Points encoding) and returns the per-side asymmetric game-win targets for an 18-game match. Other Chart variants exist (see the [Module README](README.md) for the full picture).

## What it is

A **discrete table**, looked up by **exact handicap difference**, that returns the asymmetric per-side game-win target each side needs to win the match. The chart is calibrated for a **3-player lineup with double round-robin scheduling** (18 games total per match) where the handicap encoding is the [Points](../handicap-systems/points.md) (-2 to +2 integer) system.

**Picture this** (for the novice-explanation case): Team A's three players sum to +6 stronger than Team B's three players. You look up "+6" in the chart and it tells you: "Team A needs to win at least 13 games to win the match; Team B needs to win at least 7." The chart turns the rating gap into the asymmetric scoreboard rule both sides play to. Whether those two targets can both go unmet in the same match (creating an unresolved configuration the downstream Win Calculator must decide — tie, overtime, etc.) is a Win Calculator concern, not a Chart concern.

## How it works / how it's calculated

**Input:** a single integer — the **signed handicap difference** at team-aggregate scope (home_handicap_sum − away_handicap_sum). Positive = home team is stronger; negative = home team is weaker. Each integer value within the supported range has its own row.

**Output:** a 2-tuple of integers — `(target_stronger, target_weaker)`. Each value is the minimum game-win count for that side to win the match outright at the input handicap difference. The stronger side typically needs MORE wins than the weaker side; the asymmetry is what implements the handicap.

**Lookup is exact** (not range-based). Each row keys on `comp_1` (signed handicap difference) and returns the asymmetric target pair. If a difference falls outside the supported range, the lookup is undefined — the calling system either clamps to the range edge or rejects the configuration.

**Emergent unresolved configurations are downstream.** Depending on the handicap difference and the total game count, the asymmetric target pair MAY leave a middle band where neither side reaches its target (`target_stronger + target_weaker > total_games`). Whether that band exists is a property of the inputs and the table calibration — the Chart simply produces the calibrated targets. What HAPPENS in the unresolved band (allow a tie, force a winner via secondary criteria, trigger overtime, etc.) is a [Win Calculator](../win-calculator.md) decision, NOT a Chart decision. The Chart's output contract intentionally does not encode "tie semantics" — that would conflate Chart output with downstream win-determination policy.

## When you'd use it / pros

- **Native fit for the [Points](../handicap-systems/points.md) handicap encoding** at 3-player team scope. The integer-range output reads cleanly against integer player handicaps.
- **Operator-readable** — the chart is small (one row per supported handicap difference), inspectable, and easy to discuss at a season-setup meeting. An LO can point at a row and say "see, +6 means stronger side needs 13 wins, weaker side needs 7."
- **Discrete rows give the LO a place to tweak** — operators can adjust individual target pairs for their house rules without rewriting any formula.

## When you wouldn't / cons

- **Tied to the 3-player double-round-robin (18-game) match format.** A league with a different game-per-match count needs a different Chart with its own thresholds.
- **Restricted to the Points encoding's integer range.** Pairing with a finer-grained encoding (Percentage, FargoRate) requires either a different Chart or a [Converter](../../PRINCIPLES.md#converter--deep-dive).
- **No interpolation** — exact lookup means handicap differences outside the supported range have no answer. (A formula-shaped variant wouldn't have this constraint.)
- **Asymmetric targets may leave unresolved middle configurations** — depending on the row, the two targets may sum to more than the total game count, leaving a band where neither side hits its target. Resolving that band is a downstream [Win Calculator](../win-calculator.md) responsibility; an LO running this Chart needs to confirm their Win Calculator handles that case (tie, overtime, secondary criterion) in a way the league accepts.

## Interactions

- **Upstream:** consumes the team-aggregate difference produced by the [Points](../handicap-systems/points.md) Handicap System.
- **Consumed by:** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the asymmetric target pair and declares the per-side win targets for the match.
- **Downstream Win Calculator dependency:** any league running this Chart must pair it with a [Win Calculator](../win-calculator.md) that handles the possible "neither side reached its target" configuration. The Chart produces the targets; the Win Calculator decides what the absence of either target being hit means.
- **Not directly pairable** with the [Percentage](../handicap-systems/percentage.md), [FargoRate](../handicap-systems/fargorate.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Points-equivalent integer difference.

## Possible modifications

- **Row-level cell edits** — an LO can tweak the `(target_stronger, target_weaker)` pair for any handicap difference to match their league's competitive feel.
- **Range extension** — add rows for handicap differences beyond the current bounds if the league uses an extended Points scale.
- **Tighter or looser asymmetry** — adjust the gap between the two targets at each handicap difference; smaller gap = less aggressive handicap, larger gap = more aggressive.
- **Round-trip caveat:** once an LO edits individual rows away from any clean formula, the Chart is persisted as a stored table and can no longer be regenerated from a formula. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)

## (Optional) Code references

*Supplementary pointers to one prior implementation that approximates this Chart's shape. Per [PRINCIPLES § 6](../../PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary), this section is illustrative only — the architectural definition is the prose above, independent of any specific code.*

- A prior implementation stored this Chart shape with a 3-column output (`result_1/2/3` interpreted as win/tie/lose), conflating downstream tie-handling into the Chart's storage. The architectural definition above intentionally narrows the Chart's output to the per-side target pair; tie / unresolved-band semantics belong to the [Win Calculator](../win-calculator.md), not the Chart.
- Prior code pointers (for reference, not authority): `supabase/migrations/20260410000003_seed_threshold_charts.sql` (seed rows), `supabase/migrations/20260410000002_threshold_charts.sql` (table schema + `lookup_threshold()` SQL function), `src/utils/handicap/get3v3GamesNeeded.ts` (TypeScript hardcoded copy).
