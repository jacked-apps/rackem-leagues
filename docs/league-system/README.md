---
title: League System Canonical Reference
date: 2026-05-12
status: active
audience: developer + AI sessions
---

# League System Canonical Reference

Layer 1 (L1) source of truth for the modular league configuration system. This doc defines the **vocabulary**, the **design space**, and the **boundaries** between concepts. Future Claude sessions and Ed (returning after time away) read this to keep things straight when coding, planning, or talking to outside parties (CSI / Ozzy / operators).

## Honesty framing {#honesty}

> *These three prepackaged Scoring Systems are real leagues the developer has played in. They are not BCAPL-endorsed standards — there isn't one. The modular system supports any BCAPL-compatible configuration; these ship as well-tested starting points.*

This paragraph is the **single source** for the framing. Each prepackaged Scoring System page links back to this anchor (`README.md#honesty`) rather than restating it.

## What this doc is for

This is a **design-space map**, not a "current implementation manual." For each Module (a bounded thing — see `PRINCIPLES.md`), it documents the **essence**, the **boundary** (what is NOT in this Module), the **current variants** as peers — no implementation is privileged as "the basis" or "the default" — and **known possible variants** that fit the essence but haven't been built yet.

The doc serves three jobs:

1. **Anti-conflation classifier.** When a new feature or rule comes up, you and Claude both consult this doc to determine which Module it fits in, or recognize that it needs a new Module.
2. **Pedagogical reference.** Each Module's essence and variants are documented in their simplest form, separated from how they currently happen to be implemented.
3. **Future-work enabler.** When LO-customization UI lands, the design space is already mapped. When new variants are built, the boundaries and connections are already documented.

For the architectural model and the meta-policy that govern how these docs are written, see [`PRINCIPLES.md`](PRINCIPLES.md).

## Naming Taxonomy (cheat sheet) {#cheat-sheet}

> **Mirror invariant.** This block is the canonical source. The `## League System Naming Taxonomy` section in the project `CLAUDE.md` mirrors it verbatim. Any edit here must land in the same commit as the matching `CLAUDE.md` update. See `## League System Doc Policy` in `CLAUDE.md` for the full enforcement rules. *(Mirror not yet established — Unit 11 of the L1 docs plan creates the CLAUDE.md mirror.)*

### Brand naming: BCA vs BCAPL {#brand-naming}

Per CSI's *BCA Pool League Operators' Handbook* (June 2020, p.41 "Name Guidelines"), the league brand is **BCAPL** or **BCA Pool League** — never "BCA" alone. "BCA" refers to the Billiard Congress of America, a standards body that is **not** the league operator. CSI (CueSports International) runs BCAPL.

| Form | Verdict | Use for |
|---|---|---|
| **BCAPL** | Correct | Internal references, code identifiers, prose |
| **BCA Pool League** | Correct | Long-form references, public-facing copy |
| **CSI** | Correct | The operator (separate from the league brand) |
| **BCA** alone | **Incorrect** per CSI | Avoid; refers to the standards body, not the league |

**Code-identifier implication.** The current `bca3v3` / `bca5v5` / `fargo5v5` SystemModule keys reflect pre-2020 branding that CSI's own handbook explicitly deprecates. Step 2's renames (`bca3v3` → `points_3man`, `bca5v5` → `percentage_5man`, `fargo5v5` → `fargo_10pt_5man`) bring the codebase into compliance with CSI's published guidance — independent of the also-true motivation that the new names better describe what each Scoring System actually is.

### Bundle and building-block words

| Concept | Word we use | Source |
|---|---|---|
| The complete configured rule set that scores a match | **Scoring System** | Ours (replaces the dropped CSI-conflated "Division") |
| Any bounded thing with strict borders + room to grow (the universal unit) | **Module** | Ours (CSI has no equivalent) |
| The handicap unit of advantage | **Spot** | CSI (glossary-only — used in concept descriptions, not as a Module name) |
| A team's winning a single game | **Win** (not "point") | Plain English |
| A match-level winning aggregation | **Match Win** | Plain English |

> **Note on "Division" (dropped).** The brainstorm originally adopted CSI's term "Division" for the bundled rule set. We dropped it. CSI uses "division" for both *a league* (a recurring competition) and *a scoring configuration* — two fundamentally different kinds of thing sharing one word. We use **League** for the recurring competition (our hierarchy: **Organization → League → Season**) and **Scoring System** for the configured rule set. "Division" appears nowhere.

### Handicap Systems

Three handicap systems ship today, split into two sub-categories by **who computes the rating**. CSI has no formal name for the internally-computed ones; we coin clean parallel labels.

