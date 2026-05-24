---
title: Pairings Generator (Module)
date: 2026-05-17
status: active
locked: true
audience: developer + AI sessions
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Pairings Generator

## Kind

**Pairings Generator is a [System](../PRINCIPLES.md#system--deep-dive)-kind Module in the chain pattern.** It composes three sub-Mechanisms — **pair generation**, **game ordering**, **break/rack assignment** — that run in sequence to transform two locked lineups into a concrete, fully-specified sequence of head-to-head game slots. Unlike Modules like Team Geometry and Match Format — which each just bundle a few independent configuration axes that sit alongside each other inertly — Pairings Generator's sub-Mechanisms are ordered stages: each consumes the previous stage's output.

(Why this matters: knowing the kind tells you what to expect inside. A chain-pattern System has N stages that ALL run, each transforming the previous stage's output. There is no "Pairings Generator preset" to pick; the *variant* is the tuple of sub-Mechanism choices for each of the three stages, and the runtime is the composition of those choices applied to the lineups.)

## Essence

A **pairings generator** takes the lineups two teams have locked in for a match night plus the structural rules governing the match (Team Geometry's `lineup_size` and `game_generation`; Match Format's `pairing_format`) and produces the **concrete game-slot list** the scoring runtime will fill in over the course of the night. Each entry in the output list specifies: which home-team player faces which away-team player, what position that game occupies in the sequence (game 1, game 2, … game N), and which player breaks vs racks. The Module produces nothing else; everything that happens *after* the list is materialized — actually playing the racks, scoring points, applying handicaps, deciding the match winner — belongs to other Modules.

Pairings Generator is *active*, not *passive*. It does real work each time a match starts: combinatorial generation of the pairing set, sequencing into a play order, and per-game break/rack assignment. The output is deterministic given its inputs and the chosen sub-Mechanism variants. It runs once per match (typically at the lineup-lock step, when both teams have committed their player order for the night), and its output is immutable for that match — change-of-mind by a captain mid-match is handled by application-level substitution rules, not by re-running this Module.

**Scope: regular round-robin play only.** This Pairings Generator's job is the *round-robin* pairing set (full SRR or DRR cross-product) for the main match. Two adjacent concerns use the SAME architectural pattern (lineups + rules → game-slot list) but are NOT this Module:

- **Tiebreaker pairings** — when [Win Calculator](win-calculator.md)'s metric stack walker reaches `edge` and fires the [Tiebreak System](tiebreak-system/README.md) chain, the [`mini_match`](tiebreak-system/mini-match.md) Tiebreak Mechanism needs a pairing set for its short round. Either a future variant of this Module (re-invoked with mini-match parameters) or a peer Tiebreaker Pairings Generator handles those slots. Today, the runtime appends hardcoded tiebreaker game slots (games 19-21 for 3v3 best-of-3); the Step-3+ refactor formalizes this as a distinct generator concern that the `mini_match` Mechanism invokes at runtime.
- **Individual race pairings** — when `pairing_format='race_to_n'` lands (future format), each pairing becomes a race-to-N sub-match. The pairing-generation pattern is the same (lineups → ordered pairings) but the per-pairing internal structure is different. Likely another future variant of this Module's family (or a peer Race Pairings Generator).

Round-robin, tiebreaker, and race generators share the architectural pattern (chain-pattern System taking lineups + rules and producing a deterministic game-slot list) but each handles a distinct invocation context. This blueprint covers the round-robin case currently shipped in the 3 prepackaged Scoring Systems; the other two are future scope.

## Why Pairings Generator exists

The transform from "two ordered lineups of length N" to "a fully specified game schedule for the night" is the most algorithm-heavy step in the entire Scoring System runtime, and it is **not** mathematically trivial:

- The set of pairings to play is a combinatorial choice (full round-robin? partial? Swiss? bracket?) that affects total game count, per-player exposure, and competitive character.
- The order in which the pairings are played is a sequencing choice that affects per-night cadence (does the headline pairing come first or last?), break rotation patterns, and how scoresheet rendering naturally flows.
- The per-game break/rack assignment is a per-pairing choice that affects per-game advantage distribution (the breaker has an advantage in some game types; alternating vs. fixed assignments affect aggregate fairness across the match).

Each of these is a real, named operational concern in pool-league administration. Bundling all three inside per-Scoring-System hardcoded code (the current implementation state — see [§Implementation status](#implementation-status)) flattens the decisions into "whatever the code happens to do for this Scoring System," loses the ability to vary them independently, and makes LO customization at any of the three layers impossible without rewriting the per-system code path. Pulling Pairings Generator out as a Module — explicitly a chain-pattern composition of three sub-Mechanisms — exposes the design space cleanly: each stage's algorithm choice is named, swappable, and (eventually) LO-configurable as a parameter, all without disturbing the others.

The Module is also **the load-bearing seam between configuration and runtime.** Every other Scoring System Module is either configuration (a value stored in preferences and read at lookup time) or passive data (a Chart). Pairings Generator is the only Module that takes mutable per-match-night inputs (the lineups, which change every week) and produces a fresh runtime artifact per match. It is where the static configuration of the league meets the dynamic state of a specific evening's play.

## Boundary

Pairings Generator is **only** the lineups-to-game-slots transformation. It is **not**:

- **The lineups themselves** — those are produced by the lineup-management UI and locked at lineup-lock time. The two ordered Arrays of `player_id` per team are *inputs* to this Module, not outputs of it. Application-level substitution rules (not a Module of this set) govern how the lineup may mutate during a match; this Module does not run again on substitution events.
- **The structural facts about team and pairing shape** — `lineup_size`, `max_roster_size`, `game_generation` belong to **[Team Geometry](team-geometry.md)**; `pairing_format` and `race_length` belong to **[Match Format](match-format.md)**. Pairings Generator *consumes* those, it does not declare them.
- **The actual rack-by-rack play** — game outcomes, points allocation per game, achievement flags, scoring popup behavior — all owned by the scoring runtime + the [Points System](points-system/README.md). Pairings Generator hands off a fully-specified slot list; the runtime fills each slot's outcome data as games complete.
- **The per-pairing termination rule** (single rack vs race-to-N completion semantics) — that is **[Match Format](match-format.md)**'s `pairing_format` axis. The Pairings Generator's output is the SAME slot list regardless of whether each slot terminates on one game-completion event (single_rack) or accumulates racks until a race target is reached (race_to_n); the slot-list shape is invariant under that choice. Match Format describes what each slot's lifecycle looks like; Pairings Generator just produces the slot list.
- **Handicap-driven per-pairing race-length adjustment** — when [Handicap Mechanism](handicap-mechanisms/README.md) is `race_length_adjustment`, per-pairing race lengths get computed from a Threshold Chart based on per-player handicap diff. That computation happens *after* Pairings Generator produces the slot list, by the Mechanism + Chart pair reading the per-slot pairings. Pairings Generator does not see handicap data.
- **Match Win determination** — that's the **[Win Calculator](win-calculator.md)**. Pairings Generator produces the schedule; the Win Calculator reads accumulated data from completed games to declare the night's winner.
- **Scoresheet rendering layout** — the visual presentation of the game-slot list is a UI concern. Pairings Generator produces the data; the renderer formats it.

If a proposed feature changes *how the cross-product of two lineups becomes a sequence of specifically-paired, specifically-ordered, specifically-break-assigned games*, it belongs here. If it changes *what shape each slot's gameplay takes*, it belongs in Match Format. If it changes *who's in the lineup*, it belongs in the lineup-management UI + application-level substitution rules (not a Module of this set).

### Architectural intent: chain composition, runtime execution, deterministic transformation

**Three sub-Mechanisms in strict sequence.** The chain is: Pair Generation → Game Ordering → Break/Rack Assignment. The first produces an *unordered set* of pairings (mathematical content only). The second imposes an *order* on that set (sequencing). The third adds *break/rack annotations* to each ordered slot (per-game per-side metadata). Each stage's output is the next stage's input; no stage can be skipped without breaking the contract. The three stages are conceptually independent (Pair Generation does not know how the result will be ordered; Game Ordering does not know how breaks will be assigned), even though they execute in fixed sequence.

**Pairings Generator runs at runtime** (unlike the inert axis-bundling Modules whose values just sit in `preferences` until something reads them). Every other component Module either wraps one or more `preferences` columns the LO sets at league configuration time, or — like Threshold Charts — is passive data queried at lookup time. Pairings Generator takes mutable per-match-night inputs (the locked lineups) and produces a fresh runtime artifact per match. Today it wraps no preference columns of its own — its sub-Mechanism choices are implicit in per-Scoring-System hardcoded code (`src/utils/gameOrder.ts` for 3v3 DRR; inline computation elsewhere for 5v5 SRR). This is *implementation status, not architectural intent*. The architecture allows for per-sub-Mechanism preference columns to be added when LO customization at any of the three stages becomes a real product need. Until then, the Module is configured by the Scoring System composition — each prepackaged Scoring System effectively bundles its choice for each of the three sub-Mechanisms.

**Deterministic transformation is a contract.** Given the same inputs (Team Geometry triple, Match Format tuple, two ordered lineups) and the same sub-Mechanism variants, this Module produces byte-identical output every time. No randomization, no time-dependence, no external-data dependence inside the Module's compute. Reproducibility is mandatory: the `matches.system_snapshot` frozen-config persistence (per [PRINCIPLES Principle 10 implication](../PRINCIPLES.md#10-composability-contract--no-break-composition)) and the vacate-and-rescore flow both require that re-running this Module on the same snapshot yields the same slot list. Sub-Mechanisms that incorporate randomness (e.g., a hypothetical "random game ordering" variant) must do so by accepting a seed input that gets snapshotted alongside the configuration — the variant accepts external randomness but the compute is deterministic given the seed.

**Composition with the rest of the Scoring System is orthogonal but constrained by Team Geometry's structural foundation.** Any Pairings Generator sub-Mechanism triple is architecturally composable with any Handicap System × Mechanism × Threshold Chart × Points System × Win Calculator combination — though Pair Generation's value space is bounded by Team Geometry's `game_generation` axis (a `game_generation='single_round_robin'` Team Geometry pairs naturally with a "full SRR cross-product" Pair Generation variant; combinations where the two disagree about the underlying pairing set would be invalid and rejected at composition validation).

## The three sub-Mechanisms

Each sub-Mechanism has a typed input contract, a typed output contract, and a variant space. The variants enumerated below are the design space — what currently ships is identified per-variant.

### Sub-Mechanism 1 — Pair Generation

**Input:** `lineup_size` (from Team Geometry), `game_generation` rule (from Team Geometry), two ordered lineups (Arrays of `player_id`, both of length `lineup_size`).

**Output:** unordered Array of `(home_player_id, away_player_id)` pairing tuples, possibly with multiplicity (e.g., DRR produces each pair twice).

**What it does:** mathematical generation of the pairing set, without imposing any sequence on the pairings. For full round-robin variants the output is the Cartesian product of the two lineups (possibly doubled for DRR). For non-round-robin variants the output is a strict subset of the Cartesian product, computed per the variant's algorithm.

**Currently shipped variants** (bundled implicitly inside per-Scoring-System code):
- **Full single round-robin (SRR)** — Cartesian product of the two lineups, each pair appearing exactly once. `|output| = lineup_size²`. Implicit in 5v5 SRR (25 pairings) for Percentage 5-Man and FargoRate 10-Point 5-Man.
- **Full double round-robin (DRR)** — Cartesian product of the two lineups, each pair appearing exactly twice (typically with break-side reversal between the two appearances, but that's a Break/Rack Assignment concern, not Pair Generation's). `|output| = 2 × lineup_size²`. Implicit in 3v3 DRR (18 pairings) for Points 3-Man.

**Future-possibility variants:**
- **Partial round-robin** — Cartesian product minus a configurable exclusion set. Useful for "captains never face each other in week 1" rules or for shortening the night when lineup sizes are large.
- **Swiss pairing** — pairings chosen dynamically based on current-season-standings between the two teams' players (each player paired with an opponent of similar current performance rather than via Cartesian product).
- **Single-elimination bracket** — only winners advance; pairing set shrinks per round. Tournament-style, not currently a league shape any prepackaged Scoring System uses.
- **Captain-priority bracket** — fixed Game 1 pairs the two captains; remainder is Cartesian product of the non-captains.

**Validation invariants for this stage:**
- Output cardinality must equal `lineup_size² × multiplier(game_generation)` for round-robin variants (full SRR multiplier = 1, full DRR multiplier = 2). Non-RR variants declare their own cardinality formula.
- Every player_id appearing in either input lineup must appear in at least one pairing (no orphaned players).
- For round-robin variants, every `(home_player, away_player)` pair from the Cartesian product must appear with the correct multiplicity (no missing combinations, no extras).

### Sub-Mechanism 2 — Game Ordering

**Input:** the unordered Array of pairings from sub-Mechanism 1.

**Output:** ordered Array of pairings, with each carrying a `game_number` field (1-indexed, sequential, no gaps).

**What it does:** imposes a sequence on the pairings. The sequence is what the scoresheet displays, what the runtime consumes in order, and what determines per-night cadence (do the headline pairings come first or last? does break rotation produce a satisfying pattern?). For variants where the input is the full RR cross-product, the ordering choice is purely a sequencing decision; for non-RR input (Swiss, bracket), the ordering may be partially constrained by the variant's own pairing-discovery process.

**Currently shipped variants** (bundled implicitly inside per-Scoring-System code):
- **Fixed table lookup** — a hardcoded sequence table maps `game_number → (home_position, away_position)` for the specific lineup_size × game_generation combination. `src/utils/gameOrder.ts` hardcodes this for 3v3 DRR (the 18-game sequence). The table is hand-crafted to produce a satisfying break/position rotation; algorithmic equivalents could be derived but the table is the source of truth today.
- **Inline algorithmic** — sequence generated procedurally at runtime (not from a lookup table). The 5v5 SRR case is computed this way in current code, though the specific algorithm is not centralized as a named function. This variant produces deterministic output given the inputs but the algorithm is implicit.

**Future-possibility variants:**
- **Snake order** — alternating which team's player position increments first, producing a serpentine traversal of the Cartesian product matrix. Often used in tournament play for fairness over the rotation cycle.
- **Standings-driven ordering** — schedule pairings of currently-equal-standing opponents first, building toward the "decisive" matchups later. Requires reading current season standings as an additional input; currently no variant does this.
- **Captain-priority ordering** — fixed Game 1 = captain-vs-captain pairing, remainder in any sub-variant order.
- **Randomized ordering** — pairings sequenced by RNG seeded from a snapshot-persisted seed value. Maintains determinism per the chain-composition contract (same seed → same sequence) but adds a new input dimension (the seed).

**Validation invariants for this stage:**
- Every pairing from the input set appears in the output with exactly the same multiplicity (no pairings lost, none duplicated).
- `game_number` values are 1-indexed, sequential, no gaps, no duplicates.
- Output cardinality equals input cardinality.

### Sub-Mechanism 3 — Break/Rack Assignment

**Input:** the ordered Array of pairings from sub-Mechanism 2 (each pairing has `home_player_id`, `away_player_id`, `game_number`).

**Output:** the same Array, with each pairing additionally annotated with `breaker` (`'home' | 'away'`) and `racker` (`'home' | 'away'`).

**What it does:** for each game in the sequence, declares who breaks and who racks. The breaker has structural advantage in most pool game types (the break shot is the first scoring opportunity in 8-ball; the break-and-run is the strongest single-rack play); fairness over a match night is typically achieved by alternating break across games or by ensuring each player breaks roughly the same number of times. Rack assignment (who racks the balls for the next game) is conventionally the opposite of the breaker, but some leagues separate these or assign racking on a per-table or per-venue basis.

**Currently shipped variants** (bundled inside the same hardcoded tables or inline code as Game Ordering):
- **Hardcoded per-position-in-sequence** — the `gameOrder.ts` table for 3v3 DRR specifies breaker per game_number directly. Different cells of the table assign breaker to home or away based on the hand-crafted rotation pattern that ensures roughly-equal break counts per player and natural alternation between teams.
- **Inline algorithmic** — 5v5 SRR's per-game break assignment is computed inline (typically alternating by team across the sequence; specific algorithm is implicit in the code).

**Future-possibility variants:**
- **Strict alternating** — game 1 home breaks, game 2 away breaks, game 3 home breaks, … pure alternation without regard to per-player break counts. Simple; may produce unfair per-player distributions when lineup sizes don't divide evenly.
- **Winner-breaks-next** — within a single pairing's race-to-N (when `pairing_format='race_to_n'`), the previous rack's winner breaks the next; or across the night, the previous game's winner breaks the next. The "across the night" variant requires the Pairings Generator to defer break assignment until games complete — a re-active execution model that doesn't fit the current "generate fully at lineup-lock time" architecture cleanly.
- **Loser-breaks-next** — opposite of the above, used in some race formats.
- **Coin-flip-first-then-alternating** — game 1 break is randomized (snapshot-persisted seed); subsequent games strictly alternate. Combines fairness over the season (no team has a structural break advantage if the league has many matches) with a stable within-match pattern.
- **Per-pairing-mutual-agreement** — captains decide per game; runtime captures the decision. Application-level rather than algorithmically determined.

**Bundling vs splitting:** the locked [Handicap Mechanisms README's architectural intent section](handicap-mechanisms/README.md#architectural-intent-modules-are-orthogonal) and the viability brainstorm (R6) both note that Break and Rack assignment can be treated as a *compound output* of a single sub-Mechanism (each game-slot record carries both fields) or split into two parallel sub-Mechanisms. For v1, bundled is acceptable; splitting is a future-work surface if LO custom needs decouple them.

**Validation invariants for this stage:**
- Every pairing in the input is present in the output with `breaker` and `racker` fields populated.
- `breaker` and `racker` are each one of `'home' | 'away'` for every pairing.
- For variants that promise fairness over the match (e.g., strict alternating, hardcoded equal-distribution tables), per-player break counts differ by at most 1 across the match's games.

## How this Module interacts

Pairings Generator sits at the **structural-to-runtime seam** of the Scoring System. It reads from configuration Modules and produces a runtime artifact other Modules consume.

**Upstream (Modules and runtime data this Module consumes):**
- **[Team Geometry](team-geometry.md)** — `lineup_size` and `game_generation` (both season-stable per Team Geometry's schema-level lock). `lineup_size` determines the Pair Generation stage's input dimensions; `game_generation` constrains the Pair Generation variant choice (a `game_generation='single_round_robin'` Team Geometry pairs naturally with the "full SRR cross-product" Pair Generation variant).
- **Lineup-lock event + the two ordered lineups** — the runtime inputs that change every match night. The Module runs once per match at lineup-lock; its output is then immutable for the duration of the match.

**Sibling Module (consumed alongside, not upstream):**
- **[Match Format](match-format.md)** — `pairing_format` is consumed by the scoring runtime *alongside* this Module's output, but is NOT read by this Module's compute. The slot list shape is the same whether each slot will later terminate on a single game-completion event (`single_rack`) or accumulate racks until a race target is reached (`race_to_n`). Listed here for traceability; not an input to Pair Generation, Game Ordering, or Break/Rack Assignment.

**Internal partners (the three sub-Mechanisms compose in chain):**
- Stage 1 (Pair Generation) produces input for Stage 2.
- Stage 2 (Game Ordering) produces input for Stage 3.
- Stage 3 (Break/Rack Assignment) produces the Module's final output.

**Downstream (consumers of this Module's output):**
- **The scoring runtime** (`src/utils/match/computeMatchRunningTotals.ts`, the scoring popup, per-game mutation code) — consumes the ordered, break/rack-annotated slot list to know what game to render next, which players are paired in that game, which side breaks, and (in combination with Match Format) when the slot terminates.
- **The scoresheet renderer** — displays the slot list as the visual scoring grid for the match. Slot order from this Module is the display order.
- **The [Handicap Mechanism](handicap-mechanisms/README.md) `race_length_adjustment` variant** — reads the per-pairing handicap diff (computed from the players named in each slot) to produce per-pairing adjusted race lengths. Applies *after* this Module's output is materialized, modifying per-slot race targets without changing the slot list shape.
- **The `matches.system_snapshot` persistence layer** — captures the resolved configuration including the sub-Mechanism variant choices, so vacate-and-rescore re-runs Pairings Generator deterministically against the same inputs.
- **The lineup-management UI** — reads `lineup_size` (Team Geometry) to size the lineup-entry form, but does not read Pairings Generator's output directly; the UI's job ends at lineup-lock (when this Module begins running).

## Validation invariants

Cross-stage validation is enforced inside the chain (each stage's output validates against the next stage's input contract per [§The three sub-Mechanisms](#the-three-sub-mechanisms)).

**Guaranteed by construction (not table-level invariants):** the round-robin algorithm produces a slot count matching Team Geometry's `game_count` formula; every output slot has complete fields (`home_player_id`, `away_player_id`, `game_number`, `breaker`, `racker`); and `game_number` values are 1-indexed contiguous integers. These hold because the algorithm produces them that way — there's no separate enforcement layer because there's no failure mode to enforce against.

**Module-level invariants that can actually fail:**

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| Same inputs (TG + MF + lineups + variant choices) produce byte-identical output across invocations | by construction (deterministic compute) — characterization tests guard | regression test failure if a sub-Mechanism introduces non-determinism without seed input |
| Variant choices for the three sub-Mechanisms are consistent with each other (e.g., a "Swiss pairing" Pair Generation variant needs a Game Ordering variant that doesn't assume Cartesian-product structure) | application-layer composition validator (currently bundled implicitly per Scoring System) | warns at LO setup; runtime falls back to safe-default chains per Principle 10 if a mismatch slips through |

## Future possibilities

- **LO-configurable sub-Mechanism choice per stage.** Add preference columns (`pair_generation_variant`, `game_ordering_variant`, `break_rack_assignment_variant`) so LOs can pick from the currently-implicit variants explicitly. Wizard UI presents each stage as an independent dial. Currently the sub-Mechanism choices are bundled implicitly per Scoring System; making them LO-facing is straightforward once the Module is extracted but requires schema additions.
- **Non-round-robin Pair Generation variants** (partial RR, Swiss, single-elimination bracket, captain-priority bracket). Each requires its own algorithm implementation; each implies its own game-count formula (which Team Geometry's `game_count` derivation would need to extend to handle).
- **Reactive Break/Rack Assignment** (winner-breaks-next, loser-breaks-next across the night). Requires re-architecting from "generate fully at lineup-lock time" to "generate partially at lineup-lock, finalize per-slot as previous slot completes" — a meaningful runtime change but architecturally tractable.
- **Per-pairing race-length declaration inside the slot** (currently lives in Handicap Mechanism reading the slot list after-the-fact). Could move into Pairings Generator as a fourth stage if the runtime split becomes operationally awkward; current split is cleaner architecturally because the race-length math depends on handicap data Pairings Generator doesn't see.
- **Snapshot-persisted RNG seed for randomized variants.** When non-deterministic-looking variants are introduced (random ordering, coin-flip break), the seed becomes part of the configuration captured in `matches.system_snapshot` so re-runs (vacate-and-rescore) reproduce the same sequence.
- **Split Break and Rack into separate sub-Mechanisms.** Currently bundled per the viability brainstorm's R6 acceptance of compound output. If LO custom needs decouple them (e.g., "winner breaks next, but racks stay with the loser of the previous game"), the bundle splits into two parallel sub-Mechanisms.
- **Mid-match re-pairing.** Currently this Module runs once per match at lineup-lock; the output is immutable for the match. A future variant could allow re-running on substitution events (preserving completed slots, regenerating remaining slots with the new lineup). Application-level substitution rules would govern when re-pairing is allowed; this Module would handle the recomputation.

The category is open. Each new sub-Mechanism variant requires: (a) algorithm implementation, (b) test coverage for the deterministic-output contract, (c) cross-stage compatibility verification (a Swiss pairing pairs with a Swiss-aware Game Ordering, not with a fixed-table ordering), (d) wizard UI option if the variant is LO-facing.
