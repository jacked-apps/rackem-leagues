---
title: Team Geometry (Module)
date: 2026-05-17
status: active
audience: developer + AI sessions
---

# Team Geometry

## Kind

**Team Geometry is a [System](../PRINCIPLES.md#system--deep-dive)-kind Module that bundles three independent configuration axes** — **lineup size**, **roster cap**, **game-generation rule** — into a single structural specification consumed by every other Module that needs to know how many players, how many games, or how the games arrange. Unlike selection-pattern Systems (e.g., [Threshold Charts](threshold-charts/README.md)) where the league picks one packaged variant from a roster, Team Geometry's three axes are each set independently; the *variant* is the resulting tuple, not a named option pulled off a shelf. The axes don't run anything — they're inert configuration values consumed by other Modules.

(Why this matters: the kind tells you what to expect inside. This Module has N orthogonal axes; legal configurations are the Cartesian product across them, gated by inter-axis validation. There is no "Team Geometry preset" — there's a `(lineup_size, max_roster_size, game_generation)` triple per league.)

## Essence

A **team geometry** is the season-stable structural specification of *how a team is shaped and how a match's games arise from two teams meeting*. It answers three orthogonal questions whose answers are fixed at league creation and immutable for the season's duration:

1. **How many players from each team are active on a given match night** (`lineup_size`)
2. **How many players a team is administratively permitted to carry on its roster between match nights** (`max_roster_size`, with `>= lineup_size` invariant)
3. **How the per-night active lineups arrange into a concrete game count** (`game_generation`: single round-robin or double round-robin over the cross-product of lineups)

Team Geometry holds *no behavior*. It is a passive configuration record consumed by Pairings Generator, Threshold Charts (when their math is game-count-dependent), the scoring runtime (scoresheet renderer, lineup UI), and the future Standings concern (which lives outside the modular Scoring System catalog — its own architectural shape is a separate brainstorm not yet designed). Match Format composes alongside Team Geometry as a sibling — the two are orthogonal; neither reads the other. Team Geometry's outputs are constants once the league is configured; its only computed value is the **derived game count** (`game_count = f(lineup_size, game_generation)` — see §Math).

## Why team geometry exists

Every match night reduces to a finite, scheduled set of head-to-head encounters between players. Three structural parameters fully determine that set's *shape* (the cardinality and pairing topology) independently of who specifically is playing, how their handicaps work, or how points are allocated. These parameters cluster naturally because changing any one of them ripples through schedule generation, scoresheet layout, threshold calibration, and per-night runtime — so they belong to one Module with crisp borders, not scattered through preferences with implicit coupling.

The three-axis cluster also encodes a **strategic shape choice** with downstream consequences league operators understand at intuitive granularity:

- **Smaller lineups + DRR** (e.g., 3v3 × DRR = 18 games) — higher per-player game count per night; favors leagues where individual stamina, late-night consistency, and pairing-by-pairing rotation matter
- **Larger lineups + SRR** (e.g., 5v5 × SRR = 25 games) — broader per-player exposure; favors leagues prioritizing roster breadth, social variety, and shorter individual playing time per night
- **Mid-size + either** (e.g., 4v4) — open design space; not currently shipped as a tested Scoring System but architecturally valid

Without Team Geometry as a distinct Module, these structural decisions would be implicitly baked into per-system code (the historical bundling state — see [§Current code state](#current-code-state)) and impossible to vary without rewriting. With it, the same Handicap System + Points System + Win Calculator stack can drop into a 3v3, 4v4, or 5v5 chassis just by changing this Module's tuple.

## Boundary

Team Geometry is **only** the structural triple defining team shape and game-generation rule. (Two of the three axes — `lineup_size` and `game_generation` — are season-stable per [§Architectural intent](#architectural-intent-orthogonality-season-stability-structural-primacy); the third, `max_roster_size`, is administrative-only and may change mid-season.) It is **not**:

- **The runtime arrangement of specific players into specific game slots** — that is the **[Pairings Generator](pairings-generator.md)** concern (Module #8 in the locked [`README.md`](../README.md) catalog). It takes Team Geometry's structural axes + locked lineups + Match Format's per-pairing rule and produces the concrete `Array<GameSlot>` for the match. Team Geometry's `game_generation` axis names the rule; Pairings Generator's pair-generation sub-Mechanism executes against that rule to materialize the slot list.
- **The per-pairing format** (single rack vs race-to-N, race lengths) — that is **[Match Format](match-format.md)**. Team Geometry says *how many pairings exist*; Match Format says *what each pairing looks like*. A 5v5 SRR has 25 pairings (Team Geometry); whether each pairing is a single rack or a race-to-9 (Match Format) is orthogonal.
- **The handicap encoding, mechanism, or chart** — those are the [Handicap Systems](handicap-systems/README.md), [Handicap Mechanisms](handicap-mechanisms/README.md), and [Threshold Charts](threshold-charts/README.md) Modules. Threshold Charts may *consume* Team Geometry's derived game count when their math depends on it (e.g., a chart that scales target wins to total game count), but the chart itself is its own Module.
- **Roster mutation rules** (when players can be added/dropped/subbed mid-season, sub eligibility windows, etc.) — those are application-level concerns governed by league-rules code outside the modular Scoring System. Team Geometry caps the roster size; *who* fills the slots and *when* they change is governed elsewhere.
- **Match-night attendance enforcement** (what happens when a team can't field `lineup_size` players — forfeits, sub-from-elsewhere, postponements) — that is **forfeit handling**, an application-level concern outside the modular Scoring System. Team Geometry declares the active-lineup requirement; the rules engine for unmet requirements lives in league-rules code, not in any Module of this Module set.
- **The runtime data those slots accumulate during scoring** — game outcomes, points, achievements live in `match_games` rows owned by the scoring runtime. Team Geometry produces the *schedule shape*; the scoring runtime *fills it in*.

If a proposed feature changes *how many players play, how many can be on the roster, or how the cross-product of lineups becomes a game count*, it belongs here. If it changes *the per-pairing format*, it belongs in Match Format. If it changes *which specific players play which specific games*, it belongs in [Pairings Generator](pairings-generator.md).

### Architectural intent: orthogonality, season-stability, structural primacy

**Three axes, three independent decisions.** No axis derives from another. `lineup_size` does not constrain `game_generation` (3v3 SRR is valid even though no shipped Scoring System uses it); `max_roster_size` is administrative and does not affect per-night math except via the `>= lineup_size` floor; `game_generation` is independent of player count except for the resulting game-count formula. Cross-axis validation is minimal and bounded — see [§Validation invariants](#validation-invariants).

**Season-stability is a contract for two of the three axes.** Once a league season is locked in, `lineup_size` and `game_generation` are immutable for the season. Changing either mid-season would invalidate accumulated standings (game counts wouldn't normalize across the season), break already-scheduled match-night infrastructure (the scheduler generated games against the old count), and corrupt frozen-snapshot reproducibility (`matches.system_snapshot` rows captured under one geometry can't be re-scored under a different one). A schema-level season-stability lock trigger enforces this at the DB layer.

**`max_roster_size` is NOT season-stable.** It is administrative-only: it caps the number of players a team can carry on its roster, used by the lineup-page UI to know how many player-selection slots to render and to enforce the cap on roster-management operations. It is **not** consumed by any scoring, threshold, win-calculator, standings, or pairings code; mid-season changes to it have no effect on match math or accumulated season totals. The axis can therefore be modified at any time during a season without breaking the Module's contracts. (Roster mutability — adding/dropping/subbing players within the cap — is itself an application-level concern outside this Module, governed by application-level substitution rules; see Boundary above.)

**Structural primacy means Team Geometry feeds, not consumes.** This Module reads no other Module's output. It is the foundation other Modules build on — [Pairings Generator](pairings-generator.md) can't operate without it, Threshold Charts whose math is game-count-dependent must read it, Match Format's per-pairing structure is meaningless without knowing how many pairings exist. The dependency edges all point *outward from* Team Geometry, never *into* it.

**Composition with the rest of the Scoring System is orthogonal.** Any Team Geometry triple (subject to validation invariants) is architecturally composable with any Handicap System × Mechanism × Threshold Chart × Points System × Win Calculator combination — though only the shipped Scoring Systems' specific triples are calibration-tested. The locked [Handicap Systems README's "Architectural intent: modules are orthogonal" section](handicap-systems/README.md#architectural-intent-modules-are-orthogonal) establishes the orthogonality principle for the whole 8-Module stack; this Module's contribution is to ensure the geometric foundation never accidentally couples to encoding choices.

## The three axes

Each axis has a value-space, a default, and a validation rule. The axes are presented in dependency order (the validation rules later depend on the earlier values).

### `lineup_size` — active players per team per match night

| Attribute | Value |
|---|---|
| **Type** | positive integer |
| **Realistic range** | 2..8 (theoretical: anything ≥ 1; below 2 collapses to singles play; above ~8 strains scheduling and venue capacity) |
| **Currently shipped values** | `3` (Points 3-Man), `5` (Percentage 5-Man, FargoRate 10-Point 5-Man) |
| **Default for new leagues** | unset — LO must choose explicitly |
| **Validation** | `> 0`; `<= max_roster_size`; reasonable upper bound enforced at the wizard layer not the schema (the schema allows any positive int) |

**Operational meaning.** The number of distinct players each team activates for a given match night. The cross-product of the two teams' active lineups (size `lineup_size × lineup_size`) is the *pairing matrix* — every cell is a potential head-to-head encounter. `lineup_size` is therefore the single most consequential structural parameter: it dominates the math for game count, the layout of the scoresheet, the per-night time commitment, and the cardinality of every per-pairing computation downstream (race lengths, per-pairing handicap diffs, etc.).

**Why it's an integer, not a range or array.** A league commits to one lineup size for the season. Variable per-night lineup sizes would break per-season normalization (a team that played a 5-player night and a 3-player night contributes asymmetrically to standings). Per-match-night flexibility is captured by *substitution rules* (still `lineup_size` active, but who's in the slots can vary), not by varying `lineup_size` itself.

### `max_roster_size` — administrative cap on roster size (NOT consumed downstream by scoring)

| Attribute | Value |
|---|---|
| **Type** | positive integer |
| **Realistic range** | 3..20 (lower bound = lineup_size; upper bound is a soft cap to prevent UI degradation) |
| **Currently shipped values** | `5` (Points 3-Man), `8` (Percentage 5-Man, FargoRate 10-Point 5-Man) |
| **Default for new leagues** | unset — LO must choose explicitly |
| **Season-stability** | NOT season-stable; may be modified mid-season at any time |
| **Downstream consumers** | only the lineup-page UI (renders this many player-selection slots; enforces the cap on roster-management operations). Not consumed by scoring, threshold, win-calculator, standings, or pairings code. |
| **Validation** | `>= lineup_size`; schema-level cap at `20` enforced by `preferences_max_roster_size_check` from the earlier modular-extension migration |

**Operational meaning.** The ceiling on roster size — how many player slots a team may carry between match nights. It exists so the lineup-page UI knows how many player-selection dropdowns to render and so the application can enforce the cap when teams add players. Substitutions, additions, and drops operate within this cap, but the cap value itself is not part of any scoring or standings calculation.

**Why this axis is in Team Geometry despite not affecting scoring.** Conceptually, "how many players a team carries" is a structural fact about team shape — same conceptual cluster as `lineup_size` (how many play tonight) and `game_generation` (how the lineups produce games). The locked main [`README.md`](../README.md) catalogs `max_roster_size` as one of Team Geometry's three wrapped axes, codifying that classification. The axis's lack of downstream scoring consumers is an operational property, not a reason to relocate it; it remains part of the team-shape concept the Module owns.

**Why a cap matters even though rosters are dynamic.** Without a cap, a team could carry an unbounded roster of low-engagement players. The cap is the league's commitment to a maximum-team-size norm; the lineup-size floor (`max_roster_size >= lineup_size`) ensures the team can always field a legal night.

**Anti-conflation note.** `max_roster_size` is the cap, not the floor or the typical size. A team with `max_roster_size=8` may carry 6 players for a season and still be compliant; the cap only kicks in when a team tries to exceed it. This Module declares the cap; teams' actual sizes are tracked in `teams.player_count` (or equivalent) at the data layer.

### `game_generation` — how lineups arrange into a game count

| Attribute | Value |
|---|---|
| **Type** | enum: `'single_round_robin'` \| `'double_round_robin'` |
| **Currently shipped values** | `'double_round_robin'` (Points 3-Man), `'single_round_robin'` (Percentage 5-Man, FargoRate 10-Point 5-Man) |
| **Default for new leagues** | unset — LO must choose explicitly |
| **Validation** | enum check (DB CHECK constraint); no inter-axis constraints |

**Operational meaning.** The rule by which the `lineup_size × lineup_size` pairing matrix becomes a concrete sequence of games. Two rules currently exist:

- **`single_round_robin`** — every cell of the pairing matrix is one game. Game count = `lineup_size²`. For 5v5: 25 games. Each player faces each opposing-team player exactly once.
- **`double_round_robin`** — every cell of the pairing matrix is played twice (typically with reversed break order or some other rotation factor). Game count = `2 × lineup_size²`. For 3v3: 18 games. Each player faces each opposing-team player exactly twice.

**Why DRR exists when SRR is simpler.** Game count per match night matters operationally — too few games and the night ends in under an hour, too many and it runs past midnight on a weeknight. For small lineups (3v3), SRR's 9-game count is too short for a satisfying match night; DRR's 18 hits a more standard 2-3 hour window. For larger lineups (5v5), SRR's 25-game count is already at the upper bound of a single night; DRR's 50 would be excessive. The choice is *not* about competitive fairness (both rules give every player equal exposure to every opponent) but about *night duration*.

**Why these two specifically, not more variants.** The 2x2 design space (full round-robin × {single, double}) is the natural extent for this axis — partial round-robins (where some pairings are skipped) break the symmetry property and require additional rule-encoding (which pairings get included?). Power-of-two bracket play, Swiss pairing, and other non-round-robin schemes belong in separate `game_generation` variants if introduced (see [§Future possibilities](#future-possibilities)).

## Validation invariants

Cross-axis validation is minimal but mandatory. The invariants below are enforced at the schema layer (DB CHECK constraints + the season-stability lock trigger) and re-checked at the application layer at preference-write time:

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| `lineup_size > 0` | application layer (no schema CHECK currently) | preference write rejected with operator-facing error |
| `max_roster_size >= lineup_size` | application layer | preference write rejected; LO must increase roster cap or decrease lineup size |
| `max_roster_size <= 20` | schema CHECK constraint `preferences_max_roster_size_check` | DB rejects with constraint violation |
| `game_generation IN ('single_round_robin', 'double_round_robin')` | schema CHECK constraint | DB rejects unknown values |
| `lineup_size` and `game_generation` immutable post-season-lock (NOT `max_roster_size`) | schema-level season-stability lock trigger applied to those two columns; `max_roster_size` is NOT in the lock set and may be updated mid-season | UPDATE on locked preferences blocked at DB layer for the two season-stable axes only |

**Downstream compatibility (not enforced as an invariant).** Pairings Generator's round-robin algorithm is universal (works for any `lineup_size`); the formula-shape [Points Games-Needed Formula](threshold-charts/3v3-games-needed.md) and [Percentage Games-Needed Formula](threshold-charts/5v5-games-needed.md) take `game_count` as a parameter and produce calibrated output for any team size. So any valid `lineup_size` produces a valid downstream chain — there's nothing for Team Geometry to enforce here. The current code has team-size-specific shortcuts (hardcoded `gameOrder.ts` table for 3v3 DRR; inline computation for 5v5 SRR) that the Step-2 refactor will replace with the universal Pairings Generator implementation per its own blueprint. These shortcuts are implementation conveniences for the currently-shipped triples; they do not represent an architectural limitation on which triples are supported.

## Math: game count derivation

Given a valid `(lineup_size, max_roster_size, game_generation)` triple, the per-match-night game count is fully determined:

```
game_count = lineup_size² × multiplier(game_generation)

  where multiplier('single_round_robin') = 1
        multiplier('double_round_robin') = 2
```

**Concrete instantiations:**

| `lineup_size` | `game_generation` | `game_count` | Shipped? |
|:---:|:---:|:---:|:---:|
| 3 | single_round_robin | 9 | no |
| 3 | double_round_robin | **18** | ✓ Points 3-Man |
| 4 | single_round_robin | 16 | no |
| 4 | double_round_robin | 32 | no |
| 5 | single_round_robin | **25** | ✓ Percentage 5-Man, FargoRate 10-Point 5-Man |
| 5 | double_round_robin | 50 | no |
| 6 | single_round_robin | 36 | no |
| 6 | double_round_robin | 72 | no |

**Downstream consumers that read `game_count`.** Several other Modules' calibration depends on it:

- **[Threshold Charts](threshold-charts/README.md)** — charts whose math expresses targets as a function of total games (e.g., "stronger team needs ⌈game_count/2⌉ + handicap_diff wins") must read this value. Charts calibrated for one game count do not transfer to another without re-calibration; see the Threshold Charts encoding-locked-input contract.
- **[Win Calculator](win-calculator.md)** — currently a binary `win_condition` that reads accumulated game-wins or points at match end. The Win Calculator does not itself read `game_count` (it reads completed-game data and benchmarks); the runtime evaluates Win Calc's decision once after all `game_count` games are played.
- **[Points System](points-system/README.md)** — some calculator variants' math depends on `game_count` (e.g., end-of-match aggregate formulas where targets scale with total games). Per-calculator dependence is documented in the Points System's own variant pages, not here.
- **[Win Calculator](win-calculator.md)** — reads `game_count` parity (even vs odd) to inform whether match-night ties are mathematically possible. Odd game counts can't tie at the games metric; even counts can. This informs Win Calc's stack — a league with odd game counts has no need for the [Tiebreak System](tiebreak-system/README.md) chain to fire on games-based wins.
- **The Standings concern (outside this catalog)** — reads `game_count` for normalization of per-team statistics (a team that wins 11 of 18 carries differently than 11 of 25). The Standings concern is being designed in a separate brainstorm; its architectural shape isn't fixed yet. Whatever shape it takes will consume `game_count` from this Module. If `game_count` varied across the season, normalization would be ill-defined; the season-stability invariant prevents this.

## How this Module interacts

Team Geometry sits at the **structural root** of the Scoring System composition. The dependency edges all flow outward.

**Upstream:** nothing. Team Geometry reads no other Module.

**Downstream (Modules that consume Team Geometry's output):**

- **[Pairings Generator](pairings-generator.md)** — consumes Team Geometry's `lineup_size` and `game_generation` (plus Match Format's per-pairing rule and the locked lineups) to produce the concrete `Array<GameSlot>` at lineup-lock time. Currently bundled inside `src/utils/gameOrder.ts` for the 3v3 case (hardcoded 18-game DRR table) and computed inline elsewhere for the 5v5 SRR case; the Step-2 refactor extracts Pairings Generator as a centralized Module with its three sub-Mechanisms (pair generation, game ordering, break/rack assignment) as first-class composable stages.
- **[Threshold Charts](threshold-charts/README.md)** — formula-shape Charts ([Points Games-Needed Formula](threshold-charts/3v3-games-needed.md), [Percentage Games-Needed Formula](threshold-charts/5v5-games-needed.md), [FargoRate Formula](threshold-charts/fargo-formula.md)) take `game_count` as input and produce calibrated targets for any team size. Discrete-table deployments (per-league LO-customized stored tables) consume `game_count` implicitly via the rows they were calibrated for.
- **The Standings concern (outside this catalog)** — reads `game_count` for normalization; reads `lineup_size` implicitly via per-player game count = `game_count / lineup_size` for per-player statistics. Architectural shape TBD via separate future brainstorm.
- **The scoring runtime** (`src/utils/match/computeMatchRunningTotals.ts` etc.) — reads `lineup_size` and `game_count` to know when a match is structurally complete (all games played) vs. terminated early (race-mode, forfeit, etc.).
- **The lineup-management UI** (`src/components/lineup/`, the wizard, roster pages) — reads `lineup_size` to size lineup-entry forms; reads `max_roster_size` to enforce roster-cap admin operations.
- **The scoresheet renderer** — reads `lineup_size` to lay out the pairing matrix display. (Also reads `pairing_format` from [Match Format](match-format.md) to decide per-cell rendering — single rack vs race-counter widget. The renderer is a shared consumer of both Modules.)

**Sibling (composes alongside, no direct dependency):**

- **[Match Format](match-format.md)** — declares the per-pairing format (single rack vs race-to-N) and base race length. Match Format does NOT read Team Geometry; both Modules feed the runtime (Pairings Generator and the scoresheet renderer use both). Team Geometry sets *how many pairings exist*; Match Format sets *what shape each pairing has*. Orthogonal — changing either Module's axes doesn't require changing the other.
- **[Handicap Systems](handicap-systems/README.md)**, **[Handicap Mechanisms](handicap-mechanisms/README.md)**, **[Points System](points-system/README.md)**, **[Win Calculator](win-calculator.md)** — all compose independently. Changing Team Geometry does not require changing any of these.

## Implementation status

The locked [`README.md`](../README.md) and [Handicap Systems README's "Architectural intent: modules are orthogonal" section](handicap-systems/README.md#architectural-intent-modules-are-orthogonal) both establish the principle that current code bundlings are *implementation artifacts from before the modular axes were fully separated, NOT statements of intended architecture*. Team Geometry's situation in current code matches:

- The triple lives partly in `preferences` columns (`lineup_size`, `max_roster_size`, `game_generation`) and partly bundled inside `SystemModule.teamFormat` (a `TeamFormatConstants` interface in `src/systems/types.ts`).
- The three prepackaged Scoring System triples are wired into the three bundled SystemModule files (`bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`).
- Game-order generation for 3v3 is hardcoded in `src/utils/gameOrder.ts` (the 18-game DRR table); 5v5 SRR generation is computed inline elsewhere. **There is no unified [Pairings Generator](pairings-generator.md) engine today** — the Module is recognized in the locked Module catalog, but the implementation is still bundled inside per-Scoring-System code awaiting Step-2 extraction.
- Validation invariants are partly schema-enforced, partly application-enforced, and not centralized.

The Step-2 refactor (per the comparison brainstorm's verdict) lifts Team Geometry out as a first-class Module with its own typed contract, extracts [Pairings Generator](pairings-generator.md) as the centralized runtime instantiator with its three sub-Mechanisms as first-class stages, and dissolves the `SystemModule.teamFormat` bundling. The 3 prepackaged Scoring System triples become declarations on the composition pages.

## Future possibilities

- **Additional `game_generation` rules.** Power-of-two single-elimination bracket play (for tournament-style nights inside a season), Swiss pairing (variable per-night opponents matched by current standings), partial round-robin (every player plays half the opposing team — useful for very large lineups where full RR exceeds night length). Each new rule requires its own game-count formula and corresponding [Pairings Generator](pairings-generator.md) sub-Mechanism implementations.
- **Variable lineup size with season-level constants.** Some leagues let teams field fewer than `lineup_size` players with a forfeit penalty applied to unfilled slots. The current Module's invariant ("lineup is always exactly `lineup_size`") would need to relax into a (min, max) range with a forfeit-cost rule (forfeit handling — application-level, not a Module of this set).
- **Per-match-night roster overrides.** A separate `effective_roster_size_for_this_night` concept could let LOs temporarily expand a roster (e.g., for a season-end shootout night) without changing the season-level cap. Currently no such override exists; rosters are immutable mid-season at the cap level.
- **Roster sub-categories.** Distinguishing "regular" roster slots from "sub-only" slots (an LO-defined sub eligibility window). This would extend `max_roster_size` from a single integer into a (regular_max, sub_max) tuple — composing more axes into this Module.
- **LO-customizable game-count formulas.** Letting an LO declare a non-RR `game_count = explicit_count` for venues with strict time limits (e.g., "we always play exactly 20 games per night, paired however the scheduler decides"). This breaks the `game_count = lineup_size² × multiplier` invariant and requires a `game_count_override` axis — non-trivial but architecturally allowable.

The category is open. Adding a new `game_generation` rule requires: (a) a game-count formula, (b) corresponding [Pairings Generator](pairings-generator.md) sub-Mechanism variants (pair generation algorithm + game ordering + break/rack assignment), (c) calibration guidance for downstream Threshold Charts at the new game count, (d) a wizard option.

## Source of truth

- `src/types/preferences.ts` — `lineup_size`, `max_roster_size`, `game_generation` column types in the `preferences` row shape
- `src/types/resolvedSystemConfig.ts` — `ResolvedSystemConfig` carries the resolved Team Geometry triple post-cascade
- `supabase/migrations/20260410000000_extend_preferences_modular.sql` — original `lineup_size`, `max_roster_size`, `game_generation` columns + initial CHECK constraints + `preferences_max_roster_size_check`
- `supabase/migrations/20260418000002_lock_tier1_preferences.sql` — Postgres trigger enforcing season-stability immutability (Team Geometry's `lineup_size` and `game_generation` are in the lock set; `max_roster_size` is NOT in the lock set and remains mutable mid-season)
- `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` — `resolved_league_preferences` view applies the 3-tier cascade for Team Geometry's axes
- `src/systems/types.ts` — `TeamFormatConstants` interface (bundled inside `SystemModule.teamFormat`; the Step-2 refactor lifts this out)
- `src/systems/{bca3v3,bca5v5,fargo5v5}.ts` — `teamFormat` declarations for the three prepackaged Scoring System triples
- `src/utils/gameOrder.ts` — hardcoded 18-game DRR table for 3v3 (the current bundled implementation that [Pairings Generator](pairings-generator.md) will extract from); the 5v5 SRR case is computed inline in the scoring runtime
- `src/wizards/league-v2/steps/` — wizard step(s) collecting `lineup_size` + `max_roster_size`; `game_generation` is currently derived from preset selection rather than independently chosen (a Step-2 refactor opportunity)
- `src/__tests__/database/lock_tier1_preferences.db.test.ts` (if present, naming approximate) — characterization of the lock trigger's behavior
