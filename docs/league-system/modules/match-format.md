---
title: Match Format (Module)
date: 2026-05-17
status: active
audience: developer + AI sessions
---

# Match Format

## Kind

**Match Format is a [System](../PRINCIPLES.md#system--deep-dive)-kind Module that bundles two independent configuration axes** — **pairing format** (single-rack vs race-to-N) and **base race length** (the N when race-to-N applies) — into the per-pairing structural specification consumed by the scoring runtime when it materializes individual head-to-head encounters into playable game slots. As with [Team Geometry](team-geometry.md), the *variant* is the resulting tuple, not a packaged option pulled off a shelf; legal configurations are the constrained Cartesian product across the axes.

(Why this matters: Team Geometry sets the *number and topology* of pairings on a match night; Match Format sets the *shape of what one pairing is*. The two compose orthogonally — same game count (Team Geometry) can run as 25 single racks or as 25 race-to-N pairings (Match Format) without either Module knowing about the other's choice. Splitting the team-level structure from the per-pairing structure is the load-bearing anti-conflation this Module enforces.)

## Essence

A **match format** is the season-stable per-pairing structural specification answering two questions whose answers fix the shape of every individual encounter on a match night:

1. **Is each pairing a single rack, or a race-to-N over multiple racks** (`pairing_format`)
2. **When pairings are races, what is the base race target before any handicap-driven adjustment** (`race_length`, nullable — populated only when `pairing_format='race_to_n'`)

Match Format holds *no behavior*. It is a passive configuration record consumed by [Pairings Generator](pairings-generator.md) (the runtime instantiator that turns Team Geometry × Match Format × lineups into concrete game slots), by the [Threshold Charts](threshold-charts/README.md) Module's race-shape charts (which produce per-pairing targets), and by the scoring runtime when it decides whether a pairing terminates on a single game-completion event or accumulates rack outcomes toward a race target.

The two axes are tightly coupled by an existence invariant: `race_length` is **mandatory and meaningful** when `pairing_format='race_to_n'`, and **forbidden** (NULL) when `pairing_format='single_rack'`. The schema enforces nullability; the application layer enforces the mandatory side. Single-rack matches have no race target because the pairing's outcome is fully determined by the single game's winner.

## Why match format exists

The per-pairing structural choice has direct operational consequences for **match-night duration**, **competitive feel**, and **statistical character** — and it composes orthogonally with the team-level structural choice (lineup size + game generation, owned by Team Geometry). Without this Module as a distinct concern, the per-pairing shape would be implicitly baked into per-system code (the historical bundling state — see [§Implementation status](#implementation-status)) and impossible to vary without rewriting.

Operational distinctions captured by this axis:

- **`single_rack`** — one rack per pairing, outcome determined by that game's winner. Per-pairing time is bounded (~5–15 min depending on game type and skill). Standings math is simple: each pairing contributes one game to the team count. This is what every currently-shipped Scoring System uses — the historical norm for BCA-tradition leagues.

- **`race_to_n`** — each pairing is a race-to-N sequence of racks, with the pairing ending the moment one side wins N racks. Per-pairing time scales with N and skill (a race-to-7 between roughly-equal players can run 30–60 min). Each pairing still contributes one game-won to the team count (the pairing's overall winner); the racks inside the race are pairing-internal events that don't independently count toward team totals. This is the standard race-tradition format used in skill-level leagues (e.g., BCAPL skill-level competitions, similar APA-style structures).

Composability with Team Geometry illustrates the orthogonality cleanly: a `(lineup_size=5, game_generation=single_round_robin)` triple gives 25 pairings on a match night. Whether those 25 are 25 single racks (~2 hours, BCA-style) or 25 race-to-5 pairings (~6+ hours, an unrealistic single night) is Match Format's choice. The 25-pairing math doesn't change; the per-pairing time does, with downstream scheduling consequences. A realistic race-to-N league typically also uses a smaller `lineup_size` (e.g., 3v3 with 9 race-to-5 pairings) — but that's a *combination* the LO chooses, not a coupling either Module enforces.

## Boundary

Match Format is **only** the per-pairing structural shape. It is **not**:

- **The team-level structure** (lineup size, roster cap, game-generation rule) — that is **[Team Geometry](team-geometry.md)**. Team Geometry says *how many pairings exist*; Match Format says *what each pairing looks like*.
- **The handicap-driven adjustment to race length** — that is the **[Handicap Mechanism](handicap-mechanisms/README.md)** variant `race_length_adjustment`. Match Format declares the *base* race length (the N in race-to-N); when the active Mechanism is `race_length_adjustment`, that Mechanism reads a [Threshold Chart](threshold-charts/README.md) to compute per-pairing adjusted race lengths (stronger player races to N+δ, weaker player races to N−δ). The relationship is layered: Match Format provides the baseline; Mechanism modifies it per pairing per handicap diff. A `pairing_format='race_to_n'` league can run *without* `race_length_adjustment` (everyone races to the same N regardless of handicap); but `race_length_adjustment` is meaningless when `pairing_format='single_rack'` (there's no race length to adjust).
- **Which metric decides the pairing winner inside a race** — racks-within-a-race terminate when one side hits the (possibly adjusted) target N; this is structural termination, not Win Calculator territory. The **[Win Calculator](win-calculator.md)** still decides the *match* winner from accumulated pairing results plus per-game metric data.
- **The per-game outcome shape** — what counts as a game-win, whether the scoring popup asks for ball counts (Fargo) or just a winner pick (BCA), what stats are captured — those are concerns of the [Points System](points-system/README.md) (per-game allocator) and the scoring runtime. Match Format does not see inside a single game.
- **Bracket play, single-elimination tournaments, or non-round-robin scheduling** — those are alternative `game_generation` rules in [Team Geometry](team-geometry.md), not Match Format axes. Match Format describes a *pairing's* shape regardless of which scheduling rule produced it.
- **Time limits or shot clocks** — those are venue/league house-rules concerns outside the modular Scoring System. A future Match Format axis could declare time-per-rack or time-per-pairing limits, but no such axis exists today.

If a proposed feature changes *the structural shape of a single pairing on a match night*, it belongs here. If it changes *the per-pairing race target as a function of handicap*, it belongs in Handicap Mechanism. If it changes *how many pairings exist*, it belongs in Team Geometry. If it changes *who wins the match overall*, it belongs in Win Calculator.

### Architectural intent: per-pairing scope, baseline-then-adjust composition

**Per-pairing scope is the load-bearing distinction.** This Module operates one level down from Team Geometry — Team Geometry says "there are 25 pairings tonight," Match Format says "each pairing is a single rack" or "each pairing is a race-to-7." The split prevents a class of conflations where team-level structural changes accidentally couple to per-pairing structural changes (e.g., assuming "longer night" requires DRR when the LO actually wants race-to-N over the same SRR game count).

**Baseline-then-adjust composition with Handicap Mechanism.** When `pairing_format='race_to_n'`, the `race_length` Match Format declares is the **baseline** — the unmodified target for an evenly-matched pairing. The active Handicap Mechanism then *may* adjust this baseline per pairing per handicap diff:

- If the active Mechanism is `extra_games` or `start_points` (team-level mechanisms) or `none`, the baseline applies uniformly — every pairing races to the same `race_length`.
- If the active Mechanism is `race_length_adjustment` (per-pairing mechanism), the baseline is the *anchor point* the Mechanism's Threshold Chart computes deltas around: `effective_race_length_stronger = race_length + δ`, `effective_race_length_weaker = race_length − δ`, where δ comes from the chart given the per-pairing handicap diff.

This layered composition is a deliberate architectural choice. The alternative — having Match Format compute the adjusted race lengths directly — would conflate "what shape is a pairing in this league" with "how does the handicap modify pairing shape per opponent" and tie Match Format to a specific Handicap Mechanism variant. The current split keeps Match Format encoding-agnostic and Mechanism-agnostic; the Mechanism reads the baseline and applies its chart-driven adjustment.

**Orthogonal composability across the Scoring System.** Any Match Format tuple (subject to existence invariants) is architecturally composable with any Team Geometry × Handicap System × Mechanism × Threshold Chart × Points System × Win Calculator combination — though only the shipped Scoring Systems' specific tuples are calibration-tested. The locked [Handicap Mechanisms README's orthogonality section](handicap-mechanisms/README.md#architectural-intent-modules-are-orthogonal) and the [Threshold Charts README's encoding-locked-input contract](threshold-charts/README.md#architectural-intent-encoding-locked-input-converter-mediated-composition) both establish the broader orthogonality principle; Match Format's contribution is to ensure the per-pairing structural axis never accidentally couples to any of those other Modules' concerns.

## The two axes

Each axis has a value-space, a default, and a validation rule. The axes are presented in dependency order — `race_length`'s validity depends on `pairing_format`.

### `pairing_format` — the per-pairing structural shape

| Attribute | Value |
|---|---|
| **Type** | enum: `'single_rack'` \| `'race_to_n'` |
| **Currently shipped values** | `'single_rack'` (all three prepackaged Scoring Systems: Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man) |
| **Default for new leagues** | `'single_rack'` |
| **Validation** | enum CHECK constraint at DB layer (`preferences_pairing_format_check` in `20260429000001_extend_preferences_phase2_modular_axes.sql`); no inter-axis constraints on this axis directly |

**Operational meaning of each variant:**

- **`single_rack`** — every pairing is one rack. The pairing terminates the moment that rack's winner is recorded. The pairing contributes one game-win to the team's tally for that match. The `race_length` axis is NULL and meaningless. **Time per pairing**: bounded by single-rack duration (typically 5–15 min for 8-ball, 5–20 min for 9-ball). **Match-night duration**: `game_count × per-rack time`, roughly. **Scoring popup behavior**: minimal — winner pick, optional ball-count for points calculators that need it, optional achievement flags.

- **`race_to_n`** — every pairing is a race-to-N sequence of racks. The pairing terminates the moment one side wins N racks (where N is `race_length`, possibly adjusted per pairing by `race_length_adjustment` Mechanism). The pairing still contributes one game-win to the team's tally — the *pairing's overall winner*. Racks-within-the-race are pairing-internal events that do not independently count toward team totals; they exist only to determine which side wins the pairing. **Time per pairing**: scales with N and skill; a race-to-7 can run 30–90 min. **Match-night duration**: significantly longer than single-rack at the same `game_count`. **Scoring popup behavior**: rack-by-rack winner picks accumulate toward the race target; the runtime must track each side's rack count and terminate when one side hits N.

**Why these two specifically, not more variants.** The single-rack/race-to-N pair covers the two operational shapes that map to existing tradition: BCA-tradition leagues use single rack; race-tradition leagues (BCAPL Skill Level, APA-style) use race-to-N. Hypothetical variants like "race-to-N best-of-3 sets" or "sudden-death after single rack" are not currently entertained; they would slot in as additional `pairing_format` enum values with their own termination semantics.

### `race_length` — the baseline race target

| Attribute | Value |
|---|---|
| **Type** | nullable positive integer |
| **Realistic range** | 1..15 (theoretical: anything ≥ 1; below 1 collapses to single rack; above ~15 strains night duration) |
| **Currently shipped values** | NULL across all three prepackaged Scoring Systems (none ship `race_to_n`) |
| **Default for new leagues** | NULL (only populated when `pairing_format='race_to_n'`) |
| **Validation** | DB CHECK constraint `(race_length IS NULL OR race_length >= 1)`; application-layer cross-axis check that NULL ⇔ `pairing_format='single_rack'` |

**Operational meaning.** When `pairing_format='race_to_n'`, this integer is the **base race target** — the number of racks one side must win for the pairing to terminate, *before* any per-pairing handicap adjustment. For an evenly-matched pairing (or a league running without `race_length_adjustment`), `race_length` is the actual race target. For a league using `race_length_adjustment`, this value is the anchor point the Mechanism's chart computes deltas around.

**Why nullable rather than 0 or 1 as a sentinel for single-rack.** Nullability cleanly encodes "this axis is not in play" rather than "this axis is in play with value 0." A `race_length=1` would mean "first to 1 rack wins" — semantically a single rack, but mechanically still routed through the race-mode termination code path with extra book-keeping. Distinguishing NULL (axis dormant) from any integer ≥ 1 (axis active) avoids that confusion at the type level and prevents the race-mode runtime from being invoked on single-rack pairings.

**Cross-axis existence invariant.** The application layer enforces:

```
pairing_format = 'single_rack'  ⇒  race_length IS NULL
pairing_format = 'race_to_n'    ⇒  race_length IS NOT NULL AND race_length >= 1
```

Schema enforces only the second clause's `>= 1` partial; the existence implication (`race_to_n` requires non-null) is enforced at preference-write time. A future migration could harden this with a Postgres CHECK constraint expressing the implication (`CHECK ((pairing_format = 'race_to_n') = (race_length IS NOT NULL))`); not currently in place.

## Validation invariants

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| `pairing_format IN ('single_rack', 'race_to_n')` | schema CHECK constraint | DB rejects unknown values |
| `race_length IS NULL OR race_length >= 1` | schema CHECK constraint | DB rejects values < 1 |
| `pairing_format='single_rack' ⇒ race_length IS NULL` | application-layer (no schema CHECK currently) | preference write rejected with operator-facing error |
| `pairing_format='race_to_n' ⇒ race_length IS NOT NULL` | application-layer | preference write rejected; LO must supply `race_length` |
| Both axes immutable post-season-lock | schema-level season-stability lock trigger covering Match Format's columns | UPDATE on locked preferences blocked at DB layer |
| `race_length` consistent with active Handicap Mechanism (when `race_length_adjustment`, the chart's per-pairing adjustments must yield positive race targets after adjustment) | application-layer (combo coherence validation) | warns at LO setup; runtime clamps to `max(1, baseline + δ)` if a mismatch slips through (Principle 10 graceful degradation) |

The last row is the bridge to Handicap Mechanism interaction: a misconfigured `race_length_adjustment` chart could in principle return a δ large enough to push the weaker side's effective race target to ≤ 0 (e.g., baseline 5, weaker δ = −6 → effective race target = −1). Combo coherence validation at preference write time should warn against such combinations; runtime defensively clamps to `>= 1` rather than throw.

## How this Module interacts

Match Format sits **between** Team Geometry (which sets up the pairing count) and the runtime that fills pairings with game data. Its outputs flow outward to several downstream Modules.

**Upstream:** nothing. Match Format reads no other Module.

**Downstream (Modules and runtime that consume Match Format's output):**

- **[Pairings Generator](pairings-generator.md)** — consumes the `pairing_format` choice and `race_length` baseline alongside Team Geometry's structural facts and the locked lineups to instantiate the concrete `Array<GameSlot>` for the match. The `pairing_format` value (`single_rack` vs `race_to_n`) informs downstream Modules but does NOT itself change the slot list this Module produces; the slot list shape is invariant under that choice. (Currently the Pairings Generator implementation is bundled inside per-Scoring-System code in `src/utils/gameOrder.ts` and the scoring runtime; the Step-2 extraction lifts it to a centralized Module per its own blueprint.)
- **[Threshold Charts](threshold-charts/README.md)** — race-shape charts (the [Race Points](threshold-charts/race-points.md) and [Race Percentage](threshold-charts/race-percentage.md) charts) produce per-pairing race-length targets. When `pairing_format='race_to_n'` and the active Mechanism is `race_length_adjustment`, the chart consumes the handicap diff and `race_length` as inputs (or as anchor point) to produce per-pairing adjusted targets. Charts that produce team-aggregate `extra_games` targets do not interact with Match Format at all (they assume single_rack pairings implicitly).
- **[Handicap Mechanism](handicap-mechanisms/README.md) `race_length_adjustment` variant** — reads `race_length` as its anchor point for per-pairing adjustment. The other Mechanism variants (`extra_games`, `start_points`, `none`) do not read Match Format.
- **The scoring runtime** (`src/utils/match/computeMatchRunningTotals.ts`, the scoring popup, the per-game mutation) — reads `pairing_format` to decide whether a single game-completion event terminates the pairing (single_rack) or whether to accumulate racks toward a race target (race_to_n). Reads `race_length` (when applicable) to know when to terminate the race.
- **The scoresheet renderer** — reads `pairing_format` to decide whether each pairing displays as one cell (single rack) or as a rack-counter widget (race_to_n).
- **[Win Calculator](win-calculator.md)** — does **not** directly read Match Format. The Win Calculator consumes per-team game-win counts and per-team point totals, both of which are pairing-aggregated by the time the Win Calc sees them. The pairing-aggregation step (one pairing → one game-win for its winner) is the runtime's job and is implicit in the way matches are scored; Match Format informs that step but the Win Calc does not look directly at the `pairing_format` axis.

**Sibling (composes alongside, no direct dependency):**

- **[Team Geometry](team-geometry.md)** — sets the *number* of pairings via lineup size and game-generation rule; Match Format sets the *shape* of each. Orthogonal.
- **[Handicap Systems](handicap-systems/README.md)**, **[Points System](points-system/README.md)** — independent of Match Format. A 10-Point per-game allocator (Points System) works identically whether the pairing is single_rack (the points accrue from that one rack) or race_to_n (the points accrue from each rack within the race, summed). The Points System operates per-game; Match Format operates per-pairing; the runtime's pairing-aggregation step is what bridges them.

## Implementation status

The locked [`README.md`](../README.md) and [Handicap Mechanisms README's orthogonality section](handicap-mechanisms/README.md#architectural-intent-modules-are-orthogonal) both establish the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Match Format's situation in current code:

- The two axes live as columns on the `preferences` table (`pairing_format`, `race_length`).
- All three currently-shipped prepackaged Scoring Systems use `pairing_format='single_rack'`; no shipping system uses `race_to_n`. **The race-to-N runtime code path is partially implemented but not end-to-end tested** — it exists in service of a future race-tradition Scoring System (a BCAPL skill-level-style format would be the natural first shipped consumer).
- The `RaceLengthThreshold` type in `src/systems/types.ts` is wired (it's the third arm of the threshold discriminated union per Phase 1 Unit 1.3 of the v2 plan), but no SystemModule currently produces a `RaceLengthThreshold` at runtime because no shipped system uses `race_length_adjustment` as its Mechanism.
- [Pairings Generator](pairings-generator.md) is recognized in the locked Module catalog as Module #8 but is not yet extracted as a centralized implementation; per-system game-order code in `src/utils/gameOrder.ts` and inlined scoring-runtime logic together cover the single_rack case for the shipped systems. Race_to_n pairing generation would need to extend this when BCAPL SL or similar formats ship.
- Wizard UI: `pairing_format` and `race_length` are currently derived from preset selection rather than independently chosen for the LO (the preset implies single_rack); a Step-2 refactor opportunity is to expose the axes independently once `race_to_n` has a shipping consumer.

The Step-2 refactor lifts Match Format out as a first-class Module, extracts [Pairings Generator](pairings-generator.md) as a centralized runtime instantiator with its three sub-Mechanisms as first-class stages, and dissolves any remaining bundling between Team Geometry's `teamFormat` constants and Match Format's per-pairing axes inside the per-system SystemModule files. The new Module's typed contract is small — two fields with the existence invariant — but the runtime code paths it gates (especially the unfinished `race_to_n` termination logic) are substantive.

## Future possibilities

- **Race-to-N with rack-level point allocation.** Currently the race-to-N runtime treats each rack as a sub-event of the pairing, contributing only to the pairing's race count (not directly to team points). A future variant could let the Points System's per-game allocator fire per-rack within a race (each rack accumulates points; the pairing winner takes a bonus or multiplier). This crosses into Points System territory but would require Match Format to declare the per-rack allocation policy.
- **Time-bounded pairings.** A `pairing_format` variant that terminates pairings on a time limit (e.g., race-to-N or X minutes, whichever first) for venues with strict close-time constraints. Requires runtime time-tracking infrastructure not currently in place.
- **Mixed pairing formats within one match night.** A match where some pairings are single rack and others are race-to-N (e.g., the first 9 pairings are single-rack scrimmage, the last pairing is a race-to-7 "headliner"). Currently the Module assumes a single `pairing_format` for the whole night; a per-pairing-index format declaration would extend the Module's shape.
- **Race-to-N with set structure.** Best-of-3 sets of races (each set is a race-to-N, the pairing winner is the side winning 2 of 3 sets). A common tournament shape; not currently in scope.
- **LO-customizable per-pairing termination rules.** Operators wanting non-standard pairing termination (sudden-death after first lead, first-to-X-ball-count, etc.) would invent new `pairing_format` enum values with their own termination semantics. The Module's design accommodates extension via new enum values; the runtime would need a corresponding termination implementation per new variant.

The category is open. Adding a new `pairing_format` enum value requires: (a) a termination predicate (when does the pairing end?), (b) a pairing-aggregation rule (how do internal events sum to one game-win contribution?), (c) corresponding runtime support in the scoring code paths, (d) wizard option, (e) updates to scoresheet renderer.

## Source of truth

- `src/types/preferences.ts` — `pairing_format`, `race_length` column types in the `preferences` row shape
- `src/types/resolvedSystemConfig.ts` — `ResolvedSystemConfig` carries the resolved Match Format tuple post-cascade
- `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql` (lines 52–60 for `pairing_format`, lines 181–187 for `race_length`) — schema definitions + CHECK constraints
- `supabase/migrations/20260418000002_lock_tier1_preferences.sql` — Postgres trigger enforcing season-stability immutability (Match Format's axes are in the lock set)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — `resolved_league_preferences` view applies the 3-tier cascade for Match Format's axes
- `src/systems/types.ts` (around line 179+) — `RaceLengthThreshold` interface; the discriminated-union arm corresponding to `race_length_adjustment` Mechanism (not directly the Match Format Module, but the typed contract for the Threshold output shape Match Format's `race_to_n` variant implies downstream)
- `src/systems/buildSystemFromPreferences.ts` — `pickThresholdCapability` switch including the `race_length_adjustment` branch (consumer of `race_length` when paired with the matching Mechanism)
- `src/utils/gameOrder.ts` — currently hardcoded for single_rack 3v3 DRR; race_to_n pairings would extend this
- `src/wizards/league-v2/steps/` — wizard step(s) for `pairing_format` and `race_length`; currently derived from preset selection rather than independently chosen
- `src/components/scoring/` — scoring popup and scoresheet renderer; current code branches implicitly on single_rack assumption, race_to_n branches are partial
