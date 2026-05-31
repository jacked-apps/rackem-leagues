---
title: Points Handicap
date: 2026-05-12
status: active
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Points Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Internally-Computed Rating**](README.md#internally-computed-ratings) (the app derives the rating from match history in the league's own database).

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **Points** variant: integer ratings -2 to +2, computed by the app from a player's win/loss history. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

An integer rating from **-2 to +2** representing player strength relative to a notional center (0 = average for the league). Higher numbers = stronger players. The 5-grade range is intentionally coarse — easy to assign qualitatively, easy to do mental math with at the table.

**Picture this** (for the novice-explanation case): a 5-grade skill scale where 0 is average for your league, +2 is your strongest players, and -2 is your weakest. Everyone falls on one of those five integers. When two teams meet, you sum each team's lineup ratings to get a team rating; the team-vs-team **difference** (e.g., team A is +3 over team B) is what the rest of the league system uses to balance the match. What that balancing actually looks like — more games for the stronger team to win? bonus starting points for the weaker team? a different race length? — is decided by **other Modules**, not by this one.

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

The team-level handicap is the sum of the active lineup's individual ratings. The match-level handicap is the **difference** between team sums — and *that is this variant's output*. What downstream Modules do with the difference (which mechanism applies it, which chart or formula maps it to a concrete in-match adjustment, how match victory is decided) is outside this variant. See [Interactions](#interactions) for the current shipping pairings.

## When you'd use it / pros

- **Small leagues** where players are well-known and an LO can assign ratings qualitatively without a long history requirement.
- **Operators who want simple, transparent integer math** — a +3 difference is easy to communicate to players, easy to look up, easy to reason about mentally.
- **3-person team play** where the small lineup makes coarse grades work cleanly.

## When you wouldn't / cons

- **Need granular fairness across a wide skill spread.** A 5-grade scale collapses real differences (a +2 player averaging 80% wins is treated identically to a +2 player averaging 95%). [FargoRate](fargorate.md) is more precise.
- **Want automated rating updates from cross-league or cross-region play.** Points ratings only see the league's own game history; players moving between regions reset to manual assignment.
- **Want self-service rating calibration.** Players cannot independently verify their Points rating — they trust the LO's assignment or the league's history-based computation.

## Interactions

- **Compatible with [`extra_games`](../handicap-mechanisms/extra-games.md) mechanism** (used by the [Points 3-Man](../../scoring-systems/points-3man.md) Scoring System).
- **No calibrated chart for [`start_points`](../handicap-mechanisms/start-points.md)** with Points handicap — the combination is allowed, but without a calibrated chart it would not produce sensible values.
- **Compatible with [1-Point Scoring System](../points-system/one-point-scoring.md)**.
- **Pairs with [3v3 games-needed chart](../threshold-charts/3v3-games-needed.md)**. Could pair with any threshold chart that consumes integer differences.

## Possible modifications

- **Different range** — `-3 to +3`, `-1 to +1` (the *reduced* variant exists today; uses `±1` cap)
- **Different chart granularity** — change which integer difference maps to which target wins
- **Computed-from-formula instead of LO-assigned** — auto-derive from prior season win-rate, a Fargo bucket, or a USAPL grade
- **Adjustable weeks-per-week assumption** — the 6-games/week assumption could be parameterized for non-standard schedules
