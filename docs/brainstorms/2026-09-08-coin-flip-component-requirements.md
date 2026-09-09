---
title: Coin Flip — reusable component
date: 2026-09-08
status: ready-for-planning
audience: developer + AI sessions
scope: lightweight
---

# Coin Flip — reusable component

## Problem

Two parties need a 50/50 decision and the app has no way to produce one. The
immediate uses are deciding who breaks first and settling a tie, but the
decision itself is the same act every time: two sides, one call, one winner.

Today that decision happens off-app — a physical coin, a lag, or an argument.
Nothing records it and nothing makes it feel settled.

## What this is

A **module in the codebase sense**: one job, no knowledge of its callers, usable
anywhere. Two participants in, a winner out.

The component does not know what it is deciding. It does not know whether the
participants are players or teams. It does not know who is watching or on how
many devices. It flips a coin and reports who won.

## Requirements

- **R1.** Accepts exactly two participants, each `{ id, name }`. A player and a
  team are the same shape, so the component serves both without branching.
- **R2.** One side calls heads or tails. The call is captured **before** the
  result exists — a call made after the coin lands decides nothing.
- **R3.** Produces a single winner. A coin flip cannot tie.
- **R4.** Reports the result to the caller through a callback. The component
  itself writes nothing and persists nothing.
- **R5.** Runs standalone. Dropped on a page with two names, it works — no
  match, no league, no context required.
- **R6.** Accepts externally supplied state so a caller can drive it, including
  supplying the result rather than generating it. Unused in v1; this is the seam
  that lets a caller add cross-device sync or a non-client random source later
  without the component changing.
- **R7.** Announces the outcome by name — "Ed wins the flip" — not by face
  alone. The face is trivia; the winner is the answer.
- **R8.** The result is legible without relying on color to carry meaning.

## Design shape

Three layers, each independently useful and independently testable:

| Layer | Responsibility | Knows about React |
|---|---|---|
| Flip logic | Given two participants and a call, produce a winner | No |
| Component | Render the call, the coin, the result | Yes |
| Controlled state (optional) | Let a caller drive the flip from outside | Yes |

The split exists so the logic can be tested without a DOM, and so a future
caller that needs the flip resolved somewhere other than the local device can
reuse everything above it.

## Key decisions

- **Participants are generic.** `{ id, name }` covers players and teams. The
  component never asks which it has.
- **The component owns no data.** No table, no migration, no write. Callers that
  need a record of the outcome persist it themselves in whatever shape their
  own feature needs.
- **Uncontrolled by default, controllable when needed.** The standalone case is
  the common one and should require no ceremony. R6 keeps the harder cases
  possible without paying for them now.
- **The call precedes the flip.** Enforced by the component's own state machine,
  not by caller discipline.
- **Animation is part of the point, and stays cheap.** A coin that visibly
  travels makes the result feel decided rather than asserted. CSS only — no
  animation library.

## Scope boundaries

Not in this work:

- Persisting flip results anywhere
- Cross-device synchronization or realtime
- Timeout or no-response handling
- Wiring into break assignment, the Pairings Generator, or the Tiebreak System
- Any preference or league configuration
- Any schema change

### Deferred to separate tasks

- **Break-first assignment.** Break/rack is set at lineup lock by
  `src/systems/pairings/stages/breakRackAssignment.ts`, alternating per round,
  and written across every game row by the `prep_match` RPC. Choosing the phase
  of that alternation by coin flip is a Pairings Generator concern —
  `docs/league-system/modules/pairings-generator.md:133` already lists
  `coin-flip-then-alternating` as a future break/rack variant. Separate work.
- **Tie resolution.** `docs/league-system/modules/tiebreak-system/coin-flip.md`
  (locked) specifies `coin_flip` as an atomic Tiebreak Mechanism producing an
  edge metric for Win Calculator. That path is blocked behind Win Calculator's
  metric precedence stack, which is captured direction, not built code.
- **Tamper resistance.** Scoring is trustworthy because the room witnessed the
  game and `game_confirmations` records every vouch. A coin flip has no
  witnesses — the app is the event, not a record of it. A caller that needs the
  outcome to be beyond one device's influence supplies the result through R6
  rather than letting the component generate it. Whether any caller needs that
  is a question for those callers, not for this component.

## Success criteria

- The component can be dropped on any page with two names and produce a winner.
- The flip logic is covered by tests that never touch a DOM.
- A second caller can adopt it without editing it.
- Nothing in the component references matches, leagues, games, or teams by name.

## Open questions

None blocking. The integration questions that came up during this brainstorm —
where the flip fires, what happens when the other side does not answer, whether
a flip can be re-run — all belong to the callers, and none of them constrain the
component's shape.
