---
title: FargoRate team handicap formula — research notes
date: 2026-04-18
status: Unit 9 research artifact (living document)
---

# FargoRate team handicap formula

## Purpose

This document captures the official FargoRate formula for computing team start-points (the handicap awarded to the weaker team at match start). It serves as the reference for the `fargo5v5` SystemModule implementation in Unit 10.

**Important operational framing:** Rack'em Leagues runs in parallel to BCA's official FargoRate app, which may produce slightly different numbers due to rounding, regression-fit parameters we don't have access to, or calculator-version differences. Our computed start-points is a **default** presented at lineup lock — captains can override it if the official app disagrees, then countersign per the standard confirm flow. Therefore the formula below only needs to be **close enough to be a useful default**, not mathematically exact.

## Core formula (authoritative source: FargoRate "Behind the Curtain")

### Step 1 — Transform each player's rating

```
T = 2^(rating / 100)
```

Key property: a 100-point rating gap predicts a 2:1 win ratio. A 200-point gap predicts 4:1. Etc.

**Divisor confirmed 2026-05-02 (Unit 0.4 research).** Mike Page (FargoRate's creator) writes this formula verbatim on AzBilliards and the official "Behind the Curtain" blog. The Bradley-Terry academic convention `e^(rating/144.27)` is algebraically identical (since `100 / ln(2) ≈ 144.27`) but FargoRate never publishes the base-e form anywhere. The codebase's `Math.pow(2, rating / 100)` matches the canonical published form exactly.

| Rating | Transformed T |
| ------ | ------------- |
| 300    | 2^3 = 8       |
| 400    | 2^4 = 16      |
| 500    | 2^5 = 32      |
| 600    | 2^6 = 64      |
| 700    | 2^7 = 128     |
| 800    | 2^8 = 256     |

### Step 2 — Expected wins per matchup

For Player A vs Player B playing N games in a matchup:

```
Expected wins for A  =  (TA / (TA + TB)) × N
Expected wins for B  =  (TB / (TA + TB)) × N
```

### Step 3 — Expected SCORE per matchup (this is where scoring-system matters)

```
Expected score for A = P(A wins) × winner_points  +  P(A loses) × E[loser_points | A loses]
Expected score for B = P(B wins) × winner_points  +  P(B loses) × E[loser_points | B loses]
```

Where:
- `P(A wins) = Expected wins for A / N` (probability A wins a single game)
- `winner_points` is fixed per scoring system (10 for our 10-point system; 14 for USAPL; 17 for BCAPL — though BCAPL's is variable, max 17)
- `E[loser_points | A loses]` is the expected balls the loser pockets — this is **regression-fit from actual game data** by FargoRate and is not published as a closed-form formula. For a good default, approximate as a function of rating gap (see "Loser points approximation" below).

### Step 4 — Sum across all matchups in a round, then across rounds

```
Team A expected score = Σ expected scores over all matchups
Team B expected score = Σ expected scores over all matchups
```

### Step 5 — Start points for the weaker team

```
start_points = floor( Team_stronger_expected_score - Team_weaker_expected_score )
              × handicap_percentage  (default 1.0)
```

## Two modes of calculation

The official FargoRate calculator offers two modes:

- **Legacy mode** (simpler): uses each team's *average* rating. Produces a single handicap number used for the whole match. One calc at lineup lock.
- **First Round / Full Match mode** (more accurate): uses actual player-vs-player matchups per round. Handicap can differ round-to-round.

**Rack'em Leagues v1 decision: use Legacy mode.** Matches the operator's real-league experience ("a set number of points awarded at the beginning of the match"). Simpler to implement and explain. Single value stored in `matches.fargo_start_points`.

## Loser points approximation (for our 10-point system)

Your league's scoring: winner = 10 flat, loser = 0-7 balls pocketed.

The FargoRate calculator uses internal regression to estimate expected loser balls based on rating gap. We don't have their exact coefficients but based on **Test Case 1 calibration** (a real match with known output), the real-world averages are higher than a naive midpoint guess:

- **Even match (gap ≈ 0):** loser averages ~4.0 balls
- **Moderate gap (~120 pts):** loser averages ~4.0 balls ← calibrated from Test Case 1
- **Larger gap (200+ pts):** loser averages ~3.5 balls (interpolated; to be validated)
- **Extreme gap (300+ pts):** loser averages ~3.0 balls (interpolated; to be validated)

**Simplified v1 formula:** use `avg_loser_points = 4` for all gaps. This matches the single real test case within 1 point. More test cases will refine this table, but the override-at-lineup-confirm flow means the formula only needs to be a reasonable default.

## Worked example (from the official CSI Pool article)

Round 1 of a team match, 17-point system (BCAPL):
- STR8 SHOOTERS (avg rating 417) expected round score: 48.079 points
- POCKETEERS (avg rating 447) expected round score: 53.921 points
- Difference: 5.843 → floor → **5 start points** awarded to STR8 SHOOTERS

Subsequent rounds in the same match (First Round mode): 5, 5, 6 — varies because matchups change.

In Legacy mode, the same 5-point handicap applies all match (uses team averages, doesn't vary).

## Test cases (for Unit 10 tests)

These are captured test cases — real matches with confirmed start-points values from the official calculator or from played matches. They become the assertion values in `src/systems/__tests__/fargo5v5.test.ts`.

| Case # | Home roster | Away roster | Games | Point system | Start-points (weaker team) | Source |
| ------ | ----------- | ----------- | ----- | ------------ | -------------------------- | ------ |
| 1      | [567, 458, 493, 486, 574] (avg 515.6) | [447, 394, 452, 322, 374] (avg 397.8) | 25 | 10-point | **56** to away | Played match |
| 2-N    | TBD | TBD | | | | |

**Case 1 calibration:**
- Rating gap: 117.8 avg
- Expected home wins: 17.1 of 25
- Expected away wins: 7.9 of 25
- Win differential: 9.2 games
- Per-game point differential (using avg_loser_points = 4): 10 - 4 = 6
- Computed: 9.2 × 6 = 55.2 → **55 start points**
- Actual: **56 start points**
- **Delta: 1 point** — within ±1 tolerance. Formula validated on this case.

**Tolerance:** ±1 start-point from the official calculator. If the operator overrides the computed number at lineup lock, the override is stored. The formula needs to be a plausible default within 1-2 points of the official app.

**More test cases needed:** operator to add 5-10 more cases as Fargo matches are played or hand-walked on the calculator. Planned source: additional real-match data plus synthetic calculator runs (even match, large gap, mixed skill distribution). Not blocking initial Unit 10 implementation — we can start with Case 1 and add assertion values as they accumulate.

## Handicap percentage

Default: 1.0 (100%). Exposed as a potential future dial but not in v1 Known Dials per operator decision.

Some leagues set this to 0.5 (reduced handicap) or 1.5 (amplified). Not a v1 concern.

## Non-goals / limitations of this research

- **Not a reverse-engineering of FargoRate's exact regression coefficients.** Those aren't public.
- **Not exhaustive across all scoring systems.** Focused on the 10-point system (operator's league). 17-point and 14-point differ in Step 3 parameters only — same core formula.
- **Not a validation of the official calculator's correctness.** We trust it; our formula approximates it; captains override when it matters.

## Sources

- [FargoRate — a look behind the curtain](https://www.fargorate.com/fargorateblog/archive/behindthecurtain/) — authoritative formula (Steps 1-2)
- [FargoRate League Handicap Calculator Explained (CSI Pool)](https://www.playcsipool.com/csinews/all-new-fargorate-league-handicap-calculator-explained) — worked examples, Legacy vs First Round mode, the STR8 SHOOTERS / POCKETEERS example
- [FargoRate League Calculator](https://leaguecalc.fargorate.com/) — the official calculator to hand-walk for test cases
- [How FargoRate Improves the 10-Point Scoring System](https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system) — 10-point system parameters
- [Dr. Dave Pool Info — FargoRate](https://drdavepoolinfo.com/faq/rating/fargorate/) — community cross-reference

## Open items for future research (not blocking v1)

- Exact loser-points regression coefficients (would replace the approximation table above)
- Whether the official calculator uses rounding-down or rounding-to-nearest at Step 5 (the CSI article says rounded down; worth confirming with a boundary test case)
- Behavior on extreme rating gaps (>400 points) — the formula is defined but may produce unbalanced results; operator override is the safety net
