---
title: FargoRate Handicap (Variant)
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# FargoRate Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Externally-Sourced Rating**](README.md#externally-sourced-ratings) (FargoRate, an external organization, computes the rating; the app imports it).

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **FargoRate** variant: a 100–850 national rating maintained by FargoRate (not by this app). Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

A player's **FargoRate** — an integer rating from **100 to 850** (effective range; the full FargoRate scale extends lower for beginners) maintained externally by FargoRate. Higher = stronger. This is the only variant in this Module whose name and computation come from a published external authority; CSI mandates FargoRate for BCAPL handicapped divisions per [their 2020 announcement](https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues).

**Picture this** (for the novice-explanation case): FargoRate is to pool what an ELO rating is to chess — a single national number that says how good you are. A 350 is a beginner; a 500 is a solid league player; a 700 is a tournament shark. The number lives at fargorate.com and updates automatically as a player plays rated events. Our app reads the number; it does not compute it.

## How it works / how it's calculated

The app **does not compute** FargoRate ratings. They are sourced externally:

1. **FargoRate API** (TODO — not yet integrated). When available, the app will call FargoRate's API with the player's linked Fargo ID and pull the current rating.
2. **Last match's stored handicap** (current behavior). The app reads the rating recorded in the most recent `match_lineups` row that includes the player. Marked `stale: true` so the UI can flag it (e.g., display "491*" rather than "491").
3. **No data** — returned as `null`. Display as "Unrated" or prompt manual entry.

For ratings calibration and updates, the authoritative source is FargoRate itself (`fargorate.com`). The app stores point-in-time values; updates flow through new lineups, not through a re-rating computation.

The team-level handicap is not a simple sum. FargoRate's published formula uses a *transformed* rating:

- `T_player = 2^(rating / 100)` — converts the rating to a relative-strength scalar
- Team `T_sum = sum of player T values`
- Match win-expectancy = `T_home_sum / (T_home_sum + T_away_sum)` — the probability the home team wins a head-to-head match between these specific lineups

**What the formula means in practice.** FargoRate is a **log-2 scale** of strength: every 100-point rating gap *doubles* the stronger player's odds.

| Rating gap | Odds ratio | Stronger wins ~X% of head-to-head games |
|---|---|---|
| 100 | 2:1 | 67% (~2/3) |
| 200 | 4:1 | 80% (~4/5) |
| 300 | 8:1 | 89% (~8/9) |
| 400 | 16:1 | 94% |

So a 500-vs-400 matchup → the 500 wins ~67% of head-to-head games. A 700-vs-400 matchup → the 700 wins ~89%. This is the same principle ELO uses for chess (just with different constants). The exponential transform is what makes the rating gap behave linearly in log-odds — a useful property when you're trying to design fair handicap mechanisms downstream.

The win-expectancy is *this variant's output* to downstream Modules. What downstream does with it — starting points for the weaker team, race-length adjustments per pairing, game targets per side, something else entirely — is decided by the chosen mechanism + chart + scoring combination, not by this variant. See [Interactions](#interactions) for the current shipping pairings.

## When you'd use it / pros

- **Most accurate handicap available.** CSI's own assessment: "regardless of how well other methods may have worked in the past, FargoRate is better. We say that with total confidence" (LO Handbook 2020, p.39).
- **Cross-league / cross-region comparability.** A 491 in Florida is the same skill level as a 491 in Oregon, because FargoRate maintains a single global rating pool.
- **Automatic updates between sessions.** Players can play tournaments outside league nights and their rating evolves; the league benefits from that without LO intervention.
- **Required for BCAPL Handicapped World Championship divisions** — operators planning to advance teams to BCAPL events generally need Fargo.

## When you wouldn't / cons

- **Players must have a FargoRate.** New players or players from non-Fargo regions need ratings established (FargoRate provides paths, but it is friction).
- **External dependency.** Rating logic lives at FargoRate. If FargoRate's API changes or their methodology shifts, the league has no local control.
- **API access has cost and friction** for app integration (the current TODO state).
- **Less transparent to players** than a "you win 75% of your games" percentage. Some players resist a number whose computation they can't fully audit.

