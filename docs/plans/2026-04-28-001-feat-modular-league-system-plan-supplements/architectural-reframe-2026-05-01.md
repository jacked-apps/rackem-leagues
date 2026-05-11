---
title: "Architectural reframe — modular league system"
date: 2026-05-01
type: supplement
status: load-bearing
parent_plan: docs/plans/2026-04-28-001-feat-modular-league-system-plan.md
---

# Architectural reframe — modular league system

> **Why this exists:** Through ~30 commits of implementation work on the
> modular-league-system refactor, a series of architectural conflations
> surfaced that the original 2026-04-28 plan didn't catch. This document
> captures the corrections **in the user's voice**, preserves the failure
> modes that produced the conflations, and states the corrected model
> cleanly enough that future sessions can inherit the right understanding
> without re-deriving it.
>
> **This document is the source of truth for the architecture.** The
> next planning pass (`/ce-plan`) reads this as primary input.

## 1. The corrected axis model

Seven orthogonal axes. Any combination of values across these axes
must compose. None of them imply or constrain any other.

| Axis | What it answers | Values |
|---|---|---|
| `lineup_size` | How many players play per match? | 3, 4, 5, 6 (count) |
| `game_generation` | How are games generated from the lineup? | `single_round_robin`, `double_round_robin` |
| `handicap_type` | How do we compute a numeric rating per player? | `fargo`, `points`, `percentage`, `skill_level`, `none` |
| `mechanism` | How is the handicap applied to the match? | `extra_games`, `start_points`, `race_length_adjustment`, `none` |
| `points_calculator` | How are team points calculated? | `null` (don't track points), `linear_above_threshold`, `accumulate_with_milestone_jumps`, `accumulated_per_game`, future shapes |
| `win_condition` | What decides the match winner? | `games` \| `points` (binary) |
| `threshold` | The numeric targets per match | shape depends on `win_condition` (see below) |

### What "we always track" means

Two things are always tracked per match, regardless of any preference:

1. **Games won by home team, games won by away team.** Always. Simple count.
2. **Points** — only when `points_calculator` is non-null. The calculator
   formula determines what gets accumulated.

### Threshold shape per `win_condition`

- **`win_condition = 'games'`** — per-team `games_to_win`, optional
  `games_to_tie`, optional `games_to_lose`. Examples: 10 of 18 (BCA 3v3
  with handicap), 13 of 25 (5v5 even), 14 of 25 / 12 of 25 (5v5
  handicapped). Pair generally sums to `total_games + 1`.
- **`win_condition = 'points'`** — per-team `points_target` and/or
  `start_points`. Examples: first-to-100, weaker-team-starts-with-50,
  both (start with 50, first to 200), or play-all-games-no-target
  (compare totals at the end).

### Concrete combinations that should compose

The model passes only if ALL of these are valid leagues the wizard
can produce:

- 6-player lineup using `linear_above_threshold` points calculator with
  a `points` handicap, `extra_games` mechanism, single-RR generation,
  `games` win condition. (A 6-player BCA-flavored league.)
- Same as above but with a `fargo` handicap. (Fargo ratings used to
  compute extra-games threshold; games still decide the match.)
- 4-player lineup using `accumulated_per_game` points calculator with
  a `points` handicap, `start_points` mechanism, double-RR generation,
  `points` win condition, no points target (highest at end wins).
- A "pure games" league: `points_calculator: null`, `win_condition: games`.
  We count games. We don't compute points. Games decide.

If any of these combos breaks because of a hidden coupling, the model
is still wrong.

## 2. Points-calculator architecture

### The pattern

Same shape as `threshold_charts`:
- The runtime knows the **type** (which formula function to call).
- It is **parameter-blind** (it just plugs param values into the formula).
- The LO can edit the **params** to get the behavior they want; runtime
  behavior doesn't change.

### Storage

On `preferences` (and frozen on `match.system_snapshot`):

- `points_calculator: TEXT NULL` — the type name, or `NULL` to skip points entirely.
- `points_calculator_params: JSONB` — typed-per-calculator parameter object.

### The three calculator types we know we need today

#### `linear_above_threshold`

> **Three-band behavior — DO NOT change in refactor.** Match-end points
> are linear ONLY outside the tie band. Inside the band, points are
> always 0 regardless of how the match resolves.
>
> Given thresholds `games_to_win = W`, `games_to_tie = T` (when ties are
> configured; otherwise `T = W`):
>
> - **Above-win band:** `games_won > W` → `(games_won - W) * per_extra_game_multiplier`
> - **Tie band:** `T <= games_won <= W` → `0` (always 0, both teams)
> - **Below-tie band:** `games_won < T` → `(games_won - T) * per_extra_game_multiplier`
>
> When ties are NOT possible (`games_to_tie = null`), the tie band
> collapses to a single value at `games_won == W` (which still scores 0)
> and the formula reduces to `games_won - W`.

> **The user-specified rule (locked in):** "If I need 10 to win or 9 to
> tie, and the regular games end 9-9, the match goes to a tiebreaker.
> If I win the tiebreaker, I do NOT get -1 points (because I 'fell
> short' of my 10-game target) — I get **0 points**. If I lose the
> tiebreaker, I do NOT get -1 points either — I still get **0 points**.
> The tiebreaker decides match-win/loss; per-match points come from
> the regular-game count only, and the tie band absorbs both outcomes
> at 0."
>
> Mechanically: tiebreaker games are stored with `is_tiebreaker = true`
> and excluded from the per-team `games_won` count that this formula
> consumes. Both teams' regular games_won values stay in the tie band,
> so both score 0. The match-result column captures who won the
> tiebreaker; the points column is unchanged from the tie-band 0.

> **Worked examples** (using BCA 3v3 default `W=10, T=9` in an 18-game match):
>
> | regular games_won | band | points (multiplier=1) |
> |---|---|---|
> | 12 | above-win | +2 |
> | 11 | above-win | +1 |
> | 10 | tie band (at W) | 0 |
> | 9  | tie band (at T) | 0 (regardless of tiebreaker outcome) |
> | 8  | below-tie | -1 |
> | 7  | below-tie | -2 |

> **Parameters:**
> ```
> { per_extra_game_multiplier: number }   // default 1
> ```
>
> The multiplier scales the linear bands only; it never moves the tie
> band off zero. An LO who sets `2` gets +2/+4/+6 above-win and -2/-4
> below-tie, but tie-band rows stay at 0.

> **Tested Preset value (BCA 3v3 today):** `per_extra_game_multiplier: 1`.

#### `accumulate_with_milestone_jumps`

> **What it does:** Monotonic per-game accumulation with two stepped
> jumps. Below the milestone target → linear at the small increment.
> At/above the milestone → jump to a fixed value, then resume linear.
> At/above the win threshold → jump to a higher value, then resume
> linear. Always non-negative; no tie band.

> **Formula (verified against `calculateBCAPoints` in `src/types/match.ts`):**
> ```
> milestone_target = round(games_to_win * milestone_percent)   // straight round, not ceil
>
> if games_won >= games_to_win:
>     points = win_threshold_jump_value + (games_won - games_to_win) * per_game_increment
> else if games_won >= milestone_target:
>     points = milestone_jump_value + (games_won - milestone_target) * per_game_increment
> else:
>     points = games_won * per_game_increment
> ```

> **No tie-band rule here.** Unlike `linear_above_threshold`, this
> formula is monotonic and treats `games_to_tie` as decorative — only
> `games_to_win` and the milestone matter. This is fine for BCA 5v5
> (25 games, odd, can't tie). If an LO ever pairs this calculator
> with an even-game format that CAN tie, the formula doesn't have
> special tie-band treatment — it just keeps accumulating linearly.
> Whether that's the right behavior or whether it should grow a
> tie-band variant is an open question for the planning pass.

> **Parameters:**
> ```
> {
>   per_game_increment: 0.1,
>   milestone_percent: 0.7,
>   milestone_jump_value: 1.5,
>   win_threshold_jump_value: 3.0
> }
> ```

> **Worked examples** (BCA 5v5 default, team needs 13 wins; milestone
> target = round(13 * 0.7) = 9):
>
> | games_won | region | points |
> |---|---|---|
> | 14 | above-win | 3.0 + 0.1 = 3.1 |
> | 13 | at-win | 3.0 (jump) |
> | 12 | between milestone and win | 1.5 + (12-9)*0.1 = 1.8 |
> | 10 | between milestone and win | 1.5 + (10-9)*0.1 = 1.6 |
> | 9 | at-milestone | 1.5 (jump) |
> | 8 | below-milestone | 8 * 0.1 = 0.8 |
> | 0 | below-milestone | 0 |

> **Tested Preset value (BCA 5v5 today):** the parameter values above.
> An LO who wants different jump values or a different milestone
> percentage can edit those.

#### `accumulated_per_game`

> **What it does:** Each game contributes points to its team's total.
> Winner gets a fixed value; loser gets points based on balls pocketed.

> **Formula:** For each game, winner team += `winner_points`; loser
> team += `min(loser_balls_pocketed * loser_per_ball_multiplier, loser_max)`.

> **Parameters:**
> ```
> {
>   winner_points: 10,
>   loser_per_ball_multiplier: 1,
>   loser_max: 7
> }
> ```

> **Tested Preset value (Fargo 10-7 today):** the values shown above.
> An LO who wants a 15/1.2 league sets `winner_points: 15,
> loser_per_ball_multiplier: 1.2`. Runtime doesn't care.

### `points_calculator: null`

The league doesn't track points at all. No formula runs. Standings
sort priority cannot include `points_earned`. Match-end UI omits
the points display. `win_condition` must be `games`.

### Future calculator types

The registry is open. As LOs surface other formulas (or BCA / CSI
mandate new ones), more types get added. Each type declares its
parameter schema; the runtime composes the same way.

## 3. Tested Preset framing

The three existing modules (`bca3v3`, `bca5v5`, `fargo5v5`) **are not
the architecture**. They are wizard-card UX bundles — fully-specified
sets of axis values that real LOs have used and validated.

### UX

Wizard's "League Format" step shows preset cards labeled something
like "**Tested Preset**" or "**Community Preset**" — a trust signal.
Each card shows what it bundles. Picking a card fills in all 7 axes
with the preset's values; LO can still edit anything in League
Settings later.

### What goes on a Tested Preset card

| Axis | BCA 3v3 | BCA 5v5 | Fargo 5v5 10-7 |
|---|---|---|---|
| lineup_size | 3 | 5 | 5 |
| game_generation | double_round_robin | single_round_robin | single_round_robin |
| handicap_type | points | percentage | fargo |
| mechanism | extra_games | extra_games | start_points |
| points_calculator | linear_above_threshold | accumulate_with_milestone_jumps | accumulated_per_game |
| points_calculator_params | `{ per_extra_game_multiplier: 1 }` | `{ per_game_increment: 0.1, milestone_percent: 0.7, milestone_jump_value: 1.5, win_threshold_jump_value: 3.0 }` | `{ winner_points: 10, loser_per_ball_multiplier: 1, loser_max: 7 }` |
| win_condition | games | games | points |
| tiebreaker | even_total_games_only / best_of_3_short_race | never / accept_tie | never / accept_tie |

### Off-preset warning UX

When the wizard's review step detects a combination that doesn't match
a Tested Preset bundle, it warns:

> "This combination hasn't been validated by other leagues. Scoring
> may not match what you expect — you can adjust the chart values
> and formula parameters in League Settings to dial it in."

The LO can save anyway. Graceful degradation. The runtime executes
whatever combo the LO picked using the composed strategies.

## 4. Anti-patterns (my failure modes captured verbatim)

This section preserves the corrections so future sessions don't slip
back into the same conflations. Each entry shows what was wrong and
why.

### Anti-pattern: "Fargo path" implies points scoring

**What I said:** Routed `points_10_7` scoring → "use fargo5v5's
`scoring.computeMatchResult` directly."

**User correction:**
> "fargo path is NOT 10-7 scoring. fargo can be 10-7 it also can be a
> threshold games won. fargo is the handicap system used to calculate
> the weight given by a stronger team/player. that's it. it says
> nothing of how the rest of the game is set up. 10-7 is ONE way we
> calculate points. period. so we need at least 4 preferences to
> determine [this combination]."

**What this means:** `handicap_type=fargo` describes ONLY the rating
system. It says nothing about points calculation, win condition, or
threshold mechanism. Don't bundle Fargo's existing 10-7 scoring path
as if it's "the Fargo way." It's one valid combo of independent axes.

### Anti-pattern: "BCA 3v3" / "BCA 5v5" as scoring methods

**What I said:** Proposed scoring method names like `bca_3v3_threshold_bonus`
and `bca_5v5_percentage_tiers`.

**User correction:**
> "3 v 3 has NOTHING to do with scoring system AT ALL. stop tying
> things together. the scoring system CAN be a 5v5 and be one that
> counts above the threshold. and vice versa. M O D U L A R!!!
> EVERYTHING separate! 3v3 is ONLY How many people in the lineup that
> is it, that is all it should determine. just because that is the
> one we have HERE does not mean its how it must be."

**What this means:** Lineup size determines the COUNT of games
generated, period. It does not constrain scoring formula choice.
The "linear above threshold" formula and the "milestone jumps" formula
work on any lineup size. They take a threshold value and a games-won
value as inputs. They have no awareness of lineup geometry.

### Anti-pattern: `pure_games_won` as a "scoring method"

**What I said:** Listed `pure_games_won` as one of the scoring method values.

**User correction:**
> "pure games won is NOT a points system. if for some reason they
> want NO part of calculating points the points system would be
> null. (and it is points system NOT scoring. scoring is how we are
> calculating 2 separate things. games won and points. we keep
> track of two things to keep score. games and points. always.)"

> "pure games won sounds like - win condition games + points
> calculation null"

**What this means:**
1. The axis is `points_calculator`, not `scoring_method`. We always
   track games AND points (when calculated). "Scoring" was a misleading
   umbrella term.
2. `null` is a valid value for `points_calculator`. It means
   "don't compute points at all."
3. "Pure games-won league" is not a special calculator type — it's
   the combination of `points_calculator: null` + `win_condition: games`.

### Anti-pattern: Per-pair-of-games bonus

**What I said:** Described BCA 3v3 points formula as "+2 per pair of
games over threshold."

**User correction:**
> "why are you points per pair over? its per game over. in our 3v3
> setup if the threshold to win is 10 and my team hits 12 i get the
> win plus 2 points. if we hit 11 i get the win plus 1 points. what
> pair is that?"

**What this means:** I conflated two unrelated formulas in the codebase.
The per-match `calculatePoints` formula is **linear per game over
threshold**. The `floor(differential / 2)` formula is the
**season-level home-team handicap bonus** based on cumulative
standings — a totally separate thing. Don't conflate per-match
points formulas with season-level standings adjustments.

### Anti-pattern: `win_condition` with four values

**What I said:** Proposed `win_condition` with four values:
`first_to_games | first_to_pairings | highest_after_all_games | total_points_target`.

**User correction:**
> "win condition. this can either be games or points. ONE of the 2
> things we calculate. can only be one or the other."

**What this means:** `win_condition` is binary. It's a choice
between the two metrics we always track. The "first_to_X" vs
"highest_after_all_games" distinction is encoded by the THRESHOLD
values, not by a separate axis. If you have a games target, the match
ends early once one team reaches it. If you don't (open-ended), you
play all games and compare totals at the end. Same for points
(targeted vs play-it-out).

### Anti-pattern: Calculator type bundles parameter values

**What I said:** Proposed calculator types with hardcoded values like
`accumulated_per_game_10_7` (10 winner, 7 max balls).

**User correction:**
> "accumulated per game may not always be 10-7. it could be a 10-0 or
> some other unknown system that someone has come up with. ... we
> treat the formula as the type so it can change from a 10 7 to a 15
> 8.4 and the system just uses it the same right? it doesn't care
> what the exact formula is."

**What this means:** Calculator type = the formula SHAPE. Calculator
params = the values plugged in. The type is `accumulated_per_game`;
the params determine whether it's 10/7 or 15/8.4 or 14/0. The runtime
calls the same function with whatever params are stored. The LO can
edit the params and the runtime keeps working without code changes.

### Anti-pattern: Tiebreaker outcome leaking into the points calculation

**The rule, in the user's words:**
> "but points are calculated above either the to win or if a tie is
> possible the to tie. if i need 10 to win or 9 to tie. it goes to a
> tie. and i win the tiebreaker i don't get -1 points (i needed 10
> to win) i get 0 points. if i lose i don't get -1 point i still
> get 0. its a small but important distinction. and i don't want
> that changed in the calculations somehow by accident."

**What this means:**
1. The `linear_above_threshold` formula has a **tie band** between
   `games_to_tie` and `games_to_win` (inclusive on both ends). Inside
   that band, points are 0. Both teams. Always.
2. Tiebreaker games (`is_tiebreaker = true`) are EXCLUDED from the
   per-team `games_won` count that the formula consumes. The
   tiebreaker decides match-win/loss; it must NOT shift a team's
   `games_won` out of the tie band.
3. A team that won 9 of 18 regular games + won the tiebreaker still
   has `games_won = 9` for points purposes. That's in the tie band.
   They get 0 points. The match-result column says they won.
4. A team that won 9 of 18 regular games + LOST the tiebreaker also
   has `games_won = 9` for points purposes. Same tie band, same 0
   points. Match-result says they lost.

**Why this matters in the refactor:** The `tallyMatchTotals`
decomposition must continue to read regular-only `games_won` for
the calculator's input. Mixing tiebreaker games into the count
would bump a "tied at 9-9, won tiebreaker" team to `games_won =
10 or 11`, push them into the above-win band, and award positive
points where the league rule says 0. Easy to break by accident
when refactoring. This anti-pattern + the formula spec in
Section 2 lock the rule.

**Tests guarding this:** `getTeamHandicapBonus.characterization.test.ts`,
`match-scoring.characterization.test.ts`, and the existing
`calculatePoints` tests cover the three-band behavior + the
tiebreaker-exclusion. Every refactor must keep those green.

### Anti-pattern: God-function `computeMatchResult`

**What I said:** Built `SystemModule.scoring.computeMatchResult` as a
single function that did everything: tally points, add start-points
credit, cascade points → games-won, fall back on a tiebreaker.

**Why it's wrong:** Bundles four independent concerns into one function.
`points_calculator` should drive tallying. `mechanism` should drive
the start-points credit (or whatever handicap shape). `win_condition`
should drive the cascade direction. Tiebreaker is its own axis.
Routing combos through this function imports all four bundled
concerns regardless of correctness.

**What this means:** `computeMatchResult` decomposes into:

- `recordGameOutcome(outcome)` — UI outcome → stored game fields. Pure scoring concern.
- `tallyMatchTotals(games, points_calculator, params)` — sum stored games into `{ home_points, away_points, home_games, away_games }`. NO start-points credit. NO win cascade.
- `applyHandicapCredit(totals, mechanism, threshold_values)` — apply start-points credit (or whatever handicap shape) to the totals.
- `determineWinner(totals, win_condition)` — pick winner based on the configured axis.

`buildSystemFromPreferences` composes these from independent dispatch
on each axis, NOT from delegation to preset modules.

## 5. Honest re-status of shipped units

Status legend:
- ✅ correct — no revision needed
- 🟡 partial / needs revision under the new model
- 🔴 superseded — values or names change in the new plan

| Unit | Status | Reason |
|---|---|---|
| Phase 0 (research + characterization) | ✅ | Tests still apply; characterization fixtures protect refactor |
| Unit 1.1 (status-aware tier-1 lock) | ✅ | Independent of scoring axes |
| Unit 1.2 (`SystemModule.key` widening) | ✅ | Type change still right |
| Unit 1.3 (mechanism-discriminated thresholds) | ✅ | Mechanism axis is correct in the new model |
| Unit 2.1 (modular preference columns) | 🟡 | `scoring_method` column needs to become `points_calculator`. New `points_calculator_params` JSONB column needed. `win_condition` column value space simplifies from 4 to 2. |
| Unit 2.2 (snapshot writer + ResolvedSystemConfig) | 🟡 | Type and writer need to match the corrected axis names + add `points_calculator_params` |
| Unit 2.3 (resolved view + audit log table) | 🟡 | Resolved view needs to expose corrected column names |
| Unit 2.4 (threshold_charts production RLS) | ✅ | Independent of scoring axes |
| Unit 5.1 (buildSystemFromPreferences) | 🟡 | Fast-path through preset modules works (characterization equivalence). Ad-hoc path routes through god-functions = wrong. Needs decomposition + per-axis dispatch (see Section 4 anti-pattern). |
| Unit 5.2 (snapshot reads + team_format removal) | 🟡 | Snapshot-first reads correct. The `is5v5 = lineup_size === 5` derivation in MatchEndVerification is the wrong axis — should dispatch on `points_calculator` (or rather, on the decomposed tally function). |
| Unit 5.3 (sortStandings helper) | ✅ | Reads `standings_sort` priority correctly |
| Unit 5.4 (tiebreaker game numbers) | ✅ | Independent of scoring axes |
| Unit 4.1 (wizard expansion) | 🔴 | `ScoringMethodStep` options ("winner_takes_all", "points_10_7", "race_winner") are conflated bundles. Needs full rework as a calculator-type-with-params step. `WinConditionStep` collapses from 4 options to 2. |
| Unit 6.1 (atomic rating-mutation RPCs) | ✅ | Audit infrastructure unaffected by scoring reframe |

Phase 3 (threshold layer wiring), Phase 4.2/4.3, Phase 6.2, Phase 7,
Phase 8 are not started — they should be planned against the new
model from the start.

## 6. Open questions for ce-plan

These need decisions in the new plan, not the supplement:

### 6.1 DB shape for points-calculator params

- **Option A:** `points_calculator_params: jsonb` column on `preferences`
  + `system_snapshot`. Single row per league preference. Simple.
- **Option B:** Sibling `points_calculator_charts` table parallel to
  `threshold_charts`. Each chart row holds typed params for one
  calculator type. LO can save multiple configs and swap between them.
  More flexible.
- **Recommendation:** A for v1. B if/when LOs need swappable configs.

### 6.2 Migration approach

Dev data is disposable per project memory. Recommend `db reset` rather
than transforming existing rows. Fresh DB after migration.

### 6.3 `win_condition: 'points'` threshold storage

Existing columns `home_games_to_win` / `away_games_to_win` were named
for games. For points-based win conditions, do we:

- Repurpose the same columns (numeric values can hold either
  game-counts or point-targets; `win_condition` disambiguates)?
- Add new columns (`home_points_target` / `away_points_target` /
  `home_start_points` / `away_start_points`)?
- Generic columns (`home_threshold_value` / `away_threshold_value`)?

Repurpose is cheapest; generic naming is cleanest; new columns are
most explicit. Pick one.

### 6.4 Race-format pairings

Does `race_winner_per_pairing` need to exist as a `points_calculator`
type at all, or does race-to-N just produce a "game-win" the same way
a single-rack pairing does?

If race-to-N pairing produces one game-win for whichever side wins
the race (regardless of margin), then the existing games-won counting
applies naturally and there's no special calculator needed. The race
length is on the pairing-format axis, not the points-calculator axis.

**Recommendation:** Treat race-to-N as producing one game-win per race.
No special calculator type. `race_winner` disappears from the
`points_calculator` value space.

### 6.5 "Early termination" — separate axis or implicit in threshold?

Some leagues play all games regardless (Fargo 10-7 25-game format).
Others end early once a team can't be caught (BCA "first to 10 of 18").

Two ways to model:
- **Implicit:** `games_to_win` set → match can end early. `games_to_win`
  null/equals total_games → play all games.
- **Explicit:** Separate `early_termination` boolean axis.

Implicit is simpler if the threshold encodes it cleanly. Explicit is
more surfaced in the wizard. Pick one.

### 6.6 Wizard step for points-calculator

Replaces my Unit 4.1 `ScoringMethodStep`. Card-selector showing each
calculator type with name + definition + formula + worked example +
default params. Selecting a card reveals editable param fields with
Tested Preset defaults pre-filled. "None — don't track points" is
one of the cards.

How does the params editing UI surface? Inline on the card after
selection? Next-step? Edit-later in League Settings?

**Recommendation:** Inline expansion under the selected card showing
editable fields with defaults. LO can leave defaults or edit. Easy
to revisit later in settings.

### 6.7 `accumulate_with_milestone_jumps` + even-game format

The milestone-jumps formula is monotonic with no tie band — fine for
BCA 5v5 (25 games, odd, can't tie). But if an LO pairs this calculator
with an even-game format where ties ARE possible (e.g. 4v4 single-RR
= 16 games), the formula doesn't have special tie-band treatment.

Two options for the new plan:
1. **Variant calculator type** — add a `milestone_jumps_with_tie_band`
   shape that has the three-band behavior of `linear_above_threshold`
   but with milestone jumps in the above-win and below-tie regions.
2. **Compose vs declare incoherent** — let the LO pair
   `accumulate_with_milestone_jumps` with even-game formats and the
   formula does its monotonic thing; the combo-coherence validator
   warns "this calculator doesn't handle ties — the team that just
   barely tied at the threshold gets the same points as a team that
   blew through it." LO can save anyway.

**Recommendation:** option 2 for v1 (keep the calculator registry
small; warn rather than auto-create variants). Add a variant later
if a real LO needs it.

### 6.8 Combo coherence validator (Unit 4.2) — what flags as incoherent?

Now that the model is cleaner, the validator can be more honest:

- `points_calculator: null + win_condition: points` — ERROR (can't decide
  by points if you don't track points)
- Combo not matching any Tested Preset bundle — WARNING (off-preset)
- Calculator + handicap + mechanism that has no calibrated formula —
  WARNING (graceful fallback applies, results may not match LO expectations)

Probably need a small enumeration of known-bad combos.

## 7. What the next planning pass should produce

A fresh plan that:

1. Supersedes the 2026-04-28 plan (old plan stays as historical record)
2. Has a "Already shipped" section listing the merged commits + per-unit
   status (per Section 5 of this supplement)
3. Defines the corrected axis model (per Section 1) as the data shape
4. Defines the points-calculator registry + params storage (per Section 2)
5. Plans the unit work for the corrections:
   - DB column rename + new params column (Phase 2 revision)
   - Decomposed SystemModule strategies (new Phase 5.5)
   - `MatchEndVerification` refactor to call into composed strategies (new Phase 5.6)
   - `ScoringMethodStep` → `PointsCalculatorStep` rework (Phase 4.1 revision)
   - Combo coherence validator with the new value space (Phase 4.2)
   - Calculator chart editor UI (new Phase, sibling to Unit 3.4)
6. Maintains the BCA-pitch demo subset framing — what's required for the
   meeting vs what's post-meeting polish
7. Resolves the open questions from Section 6

The plan is the implementation roadmap. This supplement is the
architectural mental model. Both are needed.

## 8. Implementation conventions for the new plan

Workflow rules that apply across all units in the forthcoming plan.
ce-plan should propagate them to per-unit checklists where relevant.

### 8.1 Consolidate migrations within a PR before merge

During development of a unit it's normal to write migration A
("add columns X, Y, Z"), then realize column Y isn't actually
needed, and write migration B ("drop column Y"). Before opening
the PR for review, **consolidate** — replace migration A with a
clean version that just adds X and Z; delete migration B.

**The committed migration history should reflect the final shape of
the change, not the development journey.**

**Why:**
- A developer running `supabase db reset` from scratch shouldn't
  have to apply add-then-drop noise.
- Migration log is a documentation artifact; intent should be
  visible at a glance.
- Easier to review: one migration with one purpose beats a sequence
  of course-corrections.

**When the rule applies:**
- Within a single open PR / unmerged WIP → yes, consolidate.
- After merge to main → never edit history. Forward-only correction
  migration only.

**Per-unit checklist item:** before any unit's PR is marked ready
for review, verify "migrations within this unit consolidated to a
single forward-only intent." If multiple migrations exist within
the unit's scope, each must represent a distinct logical change,
not a correction.

This applies to all DB-touching units across Phases 2, 3, 6, and 7
of the new plan.

### 8.2 Tests verify the modular guarantee, not just the preset behavior

When a refactor changes how the runtime composes per-axis strategies,
characterization tests on the three Tested Presets prove backwards
compatibility — but they don't prove the modular composition works.
Each unit that introduces or revises a per-axis dispatch should also
test at least one **off-preset combination** to prove the axes really
are independent. Otherwise we ship something that says "modular" on
the label but only ever runs through the preset fast-path.

Concrete example: when `tallyMatchTotals` decomposes from the
god-function, tests should include a 4-player lineup using
`linear_above_threshold` points calculator (an off-preset combo) to
prove the calculator works at lineup sizes other than 3.

### 8.3 Defer parameter-editing UI per unit

Each calculator type's parameters become editable through League
Settings, but the editing UI ships in its own unit (sibling to the
threshold-chart editor). Until that ships, the wizard sets parameters
to Tested Preset defaults and saves them; LOs cannot edit later. This
is acceptable for the BCA-pitch demo subset — Tested Presets work
out of the box; custom parameter editing is post-meeting polish.

## 9. Pre-implementation research tasks

These are research items the new plan must schedule as Phase 0
prerequisites — they gate specific implementation units. ce-plan
should treat them like the original 2026-04-28 plan treated the
"Phase 0a research" task: blocking, output captured as a
research artifact under `docs/research/` or a supplement memo,
referenced by the gated unit.

### 9.1 Fargo handicap → games-to-win threshold (NEW research task)

**Why we need this:** The April 2026 research (captured in
`docs/research/fargorate-formula.md`) covered ONE specific
combination: `handicap_type=fargo` + `mechanism=start_points` +
`win_condition=points`. The formula transforms each player's rating
to `T = 2^(rating/100)`, expected-wins is the T-ratio over total
games, start-points falls out from the per-team expected score
differential.

That formula does NOT directly answer: when an LO configures a Fargo
league with `win_condition=games` (each team has a games-to-win
threshold instead of a points target) and `mechanism=extra_games`
(higher-rated team must win more games to compensate), what's the
per-team `games_to_win` threshold derived from the team rating
differential?

**The user's report:** "Evidently there is a method they use. That
is widely in use and I need this app to be able to handle that as
well if possible."

So there is a community-standard way to do this — the research needs
to find it.

**Specific questions:**

1. **Is there a published Fargo chart** (analogous to BCAPL's Skill
   Level Playing Handicap Chart) that maps team-rating-differential
   to a per-team games-to-win threshold for a games-won win condition?
2. **Or is it a formula** (likely derived from the same `T = 2^(rating/100)`
   transform, plus expected-wins, plus a rounding rule)?
3. **Does the threshold depend on total games in the match?** A
   18-game format and a 25-game format have different thresholds
   even at zero rating gap (~9-10 vs ~13). The Fargo math should
   produce different thresholds for the same rating gap across these
   formats.
4. **What's the source of truth?** FargoRate's "Behind the Curtain"
   (the source for the start-points formula), FargoRate website
   calculators, league-management software (LeagueSys, BCA app),
   community forums, sanctioned league handbooks?
5. **Does it match what BCA / CSI sanction?** FargoRate is the
   official rating system of BCA + CSI; whatever they publish is
   likely the demo-relevant answer.
6. **What does "widely in use" point to?** Specific leagues / orgs
   the user can name? The research should cite those if possible.

**Deliverable:** A new file at `docs/research/fargo-games-won-threshold.md`
mirroring the format of `docs/research/fargorate-formula.md`. It
should include:
- The formula or chart values (with worked examples)
- Source citations
- Calibration data (real-world matches showing the formula's outputs
  matching what FargoRate's calculator produces)
- Notes on edge cases (rating gap = 0, extreme gaps, mismatched
  lineup sizes if relevant)
- An "operational framing" note matching the existing fargo doc:
  the formula only needs to be "close enough to be a useful default";
  captains can override at lineup lock if the official source disagrees

**Gates:** Unit 3.2 (Fargo Layer 1 generative engine) cannot finalize
its `extra_games` math for `handicap_type=fargo` without this research.
A graceful-fallback stub can ship before the research lands, but the
real formula must be in place before the BCA-pitch demo to credibly
claim "we support Fargo handicaps for any win condition."

**Web research starting points** (ce-plan's research subagent should
search):
- "FargoRate handicap chart games to win"
- "FargoRate team handicap calculator"
- FargoRate's own site (fargorate.com) for chart downloads
- BCA's own materials at playbca.com
- "Behind the Curtain" Fargo blog / posts
- LeagueSys / BCA app handicap chart documentation
- USAPL / BCAPL handbooks (these may describe Fargo-based
  handicapping if their league uses Fargo for some divisions)

### 9.2 Other research items already on Phase 0 from the original plan

These remain pending (per original 2026-04-28 plan's Phase 0a):

- Mobile-app `team_format` grep (Jack's repo) — gates Phase 7
- BCAPL Playing Handicap Chart sourcing — gates Unit 3.3
- Specific Fargo logistic divisor validation (100 vs 144) — gates
  Unit 3.2 (start-points side)

The new plan should preserve these and add 9.1 as a peer.

## 10. Things worth saving for future sessions (TL;DR)

If a future session reads only one paragraph from this whole document,
read this:

> Lineup size is a count. Game generation is a structure. Handicap type
> is just a rating system. Mechanism is just how the handicap is applied.
> Points calculator is a formula type with editable parameters; it can
> be null. Win condition is a binary choice between the two metrics we
> always track (games and points). Threshold values depend on win
> condition. None of these axes imply or constrain any other. The three
> existing modules (`bca3v3`, `bca5v5`, `fargo5v5`) are wizard-card
> "Tested Preset" bundles — convenient axis-value snapshots, not
> architecture. The runtime composes from per-axis dispatch; it never
> branches on "is this the Fargo preset" or "is lineup size 5."
