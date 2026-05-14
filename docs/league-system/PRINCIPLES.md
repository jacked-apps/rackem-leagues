---
title: L1 Docs — Goals & Principles
date: 2026-05-13
status: active
audience: developer + AI sessions writing or editing docs/league-system/
---

# L1 Docs — Goals & Principles

This file is the **meta-policy** for `docs/league-system/`. It exists so future Claude sessions (and Ed, returning to this work after time away) stay aligned on what these docs are FOR and HOW they should be written. **If you are writing or editing anything under `docs/league-system/`, read this file first.**

## What the L1 docs are for

Three jobs:

1. **Anti-conflation classifier.** When a new feature or rule comes up, the doc helps you and the AI both determine which Module it fits in — or recognize that it needs a new Module. Without this, two distinct ideas drift into the same Module, or one idea gets mistaken for two. The single most important load-bearing function.

2. **Pedagogical reference.** Each Module's essence and variants are documented in their simplest form, separated from how they currently happen to be implemented. A fresh Claude (or Ed after a break) reads to understand each piece in its abstract shape.

3. **Future-work enabler.** When LO-customization UI eventually lands, the design space is already mapped. When new variants are built, the boundaries and connections are already documented.

## Audience

The docs are written for:

- **AI sessions** (future Claude) reading cold with no project memory
- **Dev-level humans** like Jack who can read structured prose with technical vocabulary

The docs are NOT written for:

- Pool players (separate future docs surface, in-app)
- League operators choosing a Division (separate future docs surface, in the wizard)
- CSI / Ozzy-level evaluators (separate future docs surface, polished pitch material)

But — and this is load-bearing — **a fresh Claude reading any L1 file should be able to extract a novice-friendly explanation** for a player or operator on demand. The docs themselves can be dense and jargon-laden; the meaning underneath must be recoverable.

## Load-bearing principles

In rough order of importance:

### 1. Crisp borders, open design space

> *"Fix conflation, not constriction."* — Ed, 2026-05-13

Module boundaries are LOAD-BEARING. Don't blur them. Each Module answers a specific question; if a feature doesn't fit, recognize that you may need a new Module rather than forcing it into an existing one.

But — borders being crisp doesn't mean small or restrictive. **Future Possibilities** sections are intentionally open to speculation about what these systems CAN grow into. A speculative item is welcome IF it doesn't blur Module boundaries.

### 2. Anti-conflation is the central purpose

The doc system exists because Ed and AI sessions (including this one) have repeatedly conflated concepts: percentage vs average handicapping; mechanism vs chart; Points handicap vs 1-Point Scoring System; team-level vs per-pairing scope of mechanisms. Every editorial decision should ask: *does this preserve or weaken the boundary between Modules?*

Specific anti-conflation rules:

- **Variant pages describe ONLY intrinsic operations.** They do NOT claim what downstream Modules will do with their output. The variant's "output" (e.g., the team-vs-team difference, or FargoRate's win-expectancy) ends the variant's responsibility; what happens next is somebody else's Module.
- **Cross-Module references are bare links, no inline definitions.** The click between pages IS the boundary teaching moment. Inlining a definition dissolves the boundary the doc exists to enforce.
- **Intra-Module references** (variants within the same Module) MAY have brief inline glosses since no boundary is crossed.

### 3. Self-bootstrapping per file

Every file should be readable by a fresh Claude session with no project memory. Variant pages need a `> Reading this cold?` callout that orients a reader in 2–3 sentences: what category, what variant, what other variants exist.

### 4. Novice extractability

A fresh Claude reading a variant page should be able to derive a novice-friendly explanation suitable for a player or operator. **Concrete analogies preferred over abstract definitions.** Examples worth keeping:

- *"FargoRate is to pool what an ELO rating is to chess."*
- *"Points handicap is a 5-grade skill scale where 0 is league average."*

Convention: a `**Picture this** (for the novice-explanation case): ...` paragraph in each variant page's "What it is" section.

### 5. Variants are peers

