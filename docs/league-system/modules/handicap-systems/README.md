---
title: Handicap Systems (Module)
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# Handicap Systems

## Essence

A **handicap system** encodes a player's relative strength as a numeric or categorical value, used by the rest of the league system to compute fair matchups. The system specifies the *encoding* — the value range, the computation rule (or "manually entered"), and the meaning of higher vs lower values.

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

## Variants index (peers — no canonical/default)

| Variant | Code value | Range | Origin |
|---|---|---|---|
| [**Points**](points.md) | `'points'` | -2 to +2 (integer) | Coined |
| [**Percentage**](percentage.md) | `'percentage'` | 0 – 100 | Coined |
| [**FargoRate**](fargorate.md) | `'fargo'` | 100 – 850 | CSI / FargoRate official |
| [**Skill Level**](skill-level.md) | `'skill_level'` | 1 – 9 (APA grade) | APA national system; **reserved** — schema present, wizard card hidden in step 2 until usable implementation lands |

Plus the `'none'` value (no handicapping). Covered briefly in this README rather than its own page.

## How this Module interacts

Handicap Systems feed **two** downstream Modules:

- **[Handicap Mechanisms](../handicap-mechanisms/README.md)** — consume the strength values to decide what changes in the match (extra games, start points, etc.).
- **[Threshold Charts](../threshold-charts/README.md)** — consume the handicap-difference (or rating pair) and produce the target/threshold value the mechanism applies.

Each variant ships with a *known-compatible* mechanism and chart pairing today. New combinations are possible (LO-customization territory) but require a calibrated chart for the new combo before they ship.

## Future possibilities

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