**Internally-Computed Ratings** — *the app derives the rating from match history in the league's own database. The league owns the math.*

| Code | Display Name | Range | Source of name |
|---|---|---|---|
| `points` | **Points** | -2 to +2 (integer) | Coined (operator colloquialism, no CSI brand) |
| `percentage` | **Percentage** | 0 – 100 | Coined (descriptive, no CSI brand) |

**Externally-Sourced Ratings** — *an outside organization computes the rating; the app imports it. The league does not own the math.*

| Code | Display Name | Range | Source of name |
|---|---|---|---|
| `fargo` | **FargoRate** | 100 – 850 | CSI / FargoRate official |

**`skill_level` — reserved.** Schema, DB CHECK, stub branch, and `HandicapType` union member exist. Wizard card is currently visible but step 2 hides it until a usable implementation lands. Belongs to the **Externally-Sourced** category (APA owns the math). See `modules/handicap-systems/skill-level.md` for the full rationale.

### Points System

The **Points System** Module governs per-game point allocation. CSI's named "Scoring Systems" are *Points System rules* in our vocabulary — configurations of the per-game allocator (see [`modules/points-system/README.md`](modules/points-system/README.md)).

| Code (current `points_calculator`) | CSI Display Name | Source |
|---|---|---|
| `accumulated_per_game` (with default params: winner=10, loser=[0,7]) | **10-Point Scoring System** | CSI |
| (no current calculator implements directly) | **1-Point Scoring System** (a.k.a. **Race To**) | CSI |

Future possibility: **17-Point Scoring System** (CSI also names this; needs the `formula` shape — not yet implemented).

Plus our coined calculators that don't directly map to a CSI named system: `linear_above_threshold` (used by Points 3-Man), `accumulate_with_milestone_jumps` (used by Percentage 5-Man), `none` (no points tracked).

### Win Calculator

The **Win Calculator** Module decides match victory from collected metrics. Currently primitive — a binary `win_condition`:

| Code | Display | Meaning |
|---|---|---|
| `win_condition='games'` | **Games-decides** | Match winner = team with more games won |
| `win_condition='points'` | **Points-decides** | Match winner = team with higher accumulated points |

Future: cross-axis conditions, race-mode termination, tie resolution, per-game evaluation cadence. See [`modules/win-calculator.md`](modules/win-calculator.md).

### Prepackaged Scoring Systems (the 3 we ship)

| Old code | New code (step 2 target, tentative) | Name |
|---|---|---|
| `standard_3v3` | `points_3man` | **Points 3-Man** |
| `standard_5v5` | `percentage_5man` | **Percentage 5-Man** |
| `fargo_5v5` | `fargo_10pt_5man` | **FargoRate 10-Point 5-Man** |

### The 8 component Modules

The 13 raw configuration axes group into 8 user-facing component Modules. There is also a 14th persisted-but-unconsumed column (`points_system`) that no scoring runtime reads; see [`modules/points-system/README.md`](modules/points-system/README.md).

| # | Module | Wraps axes |
|---|---|---|
| 1 | **Handicap Systems** | `handicap_type` |
| 2 | **Handicap Mechanisms** | `mechanism` (extra games / start points / race-length adjust / none) |
| 3 | **Points System** | `points_calculator` + `points_calculator_params` |
| 4 | **Win Calculator** | `win_condition` |
| 5 | **Threshold Charts** | `threshold_chart_id` |
| 6 | **Team Geometry** | `lineup_size` + `max_roster_size` + `game_generation` |
| 7 | **Match Format** | `pairing_format` + `race_length` |
| 8 | **Standings & Tiebreakers** | `standings_sort` + `tiebreaker_trigger` + `tiebreaker_format` |

> **A Scoring System is the top-level Module that composes all 8 components above.** The 8 are the *components*; a Scoring System is the *whole*. The prepackaged Scoring Systems we ship (Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man) are tested combinations of these components.

### Disambiguation rule for "Points"

"Points" is used as both a Handicap name (the -2 to +2 system) and inside CSI's Scoring System names ("1-Point Scoring System", "10-Point Scoring System"). To prevent collisions:

