---
title: L1 Docs — Goals & Principles
date: 2026-05-13
status: active
locked: true
audience: developer + AI sessions writing or editing docs/league-system/
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](#7-canonical-docs-as-policy) below. The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

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

### 6. Docs are stand-alone; code references are supplementary

The L1 docs describe the architecture in its own terms. A reader who reads ONLY the doc understands the architecture fully. Code is NOT what the docs describe — the architecture is what the docs describe, and the architecture is the commitment.

Code references, if included at all, are **supplementary illustration** — pointers to one prior shape a concept can take — not load-bearing definitions. The doc never says *"this code defines the concept"*; at most *"this prior code is one shape this concept can take."*

Code references are optional. PRESENCE in one Module page and ABSENCE in another carries no architectural meaning; it's just author's choice about whether an illustrative pointer adds value for that specific concept. *"No code example"* is NOT a signal of *"missing,"* *"incomplete,"* or *"not applicable"* — the architecture is fully described by the doc itself.

**Why this rigor matters:** if principles are formed with the existing code as a guide, the conflations in the code leak into the principles. The 3v3 chart documented as a 3-tuple `(target_win, target_tie, target_lose)` is a real example of this drift — "ties" is a downstream Win Calculator concern that leaked into the upstream Chart contract because the doc was written from the code. Standing-alone-from-code prevents that.

**Future code-aligning work** (Task #23) aligns CODE to docs, not the reverse. The docs are the target; the code catches up.

### 7. Canonical-docs-as-policy

Once written, these docs are POLICY CONTRACTS, not drafts. Some files are formally LOCKED (visible 🔒 banner at the top + `locked: true` frontmatter flag). Edits to LOCKED files must pass the gate procedure below — this principle is the single source for the procedure; the banner on each locked file just points back here.

**The gate procedure for editing a LOCKED file:**

1. **Explicit user invocation using gate-aware language.** The user must use the phrase *"unlock and make the changes"* (or equivalent — must explicitly invoke the "unlock" action). Casual approvals (*"go ahead,"* *"yes,"* *"fine,"* *"approved,"* *"sounds good,"* *"yep"*) are NOT sufficient. The required phrase signals that the user is consciously passing the gate, not casually approving a suggestion.
2. **Cold-read of impact** across all dependent canonical docs. The AI session must verify the proposed change doesn't break consistency with other LOCKED docs.
3. **Confirmation of the specific change** before applying. The AI presents the exact wording; the user approves. (Substantive changes require gate-aware language again; minor wording adjustments within an already-approved change can use briefer confirmation.)

**Other rules:**

- **No fuzzy claims.** Verify against authoritative sources (CSI handbook, APA's published material, FargoRate docs, the actual code) before adding factual claims. If you can't verify, hedge ("operator-observed behavior suggests...") or omit. If a user gives you operational lore that you can't verify, capture it in their words but don't assert it as fact.
- **Naming taxonomy changes are policy-gated** under the procedure above. Changing a Module name, variant name, glossary definition, or canonical naming convention requires the full gate procedure.
- **Prose quality changes are NOT policy-gated.** Typo fixes, rewording for clarity, examples added inside narrative sections — those are open editing. The gate applies only to taxonomy / principle / structural changes.

**Currently LOCKED files:**

- `docs/league-system/PRINCIPLES.md` (this file)
- `docs/league-system/README.md`
- `docs/league-system/modules/handicap-systems/README.md`
- `docs/league-system/modules/handicap-mechanisms/README.md`
- `docs/league-system/modules/points-system/README.md`
- `docs/league-system/modules/win-calculator.md`

Future canonical docs added to the lock pattern should add the short banner pointing back to this principle (no need to repeat the procedure on each file — DRY).

### 8. Charts and formulas are interconvertible

A chart is a discretized formula; a formula is a continuous chart. The Threshold Charts Module covers both shapes. **Formulas are generally preferred** for their versatility — continuous coverage, easier LO customization, can generate any specific chart on demand. When documenting threshold-related concerns, use "chart (or formula)" or just "threshold function" — don't lock the language to one shape.

### 9. Mechanisms can apply at team or per-pairing scope

Some Handicap Mechanisms (`extra_games`, `start_points`) operate at the team-aggregate level — the difference between team-sum ratings drives the asymmetry. Others (`race_length_adjustment`) operate at the per-pairing level — each individual head-to-head matchup uses the rating gap between the two paired players. Module-level statements that universally say "team-vs-team" exclude per-pairing mechanisms; use scope-aware language ("two sides," "team-vs-team or player-vs-player").

### 10. Composability contract — no-break composition

> *"Any module we build connects like puzzle pieces to make a chain and spit out something at least."* — Ed, 2026-05-16

Any combination of Modules an LO can wire together MUST chain to a runnable output. The system never refuses, never errors out, never shrugs at a valid configuration.

This is the runtime teeth on the LO-freedom promise. The full LO-freedom contract has four parts:

- **LO can choose any combination** (freedom; per Module § 1 honest framing)
- **Built-in defaults aim for accuracy** (the prepackaged Scoring Systems are the tested combinations)
- **Any combination chains to output** (this principle) — cross-type mismatches bridged by default Converters (coarse if necessary), the match still runs
- **Untested combinations surface warnings** — *"this may not give expected results"* messaging, but no refusal to run

**Architectural commitment:** "any combination" is a RUNTIME guarantee with quality as the variable, not a configuration claim that may or may not work at runtime.

**Implication for new Modules:** when a new Module is added to the architecture (e.g., a new Handicap System), it must ship with the default Converters needed to bridge from all existing types it can compose with. The architecture rejects new Modules that introduce un-bridgeable type mismatches.

**Implication for runtime behavior:** the architecture does NOT validate that match OUTPUTS are meaningful — the LO is responsible for choosing combinations that produce sensible results. The system is responsible only for never breaking.

## The architectural model

*This section is a brief orientation. The full treatment of each concept lives in its dedicated **deep-dive** section that follows. If you're skimming for navigation, this is enough. If you're committing to architectural decisions, read the deep-dives.*

### Module and its four kinds

A **Module** is any bordered unit of league-system behavior with a typed external contract and a defined design space inside. Every Module is exactly one of four kinds:

- **Mechanism** — atom. Does one functional task; no internal Modules. *The work-doing unit at the leaves of the architecture's tree.* (See [Mechanism — Deep Dive](#mechanism--deep-dive).)
- **System** — set. Composed of other Modules with rules for how they fit together. *The orchestrator that composes Mechanisms (and other Systems) into something larger.* (See [System — Deep Dive](#system--deep-dive).)
- **Chart** — data-shaped. Passive lookup queried by other Modules; can be a discrete table or a continuous formula. *The reference data Mechanisms consume to do their work.* (See [Chart — Deep Dive](#chart--deep-dive).)
- **Converter** — adapter. Bridges two mismatched type contracts so otherwise-incompatible Modules can compose. *The type-bridge that makes "any A pairs with any B" claims real.* (See [Converter — Deep Dive](#converter--deep-dive).)

For the foundational treatment of Module itself (essence, boundary, tweak classification, recursion, I/O contracts, page pattern, and cross-Module enforcement), see [Module — Deep Dive](#module--deep-dive) below.

> **"Variant" is casual shorthand, not a kind.** You'll see "variant" used loosely throughout these docs (e.g., *"the FargoRate variant of Handicap Systems"*) as everyday vocabulary for "a Module the parent offers as one of several alternatives." That's fine — but **Variant is NOT a separate architectural kind**. There are only the four kinds above.

### The two metrics

Every match tracks exactly two metrics — these are **data**, not Modules:

- **Games** — *primary* data. Each game's winner/loser is recorded directly.
- **Points** — *derived* data. Points do not exist until a Module computes them.

This asymmetry (games recorded, points computed) is structural: there is nothing to "compute" about games without a handicap — you just count the records.

### Scoring System as the top-level Module

A **Scoring System** is the complete configured rule set that scores a match — a top-level System composing all 9 component Modules (Handicap Systems, Handicap Mechanisms, Points System, Win Calculator, Threshold Charts, Team Geometry, Match Format, Pairings Generator, Standings & Tiebreakers). The 9 components are the *parts*; the Scoring System is the *whole*. A Scoring System's behavior is built by **explicit composition**: the "instruction manual" reads the structure directly — no derivation step.

> **"Division" is dropped.** The original brainstorm used CSI's term "Division" for the bundled rule set. We dropped it because CSI uses "division" for both *a league* (a recurring competition) and *a scoring configuration* — two fundamentally different things sharing one word. The competition hierarchy is **Organization → League → Season**; a League runs a Scoring System. "Division" appears nowhere.

### Scope: this branch defines the ideal

Step 1 (this branch) **defines** — boundaries, definitions, categories. Where the current code diverges from the now-clarified definitions, that divergence is *noted, not fixed here*. Step 2+ branches do the code restructure to match. The docs describe the ideal; the code catches up.

**Honest reminder.** These principles are *forward-looking*. The existing codebase was written before they existed. **You cannot follow a guideline that hasn't been written yet, and you cannot retroactively judge current code by principles we "intend to enforce going forward" by looking back.** Divergence in existing code is a given — not evidence of carelessness. The audit-and-align work to bring existing code into compliance is its own substantial undertaking and lives in step 2+ branches, not in this doc.

## Module — Deep Dive

*Module is the load-bearing primitive of this whole architecture. Every Module is exactly one of four kinds: Mechanism, System, Chart, or Converter. This section codifies Module rigorously — Essence, Boundary, design space, contracts, and the rules for how Modules compose. Every per-kind deep-dive that follows builds on the definitions here. If anything in this section is wrong, everything downstream of it is wrong.*

### 1. Why a modular system exists

Every pool league is set up differently. Different handicap methods, different scoring rules, different lineup sizes, different tiebreaker conventions, different relationships with national bodies (BCAPL, APA, USAPL, regional). There is no universal "pool league" we can hardcode against — the variation is the *product reality*, not noise.

Trying to support that variation with hardcoded variants is unsustainable: every new league type becomes a code change, and the product can never catch up. **Modularity is the answer**: bounded units (Modules) with strict borders and an LO-configurable design space inside each. A new league type becomes a new *configuration*, not a new code path. The payoff: serve a much wider variety of leagues; LOs gain meaningful control over how their league runs without needing dev work for every variation.

**Honest framing.** Modularity does NOT mean all combinations are equally good. Most LO customizations away from the prepackaged tested combinations will be *worse* — less fair, less competitive, less mathematically sensible. The product strategy is:

1. Ship the prepackaged tested Scoring Systems as the recommended path.
2. Let LOs fiddle, adjust, customize, personalize within Module borders if they insist.
3. Some will produce broken leagues. Some might produce something better than what we shipped (FargoRate itself emerged from someone tinkering on the side).
4. The product gives LOs the *capability*; the LOs choose how to use it. They pay either way.

**The hidden cost that makes this work.** Borders MUST be hard. Without strict Module borders, modularity collapses into one-big-blob "settings" no one understands. With strict borders, each Module is comprehensible in isolation, combinations are predictable, and broken combinations are diagnosable. Strict borders are the *price of admission* for the modular promise to function — not a limitation of it.

**Architectural posture: design as if drag-and-drop; ship wizards.** The mental model for the architecture is a node-graph editor — Modules as puzzle pieces, typed contracts as connector shapes, Converters as adapters that bridge mismatched shapes. We are NOT planning to build that UI (node editors are hard to design well, and most LOs will never want one). The actual delivery is wizards (guided question-and-answer flows) and dials editors. **The drag-and-drop frame is discipline, not a roadmap** — it forces contracts to stay clean and Module borders to stay crisp, because in that frame sloppy contracts immediately break the visual UI. Whether the LO ever sees a node graph (probably never), a wizard (the plan), or a dials editor doesn't matter for the architecture; the *shape* of the system is the same either way.

### 2. Essence

**A Module is a bounded unit of league-system behavior with a clear external contract and a defined design space inside its borders.**

That sentence carries the architecture. Three things to notice:

- **Bounded** — there is a definite *outside* and a definite *inside*. The outside knows the Module's contract (what flows in, what flows out, what it's responsible for). The inside is implementation; the outside doesn't see it.
- **Clear external contract** — the Module promises: "given input of type X, I will produce output of type Y, and I am responsible for Z." That promise is the boundary. Anything that depends on the Module depends on the contract, not the implementation.
- **Defined design space inside its borders** — within the Module's responsibility, there's room for variants, parameters, sub-Modules, and growth. The borders constrain *what* the Module is responsible for, not *how richly* it can fulfill that responsibility.

Module is a CONCEPT we apply to organize the system, not a physical thing in the code. A Module might manifest in code as a folder, a class, an interface, multiple files, or even a single function — the manifestation doesn't define it; the bounded responsibility + contract does.

### 3. The two load-bearing properties (strict borders + room to grow)

Module has two properties that sound simple individually but are load-bearing only when held *together*:

**Strict borders.** The Module's responsibility is precisely defined. Anything that doesn't fit inside that responsibility is OUT — full stop. No fudging, no "well, kinda also." When something doesn't fit, it forces the question: is this a parameter? a new variant? a new Module? (See [Section 5: Tweak classification](#5-tweak-classification-parameter-new-mechanism-or-new-module).) The strictness is what makes the *type contract* trustworthy and what keeps two unrelated essences from drifting into the same Module.

**Room to grow.** Within the strictly-bounded responsibility, the design space is *intentionally open*. New variants can be added. Parameters can be exposed. Sub-mechanisms can compose. The Module can become as powerful as it needs to be inside its borders without changing what those borders are.

**Why both together:**
- Strict-only suffocates. Without room to grow, a Module becomes a frozen artifact. Every new league requirement forces a new Module, the system fragments into hundreds of one-off pieces, and Module borders stop helping (everything is its own special case anyway).
- Flexible-only dissolves. Without strict borders, "flexibility" means everything-can-do-everything, which means nothing has a meaningful contract. Two unrelated ideas end up jammed in one Module, and the borders dissolve.
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

### 5. Tweak classification: parameter, new Mechanism, or new Module?

When an LO (or anyone) wants to "tweak" Module X, the tweak falls into one of three categories. **Test in this order — the first match wins.**

**Layer 1 — Parameter / setting.** Same mechanic (the way the Module's work gets done), different number/range/selection. The mechanic is unchanged; only a value moves.

| Example tweak | Why it's a parameter |
|---|---|
| 10-Point Scoring with `winner_points = 12` instead of 10 | Mechanic (winner gets fixed amount, loser gets balls-pocketed) is unchanged; only the number moves |
| Race length 7 instead of 5 | Mechanic (race-to-N) unchanged; N is the parameter |
| Roster cap 8 instead of 6 | Mechanic (cap on roster size) unchanged; cap value is the parameter |
| Pick a different threshold chart | Mechanic (look-up-the-target) unchanged; the chart is the selectable parameter |

Implementation: the variant exposes configurable parameters; the LO adjusts in the wizard. **No new code; no new variant; no new Module.**

**Layer 2 — New Mechanism within the existing parent Module.** A new alternative implementation that fits inside the same parent Module. Different mechanic shape, but the essence still belongs to the same parent.

| Example tweak | Why it's a new Mechanism in the same parent |
|---|---|
| 17-Point Scoring (winner gets `10 + opponent_remaining`, formula instead of integer) | Different mechanic shape (formula vs integer), but it's still a per-game-point-allocation Mechanism — fits inside Points System |
| A new "single-elimination per match" pairing rule | Different mechanic shape, but still a pairing Mechanism — fits inside Match Format |
| A new handicap encoding (e.g., USAPL Skill Levels) | Different mechanic shape (different range, different math), but still a handicap-encoding Mechanism — fits inside Handicap Systems |

Implementation: new Mechanism page + new code path inside the same parent Module. Existing Mechanisms in that parent are untouched. **No new Module.**

**Layer 3 — New Module.** A new *kind of concern* no existing Module covers.

| Example tweak | Why it's a new Module |
|---|---|
| Between-match handicap-adjustment (loser of last match gets break choice this match) | New concern: rules that read prior-match outcomes to affect next-match conditions. No existing Module is responsible for between-match state |
| Time-per-shot enforcement | New concern: in-match timing constraints. Nothing existing covers this |
| Sponsorship payout calculation | New concern: financial outcome derivation. Out-of-scope for any current Module |

Implementation: new Module folder, new design-space mapping, new wizard surface (when LO-customization UI lands).

**The walkthrough in `README.md#how-to-classify-a-new-idea` only handles Layer 3 (new Module).** Most day-to-day LO tweaks are Layer 1 or 2; both deserve the same anti-conflation rigor.

**Module-design implication.** A parent Module's *internal* design determines how often LOs hit Layer 2 vs Layer 1. A parent designed for *composable sub-Mechanisms* (Points System, with its per-game allocator + threshold trigger + initial points + end-of-match aggregate) pushes more tweaks into the parameter/composition layer (Layer 1), fewer into new-Mechanism territory (Layer 2). A parent designed for *mutually-exclusive alternatives* (Handicap Mechanisms with extra_games / start_points / race_length_adjustment) pushes more tweaks toward new Mechanisms. Neither is wrong — the design choice should match the parent's expected variation pattern.

### 6. Drift / split detection

Modules can drift over time. Two essences quietly creep into the same Module; what started as one bounded responsibility becomes a bag holding two. The smell is detectable; catching it early is the difference between a clean split and months of accumulated conflation.

**The "AND" smell test.** If explaining what a Module does requires the word *AND* between two unrelated essences, the AND is the boundary you missed.

Worked example (the one we just did, May 2026):
- Old "Scoring Systems" Module description: *"It allocates per-game points AND decides who won the match."*
- The AND is the smell. Per-game point allocation (a *production* responsibility) and match-victory determination (a *decision* responsibility) are different essences. They share a domain (scoring) but not a responsibility.
- Resolution: split into two Modules. The AND becomes a *boundary* — Points System on one side, Win Calculator on the other.

**Other drift signals:**
- The Module's *name* no longer accurately describes everything inside it. (You find yourself adding parenthetical clarifiers: "Scoring Systems (which also includes win-condition logic).")
- Two variants of the Module produce **different KINDS of output** (not just different shapes of the same kind). Different shapes within one kind is healthy — Handicap Systems' variants legitimately produce Points integers, Percentage values, FargoRate integers; all are *handicap*-kind. But if one variant produces a handicap and another produces a winner declaration, those are different *kinds* — that's the drift smell. (When downstream needs a different shape than upstream gives, the answer is a Converter, not a Module split.)
- Cross-Module references blur — the Module is being cited from contexts that don't share its essence.
- Variant pages start defining things that should live in a different Module's territory.

**When you spot drift:**
1. Name both essences explicitly.
2. Decide if both belong in the system (sometimes one is just a misclassification — see [Section 5](#5-tweak-classification-parameter-new-mechanism-or-new-module)).
3. If both belong, plan a split — a new sibling Module for the second essence, with the first Module narrowed to its single essence.
4. Update cross-references; verify no inline definitions cross the new boundary.

A split is policy-gated under Principle 7 (canonical-docs-as-policy) — naming a new Module or splitting an existing one requires explicit invocation + confirmation.

### 7. The recursive property

Modules nest inside Modules. A System-kind Module composes other Modules. A Mechanism-kind Module may have sub-Mechanisms. The Scoring System (top-level Module) composes the 9 component Modules; the Handicap Systems Module contains 4 variants (each a Module); each variant may have parameter sub-structures.

**This is why we need a universal noun.** Without "Module" as the umbrella term, every level of nesting would force a new word: "the Mechanism that contains a Mechanism inside the System inside the Scoring System..." The recursive structure becomes unparseable. With "Module," every node in the tree is a Module — only the *kind* (Mechanism / System / Chart / Converter) varies by node.

**Two practical consequences:**

- **The Module-page pattern applies at every level.** Whether documenting the top-level Scoring System, a component Module like Handicap Systems, or a leaf variant like FargoRate, the page structure is the same: Essence / Boundary / Design space / How-it-interacts. (See [Section 11: Module-page pattern](#11-the-module-page-pattern).) Recursion means the same template, scoped to the level.
- **The contract pattern applies at every level.** A System Module has an external contract (input → output for the whole composition) AND it composes internal Modules each with their own contracts. The composition is valid only if internal contracts chain correctly. (See [Section 8: I/O contracts](#8-io-contracts-at-module-boundaries).) Recursion means contracts at every level.

### 8. I/O contracts at Module boundaries

Every Module declares a typed input and a typed output. This is the Module's external contract — its promise to anything that uses it. Modules compose by chaining contracts: Module A's output type becomes Module B's input type; if the types don't line up, they don't compose without a Converter.

**Think of the system as an assembly line.** Each Module is a station with a specific function — it accepts a piece of data, adds something to it (or transforms it), and passes the result down the line. The fully-configured Scoring System is the end product the line assembles. Type contracts are the connection points between stations: if station N's output type doesn't match station N+1's input type, the line breaks — unless you insert a Converter station to bridge the gap. Adding a new feature usually means designing a new station that fits cleanly into an existing connection point, not redesigning the line.

**One Module = one external output type.** A Module's external contract has ONE output. That output may be a structured value with multiple fields (e.g., `{games_target_a, games_target_b}`), or a discriminated union with multiple shapes (per *Variant-specific output shapes* below) — but it is conceptually ONE thing: the *answer to the Module's job*. If you find yourself wanting a Module to produce two unrelated outputs (e.g., *"spits out both win-expectancy AND games-needed threshold"*), that's two Modules — one per output. Internal computation may produce intermediate values en route to the final output; those intermediates are implementation details, not part of the external contract. A Module that genuinely needs two distinct outputs gets restructured as a System composing two Modules (each with their own single output).

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

Four kinds are recognized. Every Module is exactly one of them. Each kind gets its own deep-dive section after this one (deep-dives pending — Module first, then Mechanism / System / Chart / Converter).

| Kind | One-liner essence | Example |
|---|---|---|
| **Mechanism** | Atomic Module — does one specific thing | `extra_games`, `start_points`, a threshold computation |
| **System** | Set Module — composes other Modules into a configured whole | Handicap System, Scoring System (top-level), Points System |
| **Chart** | Tool Module — data-shaped lookup or formula consumed by another Module | 3v3-games-needed chart, FargoRate formula chart |
| **Converter** | Adapter Module — translates one type into another so two otherwise-incompatible Modules can compose | Points→Fargo (committed roadmap; currently zero implementations — Converter capability is required for the modular system to deliver on its orthogonality promise) |

The two reached for most are Mechanism and System — the *atom vs set* distinction. Chart is *data-shaped* (a lookup table or formula another Module consumes). Converter is the *adapter* that makes orthogonality real where types don't naturally line up.

> **Reminder: "Variant" is not a fifth kind.** It's casual shorthand for "a Module the parent offers as one of several alternatives." See the *"Variant" is casual shorthand* note in the Architectural Model's Kinds-of-Module subsection above.

### 11. The Module-page pattern

Every Module's documentation page MUST contain the following elements. This is the universal shape — whether the Module is a System, Mechanism, Chart, or Converter. The full Module README template at *Concrete rules / templates → Module README template* below is one specific expression of these required elements; the per-Mechanism (or per-Chart) "variant pages" inside a parent Module are another (with `Reading this cold?` callouts added). The required elements are universal; the section structure adapts to the Module's place in the hierarchy.

**Required elements (every Module page):**

1. **Essence** — what the Module IS in 1–2 sentences. The bounded responsibility, stated cleanly.
2. **Boundary** — what is NOT in this Module. Adjacent Modules with bare cross-links. The anti-conflation classifier.
3. **Design space** — within the bounded responsibility, what variation is possible. Variants index for parent Modules; parameters/sub-mechanisms for atomic Modules.
4. **How it interacts (typed I/O)** — typed input contract, typed output contract, upstream/downstream Module references. The I/O declaration is mandatory; without it the Module cannot be composed against.
5. **(Optional) Code reference / implementation note** — a Module page MAY include a supplementary code pointer or implementation note if it adds illustrative value (per [Principle 6](#6-docs-are-stand-alone-code-references-are-supplementary)). Optional, not required. The doc stands alone architecturally; code references are bonus context.

**Why each element is required:**

- **Essence** orients cold readers in one sentence.
- **Boundary** prevents conflation drift.
- **Design space** shows what's variable (and implies what's fixed).
- **How it interacts (typed I/O)** is the contract that lets composition be verified mechanically — without it the Module is unusable to anything downstream.

### 12. Cross-Module enforcement

Module borders are enforced through three rules:

**Rule 1 — Cross-Module references are bare links, no inline definitions.** When you reference another Module from inside a Module page, the reference is a link, period. Do not paraphrase or define the other Module's content inline. The click between pages IS the boundary teaching moment. Inlining a definition dissolves the boundary the doc exists to enforce.

**Rule 2 — Intra-Module references may have brief inline glosses.** Variants within the same Module can be glossed inline ("Points handicap, the -2 to +2 integer system") because no boundary is crossed. The rule against inlining applies *across* boundaries, not within.

**Rule 3 — Type contracts are enforced at every boundary.** A Module that consumes another Module's output MUST consume the declared output type. If two Modules' types don't naturally line up, insert a Converter — don't let the receiving Module silently accept a type it isn't contracted for. (See [Section 8: I/O contracts](#8-io-contracts-at-module-boundaries).)

*These contracts are enforced, not optional. Three layers do the work in practice: the TypeScript build catches code-level mismatches, doc discipline catches design-stage violations, and cold-reads catch the subtle stuff the other two miss. The point is THAT the contracts hold — the layers are just how that happens.*

These three rules together preserve the borders. Without them, the modular system collapses back into the one-big-blob it exists to escape.

## Mechanism — Deep Dive

*Mechanism is the **atom** kind of Module — the work-doing unit at the leaves of the architecture's tree. This deep-dive applies the Module primitives (Essence / Boundary / Design space / Typed I/O / Implementation-vs-intent flag) to the Mechanism kind specifically. Most existing variants in the codebase are Mechanisms; the deep-dive nails down what makes them Mechanisms (not Systems, not Charts) and how Mechanisms compose into Systems. Family-specific classification tools (like the 2x2 grid for handicap-related Mechanisms) live with the family they classify, not in this deep-dive. **Triggers — sometimes mistaken for a Mechanism kind — are actually a System pattern** (event-acceptor + detector + task-performer + re-armer composed together); they're covered in the System deep-dive, not here.*

### 1. Essence

**A Mechanism is a Module that performs ONE specific functional task with no internal composition of other Modules.** The atom-ness is what distinguishes it from a System (which composes other Modules).

**"No internal composition" means no composition of other named Modules** — NOT "no internal complexity." A Mechanism may have multiple internal steps, internal state, internal logic. FargoRate's `validate input → look up rating (or call API) → apply transform` chain, for example, is all internal to one Mechanism. The atom-ness is about the EXTERNAL contract: from the outside, the Mechanism does one job (`(person) → handicap`). What it does internally to fulfill that job is implementation detail, not composition. If you find yourself decomposing a Mechanism's job into multiple distinct *named* Modules with their own contracts, you're looking at a System, not a Mechanism.

If you can describe a Module's job in a single sentence — *"computes a player's handicap from match history"*, *"declares the asymmetric game targets for a handicapped match"*, *"allocates winner-and-loser points after each game"* — you're probably looking at a Mechanism.

If describing the job requires *"first this, then that, then this other thing, with rules for how they fit together,"* you're looking at a System.

**Examples of Mechanisms:**
- `extra_games`, `start_points`, `race_length_adjustment` (Handicap Mechanism atoms — each takes a handicap difference, produces one benchmark output)
- `accumulated_per_game` (per-game point allocator — takes game data, produces per-side points)
- A FargoRate handicap calculator (`person → handicap value`)
- An end-of-match aggregate calculator (takes match data, produces a final per-side total)

### 2. Why "Mechanism" is its own kind

Could we just call all atom Modules "Modules" and skip the Mechanism label? Yes — but the label carries information:

- **Leaf-node signal.** When you read "Mechanism," you know this is a leaf — it won't decompose further. No "what's inside?" question to chase.
- **Work-doing signal.** Mechanisms are where the actual computation happens. Systems orchestrate; Mechanisms produce.
- **Reach-for-it-most signal.** Most Modules in the codebase are Mechanisms. The kind label keeps conversations precise — *"is this a Mechanism or a System?"* is the first question to ask when classifying anything new.

### 3. Boundary: what's NOT a Mechanism

A Module is NOT a Mechanism if:

- **It composes other Modules** → it's a **System** (the kind for compositions, not atoms). The Scoring System composes 9 component Modules; that makes it a System, not a Mechanism.
- **It's data-shaped** (a lookup table or formula consumed by another Module) → it's a **Chart**.
- **It bridges mismatched type contracts** so two otherwise-incompatible Modules can compose → it's a **Converter**.

A Module is exactly one of the four kinds. A Mechanism is never also a System (you can't be both an atom and a composition simultaneously); the four kinds are mutually exclusive.

**On the word "variant":** you'll see it used loosely throughout these docs (e.g., *"the FargoRate variant of Handicap Systems"*) as everyday shorthand for "a Mechanism the parent Module offers as one of several alternatives." That's fine as casual vocabulary — but **Variant is NOT a separate architectural kind alongside Mechanism / System / Chart / Converter**. FargoRate is a Mechanism, full stop; the fact that Handicap Systems offers it as one of four alternatives is just a description of FargoRate's position in that parent, not a structural property of FargoRate itself.

### 4. Family-specific classification tools

Mechanism *families* (groups of Mechanisms that share a domain) often develop their own classification tools — taxonomies that organize the family by its specific properties. These tools are documentation/organizational helpers, not architectural primitives, and they belong with the family they classify rather than in the general Mechanism deep-dive.

**Example: handicap-related Mechanisms.** The Handicap Mechanisms family uses a 2x2 axis-and-shape grid (handicap-side vs scoring-side × games vs points) plus mode flags within cells (scope: team-aggregate vs per-pairing; termination: threshold vs race). See [`modules/handicap-mechanisms/README.md`](modules/handicap-mechanisms/README.md) for the full grid, the cell-by-cell breakdown, and the currently-shipping variants by mode flag.

Other Mechanism families (a future Match Format pairing-generation family, a between-match adjustment family, etc.) will develop their own classification tools tailored to their concerns. The pattern is: family-specific taxonomies live with the family's parent Module, not in PRINCIPLES.md.

### 5. I/O contract for Mechanisms

Per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries), every Module declares typed input and typed output. Mechanisms specifically:

- **Input:** typically data flowing from upstream (an upstream Mechanism's output, a Chart's lookup result, or a configuration value).
- **Output:** the Mechanism's specific work product — a transformed value, a benchmark declaration, a points allocation, an event.

Because Mechanisms don't compose other Modules, their contract is **direct**: input X → output Y, with **no internal Module contracts to chain or verify**. This is in contrast to a System, whose contract has to verify both the external promise AND the internal chain of Module contracts holds. (A Mechanism may have plenty of internal logic, steps, and state — see [Section 1](#1-essence) — but no internal *named Modules*, so no internal contracts to verify.)

Mechanisms typically have **simpler contracts than Systems** (one external in, one external out) — but the same precision rules apply: declare the input type, declare the output type, name the category if outputs vary by mode. The *one Module = one external output type* rule from [Module § 8](#8-io-contracts-at-module-boundaries) applies (Mechanisms are Modules; the rule applies universally).

### 6. How Mechanisms compose into Systems

Mechanisms are the building blocks Systems compose. The assembly-line view (per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries)): each Mechanism is a station; the System is the line; the fully-configured System produces the end product.

**Inversion of control: Mechanisms don't know they're composed.** A Mechanism just consumes its declared input and produces its declared output. The System is responsible for:

- Picking which Mechanisms to compose
- Wiring outputs to inputs (and inserting Converters where types don't naturally line up)
- Defining the order of composition
- Handling errors at composition boundaries

The Mechanism stays "stupid" about its place in the larger structure. This is what makes Mechanisms reusable — the same `extra_games` Mechanism can be composed into different Scoring Systems without modification because it doesn't know or care which System it's composed into.

**Implication for documentation.** A Mechanism's doc page describes its own contract (input, output, internal logic) — NOT how it's used in any specific System. Cross-references to System usage live in the System's docs (or are added as bare links from the Mechanism's "Where this is used" pointer).

### 7. Naming Mechanisms

- **Atom names (code identifiers):** lowercase_snake_case — `extra_games`, `start_points`, `accumulated_per_game`, `race_length_adjustment`.
- **Atom display names (in docs):** Title Case with spaces — *Extra Games*, *Start Points*, *Race Length Adjustment*.
- **Umbrella name** (the Module that contains Mechanism atoms as variants): plural noun phrase per [Module Deep Dive § 9](#9-naming-rule-plural-vs-singular) — *Handicap Mechanisms*, not *Handicap Mechanism*.
- **Domain-canonical names:** if a Mechanism corresponds to an externally-defined concept with a published name (CSI's "10-Point Scoring System," APA's "Equalizer rating system"), preserve the canonical name as the display label.

**Anti-conflation note on naming.** "Mechanism" the kind is the same word as "mechanism" the everyday-English noun. Be precise in docs: when you write *"the threshold mechanism"* lowercase, you mean any threshold-shaped mechanism in the abstract. When you write *"the Threshold Mechanism"* title-case, you mean a specific named Module. The capitalization signals the precision.

## System — Deep Dive

*System is the **set** kind of Module — composed of other Modules with rules for how the parts fit together. Where Mechanism is the leaf, System is the orchestrator. This deep-dive applies the Module primitives (Essence / Boundary / Design space / Typed I/O / Implementation-vs-intent flag) to the System kind specifically, and addresses three patterns of composition (selection / chain / parallel) plus the trigger pattern (canonical System example) deferred from the Mechanism deep-dive.*

### 1. Essence

**A System is a Module that is composed of other Modules, with rules for how those Modules fit together.** The "set" kind, distinguishing it from the "atom" kind (Mechanism).

If you can describe a Module's job as *"orchestrate these N parts to produce a result"* — pick alternatives, chain components, declare ordering — you're looking at a System.

If the Module's job is one functional task with no internal Modules, you're looking at a Mechanism.

**Examples of Systems:**

- **Scoring System** (top-level) — composed of 9 component Modules (Handicap Systems, Handicap Mechanisms, Points System, Win Calculator, Threshold Charts, Team Geometry, Match Format, Pairings Generator, Standings & Tiebreakers).
- **Handicap Mechanisms** (umbrella for one of the 9 components) — composed of alternative handicap-mechanism Mechanisms (`extra_games`, `start_points`, `race_length_adjustment`); the league picks one.
- **Trigger** — composed of an event-acceptor Mechanism, an event-detector Mechanism, a task-performer Mechanism, and a re-armer Mechanism.

A System has BOTH an external contract (the System's input → output to its consumers) AND an internal composition (how its component Modules wire together). Both must be documented; both must be verified.

### 2. Why "System" is its own kind

Could we just call all set Modules "Modules" and skip the System label? Yes — but the label carries information:

- **Composition signal.** When you read "System," you know there are parts inside. Anyone reading or modifying needs to look at the composition, not just the external contract.
- **Orchestration signal.** Systems orchestrate; they don't do the leaf work themselves. The actual computation happens in the composed Mechanisms; the System's job is wiring and ordering.
- **Reach-for-it second.** After Mechanism, System is the most-reached-for kind. The first classification question for any new Module is *"Mechanism or System?"* — atom or set.

### 3. Boundary: what's NOT a System

A Module is NOT a System if:

- **It performs one functional task with no internal Modules** → it's a **Mechanism** (the atom kind). Internal logic is fine; internal *Modules* are what makes it a System.
- **It's data-shaped** (a lookup table or formula consumed by another Module) → it's a **Chart**.
- **It bridges mismatched type contracts** so two otherwise-incompatible Modules can compose → it's a **Converter**.

A Module is exactly one of the four kinds. A System is never also a Mechanism (you can't be both a composition and an atom simultaneously); the four kinds are mutually exclusive.

**A System may contain other Systems.** Systems nest recursively (see [Section 7: Recursion + IoC](#7-recursion--inversion-of-control-at-the-system-level)). A top-level Scoring System contains a Handicap Mechanisms System; that system in turn contains Mechanism atoms. Each level is a Module of the appropriate kind.

### 4. Three composition patterns: selection, chain, parallel

Systems compose their internal Modules in one of three patterns. Knowing which pattern a System uses is critical for understanding what it does.

**Selection pattern** — the System offers N alternatives; exactly ONE is active per league configuration. The LO picks one; the others are inactive.

- *Handicap Mechanisms* (System) — offers `extra_games`, `start_points`, `race_length_adjustment` Mechanisms; the league picks one of the three.
- *Handicap Systems* (System) — offers Points, Percentage, FargoRate, Skill Level Mechanisms; the league picks one.
- *Threshold Charts* (System) — offers various calibrated charts; the league picks one.

**Selection-pattern alternatives can be any Module kind that fits the System's purpose.** *Handicap Mechanisms* and *Handicap Systems* offer Mechanism-kind alternatives (different rules for the same kind of act); *Threshold Charts* offers Chart-kind alternatives (different calibrated lookups). The pattern is about LO-choice between named options — not about a specific Module kind being the choices.

**Naming for selection-pattern Systems is plural** ("Handicap Mechanisms," "Handicap Systems," "Threshold Charts") — the plural reflects the *coexistence* of the alternatives as named options.

**Chain pattern** — the System composes N components in sequence; ALL are active, each contributing to the result.

- *Scoring System* (top-level System) — chains 9 component Modules; all 9 run together as part of every match.
- A *Trigger* — chains an event-acceptor → detector → performer → re-armer; all four run together as part of the trigger lifecycle.
- *Points System* — chains a per-game allocator + (optional) threshold trigger + (optional) initial-points + (optional) end-of-match aggregate.

**Naming for chain-pattern Systems is singular** ("Scoring System," "Win Calculator," "Points System") — the singular reflects the *single act* the chain produces, even though multiple components contribute.

**Parallel / split-chain pattern** — the System composes N components that run INDEPENDENTLY of each other; no sequential dependency between them. Each component takes its own input, watches its own data, produces its own output. The System surfaces them as a set (or aggregates them as needed) rather than chaining one's output into another's input.

- *Independent thresholds in a match* — a Scoring System can compose many Trigger Systems running in parallel (one watching for `games_played = 11`, another for `games_played = 1.5 bonus`, another for `games_played = 3.0 bonus`, etc.). Each Trigger runs autonomously; the scoreboard polls active Triggers and renders the "next 2 to be reached" by proximity to current state.
- *Future possibility* — a Handicap System that simultaneously produces a team-aggregate handicap AND per-pairing handicaps, each consumed by different downstream Modules.

**Naming for parallel-pattern Systems** typically follows the same plural-vs-singular rule (plural if the branches are coexisting alternatives the LO doesn't pick between but USES all of; singular if the System's identity is the act of running the parallel branches together).

**Nesting is natural — any pattern can embed any other.** A chain-pattern System's individual slots can themselves be selection-pattern Systems OR parallel-pattern branches. A parallel-pattern System's individual branches can themselves be chain or selection. The Scoring System uses chain composition (all 9 components run together); several of those slots are themselves selection-pattern Systems internally (Handicap Mechanisms, Handicap Systems, Threshold Charts); and within one of those slots (e.g., Points System with stacked milestone Triggers), parallel composition can be embedded for the multiple-Trigger-Systems case. The patterns aren't mutually exclusive at the System level; the natural case is composition that mixes all three at different levels.

**The naming rule from Module § 9 maps loosely to composition pattern.** Plural names typically reflect selection pattern (named alternatives coexisting in the design space, LO picks one) OR parallel pattern (named branches all running together). Singular names typically reflect chain pattern (one wrapping act produced by composing components in sequence). The plural-vs-singular test isn't a strict pattern detector — it's a heuristic that catches selection cleanly and ambiguates between parallel and chain.

### 5. Triggers as canonical System example

A **Trigger** is a System pattern composed of four sub-Mechanisms:

| Sub-Mechanism | Job |
|---|---|
| **Event acceptor** | Configures what event/condition to watch for (e.g., `games_played === 11`) |
| **Event detector** | Does the watching — observes the runtime state and matches against the condition |
| **Task performer** | The action that fires when the condition is met |
| **Re-armer** | Manages whether the trigger fires again (single-shot, periodic, manual reset, etc.) |

Each sub-Mechanism is its own atom (one job, no internal Modules). The Trigger composes them — that composition makes the Trigger a System.

**Why triggers are Systems, not Mechanisms.** A trigger has multiple distinct concerns (configure / detect / act / manage re-firing). Each is a separate job. By the atom-vs-set rule, multiple distinct concerns composed together = a System. Triggers belong here in the System deep-dive, not in the Mechanism deep-dive.

**Implicit vs explicit triggers (current code state).** Today, the trigger pattern is mostly *implicit* — bundled into how a parent System dispatches to its components. The parent System has dispatch logic that reads *"when game-scored event arrives, call the per-game allocator"* — the event detection and task dispatch are baked into the System's wiring rather than carried as a named Trigger System composing the four sub-Mechanisms. The trigger is real but not surfaced as its own Module. **This is implementation artifact, not architectural intent.** A future LO-customizable trigger UI (where operators define *what fires on what events*) would likely require unbundling implicit triggers into explicit Trigger Systems with their constituent Mechanisms named and swappable. See task tracker for the deferred decision.

**Stackable triggers.** A parent System can compose multiple Trigger Systems — one watching for `games_played = 10`, another for `games_played = 20`. Each Trigger System is independent; each runs its own four-sub-Mechanism chain. Multiple Trigger Systems inside a parent, not one System with multiple conditions.

**Display metadata.** Every Trigger exposes a display contract for UI consumption:

- **Label** — short text the UI can render (e.g., *"win"*, *"1.5 bonus"*, *"extra games"*, *"race to 7"*)
- **Target value** — the threshold being watched (e.g., `11`, `1.5`, `7`)
- **Status** — active / met / not-yet-met (so the UI can sort by proximity)
- *(Optional)* description, icon, ordering hint

UI components (scoreboard, in-match status display, etc.) read the display metadata and render WITHOUT needing to know what KIND of Trigger it is. The scoreboard's *"show next 2 to be reached"* pattern just polls active Triggers, sorts by proximity-to-target, and renders the top 2 using their display metadata.

This decouples UI from architectural kind — the scoreboard doesn't care if it's a milestone Trigger or a match-end Trigger; it just reads label + target + status. Enables the parallel-pattern *"many independent thresholds, scoreboard surfaces what's next"* UX naturally.

### 6. I/O contract for Systems

Per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries), every Module declares typed input and typed output. Systems specifically have **two layers** of contract:

- **External contract** — the System's input → output as it appears to outside consumers. The Scoring System's external contract is *"match data → match result."* Outside consumers (the season runner, the standings calculator) only see this.
- **Internal contracts** — each composed Module has its own contract. The composition is valid only if every internal contract chains correctly: Module A's output type must match Module B's input type for them to wire together (or a Converter must bridge the mismatch).

**Verifying a System's contract = verifying both layers.** Mechanisms only have to verify the external contract (input X → output Y, no internals). Systems have to verify the external promise AND the internal chain holds. This is the substantive difference between Mechanism and System contracts.

**Selection-pattern Systems** have a special contract pattern: the external output type is the *category* (e.g., "handicap value," "benchmark declaration") shared by all the alternatives, but the actual specific shape depends on which alternative is active (per [Module Deep Dive § 8 — Variant-specific output shapes](#8-io-contracts-at-module-boundaries)). The contract is "outputs one of these named shapes, with a tag identifying which."

**Chain-pattern Systems** have a more straightforward contract: external output is whatever the last station in the chain produces.

The *one Module = one external output type* rule from [Module § 8](#8-io-contracts-at-module-boundaries) applies (Systems are Modules; the rule applies universally — even though a System composes multiple internal Modules, its EXTERNAL output is still one thing).

### 7. Recursion + inversion of control at the System level

**Systems can contain other Systems.** Recursion is how the architecture scales:

- A top-level *Scoring System* (chain) contains *Handicap Mechanisms* (selection) which contains atom Mechanisms (`extra_games`, etc.).
- A future explicit *Trigger System* (chain of 4 sub-Mechanisms) might be composed inside the *Points System* (chain) which is composed inside the *Scoring System* (chain).

Each level is a Module; only the *kind* (Mechanism / System / Chart / Converter) varies by node. The Module-page pattern and I/O contract pattern apply at every level — same template, scoped to the level (per [Module Deep Dive § 7](#7-the-recursive-property)).

**Inversion of control at the System level: a System orchestrates its internals but doesn't know its own composer.** The Scoring System orchestrates its 9 components but has no awareness of what wraps it (the League → Season → Scoring System hierarchy is one level up; the Scoring System never asks *"who composed me?"*). Same way a Mechanism doesn't know which System composed it.

**This inversion is what makes Systems composable into bigger Systems.** A Trigger System can be composed into a Points System, which is composed into a Scoring System, which is composed into a League — and each layer just orchestrates its own contents. No layer needs to know about layers above it. Same reusability principle as Mechanisms (per [Mechanism § 6](#6-how-mechanisms-compose-into-systems)), applied recursively.

### 8. Naming Systems

- **System code identifiers:** snake_case — `scoring_system`, `handicap_mechanisms_module`, `points_system`, `trigger`. (Implementation may vary; the convention is snake_case for code identifiers per repo standards.)
- **System display names (in docs):** Title Case with spaces — *Scoring System*, *Handicap Mechanisms*, *Points System*, *Win Calculator*.
- **Plural vs singular** — per [Module Deep Dive § 9](#9-naming-rule-plural-vs-singular):
  - **Plural** for selection-pattern Systems (variants coexist as named alternatives) — *Handicap Mechanisms*, *Handicap Systems*, *Threshold Charts*.
  - **Singular** for chain-pattern Systems (one wrapping act with parameter variation) — *Scoring System*, *Win Calculator*, *Points System*, *Match Format*.
  - The plural-vs-singular test from Module § 9 directly maps to which composition pattern the System uses (per [Section 4](#4-two-composition-patterns-selection-vs-chain) above).
- **Domain-canonical names:** if a System corresponds to an externally-recognized concept with a published name, preserve it (we don't have many examples for Systems specifically — most are coined by us).

**Anti-conflation note on naming.** "System" the kind shares the everyday-English word "system" — and CSI uses "Scoring System" to mean specifically the per-game point allocation rule, not the whole composed thing. Be precise: when we write *"a System"* in docs, we mean any Module of the set kind. When we write *"the Scoring System"* title-case, we mean the specific top-level Module. CSI's "Scoring System" is now what we call the **Points System** (per the historical restructure that split the old "Scoring Systems" Module into Points System + Win Calculator).

## Chart — Deep Dive

*Chart is the **data-shaped** kind of Module — it provides organized, looked-up data on demand. Where Mechanism is the worker and System is the orchestrator, Chart is the reference: passive, queried by other Modules. This deep-dive applies the Module primitives to the Chart kind and codifies the formula-first preference (formulas are preferred where the math is known; discrete charts are mandatory when LO customization breaks the formula round-trip or when the mapping is empirically derived with no clean underlying math).*

### 1. Essence

**A Chart is a Module that provides organized data on demand via a typed lookup.** Its job is to answer queries: *"given input X, what is the value?"* Same input always produces same output — the Chart is pure (no state, no side effects).

**Examples of Charts:**

- **3v3 games-needed chart** — input: handicap difference; output: target wins per side
- **5v5 games-needed chart** — input: handicap difference; output: target wins per side
- **FargoRate formula** — input: rating difference; output: games-needed threshold value (a Chart in formula shape rather than discrete table shape)

A Chart is *organized knowledge* with a contract. Data flowing between Modules has no contract; a Chart is data shaped into a Module by giving it a typed input/output interface.

### 2. Why "Chart" is its own kind

Could we just call data-shaped Modules "Mechanisms" and skip the Chart label? Yes — but the label carries information:

- **Passive signal.** When you read "Chart," you know it's a passive lookup, not an active processor. It doesn't *do* anything until queried.
- **Reference-data signal.** Charts hold organized knowledge. Mechanisms do work; Charts provide the reference values that work consumes.
- **Formula-or-discrete signal.** A Chart can be implemented as a discrete table OR a continuous formula (see [Section 4](#4-formula-first-charts-are-derived)). The "Chart" label covers both shapes.

### 3. Boundary: what's NOT a Chart

A Module is NOT a Chart if:

- **It actively performs work, transforms state, or has side effects** → it's a **Mechanism** (the atom kind for work-doers). A Chart is purely a lookup; same input always returns same output, no mutation.
- **It composes other Modules** → it's a **System** (the set kind for compositions). A Chart provides knowledge, not orchestration.
- **It bridges mismatched type contracts** so two otherwise-incompatible Modules can compose → it's a **Converter** (the adapter kind).

A Module is exactly one of the four kinds. A Chart is never also a Mechanism (passive vs active).

**Subtlety: a formula-shaped Chart computes its output — isn't that doing work?** No. A formula like FargoRate's `2^(diff/100)` *computes* a value, but the computation is pure description of the lookup. The Chart's purpose is to hold/provide knowledge; the formula is just a more compact representation of that knowledge than a discrete table. Compare: a Mechanism that computes a player's handicap from match history IS doing work — it's traversing records, applying logic, producing a derived value. The Chart lookup is "what's the value at this index?" The Mechanism work is "do this job and produce a result." Different essences.

### 4. Formula-first; charts are derived

**Charts come in two interchangeable shapes:**

- **Discrete chart** — a table mapping specific input values to specific output values. Example: a 7×7 grid of handicap differences mapped to target wins.
- **Formula** — a continuous function mapping any input value to its output. Example: `2^(diff/100)` mapping any rating difference to a target value.

Both shapes are valid forms of the Chart kind — interconvertible expressions of the same mapping. A formula can generate any specific chart on demand. A chart can sometimes be reverse-engineered into a formula (symbolic regression — a research direction; see task tracker).

**Formulas are PREFERRED where the math is known.** Reasons:

- **Continuous coverage** — any input value, not just the discrete points in a table.
- **Easier LO customization** — tweak a parameter in the formula and the entire chart updates.
- **Single source of truth** — no chart-formula sync issues; the formula IS the canonical form.
- **Smaller storage** — one formula vs N table rows.
- **Generative** — can produce any specific chart for inspection or display on demand.

**Charts are MANDATORY in two cases:**

1. **LO customization beyond what the formula can express.** Common workflow: LO views a formula-generated chart, tweaks individual cells for their specific league needs (e.g., *"for handicap diff 3, I want target = 7 instead of 8 — that's just my house rule"*). Those arbitrary tweaks may not fit any clean formula. The system must save the chart as-is — the formula can't represent the LO's edits. Saving the discrete chart is the only honest option.
2. **Empirically derived mappings with no clean underlying math.** Some handicap charts were created by operators tinkering and observing what felt fair, with no formula behind them. The chart is the original; no formula exists to derive it.

**The architecture supports both shapes; the LO's choice determines which form their league uses.** A league running pure FargoRate uses the formula directly. A league that started with the formula and then tweaked individual cells stores the resulting chart as-is.

### 5. I/O contract for Charts

Per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries), every Module declares typed input and typed output. Charts specifically:

- **Input** — the lookup key (a handicap difference, a rating, a percentage, or whatever the Chart maps from).
- **Output** — the looked-up value (target wins, games needed, threshold value, or whatever the Chart maps to).

**Charts are pure.** Same input always produces same output. No state mutation, no side effects, no time-varying behavior. This is what makes Charts safely reusable across many consumers — there's no "ask order" or "asker identity" affecting the answer.

A Chart's contract is the simplest of all the kinds: input X → output Y, no internal complexity to verify, no chain of internal contracts. The *one Module = one external output type* rule from [Module § 8](#8-io-contracts-at-module-boundaries) applies (Charts are Modules; the rule applies universally).

### 6. How Charts are consumed

Charts are passive — they don't do anything until asked. A Mechanism (typically a handicap-side Mechanism that needs a benchmark value) consumes the Chart as part of doing its work.

**Example flow:**
1. A handicap-side Mechanism receives a handicap difference (e.g., from a Handicap System upstream).
2. The Mechanism queries the relevant Chart: *"what target wins for handicap diff of 3?"*
3. The Chart returns the looked-up value.
4. The Mechanism uses that value to declare its benchmark (asymmetric game targets, starting points, etc.).

The Chart doesn't know what consumer asked it; it just answers. The Mechanism doesn't care whether the Chart is implemented as a discrete table or a formula; it just consumes the typed output.

**Charts can be selected at the parent-System level.** A selection-pattern System like *Threshold Charts* offers multiple Chart alternatives; the league picks one. The selected Chart is what gets queried during match runtime.

### 7. Naming Charts

- **Umbrella name** (the parent Module that wraps multiple Chart alternatives): plural noun phrase per [Module Deep Dive § 9](#9-naming-rule-plural-vs-singular) and the selection-pattern naming rule from [System § 4](#4-two-composition-patterns-selection-vs-chain) — *Threshold Charts* (plural; offers alternatives the league picks one of).
- **Specific Chart names** — function-name style, describing what the Chart maps: *3v3-games-needed*, *5v5-games-needed*, *fargo-formula*. Lowercase-kebab for filenames; Title Case for display names.
- **Formula vs discrete in names:** the name doesn't typically encode the shape (formula or discrete) — both shapes are valid Chart kinds.

**Anti-conflation note.** "Chart" the kind shares the everyday-English word "chart." Be precise in docs: when you write *"the threshold chart"* lowercase, you mean any threshold-shaped Chart in the abstract. When you write *"the 3v3 Games-Needed Chart"* title-case, you mean the specific named Module. The capitalization signals the precision.

## Converter — Deep Dive

*Converter is the **adapter** kind of Module — its entire job is bridging two mismatched type contracts so two otherwise-incompatible Modules can compose. Converters are what make Module orthogonality real wherever types don't naturally line up. Currently zero implementations exist in code; the kind is on the committed roadmap because the modular system can't deliver on its "any A pairs with any B" promise without them. This deep-dive applies the Module primitives to the Converter kind.*

### 1. Essence

**A Converter is a Module whose entire job is translating one type into another so two Modules with mismatched contracts can compose.** Input is whatever the upstream Module produces; output is whatever the downstream Module expects.

A Converter doesn't compose other Modules and doesn't provide reference data. Its purpose is bridging the type gap. (Internal complexity is fine — same as any Module per Mechanism § 1; what matters is the external contract and the Module's reason for existing.)

**Examples of Converters (committed roadmap; no current implementations):**

- **Points-to-Fargo** — input: Points handicap (-2 to +2 integer); output: Fargo equivalent (100–850 integer). Lets a Fargo-calibrated Threshold Chart consume a Points handicap value.
- **Percentage-to-Fargo** — input: Percentage rating (0–100); output: Fargo equivalent. Lets a Fargo-calibrated Chart consume a Percentage value.
- **Fargo-to-Points** — reverse direction (if a Points-calibrated Chart needs to consume a Fargo value).

Each Converter handles ONE direction. A bidirectional translation = two separate Converters (per the *one Module = one output type* rule from Module § 8).

### 2. Why "Converter" is its own kind

Could we just call adapters "Mechanisms" and skip the Converter label? Yes — but the label carries information:

- **Adapter signal.** When you read "Converter," you know its *purpose* is type bridging — *"upstream type X → downstream type Y."* What goes on inside to fulfill that translation is implementation (could be simple math, could be re-derivation from upstream data); the kind label tells you what the Module is FOR.
- **Orthogonality-enabler signal.** Converters are what make composition claims like *"any Handicap System pairs with any Threshold Chart"* actually true. Without them, those claims are overstated (per Module § 8 implication). The kind label flags "this Module exists to make composition work where types don't naturally line up."
- **Limited-scope signal.** A Converter has the smallest possible job — translate one value. Reading "Converter" tells you *"don't expect anything beyond the translation."*

### 3. Boundary: what's NOT a Converter

A Module is NOT a Converter if:

- **It exists to do work that isn't type translation** → it's a **Mechanism** (the atom kind for work-doers). The distinction is **purpose**, not internal complexity. A Converter exists specifically to bridge a type mismatch; a Mechanism exists to do some other kind of work (compute a handicap, allocate per-game points, declare a benchmark, etc.). Both kinds may have substantial internal logic — what distinguishes them is *why the Module exists*.
- **It composes other Modules** → it's a **System** (the set kind for compositions). A Converter is itself an atom — it doesn't have other Modules inside.
- **It provides organized reference data via lookup** → it's a **Chart** (the data-shaped kind). A Converter computes a translation; a Chart provides looked-up values. (The line is subtle — see below.)

A Module is exactly one of the four kinds. A Converter is never also a Chart, Mechanism, or System.

**Subtlety: a Converter computes its output, just like a formula-shaped Chart. What's the difference?** The *purpose*. A Chart's job is to *provide knowledge* — answer the question *"what's the value at this index?"* A Converter's job is to *bridge type mismatches* — translate *"the upstream's value, in the downstream's expected form."* Same kind of math machinery; different essence. If the Module exists because two other Modules have mismatched types, it's a Converter. If the Module exists to provide a reference mapping that Mechanisms consume, it's a Chart.

### 4. Calibrated translation, not unit conversion

**Converters are calibrated translations, not trivial unit conversions.** This is critical to flag explicitly because the math often LOOKS trivial.

**Trivial-looking case:** Points handicap is -2 to +2; Fargo is 100 to 850. Numerically scaling Points by some factor to land in Fargo's range is trivial math (e.g., `(points + 2) * 187.5 + 100`). But the resulting number is **meaningless** — a "0 Points" player isn't equivalent to a "475 Fargo" player just because the math lands them in similar numeric positions. Fargo and Points measure player skill differently; the scales aren't structurally comparable.

**For a Converter to produce semantically meaningful output, the calibration must be empirically grounded** — fitted against actual play data showing what Fargo number consistently corresponds to what Points value across many leagues and many players. That's substantial data work.

**Honest framing on what Converters can and can't do:**

- **Fargo is the most accurate handicap encoding** of the ones we ship. Everything else is approximation.
- **A Converter gets LOs as close as the math allows** while being honest about the approximation cost.
- **Many LO-driven Converter combinations will produce *worse* matches** than the prepackaged tested ones. The Converter exists so the LO has the choice, not so every choice is good.
- **Converters cannot perfectly equalize handicap systems.** Two leagues with different handicap encodings will produce different matchups even with a Converter in place.

This honest framing should appear on every Converter's doc page (when the Modules get documented) and in any LO-facing UI that exposes Converter selection.

**Each implementation is its own Converter Module.** A single type-bridge direction (e.g., Points → Percentage) may have MULTIPLE Converter Modules implementing it — one, two, three, or more — depending on what accuracy / complexity tradeoffs make sense for that direction. Some directions may have only one Converter; others may have several. New Handicap Systems added in the future will need their own Converters to/from existing systems, and each of those may have multiple implementations.

Per Mechanism § 1 ("a Module has one internal implementation; swapping implementations means picking a different Module"), each Converter implementation is its own Module with its own external contract. The LO sees the **available Converters** for a given type-mismatch boundary in their league and picks one. The set of available Converters is open-ended and grows over time as new Handicap Systems and new implementations are added.

Per [Principle 10 (Composability contract)](#10-composability-contract--no-break-composition), a default Converter must exist for every valid type-mismatch boundary the architecture enables. The LO may pick a non-default if available, but a default is always present so the system never refuses to run a configured combination.

**Specific Converter implementations are documented in their own per-Converter docs**, not in this deep-dive. The deep-dive establishes the kind; individual Modules describe themselves.

**Converter chain placement is an implementation choice.** Where in the data chain a Converter sits depends on what data is available at that point — different placements enable different implementation strategies. The LO chooses both WHICH Converter and (implicitly) WHERE it sits via that choice. Implementation territory — captured in a separate task; not constrained by the L1 docs.

### 5. I/O contract for Converters

Per [Module Deep Dive § 8](#8-io-contracts-at-module-boundaries), every Module declares typed input and typed output. Converters specifically:

- **Input** — the upstream Module's output type (e.g., Points integer in -2 to +2 range).
- **Output** — the downstream Module's expected input type (e.g., Fargo integer in 100–850 range).

**Converters are pure.** Same input always produces same output. No state, no side effects, no time-varying behavior. (Same purity discipline as Charts.)

**One direction per Converter, per the *one Module = one output type* rule.** A `points-to-fargo` Converter is one Module; a `fargo-to-points` Converter is a different Module. They share no internal logic; even if the math is symmetric in principle, each direction is its own contract.

A Converter's contract is the simplest of all the kinds: input X → output Y, no internal complexity, no chain to verify. Same as Chart's I/O contract structurally — the difference is the *purpose* (bridging vs lookup).

### 6. Naming Converters

- **Code identifiers:** lowercase-kebab using `<from>-to-<to>` convention — `points-to-fargo`, `percentage-to-fargo`, `fargo-to-points`.
- **Display names:** Title Case with arrow or "to" — *Points-to-Fargo Converter*, *Percentage-to-Fargo Converter*.
- **Filenames:** lowercase-kebab — `points-to-fargo.md`, etc.
- **Collective name for the kind:** *Converters* (plural). Unlike Handicap Mechanisms or Threshold Charts (which DO have parent Modules wrapping selectable alternatives), there is no parent "Converters" Module — each Converter is inserted at a specific type-mismatch boundary, and multiple Converters typically appear in different parts of the same pipeline simultaneously (e.g., a `percentage-to-fargo` Converter at one boundary, a `points-to-fargo` Converter at another). "Converters" is the collective name for the kind, not a Module name.

The `<from>-to-<to>` convention makes the direction explicit — critical because each direction is a separate Converter and the naming has to disambiguate.

**Anti-conflation note.** "Converter" the kind shares the everyday-English word "converter." Be precise in docs: when you write *"the converter"* lowercase, you mean any Converter in the abstract. When you write *"the Points-to-Fargo Converter"* title-case, you mean the specific named Module. The capitalization signals the precision.

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
9. **(Optional) Code references** — supplementary code pointers if they add illustrative value (per [Principle 6](#6-docs-are-stand-alone-code-references-are-supplementary)). Optional, not required. If included, use code paths with no line numbers (lines rot).

### Variant page template (8 sections)

1. **Preamble** — classification + `> Reading this cold?` callout
2. **What it is** — short definition + `**Picture this**` novice analogy
3. **How it works / how it's calculated** — mechanics, formulas, key behavior
4. **When you'd use it / pros**
5. **When you wouldn't / cons**
6. **Interactions** — cross-Module references; bare links per anti-conflation rule
7. **Possible modifications** — what an LO could vary within this variant
8. **(Optional) Code references** — supplementary code pointers if they add illustrative value (per [Principle 6](#6-docs-are-stand-alone-code-references-are-supplementary)). Optional, not required.

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
- *"Design as if drag-and-drop; ship wizards."* — Ed, 2026-05-15. The architectural posture: code so the system *could* be a node-graph UI even though the actual delivery is wizards. Forces clean contracts.
- *"You cannot follow a guideline that hasn't been written yet."* — Ed, 2026-05-15. Why existing code is expected to diverge from these principles; the audit-and-align pass closes the gap, not retroactive judgment.

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
