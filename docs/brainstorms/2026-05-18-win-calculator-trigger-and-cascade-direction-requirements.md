---
title: Win Calculator — trigger-driven, two-mode architecture (captured direction, rev 2)
date: 2026-05-18
status: captured-direction
audience: developer + AI sessions
---

# Win Calculator — captured architectural direction (rev 2)

## What this is

A **captured architectural direction** from verbal sessions, not a full option-exploration brainstorm. Emerged during the Unit 1 implementation attempt (Win Calculator extraction per `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`) when the consumer-swap (Phase C) surfaced that the existing runtime behavior is structurally richer than the locked Win Calc blueprint documents.

**Revision history:** rev 1 captured five insights but merged two genuinely-distinct match-end modes into one (cold-read flagged the conflation). This rev 2 reflects the corrected two-mode architecture: leagues operate in EITHER chip-mode OR cascade-mode, never both, never neither.

## The problem this resolves

The locked Win Calc blueprint (`docs/league-system/modules/win-calculator.md`) describes ONE mode (metric precedence stack walker with optional `edge` fallback). The actual existing runtime supports TWO mutually-exclusive modes:

- **Chip-mode** (BCA today) — threshold-based; each team has a per-side win threshold; trigger fires when a team meets theirs; nobody meets theirs = tied. No cascade, no value comparison (per-side thresholds are different, so comparing raw values across teams isn't meaningful).
- **Cascade-mode** (Fargo today) — no threshold; walks an ordered metric stack at game-end; all metrics tied = tied.

The locked blueprint documents only cascade-mode. When the Unit 1 Phase C extraction tried to swap consumers to use the locked-doc model, it broke for the BCA case because BCA isn't doing what the locked doc describes — it's doing chip-mode, which the blueprint doesn't acknowledge.

Additionally, the blueprint doesn't document the trigger protocol (Win Calc is signal-driven, not self-firing) or the end-cascade (Win Calc orchestrates post-decision work but doesn't own the work).

## The architectural direction

### Two mutually exclusive Win Calc modes

A league's Win Calc is configured in EXACTLY ONE of these two modes. Validation rejects "neither" (no win condition defined) and "both" (semantically incoherent). **The exact storage shape for this mode selection is implementation-time** — could be a `win_calc_mode` enum column, derived from presence of `threshold_chart_id` (chart configured = chip-mode; no chart = cascade-mode), or another mechanism. The constraint that matters is "exactly one mode" regardless of how it's stored.

**Naming note:** Win Calculator stays SINGULAR per PRINCIPLES § Module § 9. The two modes are *parameter variation* of one Module, not *selection between two Modules*. Same shape as Match Format having `pairing_format` with `single_rack`/`race_to_n` variants — we don't call it "Match Formats" plural because of the two values. Win Calculator is similarly one Module whose operational behavior is parameterized by the chip-vs-cascade mode.

