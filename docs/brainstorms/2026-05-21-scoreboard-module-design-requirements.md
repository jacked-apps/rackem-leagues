---
title: Scoreboard Module Design — ROUGH DRAFT
date: 2026-05-21
status: ROUGH DRAFT (Ed's idea, capturing the start — to flesh out)
audience: developer + AI sessions
---

# Scoreboard Module Design — ROUGH DRAFT

> **Status: ROUGH.** This is the *start* of Ed's scoreboard idea, written early on
> purpose — to stress-test the [naming layer](2026-05-21-lo-primitive-naming-layer-requirements.md)
> by sketching its hardest consumer. Lots of open questions; flesh out later.
> This is the **scoreboard-display** sense of "display" (player-facing, runtime) —
> NOT the workshop-identity naming, and NOT part of the scoring engine.

## The idea (Ed, 2026-05-21)

- The scoreboard is built with **slots** on each side — **home** and **away**.
- Each slot is filled by a **scoreboard module**. A module **reads the state bag**
  (by state-var name), and **renders the value(s) with a label** in a position on
  screen.
- A position can hold **up to 2 states**. Rough layout shape:
  **3 small / 2 large / 3 small** per side (~**8 selectable metrics**).
- The **LO customizes** which metrics show and which don't.

So: the scoreboard is a *reader* of the state bag (never a re-computer) — whatever
the scoring engine wrote (points, wins, targets, chips, signals) is available to
surface, and the LO picks what to show + where.

## How it touches the naming layer (the "naming crashes" to watch)

A scoreboard module is itself a **created thing**, so it carries the trio
(`internal name` / `displayName` / `description`) like any primitive. It ALSO does
something new: it **emits labels** (the player-facing text). That's where naming
collides — flagged here so the naming doc stays precise:

1. **`displayName` (workshop) vs `label` (scoreboard) on the SAME value.** A
   threshold the LO named "Win line" (workshop display name) might want the
   scoreboard label "Win at:" — *different strings, same underlying state*. The
   module's label must be its own field, NOT auto-reused from the display name
   (default-to-it maybe, but overridable). **Crash #1.**
2. **A module reads state by INTERNAL name, but the LO picks it by DISPLAY name.**
   In the workshop, the LO chooses "show *Win line*" (display name); the module
   stores the *internal* name (`homeWinTarget`) to read at runtime. So the
   module-builder needs the display→internal mapping. **Crash #2** (and: if a
   referenced state var is later deleted/renamed, the module's reference dangles —
   needs the same stable-internal-name rule the naming doc locks).
3. **Mirrored values + the two sides.** A module on the home slot reads
   `homeWinTarget`; the away slot reads `awayWinTarget`. If the LO authored the
   threshold as one mirrored entry, the scoreboard still needs to resolve the
   correct sided internal name per slot. **Crash #3** (the workshop-mirror-only /
   runtime-independent split has to hold here too).
4. **`shared` values on a two-sided board.** A `shared` value (one var, e.g.
   `winTarget` in Percentage 5-Man) shown on both home and away slots renders the
   same number twice — is that desired, or shown once/centered? **Crash #4.**

These four are the reason to draft this now: they tell us exactly which naming
concepts must stay distinct (display name ≠ label; internal name = the stable
reference; side resolution at render time).

## Open questions (it's rough — these need Ed)

- **Slot/position model:** is "3 small / 2 large / 3 small" fixed, or a few
  templates the LO chooses? Are slots per-side only, or is there a shared/center region?
- **2 states per position:** what does "2 states in one position" look like —
  stacked? value + sub-value (e.g. points with a target underneath)?
- **The ~8 metrics:** which 8 by default? (likely points, games-won, win target,
  tie/lower edge, milestone target, start points, edge/clinch, …) — a curated
  default set vs the full state bag.
- **Where labels live:** authored on the module per-slot, or a label travels with
  the state var? (interacts with Crash #1.)
- **Module ↔ state mapping:** does a module read ONE state var, or can one module
  show a small cluster (value + its target)?
- **Customization tiers:** pick-from-curated-list (simple) vs free layout editor
  (power) — probably start curated.
- **Display metadata:** format hints (integer / 1-decimal / percent), role hints
  (this is a total vs a target vs a chip) — needed for sensible rendering.

## Scope boundaries

- This is the **scoreboard-display** module design. It **uses** the naming layer
  (modules carry the trio) and the `label` concept defined there; it does NOT
  redefine naming.
- Deferred — build the engine + (later) the workshop first. Both display senses
  are future modules outside the scoring engine.
- Builds on the "scoreboard reads state vars, never recomputes" idea already noted
  in `memory-bank/futureFeatures.md` ("Modular / Customizable Scoreboard").

## References

- `docs/brainstorms/2026-05-21-lo-primitive-naming-layer-requirements.md` — the naming layer (defines `label`, the trio, mirror/side)
- `docs/league-system/modules/points-system/trigger.md` — the state bag the scoreboard reads
