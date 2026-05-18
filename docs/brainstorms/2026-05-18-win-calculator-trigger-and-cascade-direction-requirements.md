---
title: Win Calculator — trigger-driven model + cascade decision (captured architectural direction)
date: 2026-05-18
status: captured-direction
audience: developer + AI sessions
---

# Win Calculator — captured architectural direction

## What this is

A **captured architectural direction** from a verbal session, not a full option-exploration brainstorm. The direction emerged during the Unit 1 implementation attempt (Win Calculator extraction per `docs/plans/2026-05-17-001-refactor-modular-framework-migration-plan.md`) when the consumer-swap (Phase C) surfaced that the existing runtime behavior is richer than the locked Win Calc blueprint documents. This document preserves the architectural insights so the next implementation session has the right framing.

## The problem this resolves

The locked Win Calculator blueprint (`docs/league-system/modules/win-calculator.md`) covers the metric precedence stack model well, but is **incomplete in two structural ways**:

1. **The trigger protocol is undocumented.** The blueprint implies Win Calc just "walks the stack at match end" — but in reality Win Calc is signal-driven (an external Threshold Trigger tells it when to fire AND often pre-computes the winner via a "we won chip"). The blueprint never names this protocol.

2. **The end-cascade is undocumented.** After the winner is determined, real work happens: post-decision point awards, two-party confirmation flow, rewind/undo handling when someone backs out of confirmation, final recording to the match row. None of this is in the blueprint.

When the Unit 1 extraction tried to swap consumers from `win_condition` inline branching to `winCalculator.decide(matchData)`, it became clear that the consumers do **threshold-based determination** (a team reaches their target wins → they win, regardless of whether the other team has more raw wins) and **multi-metric cascade** (points first; if tied, games; if still tied, home wins via `>=`). Neither maps to the simple value-comparison walker Unit 1 built.

The root cause: the migration plan sized Win Calc as "smallest — already a binary `win_condition` preference." That measured CURRENT CODE size, not ARCHITECTURE size. In code today, Win Calc is a tiny preference field. In the locked architecture (per the rich blueprint and this captured direction), Win Calc is one of the most architecturally entangled Modules in the catalog.

## The architectural direction

### Win Calc is signal-driven, not self-firing

Win Calc does NOT decide on its own when to run. **External Triggers fire it.** The two signals it receives:

1. **From a Threshold Trigger** — when a team hits their win-threshold during play, OR when both teams hit their tie-thresholds. The signal carries either a "winner determined" payload (the "we won chip") OR a "tied on this metric" payload.
2. **From the "all games complete" Trigger** — fires when the scheduled game count has been played without any Threshold Trigger having decided. The signal says "match is structurally complete; walker decides."

Win Calc itself doesn't watch the running score. The Trigger system does that.

### Threshold Trigger as a generic metric-watcher

The Threshold Trigger (an existing canonical System example per PRINCIPLES § Triggers) is **parameterized by which metric to watch**:

- `metric: 'games_won'` — used by BCA today (threshold: e.g., 9 wins for 18-game 3v3)
- `metric: 'points_earned'` — used by a hypothetical race-to-100-points format
- Future metrics: any axis the system tracks per team per match

The Trigger emits two distinct "chips" when it fires:

1. **"We won chip"** — `{ winner: 'home' | 'away', via_metric: 'games_won' | 'points_earned' | ... }`. The Threshold Trigger PRE-COMPUTES the winner; Win Calc doesn't need to do its own cascade. Hand directly to end-cascade.
2. **"End game now chip"** — only emitted in race-mode configurations. Tells the scoring runtime to stop scheduling additional games. The threshold has been reached; remaining scheduled games are skipped.

In race-mode (first to N), both chips are sent together: "home wins on games" + "stop scheduling." In threshold-mode without race (play all 18, decide at end), neither chip is sent during play — only the "all games complete" Trigger fires at the end.

### Two match-end scenarios

Whether Win Calc EXPECTS a "we won chip" depends on the league's configuration:

