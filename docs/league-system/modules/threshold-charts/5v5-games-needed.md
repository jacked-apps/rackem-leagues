---
title: Percentage Games-Needed Formula (Variant)
date: 2026-05-17
status: active
audience: developer + AI sessions
---

# Percentage Games-Needed Formula

A peer variant of the **[Threshold Charts](README.md)** Module — a [Chart](../../PRINCIPLES.md#chart--deep-dive)-kind Module.

> **Filename note.** This file is named `5v5-games-needed.md` for historical reasons. The formula it documents is universal across team sizes (parameterized by `game_count`); the team-size-implying filename is a leftover from before the formula was unified across team sizes. Renaming has been deferred to avoid breaking inbound links from other docs and code references. Future cleanup will rename it (likely to `percentage-games-needed.md`) once link rewrites across the codebase can be coordinated.

> **Reading this cold?** A threshold chart is a passive lookup (table OR formula) that converts a handicap input into a concrete match-setup benchmark. This page describes the **Percentage Games-Needed Formula** variant: a formula taking a team-aggregate handicap difference (Percentage encoding) and a match-night game count, returning the per-side asymmetric game-win targets. Universal across team sizes — works the same way whether the league is 3v3 (18 games DRR or 9 games SRR), 4v4 (16 or 32), 5v5 (25 or 50), 6v6 (36 or 72), or any other valid lineup_size × game_generation combination. Other Chart variants exist for other handicap encodings ([Points](../handicap-systems/points.md), [FargoRate](../handicap-systems/fargorate.md)); see the [Module README](README.md).

## What it is

A **formula-shape** Chart, evaluated by **passing the team-aggregate handicap difference and the match-night game count as inputs**, that returns the asymmetric per-side game-win target each side needs to win the match. The formula is the source of truth; any specific row table is a *projection* of the formula at a specific game count and is regenerable on demand.

**Historical naming note.** This variant was originally introduced as the "5v5 Games-Needed Chart" because BCAPL's published Standard Handicap System chart was specifically calibrated for 8-man teams playing 5v5 single round-robin (25 games per match). The discrete 7-bucket lookup table was BCAPL's printed artifact — easier for humans to look up at a table-side meeting than to compute per-match. The underlying mathematical pattern relating handicap difference, total games, and per-side targets is universal across match sizes. The Module retains the formula as the source of truth; printable tables are convenience projections of the formula at specific game counts.

**Picture this** (for the novice-explanation case): Team A's five players sum to 276 percentage points; Team B's five sum to 260. Diff = +16. Tonight's match is 25 games (5v5 SRR). You feed the formula `(diff=+16, game_count=25)` and it returns: "Team A (higher percentage sum) needs 14 game-wins; Team B needs 12." Tomorrow night you operate a 4v4 SRR league (16 games) with the same Percentage encoding. Same formula, different game count: it returns updated targets calibrated for 16 games — appropriately scaled bucket widths and target shifts. The formula is one piece of math; it lives at the Chart layer; it never needs to be re-derived per team size.

## How it works / how it's calculated

**Inputs:**
- `handicap_diff` — single integer, signed: the **team-aggregate handicap difference** (home_handicap_sum − away_handicap_sum) where each player's handicap is a 0–100 win-percentage value and the team's handicap is the sum across all active players. Positive = home stronger; negative = home weaker.
- `game_count` — single positive integer: the **total games in this match night**, derived upstream from Team Geometry's `lineup_size × game_generation` multiplier (see [Team Geometry §Math](../team-geometry.md#math-game-count-derivation)).

**Output:** a 2-tuple of integers — `(target_stronger, target_weaker)`. The minimum game-win count for each side at the given `(diff, game_count)` pair. The stronger side typically needs MORE wins; the asymmetry implements the handicap.

**Lookup is computation, not table-row lookup.** Each call evaluates the formula against the supplied inputs. There is no row-by-row pre-computed table to consult at runtime; the formula computes on demand.

**The formula's structure** (parameterized by game_count):

```
half             = ⌊game_count / 2⌋
target_stronger_base = half + (1 if game_count is even else 0)
target_weaker_base   = half + (1 if game_count is odd  else 0)
                       /* equivalent: ⌈(game_count+1)/2⌉ and ⌊(game_count+1)/2⌋ */

bucket_width     = game_count + 1
first_bucket_end = ⌊bucket_width / 2⌋ + 1
offset           = bucket_width - first_bucket_end - 1
max_gap_level    = ⌊(game_count - 1) / 4⌋                     /* how many bucket levels of asymmetry past the tied midpoint */
gap_cap          = max_gap_level × bucket_width - offset      /* input cap: diffs at or beyond this all land in the most-asymmetric bucket */

effective_diff   = min( |diff|, gap_cap )                     /* clamp at the input — past gap_cap, asymmetry can't grow further */
gap_level        = ⌊(effective_diff + offset) / bucket_width⌋
target_stronger  = target_stronger_base + gap_level
target_weaker    = target_weaker_base   - gap_level
```

The cap is built into the formula at the input stage rather than bolted on as a post-hoc clamp of the output. Past `gap_cap`, additional handicap difference simply doesn't translate to additional asymmetry — the strongest team still doesn't need to win every game, the weakest team still doesn't need to win zero. Fairness is structural, not a guard.

**Discrete-table deployment is equally first-class.** Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived), formulas and discrete tables are *interchangeable shapes* of the same Chart kind. A discrete table can be generated from the formula by enumerating `(diff, game_count)` pairs of interest — useful for printable scoresheets, operator-facing documentation, or LO-side audits. When the LO keeps the generated table as-is (no row-level edits), it remains *projected from the formula* and regenerates automatically when the formula's parameters change. When the LO edits specific rows away from the formula's output (house rules, preferred bucket boundaries), the table becomes a **per-league stored Chart** — a first-class deployment shape in its own right, persisted alongside the league rather than regenerated. Both shapes encode the same kind of mapping; neither is more "real" than the other. The formula is the **default** for new leagues; the LO-customized stored table is the **per-league** shape when edits diverge. The original BCAPL 7-bucket lookup table is a concrete example: it's the per-league shape for any league that wants to use BCAPL's specific calibrated values verbatim, equally valid as a Chart deployment as the formula evaluation that produces those same values.

