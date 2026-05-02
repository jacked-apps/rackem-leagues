---
title: Fargo handicap → games-to-win threshold — research stub
date: 2026-05-01
status: UNRESOLVED — research artifact placeholder; web research blocked in planning environment
gates: docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 3.2 Fargo Layer 1, extra_games math)
---

# Fargo handicap → games-to-win threshold

## Status: UNRESOLVED

Web search was attempted during planning on 2026-05-01 and blocked at the
tool layer (no `WebSearch` / `WebFetch` available in the research subagent
environment). This document is therefore a **stub**: it captures what we
know, what we'd need to confirm against authoritative sources, and where
to look. Future sessions or manual research should replace this content
with the canonical formula or chart values.

## Purpose

This document will (when complete) capture the official or community-standard
method for calculating per-team `games_to_win` thresholds in a Fargo-handicapped
league when:

- `handicap_type = 'fargo'`
- `mechanism = 'extra_games'` (higher-rated team must win extra games to compensate)
- `win_condition = 'games'` (match decided by games-won, not points)

This is structurally distinct from the **start-points formula** documented
at `docs/research/fargorate-formula.md`, which covers the points-scoring
case (`mechanism = 'start_points'` + `win_condition = 'points'`).

**Operational framing:** When this formula is found, our implementation
only needs to be **close enough to be a useful default**. Captains can
override at lineup lock if the official source disagrees. Same posture
as the start-points formula.

## What we already know (carries over from the start-points research)

The base FargoRate transformation is:

```
T = 2^(rating / 100)
```

For Player A vs Player B in N games:

```
P(A wins single game) = TA / (TA + TB)
Expected wins for A   = P(A wins) × N
Expected wins for B   = (1 - P(A wins)) × N
```

For a TEAM match with M total games (e.g. M=18 for 3v3 DRR, M=25 for 5v5 SRR):

```
Σ (Expected wins per matchup) = team's expected total wins
```

In an even match (zero rating gap) each team's expected wins = M/2. In a
gapped match, the higher-rated team's expected wins exceed M/2 by some
amount Δ (call it the "expected win differential").

## Logical derivation (NOT YET CONFIRMED against canonical source)

If a published Fargo games-won threshold formula exists, it likely takes
this shape:

```
games_to_win_for_higher_team = ceil(M/2) + round(Δ × scaling_factor)
games_to_win_for_lower_team  = M + 1 - games_to_win_for_higher_team
```

Where:
- `Δ` = expected-win-differential (computed from per-pairing T-ratio sums)
- `scaling_factor` = some published constant (likely 1.0 — full
  compensation — but could be 0.5 for "half-compensation" leagues, or
  variable per league)
- The `+1` ensures the pair sums to `M+1` (matches the BCA convention
  where home_to_win + away_to_win = total_games + 1)

**This is a reasonable starting guess, NOT a citation.** Real-world
Fargo leagues likely use a published chart or a slightly different
formula (e.g., different rounding, different scaling, or different
treatment of edge cases like exactly-zero-gap or extreme-gap).

## What needs to be confirmed against authoritative sources

1. **Is there a published chart** (analogous to BCAPL's Skill Level
   Playing Handicap Chart) mapping team-rating-differential bands to
   per-team games-to-win values?
2. **Or is it a formula** — and if so, what's the exact scaling factor,
   rounding rule, and edge-case behavior?
3. **Does the threshold depend on total games M?** An 18-game format
   and a 25-game format should produce different thresholds even at
   the same rating gap.
4. **Multiple variants in use?** E.g., do different league
   implementations (LeagueSys, BCA app, league-specific custom
   software) produce slightly different threshold values for the
   same rating gap?

## Where to look (research checklist)

In approximate priority order:

1. **fargorate.com directly** — look for a "Race Calculator," "Games-Won
   Calculator," or downloadable handicap chart. The site published the
   start-points materials; if a games-won variant exists, this is the
   first place it would be.
2. **AzBilliards FargoRate subforum** — Mike Page (FargoRate's creator)
   posts there directly. He has discussed games-won team handicapping
   in past threads; specific posts may state the formula.
3. **leaguesys.com** — LeagueSys is the dominant Fargo-based league
   management tool. Their handicap chart documentation likely
   describes the games-won case in detail.
4. **playbca.com / BCAPL operator materials** — if BCAPL-sanctioned
   leagues use Fargo-based games-won handicapping (rather than only
   their own SL system), their handbook or LO manual would document it.
5. **CSI Pool / playcsipool.com** — they hosted the worked example in
   the start-points doc; may have a parallel article for games-won.
6. **Dr. Dave Pool Info — FargoRate** (drdavepoolinfo.com/faq/rating/fargorate/)
   — community cross-reference; sometimes consolidates formulas the
   official sources scatter across multiple posts.
7. **Reddit r/billiards, r/poolplayers** — search for "Fargo team
   handicap games won" or similar. Practitioner posts can cite the
   actual chart values their leagues use.

## Suggested confirmation steps once a candidate formula is found

1. Hand-walk the formula on 2–3 known matches where the actual
   threshold was published (e.g., real BCA-touching league results).
2. Compare against the start-points-formula derivation: in a points-mode
   match the same teams produce a known start-points value; the
   games-won threshold should be derivable from the same
   `T = 2^(rating/100)` foundation, so the two outputs should be
   internally consistent (e.g., the team that "earns" a 27-point
   start-points credit in points mode should "need" some specific
   number of extra games in games mode for the same matchup).
3. If multiple sources publish slightly different formulas, document
   each variant and let the LO pick (Layer 3 chart override).

## Implementation guidance (until canonical source is found)

Unit 3.2 of the implementation plan ships a **graceful-fallback stub**:

- `applyExtraGames(homeRatings, awayRatings, totalGames, params)`
- Default `scaling_factor = 1.0` (full compensation)
- Use the logical derivation above (ceiling of M/2, plus expected-win
  differential, sum-to-M+1 invariant)
- Marked `confidence: 'extrapolated'` in the output so the wizard /
  match-end UI can surface "this threshold is a community-standard
  approximation, not a published chart" to the LO

When canonical research lands, the implementation either:
(a) replaces the formula with the published one, or
(b) keeps the stub formula and adds the published chart as a Layer 2
preset that overrides it for specific known combinations.

## Sources (placeholders — to be filled when research lands)

- _Authoritative formula source: TBD_
- _Published chart values: TBD_
- _Calibration data: TBD_

## Open items

- Replace this stub with the canonical formula or chart
- Add 3–5 calibration test cases (real matches with confirmed
  thresholds from the official source)
- Document any variants observed across major Fargo-using
  league-management tools
- Clarify whether the formula is published anywhere or whether it's
  community convention with no single canonical source (in which case
  this stub's approximation may be the most authoritative thing the
  app has, and Layer 3 override is the LO's path to dial it in)