## Interactions

- **Compatible with [`start_points`](../handicap-mechanisms/start-points.md) mechanism** (current usage in the [FargoRate 10-Point 5-Man](../../scoring-systems/fargo-10pt-5man.md) Scoring System).
- **Compatible with [10-Point Scoring System](../points-system/ten-point-scoring.md)** — CSI's published Fargo+10-Point combo is the most prominent BCAPL handicapped configuration today.
- **Could also pair with [1-Point Scoring System](../points-system/one-point-scoring.md)** (CSI has signaled future "FargoRate + Race-To" Scoring Systems — see the strategic brainstorm `modular-league-system-requirements.md`).
- **Compatible with [`race_length_adjustment`](../handicap-mechanisms/race-length-adjustment.md) mechanism** in theory; no current shipping configuration uses this combo.
- **Pairs with [Fargo formula chart](../threshold-charts/fargo-formula.md)** today.

## Possible modifications

The FargoRate rating itself is locked to FargoRate's spec — no in-variant modifications to the rating mechanism. Modifications are at the *application* layer (mechanism, chart, scoring), not within this variant.

## Current code state

This handicap system shows up at two code layers, both used by the **FargoRate 10-Point 5-Man** prepackaged Scoring System (the LO-facing name for the bundle of choices that picks this system):

- **`fargo_5v5`** (in `src/wizards/league-v2/presetMappings.ts`) is the **wizard preset key** — the LO-facing "bundle" of 9 Module choices that gets picked during league creation. The preset expands into preferences (`handicap_type='fargo'`, plus the values for the other 8 Modules).
- **`fargo5v5`** (in `src/systems/fargo5v5.ts`) is the **SystemModule key** — the runtime code object that does the rating handling (validation, the `2^(rating/100)` transform, the win-expectancy computation, plus — for the current shipping pairing — start-points math).

The two layers connect via `handicap_type='fargo'`: the wizard preset sets the preference; `src/systems/resolver.ts` (lines 42–55) then maps that preference back to the `fargo5v5` SystemModule at runtime. Step 2 collapses both names into `fargo_10pt_5man` for consistency across layers.

**Implementation-vs-intent flag:** the `fargo5v5` SystemModule today bundles rating-system math (validation, transform, win-expectancy) AND start-points math in one file. The start-points portion is a **Handicap Mechanism concern**, not a rating-system concern, and the bundling is an accident of how the code grew before modular axes were fully separated. This is an **implementation artifact, not architectural intent**: any rating encoding should be composable with any mechanism. Future refactors should decouple to keep the rating variant clean and allow FargoRate to pair with mechanisms other than start_points (e.g., a future FargoRate + Race-To Scoring System using `extra_games`). See the [Module README → Boundary](README.md#boundary) for the orthogonality intent.

- Code anchors today: `src/systems/fargo5v5.ts` (SystemModule — rating validation, `2^(rating/100)` transform, start-points formula); `src/utils/calculatePlayerHandicap.ts:110+` (`calculateFargoHandicap` three-step fallback); `src/utils/handicap/fargoGamesWonThresholds.ts` (formula chart)
- DB: `'fargo'` allowed value in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:60`)
- Wizard card: `src/wizards/league-v2/steps/HandicapSystemStep.tsx`
- Calibration: see `docs/research/fargo-games-won-threshold.md` and `docs/research/fargorate-formula.md` for the formula derivation against FargoRate's published HOT race chart

**Step 2 rename targets** (tentative — to be confirmed in step-2's plan):

| Current | Step-2 target |
|---|---|
| `fargo5v5.ts` (filename) | `fargo_10pt_5man.ts` |
| `fargo5v5` (SystemModule key) | `fargo_10pt_5man` |
| `fargo_5v5` (wizard preset key) | `fargo_10pt_5man` |

The new name `fargo_10pt_5man` makes the bundled choices explicit: FargoRate handicap **+** 10-Point Scoring **+** 5-Man lineup. This anticipates a future second Fargo Scoring System (e.g., `fargo_1pt_5man` for the Race-To variant) where the disambiguation matters.
