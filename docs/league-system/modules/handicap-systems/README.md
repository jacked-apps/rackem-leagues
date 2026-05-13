---
title: Handicap Systems (Module)
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# Handicap Systems

## Essence

A **handicap system** encodes a player's relative strength as a numeric or categorical value, used by the rest of the league system to compute fair matchups. The system specifies the *encoding* — the value range, the computation rule (or "manually entered"), and the meaning of higher vs lower values.

## Why handicapping exists

Pool players have a wide range of skill. A brand-new beginner vs. a 700-Fargo league regular is a foregone-conclusion match — and foregone-conclusion matches kill league competitiveness over a season. **Handicapping** is the umbrella term for any system that adjusts match conditions to make matches between unequal players genuinely competitive: the weaker player or team gets some kind of advantage (extra games to win, a head start in points, a shorter race) so that effort and improvement matter more than the raw skill gap.

A league can choose to run **without** handicapping (`handicap_type='none'`). That is a valid choice — it just produces a *different kind of league*, where players self-select into divisions roughly matched to their skill (Bronze / Silver / Platinum tiers, etc.). Handicapping replaces self-sorting with active equalization.

This Module is the **first piece** of the handicapping chain. It answers a single question: *how is each player's strength encoded as a number or grade?* Once you have that encoding, three other Modules act on it:

- [**Handicap Mechanisms**](../handicap-mechanisms/README.md) applies the strength difference during play (extra games, start points, race-length adjustment).
- [**Threshold Charts**](../threshold-charts/README.md) converts a difference value into a concrete target (e.g., "team A needs 8 wins, team B needs 5").
- [**Scoring Systems**](../scoring-systems/README.md) decides who wins the match based on accumulated games or points.

## Boundary

A handicap system is **only** the strength encoding. It is **not**:

- The rule that turns the strength difference into an in-match adjustment — that is a **[Handicap Mechanism](../handicap-mechanisms/README.md)** (extra games, start points, race-length adjustment).
- The lookup that maps a difference value to a target — that is a **[Threshold Chart](../threshold-charts/README.md)**.
- The rule that decides who wins the match — that is a **[Scoring System](../scoring-systems/README.md)**.

If a proposed feature changes how a player's strength number is *computed* or *expressed*, it belongs here. If it changes how that number gets *applied during play*, it belongs in Handicap Mechanisms.

## CSI's published taxonomy (context)

The *BCAPL LO Handbook 2020* (page 38, "Popular League Handicapping Methods") enumerates only **two** named handicap methods:

1. **FargoRate Handicapping** — the method CSI actively promotes.
2. **Average Handicapping** — a legacy method that computes `total points / games` from a per-game scoring system (e.g., 7.3 average out of 10).

Everything else, including this app's `points` (-2 to +2 integer) and `percentage` (0-100 win-rate) systems, sits **outside** CSI's published taxonomy. CSI explicitly leaves this to LOs ("you are free to decide the structure and format of your league"). Two consequences:

- We do not pretend our coined names (Points, Percentage) are CSI-official. They are coined.
- Our `percentage` system is **not** CSI's "Average Handicapping" — ours is a *win-rate* average (binary wins / total games), not a *points-per-game* average. Adjacent concept; distinct mechanic.

## Variants index — two sub-categories {#variants-index}

The variants split along one fundamental axis: **who computes the rating**. This is not a presentation choice — it is the most consequential decision an LO makes inside this Module. Two of our four variants are internally-computed; two are externally-sourced.

### Internally-Computed Ratings {#internally-computed-ratings}

*The app derives the rating from match history in the league's own database. The league owns the math.*

| Variant | Code value | Range |
|---|---|---|
| [**Points**](points.md) | `'points'` | -2 to +2 (integer) |
| [**Percentage**](percentage.md) | `'percentage'` | 0 – 100 |

### Externally-Sourced Ratings {#externally-sourced-ratings}

*An outside organization computes the rating. The app imports it via API, manual entry, or fallback to a stored value. The league does not own the math.*

| Variant | Code value | Range | External source |
|---|---|---|---|
| [**FargoRate**](fargorate.md) | `'fargo'` | 100 – 850 | FargoRate (CSI-mandated for BCAPL Handicapped Worlds) |
| [**Skill Level**](skill-level.md) | `'skill_level'` | 1 – 9 (APA grade) | APA — **reserved** (schema present; wizard card hidden in step 2 until usable implementation lands) |

### The `'none'` value

No handicapping. Used when a league runs without any equalization mechanism (Bronze/Silver/Platinum-tier self-sorting). Covered in this README rather than its own page.

## Why this split matters operationally

Choosing internal vs external is a real LO decision with real consequences. Each consequence flows in the same direction across all variants in a group — these are *group properties*, not per-variant traits.

