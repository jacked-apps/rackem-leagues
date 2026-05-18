---
title: Points Games-Needed Formula
date: 2026-05-17
status: active
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Points Games-Needed Formula

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Filename note.** This file is named `3v3-games-needed.md` for historical reasons. The formula it documents is universal across team sizes (parameterized by `game_count`); the team-size-implying filename is a leftover from before the formula was unified across team sizes. Renaming has been deferred to avoid breaking inbound links from other docs and code references. Future cleanup will rename it (likely to `points-games-needed.md`) once link rewrites across the codebase can be coordinated.

> **Reading this cold?** A threshold chart is a passive lookup (table OR formula) that converts a handicap input into a concrete match-setup benchmark. This page describes the **Points Games-Needed Formula** variant: a formula taking a team-aggregate handicap difference (Points encoding) and a match-night game count, returning the per-side asymmetric game-win targets. Universal across team sizes — works the same way whether the league is 3v3 (18 games), 4v4 (16 single round-robin or 32 double), 5v5 (25 or 50), or any other valid lineup_size × game_generation combination. Other Chart variants exist for other handicap encodings (Percentage, FargoRate); see the [Module README](README.md).

## What it is

A **formula-shape** Chart, evaluated by **passing the team-aggregate handicap difference and the match-night game count as inputs**, that returns the asymmetric per-side game-win target each side needs to win the match. The formula is the source of truth; any specific row table is a *projection* of the formula at a specific game count and is regenerable on demand.

**Historical naming note.** This variant was originally introduced as the "3v3 Games-Needed Chart" because pre-app pool leagues used printed discrete tables for 3v3 18-game DRR specifically — easier for humans to look up at a table-side meeting than to compute per-match. The discrete table form was the *practical* artifact; the underlying mathematical relationship between handicap difference, total games, and per-side targets is universal across match sizes. The Module retains the formula as the source of truth; printable tables are convenience projections.

**Picture this** (for the novice-explanation case): Team A's three players sum to +6 stronger than Team B's three players, and tonight's match has 18 games (3v3 DRR). You feed the formula `(diff=+6, game_count=18)` and it returns: "Team A needs at least 13 game-wins; Team B needs at least 7." Tomorrow night you operate a 5v5 SRR league (25 games) with the same Points encoding. Same formula, same handicap diff = +6, different game count: it returns updated targets calibrated for 25 games. The formula is one piece of math; it lives at the Chart layer; it never needs to be re-derived per team size.

## How it works / how it's calculated

**Inputs:**
- `handicap_diff` — single integer, signed: the **team-aggregate handicap difference** (home_handicap_sum − away_handicap_sum). Positive = home stronger; negative = home weaker.
- `game_count` — single positive integer: the **total games in this match night**, derived upstream from Team Geometry's `lineup_size × game_generation` multiplier (see [Team Geometry §Math](../team-geometry.md#math-game-count-derivation)).

**Output:** a 2-tuple of integers — `(target_stronger, target_weaker)`. The minimum game-win count for each side at the given `(diff, game_count)` pair. The stronger side typically needs MORE wins; the asymmetry implements the handicap.

**Lookup is computation, not table-row lookup.** Each call evaluates the formula against the supplied inputs. There is no row-by-row pre-computed table to consult at runtime; the formula computes on demand.

**Discrete-table deployment is equally first-class.** Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived), formulas and discrete tables are *interchangeable shapes* of the same Chart kind. A discrete table can be generated from the formula by enumerating `(diff, game_count)` pairs of interest — useful for printable scoresheets, operator-facing documentation, or LO-side audits. When the LO keeps the generated table as-is (no row-level edits), it remains *projected from the formula* and regenerates automatically when the formula's parameters change. When the LO edits specific rows away from the formula's output (house rules, preferred bucket boundaries), the table becomes a **per-league stored Chart** — a first-class deployment shape in its own right, persisted alongside the league rather than regenerated. Both shapes encode the same kind of mapping; neither is more "real" than the other. The formula is the **default** for new leagues; the LO-customized stored table is the **per-league** shape when edits diverge.

**Emergent unresolved configurations are downstream.** Depending on the handicap difference and the total game count, the asymmetric target pair MAY leave a middle band where neither side reaches its target (`target_stronger + target_weaker > game_count`). Whether that band exists is a property of the inputs and the formula's shape — the Chart simply produces the calibrated targets. What HAPPENS in the unresolved band (allow a tie, force a winner via secondary criteria, trigger overtime, etc.) is a [Win Calculator](../win-calculator.md) decision, NOT a Chart decision. The Chart's output contract intentionally does not encode tie semantics.

## When you'd use it / pros

