---
title: Concept Analogies — locked concepts ↔ programming primitives
date: 2026-05-20
status: candidate
locked: false
audience: developer + AI sessions
---

# Concept Analogies

> **Status: candidate for canonization, not yet locked.** This is a companion
> lens to [PRINCIPLES.md](PRINCIPLES.md), not a redefinition. PRINCIPLES is
> authoritative for what each concept IS; this doc adds the familiar programming
> primitive each one corresponds to. If canonized, it goes through the full
> cold-read + locking process.

## Thesis

The modular Scoring System is not an exotic invention. **Every canonical concept
is a domain costume over a fundamental programming primitive.** Naming them in
pool-league terms makes the docs readable to operators, but underneath, each is
a primitive any developer already knows. That correspondence is *why* the design
holds together — it converges on proven fundamentals rather than inventing new
ones.

## The map

| Locked concept | Programming primitive | Why |
|---|---|---|
| **Module** | single-responsibility component | one bounded responsibility, no more |
| **System** | composite (component made of components) | composes sub-Modules in a pattern |
| **Mechanism (atom)** | pure single-purpose unit / leaf | one job, no internal Modules |
| **Threshold** | state setter | computes a value, writes it to state, once, unconditionally |
| **Trigger** | if/then statement | condition → action that changes state |
| **State bag** | shared state / store | the one namespace every primitive reads + writes |
| **Re-armer** | once-vs-loop control | single-shot / periodic / manual reset |
| **Per-game allocator** | a reducer step | accumulate per iteration (per game) |
| **Operation registry** | strategy / registry pattern | name → swappable implementation |
| **Converter** | adapter | bridges one Module's output type to another's input |
| **Display metadata** | view-model | presentation contract, separate from logic |

**Composition patterns map too:**
- **Selection-pattern System** (pick one alternative) = strategy pattern / discriminated union
- **Chain-pattern System** (stages transform in sequence) = pipeline / middleware chain
- **Parallel-pattern System** (independent branches) = map over a set / independent computations

## Why this is the most useful lens we have

**1. It's a flaw-detector.** Every flaw the cold-read process has found is a spot
where a doc *fused two primitives that should be separate*:
- "Threshold trigger" coupled a state-setter and an if/then — but those are
  independent primitives, connected only through state. The fix was to decouple
  them.
- "Display on the trigger" put a view-model inside logic — presentation isn't
  logic. The fix is to relocate display.

So the lens *predicts* flaws: **wherever the docs fuse two primitives, or put one
primitive's job inside another, that's the bug.** Conditional logic in a state
setter, accumulation in an adapter, a component with two responsibilities — all
the same smell.

**2. It's a north star.** When a design decision is unclear, ask: *what's the
clean primitive here?* and align to it. The threshold/trigger split, the
state-bag decoupling, the EOGA-as-fold realization — all fell out of "match the
primitive."

**3. It makes the system learnable.** Anyone who can write an `if` statement, a
`reduce`, and a component can map the entire domain to things they already know.
The pool-league vocabulary is the only new part; the machinery is familiar.

## How to use it

- **In cold reads:** check each Module/concept against its primitive. Deviation
  (two primitives fused, logic in a setter, presentation in logic, a component
  with two jobs) is the signal of a flaw to surface.
- **In design decisions:** name the primitive first, then design to it. If a
  proposed shape doesn't match a clean primitive, that's a reason to reconsider.
- **In onboarding:** hand a new developer this table — it collapses the learning
  curve from "novel framework" to "primitives I know, renamed."

## Relationship to PRINCIPLES

PRINCIPLES.md defines the concepts authoritatively (Module vs System, atom vs
set, the composition patterns, the I/O contracts). This doc does NOT restate or
override those definitions — it adds one column: the programming primitive each
maps to. Read PRINCIPLES for *what a thing is and how it composes*; read this for
*the familiar primitive it corresponds to and the flaw-detecting lens that
follows.*
