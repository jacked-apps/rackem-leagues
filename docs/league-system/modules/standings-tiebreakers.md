---
title: Standings & Tiebreakers (Module)
date: 2026-05-17
status: active
audience: developer + AI sessions
---

# Standings & Tiebreakers

## Kind

**Standings & Tiebreakers is a [System](../PRINCIPLES.md#system--deep-dive)-kind Module that bundles three independent configuration axes** — **standings sort precedence**, **match-night tiebreaker trigger**, **match-night tiebreaker format** — that together govern *what happens when the simple winner-comparison ties* at two distinct scopes: across an entire season (standings) and at a single match-night (tiebreaker play). The Module name is plural because it bundles two related-but-distinct concerns that share a common conceptual root ("tie resolution") but operate at different temporal scopes and produce different artifacts.

(Why this matters: the kind tells you what to expect. This Module has N orthogonal axes; legal configurations are the constrained Cartesian product across them. Each axis is set independently; the *variant* is the resulting triple, not a packaged option pulled off a shelf. The two-scope bundling is a deliberate anti-conflation move — see [§Architectural intent](#architectural-intent-two-scopes-one-module-distinct-failure-modes).)

## Essence

**Standings & Tiebreakers** answers the two distinct questions every league faces when "X beat Y" is not a sufficient answer:

1. **Across the season, when two teams have the same record, who finishes higher?** — resolved by `standings_sort`, a priority-ordered list of comparison metrics. The standings algorithm walks the list left-to-right, finding the first metric on which the tied teams differ, and orders them by that metric.

2. **At a single match-night, when the regular-play game count ends with both teams equal, what (if anything) happens next?** — resolved jointly by `tiebreaker_trigger` (does an extra-play tiebreaker fire?) and `tiebreaker_format` (if so, what shape does it take?). When the trigger fires, the match-night extends with additional game slots whose results decide the match's overall winner without contributing to per-match points (see [§Interaction with the locked tie-band rule](#interaction-with-the-locked-tie-band-rule)).

The Module holds *no behavior* directly — like other configuration Modules, it is a passive specification record. The standings algorithm, the tiebreaker trigger evaluation, and the tiebreaker scoring runtime all consume its axes and execute the logic; the Module itself just declares the configuration.

## Why this Module exists

Both scopes — season standings and match-night tiebreakers — are operational decisions every league must make, and both have multiple legal answers that produce different competitive characters. Without an explicit Module declaring the choices, each scope's behavior would be implicitly baked into per-system code (the historical bundling state — see [§Implementation status](#implementation-status)) and impossible to vary without rewriting.

**Season-standings sort precedence captures league identity.** A league that prioritizes `[match_wins, games_won, points_earned]` (the shipped default) communicates "your match record matters most, with games and points as secondary tiebreakers." A league that prioritizes `[points_earned, match_wins, games_won]` communicates "raw scoring volume matters first." The choice is a real philosophical statement about what the league rewards — and changing it mid-season would invalidate established rankings and undermine team strategic decisions made under the prior priority.

**Match-night tiebreaker behavior captures competitive completeness.** When [Team Geometry](team-geometry.md)'s game count is even (e.g., 3v3 DRR's 18 games) and the [Win Calculator](win-calculator.md) reads games, a 9-9 tie is mechanically possible — and the league must decide whether to accept the tie as the match's final outcome, play short extra games to decide, or escalate to a manual ruling. The choice has direct downstream effect on standings (an accepted-tie match contributes 0.5 to each team's `match_wins`; a tiebreaker-decided match contributes 1.0/0.0). Without this axis, even-game-count leagues would either have ambiguous match outcomes or hidden hard-coded tiebreaker rules.

The two scopes bundle into one Module because they share the **same conceptual root** ("a tie occurred, resolve it") and because their settings frequently interact — e.g., a league that uses `tiebreaker_format='accept_tie'` for match-night ties needs its `standings_sort` to handle fractional `match_wins` cleanly; a league using `'best_of_3_short_race'` produces integer match wins and may use simpler standings sort precedence. The bundling does **not** mean they operate at the same scope or fire on the same events — see [§Architectural intent](#architectural-intent-two-scopes-one-module-distinct-failure-modes).

## Boundary

Standings & Tiebreakers is **only** the season-level standings ordering and the match-night tiebreaker triggering + format. It is **not**:

- **The mid-match in-game tie band rule** — the locked invariant in `src/systems/calculators/linear_above_threshold.ts` that 3v3 9-9 produces 0 per-match points regardless of who wins the subsequent tiebreaker. That rule lives inside the [Points System](points-system/README.md)'s `linear_above_threshold` calculator; the Standings & Tiebreakers Module declares *that the tiebreaker fires* and *what shape it takes*, but the rule that *tiebreaker outcomes do not contribute to per-match points* is a Points System concern. See [§Interaction with the locked tie-band rule](#interaction-with-the-locked-tie-band-rule) for the precise division.
- **The Win Calculator's per-match decision logic** — which metric decides the match (games vs points) is the [Win Calculator](win-calculator.md) Module's `win_condition` axis. Standings & Tiebreakers consumes the Win Calculator's per-match output (winner declared, or tied) and aggregates it across the season; it does not itself decide individual match outcomes.
- **The Points System's allocation math** — points accumulated per game come from the [Points System](points-system/README.md). Standings & Tiebreakers consumes per-team `points_earned` totals for its `standings_sort` axis but does not produce or modify them.
- **Playoff bracket generation, end-of-season seeding, championship structure** — these are **downstream** of the standings this Module produces. A separate Playoff Module (currently not modularized; lives as `src/utils/playoff/playoffGenerator.ts`) consumes the final standings and produces bracket shape. Standings & Tiebreakers does not see playoff games.
- **Forfeit handling** — what happens when a team can't field a lineup. Forfeits produce match outcomes (forfeit win/loss) that feed standings, but the rule for *what counts as a forfeit and its associated penalties* is an application-level concern outside the modular Scoring System (not a Module of this set).
- **Substitution rules, roster mutation, eligibility for tiebreaker play** — application-level concerns outside the modular Scoring System. Standings & Tiebreakers declares the *match-night tiebreaker shape* (e.g., "best of 3 short races"); *which players are eligible to play in the tiebreaker* (must they have played in the regular match? can a sub be inserted?) is governed by application-level substitution rules, not by any Module in this set.
- **The runtime data tiebreaker games accumulate** — game outcomes for tiebreaker games are stored in `match_games` rows with elevated `game_number` values (e.g., games 19-21 for the 3v3 best-of-3 tiebreaker). The schema accommodates this; the Module declares the count and shape but does not own the storage.

If a proposed feature changes *the season standings sort order or the match-night tiebreaker firing/shape*, it belongs here. If it changes *the in-game tie-band points rule*, it belongs in the Points System calculator. If it changes *which metric decides a single match*, it belongs in Win Calculator. If it changes *who plays in the tiebreaker*, it belongs in application-level substitution rules (not a Module of this set).

### Architectural intent: two scopes, one Module, distinct failure modes

**Two scopes are bundled, but their failure modes are independent.** Season-standings ties and match-night ties are operationally distinct events with different consequences:

| Scope | When it fires | What it produces | Failure mode if mishandled |
|---|---|---|---|
| Season standings | End of season (or any standings render mid-season) | Ordered league table | Two teams share a rank → playoff seeding ambiguous → potentially undecidable bracket |
| Match-night | At regular-play game count, when both teams have equal aggregate metric | Either a final match outcome (accept_tie) or extra game slots producing a decisive outcome | Match-night ends ambiguously → standings can't record win/loss → cascading ambiguity into the season-standings scope |

The Module bundles both because they share a conceptual root and frequently interact (a match-night that accepts ties produces 0.5/0.5 contributions to `match_wins`, which the season-standings sort must handle), but the two axes operate independently — `standings_sort` does not affect `tiebreaker_trigger`, and vice versa. A future refactor *could* split them into two Modules (Standings, Match-Tiebreakers); the bundling is a v1 convenience that aligns with the shared-root intuition.

**Anti-conflation with in-game tie band.** The match-night tiebreaker (this Module) and the in-game tie-band rule (Points System calculator) are **two different things that frequently get conflated**. The tie-band rule is a per-match-points calculation rule that says "if your regular-play `games_won` lands in the tie band [`games_to_tie`, `games_to_win`], your per-match points are 0 regardless of what happened later." The match-night tiebreaker is the *what happens later* — extra games that decide match-win/loss but do not retroactively change the per-match points. The Module boundary explicitly enforces: this Module declares the tiebreaker existence and shape; the calculator owns the absorb-tiebreaker-outcomes-at-zero rule. See [§Interaction with the locked tie-band rule](#interaction-with-the-locked-tie-band-rule).

**Composition with the rest of the Scoring System is orthogonal but constrained by upstream choices.** Any Standings & Tiebreakers triple is architecturally composable with any Team Geometry × Handicap System × Mechanism × Threshold Chart × Points System × Win Calculator combination — though some combinations produce trivially-vacant tiebreaker logic (e.g., `tiebreaker_trigger='even_total_games_only'` with an odd-game-count Team Geometry never fires, harmless but pointless). The Combo Coherence validator at preference-write time can warn against such configurations; the Module itself accepts any valid triple per [§Validation invariants](#validation-invariants).

## The three axes

Each axis has a value-space, a default, and a validation rule. Presented in dependency order — `tiebreaker_format`'s meaningfulness depends on `tiebreaker_trigger` firing.

### `standings_sort` — priority-ordered season-standings sort keys (always-computed fast path)

| Attribute | Value |
|---|---|
| **Type** | `TEXT[]` (Postgres array of text) |
| **Allowed element values** | `'match_wins'`, `'games_won'`, `'points_earned'` |
| **Element order** | priority — leftmost is highest precedence |
| **Element multiplicity** | each value appears at most once (no duplicates); array may be a subset of the allowed values |
| **Currently shipped default** | `['match_wins', 'games_won', 'points_earned']` |
| **Evaluation timing** | computed on every standings render — these three metrics are per-team aggregates already maintained by the scoring runtime, so sorting on them is cheap |
| **Validation** | DB CHECK constraint `preferences_standings_sort_values_check` ensures `standings_sort <@ ARRAY['match_wins', 'games_won', 'points_earned']` (subset check); no duplicate enforcement at schema layer (application-layer responsibility) |

**Operational meaning.** When the standings algorithm encounters two teams with the same `match_wins`, it walks the `standings_sort` array left-to-right, finding the first key on which the teams differ. Teams are ordered by that key (descending — higher value wins the tiebreaker for ranking purposes). If all keys in the array tie between two teams, the standings UI surfaces the tie to the LO and escalates to **LO manual designation** — the operator enters the ranking directly. This case is astronomically rare in practice; a richer head-to-head resolution mechanism is named in [§Future possibilities](#future-possibilities) but is not currently built.

**Why these three values and no others.** The three metrics every season tracks at the team level are: match outcomes (`match_wins`, including draws as 0.5), games won across all matches (`games_won` — the sum across all match nights), and points earned across all matches (`points_earned` — the sum across all match nights). These are the *only* metrics consistently available across all Scoring Systems regardless of Win Calculator choice, Points System configuration, or Team Geometry shape. Per-game streaks, strength-of-schedule, longest active win streak, fewest forfeits, and other derived metrics are not currently first-class — they would extend the Module's allowed element set if introduced.

**Why array-of-keys rather than fixed precedence.** Different leagues legitimately rank these three metrics in different orders. A league emphasizing match record uses `[match_wins, games_won, points_earned]` (the default). A league emphasizing scoring volume might use `[points_earned, match_wins, games_won]`. A league running pure-games-won (no points tracked) might use `[match_wins, games_won]` only. Array structure accommodates all these orderings cleanly.

**Anti-conflation note.** This is *season-standings* sort precedence, not *per-match* tiebreaker logic. A match's winner is decided by [Win Calculator](win-calculator.md) reading per-match data; `standings_sort` only matters when the *season-level aggregate* of those per-match results produces two teams with identical `match_wins`. The two scopes do not interact at the per-match decision layer.

**N-way ties at standings are solved by the same sort algorithm.** Three or more teams tied on `match_wins` walk through the same `standings_sort` precedence; teams that remain tied after all three keys escalate to LO manual designation (same as 2-team ties). The Module deliberately does NOT support scheduling extra playoff matches between tied standings teams as a standings tiebreaker — that infrastructure complexity exceeds the value it would provide given the rarity of all-three-layers-tied scenarios, and LO manual designation handles the rare cases cleanly.

### `tiebreaker_trigger` — when does match-night extra play fire

| Attribute | Value |
|---|---|
| **Type** | enum: `'even_total_games_only'` \| `'never'` |
| **Currently shipped values** | `'even_total_games_only'` (Points 3-Man — 3v3 DRR has 18 games), `'never'` (Percentage 5-Man, FargoRate 10-Point 5-Man — both have 25 games, odd count means mechanical ties on game-win count are impossible) |
| **Default for new leagues** | `'never'` |
| **Validation** | DB CHECK constraint enumerating the allowed values |

**Operational meaning.**

- **`even_total_games_only`** — the tiebreaker fires when (a) the match's regular-play game count completes (Team Geometry's `game_count` reached) AND (b) both teams have equal aggregate metric per the Win Calculator's `win_condition` axis (equal games_won when win_condition='games'; equal points_earned when win_condition='points'). The "even_total_games_only" name reflects that for `win_condition='games'`, an *odd* game count makes equal-games-won mathematically impossible (one side must win at least ⌈game_count/2⌉ + 1 games), so the trigger condition is vacuously false. For `win_condition='points'`, equal-points-earned is theoretically possible at any game count but typically rare (depends on per-game allocator distributions).

- **`'never'`** — no match-night tiebreaker ever fires. Matches that end with equal aggregate metric are recorded as ties (contributing 0.5 to each team's `match_wins`). Used by leagues where ties are acceptable as outcomes — typically odd-game-count or points-based leagues where mechanical ties are rare enough that the extra-play infrastructure isn't worth the operational overhead.

**Why these two specifically, not more variants.** The two-option set covers the operational extremes (always-trigger-if-possible vs never-trigger). A theoretical `'always'` variant doesn't make practical sense (a match where one team won 18-0 doesn't need a tiebreaker), and conditional triggers ("trigger only on certain match types" or "trigger only late in the season") would slot in as additional enum values if introduced. The current set is the minimum viable.

**Anti-conflation note.** The trigger condition references Team Geometry's `game_count` and Win Calculator's `win_condition` axis — both Modules read by the tiebreaker-evaluation runtime, not by this Module directly. This Module just declares "if a tie occurs at regular-play end under the conditions implied by `win_condition`, fire the tiebreaker." The runtime evaluates the conditions.

### `tiebreaker_format` — what shape does the match-night tiebreaker take

| Attribute | Value |
|---|---|
| **Type** | enum (8 values; see operational meaning below) |
| **Allowed values** | `'best_of_3_short_race'`, `'single_short_race'`, `'accept_tie'`, `'manual'`, `'coin_flip'`, `'random_player_single_game'`, `'random_player_short_race'`, `'teams_self_determine'` |
| **Currently shipped values** | `'best_of_3_short_race'` (Points 3-Man), `'accept_tie'` (Percentage 5-Man, FargoRate 10-Point 5-Man — `tiebreaker_trigger='never'` so this value is vacuously selected) |
| **Default for new leagues** | `'accept_tie'` |
| **Validation** | DB CHECK constraint enumerating the allowed values |

**Operational meaning of each variant:**

- **`best_of_3_short_race`** — a best-of-3 series of additional games appended to the match (e.g., games 19, 20, 21 in 3v3 DRR's 18-game match). First team to win 2 of the 3 wins the match. The third game may be skipped if the second decides the series (team won 19 and 20 → team wins match without playing 21). Used by Points 3-Man currently. Per-game points from these tiebreaker games are absorbed at zero per the locked tie-band rule (see [§Interaction with the locked tie-band rule](#interaction-with-the-locked-tie-band-rule)).

- **`single_short_race`** — one additional game (a single rack, or possibly a short race-to-N depending on Match Format) appended to the match. The team that wins it wins the match. Simpler than best-of-3; faster to play; higher variance. No shipping consumer currently.

- **`accept_tie`** — no additional play. The match is recorded as a tie. Each team contributes 0.5 to `match_wins`. The match's regular-play results stand as final.

- **`'manual'`** — the LO is prompted to enter the tiebreaker result directly (winner team + optional score adjustments) rather than the runtime playing out a defined extra-play sequence. Used when the tiebreaker rule isn't pre-codified — e.g., "the captains rock-paper-scissors," "the league policy is to defer to the prior match's winner," "the host venue's house rules apply." The `ManualTiebreakerDialog` component is the operator-facing surface. Per Phase 4 Unit 4.4 of the modular-league v2 plan.

- **`'coin_flip'`** — one team is declared the match winner by random coin-flip outcome (or in-app RNG equivalent). Zero additional pool play. Fastest possible resolution; pure variance with no skill component. Suitable for leagues that prioritize finishing on time over competitive resolution; sometimes selected when both teams agree the match was effectively even and don't want to extend the night.

- **`'random_player_single_game'`** — one player from each team is randomly selected; those two play a single rack to decide the match. Adds a skill component back into the resolution while keeping the extra-play overhead to one game. Random selection method (RNG, captain's call, etc.) is application-level. The selected players' handicaps may or may not apply depending on whether the league wants the tiebreaker game to honor handicaps — runtime configuration not part of this axis.

- **`'random_player_short_race'`** — one player from each team is randomly selected; those two play a short race-to-N (typically race-to-3 or race-to-5; the N is application-configurable, not part of this axis). Higher fidelity than single game, lower overhead than full match replay. May or may not honor handicaps per league preference.

- **`'teams_self_determine'`** — the two teams resolve the tiebreaker among themselves by whatever method they choose (their own coin flip, their own short race, their own captain-talk, etc.) and report the winner to the operator. Functionally similar to `'manual'` but with the framing that *the teams* decide rather than the LO — distinct accountability model. The runtime presents a "report tiebreaker winner" prompt to the teams' scorekeepers rather than to the LO.

**Why this many variants.** Pool leagues invent local tiebreaker rules constantly. The enum captures the operationally common patterns (codified best-of-3 race, single race, coin flip, random-player play, accept the tie) plus the two escape hatches (`'manual'` for LO-decides, `'teams_self_determine'` for teams-decide). Any local rule that doesn't fit one of the codified variants slots into one of the escape hatches. This honors Principle 10's composability guarantee (the system always produces *some* outcome) without forcing every local rule to be enumerated as a first-class variant.

**Cross-axis interaction.** When `tiebreaker_trigger='never'`, `tiebreaker_format` is vacuously satisfied — the trigger never fires, so the format never gets consulted. The convention is to set `tiebreaker_format='accept_tie'` in this case for explicit-intent documentation, but any value is legal at the schema layer.

**Handicap interaction.** For the play-based variants (`'best_of_3_short_race'`, `'single_short_race'`, `'random_player_single_game'`, `'random_player_short_race'`), whether the tiebreaker games honor handicap (apply per-pairing race-length adjustment, start_points bonuses, etc.) is application-configurable and not part of this axis. The Module declares the *format*; the runtime decides whether the league's [Handicap Mechanism](handicap-mechanisms/README.md) extends to tiebreaker games or not (typically not — tiebreaker games are short by design and additional handicap layering can make them feel arbitrary).

## Validation invariants

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| `standings_sort` elements are subset of allowed values | schema CHECK constraint `preferences_standings_sort_values_check` | DB rejects unknown element values |
| `standings_sort` is non-empty AND no duplicates | application-layer (no schema CHECK currently) | preference write rejected with operator-facing error |
| `tiebreaker_trigger IN ('even_total_games_only', 'never')` | schema CHECK constraint | DB rejects unknown values |
| `tiebreaker_format IN ('best_of_3_short_race', 'single_short_race', 'accept_tie', 'manual', 'coin_flip', 'random_player_single_game', 'random_player_short_race', 'teams_self_determine')` | schema CHECK constraint | DB rejects unknown values |
| All three axes immutable post-season-lock | schema-level season-stability lock trigger (Standings & Tiebreakers axes are in the lock set) | UPDATE on locked preferences blocked at DB layer |
| Combo coherence: `tiebreaker_trigger='even_total_games_only'` with odd `game_count` is vacuous-but-legal | application-layer combo coherence warning | warns at LO setup; runtime evaluates the trigger condition normally (falsey for odd count) |
| Combo coherence: `tiebreaker_format='best_of_3_short_race'` with `pairing_format='race_to_n'` requires defined extra-pairing semantics | application-layer combo coherence (currently undefined behavior) | warns at LO setup; runtime falls back to `'manual'` per Principle 10 graceful degradation |

The last two rows highlight known coherence gaps where combinations are *legal at the Module layer* but produce *operationally awkward outcomes* downstream. The combo coherence validator at preference-write time can warn; the runtime defends with graceful fallback.

## Match-night N-way ties (3+ teams)

A match night involves exactly two teams; therefore a match-night tie is always between exactly two teams. N-way ties (3+ teams) cannot occur at the match-night scope. **This is the load-bearing reason the `tiebreaker_format` axis is scoped to 2-team resolution only** — adding N-way tiebreaker formats to this axis would over-engineer the Module for an event that cannot mechanically occur.

(N-way ties at the *season-standings* scope ARE possible and are resolved by the layered `standings_sort` algorithm + LO-manual final fallback — see [`standings_sort`](#standings_sort--priority-ordered-season-standings-sort-keys). The Module does NOT support scheduling extra playoff matches between tied standings teams as a tiebreaker mechanism; that infrastructure complexity exceeds the value given the rarity of all-sort-layers-tied scenarios.)

## Interaction with the locked tie-band rule

This Module declares **that** the tiebreaker fires and **what shape** it takes. The *per-match points consequence* of the tiebreaker is owned by the [Points System](points-system/README.md)'s `linear_above_threshold` calculator's locked tie-band rule. The division is precise and load-bearing:

**Owned by this Module (Standings & Tiebreakers):**
- The trigger condition for firing the tiebreaker (`tiebreaker_trigger`)
- The shape of extra play when it fires (`tiebreaker_format`)
- The fact that tiebreaker games append to the regular game sequence with elevated `game_number` values
- The match outcome contribution to season standings (1.0 / 0.0 for tiebreaker-decided matches; 0.5 / 0.5 for `accept_tie`)

**Owned by the Points System calculator (`linear_above_threshold`'s tie-band rule):**
- The rule that per-match points for a side landing in the tie band (regular-play `games_won` between `games_to_tie` and `games_to_win`) is 0 regardless of tiebreaker outcome
- The rule that tiebreaker game outcomes are *not* counted in the per-match points calculation (the calculator's `games_won` input excludes tiebreaker games — the runtime is responsible for filtering)
- The principle that the tiebreaker decides match-win/loss but does not retroactively change per-match points

**The flow when a tiebreaker fires (Points 3-Man example):**
1. Regular play completes at game 18 with teams tied 9-9.
2. Runtime evaluates `tiebreaker_trigger='even_total_games_only'` → trigger fires.
3. Runtime instantiates extra game slots per `tiebreaker_format='best_of_3_short_race'` (games 19, 20, 21).
4. Tiebreaker games play out; one team wins 2 of 3.
5. **Standings & Tiebreakers ownership:** the match's winner is recorded as the tiebreaker winner; match contributes 1.0 to winner's `match_wins`, 0.0 to loser's.
6. **Points System ownership:** when `linear_above_threshold.compute` runs to determine per-match points, it receives `games_won` excluding the tiebreaker games (9 for each team), lands both teams in the tie band, returns 0 per-match points for each.

The two Modules cooperate without overlapping. Standings & Tiebreakers cannot change the points rule (locked in the calculator). The calculator cannot change the trigger/format (declared by this Module). Each is the sole owner of its concern.

## How this Module interacts

**Upstream (Modules and runtime this Module consumes):**
- **[Team Geometry](team-geometry.md)** — `game_count` informs whether the trigger condition is mechanically possible (even vs odd count for games-based win condition). The Module does not read Team Geometry directly; the runtime tiebreaker-evaluation step does.
- **[Win Calculator](win-calculator.md)** — `win_condition` informs which aggregate metric is checked for equality at regular-play end. Again, runtime-mediated, not direct.
- **[Points System](points-system/README.md)** — per-match points (`points_earned` summed across matches) feeds the `standings_sort` array's `points_earned` element.
- **The scoring runtime** — produces per-match outcomes (winner, games-won pair, points-earned pair) that this Module's season-standings aggregation consumes.

**Sibling:**
- **All other Scoring System Modules** — Standings & Tiebreakers does not directly read or write to Handicap System, Handicap Mechanism, Threshold Chart, or Match Format. The interactions all flow through the per-match results those Modules produce.

**Downstream (consumers of this Module's output):**
- **The standings page UI** (`src/operator/Standings.tsx` or similar) — reads `standings_sort` to determine column order and sort priority; reads aggregated per-team data to render the table.
- **The playoff bracket generator** (`src/utils/playoff/playoffGenerator.ts`) — consumes final-season standings to produce bracket seeding. The bracket generator does not itself read `standings_sort`; it reads the already-sorted standings list this Module's algorithm produces.
- **The tiebreaker scoring runtime** — when `tiebreaker_trigger` fires, the runtime instantiates the extra game slots per `tiebreaker_format` and routes scoring through the appropriate UI (`ManualTiebreakerDialog` for `'manual'`, the standard scoring popup with elevated game numbers for the race variants).
- **The end-of-season reporting / playoff scheduling** — downstream of standings, beyond the modular Scoring System's scope.
- **Mobile app's standings views** (if any) — reads the same aggregated data; the mobile app does not implement its own sort logic, relies on what the server-side standings algorithm produces.

## Implementation status

The locked [`README.md`](../README.md) establishes the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Standings & Tiebreakers' situation:

- The three axes live as columns on the `preferences` table.
- The `standings_sort` sort algorithm is implemented in `src/utils/playoff/playoffGenerator.standingsSort.ts` (or equivalent — naming approximate); the implementation has a characterization test (`playoffGenerator.standingsSort.characterization.test.ts`) per Phase 5 Unit 5.3 of the v2 plan.
- The tiebreaker trigger and format are evaluated by the scoring runtime at match-completion; this evaluation is scattered across multiple files (`MatchEndVerification`, `computeMatchResult` in `bca3v3.ts`, etc.) rather than centralized in a Standings & Tiebreakers Module instance.
- **Tiebreaker game-slot generation** — when this Module's `tiebreaker_trigger` fires, the runtime appends extra game slots with elevated `game_number` values (e.g., games 19-21 for 3v3 best-of-3). These extra slots are NOT generated by [Pairings Generator](pairings-generator.md) — Pairings Generator's scope is the regular round-robin pairing set, and its output is immutable for that round. Today the runtime hardcodes the tiebreaker-slot append; architecturally this is a distinct generator concern (a tiebreaker mini-match has its own pairing shape — often "one player from each team plays one short race" rather than full round-robin). A future Tiebreaker Generator (likely a variant or peer of Pairings Generator) would formalize this concern. Conceptually the tiebreaker is "a new mini-match" — same architectural pattern as the regular match (lineups + rules → game-slot list), invoked separately when the trigger fires.
- The `ManualTiebreakerDialog` component exists for the `'manual'` format; the UI surface for the `best_of_3_short_race` and `single_short_race` formats reuses the standard scoring popup with elevated game numbers (`src/utils/tiebreaker/gameNumbers.ts` computes the game-number offsets).
- The locked tie-band rule's tiebreaker-outcome-absorption is implemented in `linear_above_threshold.ts` (caller's responsibility to pass `games_won` excluding tiebreaker games; the calculator does not filter — that's the runtime's job in the per-game scoring mutation).
- No standalone Standings & Tiebreakers Module instance exists today; the Module's behavior is the aggregate of these scattered pieces.

The Step-2 refactor lifts Standings & Tiebreakers out as a first-class Module with its own typed contract, consolidates the trigger/format evaluation into a single runtime entry point, and clearly defines the boundary with the Points System calculator's tie-band rule (which stays in the calculator). The known triple-tie gap is documented for future resolution; no v1 fix is in scope.

## Future possibilities

- **LO-invoked head-to-head tie resolution.** When the always-computed `standings_sort` keys leave two or more teams tied, an LO-invoked action could query the matches the tied teams played against each other and compute h2h-scoped versions of the three metrics to break the tie. Build deferred until requested by an operator; when built, will likely include configurable h2h priority order, partial-round-robin composition rules for N-way ties, and other dials. Intentionally out of current scope to avoid pulling resources on an unbuilt fallback for an astronomically-rare condition.
- **Additional `standings_sort` elements.** Strength-of-schedule (weighted by opponents' average rank), longest active win streak, fewest forfeits, point-differential per match. Each new element requires its own season-aggregation calculation and would extend the allowed-values set.
- **Additional `tiebreaker_trigger` variants.** `'always_when_possible'` (trigger even on odd-game-count for the rare points-tie cases), `'playoff_eligible_matches_only'` (trigger only on matches that affect playoff seeding), `'commissioner_discretion'` (LO decides per-match whether to fire).
- **Additional `tiebreaker_format` variants.** `'series_until_decided'` (no fixed count; play until one team wins 2 in a row), `'point_count_threshold'` (first team to earn N additional points wins, where points come from extra games), `'sudden_death_break'` (single break-and-out attempt per side; first to win their rack outright wins the match).
- **LO-defined custom standings sort with score weights.** Currently `standings_sort` is a strict-precedence list; a future variant could declare weighted-sum scoring (`0.6 × match_wins + 0.3 × games_won + 0.1 × points_earned`) for leagues that want hybrid measures. Requires schema extension and new sort algorithm path.

The category is open. Adding a new `standings_sort` element requires defining the season-aggregation calculation and updating the sort algorithm. Adding a new `tiebreaker_trigger` or `tiebreaker_format` variant requires the corresponding evaluation/runtime logic.

## Source of truth

- `src/types/preferences.ts` — `standings_sort`, `tiebreaker_trigger`, `tiebreaker_format` column types
- `src/types/resolvedSystemConfig.ts` — `ResolvedSystemConfig` carries the resolved Standings & Tiebreakers triple post-cascade
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` (lines 137–178 for the three axes) — schema definitions, defaults, CHECK constraints including `preferences_standings_sort_values_check`
- `supabase/migrations/20260418000002_lock_tier1_preferences.sql` — Postgres trigger enforcing season-stability immutability (Standings & Tiebreakers axes are in the lock set)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — `resolved_league_preferences` view applies the 3-tier cascade for the three axes
- `src/utils/playoff/playoffGenerator.standingsSort.ts` (naming approximate) — sort algorithm implementation
- `src/utils/__tests__/playoffGenerator.standingsSort.characterization.test.ts` — characterization tests locking current sort behavior
- `src/utils/tiebreaker/gameNumbers.ts` — game-number offset helpers for tiebreaker games (games 19-21 for 3v3 best-of-3)
- `src/components/scoring/ManualTiebreakerDialog.tsx` — operator-facing UI for `tiebreaker_format='manual'`
- `src/systems/calculators/linear_above_threshold.ts` (docstring + tie-band section) — the locked tie-band rule that absorbs tiebreaker outcomes at zero per-match points
- `src/components/scoring/MatchEndVerification.tsx` — tiebreaker trigger evaluation at match completion (currently scattered across this and `computeMatchResult` in the per-system files)
- `src/wizards/league-v2/steps/` — wizard step(s) for collecting the three axes; currently mostly derived from preset selection rather than independently chosen