- **Native fit for the [Points](../handicap-systems/points.md) handicap encoding** at any team-aggregate scope. The integer-range output reads cleanly against integer player handicaps.
- **Universal across team sizes.** One formula handles 3v3 (18 games), 4v4 SRR/DRR (16/32 games), 5v5 SRR/DRR (25/50 games), 6v6 SRR/DRR (36/72 games), and beyond. No per-team-size calibration needed.
- **Operator-readable when projected to a table.** An LO who prefers a printable cheat sheet can generate one from the formula for their specific game count and pin it to the scoresheet binder.
- **Single source of truth.** Formula changes propagate to every team size automatically; no risk of one team-size table drifting from another.

## When you wouldn't / cons

- **Restricted to the Points encoding's integer range.** Pairing with a finer-grained encoding (Percentage, FargoRate) requires either a different Chart variant or a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Points-equivalent integer difference.
- **No interpolation within a single handicap step.** Points handicap is integer-only (-2 to +2 in the default range); the formula produces targets only at integer `diff` values. Sub-integer handicap differences are not meaningful at this encoding.
- **Asymmetric targets may leave unresolved middle configurations** — depending on `(diff, game_count)`, the two targets may sum to more than the total game count, leaving a band where neither side hits its target. Resolving that band is a downstream [Win Calculator](../win-calculator.md) responsibility; an LO using this Chart needs to confirm their Win Calculator handles that case (tie, overtime, secondary criterion) in a way the league accepts.

## Interactions

- **Upstream:** consumes the team-aggregate difference produced by the [Points](../handicap-systems/points.md) Handicap System, and the `game_count` derived by [Team Geometry](../team-geometry.md) from `lineup_size` × `game_generation`.
- **Consumed by:** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the asymmetric target pair and declares the per-side win targets for the match.
- **Downstream Win Calculator dependency:** any league running this Chart must pair it with a [Win Calculator](../win-calculator.md) that handles the possible "neither side reached its target" configuration. The Chart produces the targets; the Win Calculator decides what the absence of either target being hit means.
- **Not directly pairable** with the [Percentage](../handicap-systems/percentage.md), [FargoRate](../handicap-systems/fargorate.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Points-equivalent integer difference.

## Possible modifications

- **LO-customized stored-table deployment.** An LO who generates a discrete table from the formula for printable distribution may keep it as-is (purely a printable projection of the formula) OR edit specific cells for their house rules (e.g., "for diff +3 at 18 games, I want target_stronger = 12 instead of 13"). When edits diverge from the formula's output, the chart **becomes a per-league stored Chart** — a first-class deployment shape that persists with the league. The locked [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived) covers the formula-and-table-as-interchangeable-shapes semantics. The Module supports both deployments transparently: a league configured with the formula calls it dynamically; a league configured with a stored table reads its rows directly. Switching between deployments at LO request is a simple persistence change.
- **Range extension.** The default Points encoding spans -2 to +2; reduced-strength variants span -1 to +1. Future encodings (e.g., a -3 to +3 extended Points range) would be supported by the same formula without modification — only the input domain widens.
- **Tighter or looser asymmetry per Points-unit.** A future LO-customization dial could scale the per-Points-unit gap between targets (e.g., "each Points-unit of diff shifts targets by 1.5 instead of 1"). That parameterization would extend the formula's signature with a `points_unit_multiplier` parameter; the Chart variant pair stays the same.
- **Per-handicap-system multipliers (strength dials).** Per [Handicap Systems README's Future possibilities](../handicap-systems/README.md#future-possibilities), strength dials (50% / 75% / 100% / 150%) would adjust the effective handicap diff *before* feeding the formula — scaling the asymmetry without changing the formula itself. The Chart receives a pre-scaled diff and proceeds normally.

## (Optional) Code references

*Supplementary pointers to one prior implementation that approximates this Chart's shape. Per [PRINCIPLES § 6](../../PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary), this section is illustrative only — the architectural definition is the prose above, independent of any specific code.*

- **A prior implementation stored this Chart as a discrete table calibrated specifically for 3v3 DRR's 18 games** (`src/utils/handicap/get3v3GamesNeeded.ts`, the seeded DB rows in `supabase/migrations/20260410000003_seed_threshold_charts.sql`). That implementation is the human-convenience artifact described above and is **not** the source of truth under the formula-first architecture this variant page now codifies. The Step-2 refactor replaces hardcoded table values with formula evaluation parameterized by `game_count`, removing the team-size-specific constraint baked into the prior implementation.
- A prior implementation also stored the Chart shape with a 3-column output (`result_1/2/3` interpreted as win/tie/lose), conflating downstream tie-handling into the Chart's storage. The architectural definition above intentionally narrows the Chart's output to the per-side target pair; tie / unresolved-band semantics belong to the [Win Calculator](../win-calculator.md), not the Chart.
- Other prior code pointers: `supabase/migrations/20260410000002_threshold_charts.sql` (table schema + `lookup_threshold()` SQL function), `src/utils/handicap/get3v3GamesNeeded.ts` (TypeScript hardcoded copy).
