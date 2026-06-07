---
title: Per-Game Allocator Room — Documentation inventory
status: living
audience: developer + AI sessions + tech writer
locked: false
---

# Per-Game Allocator Room — Documentation inventory

> **Living checklist.** Every concept, control, dropdown, and choice in the per-game allocator workshop room that needs LO-facing documentation. Drives Phases 3–5 of the doc work (InfoButton stubs → glossary entries → worked examples). Update as the UI grows or new available-data names land.

## Legend

- **Depth tooltip** = short InfoButton hover (≤ 2 sentences). Lives inline with the control.
- **Depth glossary** = full entry in `src/glossary/entries/scoring.tsx` (or a new workshop file). Linked from the tooltip's "Learn more."
- **Depth example** = full tutorial walkthrough. Lives in `docs/league-system/workshop/examples/` (folder to be created).
- **Status:**
  - `not-started` — nothing written yet
  - `stub` — shortDef exists; longDef is "TODO"
  - `done` — full content present

## High-level concepts (architecture entries)

| Concept | Depth | Status | Notes |
|---|---|---|---|
| Scoring System Workshop (the building) | glossary | not-started | The umbrella concept. Brief intro to "rooms" + modules-as-data. |
| Per-Game Allocator (the module) | glossary + example | not-started | What this room builds. Links to the canonical CSI taxonomy. |
| Variation (saved row) | glossary | not-started | "Your saved version of a per-game allocator." |
| Template / Official | glossary | not-started | Read-only seeded variations; clone-to-edit pattern. |
| Library (Yours) | tooltip | not-started | Inline help on the "Yours" header. |
| Building / Rooms framing | glossary | not-started | One paragraph; references the foundational brainstorm. |

## Editor — top-level controls

| Control | Depth | Status | Notes |
|---|---|---|---|
| Name field | tooltip | not-started | "Shows up in your library and the league picker." |
| Description field | tooltip | not-started | "Optional. A short note about what this variation does." |
| Save button | tooltip | not-started | "Runs the save-time guard and persists if it passes." |
| Cancel button | tooltip | not-started | "Discards in-flight edits." |
| Save-time guard | glossary | not-started | What it checks; why it can refuse. |

## SideEditor — overall structure

| Control / Concept | Depth | Status | Notes |
|---|---|---|---|
| Winner side / Loser side (heading) | tooltip | not-started | "Per-game role, not home/away team." Big idea — link to glossary. |
| Side-agnostic / role-based design | glossary | not-started | Why winner/loser, not home/away. Critical concept. |
| Base section header | tooltip | not-started | "The starting value for this side." |
| Formula section header | tooltip | not-started | "Optional transformation on top of the base." |

## Base section

| Control | Depth | Status | Notes |
|---|---|---|---|
| Base — general | glossary | not-started | Both shapes (fixed vs range); what "base" means under the runtime. |
| Shape dropdown | tooltip | not-started | "Choose how this side's base is set." |
| Fixed number — option | tooltip | not-started | "A constant value every game." |
| Scorer types a number — option | tooltip | not-started | "The scorer enters a value each game (within the range)." |
| Value (when fixed) | tooltip | not-started | "The constant number for this side." |
| Min / Max (when range) | tooltip | not-started | "Lowest and highest values the scorer can enter." |
| Scorer prompt (when range) | tooltip | not-started | "Question or label shown to the scorer." |
| Scorer input (concept) | glossary | not-started | When it applies, how it's clamped, what happens on missing input. |

## Formula section

| Control / Concept | Depth | Status | Notes |
|---|---|---|---|
| Formula — general | glossary + example | not-started | What it does, why it's optional, how it interacts with base. |
| Add a formula button | tooltip | not-started | "Adds a formula on top of the base." |
| Remove formula button | tooltip | not-started | "The side reverts to using just the base." |
| Cursor | glossary | not-started | What the blinking block means; insert/move/arrow-keys. |
| Token (pill) | glossary | not-started | The four kinds (var, const, op, paren); click-to-remove. |
| Token strip | tooltip | not-started | "Your formula as a sequence of clickable tokens." |
| Add available data dropdown | tooltip | not-started | "Pick a value to insert at the cursor." |
| Available data (concept) | glossary | not-started | The three categories (per-game / locked / cumulative). |
| Add a number — input | tooltip | not-started | "Type a number and click Add to insert a literal." |
| Operator buttons (+ − × ÷) | tooltip | not-started | "Arithmetic. Left-associative; use parens to group." |
| Paren buttons ( ( ) ) | tooltip | not-started | "Force grouping. e.g. `(a + b) × c`." |
| Backspace button | tooltip | not-started | "Removes the token to the left of the cursor." |
| Clear button | tooltip | not-started | "Empties the formula." |
| Operator precedence (or lack thereof) | glossary | not-started | "Left-associative; use parens. e.g. a + b × c parses as (a + b) × c." |

