---
title: Tie-resolution ownership — captured architectural direction
date: 2026-05-17
status: captured-direction
audience: developer + AI sessions
---

# Tie-resolution ownership — captured architectural direction

## What this is

This document captures an **architectural decision reached verbally** between Ed and Claude on 2026-05-17, not a full option-exploration brainstorm. The direction is decided; this document preserves it for the next session to lean on. Implementation (locked-doc unlocks, blueprint creation/dissolution, code refactoring) is a separate planning step that follows this capture.

## The problem this resolves

The whole-system cold-read across the 9-Module Scoring System catalog flagged a contradiction: Threshold Charts variant pages say "tie semantics belong to Win Calculator," Win Calculator's locked doc treats itself as primitive with no tie handling, and Standings & Tiebreakers claims the tiebreaker firing/format axes. No Module's doc actually claims ownership of match-end tie resolution. The behavior exists in code (`linear_above_threshold.ts` plus scattered runtime hooks) and the docs disagree about who owns it.

## The architectural direction

### Win Calculator owns winner determination, including tie resolution

Win Calculator gets a **metric precedence stack** — a configured ordered list of metrics consulted in sequence. The first metric on which the two teams differ decides the match. Today's primitive `win_condition` (games vs points) becomes the simplest possible stack — a one-metric stack. Real league configurations may chain multiple metrics (e.g., threshold → points → games → edge).

When the stack runs out without producing a winner (all metrics tied), Win Calculator **fires the Tiebreak System** as a trigger. The Tiebreak System produces an **edge metric** — single-valued by construction, always assignable to one team. Edge becomes the lowest-precedence metric in Win Calc's stack. With edge in the stack, ties always resolve.

The wincon is intentionally "dumb" about how edge was produced — it just sees a metric and uses it. This preserves Win Calculator as the sole authority on "who won," with the Tiebreak System as a service that produces a metric for Win Calc to consume.

### Tiebreak System becomes a new Module

A new Module joins the Scoring System catalog: **Tiebreak System** (singular-named per PRINCIPLES § Module § 9's rule for chain-pattern Systems). The Module composes atomic Tiebreak Mechanism variants in a chain. Each Mechanism's only job is "produce edge for one team." Variants include:

- `coin_flip` — RNG produces edge for one side
- `roshambo` — rock-paper-scissors (would need a small in-app UI added)
- `single_game` — one rack played; winner gets edge
- `single_round` — e.g., a 4v4 mini-round; team with more wins gets edge
- `race_to_n` — short race played; winner gets edge
- `manual` — operator-decides via dialog
- `teams_self_determine` — teams report a winner via in-app prompt

The set is open — new methods are added as Mechanism variants per the Mechanism pattern (cheap; no other Module touches).

### Tiebreak System is a conditional-fallthrough chain

The LO configures a **chain** of Tiebreak Mechanisms. Each runs only if the previous didn't produce edge. The first to do so wins. Chain length is open; the same Mechanism may appear multiple times.

Example: `single_round + 4 coin_flips + roshambo` — try a single 4v4 round first; if it ends tied, run 4 coin flips; if those somehow all tie, fall back to roshambo.

This is a slight variation on PRINCIPLES § System § 4's chain pattern — existing chain examples (Points System, Trigger) have all components run together. The Tiebreak System chain is **conditional fallthrough** — each link runs only when needed. Worth a one-line acknowledgment when PRINCIPLES gets updated to recognize this sub-pattern.

### Standings & Tiebreakers dissolves

The current S&T Module bundles two scope-different concerns (match-level tiebreaker firing + season-level standings sort). With this direction:

- **Match-level tiebreaker concerns** (`tiebreaker_trigger`, `tiebreaker_format`) move out of S&T entirely — absorbed by Win Calculator + the Tiebreak System. Exact field-mapping is an implementation-time concern.
- **Season-level standings concerns** (`standings_sort`) move **OUT of the Scoring System catalog entirely**. Standings is a display/aggregation concern, not a scoring concern.

### Standings is its own concern, outside the Scoring System

Standings answers "given all matches that have been scored, what does the league table look like?" That's display + aggregation; it doesn't produce match scores.

Standings may itself become a System with substantial scope — possibly subsystems for personal stats, achievements like break-and-run, individual play tracking. Its actual architectural shape is a **separate future brainstorm**, not designed here. For this brainstorm, the relevant fact is: Standings exits the modular Scoring System catalog.

### Net effect on the 9-Module catalog

- Module slot #9 (was Standings & Tiebreakers) → becomes **Tiebreak System**
- Catalog count stays at 9
- Standings becomes its own thing outside the catalog (shape TBD via separate brainstorm)

## What this direction handles cleanly

- **"Accept tie as final result"** — the metric stack just doesn't include edge as a fallback. Tie stands; no tiebreaker fires.
- **Multiple tiebreaker methods configurable per league** — the Tiebreak System chain accommodates arbitrary length and repetition.
- **Tiebreaker still tied after running** — by construction, the chain runs until edge is produced. Including at least one deterministic edge-producer (coin_flip, manual, etc.) guarantees resolution.
- **Cross-season tied standings** — the standings sort lives outside the Scoring System now. The Scoring System isn't asked about season-level ties; that's a Standings concern.

## What's deferred (out of scope for this brainstorm)

- **Standings/Statistics System shape** — its own brainstorm. May be a single System with subsystems; may be a filter-with-settings; may be something else. Not designed here.
- **Exact field names** for the new Win Calc metric stack. `win_condition` evolves to something like `metric_precedence` — internal naming, developer's call at implementation time.
- **Migration path** for existing leagues' S&T configurations into the new shape — implementation-time concern.
- **Roshambo UI** — the only Tiebreak Mechanism needing new front-end code. Implementation-time concern.

## Implementation impact (for the next plan)

When this gets implemented, the following surfaces need touching. Several require explicit [Principle 7](../league-system/PRINCIPLES.md#7-canonical-docs-as-policy) unlock invocations from Ed:

- **PRINCIPLES.md** (locked) — Module catalog enumeration changes; conditional-fallthrough chain pattern gets noted in § System § 4
- **README.md** (locked) — catalog table updates (Module slot #9 name change; S&T row is replaced by Tiebreak System)
- **win-calculator.md** (locked) — substantial expansion to describe the metric-stack model and the Tiebreak System trigger
- **standings-tiebreakers.md** — file dissolves (deleted)
- **New `modules/tiebreak-system/README.md`** — blueprint for the new Module (plus per-variant pages for the shipping Mechanism set)
- **Standings concern** — lands somewhere outside `docs/league-system/modules/`; actual location TBD when its own brainstorm runs

## Origin

Captured from a verbal session on 2026-05-17 between Ed and Claude, immediately following the whole-system cold-read of the modular Scoring System docs. The cold-read findings that triggered this brainstorm were committed to the `docs/league-system-l1` branch through commit `fca4c89` (the smaller doc cleanups; locked-doc fixes in `6556811`).