- **Cross-league portability.** *Internal*: none. Every league is its own world; a player's rating only means something inside that league. *External*: yes. Players carry their rating between leagues — a 491 FargoRate or an APA SL5 means the same thing nationally.
- **LO control over the math.** *Internal*: full. The LO can choose the chart, the variant range, the history window. *External*: none. The outside org's algorithm is locked.
- **Onboarding friction.** *Internal*: low. New players just start playing; ratings derive from observed play. *External*: higher. Players need an APA card, a FargoRate, or some path to an existing rating.
- **Updates.** *Internal*: automatic; ratings evolve game-by-game from match history. *External*: manual entry or via API; depends on the external source's update cadence.
- **World-championship pathway.** *Internal*: none for handicapped CSI/BCAPL events. *External*: yes — FargoRate specifically is CSI-mandated for BCAPL Handicapped World Championship divisions.

Operators choosing a Division are really choosing one of these *worlds*. The doc should not hide that.

## Rating confidence and the starting-handicap window {#rating-confidence}

A real concept across **every** variant in this Module: a player's rating is more trustworthy when it's based on more games. FargoRate has formalized this as **Robustness** — a number representing how much data backs a player's rating, where low-robustness ratings are provisional and shift quickly while high-robustness ratings are stable.

This app applies the same idea differently per variant:

- **[Internally-Computed variants](#internally-computed-ratings) ([Points](points.md), [Percentage](percentage.md)).** A new player starts with a **default starting handicap** (`0` for Points, `40` for Percentage). The LO can **optionally** override this default if they know the player from outside this league (e.g., they've played in the LO's other leagues, or the LO knows them from tournaments). The starting handicap holds for the first **~15 games** (roughly 3 weekly match nights for a 3-person team), after which the formula takes over and the rating is computed from observed wins/losses inside this league.
- **[FargoRate](fargorate.md) (Externally-Sourced).** FargoRate maintains its own Robustness metric on their side. We just import the rating value; we don't compute or display robustness ourselves. A player's "starting Fargo" — and how quickly it firms up — is whatever FargoRate gives us when we look them up.
- **[Skill Level](skill-level.md) (Externally-Sourced, reserved).** APA's algorithm presumably has its own confidence-with-data behavior; we don't compute or import it. When the variant is revived for manual entry, the LO would enter whatever current grade APA reports.

The 15-game threshold for internally-computed variants is **hardcoded today**. A future Module-customization pass could expose it as an LO-configurable dial.

## How this Module interacts

Handicap Systems feed **two** downstream Modules:

- **[Handicap Mechanisms](../handicap-mechanisms/README.md)** — consume the strength values to decide what changes in the match (extra games, start points, etc.).
- **[Threshold Charts](../threshold-charts/README.md)** — consume the handicap-difference (or rating pair) and produce the target/threshold value the mechanism applies.

Each variant ships with a *known-compatible* mechanism and chart pairing today. New combinations are possible (LO-customization territory) but require a calibrated chart for the new combo before they ship.

## Future possibilities {#future-possibilities}

- **Additional handicap-strength scaling factors** — we currently ship 100% (default) and 50% (the *reduced* variant per system) for Points and Percentage. FargoRate's LMS supports a 4-point spectrum (50% / 75% / 100% / 150%) where higher = more aggressive equalization. Adding 75% (lighter than default but less light than reduced) and 150% (stronger, more equalizing) would give LOs finer control over how much the handicap "works." This is a per-system modification, not a new variant — each existing variant could ship additional scaling-factor options.
- **LO-defined custom rating** — operator-set rating system (e.g., a regional 1-10 grade scheme) with operator-supplied chart.
- **USAPL Skill Levels** — adjacent to APA's; would require its own variant page.
- **Hybrid systems** — e.g., FargoRate as primary with manual override range, or Points-derived-from-Fargo bucketing.

The category is open. Adding a new variant requires: (a) an encoding spec, (b) at least one compatible mechanism + chart, (c) a wizard card, (d) the matching variant page here.

## Source of truth

- `src/types/preferences.ts` — `handicap_type` column type
- `src/utils/calculatePlayerHandicap.ts` — `HandicapType` union; calculation dispatch
- `supabase/migrations/20260410000000_extend_preferences_modular.sql` (lines 51–66) — DB CHECK enumerating allowed values
- `src/systems/buildSystemFromPreferences.ts` — per-`handicap_type` SystemModule dispatch
- `src/wizards/league-v2/steps/HandicapSystemStep.tsx` — wizard UI for variant selection

Step-2 rename targets: none at the Module level (the file structure is not being renamed; only the SystemModule keys / Division preset keys are).
