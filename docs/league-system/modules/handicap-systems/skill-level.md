---
title: Skill Level Handicap (Reserved Variant)
date: 2026-05-12
status: reserved
audience: developer + AI sessions
---

# Skill Level Handicap

A peer variant of the **[Handicap Systems](README.md)** Module — specifically an [**Externally-Sourced Rating**](README.md#externally-sourced-ratings) (APA computes the rating; the app could only import). **Reserved**: schema present, wizard card currently visible, **step 2 hides the wizard card** until a usable implementation lands.

> **Reading this cold?** A handicap system encodes how strong a player is — as a number or grade — so the league can fairly match uneven players. This page describes the **Skill Level** variant: APA's national SL1–SL9 grade. The app does not currently support this variant operationally — schema is reserved for future. Other variants exist (see the [Module README](README.md) for the full picture).

## What it is

Integer grades **1 – 9** representing player skill, as defined by the **APA (American Poolplayers Association)** national rating system (commonly called *SL1–SL9*). The encoding is widely recognized in U.S. league play; BCAPL has historically used various skill-level schemes at the local-chapter level, though CSI now mandates FargoRate for handicapped BCAPL World Championship divisions.

**Picture this** (for the novice-explanation case): APA grades each player on a 1–9 scale — SL1 is brand new, SL9 is pro-level. The grade comes from APA's proprietary algorithm tracking innings-per-game. Only APA can compute it; if our app supports this variant in the future, it would be by **manual entry** — players bring their APA-issued grade and the LO enters it.

## How it works / how it's calculated

**The APA algorithm is proprietary.** The app does not — and cannot — compute APA skill levels. What is publicly known:

- APA tracks each match's **innings per game** (the count of turns at the table).
- Their algorithm processes a recent-match window with proprietary weighting.
- The output is a grade `SL1` (weakest) through `SL9` (strongest).

For authoritative material, see [APA's player rating page](https://poolplayers.com/about-the-apa/equalizer-handicap-system/). The app does not replicate, approximate, or synthesize APA's calculation — doing so would be wrong and would mislead users.

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
- **Compatible with [1-Point Scoring System](../scoring-systems/one-point-scoring.md)** if a race-length-adjustment chart is added.
- **Not used by any shipping Division** today.

## Possible modifications

N/A while reserved. When revived, the relevant modifications are:

- Choice of locally-calibrated chart for SL-vs-SL race lengths (if APA's chart isn't license-clear to embed).
- Manual-entry UX details (validation, optional history view, refresh prompts).
- Variant selection (APA SL1–SL9 vs a locally-coined N-grade scheme).

## Current code state (and the step-2 hide)

The variant is **scaffolded but not usable**:

- DB allows the value: `'skill_level'` in `preferences.handicap_type` CHECK (`supabase/migrations/20260410000000_extend_preferences_modular.sql:61`)
- `HandicapType` union member: `src/utils/calculatePlayerHandicap.ts:22`
- Stub branch in `src/systems/buildSystemFromPreferences.ts:135` (`case 'skill_level':`)
- Wizard card currently visible: `src/wizards/league-v2/steps/HandicapSystemStep.tsx:43`

**Step 2 will:**

1. **Hide the wizard card** in `HandicapSystemStep.tsx` so operators cannot select Skill Level until a usable implementation exists. The schema, stub, and union member stay intact — per the project's *hide-but-preserve* rule for half-built features (don't ship broken; don't strip scaffolding).
2. **Add an early-return guard in `src/utils/calculatePlayerHandicap.ts`** for `handicap_type === 'skill_level'`. Today the function silently falls through to a percentage-style starting handicap (returning `player.starting_handicap_5v5 ?? 40`), which is wrong data, not a visible failure. The guard should return `{ value: null, stale: false }` with a `logger.warn` — turning silent miscalculation into an explicit "no data" state.

## Trigger to revive in app

Un-hide the wizard card when **any** of these is true:

- A manual-entry rating mode is built for `skill_level` (the simplest path).
- A locally-calibrated SL-vs-SL race-length chart is added (would also need confirming the variant page's mechanism+chart pairings hold up).
- A formal APA or BCAPL/CSI partnership commits to a calculation pathway.

Until then: reserved-but-hidden. Schema preserved. Step 2 is the boundary-marker, not the implementation.
