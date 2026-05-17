---
title: Threshold Charts (Module)
date: 2026-05-16
status: active
audience: developer + AI sessions
---

# Threshold Charts

## Kind

**Threshold Charts is a [System](../../PRINCIPLES.md#system--deep-dive)-kind Module in the selection pattern.** It offers multiple **[Chart](../../PRINCIPLES.md#chart--deep-dive)-kind** Modules as alternatives; the league configuration picks one. The plural name signals the coexistence of those alternatives as named options.

(Why this matters: knowing the kind tells you what's inside before you read further. A selection-pattern System has N variants where exactly one is active per league. Each variant here is itself a Module — a Chart — with its own typed contract.)

## Essence

A **threshold chart** maps a handicap input (a difference, a rating pair, or a derived value) to a **threshold value** the rest of the system uses to set up the match — typically per-side target wins, per-side starting points, or per-pairing race lengths. The Module is the **passive data layer** of the handicap chain: given the same input, it always returns the same output, with no state and no side effects.

Charts come in **two interchangeable shapes**:

- **Discrete table** — explicit rows mapping input ranges (or exact inputs) to output values.
- **Formula** — a continuous function over the input space.

Both shapes are valid forms of the Chart kind; they're interconvertible expressions of the same mapping. **Formulas are generally preferred** where the math is known (continuous coverage, single source of truth, easier LO customization). Discrete tables are mandatory when LO edits diverge from any clean formula, or when the mapping was empirically derived with no underlying math. (See [PRINCIPLES § Chart — Deep Dive § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived).)

## Why threshold charts exist

A handicap input alone is just a number — *"the team-aggregate difference is +3"* or *"FargoRate gap is 80 points"* says nothing about how to set up the match. The Chart turns that number into a **match-setup benchmark** other Modules can consume: *"the stronger team needs 12 game wins; the weaker team needs 9,"* or *"in this individual pairing, race to 6 vs race to 4."* Without the Chart, a [Handicap Mechanism](../handicap-mechanisms/README.md) has nothing concrete to apply.

Charts are also **where calibration lives**. The "right" target-wins-per-handicap-difference for a 3-player league with 18 games is not the same as for a 5-player league with 25 games — same handicap encoding, different match shape, different calibration. Different leagues swap Charts without changing the encoding or the mechanism. This is what makes leagues genuinely customizable: the Chart is the dial.

## Boundary

A threshold chart is **only** the passive lookup from handicap input to threshold value. It is **not**:

- The strength encoding itself — that's a **[Handicap System](../handicap-systems/README.md)** (Points, Percentage, FargoRate, Skill Level). A Chart consumes the encoding's output; it doesn't define the encoding.
- The rule that *applies* the threshold to the match — that's a **[Handicap Mechanism](../handicap-mechanisms/README.md)** (extra_games, start_points, race_length_adjustment). The mechanism reads the Chart's output and declares the in-match asymmetry; the Chart itself just provides the number.
- The rule that *decides who wins* the match — that's the **[Win Calculator](../win-calculator.md)**.
- The per-game point allocator — that's the **[Points System](../points-system/README.md)**.

If a proposed feature changes *how a handicap input becomes a threshold value* (a new lookup table, a new formula shape, a new calibration), it belongs here. If it changes *how that threshold gets applied during play*, it belongs in Handicap Mechanisms.

### Architectural intent: encoding-locked input, Converter-mediated composition

**Encoding-locked input is a contract, not a preference.** A Chart — whether stored as a discrete table or expressed as a formula — has its input domain bound to the [Handicap System](../handicap-systems/README.md) output type it was calibrated against. A Chart calibrated for FargoRate (100–850) isn't calibrated to consume a Points value (-2 to +2); the math is undefined outside the input domain and produces nonsense rather than a bad answer. Pairing a Chart with a different Handicap System needs a **[Converter](../../PRINCIPLES.md#converter--deep-dive)** placed in front of the Chart to translate the upstream output into a value the Chart's input domain accepts.

**Output-shape coupling to the downstream Mechanism.** A Chart's output is shaped for the [Handicap Mechanism](../handicap-mechanisms/README.md) it was calibrated against (asymmetric per-side game targets for `extra_games`; bonus-points value for `start_points`; per-pairing race lengths for `race_length_adjustment`; etc.). A Chart whose output shape doesn't match the active Mechanism's expected input needs an output-side adapter to compose.

**Composability promise (per [Principle 10 — Composability contract](../../PRINCIPLES.md#10-composability-contract--no-break-composition)).** Principle 10 sets the bar: an LO-selected combination of encoding × Chart × Mechanism should chain to a runnable output. The way this gets honored architecturally is that bridging Converters are admitted alongside the typed Modules that need them — when a new Handicap System (or any new typed Module) is admitted, the adapters needed to bridge it to the existing types come with it, so the Chart receives a value in its input domain at runtime. Combinations that lack validation surface a warning. The intent is to handle type-bridging at admission rather than rely on runtime fallbacks. (Per [PRINCIPLES § Converter § 4](../../PRINCIPLES.md#converter--deep-dive), no Converter implementations exist in code yet — the modular Scoring System currently ships with a small set of prepackaged Scoring Systems whose internal types already line up, so the Converter capability hasn't been exercised yet.)

**Implementation status.** The current codebase couples specific Charts to specific encoding-runners (e.g., the 3v3 Points Chart is hardcoded inside the `bca3v3` SystemModule rather than queried as an independent Chart Module). **Implementation artifact, not architectural intent.** Step-2 refactors will lift Charts out as first-class Modules selected by the league configuration.

## Variants index

Charts organize on two axes:

- **Scope** — does the lookup feed a **team-aggregate** benchmark (one threshold pair for the whole match) or a **per-pairing** benchmark (one threshold pair per individual matchup)?
- **Shape** — is the chart a **discrete table** (exact rows or ranges) or a **formula** (continuous function)?

**Shape is a deployment choice, not a separate variant.** Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived), formulas and discrete tables are *interchangeable shapes* of the same Chart kind. A formula-shape Chart can always be projected into a discrete table (for printable distribution, LO inspection, or LO row-level customization); a discrete-table Chart can be a stored per-league artifact when an LO has edited specific rows away from any clean formula. Both shapes are first-class deployment forms — the formula is typically the default, the discrete table is the per-league shape when an LO has customized it. Neither is more "real" than the other; they encode the same mapping.

| | **Discrete table** *(LO-customized per-league stored shape — see [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived))* | **Formula** *(default deployment shape — the source of truth that projects into tables on demand)* |
|---|---|---|
| **Team-aggregate** | *Per-league stored tables that diverge from the formula-shape variants below; each league's customized table is its own Chart instance.* | [Points Games-Needed Formula](3v3-games-needed.md) — Points encoding, parameterized by `game_count` (universal across team sizes) <br> [Percentage Games-Needed Formula](5v5-games-needed.md) — Percentage encoding, parameterized by `game_count` (universal across team sizes; BCAPL-fitted calibration) |
| **Per-pairing** | [Race Points](race-points.md) — Points encoding, 2D pairwise lookup <br> [Race Percentage](race-percentage.md) — Percentage encoding, 2D gap × tier lookup | [FargoRate Formula](fargo-formula.md) — FargoRate encoding, continuous |

The Module is open to additional Charts in any cell. Each Chart's variant page describes its specific lookup shape and output type; see the page for the I/O contract.

## How this Module interacts

Charts are passive — they don't *do* anything until queried. The query flow at the typed-I/O level:

**Input contract (per variant):**
- A handicap difference, a rating pair, or a derived value produced by an upstream [Handicap System](../handicap-systems/README.md). The exact input type depends on the variant — see each variant page's I/O section.

**Output contract (per variant):**
- A **threshold value shape** — a named category whose specific fields depend on which Chart is active. Common shapes: `(target_wins_a, target_wins_b)`, `(target_wins, target_ties, target_losses)` per side, `(race_length_a, race_length_b)`. See each variant page for the specific output shape.

**Upstream:**
- **[Handicap Systems](../handicap-systems/README.md)** produce the encoded strength values. The Chart receives those as input (with a [Converter](../../PRINCIPLES.md#converter--deep-dive) inserted when types don't naturally line up).
- **[Team Geometry](../team-geometry.md)** produces `game_count` (derived from `lineup_size × game_generation` multiplier). Formula-shape Chart variants take `game_count` as an input parameter to produce calibrated targets for any team size; discrete-table variants are calibrated for specific game counts. See each variant page for the variant's specific input contract.

**Internal partner / consumer:** [Handicap Mechanisms](../handicap-mechanisms/README.md) consume the Chart's output as the concrete value they apply to match setup. A mechanism with no calibrated Chart for the active encoding has nothing meaningful to apply.

**Downstream:** Charts have no downstream contract of their own — the consuming Mechanism owns what happens next.

### Same-input-same-output (Charts are pure)

A Chart called with input X always returns output Y. No state, no time-varying behavior, no caller-identity branching. This purity is what makes a Chart safely shared across many consumers and many concurrent matches. (See [PRINCIPLES § Chart — § 5](../../PRINCIPLES.md#5-io-contract-for-charts).)

## Cascade behavior

Stored Charts live in a single `threshold_charts` table keyed by an **owner-scope cascade**: global, organization, or league. A league using a default Chart reads the global row; a league with a customized Chart reads its own row, overriding the more general scope. This makes per-league customization a row insertion at the right scope, not a code change.

Cascade order (most-specific wins):

1. League-scoped row (this league's customized Chart, if present)
2. Organization-scoped row (this org's default, if present)
3. Global row (the shipped defaults)

A formula-shaped Chart in code can be re-expressed at any scope as a saved discrete Chart if an LO has edited individual cells away from the formula's output. (Per [PRINCIPLES § Chart — § 4](../../PRINCIPLES.md#4-formula-first-charts-are-derived) — once edits diverge from any clean formula, the table is the only honest persistence.)

## Future possibilities

- **LO-authored custom charts** — operators define their own rows or formula for a league. The cascade already supports the storage shape; the LO-customization UI is the work that exposes it.
- **Formula ↔ table round-tripping** — start from a formula, render to a table, edit cells, persist as a table; or fit a formula to an existing table via symbolic regression. Useful when an LO wants to start from a clean function and tweak.
- **Cross-axis charts (multi-input)** — lookups that consume more than one independent input (e.g., handicap difference *and* match length *and* venue type) to produce a calibrated threshold. The current schema's `comp_1` / `comp_2` pair supports 2D today; further extension is a schema-level question.
- **Calibration-by-data tools** — generating a new Chart by fitting historical match outcomes to a desired competitive balance target. Removes the manual calibration burden.
- **Per-Mechanism Chart families** — distinct Chart sets calibrated for different Mechanisms (e.g., a "Points encoding × start_points Mechanism" Chart that doesn't exist today because the Mechanism pairing isn't wired).

## Source of truth

- `supabase/migrations/20260410000002_threshold_charts.sql` — `threshold_charts` and `threshold_chart_rows` table definitions; the `lookup_threshold()` SQL function that performs the scope-cascade query
- `supabase/migrations/20260410000003_seed_threshold_charts.sql` — global default rows for the currently-shipped Charts
- `supabase/migrations/20260410000004_add_threshold_chart_fk.sql` — `preferences.threshold_chart_id` foreign key
- `supabase/migrations/20260429000004_threshold_charts_rls_production.sql` — row-level security
- Per-Chart code anchors live in each variant page's *Current code state* section
- `src/utils/handicap/fargoGamesWonThresholds.ts` — Fargo formula entry point (formula-shaped Chart, not stored in the SQL tables)

**Anti-conflation note.** The word **chart** appears in several adjacent meanings in the codebase — *threshold chart* (this Module), *handicap chart* (an operator-colloquial term sometimes covering both encoding and lookup together), *standings chart* (a UI table of team standings). When writing or reading, lowercase *"chart"* is the abstract noun; capitalized *"Chart"* or *"Threshold Chart"* refers to this Module specifically (per [PRINCIPLES § Chart — § 7](../../PRINCIPLES.md#7-naming-charts)).
