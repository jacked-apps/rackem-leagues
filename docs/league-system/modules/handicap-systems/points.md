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

Each player carries a `points` rating. **New players start with a default starting handicap of `0`** (the middle of the scale). The LO can **optionally** override this default if they know the player from outside this league (e.g., from a different league the LO runs, or from regional tournament play).

The starting handicap holds for the first **~15 games** (about 3 weekly match nights for a 3v3 team). See the [Module README's Rating Confidence section](README.md#rating-confidence) for the cross-variant context — the same starting-window concept applies to all variants in different forms. Once a player has sufficient match history (≥15 games on file in the league), the formula takes over:

- `weeksPlayed = gamesPlayed / 6` (assumes 6 games/week — a 3v3 standard week)
- `rawHandicap = (wins − losses) / weeksPlayed`
- Round to the nearest integer, then **clamp to ±2** (or ±1 in the *reduced* variant — see below)

**About the *reduced* variant.** Clamping to `±1` instead of `±2` halves the handicap's impact. Use it for a middle ground between **full handicapping** ("level the playing field — even the weakest player has a real shot") and **no handicapping at all** ("pure skill — the better player wins"). With reduced, stronger players still spot weaker ones, but only half as much.

The reduced variant is one point on a broader **handicap-strength scaling** spectrum — FargoRate's LMS uses 50% / 75% / 100% / 150% (where 100% is the default and 150% is *stronger*, more equalizing). Today we ship **three** points along this spectrum:

- **0%** — `handicap_type='none'` at the Module level (no handicap system at all; Bronze/Silver/Platinum-tier self-sorting)
- **50%** — `handicap_variant='reduced'` within Points (this variant page)
- **100%** — `handicap_variant='standard'` within Points (the default)

The 0% case is achieved by *not using a handicap system at all* (a different `handicap_type` choice), not by configuring this variant. See the [Module README's Future Possibilities](README.md#future-possibilities) for the 75% and 150% LMS scaling factors we might add.

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

This handicap system shows up at two code layers, both used by the **Points 3-Man Division** (the LO-facing name for the bundle of choices that picks this system):

- **`standard_3v3`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 7 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='points'`, plus the values for the other 6 Modules).
- **`bca3v3`** (in `src/systems/bca3v3.ts`) is the **SystemModule key** — the runtime code object that does the rating math (validation, formula, threshold lookup).

The two layers connect via `handicap_type='points'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `bca3v3` SystemModule at runtime. Step 2 collapses both names into `points_3man` for consistency across layers.

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