**Parity-driven tie behavior.**
- **Odd game_count:** target_stronger_base = target_weaker_base (both equal). At diff=0 the chart returns the same target for both teams — race mode, no tie possible because the per-team targets sum to `game_count + 1` which exceeds the games available.
- **Even game_count:** target_stronger_base = half+1 and target_weaker_base = half. At diff=0 the chart returns a 1-gap pair (e.g., 10/9 for 18 games). The midpoint outcome (half wins for both teams) lands both teams in the locked tie-band rule's range — tie at the natural midpoint. The downstream [Win Calculator](../win-calculator.md) walks its metric precedence stack; if all metrics tie out, the [Tiebreak System](../tiebreak-system/README.md) chain fires to produce an edge metric.

**Calibration constants.** Unlike the [FargoRate Formula](fargo-formula.md) Chart (which derives from FargoRate's first-principles win-expectancy math), this formula is **fitted to BCAPL's published 5v5 chart** at game_count=25. The constants — `bucket_width = game_count + 1`, `first_bucket_end = ⌊bucket_width/2⌋ + 1`, `max_gap_level = ⌊(game_count − 1) / 4⌋`, and the derived `gap_cap` (the input cap) — are chosen so the formula reproduces BCAPL's 7-bucket lookup table exactly when game_count=25 (gap_cap = 145, max_gap_level = 6). Extending to other game counts scales these constants by game_count; the extrapolation pattern is honest ("BCAPL-style extended") rather than "official BCAPL for that team size" (BCAPL does not publish charts for non-5v5 formats — see [§When you wouldn't / cons](#when-you-wouldnt--cons)).

**Verification against BCAPL 5v5 (game_count=25):** the formula's bucket boundaries (0, 15, 41, 67, 93, 119, 145) and per-bucket targets (13/13, 14/12, 15/11, 16/10, 17/9, 18/8, 19/7) match BCAPL's published Standard Handicap System chart row-for-row.

**Emergent unresolved configurations are downstream.** Depending on the handicap difference and the total game count, the asymmetric target pair MAY leave a middle band where neither side reaches its target. Whether that band exists is a property of the inputs and the formula's shape — the Chart simply produces the calibrated targets. What HAPPENS in the unresolved band (allow a tie, force a winner via secondary criteria, trigger overtime, etc.) is a [Win Calculator](../win-calculator.md) decision, NOT a Chart decision.

## When you'd use it / pros

- **Native fit for the [Percentage](../handicap-systems/percentage.md) handicap encoding** at any team-aggregate scope. The wider numeric range of Percentage (per-player 0–100, team sums commonly 200–600) is naturally handled by the formula's bucket-scaled gap growth.
- **Universal across team sizes.** One formula handles 3v3 (9 SRR or 18 DRR), 4v4 (16 or 32), 5v5 (25 or 50), 6v6 (36 or 72), and beyond. No per-team-size calibration needed; bucket_width and gap_cap scale with game_count automatically.
- **Reproduces BCAPL's published 5v5 chart exactly.** When game_count=25, every formula output matches the BCAPL Standard Handicap System chart row-for-row.
- **Operator-readable when projected to a table.** An LO who prefers a printable cheat sheet can generate one from the formula for their specific game count and pin it to the scoresheet binder.
- **Single source of truth.** Formula changes propagate to every team size automatically; no risk of one team-size table drifting from another.
- **Parity-aware tie semantics.** Even game counts naturally produce a 1-wide tie band (allowing midpoint ties to be detected and routed to the [Tiebreak System](../tiebreak-system/README.md) chain via Win Calculator); odd game counts collapse to race mode (no ties possible).

## When you wouldn't / cons

- **Restricted to the Percentage encoding's numeric range.** Pairing with [Points](../handicap-systems/points.md) (-2 to +2 integer), [FargoRate](../handicap-systems/fargorate.md) (100–850), or [Skill Level](../handicap-systems/skill-level.md) (1–9) encodings requires either a different Chart variant or a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Percentage-equivalent difference.
- **Calibration is BCAPL-fitted, not first-principles.** Unlike the FargoRate Formula (which has the `2^(rating/100)` win-probability math behind it), this formula's bucket_width and calibration constants are chosen to reproduce BCAPL's empirical 5v5 chart. The extrapolation to other team sizes uses game_count as the scaler; the pattern is honest but not "official BCAPL" for non-5v5 formats. BCAPL itself does not publish charts for non-5v5 team sizes — for those, CSI delegates to the [FargoRate League Handicap Calculator](https://leaguecalc.fargorate.com/) rather than maintaining static charts.
- **Asymmetric targets may leave unresolved middle configurations** — depending on `(diff, game_count)`, the two targets may sum to more than the total game count, leaving outcomes where neither side hits its target. Resolving that band is a downstream [Win Calculator](../win-calculator.md) responsibility (via its metric precedence stack and, if configured, the [Tiebreak System](../tiebreak-system/README.md) chain trigger). An LO using this Chart needs to confirm Win Calc's configuration handles that case (tie stands, secondary metric breaks it, or tiebreak chain fires) in a way the league accepts.
- **No interpolation within a bucket.** Inside a single bucket, all handicap diffs produce the same target pair. An LO wanting finer-grained tuning at specific diff values would need to override the formula's calibration constants or store an LO-customized discrete table per [§Possible modifications](#possible-modifications).

## Interactions

- **Upstream:** consumes the team-aggregate difference produced by the [Percentage](../handicap-systems/percentage.md) Handicap System, and the `game_count` derived by [Team Geometry](../team-geometry.md) from `lineup_size` × `game_generation`.
- **Consumed by:** the [Extra Games](../handicap-mechanisms/extra-games.md) Handicap Mechanism, which reads the asymmetric target pair and declares the per-side win targets for the match.
- **Downstream Win Calculator dependency:** any league running this Chart must pair it with a [Win Calculator](../win-calculator.md) that handles the possible "neither side reached its target" configuration. The Chart produces the targets; the Win Calculator decides what the absence of either target being hit means.
- **Downstream tie-handling dependency for even game counts:** when game_count is even and the chart's 1-wide tie band is reachable, a midpoint outcome (`game_count/2, game_count/2`) produces a tie that [Win Calculator](../win-calculator.md)'s metric stack resolves (next metric in precedence, or the [Tiebreak System](../tiebreak-system/README.md) chain producing edge). Odd game counts have no reachable tie outcome.
- **Not directly pairable** with the [Points](../handicap-systems/points.md), [FargoRate](../handicap-systems/fargorate.md), or [Skill Level](../handicap-systems/skill-level.md) encodings without a [Converter](../../PRINCIPLES.md#converter--deep-dive) into a Percentage-equivalent difference. None exist today.

## Possible modifications

- **LO-customized stored-table deployment.** An LO who generates a discrete table from the formula for printable distribution may keep it as-is (purely a printable projection of the formula) OR edit specific cells for their house rules (e.g., "for diff +50 at 25 games, I want target_stronger = 16 instead of 15"). When edits diverge from the formula's output, the chart **becomes a per-league stored Chart** — a first-class deployment shape that persists with the league. The locked [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived) covers the formula-and-table-as-interchangeable-shapes semantics. The Module supports both deployments transparently: a league configured with the formula calls it dynamically; a league configured with a stored table reads its rows directly. Switching between deployments at LO request is a simple persistence change.
- **Calibration-constant tuning.** The two BCAPL-fitted constants — `first_bucket_end` (how wide the "essentially even" first bucket is) and `gap_cap` (how lopsided the chart is allowed to get at extreme diffs) — could be exposed as LO-configurable parameters. A league wanting a smaller "we're calling it even" zone could reduce `first_bucket_end`; a league wanting more aggressive handicap caps could lower `gap_cap`. Defaults reproduce BCAPL's 5v5 calibration.
- **Bucket-width tuning.** The default `bucket_width = game_count + 1` matches BCAPL's pattern. An LO who wants finer-grained handicap response could halve the bucket width (more rows, smaller gap-growth steps); coarser response goes the other way. Trade-off: finer buckets = more handicap responsiveness vs. coarser buckets = more operator-readable rounding.
- **Per-handicap-system multipliers (strength dials).** Per [Handicap Systems README's Future possibilities](../handicap-systems/README.md#future-possibilities), strength dials (50% / 75% / 100% / 150%) would adjust the effective handicap diff *before* feeding the formula — scaling the asymmetry without changing the formula itself. The Chart receives a pre-scaled diff and proceeds normally.
- **Range extension or boundary refinement.** The default range covers Percentage diffs typically encountered in 4–6 player team sums. Leagues with unusual roster scales (very small or very large teams) may need to refine the gap_cap boundary to keep extreme-diff matches sensible.

## (Optional) Code references

*Supplementary pointers to one prior implementation that approximates this Chart's shape. Per [PRINCIPLES § 6](../../PRINCIPLES.md#6-docs-are-stand-alone-code-references-are-supplementary), this section is illustrative only — the architectural definition is the prose above, independent of any specific code.*

- **A prior implementation stored this Chart as a discrete 7-bucket range table calibrated specifically for 5v5 SRR's 25 games** (`src/utils/handicap/get5v5GamesNeeded.ts`, the seeded DB rows in `supabase/migrations/20260410000003_seed_threshold_charts.sql`). That implementation is the human-convenience artifact described above and is **not** the source of truth under the formula-first architecture this variant page now codifies. The Step-2 refactor replaces hardcoded bucket values with formula evaluation parameterized by `game_count`, removing the team-size-specific constraint baked into the prior implementation.
- **The original calibration source:** `docs/BCA_HANDICAP_SYSTEM.md` — describes BCAPL's published Standard Handicap System chart, "Validated from actual league scoring sheet." The 7-bucket table the prior implementation transcribed comes from BCAPL's printed materials for the 8-man / 5v5 format.
- A prior implementation also stored the Chart shape with a 3-column output (`result_1/2/3` interpreted as win/tie/lose), conflating downstream tie-handling into the Chart's storage. The architectural definition above intentionally narrows the Chart's output to the per-side target pair; tie / unresolved-band semantics belong to the [Win Calculator](../win-calculator.md), not the Chart.
- Other prior code pointers: `supabase/migrations/20260410000002_threshold_charts.sql` (table schema + `lookup_threshold()` SQL function).
