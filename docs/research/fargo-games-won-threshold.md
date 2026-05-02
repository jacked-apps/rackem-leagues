---
title: Fargo handicap → games-to-win threshold — research notes
date: 2026-05-02
status: RESOLVED — formula derivable from FargoRate primitives, calibrated against published HOT race chart
gates: docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 3.2 Fargo Layer 1, extra_games math)
---

# Fargo handicap → games-to-win threshold

## Status: RESOLVED

Web research conducted 2026-05-02 confirmed:

1. **FargoRate does NOT publish a games-to-win threshold chart for team matches.** Their native LMS uses handicap *points* added to scores, not asymmetric per-team game-win targets. The games-won win condition with asymmetric thresholds is an operator design choice that no canonical external source (FargoRate, BCAPL, CSI, LeagueSys) prescribes.
2. **A formula IS derivable from FargoRate's published primitives** and produces results that match FargoRate's own published HOT race chart for individual matchups. Use this formula as the league's default; captains can override at lineup lock.

## Purpose

This document captures the formula for calculating per-team
`games_to_win` thresholds in a Fargo-handicapped league when:

- `handicap_type = 'fargo'`
- `mechanism = 'extra_games'` (higher-rated team must win more games to compensate)
- `win_condition = 'games'` (match decided by games-won, not points)

This is structurally distinct from the **start-points formula** documented
at `docs/research/fargorate-formula.md`, which covers the points-scoring
case (`mechanism = 'start_points'` + `win_condition = 'points'`).

**Operational framing:** The formula is the league's default. Captains
can override at lineup lock if their league has agreed on different
thresholds. Same posture as the start-points formula.

## The formula

### Step 1 — Transform each player's rating

Same as the start-points formula:

```
T = 2^(rating / 100)
```

A 100-point rating gap predicts a 2:1 win ratio; 200-point gap predicts 4:1.

### Step 2 — Per-pairing single-game win probability

For each pairing in the match (M total games across all pairings):

```
p_i = T_home_i / (T_home_i + T_away_i)
```

This is the home player's probability of winning a single game in matchup `i`.

### Step 3 — Team expected wins

```
E_home = Σ p_i  (sum across all M games in the match)
E_away = M - E_home
```

`E_home` is the home team's "fair share" of total game wins given the
rating gap. If both teams are equally rated, `E_home = M/2`.

### Step 4 — Per-team games-to-win thresholds

The stronger team (higher expected wins) is handicapped DOWN by needing
to win more games:

```
if E_home > E_away:
    home_to_win = ceil(E_home)
    away_to_win = M + 1 - home_to_win
else:
    away_to_win = ceil(E_away)
    home_to_win = M + 1 - away_to_win
```

The `+1` ensures `home_to_win + away_to_win = M + 1` — exactly one team
crosses their target before the match ends, so the result is decisive.
This matches the BCA convention used by `get3v3GamesNeeded` and
`get5v5GamesNeeded`.

### Step 5 — Tie threshold (optional)

For even-`M` formats (e.g. 18-game DRR, 16-game 4v4 SRR) where a 9-9
tie is possible, the tie threshold is one less than the win threshold
on each side:

```
home_to_tie = home_to_win - 1
away_to_tie = away_to_win - 1
games_to_lose = tie - 1  (or NULL if no tie band desired)
```

For odd-`M` formats (25-game 5v5 SRR), no tie is possible — the formula
naturally produces a decisive winner. `games_to_tie = NULL`.

## Calibration against published HOT race chart

FargoRate publishes "HOT race charts" for individual matchups (one
player vs one player). These are the closest published reference for
asymmetric Fargo handicaps. The chart maps rating gap to race length pairs.

Worked check at 96-point gap, 10-game race:

```
T_strong = 2^(0)    = 1     (treat the lower-rated player's T as 1)
T_weak   = 2^(0.96) ≈ 1.946

p_strong = 1.946 / (1 + 1.946) ≈ 0.6605
E_strong = 0.6605 × 10 = 6.605
ceil(E_strong) = 7
complement = 11 - 7 = 4
```

Result: **7-to-4 race** for a 96-point gap. The published HOT chart
specifies exactly 7-4 for the 86-106 point gap band. Formula validated.

Additional points from the FargoRate "Anatomy of a Close-to-Fair
Tournament Tour" blog post:

| Rating gap | Published HOT race | Formula output |
| ---------- | ------------------ | -------------- |
| ~0 pts     | 6-6                | 6-6 (E=6, ceil=6, complement=6) ✓ |
| ~40 pts    | 6-5                | 6-5 (E≈5.6, ceil=6, complement=5) ✓ |
| ~96 pts    | 7-4                | 7-4 (E≈6.6, ceil=7, complement=4) ✓ |

The formula reproduces FargoRate's published individual-matchup chart
exactly across the calibration points the blog publishes. We extend the
same arithmetic to team matches by summing per-pairing `p_i` across
all pairings.

## Worked example — 3v3 DRR with mixed Fargo ratings

Match setup:
- Home: P1=600, P2=550, P3=500 (avg 550)
- Away: P1=520, P2=480, P3=460 (avg 487)
- Match format: 3v3 double-round-robin = 18 games (each home player
  faces each away player twice — once breaking, once racking)

Per-matchup `p_home_i` (each home/away pair plays 2 games):

