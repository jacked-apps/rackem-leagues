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

A **0–100 win-rate percentage** representing the share of games a player wins over a rolling history window. Higher = stronger. The percentage IS the handicap value — it gets summed across the lineup and the team-vs-team difference feeds the threshold chart.

**Picture this** (for the novice-explanation case): every player carries a number between 0 and 100 — their personal win-rate over recent games. A 75 means they win 75% of their games. Stronger players have higher numbers. Team handicap is the sum of the active lineup's percentages; the team-vs-team difference feeds a chart that yields per-team target wins.

## How it works / how it's calculated

Each player carries a `percentage` rating. For pickup matches without history, an LO assigns it manually. For players with sufficient game history (≥15 games on file in the league):

- `winPercentage = (wins / gamesPlayed) × 100`
- Round to nearest integer, clamp to `0–100` (or `0–50` in the *reduced* variant, which halves the input first)

The team handicap is the sum of active-lineup ratings. The match-level difference between team sums is fed to a [threshold chart](../threshold-charts/5v5-games-needed.md) that yields per-team target wins.

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
- **Compatible with [1-Point Scoring System](../scoring-systems/one-point-scoring.md)** (the Race-To wins-only model).
- **Pairs with [5v5 games-needed chart](../threshold-charts/5v5-games-needed.md)** today.

## Possible modifications

- **Different range** — the *reduced* variant uses `0–50` (input is `winPct / 2`)
- **Different chart granularity** — re-bucket which percentage spreads map to which target wins
- **History-window adjustment** — currently uses up to 200 most-recent games; configurable per-league cap
- **Switch source from win-rate to true points-average** — would migrate this variant toward CSI's Average Handicapping (would need a different name and different chart)

## Current code state

Used by the **`standard_5v5`** wizard preset (a.k.a. **Percentage 5-Man Division**). Implemented as the `bca5v5` SystemModule.

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
