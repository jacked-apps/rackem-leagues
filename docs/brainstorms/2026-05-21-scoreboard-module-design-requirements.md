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

- The scoreboard is built **ONCE, as a single side-agnostic unit, then mirrored**
  to both sides. The LO designs "Wins / Points / Win at:" one time; the renderer
  instantiates it on the **home** side (pulling `home_*` values) and the **away**
  side (pulling `away_*` values). Same template, side-specific values.
- **The two sides are ALWAYS identical** (same metrics, same positions) — if one
  side showed something the other didn't, it'd be confusing. This is a hard rule.
- **Labels are side-agnostic** — just "Wins," never "Home Wins." The home/away
  identity is **positional** (the side headers are always on screen, left/right),
  so one label serves both sides at once.
- Each side's **slot reads the state bag** (by that side's state-var name) and
  **renders the value with the shared label** in a position. A position can hold
  **up to 2 states**; rough layout **3 small / 2 large / 3 small** per side
  (~**8 selectable metrics**). The LO customizes which show / hide.
- **A slot renders either a single value or a pair.** Render modes: **single**
  ("Wins: 5"), or **paired/tracked** — two states shown together as a fraction /
  progress ("3/10"), each state keeping its own internal name under one slot
  label. The pair capability is general (not just the global region): a *sided*
  slot can show a per-side pair (`home_wins`/`homeWinTarget` → "3/10" home,
  "2/8" away).
- **Side-consistency within a slot:** a sided slot's pair should be **two per-side
  states** (so it mirrors cleanly); a **global pair** (`gamesPlayed`/`totalGames`
  → "5/25") lives in the separate global region, not a sided slot. *Open Q:* may a
  sided slot mix a per-side + a global state (e.g. `home_wins`/`totalGames`)? It
  renders (numerator mirrors, denominator shared) but puts a global value on the
  sided board — judgment call, decide later.
- **The sided scoreboard is PURELY per-side (mirrored) metrics.** Match-level /
  global values (e.g. games played 5/25) are **not on it** — they're a separate
  concern. If a global readout is ever wanted (a baseball-inning-style indicator),
  it's a **separate region outside** the sided scoreboard, never squeezed into the
  mirrored sides.

So: the scoreboard is a *reader* of the state bag (never a re-computer) — whatever
the scoring engine wrote per side (points, wins, targets, chips, signals) is
available to surface, authored once and mirrored. Same mirror pattern as
thresholds: author once side-agnostic → two sided instances at render.

## Never-break: the scoreboard cannot crash the app

The never-break rule extends here. The scoreboard must **never crash** — at worst
it shows a wrong number. The asymmetry: wrong numbers → "this thing is acting
strange" (a complaint we fix; customer kept); a crash → "this app is shit, use
something else" (brand-killer; customer lost). Two safeguards:
1. **Reader, never recomputer** — the scoreboard only reads state the engine
   already wrote, so a display bug can show garbage on screen but **cannot corrupt
   the recorded game data.**
2. **Crash-wrapped render** — a bad render blanks/mis-shows *that one slot* and
   never takes down the app or the scoring flow.

Clean layering: games recorded (sacred, protected) → engine computes (log+bypass,
never throws) → scoreboard reads + renders (wrong-but-shown, never crashes). A
failure at any layer degrades; it never cascades up to break recording.

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
3. **Mirrored values + the two sides — RESOLVED by the layout model.** Because the
   board is one side-agnostic unit mirrored to both sides, each slot auto-resolves
   to its side's var (home slot → `homeWinTarget`, away → `awayWinTarget`). The LO
   never thinks about it; the singular-unit-mirrored model handles it. (The
   workshop-mirror-only / runtime-independent split still holds.)
4. **`shared`/global values on the board — RESOLVED (not applicable).** The sided
   scoreboard is PURELY per-side metrics; shared/global values (games played 5/25,
   etc.) are not on it — they live in a separate region/concern. So there's no
   "same number shown on both sides" awkwardness to settle.

So crashes #1 and #2 are real **naming-layer mechanics** to keep distinct
(display name ≠ label; internal name = the stable reference). Crashes #3 and #4
are dissolved by the layout rules (singular-unit-mirrored; purely per-side). That
split — surfaced by drafting the scoreboard early — is exactly the payoff.

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
