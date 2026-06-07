---
title: Scoring System Workshop — The Building
status: foundational-framing
created: 2026-06-04
supersedes_prior_today: |
  Earlier today this branch produced a brainstorm + plan that jumped to feature
  design for a per-game allocator workshop before locking the foundational
  framing of WHAT the workshop is. Those docs are kept on the branch for
  history but they are NOT the current direction. THIS document is the
  foundation; any future plan must be built from this framing first.
---

# Scoring System Workshop — The Building

This document captures the FRAMING for the workshop. It does not decide UI, schema, code locations, or implementation details. It locks the picture so every later decision is made by bending code to this picture, not the other way around.

## The foundation

The Scoring System is the main component of the app. It is made up of smaller components. Each smaller component does one specific job — single responsibility, isolated, testable on its own, replaceable.

Think of each smaller component like a `useEffect` in a React component, or an `if/then` block in a function. It declares what it reads. It does its job when its event fires. It produces an output. It does not reach outside the inputs it declared.

The main component has one slot of each module type. Only one per-game-points component can live in the per-game-points slot. Only one set of if-then triggers can live in the trigger slot. And so on for every module type the Scoring System recognizes.

## The building, and its work rooms

We need a workshop. Think of it as a specialized version of VS Code — the same idea as the dev environment we already use, which yells the moment something doesn't compile. The workshop is a BUILDING dedicated to authoring Scoring System components.

Inside the building are specialized **work rooms**. One room per module type:

- A work room for **useEffect-shaped** components (per-game point allocators).
- A work room for **if/then-shaped** components (triggers — milestone bonuses, win signals, end-of-match calcs).
- A work room for threshold-shaped components.
- A work room for win-calculator-shaped components.
- A work room for handicap-mechanism-shaped components.
- One room per module type in the Scoring System's catalog.

Each work room:

- **Knows the contract** for its specific module type — what shape the component has to fit, what it is allowed to read, what it must produce.
- **Lets a user build as many variations as they want.** Hundreds if they want.
- **Saves variations as DATA**, as rows in the database — not as code files. The runtime that scores matches is code; the variations the runtime executes are data.
- **Guarantees anything that leaves the room will fit the slot.** If the room saved it, the main component can trust it without checking again.

The building itself is the assembly surface. You walk room to room. You pick one variation from each. The building checks the whole composition is coherent. Your scoring system is the sum of those picks.

## How variations live and get picked

A variation is one row in a table. It has an id. It has an owner. The user picks one by id (or rather, by name in the UI; the id is the plumbing). The main component takes the id, looks up the variation, drops it into its slot, runs it. Plug and play.

The main component does not care which variation it received. It just runs whatever was handed in. The room is responsible for ensuring "whatever was handed in" is safe to run.

A user sees their own saved variations plus a set of read-only official ones. Official ones can be cloned as starting templates, then edited and saved under a new name.

## The two non-negotiables

The whole point of letting users author variations is that the variations might be imperfect. Numbers could come out weird. Triggers might fire at the wrong time. Math might do something unexpected. That is OK — the variation can be reworked afterwards, and the user who built it owns that mess.

But two things must NEVER fail, no matter what variation is loaded:

1. **The lineup page and the scoring page must render.** Always.
2. **Each game's winner and loser must be recorded** at the moment the game finishes. No second chances on this. The W/L history is the sacred metric.

A divide-by-zero, a NaN, an unexpected throw inside a variation must stay **trapped inside that variation**. It can spoil the variation's output. It can NOT reach out and stop a game from being recorded, take down the scoring page, or break anything outside its own slot.

Everything else — points totals, threshold values, milestone jumps, end-of-match calcs, standings, prize splits — is derived from the W/L history and the variation's output. If it comes out wrong, it can be recomputed later after someone fixes the variation. The W/L count is what gets us a second chance on everything else.

## How we build the building

**Room by room.** Not the whole building first.

If we design the building first, every decision about contracts, storage, save/pick/swap, validation gets made on guesses, before any single room is real. High risk of inventing abstractions for needs we only assume exist.

If we build one good room end to end, we discover the joints by feel. We learn the storage pattern. We learn the authoring UI pattern. We learn the save/pick/swap flow. We learn what the workshop has to validate to honor the two non-negotiables. Every later room reuses what the first room taught us. The building itself becomes a shell that ties already-working rooms together, designed AFTER we know what its rooms actually need.

**Tentative first room: the per-game point allocator room.** Reasons:

- It is the smallest module in the catalog. Two sides — winner and loser. Three shapes per side — a fixed number, a range the scorer fills in each game, or a small formula.
- The runtime that executes per-game allocators already exists in code. Building this room means inventing the WORKSHOP pattern, not the runtime.
- The patterns set by this room — how variations are stored, how they are authored, how they are picked, how the workshop guarantees what it ships — become the precedent every later room copies.

This first pick is tentative pending Ed's confirmation. If a different room is a better starting place, the same principle applies: pick one, build it well, set patterns, then expand.

## What this document does NOT decide

Locked out of scope here, on purpose:

- The per-game allocator room's exact UI screens.
- The exact storage shape (one table vs many, JSONB vs flat columns).
- Where in the existing code the swap happens.
- Whether the existing prepackaged scoring systems become seeded "official" variations or stay as code in some form.
- Authorship visibility rules and access controls.
- The exact way the workshop validates before saving and before picking.

Those belong to the next step — a plan for the first room. The plan reads the existing code WITH THIS FRAMING IN HAND, asks "where does the code need to bend so this framing lives?" and writes implementation units that bend it. The framing is not negotiable in that plan; the code is.

## Build order under this framing

1. **Build the per-game point allocator work room** end to end. Set the patterns: how variations are stored, how the editor surfaces dials, how the workshop validates before save, how a saved variation gets picked and dropped into the runtime's slot, how the runtime stays uncrashable around it. Ship.
2. **Build the next room.** Reuse the patterns. Discover what's room-specific vs what's truly general; refactor as needed.
3. **Build a third room.** By now the building's joints are obvious.
4. **Build the assembly shell** — the main building surface that lets a user walk room to room, pick variations, and assemble a full Scoring System.

After step 4 the architecture is whole: every module of the Scoring System is data the user can author, the workshop is the guardrail that guarantees what the runtime executes, the runtime stays trust-only.