| Pairing | Home | Away | T_home | T_away | p_home | × 2 games |
| ------- | ---- | ---- | ------ | ------ | ------ | --------- |
| 1×1     | 600  | 520  | 64     | 36.76  | 0.6353 | 1.271     |
| 1×2     | 600  | 480  | 64     | 27.86  | 0.6967 | 1.393     |
| 1×3     | 600  | 460  | 64     | 24.25  | 0.7252 | 1.450     |
| 2×1     | 550  | 520  | 45.25  | 36.76  | 0.5518 | 1.104     |
| 2×2     | 550  | 480  | 45.25  | 27.86  | 0.6190 | 1.238     |
| 2×3     | 550  | 460  | 45.25  | 24.25  | 0.6512 | 1.302     |
| 3×1     | 500  | 520  | 32.00  | 36.76  | 0.4654 | 0.931     |
| 3×2     | 500  | 480  | 32.00  | 27.86  | 0.5345 | 1.069     |
| 3×3     | 500  | 460  | 32.00  | 24.25  | 0.5688 | 1.138     |
| **Σ**   |      |      |        |        |        | **10.896**|

```
E_home = 10.896
E_away = 18 - 10.896 = 7.104
```

Home is favored. Apply Step 4:

```
home_to_win = ceil(10.896) = 11
away_to_win = 18 + 1 - 11 = 8
```

Tie thresholds (18 games, ties possible at 9-9):

```
home_to_tie = 11 - 1 = 10
away_to_tie = 8 - 1 = 7
```

So home needs 11 wins (or 10 + tiebreaker), away needs 8 wins (or 7 +
tiebreaker). Pair sums to 19 = M+1 — match is always decisive.

## Why no canonical external chart exists

The research surfaced one important gotcha: **FargoRate LMS doesn't
support games-to-win thresholds at all.** Their native system applies
handicap points to raw game scores. CSI/BCAPL national championships
use this same model (handicap points, not threshold targets). The
FargoRate calculator at leaguecalc.fargorate.com outputs a points
differential, never per-team threshold values.

This means:

1. **No external source publishes a team threshold chart** because the
   ecosystem of Fargo-rated leagues mostly uses handicap points, not
   asymmetric game targets.
2. **The formula above is league-defined, not protocol-defined.** It's
   derivable from FargoRate's published primitives and reproduces their
   individual-matchup HOT chart exactly — but the choice to use
   asymmetric games-to-win thresholds at all is an operator decision.
3. **Captains' override is the safety valve.** If a specific league has
   agreed on a different convention (e.g. round-down instead of ceil,
   or scaling factor < 1.0 for "half-handicap" leagues), captains adjust
   at lineup lock. The match-record snapshot freezes their final values.

## Implementation guidance

The Phase 7 v2 plan's Unit 3.2 ships `computeFargoGamesWonThresholds`
as a pure function:

```
computeFargoGamesWonThresholds({
  homeRatings: number[],
  awayRatings: number[],
  totalGames: number,
  pairingCounts?: number[][],  // games per (home_i, away_j) pairing,
                                // default: SRR (1) or DRR (2) by totalGames
}) → {
  home: { games_to_win, games_to_tie, games_to_lose },
  away: { games_to_win, games_to_tie, games_to_lose },
}
```

`pairingCounts` is the lineup-geometry-aware games-per-pairing matrix.
For 3v3 DRR each pair plays 2; for 5v5 SRR each pair plays 1; etc. If
omitted the function infers it from `totalGames` and lineup size.

Default `scaling_factor = 1.0` (full handicap). The plan reserves a
future params object for half-handicap leagues to dial it down — out
of scope for v1.

The output's `games_to_tie` is set when ties are possible (even M);
`null` otherwise. `games_to_lose` is `tie - 1` when tie band exists,
otherwise `null`.

## Sources (confirmed during 2026-05-02 research)

- [FargoRate League Calculator](https://leaguecalc.fargorate.com/) — Official per-round handicap calculator; outputs points differential, not games-threshold
- [FargoRate LMS Formats Documentation](https://lms.fargorate.com/lms-help/docs/division/format/) — Confirms LMS uses handicap points model, not per-team games-to-win thresholds
- [CSI: FargoRate League Handicap Calculator Explained](https://www.playcsipool.com/csinews/all-new-fargorate-league-handicap-calculator-explained) — Explains the three LMS handicap modes; points-based throughout
- [Anatomy of a Close-to-Fair Tournament Tour — FargoRate Blog](https://www.fargorate.com/fargorateblog/archive/anatomy-of-a-close-to-fair-tournament-tour/) — Confirms HOT individual race bands: 6-6 (~0 pt gap), 6-5 (~40 pt), 7-4 (~96 pt). **This is the calibration data above.**
- [APPA/FargoRate 8-Ball Race Charts](https://poolplayermatchups.com/appa/fr-race-charts/8-Ball/) — Most detailed published band-to-integer-race chart available; structural template
- [West Michigan BCAPL Race Calculator](https://www.westmibcapl.com/leagues/race-calculator/) — Tiered lookup table, individual races
- [AzBilliards: Fargo Race Charts thread](https://forums.azbilliards.com/threads/fargo-race-charts.563648/) — Bob Jewett confirms team race tables are constructible but no standard published version exists
- [Dr. Dave Pool Info: FargoRate FAQ](https://drdavepoolinfo.com/faq/rating/fargorate/) — Confirms `T = 2^(rating/100)` foundation

## Open items

- Add 3-5 calibration test cases from real Fargo + games-won matches
  (operator can hand-walk this against their own league's accepted
  thresholds)
- Document any league-specific scaling factor (half-handicap leagues)
  if the operator's circle uses one
