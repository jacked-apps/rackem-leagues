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
- League operators choosing a Scoring System (separate future docs surface, in the wizard)
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

"Mechanism," "System," "Variant," "Chart," and "Converter" are not separate things from Modules — they describe **what kind of Module** something is, or **what role** it plays:

- **Mechanism** — a Module that performs a single functional task (an *atom*). (`extra_games`, a threshold computation, a trigger.)
- **System** — a Module that is a composition of other Modules (a *set*), with rules for how they fit together. (The Scoring System; the Handicap System; the Points System.) **When you need a word for "a set of Modules," the word is _System_.**
- **Variant** — a Module serving as one of several (currently) mutually-exclusive options within a parent Module. (Points is a Variant within the Handicap System.)
- **Chart / Formula** — a Module used as a *tool* by another Module to do a computation. A chart is discrete; a formula is continuous; they are interconvertible.
- **Converter** — a Module whose entire job is bridging two mismatched type contracts so two otherwise-incompatible Modules can compose. (Example: a `Points → Fargo equivalent` Converter would let a Fargo-calibrated Threshold Chart consume a Points handicap. Committed roadmap; currently zero implementations — required for the modular system to deliver on its orthogonality promise.)

So "Module" is the noun; these are its kinds/roles. **Mechanism** and **System** are the two reached for most — *atom* vs. *set*. **Converter** is the kind that makes Module orthogonality real wherever types don't naturally line up — without Converters, "any A pairs with any B" claims are overstated. See the Module — Deep Dive section below for the full treatment, and the per-kind deep-dives that follow it.

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

## Module — Deep Dive

*Module is the load-bearing primitive of this whole architecture. Every other concept (Mechanism, System, Variant, Chart, Converter) is a kind of Module. This section codifies Module rigorously — Essence, Boundary, design space, contracts, and the rules for how Modules compose. Every per-kind deep-dive that follows builds on the definitions here. If anything in this section is wrong, everything downstream of it is wrong.*

### 1. Why a modular system exists

Every pool league is set up differently. Different handicap methods, different scoring rules, different lineup sizes, different tiebreaker conventions, different relationships with national bodies (BCAPL, APA, USAPL, regional). There is no universal "pool league" we can hardcode against — the variation is the *product reality*, not noise.

Trying to support that variation with hardcoded variants is unsustainable: every new league type becomes a code change, and the product can never catch up. **Modularity is the answer**: bounded units (Modules) with strict borders and an LO-configurable design space inside each. A new league type becomes a new *configuration*, not a new code path. The payoff: serve a much wider variety of leagues; LOs gain meaningful control over how their league runs without needing dev work for every variation.

**Honest framing.** Modularity does NOT mean all combinations are equally good. Most LO customizations away from the prepackaged tested combinations will be *worse* — less fair, less competitive, less mathematically sensible. The product strategy is:

1. Ship the prepackaged tested Scoring Systems as the recommended path.
2. Let LOs fiddle, adjust, customize, personalize within Module borders if they insist.
3. Some will produce broken leagues. Some might produce something better than what we shipped (FargoRate itself emerged from someone tinkering on the side).
4. The product gives LOs the *capability*; the LOs choose how to use it. They pay either way.

**The hidden cost that makes this work.** Borders MUST be hard. Without strict Module borders, modularity collapses into one-big-blob "settings" no one understands. With strict borders, each Module is comprehensible in isolation, combinations are predictable, and broken combinations are diagnosable. Strict borders are the *price of admission* for the modular promise to function — not a limitation of it.

### 2. Essence

**A Module is a bounded unit of league-system behavior with a clear external contract and a defined design space inside its borders.**

That sentence carries the architecture. Three things to notice:

- **Bounded** — there is a definite *outside* and a definite *inside*. The outside knows the Module's contract (what flows in, what flows out, what it's responsible for). The inside is implementation; the outside doesn't see it.
- **Clear external contract** — the Module promises: "given input of type X, I will produce output of type Y, and I am responsible for Z." That promise is the boundary. Anything that depends on the Module depends on the contract, not the implementation.
- **Defined design space inside its borders** — within the Module's responsibility, there's room for variants, parameters, sub-Modules, and growth. The borders constrain *what* the Module is responsible for, not *how richly* it can fulfill that responsibility.