**Chip-mode (threshold-based):**
- Each team has its own win threshold — per-side, asymmetric, derived from the league's Threshold Chart for the handicap difference at hand
- A Threshold Trigger watches game outcomes during play
- Fires a "winner chip" the instant a team's count reaches their threshold
- The chip pre-computes the winner; no comparison needed (per-side thresholds aren't comparable across teams)
- If neither team meets their threshold by end of scheduled games → **tied** (no fallback comparison — the rule IS "meet your target")

**Cascade-mode (no threshold):**
- No threshold exists; no chip is ever emitted
- Match plays its full scheduled game count
- At game-end, Win Calc walks the LO-configured metric precedence stack (the model documented in the existing locked blueprint)
- Ordered metrics: first one on which teams differ decides
- All metrics tied → **tied**

Tie outcomes in EITHER mode fire the league's configured Tiebreak System chain (per the separate tie-resolution direction in `2026-05-17-tie-resolution-ownership-requirements.md`). If no Tiebreak chain is configured, the match is recorded as tied.

**Module-boundary contract:** the Tiebreak System sees a uniform "tied" input regardless of which mode produced it. Chip-mode's "no chip + all games played" tied case and cascade-mode's "all metrics tied" tied case converge to the same signal at the Tiebreak System's edge. The Tiebreak chain doesn't need to know which mode fed it; it just produces edge for the leagues that configured it.

**Why mutually exclusive (not stages of one mode):**
- Chip-mode's per-side asymmetric thresholds mean raw values aren't comparable across teams (home meeting their 10 vs away sitting at 8 isn't comparing the same thing — the chart says they need different targets)
- Cascade-mode's value-comparison across teams requires that the values mean the same thing on both sides (which thresholds make impossible)
- Trying to mix the two creates undefined behavior (what does "chip fired + cascade walks" mean when the chip already declared a winner?)

### Mapping to existing code

- **BCA 3v3 / BCA 5v5 today** = chip-mode. The `determineMatchResult` function implements the chip-firing logic inline (checks if either team hit their threshold; if both at tie-threshold simultaneously → tied; otherwise tied by default).
- **Fargo 5v5 today** = cascade-mode. The existing `winCondition === 'points' ? <ternary> : bcaResult` ternary implements the cascade walk inline (points-first, then games, then home-wins-ties).

The Unit 1 Phase A/B infrastructure (`src/systems/win-calculators/`) was built assuming the locked doc's cascade-mode-only model. It supports cascade-mode well; it doesn't cover chip-mode. That's why the Phase C consumer swap couldn't proceed without an architecture revision.

### Win Calc is signal-driven, not self-firing

In BOTH modes, Win Calc receives external signals; it never watches game outcomes itself.

**Chip-mode signals:**
- **Winner chip** — Threshold Trigger fires when a team meets their threshold. Payload: `{ winner: 'home' | 'away', via_metric: <metric-name>, via_threshold: <threshold-value> }`. In race-mode configurations (currently unbuilt — see Deferred), the chip would also carry "end game now" semantics telling the scoring runtime to stop scheduling additional games.
- **Games-complete-no-chip** — fires when scheduled game count is reached without any winner chip having fired. Payload: `{ reason: 'all_games_played_no_threshold_met' }`. Win Calc treats this as the tied case.

**Cascade-mode signal:**
- **Games-complete** only — fires when scheduled game count is reached. No chip ever exists in cascade-mode. Payload: `{ reason: 'all_games_played' }`. Win Calc walks the cascade.

The "signal" mechanism (function call, event emitter, React state update — implementation detail) is in-memory and synchronous in the current single-server architecture.

### Chip is in-memory state, not a network message

The winner chip is in-memory state (synchronous local update), NOT a network-mediated message between separate systems. This matters for the "no chip = tied" inference in chip-mode:

- **Sequencing is deterministic:** Trigger evaluation runs synchronously after each game scoring, BEFORE Win Calc's completion check, in the same execution context.
- **Race conditions of the "chip in flight" kind don't apply** — the chip is local state by the time Win Calc reads it. The chip is faster than the Supabase game-recording round-trip; if anything, the chip is more likely to be present in state than the game-record itself is.
- **"No chip + all games played" is a safe inference** *because of* the deterministic sequencing, not despite it.

This relies on the current synchronous single-server architecture. If the system ever became distributed (multi-server with async messaging), the chip would need to become an explicit message and "no chip received" would need to be replaced by an explicit "all games complete with no winner met threshold" message. Until then, the current inference is sound.

### Threshold Trigger is generic — parameterized by metric

The Threshold Trigger (a System per PRINCIPLES § Triggers) is parameterized; the same Trigger architecture handles different metrics:
- A metric to observe (`games_won`, `points_earned`, future metrics)
- A per-team threshold value (from the Threshold Chart for the league's handicap difference)
- A signal-emission contract (the winner chip payload above)

"Race to 9 games" and "race to 100 points" use the same Threshold Trigger with different metric parameters. No separate "points trigger" Module needed.

### End cascade is orchestration, not Win Calc doing the work

After winner is determined (via chip OR via cascade walker), Win Calc orchestrates the end-of-match sequence — but each step's actual work lives in a different concern:

1. **Post-decision point awards** — Win Calc calls into Points System for any match-end point awards. Points System does the computation; Win Calc just triggers the call.
2. **Two-party confirmation flow** — Win Calc hands off to the UI/product layer. The state machine, real-time sync between two scorekeepers, and pending/optimistic states are NOT Scoring System Module concerns.
3. **Rewind / undo handling** — When a scorekeeper backs out, the UI layer signals Win Calc, which reverses point awards (calling Points System again to undo) and resets to pre-confirmation state. The UI layer drives the rewind; Win Calc responds.
4. **Final recording** — Win Calc signals the persistence layer to write the final match row. The persistence layer does the write.

Win Calc **sequences** this work; it doesn't **do** it. Categorizing the work this way matters because the responsibilities cross Module boundaries:
- Point awards → Points System Module
- Confirmation flow → UI/product (outside the Scoring System catalog)
- Rewind → UI/product
- Final recording → persistence layer

Future Win Calc blueprint expansion should describe this orchestration sequence, NOT lump these responsibilities into Win Calc itself.

### Achievement Triggers — same architecture, different performer

Triggers (per PRINCIPLES § Triggers, with sub-Mechanisms event-acceptor → detector → performer → re-armer) can do different things via their **performer** Mechanism:

- **Match-end signaling performer** — emits a winner chip that fires Win Calc (Threshold Trigger described above).
- **Mid-match state-modifying performer** — modifies the running score by adding bonus points (achievement Triggers like break-and-run, golden break).

These aren't different "kinds" of Trigger; they're the same Trigger architecture with different performer Mechanisms. When future Trigger work happens, the design needs to accommodate both performer flavors without making them special-cased.

### Cascade walker — Module or sub-component (deferred bookkeeping)

The cascade walker (the pure function that walks an ordered metric stack and returns a winner) is conceptually distinct from Win Calc's other responsibilities. Whether it's promoted to its own Module in the catalog OR stays as a sub-component inside Win Calc is a bookkeeping decision deferred to implementation time. Both shapes are defensible:

- **Sub-component:** the walker is small (~40 lines); doesn't need its own Module wrapper; Win Calc owns it as an internal mechanism.
- **Own Module:** distinct contract (input: stack + match data; output: WinnerDecision); composable with Win Calc the way Tiebreak System composes with it.

The Unit 1 Phase A walker (`src/systems/win-calculators/walker.ts`) IS this cascade. Already built. Whether it gets promoted later doesn't change its current shape.

**Important scope note:** chip-mode doesn't use the walker at all. The walker is purely a cascade-mode tool. Phase A/B infrastructure is cascade-mode-only; chip-mode infrastructure (the Threshold Trigger system + the chip-receiving glue) is separate future work.

## What this changes about the locked Win Calc blueprint

The locked blueprint needs SUBSTANTIAL revision when next unlocked. This is more than additive expansion — it's structural:

1. **Acknowledge both modes** — the blueprint currently reads as if all matches use the cascade walker. In reality two distinct modes exist; the blueprint needs to document chip-mode as a peer alternative (currently absent entirely).
2. **Trigger-protocol section** — describes Win Calc as signal-driven; names the winner chip + games-complete signal contracts; describes which signals fire in each mode.
3. **End-cascade orchestration section** — documents the post-decision sequencing (Points System → UI confirmation → persistence) and clarifies that Win Calc orchestrates rather than owns this work.
4. **Mode-selection validation** — note that league configuration requires exactly one mode; validation rejects "neither" and "both."
5. **Re-frame the metric stack section** — currently the metric stack is described as Win Calc's mechanism. In the corrected picture, the stack is cascade-mode's mechanism specifically; chip-mode doesn't use a stack at all.

## What this changes about Threshold Charts / Triggers design

When Threshold Charts is extracted (currently Unit 2 in the migration plan) and the Threshold Trigger system is implemented, the Trigger must be designed with these responsibilities from day one:

- Configurable metric to watch (`games_won`, `points_earned`, future)
- Per-team threshold input (from the Threshold Chart for the league's handicap diff)
- Winner chip emission with explicit payload (`{ winner, via_metric, via_threshold }`)
- "End game now" semantics in race-mode configurations
- Generic enough to accommodate both match-end signaling performer AND mid-match state-modifying performer Mechanisms

If Threshold Trigger is built as a passive value-lookup (the natural first instinct from "Threshold Charts produce values") instead of an active signal-emitter with these responsibilities, the chip-mode Win Calc integration breaks and we'd have to rework it. **Do not build Threshold Trigger before this brainstorm has been read.**

## What changes about the migration plan

**Win Calc is wrong-ordered as Unit 1.** Its architectural complexity (two distinct modes, signal coupling, orchestration across multiple Modules, end-cascade work touching UI + product + persistence layers) is among the highest in the catalog. The "smallest preference field" sizing was based on current code, not architecture.

**Recommended re-ordering:**
- **Unit 1 (real shakedown):** a genuinely simple Module. Team Geometry and Match Format are the best candidates — both are passive configuration bundles. Honest caveats:
  - **Team Geometry** has a derived `game_count = lineup_size² × game_generation_multiplier` calculation; the extraction must preserve that derivation since downstream Modules consume `game_count`.
  - **Match Format** has `race_length` which couples to the future race-mode-vs-threshold-mode distinction noted in this brainstorm; the extraction can be done without fully resolving race-mode design, but the implementer should be aware of the coupling.
  - Both are still simpler than Win Calc by an order of magnitude. Either makes a defensible shakedown.
- **Win Calc extraction:** deferred — should land AFTER Threshold Charts + Threshold Trigger are extracted (so the chip protocol exists in code) AND after the locked Win Calc blueprint is expanded (so the two-mode architecture is documented).

**Unit 1 Phase A + B artifacts** (committed in `7915bcf` + `ff01b68`) — the WinCalculator interface, walker, factory, and SystemModule field — are sound **cascade-mode infrastructure**. Specifically: the `WinCalculator` interface uses a `metricStack` field; the walker takes `(stack, matchData)` as inputs; both shapes assume the league walks an ordered list of metrics to decide. Those shapes don't fit chip-mode (which receives a chip payload, doesn't walk a stack, doesn't have a `metricStack` field at all). So Phase A/B doesn't cover chip-mode — chip-mode would need different interface fields (chip payload reception, signal listener registration) and a different decider (no stack walking). Phase A/B stays committed as deferred scaffolding, with a note in the migration plan that it's partial (cascade-mode only) and will be complemented by chip-mode infrastructure when Win Calc is fully extracted later. Phase C (consumer swap) does NOT proceed.

## What's deferred

- **Cascade walker as its own Module vs sub-component of Win Calc** — bookkeeping; both shapes defensible; pick at implementation time.
- **Achievement-Trigger design details** — different performer Mechanism; needs its own design pass when the achievement system is being built.
- **Two-party confirmation flow's UI state model** — real product behavior (optimistic UI, pending states, real-time sync, rollback on disagreement); deserves its own brainstorm when that UI work is scheduled.
- **Cascade order configurability** — for now leagues are either "games first" or "points first" with a fixed order; future work could let LOs configure arbitrary cascade orders.
- **Race-mode for chip-mode (early termination)** — the "end game now" chip semantics need design when race-mode is built. BCA today doesn't have race-mode; if/when it does, the Threshold Trigger needs to emit "end game now" alongside the winner chip.

## Origin

Captured from verbal sessions on 2026-05-17 and 2026-05-18 between Ed and Claude, triggered by the Unit 1 Phase C attempt revealing that the existing runtime is richer than the locked Win Calc blueprint documents. Rev 1 captured five insights with the two modes conflated; rev 2 (this revision) corrects to the mutually-exclusive two-mode architecture after cold-read iteration 1 surfaced the conflation. Phase A + B infrastructure committed in `7915bcf` + `ff01b68`; Phase C halted with no consumer swap.