**Scenario A: Chip-expected (race-mode or threshold-during-play modes)**
- Win Calc is configured to expect a "we won chip" from the Threshold Trigger.
- If the chip arrives during play → hand off to end-cascade immediately, match ends.
- If the chip doesn't arrive and the game count is exhausted → **the absence of the chip means the match tied** (both teams hit their tie-threshold simultaneously without either reaching the win-threshold). Fire the tie protocol → Tiebreak System chain → edge → end-cascade.
- Example: BCA 3v3 with threshold 10, match ends 9-9. No chip received. Tied. Tiebreak fires.

**Scenario B: Cascade-determined (all-games-mandatory mode)**
- Win Calc is NOT configured to expect a chip — the match always plays its full game count.
- When the "all games complete" Trigger fires, Win Calc runs the **cascade walker**: ordered metric comparisons, first differing metric decides, all equal → tie protocol.
- The cascade order is league-configured: `[games_won, points_earned, edge]` for games-first leagues; `[points_earned, games_won, edge]` for points-first leagues.
- Example: 18-game match ends 10-8 on games, points 45-50. Cascade is `[games_won, points_earned, edge]`. Walker sees games differ → home wins on games. Points difference irrelevant.

Both scenarios converge on the same possible outcomes (decisive winner OR tie) via different mechanisms.

### The cascade decision is conceptually separable

The cascade walker (the pure function that walks an ordered metric stack and returns a `WinnerDecision`) is **conceptually its own concern**, distinct from Win Calc's signal-receiving and end-cascade-running responsibilities. It's a simple filter: preset order, walk through, decide.

Whether the cascade is a sub-component of Win Calc OR its own Module in the catalog is a **bookkeeping decision deferred to the implementation phase.** Both shapes are defensible:
- **Sub-component:** the walker is small (~40 lines); doesn't need its own Module wrapper; Win Calc owns it as an internal mechanism.
- **Own Module:** the cascade decision is architecturally distinct (input: metric stack + match data; output: WinnerDecision); could compose alongside Win Calc the way Tiebreak System composes alongside it.

The Unit 1 Phase A walker (`src/systems/win-calculators/walker.ts`) IS this cascade. It's already built. Whether it gets promoted to its own Module later doesn't change its current shape or behavior.

### End-cascade — Win Calc's actual main job

After winner is determined (either via chip or via cascade), **Win Calc runs the end-cascade**:

1. **Post-decision point awards** — some leagues award bonus points to the winner when the win is confirmed (e.g., "match win = +5 to standings points"). Distinct from per-game point accumulation.
2. **Two-party confirmation flow** — both teams' scorekeepers must confirm the final result before the match is marked complete. The match is in a "pending confirmation" state during this.
3. **Rewind / undo handling** — if a scorekeeper backs out of confirmation (or edits an earlier game), Win Calc must rewind: undo any awarded post-decision points, re-fire the Trigger evaluation, possibly land on a different winner.
4. **Final recording** — after both confirm, write the final result + all relevant fields to the match row. Match is complete.

The end-cascade is **product behavior, not just data math.** It involves UI state transitions, optimistic UI / pending states, real-time sync between two scorekeepers, and graceful rollback on disagreement.

### Achievement Triggers are a different KIND of Trigger

Triggers as a System (per PRINCIPLES) come in two architectural flavors discovered in this session:

- **Match-end signaling Triggers** (Threshold Trigger, "all games complete" Trigger) — fire AT match-end, signal Win Calc, may carry pre-computed winner.
- **Mid-match state-modifying Triggers** (achievement Triggers — break-and-run, golden break, etc.) — fire DURING play, modify the running score, do NOT signal match-end.

Same Trigger architectural pattern (event → action). Different "action" semantics. Future Trigger design must consider both flavors — designing only for match-end signaling would leave the achievement pattern broken when it ships.

## What this changes about the locked Win Calc blueprint

The locked blueprint (`docs/league-system/modules/win-calculator.md`) needs THREE blueprint expansions when next unlocked:

1. **Trigger-protocol section** — describes Win Calc as signal-driven, names the "we won chip" + "end game now chip" inputs from Threshold Trigger, describes the "all games complete" Trigger as a separate signal source.
2. **Two-scenario framing** — explicitly documents chip-expected vs cascade-determined scenarios. Currently the blueprint reads as if all matches use the cascade walker; in reality most matches use the chip path.
3. **End-cascade section** — documents the post-decision point awards, two-party confirmation flow, rewind/undo behavior, and final recording. These are core Win Calc responsibilities, not adjacent concerns.

Also worth flagging: the **cascade walker** documented in the current blueprint may eventually be promoted to its own Module. Either way, the blueprint should acknowledge it as a distinct concern (input → walker → output) even if it stays as a sub-component.

## What this changes about Threshold Charts / Triggers design

The migration plan currently orders Threshold Charts as Unit 2 (after Win Calc). When Threshold Charts extraction lands, the **Threshold Trigger system must be designed with the following responsibilities from day one**:

- Configurable metric to watch (`games_won`, `points_earned`, future metrics)
- Two-chip emission protocol (winner chip + end-game-now chip)
- Race-mode vs threshold-mode distinction (whether to emit the end-game-now chip)
- Generic enough to accommodate both match-end signaling AND mid-match modifying flavors

If Threshold Trigger is built as a passive value-lookup (the natural first instinct) instead of an active signal-emitter with these responsibilities, the Win Calc integration breaks and we'd have to rework it. **Do not build Threshold Trigger before reading this document.**

## What changes about the migration plan

**Win Calc is wrong-ordered as Unit 1.** Its architectural complexity is among the highest in the catalog (signal coupling, end-cascade with confirmation flow, integration with virtually every other Module). The "smallest preference field" sizing was based on current code, not architecture.

**Recommended re-ordering:**
- **Unit 1 (real shakedown):** Team Geometry OR Match Format. Both are passive configuration bundles. Zero behavior, zero trigger coupling, zero cascade work. Genuinely simple extractions that validate the strangler-fig pattern without exposing architectural complexity.
- **Win Calc extraction:** deferred to a much later Unit — should land AFTER Threshold Charts + Threshold Trigger are extracted (so the chip protocol is in place) AND after the locked Win Calc blueprint is expanded (so the trigger protocol + end-cascade are documented).

**Unit 1 Phase A + B artifacts** (committed in `7915bcf` + `ff01b68`): the WinCalculator interface, walker, factory, and SystemModule field are sound infrastructure. They're not wasted; they're scaffolding for whenever the real Win Calc extraction lands. But they should be flagged in the migration plan as "deferred infrastructure, not Unit 1 complete." Phase C (consumer swap) does NOT proceed.

## What's deferred

- **Cascade-walker as its own Module vs sub-component of Win Calc** — bookkeeping question; both shapes are defensible; pick at implementation time.
- **Achievement-Trigger design details** — different action semantics from match-end signaling; needs its own design pass when the achievement system is being implemented.
- **Two-party confirmation flow's UI state model** — real product behavior (optimistic UI, pending states, real-time sync, rollback on disagreement); deserves its own brainstorm when that UI work is scheduled.
- **Cascade order as LO-configurable** — for now leagues are either "games first" or "points first" with a fixed order; future work could let LOs configure arbitrary cascade orders, similar to how Tiebreak System lets them configure the chain.

## Origin

Captured from a verbal session on 2026-05-18 between Ed and Claude, during the Unit 1 Phase C attempt. The Phase C extraction revealed the consumer behavior is richer than the locked Win Calc blueprint anticipated; Ed walked through the deeper architectural shape (signal-driven Win Calc, Threshold Trigger as generic metric-watcher with two-chip protocol, two match-end scenarios, end-cascade responsibilities, achievement-Trigger flavor distinction). Phase A + B infrastructure committed in `7915bcf` + `ff01b68`; Phase C halted with no consumer swap; this document captures why and the path forward.
