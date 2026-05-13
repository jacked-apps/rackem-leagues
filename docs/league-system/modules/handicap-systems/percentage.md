---
title: Percentage Handicap (Variant)
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# Percentage Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Internally-Computed Rating**](README.md#internally-computed-ratings) (the app derives the rating from match history in the league's own database).

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **Percentage** variant: a 0–100 win-rate, computed by the app from a player's own match history. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

A **0–100 win-rate percentage** representing the share of games a player wins over a rolling history window. Higher = stronger. The percentage IS the handicap value — it gets summed across the lineup, and the team-vs-team difference is this variant's *output* to downstream Modules.

**Picture this** (for the novice-explanation case): every player carries a number between 0 and 100 — their personal win-rate over recent games. A 75 means they win 75% of their games. Stronger players have higher numbers. Team handicap is the sum of the active lineup's percentages; the team-vs-team **difference** is what the rest of the league system uses to balance the match. What that balancing actually looks like (more games to win? bonus starting points? a different race length?) is decided by **other Modules**, not by this one.

## How it works / how it's calculated

Each player carries a `percentage` rating. **New players start with a default starting handicap of `40`** (slightly below middle). The LO can **optionally** override this default if they know the player from outside this league (e.g., from a different league the LO runs, or from regional tournament play).

The starting handicap holds for the first **~15 games** (about 3 weekly match nights for a 5v5 team). See the [Module README's Rating Confidence section](README.md#rating-confidence) for the cross-variant context — the same starting-window concept applies to all variants in different forms. Once a player has sufficient match history (≥15 games on file in the league):

- `winPercentage = (wins / gamesPlayed) × 100`
- Round to nearest integer, clamp to `0–100` (or `0–50` in the *reduced* variant, which halves the input first — see below)

**About the *reduced* variant.** Halving the input before clamping (`0–50` final range) cuts the handicap's impact in half. Use it for a middle ground between **full handicapping** ("level the playing field — even the weakest player has a real shot") and **no handicapping at all** ("pure skill — the better player wins"). With reduced, stronger players still spot weaker ones, but only half as much.

The reduced variant is one point on a broader **handicap-strength scaling** spectrum — FargoRate's LMS uses 50% / 75% / 100% / 150% (where 100% is the default and 150% is *stronger*, more equalizing). Today we ship **three** points along this spectrum:

- **0%** — `handicap_type='none'` at the Module level (no handicap system at all; Bronze/Silver/Platinum-tier self-sorting)
- **50%** — `handicap_variant='reduced'` within Percentage (this variant page)
- **100%** — `handicap_variant='standard'` within Percentage (the default)

The 0% case is achieved by *not using a handicap system at all* (a different `handicap_type` choice), not by configuring this variant. See the [Module README's Future Possibilities](README.md#future-possibilities) for the 75% and 150% LMS scaling factors we might add.

The team handicap is the sum of active-lineup ratings. The match-level difference between team sums is *this variant's output*. What downstream Modules do with the difference (which mechanism applies it, which chart or formula maps it to a concrete in-match adjustment, how match victory is decided) is outside this variant. See [Interactions](#interactions) for the current shipping pairings.

## Not the same as CSI's "Average Handicapping"

CSI's *LO Handbook 2020* (page 38) names a method called **Average Handicapping**: `total points / games`, where "points" are per-game scores from a 10-Point or 17-Point scoring system (e.g., averaging 7.3 out of 10). This Percentage variant is a *win-rate average* (binary wins divided by total games), not a *points-per-game average*. The two are structurally similar — both are averages — but the inputs and output ranges differ. Do not present this variant as "Average Handicapping" in operator-facing copy or in conversation with CSI; it is a coined system named **Percentage**, distinct from CSI's documented method.

## When you'd use it / pros

- **Granular fairness within a wide skill spread** — a 100-point scale separates players that a 5-grade Points scale would collapse together.
- **Operator wants a transparent "win rate is the handicap" model** — easy to explain to players ("you win X% of your games; your rating is X").
- **5-person team play** where the larger lineup smooths out the noise of any single player's percentage.

## When you wouldn't / cons

- **Cross-league comparability is broken.** A 75% rating in a Platinum division is not the same skill level as a 75% rating in a Bronze division. CSI explicitly flags this limitation for any average-based method (LO Handbook page 39).
- **Need sub-percentage precision.** Two players at 75% and 76% are nearly indistinguishable to the chart but might really be one rack apart per match. [FargoRate](fargorate.md) is more precise.
- **Want automated cross-league tracking.** Percentage only sees the league's own game history; players moving between regions reset to manual assignment.

## Interactions

- **Compatible with [`extra_games`](../handicap-mechanisms/extra-games.md) mechanism** (current usage in the [Percentage 5-Man Division](../../divisions/percentage-5man.md)).
- **No current chart for [`start_points`](../handicap-mechanisms/start-points.md)** with Percentage handicap.
- **Compatible with [1-Point Scoring System](../scoring-systems/one-point-scoring.md)**.
- **Pairs with [5v5 games-needed chart](../threshold-charts/5v5-games-needed.md)** today.

## Possible modifications

- **Different range** — the *reduced* variant uses `0–50` (input is `winPct / 2`)
- **Different chart granularity** — re-bucket which percentage spreads map to which threshold values
- **History-window adjustment** — currently uses up to 200 most-recent games; configurable per-league cap
- **Switch source from win-rate to true points-average** — would migrate this variant toward CSI's Average Handicapping (would need a different name and different chart)

## Current code state

This handicap system shows up at two code layers, both used by the **Percentage 5-Man Division** (the LO-facing name for the bundle of choices that picks this system):

- **`standard_5v5`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 7 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='percentage'`, plus the values for the other 6 Modules).
- **`bca5v5`** (in `src/systems/bca5v5.ts`) is the **SystemModule key** — the runtime code object that does the rating math (validation, formula, threshold lookup).

The two layers connect via `handicap_type='percentage'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `bca5v5` SystemModule at runtime. Step 2 collapses both names into `percentage_5man` for consistency across layers.

- Code anchors today: `src/systems/bca5v5.ts` (SystemModule); `src/utils/calculatePlayerHandicap.ts` (history-based computation, lines ~93–95); `src/utils/handicap/get5v5GamesNeeded.ts` (threshold chart lookup)
- DB: `'percentage'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:59`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target |
|---|---|
| `bca5v5.ts` (filename) | `percentage_5man.ts` |
| `bca5v5` (SystemModule key) | `percentage_5man` |
| `standard_5v5` (wizard preset key) | `percentage_5man` |

Same [BCA vs BCAPL rule](../../README.md#brand-naming) applies — the current `bca5v5` identifier is non-compliant with CSI's published name guidelines.
