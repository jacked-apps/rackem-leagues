---
title: Points Handicap (Variant)
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# Points Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Internally-Computed Rating**](README.md#internally-computed-ratings) (the app derives the rating from match history in the league's own database).

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **Points** variant: integer ratings -2 to +2, computed by the app from a player's win/loss history. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

An integer rating from **-2 to +2** representing player strength relative to a notional center (0 = average for the league). Higher numbers = stronger players. The 5-grade range is intentionally coarse — easy to assign qualitatively, easy to do mental math with at the table.

**Picture this** (for the novice-explanation case): a 5-grade skill scale where 0 is average for your league, +2 is your strongest players, and -2 is your weakest. Everyone falls on one of those five integers. When two teams meet, you sum each team's lineup ratings; the difference (e.g., team A is +3 over team B) tells a chart how many games each side needs to win for a fair match.

## How it works / how it's calculated

Each player carries a `points` rating. For pickup matches without history, an LO assigns the rating manually. For players with sufficient game history (≥15 games on file in the league), the system computes:

- `weeksPlayed = gamesPlayed / 6` (assumes 6 games/week — a 3v3 standard week)
- `rawHandicap = (wins − losses) / weeksPlayed`
- Round to the nearest integer, then **clamp to ±2** (or ±1 in the *reduced* variant)

The team-level handicap is a sum of the active lineup's individual ratings. The match-level handicap is the **difference** between team sums; that difference is fed to a [threshold chart](../threshold-charts/3v3-games-needed.md) which yields per-team target wins.

## When you'd use it / pros

- **Small leagues** where players are well-known and an LO can assign ratings qualitatively without a long history requirement.
- **Operators who want simple, transparent integer math** — handing a team "+3 difference → race to X" without a calculator.
- **3-person team play** where the small lineup makes coarse grades work cleanly.

## When you wouldn't / cons

- **Need granular fairness across a wide skill spread.** A 5-grade scale collapses real differences (a +2 player averaging 80% wins is treated identically to a +2 player averaging 95%). [FargoRate](fargorate.md) is more precise.
- **Want automated rating updates from cross-league or cross-region play.** Points ratings only see the league's own game history; players moving between regions reset to manual assignment.
- **Want self-service rating calibration.** Players cannot independently verify their Points rating — they trust the LO's assignment or the league's history-based computation.

## Interactions

- **Compatible with [`extra_games`](../handicap-mechanisms/extra-games.md) mechanism** (current usage in the [Points 3-Man Division](../../divisions/points-3man.md)).
- **No current chart for [`start_points`](../handicap-mechanisms/start-points.md)** with Points handicap — combination is not blocked at the schema level but no calibrated chart exists, so it would not produce sensible values.
- **Compatible with [1-Point Scoring System](../scoring-systems/one-point-scoring.md)** (the Race-To wins-only model).
- **Pairs with [3v3 games-needed chart](../threshold-charts/3v3-games-needed.md)** today; could pair with any chart that maps integer differences to game targets.

## Possible modifications

- **Different range** — `-3 to +3`, `-1 to +1` (the *reduced* variant exists today; uses `±1` cap)
- **Different chart granularity** — change which integer difference maps to which target wins
- **Computed-from-formula instead of LO-assigned** — auto-derive from prior season win-rate, a Fargo bucket, or a USAPL grade
- **Adjustable weeks-per-week assumption** — currently hardcoded to 6 games/week; an LO could parameterize for non-standard schedules

## Current code state

Used by the **`standard_3v3`** wizard preset (a.k.a. **Points 3-Man Division**). Implemented as the `bca3v3` SystemModule.

- Code anchors today: `src/systems/bca3v3.ts` (SystemModule); `src/utils/calculatePlayerHandicap.ts` (history-based computation, lines ~78–90); `src/utils/handicap/get3v3GamesNeeded.ts` (threshold chart lookup)
- DB: `'points'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:58`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target | Reason |
|---|---|---|
| `bca3v3.ts` (filename) | `points_3man.ts` (snake_case per repo precedent) | "BCA" alone is incorrect per [BCA vs BCAPL rule](../../README.md#brand-naming) |
| `bca3v3` (SystemModule key) | `points_3man` | Same |
| `standard_3v3` (wizard preset key) | `points_3man` | Names the actual handicap system + lineup size |

CSI's *BCA Pool League Operators' Handbook* (June 2020, p.41 "Name Guidelines") explicitly states "BCA" alone is an incorrect reference — only "BCAPL" or "BCA Pool League" are valid. The current `bca3v3` identifiers literally violate CSI's published guidance, independently of the also-true motivation that the new names better describe what each Division is.