- **Page titles, headings inside `handicap-systems/`, and any standalone reference to the handicap concept** use **"Points Handicap"** in full. Example: section heading "## Points Handicap", body sentence "the league uses Points Handicap with a +/-2 range."
- **Scoring System short nicknames** (e.g., "Points 3-Man") use the bare word "Points" — these are deliberately concise labels; surrounding structure makes meaning unambiguous.
- The Points System rules (CSI's named ones) are **always** written in full: **"1-Point Scoring System"** and **"10-Point Scoring System"**. Never abbreviated to "Points" or "Points scoring" anywhere downstream.

## How to classify a new idea (anti-conflation walkthrough)

Use this when Ed proposes a new feature, rule, or behavior — *before* writing code, before writing a brainstorm, before assuming where it fits. Walk down the list. The **first** match wins.

1. **Does it change how a player's strength is encoded for the match?** (A new rating system, a new range for an existing one, a new scale.)
   → **Handicap System.** Pick the variant page in `modules/handicap-systems/` or recognize you need a new one.

2. **Does it change how the strength difference between teams is applied during play?** (A new way to spot the weaker side — extra games, head-start in points, race-length adjustments, something hybrid.)
   → **Handicap Mechanism.** See `modules/handicap-mechanisms/`.

3. **Does it change how per-game points are allocated?** (Winner gets X, loser gets Y; threshold-triggered point bonuses; end-of-match aggregates.)
   → **Points System.** See `modules/points-system/`.

4. **Does it change how match victory is decided?** (Which metric — games or points — declares the winner; tie rules; cross-axis conditions; race-mode vs threshold-mode termination.)
   → **Win Calculator.** See `modules/win-calculator.md`.

5. **Does it change how a handicap difference becomes a target threshold value** (target wins, starting points)? Is it a lookup-table or formula change?
   → **Threshold Chart.** See `modules/threshold-charts/`.

6. **Does it change the structural shape of a team or the games-per-match schedule?** (Lineup size, roster size, single vs double round-robin.)
   → **Team Geometry.** See `modules/team-geometry.md`.

7. **Does it change the per-pairing structure?** (Single rack vs race-to-N per pairing, race length per pairing.)
   → **Match Format.** See `modules/match-format.md`.

8. **Does it change how teams are ordered in standings or how end-of-season ties are resolved?**
   → **Standings & Tiebreakers.** See `modules/standings-tiebreakers.md`.

9. **None of the above fit cleanly?**
   → **You probably need a new Module.** Don't force it into an existing one. Surface this as a planning question; write a brainstorm before classifying.

### Worked example (classification that doesn't fit)

> *"An LO proposes that the loser of a match gets to choose their break in the next match if they lose by 3+ games."*

Walk the list:

1. Does it change how strength is encoded? **No** — strength values are unchanged.
2. Does it change how the strength difference is applied during play? **No** — this rule fires *between* matches based on outcome, not based on rating difference.
3. Does it change how per-game points are allocated? **No** — per-game point math is unchanged.
4. Does it change how match victory is decided? **No** — match victory is decided the same way; this rule reads the result *after* victory is determined.
5. Threshold chart change? **No** — no thresholds involved.
6. Team Geometry / Match Format / Standings? **No** — none of those.

**Result:** doesn't fit cleanly into any existing Module. The proposal describes a new category — *between-match handicap-adjustment rules* — where prior-match outcomes feed into next-match conditions. **This needs a new Module**, not a forced fit into an existing one. Surface this; write a brainstorm; do not silently wedge it into Handicap Mechanisms (which are *within-match* by definition).

### Worked example (classification that does fit)

> *"What if 10-Point Scoring let the winner score 12 points instead of 10, with the loser still scoring 0–7?"*

Walk the list:

1. Strength encoding? **No.**
2. Strength application during play? **No.**
3. **Per-game points allocated?** **Yes.** The change is in how per-game points are allocated — exactly what the **Points System** Module covers.

**Result:** fits in **Points System**. Specifically: it is a **modification of the 10-Point Scoring System variant** (changing the winner amount from 10 to 12 while preserving the per-game-allocation core mechanic). Document under `modules/points-system/ten-point-scoring.md` → "Possible modifications" section. Not a new variant (the core mechanic is unchanged); not a new Module.

> **Boundary tip.** A *modification* changes parameters within the variant's core mechanic. A *new variant* changes the core mechanic itself (e.g., simple-winner-only with no loser points at all). A *new Module* introduces a category the existing eight don't cover.

## Doc structure

This L1 doc uses a **folder-per-major-Module** convention for Modules with significant variants, and a **single-file** convention for thin Modules.

```
docs/league-system/
  README.md                          ← This file (cheat sheet + indexes)
  PRINCIPLES.md                      ← Meta-policy (architectural model + writing rules)
  scoring-systems/                   ← Prepackaged Scoring Systems (the 3 we ship; pages pending — Unit 9)
  modules/                           ← The 8 component Modules
    handicap-systems/                ← Folder: README + 4 variant files
    handicap-mechanisms/             ← Folder: README + 3 variant files (none = covered in README)
    points-system/                   ← Folder: README + variant files (1-Point, 10-Point)
    win-calculator.md                ← Single file
    threshold-charts/                ← Folder: README + per-chart variant files (pending — Unit 5)
    team-geometry.md                 ← Single file (pending — Unit 6)
    match-format.md                  ← Single file (pending — Unit 7)
    standings-tiebreakers.md         ← Single file (pending — Unit 8)
  glossary.md                        ← Single-source term definitions (pending — Unit 10)
```

**Variant pages are peers.** No variant is privileged as "the canonical / default / basis" within its category. The category essence is defined independently of any specific implementation. When you read a variant page, treat it as one of N equivalent ways the category can manifest — not as the anchor that other variants are measured against.

## Module index

| Module | Reference | Wraps |
|---|---|---|
| Handicap Systems | [`modules/handicap-systems/`](modules/handicap-systems/README.md) | How a player's strength is encoded |
| Handicap Mechanisms | [`modules/handicap-mechanisms/`](modules/handicap-mechanisms/README.md) | How the strength difference is applied during play |
| Points System | [`modules/points-system/`](modules/points-system/README.md) | How per-game points are allocated |
| Win Calculator | [`modules/win-calculator.md`](modules/win-calculator.md) | How match victory is decided |
| Threshold Charts | [`modules/threshold-charts/`](modules/threshold-charts/README.md) | How handicap-differences map to in-match targets *(pending — Unit 5)* |
| Team Geometry | [`modules/team-geometry.md`](modules/team-geometry.md) | Lineup size, roster size, game-generation *(pending — Unit 6)* |
| Match Format | [`modules/match-format.md`](modules/match-format.md) | Pairing format, race length *(pending — Unit 7)* |
| Standings & Tiebreakers | [`modules/standings-tiebreakers.md`](modules/standings-tiebreakers.md) | Standings sort order, tiebreaker rules *(pending — Unit 8)* |

> A **Scoring System** is the top-level composition of these 8 component Modules. See [`PRINCIPLES.md`](PRINCIPLES.md) for the full architectural model.

## Prepackaged Scoring Systems index

A **Scoring System** is the complete configured rule set that scores a match — a top-level composition of the 8 component Modules above. The three prepackaged Scoring Systems below are what we ship today; each is a component-Module combination that has been **tested and works in practice**.

The modular system technically allows other component combinations beyond these three. Those untested combinations are not validated — pairing arbitrary handicap + mechanism + chart + points + win-calc choices can produce matches that aren't fair, aren't competitive, or aren't mathematically sensible. Stick with shipped Scoring Systems unless you're prepared to validate a new combo.

| Short Nickname | Synthesis page |
|---|---|
| Points 3-Man | `scoring-systems/points-3man.md` *(pending — Unit 9)* |
| Percentage 5-Man | `scoring-systems/percentage-5man.md` *(pending — Unit 9)* |
| FargoRate 10-Point 5-Man | `scoring-systems/fargo-10pt-5man.md` *(pending — Unit 9)* |

## How to use this doc

- **Vocabulary lookup** (Ed returning after a break, Claude session needing a quick reminder): read the Naming Taxonomy cheat sheet above. Same block lives in the project `CLAUDE.md` so it's always in context (mirror established in Unit 11).
- **Substantive rules question** (any non-trivial behavior question — "how does the 10-Point loser-points entry work?", "what's the resolved view doing with `points_system`?", "does start-points work with the Points handicap?"): read the relevant Module README first, then the relevant variant page, then follow the "Source of truth" links to the actual code.
- **New idea coming in**: walk the [How to classify a new idea](#how-to-classify-a-new-idea-anti-conflation-walkthrough) checklist. Don't skip it. The whole point of this doc is to catch conflation early.
- **Cross-Module links are intentional.** When you encounter a reference like `extra_games mechanism` while reading a variant page in Handicap Systems, you will not find an inline definition. **Click the link.** The click is teaching you that you've crossed a Module boundary — from Handicap Systems territory into Handicap Mechanisms territory. Inlining cross-Module definitions would dissolve the very boundaries this doc exists to enforce. *Intra-Module references* (variants within the same Module folder) may carry brief inline glosses since they don't cross a boundary.
- **The L1 doc IS the source of truth.** [`PRINCIPLES.md`](PRINCIPLES.md) defines the architectural model and the meta-policy. The project `CLAUDE.md` (when Unit 11 lands) will include a `## League System Doc Policy` section that defines what changes to these files are policy-gated and what aren't.

## Glossary

[`glossary.md`](glossary.md) — single-sourced one-line definitions for every term used across L1. *(Pending — Unit 10.)*
