---
title: Skill Level Handicap (Reserved)
date: 2026-05-12
status: reserved
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Skill Level Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Externally-Sourced Rating**](README.md#externally-sourced-ratings) (APA computes the rating; the app could only import). **Reserved**: schema present, wizard card currently visible, **step 2 hides the wizard card** until a usable implementation lands.

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **Skill Level** variant: APA's national SL1–SL9 grade. The app does not currently support this variant operationally — schema is reserved for future. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

Integer grades on APA's **SL1–SL9** scale for 9-ball, per their [published Equalizer chart](https://poolplayers.com/equalizer/). For 8-ball, APA's main page references SL3-through-SL6 in examples without stating a definitive published range; operators commonly report 8-ball as SL2–SL7 in practice (no SL1, SL8, or SL9 in 8-ball). The encoding is widely recognized in U.S. league play. BCAPL has historically used various skill-level schemes at the local-chapter level, though CSI now mandates FargoRate for handicapped BCAPL World Championship divisions.

**Picture this** (for the novice-explanation case): APA grades each player on a 1–9 scale (8-ball uses a narrower subset, typically 2–7). A higher number means a stronger player. **All new players start at SL3** per APA's own rules — there is no sex-based or game-based difference in the starting grade. Their first match establishes the rating going forward; there is no waiting period. The algorithm and grade come from APA. Only APA can compute it; if our app supports this variant in the future, it would be by **manual entry** — players bring their APA-issued grade and the LO enters it.

## How it works / how it's calculated

**The APA algorithm is proprietary.** The app does not — and cannot — compute APA skill levels. What is publicly known from APA's [Equalizer page](https://poolplayers.com/equalizer/):

- The algorithm processes **weekly scoresheets, win/loss records, Higher Level Tournament performance**, plus **qualitative judgment by APA's Handicap Advisory Committees**. This last point is notable — APA's system has an explicit *human* component, unlike purely-algorithmic systems such as FargoRate.
- New players start at **SL3**. There is no waiting period: *"As a result of your first match, a skill level is established and reported for you"* (APA, [Equalizer](https://poolplayers.com/equalizer/)).
- The output is a grade in the **SL1–SL9** range (9-ball) or the narrower **SL2–SL7** range that operators report for 8-ball.

The Equalizer page does not publish the algorithm's specific input weighting, the volatility profile, or the input parameters (e.g., whether innings-per-game is a primary input — that's a commonly-cited operator characterization but not stated on the page). For authoritative material, see [APA's Equalizer page](https://poolplayers.com/equalizer/) and the [APA rulebook handicap section](https://rules.poolplayers.com/the-equalizer-handicap-system/). The app does not replicate, approximate, or synthesize APA's calculation — doing so would be wrong and would mislead users.

**For this app to support Skill Level operationally**, one of these would need to exist:

1. **Manual-entry mode** — the LO enters each player's APA-reported rating; the app stores and applies it but never computes it.
2. **External-source integration** — pulling ratings from APA's own systems (would require APA partnership; no current pathway).
3. **A calibrated locally-coined SL-like scheme** — internal grading not tied to APA. Would need its own name to avoid claiming APA conformance.

Until one of those exists, this variant is **reserved-but-hidden**.

## When you'd use it / pros

- **Operator wants to support players whose ratings come from APA** without forcing them onto a different scale.
- **Operator runs a BCAPL local-chapter division** that historically used an SL-style scheme.
- **Players already understand the SL1–SL9 vocabulary** and resist re-learning a new system.

## When you wouldn't / cons

- **You want automated rating computation.** Don't pick Skill Level — the app cannot compute SLs.
- **You want to report match results back to APA.** The app does **not** do this. Players' APA ratings are unaffected by play in this app.
- **You want CSI/BCAPL-grade national portability.** FargoRate is CSI's mandated choice for that.

## Required disclaimers (operator-facing, when revived)

When the wizard card is eventually un-hidden, operators selecting Skill Level **must** see:

- **(a)** The app does **not** compute APA handicaps. Ratings are entered manually.
- **(b)** Match results played in this app are **not** reported back to APA and do **not** affect any player's APA rating.

These are non-negotiable. Without them, operators may falsely believe results flow back to APA.

## Interactions

- **Theoretically compatible with [`race_length_adjustment`](../handicap-mechanisms/race-length-adjustment.md) mechanism** — APA's well-known "SL race chart" (e.g., SL7-vs-SL5 → 5-vs-3 race) is exactly this pattern. **No current shipping chart exists** for this combo in the app.
- **Compatible with [1-Point Scoring System](../points-system/one-point-scoring.md)** if a race-length-adjustment chart is added.
- **Not used by any shipping Scoring System** today.

## Possible modifications

N/A while reserved. When revived, the relevant modifications are:

- Choice of locally-calibrated chart for SL-vs-SL race lengths (if APA's chart isn't license-clear to embed).
- Manual-entry UX details (validation, optional history view, refresh prompts).
- Variant selection (APA SL1–SL9 vs a locally-coined N-grade scheme).

## Trigger to revive in app

Un-hide the wizard card when **any** of these is true:

- A manual-entry rating mode is built for `skill_level` (the simplest path).
- A locally-calibrated SL-vs-SL race-length chart is added (would also need confirming the variant page's mechanism+chart pairings hold up).
- A formal APA or BCAPL/CSI partnership commits to a calculation pathway.

Until then: reserved-but-hidden. Schema preserved. Step 2 is the boundary-marker, not the implementation.