Module is a CONCEPT we apply to organize the system, not a physical thing in the code. A Module might manifest in code as a folder, a class, an interface, multiple files, or even a single function — the manifestation doesn't define it; the bounded responsibility + contract does.

### 3. The two load-bearing properties (strict borders + room to grow)

Module has two properties that sound simple individually but are load-bearing only when held *together*:

**Strict borders.** The Module's responsibility is precisely defined. Anything that doesn't fit inside that responsibility is OUT — full stop. No fudging, no "well, kinda also." When something doesn't fit, it forces the question: is this a parameter? a new variant? a new Module? (See [Section 5: Tweak classification](#5-tweak-classification-parameter-variant-or-new-module).) The strictness is what makes the *type contract* trustworthy and what keeps two unrelated essences from drifting into the same Module.

**Room to grow.** Within the strictly-bounded responsibility, the design space is *intentionally open*. New variants can be added. Parameters can be exposed. Sub-mechanisms can compose. The Module can become as powerful as it needs to be inside its borders without changing what those borders are.

**Why both together:**
- Strict-only suffocates. Without room to grow, a Module becomes a frozen artifact. Every new league requirement forces a new Module, the system fragments, anti-conflation work becomes useless because everything is its own special case.
- Flexible-only dissolves. Without strict borders, "flexibility" means everything-can-do-everything, which means nothing has a meaningful contract. Two unrelated essences drift into the same Module. Anti-conflation work collapses.
- **Both together = the design pattern that allows growth without losing structure.** Every Module decision tests against both: does this preserve the borders AND keep the design space open?

This is the operational restatement of *"Fix conflation, not constriction"* — the borders fix conflation; the open interior prevents constriction.

### 4. Boundary: what is NOT a Module

Not everything in the league system is a Module. Things that look Module-ish but aren't:

- **Data is not a Module.** A handicap value (485), a game record (winner/loser/balls-pocketed), a points total (143) — these are data. Modules *consume* data, *produce* data, *transform* data. Data has a type but no responsibility. (See [Section 8: I/O contracts](#8-io-contracts-at-module-boundaries).)
- **A single code file is not necessarily a Module.** A file might implement part of a Module, an entire Module, or multiple Modules. The file system is one possible *manifestation* of Modules; it is not the test for "what is a Module."
- **A function is not (automatically) a Module.** Same shape, *context* determines. A function might implement part of a Module, an entire Module, or be unrelated to the modular system altogether. A function that fits inside this system AND serves a place in the chain *also* earns the title Module — and with it the Module-level requirements (typed external contract, bordered responsibility, design-space documentation). Outside the system → just a function. Inside and serving → both function (in code) and Module (in the architecture). The bounded responsibility + contract is what promotes a function into a Module, not the function itself.
- **A UI element is not a Module.** A wizard step, a button, a form field — these are UI projections of Module choices. A wizard step that lets the LO pick a Handicap System is *driven by* the Handicap System Module; it is not itself a Module.
- **A database column is not a Module.** `points_calculator` is a column. The Points System Module *uses* that column to persist its variant choice; the Module isn't the column.
- **An event is not a Module.** "Game completed," "match scored" — these are events, which are *a kind of data* (timed, labeled, often carrying a payload). Modules *respond to* events or *produce* events. Events flow through the system between Modules, just like other data.
- **A configuration value or parameter is not a Module.** `winner_points = 10` is a parameter inside a Module's variant. The parameter is data the Module reads; it isn't itself a Module.
- **A brand name is not a Module.** "BCAPL," "FargoRate," "APA" — these are brand names. They may appear *inside* a Module (e.g., FargoRate is the source-of-record name for a Handicap Systems variant), but the brand isn't the Module.

The pattern: a Module is a bounded unit of *responsibility*. Data, code structure, UI elements, brand names — those are expressions of, inputs to, or implementation details inside a Module. Not Modules themselves.

### 5. Tweak classification: parameter, variant, or new Module?

When an LO (or anyone) wants to "tweak" Module X, the tweak falls into one of three categories. **Test in this order — the first match wins.**

**Layer 1 — Parameter / setting.** Same mechanic (the way the Module's work gets done), different number/range/selection. The mechanic is unchanged; only a value moves.

| Example tweak | Why it's a parameter |
|---|---|
| 10-Point Scoring with `winner_points = 12` instead of 10 | Mechanic (winner gets fixed amount, loser gets balls-pocketed) is unchanged; only the number moves |
| Race length 7 instead of 5 | Mechanic (race-to-N) unchanged; N is the parameter |
| Roster cap 8 instead of 6 | Mechanic (cap on roster size) unchanged; cap value is the parameter |
| Pick a different threshold chart | Mechanic (look-up-the-target) unchanged; the chart is the selectable parameter |

Implementation: the variant exposes configurable parameters; the LO adjusts in the wizard. **No new code; no new variant; no new Module.**

**Layer 2 — New variant within the existing Module.** The *shape* of the mechanic changes, but the essence still belongs to the same Module.

| Example tweak | Why it's a new variant |
|---|---|
| 17-Point Scoring (winner gets `10 + opponent_remaining`, formula instead of integer) | Mechanic shape changes (formula vs integer), but essence (per-game point allocation) is still Points System |
| A new "single-elimination per match" pairing rule | Mechanic shape changes, but essence (pairing format) is still Match Format |
| A new handicap encoding (e.g., USAPL Skill Levels) | Mechanic shape changes (different range, different math), but essence (encode player strength) is still Handicap Systems |

Implementation: new variant page + new code path inside the same Module. Existing variants are untouched. **No new Module.**

**Layer 3 — New Module.** A new *kind of concern* no existing Module covers.

| Example tweak | Why it's a new Module |
|---|---|
| Between-match handicap-adjustment (loser of last match gets break choice this match) | New concern: rules that read prior-match outcomes to affect next-match conditions. No existing Module is responsible for between-match state |
| Time-per-shot enforcement | New concern: in-match timing constraints. Nothing existing covers this |
| Sponsorship payout calculation | New concern: financial outcome derivation. Out-of-scope for any current Module |

Implementation: new Module folder, new design-space mapping, new wizard surface (when LO-customization UI lands).

**The walkthrough in `README.md#how-to-classify-a-new-idea` only handles Layer 3 (new Module).** Most day-to-day LO tweaks are Layer 1 or 2; both deserve the same anti-conflation rigor.

**Module-design implication.** A Module's *internal* design determines how often LOs hit Layer 2 vs Layer 1. A Module designed for *composable sub-mechanisms* (Points System, with its per-game allocator + threshold trigger + initial points + end-of-match aggregate) pushes more tweaks into the parameter/composition layer (Layer 1), fewer into new-variant territory (Layer 2). A Module designed for *mutually-exclusive variants* (Handicap Mechanisms with extra_games / start_points / race_length_adjustment) pushes more tweaks toward new variants. Neither is wrong — the design choice should match the Module's expected variation pattern.

### 6. Drift / split detection

Modules can drift over time. Two essences quietly creep into the same Module; what started as one bounded responsibility becomes a bag holding two. The smell is detectable; catching it early is the difference between a clean split and months of accumulated conflation.

**The "AND" smell test.** If explaining what a Module does requires the word *AND* between two unrelated essences, the AND is the boundary you missed.

Worked example (the one we just did, May 2026):
- Old "Scoring Systems" Module description: *"It allocates per-game points AND decides who won the match."*
- The AND is the smell. Per-game point allocation (a *production* responsibility) and match-victory determination (a *decision* responsibility) are different essences. They share a domain (scoring) but not a responsibility.
- Resolution: split into two Modules. The AND becomes a *boundary* — Points System on one side, Win Calculator on the other.

**Other drift signals:**
- The Module's *name* no longer accurately describes everything inside it. (You find yourself adding parenthetical clarifiers: "Scoring Systems (which also includes win-condition logic).")
- Two variants of the Module have non-overlapping I/O contracts. (One produces points, another produces a winner — different output types means different essences.)
- Cross-Module references blur — the Module is being cited from contexts that don't share its essence.
- Variant pages start defining things that should live in a different Module's territory.

**When you spot drift:**
1. Name both essences explicitly.
2. Decide if both belong in the system (sometimes one is just a misclassification — see [Section 5](#5-tweak-classification-parameter-variant-or-new-module)).
3. If both belong, plan a split — a new sibling Module for the second essence, with the first Module narrowed to its single essence.
4. Update cross-references; verify no inline definitions cross the new boundary.

A split is policy-gated under Principle 7 (canonical-docs-as-policy) — naming a new Module or splitting an existing one requires explicit invocation + confirmation.

### 7. The recursive property

Modules nest inside Modules. A System-kind Module composes other Modules. A Mechanism-kind Module may have sub-Mechanisms. The Scoring System (top-level Module) composes the 8 component Modules; the Handicap Systems Module contains 4 variants (each a Module); each variant may have parameter sub-structures.

**This is why we need a universal noun.** Without "Module" as the umbrella term, every level of nesting would force a new word: "the Mechanism that contains a Mechanism inside the System inside the Scoring System..." The recursive structure becomes unparseable. With "Module," every node in the tree is a Module — only the *kind* (Mechanism / System / Variant / Chart / Converter) varies by node.

**Two practical consequences:**

- **The Module-page pattern applies at every level.** Whether documenting the top-level Scoring System, a component Module like Handicap Systems, or a leaf variant like FargoRate, the page structure is the same: Essence / Boundary / Design space / How-it-interacts. (See [Section 11: Module-page pattern](#11-the-module-page-pattern).) Recursion means the same template, scoped to the level.
- **The contract pattern applies at every level.** A System Module has an external contract (input → output for the whole composition) AND it composes internal Modules each with their own contracts. The composition is valid only if internal contracts chain correctly. (See [Section 8: I/O contracts](#8-io-contracts-at-module-boundaries).) Recursion means contracts at every level.

### 8. I/O contracts at Module boundaries

Every Module declares a typed input and a typed output. This is the Module's external contract — its promise to anything that uses it. Modules compose by chaining contracts: Module A's output type becomes Module B's input type; if the types don't line up, they don't compose without a Converter.

**Think of the system as an assembly line.** Each Module is a station with a specific function — it accepts a piece of data, adds something to it (or transforms it), and passes the result down the line. The fully-configured Scoring System is the end product the line assembles. Type contracts are the connection points between stations: if station N's output type doesn't match station N+1's input type, the line breaks — unless you insert a Converter station to bridge the gap. Adding a new feature usually means designing a new station that fits cleanly into an existing connection point, not redesigning the line.

**The Module is "stupid"; the variant is smart.** The Module's contract is a pure type signature: input type → output type. *How* the data arrives (DB query, external API call, in-memory lookup, LO inline entry) is internal-to-the-variant, not part of the Module's external promise. This separation matters: it lets the contract be checked statically without knowing implementation, and it lets variants be swapped without breaking downstream consumers.

Three architectural layers:

- **Module-category contract** — pure type signature: input type, output type.
- **Variant** — the implementation that fulfills the contract; carries the smarts about HOW.
- **League configuration** — one level UP: picks which variant the league uses; not part of the Module's I/O contract at all.

**Worked example — Handicap Systems contract:**

- **Input:** a person identifier.
- **Output:** a handicap value (typed per the active variant — integer for Points, integer for FargoRate, percentage for Percentage, etc.).
- The Points variant internally queries match records to compute the handicap. The FargoRate variant internally calls the FargoRate API. The LO-override variant pulls a stored value. All three satisfy the same `(person) → handicap` contract.

**Variant-specific output shapes (one category, multiple shapes).** A Module's output may have multiple specific shapes depending on which variant is active. Example — Handicap Mechanism's output is a "benchmark declaration," but the actual fields differ:

- `extra_games` outputs `{ games_target_a, games_target_b }`
- `start_points` outputs `{ start_points_a, start_points_b }`
- `race_length_adjustment` outputs per-pairing race lengths

All three are *the same category* (benchmark declaration), but their fields differ. The Module's contract isn't "outputs a fixed shape" (false — it varies) or "outputs anything" (too loose — defeats the contract). The honest contract is **"outputs one of these named shapes, with a tag identifying which."** In code this is expressed as a discriminated union (`ExtraGamesThreshold | StartPointsThreshold | RaceLengthThreshold` in `src/systems/types.ts`); in docs, name it in plain language as a *category with variant-specific shapes*.

**When two Modules' types don't match: insert a Converter.** A Converter is a Module whose entire job is bridging mismatched type contracts (see [Section 10: Kinds of Module](#10-kinds-of-module--pointer)). Example: a Threshold Chart calibrated to FargoRate inputs cannot directly accept a Points handicap. Without a Converter, those two Modules cannot compose. With one — `(Points) → Fargo equivalent` — the Chart can consume the converted value.

**Honest framing on Converters.** They are *calibrated translations*, not unit conversions. Numerically scaling Points (-2 to +2) into Fargo's 0–850 range is trivial math but produces a *meaningless* value unless the calibration is empirically grounded against actual play data. Converters cannot perfectly equalize handicap systems — Fargo is the most accurate; everything else is approximation. Converters get LOs as close as the math allows while being honest about the approximation cost. Many LO-driven Converter combinations will produce *worse* matches than the prepackaged tested ones; the Converter exists so the LO has the choice, not so every choice is good.

**Implication for orthogonality claims.** When the docs say "any Handicap System pairs with any Threshold Chart," that statement is *only true if a Converter exists for the type mismatch*. Variant pages should be honest: "this chart takes Fargo numbers; pairing with Points needs a Points→Fargo Converter (none exists yet)."

### 9. Naming rule: plural vs singular

Module names (folders, page titles, prose references) follow a real distinction:

**Plural** when the variants are distinct concrete options that coexist and an LO picks one. The plural reflects the *coexistence* of the variants as named alternatives.

- *Handicap Systems* (Points, Percentage, FargoRate, Skill Level — distinct encodings, LO picks one)
- *Handicap Mechanisms* (extra_games, start_points, race_length_adjustment — distinct mechanisms, LO picks one)
- *Threshold Charts* (3v3-games-needed, 5v5-games-needed, fargo-formula — distinct charts, LO picks one)

**Singular** when the Module is one *act* with parameter variation — variants are modes/configurations of a single thing rather than independent siblings.

- *Win Calculator* (deciding the winner is one act; `win_condition` parameterizes it)
- *Points System* (per-game point allocation is one act; the calculator + params parameterize it; the variants — 1-Point, 10-Point, 17-Point — are configurations of the same allocator)
- *Match Format* (configuring per-pairing structure is one act; pairing format + race length parameterize it)

**Test for naming a new Module.** If removing or adding a variant feels like it would change *what the Module is*, the variants are coexistent → plural. If removing or adding a variant is just changing *the configuration of the same act*, → singular.

**Edge case (Win Calculator).** Today Win Calculator is primitive (a binary `win_condition`). The future picture (axis selection + termination semantics + tie resolution + cross-axis conditions + per-game evaluation cadence) hints that Win Calculator might *grow into* a composition of sub-Modules. Even so, the wrapping concept is one act ("decide the winner") — singular fits. If the future composition produces multiple distinct decision-rule mechanisms that LOs pick between, a rename to plural would be on the table.

**The rule admits friction.** For some Modules both readings genuinely defend — Win Calculator can be argued plural ("each setup is its own win calculator") OR singular ("one wrapping concept that declares a winner"). When both readings work, **prefer the framing that names the wrapping concept's essence as a single act over the framing that names the coexistence of alternatives.** That framing usually wins because the Module's identity is its *act*, not its *variant inventory*. A Module that one day has 3 variants and the next day has 7 hasn't changed *what it is*; whether the variants are 3 or 7 is interior detail.

### 10. Kinds of Module — pointer

Five kinds are recognized today. Each gets its own deep-dive section after this one (deep-dives pending — Module first, then Mechanism / System / Variant / Chart / Converter).

| Kind | One-liner essence | Example |
|---|---|---|
| **Mechanism** | Atomic Module — does one specific thing | `extra_games`, `start_points`, a threshold computation |
| **System** | Set Module — composes other Modules into a configured whole | Handicap System, Scoring System (top-level), Points System |
| **Variant** | Role within a parent Module — one of several mutually-exclusive options | FargoRate (variant of Handicap Systems), 10-Point (variant of Points System) |
| **Chart** | Tool Module — data-shaped lookup or formula consumed by another Module | 3v3-games-needed chart, FargoRate formula chart |
| **Converter** | Adapter Module — translates one type into another so two otherwise-incompatible Modules can compose | Points→Fargo (committed roadmap; currently zero implementations — Converter capability is required for the modular system to deliver on its orthogonality promise) |

The two reached for most are Mechanism and System — the *atom vs set* distinction. Variant is a *role* description (a Module that happens to be one option within a parent). Chart is *data-shaped* (a lookup table or formula another Module consumes). Converter is the *adapter* that makes orthogonality real where types don't naturally line up.

### 11. The Module-page pattern

Every Module's documentation page MUST contain the following elements. This is the universal shape — whether the Module is a System, Mechanism, Variant, Chart, or Converter. The full Module README template at *Concrete rules / templates → Module README template* below is one specific expression of these required elements; variant pages are another (with `Reading this cold?` callouts added). The required elements are universal; the section structure adapts to the Module's place in the hierarchy.

**Required elements (every Module page):**

1. **Essence** — what the Module IS in 1–2 sentences. The bounded responsibility, stated cleanly.
2. **Boundary** — what is NOT in this Module. Adjacent Modules with bare cross-links. The anti-conflation classifier.
3. **Design space** — within the bounded responsibility, what variation is possible. Variants index for parent Modules; parameters/sub-mechanisms for atomic Modules.
4. **How it interacts (typed I/O)** — typed input contract, typed output contract, upstream/downstream Module references. The I/O declaration is mandatory; without it the Module cannot be composed against.
5. **Implementation-vs-intent flag** — where current code state diverges from the architectural intent stated in this Module's design space, the divergence is *flagged* (not silently fixed in the doc). The flag uses the phrase *"implementation artifact, not architectural intent"* and links to the source-of-truth code anchors.

**Why each element is required:**

- **Essence** orients cold readers in one sentence.
- **Boundary** prevents conflation drift.
- **Design space** shows what's variable (and implies what's fixed).
- **How it interacts (typed I/O)** is the contract that lets composition be verified mechanically — without it the Module is unusable to anything downstream.
- **Implementation-vs-intent flag** preserves the doc's role as architectural commitment rather than code-state snapshot.

### 12. Cross-Module enforcement

Module borders are enforced through three rules:

**Rule 1 — Cross-Module references are bare links, no inline definitions.** When you reference another Module from inside a Module page, the reference is a link, period. Do not paraphrase or define the other Module's content inline. The click between pages IS the boundary teaching moment. Inlining a definition dissolves the boundary the doc exists to enforce.

**Rule 2 — Intra-Module references may have brief inline glosses.** Variants within the same Module can be glossed inline ("Points handicap, the -2 to +2 integer system") because no boundary is crossed. The rule against inlining applies *across* boundaries, not within.

**Rule 3 — Type contracts are enforced at every boundary.** A Module that consumes another Module's output MUST consume the declared output type. If two Modules' types don't naturally line up, insert a Converter — don't let the receiving Module silently accept a type it isn't contracted for. (See [Section 8: I/O contracts](#8-io-contracts-at-module-boundaries).)

These three rules together preserve the borders. Without them, the modular system collapses back into the one-big-blob it exists to escape.

## Concrete rules / templates

### Module README template (8–9 sections)

1. **Essence** — what this category IS, in 1-2 sentences
2. **Why X exists** — the operational WHY (provides framing for novice-extraction)
3. **Boundary** — what's NOT in this Module; adjacent Modules; anti-conflation classifier
4. **Architectural intent** — orthogonality, composability with other Modules; flag known code couplings as artifacts
5. **Variants index** — peers, possibly sub-grouped if a load-bearing dimension exists
6. **How this Module interacts** — upstream, internal partners, downstream. **MUST declare typed input contract and typed output contract** (per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries)).
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
- To prepackaged Scoring Systems: `[Points 3-Man](../../scoring-systems/points-3man.md)` (top-level `scoring-systems/` folder, not under `modules/`)
- To external sources: full URLs with descriptive link text

## Phrases worth remembering

- *"Fix conflation, not constriction."* — Ed, 2026-05-13. Borders crisp, design space open.
- *"The click is the Module boundary teaching moment."* — anti-conflation rule for cross-Module references; do not inline definitions.
- *"Implementation artifact, not architectural intent."* — how to flag code couplings that violate Module orthogonality without rewriting code state inaccurately.
- *"Reading this cold?"* — the self-bootstrapping callout convention on every variant page.
- *"Variants are peers — no canonical, no default."*
- *"Charts and formulas are interconvertible expressions of the same mapping."*
- *"The system is an assembly line of Modules. Each station adds a piece to the end product."* — Ed, 2026-05-15. The Module-chain framing for I/O contracts.
- *"A Module's identity is its act, not its variant inventory."* — the singular-vs-plural test from Module § 9.

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