No variant is "the default" or "the basis." Each variant page describes itself in its own terms. The Module README's variants index lists peers in a flat or sub-categorized structure (e.g., Internal/External sub-categorization in Handicap Systems is fine — that's a real load-bearing operational distinction). Don't let one variant become the implicit standard others are measured against.

### 6. Implementation vs architectural intent

Current code state is documented as ARTIFACT. Architectural INTENT is the doc's commitment. Where current code violates the architectural intent (e.g., the `bca3v3` SystemModule directly calls a specific threshold chart, or `fargo5v5` bundles start-points math with rating math), the doc:

- Describes the current state accurately
- Flags the bundling/coupling as an **"implementation artifact, not architectural intent"**
- States what the intent should be (orthogonality, composability)
- Notes that future refactors will decouple

This honors the doc's role as an architectural commitment, not just a code-state snapshot.

### 7. Canonical-docs-as-policy

Once written, these docs are POLICY CONTRACTS, not drafts. Consequences:

- **No fuzzy claims.** Verify against authoritative sources (CSI handbook, APA's published material, FargoRate docs, the actual code) before adding factual claims. If you can't verify, hedge ("operator-observed behavior suggests...") or omit. If a user gives you operational lore that you can't verify, capture it in their words but don't assert it as fact.
- **Naming taxonomy changes are policy-gated.** Changing a Module name, variant name, glossary definition, or canonical naming convention requires explicit user invocation ("change X to Y") plus explicit confirmation of the file edit. Either alone is insufficient.
- **Prose quality changes are NOT policy-gated.** Typo fixes, rewording for clarity, examples added inside narrative sections — those are open editing.

### 8. Charts and formulas are interconvertible

A chart is a discretized formula; a formula is a continuous chart. The Threshold Charts Module covers both shapes. **Formulas are generally preferred** for their versatility — continuous coverage, easier LO customization, can generate any specific chart on demand. When documenting threshold-related concerns, use "chart (or formula)" or just "threshold function" — don't lock the language to one shape.

### 9. Mechanisms can apply at team or per-pairing scope

Some Handicap Mechanisms (`extra_games`, `start_points`) operate at the team-aggregate level — the difference between team-sum ratings drives the asymmetry. Others (`race_length_adjustment`) operate at the per-pairing level — each individual head-to-head matchup uses the rating gap between the two paired players. Module-level statements that universally say "team-vs-team" exclude per-pairing mechanisms; use scope-aware language ("two sides," "team-vs-team or player-vs-player").

## The architectural model

*Settled during Unit 4 cold-read review with Ed. This supersedes an earlier "3-layer view" — the model converged through iterative refinement and is now codified.*

### Module — the universal unit

A **Module** is any bounded, well-defined thing with **strict borders** (a clear definition of what it is and isn't) and **room to grow** inside those borders (it can become as powerful and flexible as it needs to be). It is a "cage" placed around a single responsibility.

This is the core unit of the whole architecture, and it directly embodies the project's central principle: **strict borders = anti-conflation; room to grow = not constriction.**

**Modules nest recursively.** A Module can contain other Modules. The composition of a set of Modules — with rules for how they fit together — is itself a Module. `extra_games` is a Module; the "Handicap Mechanisms" Module contains it; the whole **Scoring System** is a Module containing those.

**The Scoring System is the top-level Module** of the rule-structure hierarchy — the complete, configured rule set that scores a match. The component Modules (Handicap System, Handicap Mechanisms, Points System, Win Calculator, Threshold Charts, Team Geometry, Match Format, Standings & Tiebreakers) nest *inside* it. *(The brainstorm cheat sheet's "7 Modules" framing is being revised — see "A Scoring System is the whole thing" below.)*

**Data is not a Module.** A Module has walls around a *responsibility* — it does something, or organizes something. Data has a type but no responsibility. Games, Points, threshold values, player ratings — these are **data that flows between Modules**, not Modules themselves.

### Kinds of Module

"Mechanism," "System," "Variant," and "Chart" are not separate things from Modules — they describe **what kind of Module** something is, or **what role** it plays:

- **Mechanism** — a Module that performs a single functional task (an *atom*). (`extra_games`, a threshold computation, a trigger.)
- **System** — a Module that is a composition of other Modules (a *set*), with rules for how they fit together. (The Scoring System; the Handicap System; the Points System.) **When you need a word for "a set of Modules," the word is _System_.**
- **Variant** — a Module serving as one of several (currently) mutually-exclusive options within a parent Module. (Points is a Variant within the Handicap System.)
- **Chart / Formula** — a Module used as a *tool* by another Module to do a computation. A chart is discrete; a formula is continuous; they are interconvertible.

So "Module" is the noun; these are its kinds/roles. **Mechanism** and **System** are the two reached for most — *atom* vs. *set*.

### How Modules connect: data flows between them

Modules connect by passing **data** — not by passing Modules. The canonical example, the handicap-to-trigger chain:

1. The **Handicap System** (a Module) produces handicap **data** (rating values).
2. A **threshold Mechanism** takes that data in, does its math (using a Chart or Formula as a tool), and produces threshold **data**.
3. A **trigger Mechanism** takes the threshold data in, performs a task, and usually produces **data to be saved**.

The composite — Handicap System + threshold + trigger — is itself a **System** (a Module composed of Modules). Each step is a bounded Module; data is what flows between them.

### The two metrics

Every match tracks exactly two metrics — these are **data**, not Modules:

- **Games** — *primary* data. Each game's winner/loser is recorded directly.
- **Points** — *derived* data. Points do not exist until a Module computes them.

This asymmetry (games recorded, points computed) is structural: there is nothing to "compute" about games without a handicap — you just count the records.

### Mechanism classification

Mechanism-kind Modules classify on two axes:

|  | **Games** | **Points** |
|---|---|---|
| **Handicap-side** *(consumes the handicap)* | threshold + head-start mechanisms, games axis | threshold + head-start mechanisms, points axis |
| **Scoring-side** *(no handicap)* | *(empty — games are recorded, not computed)* | per-game allocators, threshold triggers, end-of-match aggregates |

**Handicap-side mechanisms** further split by *application type*:

- **Threshold mechanism** — applies the handicap-derived value to the **finish line** (`extra_games`, `extra_points`).
- **Head-start mechanism** — applies it to the **starting position** (`start_points`, `games on the wire`). "On the wire" is the domain/gambling synonym.

Each handicap-side mechanism **uses a Chart or Formula** (a tool Module) to do the handicaps→value computation. The chart/formula is the single point where the handicap is consumed directly; everything downstream works with the derived value.

### Win Calculator

The **Win Calculator** is a component Module of its own. It consults the collected metrics (Games + Points) plus any benchmarks the mechanisms declared, and declares the match winner. It does not produce a metric; it decides.

### A Scoring System is the whole thing

A **Scoring System** is the complete, configured rule set that scores a match — a top-level System composing the component Modules. A Scoring System's behavior is built by **explicit composition**: if the "instruction manual" sees N distinct Mechanisms each with its own trigger, it reads the structure directly — no derivation step.

Two terms get retired/relocated here:

- **"Division" is dropped.** It was a CSI-inherited conflation that mixed up *a league* (a recurring competition) with *a scoring configuration* (a rule set) — two fundamentally different kinds of thing sharing one word. What the brainstorm called a "Division" is a **prepackaged Scoring System**. The competition hierarchy is **Organization → League → Season**; a League runs a Scoring System. "Division" appears nowhere.
- **The brainstorm's "Scoring Systems Module"** (one of the original 7) was a mis-categorization — it tried to make "the whole thing" into one sibling part. It splits into two real component Modules: **Points System** (per-game point allocation) and **Win Calculator** (victory determination). The component-Module count goes 7 → 8.

This restructure is **policy-gated** and not yet propagated to the cheat sheet / folders / cross-links — it is mapped and executed as a deliberate, separate step (see task tracker).

### Scope: this branch defines the ideal

Step 1 (this branch) **defines** — boundaries, definitions, categories. Where the current code diverges from the now-clarified definitions, that divergence is *noted, not fixed here*. Step 2+ branches do the code restructure to match. The docs describe the ideal; the code catches up.

## Concrete rules / templates

### Module README template (8–9 sections)

1. **Essence** — what this category IS, in 1-2 sentences
2. **Why X exists** — the operational WHY (provides framing for novice-extraction)
3. **Boundary** — what's NOT in this Module; adjacent Modules; anti-conflation classifier
4. **Architectural intent** — orthogonality, composability with other Modules; flag known code couplings as artifacts
5. **Variants index** — peers, possibly sub-grouped if a load-bearing dimension exists
6. **How this Module interacts** — upstream, internal partners, downstream
7. **(Sometimes)** Cross-cutting concept sections (e.g., Rating Confidence in Handicap Systems)
8. **Future possibilities** — speculative welcome
9. **Source of truth** — code anchors, no line numbers (lines rot)

### Variant page template (8 sections)

1. **Preamble** — classification + `> Reading this cold?` callout
2. **What it is** — short definition + `**Picture this**` novice analogy
3. **How it works / how it's calculated** — mechanics, formulas, key behavior
4. **When you'd use it / pros**
5. **When you wouldn't / cons**
6. **Interactions** — cross-Module references; bare links per anti-conflation rule
7. **Possible modifications** — what an LO could vary within this variant
8. **Current code state** — anchors + step-2 rename targets if applicable; flag implementation-vs-intent issues

### Naming conventions

- **L1 markdown filenames**: lowercase-kebab (`points-3man.md`, `extra-games.md`)
- **Step-2 code identifier renames**: snake_case per repo precedent (`points_3man.ts`)
- **Display names**: per the cheat-sheet table in the top-level README; mirror in `CLAUDE.md` (Unit 11)
- **BCA vs BCAPL** (per CSI *LO Handbook* 2020 p.41): "BCA" alone is incorrect — it refers to the Billiard Congress of America (a standards body), not the league. Use **BCAPL** or **BCA Pool League** for league references; **CSI** (CueSports International) for the operator.

### Source-of-truth section format

`current/code/path.ts` (and optionally a parenthetical note about WHAT it does); for step-2 rename targets: `current/path.ts → step-2 rename target (tentative): new/path.ts`. **No line numbers** — paths are stable across edits, line numbers rot the moment someone reformats.

### Cross-link conventions

- Within same Module: relative paths to peer files (`points.md` → `[Percentage](percentage.md)`)
- To other Modules: relative paths up one level (`[Threshold Charts](../threshold-charts/README.md)`)
- To Divisions: `[Points 3-Man Division](../../divisions/points-3man.md)`
- To external sources: full URLs with descriptive link text

## Phrases worth remembering

- *"Fix conflation, not constriction."* — Ed, 2026-05-13. Borders crisp, design space open.
- *"The click is the Module boundary teaching moment."* — anti-conflation rule for cross-Module references; do not inline definitions.
- *"Implementation artifact, not architectural intent."* — how to flag code couplings that violate Module orthogonality without rewriting code state inaccurately.
- *"Reading this cold?"* — the self-bootstrapping callout convention on every variant page.
- *"Variants are peers — no canonical, no default."*
- *"Charts and formulas are interconvertible expressions of the same mapping."*

## Cold-read process

The process used to review and refine these docs:

1. Author writes a first pass of all files in a Module
2. **Cold-read each file as a fresh Claude session** with no project memory; surface gaps, conflations, missing context
3. Discuss with Ed (operator + project-lead); apply his domain knowledge as constraints
4. Apply fixes; commit
5. Move to the next file or Module

This process is itself a load-bearing principle — it caught real conflations during Unit 2 (e.g., variant pages claiming "feeds the threshold chart that yields per-team target wins" was a 4-Module conflation; per-pairing-vs-team-aggregate scope was missed; APA's actual published facts contradicted assumed claims). Skipping the cold-read in favor of "trust the first pass" would let those errors ship.

## When to update this file

Add a principle when one emerges from a cold-read review session that's not yet captured here. Update a template when a recurring section pattern emerges across multiple files. Add a phrase when Ed (or future contributors) coins a framing worth preserving.

This file is itself a canonical-docs-as-policy artifact. Changes to its load-bearing principles require the same gate as Module/variant naming taxonomy changes (explicit invocation + confirmation). Adding new principles, templates, or phrases is open editing.