## Available data — entries (each needs description + glossary)

These already have inline descriptions in `availableData.ts`. The work here is upgrading them to glossary entries with worked examples.

### Per-game role values

| Entry | Depth | Status | Notes |
|---|---|---|---|
| Winner / Loser base | glossary | not-started | Same concept as Base above; how the virtual resolves. |
| Winner / Loser handicap | glossary | not-started | Locked from match_lineups; per-position lookup. |

### Match-locked values

| Entry | Depth | Status | Notes |
|---|---|---|---|
| Winner / Loser team handicap | glossary | not-started | Sum + team bonus on home. |
| Win target | glossary | not-started | Composition-dependent. List which write it. |
| Tie target | glossary | not-started | Points 3-Man only today. |
| Milestone target | glossary | not-started | Percent 5-Man only today. |
| Total games in match | tooltip | not-started | "Full game count for this match (e.g., 25 in 5v5)." |

### Match-cumulative running totals

| Entry | Depth | Status | Notes |
|---|---|---|---|
| Winner / Loser team games | glossary | not-started | When updated (before allocator runs). |
| Winner / Loser team points | glossary | not-started | When updated (after allocator runs). |
| Winner / Loser player games | glossary | not-started | Per-position; what happens if positions are missing. |
| Winner / Loser player points | glossary | not-started | Per-position; same caveat. |
| Games played | tooltip | not-started | "How many games are finished in this match." |

## Save-time guard / Apply-time preview

| Concept | Depth | Status | Notes |
|---|---|---|---|
| Save-time guard | glossary | not-started | Validator + 5-game dry-run; what it catches; why it refuses. |
| Apply-time preview (league settings) | glossary | not-started | Runs against the league's prepackaged composition; warnings vs blocks. |
| Composition / Prepackaged scoring system | glossary | not-started | The four prepackaged ones; their slots. |

## League settings — picker

| Control | Depth | Status | Notes |
|---|---|---|---|
| AllocatorPicker dropdown | tooltip | not-started | "Pick a variation to use for this league." |
| Use prepackaged default option | tooltip | not-started | "Falls back to the composition's allocator slot." |
| Apply button | tooltip | not-started | "Persists the pick to the league's preferences." |
| Preview clean / Preview warnings | tooltip | not-started | The three states (green / yellow / red). |

## Runtime / architecture concepts (referenced by tooltips)

| Concept | Depth | Status | Notes |
|---|---|---|---|
| State bag | glossary | not-started | The shared namespace; how virtuals map to it. |
| Snapshot / Match-start freeze | glossary | not-started | R9 historical replay stability. |
| Runtime backstop | glossary | not-started | The fourth guard layer; what it catches. |
| Threshold (briefly) | glossary | not-started | One paragraph; full def belongs to the future threshold room. |
| Trigger (briefly) | glossary | not-started | Same. |
| Modules-as-data | glossary | not-started | The killer principle. Short version here; full version is the foundational brainstorm. |

## Worked examples (Phase 5)

Goal: cover the patterns LOs are most likely to want, top-to-bottom.

| Example | Status | Notes |
|---|---|---|
| Build 11-Point from scratch (clone 10-Point, change one number) | not-started | The simplest case; introduces the workflow end-to-end. |
| 17-Point — both forms side by side | not-started | base+formula vs single-formula; pin the two-templates teaching moment. |
| Behind-boost (handicap-aware) | not-started | Use `state_diff_times_constant`-style logic in a click-built formula. |
| Underdog winner bonus | not-started | `other_side_handicap - this_side_handicap` pattern. |
| Per-player penalty (multi-game) | not-started | Uses `this_side_player_wins` so consecutive wins by one player tick down. |
| Custom milestone via expression | not-started | Hand-built equivalent of Percent 5-Man's jumps using `winTarget` / `milestoneTarget`. |

## Process notes

- When a glossary entry is added, change the row's Status to `stub` (with shortDef) then `done` (with longDef).
- When a worked example is added, link it from the related glossary entry's `examples:` field (if the glossary entry shape supports it; otherwise inline).
- New available-data names added later get a row added here AND a glossary entry created in the same PR — don't add picker entries that reference glossary entries that don't exist yet.
