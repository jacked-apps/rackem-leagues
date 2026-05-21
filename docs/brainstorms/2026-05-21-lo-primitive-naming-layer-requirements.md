---
title: LO Primitive Naming & Identity Layer — Requirements
date: 2026-05-21
status: design (NOT locked canon — forward-looking, for the future LO workshop)
audience: developer + AI sessions
---

# LO Primitive Naming & Identity Layer

> **Status:** design / requirements for a *future* feature (the LO workshop). NOT
> locked canon. The scoring engine works without it (devs name code-defined
> compositions by hand); this layer is what lets *non-coder LOs* build scoring
> systems in the workshop. Build the engine's data shapes ready for it (so no
> second refactor), but the workshop itself is deferred ("make it work first").

## The problem

The whole modular Scoring System exists so **non-coder League Operators build
their own scoring systems in a workshop UI.** But the primitives create and
reference **state by internal name** (`homeWinTarget`, `home_points`, `edge`),
and those names carry developer rules — uniqueness, no typos, naming conventions,
stable references. An LO is a pool expert, not a programmer; they must never have
to author an internal name.

So the identity of every created thing splits into a small set of **distinct
concepts**. They all sound alike ("name", "display", "label") and *will* be
conflated unless we lock the definitions. This doc locks them.

## The four concepts (the glossary — lock these)

| Concept | Who sees it / when | Who sets it | Example |
|---|---|---|---|
| **Internal name** | the engine (machine), runtime | **auto-assigned**, stable + unique | `homeWinTarget` |
| **Display name** (a.k.a. external name) | the **LO**, in the **workshop** (build time) | LO | "Win line" |
| **Description** | the **LO**, in the **workshop** (build time) | LO | "games to win — also awards the +3 and the match win" |
| **Label** | the **player**, on the **scoreboard** (runtime) | LO (on a scoreboard module) | "Win at: 10" |

The two that bite are **display name** (workshop "which thing is this?") vs
**label** (scoreboard "what is this number called on screen?"). Both are human
text, but **different audience and different moment**, and often different strings
(the workshop name can be long + explanatory; the scoreboard label is short).
Keeping them separate is the entire point of this doc.

## Internal names are auto-assigned (never LO-authored)

- The engine assigns the internal name when the LO creates a thing. The LO never
  types it.
- **Stable + unique.** Sequential per scoring system, sided where applicable
  (e.g. `homeThreshold1` / `awayThreshold1`).
- **Never renumbered.** Once assigned, an internal name is fixed for the life of
  the thing. Deleting a sibling does **not** re-sequence the others (gaps are
  fine) — otherwise a trigger that references a name by string would break.
- Since the LO only ever sees the *display* name, the internal name only needs to
  be unique + stable; readability is just a dev-debug nicety.

## Two levels

The naming layer applies at two levels:
- **The created scoring system** — the whole thing the LO builds carries an
  internal name + display name + description.
- **Each primitive inside it** — every threshold, trigger, and created state var
  carries the same trio.

(It also applies to **scoreboard modules**, which are created things too — see the
scoreboard design doc. They carry the trio *and* additionally emit **labels**.)

## Side / mirror modes

Most thresholds and triggers relate to the two teams, but **not all the same
way.** A created thing's "side" is one of three modes, and the mode is driven by
**what the thing computes from** — not a blanket default:

- **`shared`** — ONE value, both sides read the same var. The thing reads a
  league-wide input (a pref / constant). *Example: Percentage 5-Man's `winTarget`
  and `milestoneTarget` — a single var both sides' triggers compare against.* One
  internal state.
- **`team` (mirrored)** — same *logic*, but each side computes its **own** value
  because it reads a **per-side** input (that side's handicap diff). *Example:
  Points 3-Man's `homeWinTarget` / `awayWinTarget` (different numbers).* The LO
  authors **one** entry with a **side-agnostic** name (`"win line"`, not
  `"home win line"`) + side-agnostic description; the engine generates the two
  sided internal names. Two internal states.
- **`unlinked` (asymmetric)** — rare, deliberate home-advantage; two fully
  independent entries the LO edits separately.

The mode is **inferable from the operation the LO picks** (a league-constant
source → `shared`; a per-side handicap source → `team`). "Mirror" is "per-side
because the input is per-side," not a universal default.

### "Mirror" is a workshop word — at runtime there is NO connection

This is load-bearing: a mirrored pair (`homeWinTarget` / `awayWinTarget`) are
**two fully independent thresholds at runtime.** Neither references or knows about
the other; deleting one wouldn't affect the other. The "twin" relationship exists
**only in the workshop UI** — it stamps both from one entry and keeps them in sync
while the LO edits; "unlink" just stops the syncing. That convenience never
reaches the engine. This is the modularity principle in action: independence is
what keeps composition stable.

### Don't conflate team-side with game-role

There are **two different two-sided axes** — keep them apart:
- **Team side: `home` / `away`** (+ `shared`) — for thresholds and triggers. This
  is the mirror axis above.
- **Game role: `winner` / `loser`** — the **per-game allocator's** own structure
  (winner gets X, loser gets Y, mapped to whichever team won *that game*). NOT a
  team mirror — a separate axis. The allocator keeps its own winner/loser; the
  naming layer does not touch it.
- **per-player / per-position** — a real future axis (5-man positions, player
  stats). Out of scope for now (YAGNI).

## Data shape that falls out

Every named thing (scoring system, primitive, scoreboard module) carries:

- `name` — auto, internal, stable
- `displayName` — LO string
- `description` — LO string
- `side` / mirror mode — `shared` | `team` | `unlinked` (where applicable)

Scoreboard modules additionally carry the **labels** they render (player-facing).

Building these fields into the data shapes now keeps them UI-ready so the workshop
needs no second refactor — even though the workshop itself is deferred.

## Scope boundaries

- **This doc owns:** the naming/identity glossary + the auto-assign rule + the
  side/mirror modes. Applies to all created things.
- **NOT in this doc:** the scoreboard's *layout* design (slots, positions,
  metrics) — that's its own doc, which only *uses* the naming layer + the `label`
  concept defined here.
- **"Display" has two senses, both future modules, both outside the engine:**
  *workshop-identity* (this doc's display name/description) vs *scoreboard*
  (the player-facing render — its own doc). They must never merge.

## Open questions (for when the workshop is built)

- Exactly how the workshop infers `shared` vs `team` from the chosen operation
  (auto-detect vs explicit LO toggle with a sensible default).
- Whether `displayName` is required or defaults to a humanized internal name.
- Label authoring: does a scoreboard module's label default to the underlying
  thing's `displayName`, or is it always independently authored?
- Uniqueness scope of display names (per system? globally? not enforced?).

## References

- `docs/league-system/PRINCIPLES.md` — anti-conflation (§2), the state bag / Composability
- `docs/league-system/modules/points-system/trigger.md` — triggers read/write state by name; the DISPLAY section (label/target/status) eventually relocates here
- `docs/league-system/concept-analogies.md` — Display = view-model (separate from logic)
- `docs/brainstorms/2026-05-21-scoreboard-module-design-requirements.md` — the scoreboard (uses this layer + the `label` concept)
