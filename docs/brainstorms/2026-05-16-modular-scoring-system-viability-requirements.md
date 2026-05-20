---
date: 2026-05-16
topic: modular-scoring-system-viability
---

# Modular Scoring System — Architectural Viability

## Problem Frame

Current code hardcodes the three shipped prepackaged Scoring Systems (Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man — per the locked README's three-system roster) as bespoke calculators tied to specific handicap variants. League Operators (LOs) cannot customize scoring without code changes, which means the product cannot serve the variation real pool leagues actually run on.

**Note on terminology used throughout this doc:**
- **"FargoRate 10-Point 5-Man"** (code key `fargo_5v5`) is the canonical name; sometimes shortened to **"Fargo 10-7"** colloquially when referring to its scoring scheme (winner 10, loser 0-7). Same system, two names — use the canonical name in this doc.
- **BCA 1-Point** (a.k.a. CSI's "1-Point Scoring System" or "Race To") is **NOT a 4th prepackaged Scoring System we ship.** It's a degenerate analysis case (per-game-allocator `winner=1, loser=0`) that the modular framework must accommodate as the empty-Points-System case (`win_condition='games'`, no separate calculator). Included as a viability target, not as a shipped system.

The locked docs in `docs/league-system/` codify a modular architecture (PRINCIPLES.md, the 8-Module taxonomy in README.md, 3 locked Module READMEs and 1 locked standalone Module file `win-calculator.md`) intended to replace the hardcoded approach. But the modular framework had not been validated against the actual scoring concerns of any prepackaged league end-to-end.

**This brainstorm's question:** can the modular architecture per PRINCIPLES.md actually express what's hardcoded today — and accommodate LO customization — without architectural conflicts?

**Answer arrived at during the brainstorm — PARTIAL (not unconditional YES):**

- **Expressiveness half: YES.** The modular architecture can express the 3 shipped prepackaged systems (validated via walks of Percentage 5-Man and FargoRate 10-Point 5-Man + sanity check of 3v3 Points) plus the BCA 1-Point degenerate analysis case, with the revisions captured in R1-R19. Scope of this YES: native-typed compositions using `start_points` + `extra_games` mechanisms.
- **Customization half: UNVALIDATED.** No concrete LO customization scenario was walked through the framework. The "framework accommodates LO custom" claim (Success Criterion 2) is inferred from architectural symmetry only. This is a Resolve-Before-Planning gate, not a deferred-to-planning item.
- **Out-of-scope-of-this-walk:** `race_length_adjustment` mechanism (used by future BCAPL Skill Level), cross-handicap composition, and LO custom formats outside the (T+T) shape (cumulative season points, ladder formats, hybrid individual-vs-team). Architectural viability for these remains an open question.

## Requirements

The brainstorm walked Percentage 5-Man (5v5%) and FargoRate 10-Point 5-Man end-to-end (the Fargo walk was added in a refinement pass to address a P0 finding from the document-review skill). 3v3 Points and the BCA 1-Point degenerate case were sanity-checked. See the Walk-Forward Evidence section below for what was walked vs inferred. These requirements capture the architectural framework that emerged.

### Module Taxonomy — revisions to the locked 8-Module list

- **R1.** Points System composition = **parallel composition of N (Threshold + Trigger) pairs** with defined firing order on shared events. The locked Points System README's (A) per-game allocator / (B) milestone trigger / (C) initial points / (D) end-of-match aggregate framing describes *shapes that appear today*, not architecturally distinct kinds — they collapse to (T+T) pairs with different acceptor / condition / performer / re-armer parameters.

  **Worked collapse — including the awkward cases (C) and (D):**

  | Locked sub-mechanism | (T+T) form |
  |---|---|
  | **(A) Per-game allocator** (Percentage 5-Man's `+0.1`) | acceptor=`game_completed`, condition=`team won the game`, performer=`score += 0.1`, re-armer=always |
  | **(B) Threshold trigger** (Percentage 5-Man's milestone) | acceptor=`game_completed`, condition=`games_won == T2`, performer=`score = 1.5` (SET), re-armer=single-shot |
  | **(C) Initial points** (Fargo 10-7's start_points) | acceptor=`match_started`, condition=always, performer=`score = handicap_bonus`, re-armer=single-shot |
  | **(D) End-of-match aggregate** (3v3 Points' games-surplus formula) | acceptor=`match_completed`, condition=always, performer=conditional formula `score = f(games_won, win_threshold, lose_threshold)`, re-armer=single-shot |

  Note: (C) and (D) fire on *different event types* than (A)/(B) — `match_started` and `match_completed` respectively, vs `game_completed`. The "shared event" language in R1 is loose; the more precise framing is *"events from a common event bus that triggers consume according to their acceptor."* Each event type is its own logical channel. This is still a parallel-composition pattern (triggers run independently per channel) with defined firing order *within* a channel.

- **R2.** **Threshold** answers WHEN a fire happens — formula or chart that produces fire conditions (always, at specific games_won value, at match_started, at match_completed, etc.). **Trigger** answers WHAT happens — set, add, conditional formula, declare-winner action. Together they're the fundamental unit of point-event behavior. Kept as a fixed pair for v1.

- **R3.** Per-game allocator is a single (T+T) pair with a **bilateral performer**: takes one game completion event + optional inputs, produces `{winner_points, loser_points}`. Performer side values can be: integer (no input), array `[min, max]` (scorer input), or formula (computed from inputs). Data shape implies modal input behavior — no separate `entry`/`formula` flags needed.

- **R4.** Each **threshold concept** is its own Module instance. The Threshold Chart Module produces ONE threshold per instance (per Module § 8 *one output per Module*). A Scoring System needing multiple thresholds (win, tie, no-blowout, lose) composes multiple chart-instance Modules. Code may bundle them for convenience; architecture treats each as independent.

- **R5.** **Pairings Generator** is a Module distinct from Team Geometry. Team Geometry owns *configuration* (`max_roster_size`, `lineup_size`, `game_generation` rule choice — single/double round-robin/etc.). Pairings Generator owns *runtime instantiation*: takes `(template + Lineup A + Lineup B)` and produces concrete game slot list. **Team Geometry remains substantive after the split** (still owns the three configuration axes); Pairings Generator is the runtime executor.

  **Lock-gate dependency:** R5 changes the locked 8-Module taxonomy in `docs/league-system/README.md` to 9 Modules. This is policy-gated work per Principle 7 — requires explicit "unlock and make the changes" invocation. Planning cannot consume R5 as a Requirement until that gate happens; until then, R5 is a **proposed taxonomy revision** awaiting unlock approval.

  **Open question (Deferred to Planning):** Match Format's `pairing_format` axis (per locked README) may overlap with `game_generation`. Either (a) Pairings Generator subsumes `pairing_format` (and Match Format shrinks to `race_length` only), or (b) `pairing_format` stays in Match Format with Pairings Generator only handling concrete instantiation. Resolved in Planning, not here.

- **R6.** **Break/Rack Assignment** is currently bundled inside Pairings Generator (code-current state). Architecturally acceptable to keep bundled in v1 — treat as a *compound output type* where each game-slot record includes the break/rack assignment (one output type containing multiple fields, per Module § 8's "structured value with multiple fields" allowance). Split into its own Module only when LO custom needs it (e.g., "winner breaks next").

- **R7. (Hypothesis, not Requirement.)** **Win Calculator** is *proposed* to be a System composing 4 sub-Mechanisms:
  1. Primary decision rule (comparison → `{home_wins | away_wins | tied | undetermined}`)
  2. Tiebreaker chain (ordered secondary rules, consulted only on `tied`)
  3. Termination semantics (race-mode vs threshold-mode evaluation cadence)
  4. Playoff escalation (extra play if tiebreakers exhausted)

  **Why this is downgraded to a hypothesis:** the locked `win-calculator.md` doc presents a similar 4-piece (axis selection + termination + tie resolution + cross-axis conditions + per-game evaluation cadence) shape as "Future architectural picture, NOT YET BUILT." Today's Win Calculator is `win_condition` binary. The brainstorm has not specified the per-Scoring-System contents of the 4 slots — without that fill-in, the 4-slot decomposition cannot be validated. 3v3's "positive points only awarded if game threshold reached" cross-axis rule may force a 5th slot, collapse two slots, or otherwise revise the shape. **For v1, the actual Win Calculator commitment is: stays as `win_condition` binary; the 4-slot shape is the design-space map for later expansion.** Per-system rules are content for a dedicated Win Calc detail brainstorm.

- **R8.** **Win Calc's metric choice and Points System composition are orthogonal.** Win Calc reads games (BCA 1-Point, 3v3 Points) or points (5v5%, 10-7 Fargo) for match decision. Points System may be empty (BCA 1-Point) or rich (3v3 has end-of-match trigger; 5v5% has per-game + milestones). Independent choices.

- **R9.** **Threshold Modules are TYPED to their input handicap system.** A threshold module instance = `(input_type, computation)`. 3v3 Win-threshold expects Points integers; 5v5% Win-threshold expects Percentage; FargoRate Win-threshold expects Fargo numbers. Cross-handicap composition requires a Converter Module to bridge type mismatches.

- **R10.** **Converters can have multiple variants per source→target pair** with different accuracy/UX tradeoffs. Categorized by data access:
  - **Pure** Converters: input is upstream handicap value (e.g., Fargo→Points bucket mapping)
  - **Re-compute** Converters: input is raw data (player_id + game history); output is target-system-native computation (e.g., display "-2 to +2" but actually recompute Percentage natively under the hood for accuracy)

- **R11.** **Frozen-snapshot principle.** Handicap System is invoked at lineup composition time (pre-lock); its output is snapshotted onto match state. Scoring System operates only on snapshots, never live league data. Makes matches reproducible — the same scoring math runs the same way regardless of when re-read.

### Methodology — taking old code and reshaping it into Modules

*These four items are **methodology observations** surfaced during the brainstorm — they describe HOW future work should approach doc-vs-code alignment, not WHAT to build. Listed with R-numbers for cross-reference convenience, but they are not implementation requirements like R1-R11; they're process notes that will become a polished methodology doc in /ce:plan.*

- **R12.** **Doc-first sketch + code-reality audit.** Sketch Modules from PRINCIPLES.md first; audit against the code that runs the league today; when they diverge, default is that docs are the target per Principle 6. Code shape ≠ Module shape; bundled function outputs are code artifacts, not architecture.

- **R13.** **Fresh-session code observer pattern.** When grounding the architecture against existing code, use a separate Claude session to read the code and produce a clean "what the code does" report. Keeps the architectural-thinking session free of code-shape taint while still grounding decisions in reality.

- **R14.** **Walk-forward methodology — start at match begin, walk to match end.** Setup-vs-execution debate is irrelevant; the Scoring System's modular concerns start at lock-in (when both lineups locked, match begins). Walking forward through one configured league's module chain end-to-end surfaces taxonomy gaps that abstract reasoning misses.

- **R15.** **Use-case driven module identity.** Modules exist to serve real workflows (lineup page, scoring modal, scoreboard, end-of-match decision). A Module is justified by the use case it serves, not by clever architectural decomposition.

### LO Customization Surface — architectural prep, not for build

- **R16.** **Every Module variant exposes adjustable parameters within its input/output contract** (PRINCIPLES § 5 Layer 1 tweaks). LO customization happens at the parameter layer first; escalates to new variants (Layer 2) or new Modules (Layer 3) only when parameter tweaks can't accommodate the desired customization.

- **R17.** **Strength dials** (none / half / standard / 1.5×) are a known dimension already named in the locked Handicap Systems README's "Future possibilities" section. Architecturally they live in the **aggregator step** (the team-aggregate handicap-difference computation) where they scale the diff before feeding to Threshold Modules — preserving readable per-player handicap displays.

- **R18.** **Display metadata** (`title`, `show_in_scoreboard`) lives on (T+T) pairs. Scoreboard renders generically: projects "next 2 by threshold proximity per team" from active (T+T) pairs with `show_in_scoreboard: true`.

- **R19.** **Scoreboard contract is the same regardless of Points System richness.** Renders current state (games_won always; current_score if Points System non-empty), active threshold metadata + proximity, the "next 2 by proximity" projection. Empty Points System (BCA 1-Point) just means scoreboard shows games + win threshold; no special case at the architectural level (UI-layer still has a conditional render path; that's an implementation detail, not an architectural special-case).

## Walk-Forward Evidence

This section documents what was actually walked through the framework end-to-end, what was sanity-checked, and what remains inferred. The viability conclusion in the Problem Frame depends on this evidence.

### What was walked (full end-to-end)

**Percentage 5-Man (5v5%)** — the original walk that produced R1-R11. Exercised: aggregator (sum 5 Percentage values), discrete chart (7-range BCA), `extra_games` mechanism, per-game allocator with integer performer, milestone triggers (B), Win Calc reading points, scoreboard with proximity projection.

**Fargo 10-7 (FargoRate 10-Point 5-Man)** — added in this refinement pass to address P0 #1 (validates the previously-inferred fit). Walk:

| Lock-in step | Fargo 10-7 specifics |
|---|---|
| Snapshots | FargoRate values (100-850) snapshotted at lineup composition (today: manual entry; future: API) |
| Pairings Generator | 25 games via 5×5 single round-robin |
| Aggregator | **For Fargo specifically, the "aggregator" step happens INSIDE the threshold formula** (per-player `2^(r/100)` transform must run BEFORE summing because the transform is non-linear). The table rows below describe the conceptual chain, but the implementation collapses Aggregator + Diff + Threshold into one closed-form computation. This is an architectural detail R9 should acknowledge: not all Handicap Systems have a clean Aggregator-then-Threshold split. |
| Diff | (Conceptual — see Aggregator note. Actual computation: per-team T-sums fed into Elo-style probability, multiplied by per-game expected-points, then floor of absolute difference.) |
| Threshold Module | **FORMULA-shaped** (not chart). Per code-observer review, the actual algorithm in `src/systems/fargo5v5.ts` transforms each player's rating with `2^(rating/100)`, sums per-team T-values, derives Elo-style win probability `tHome/(tHome+tAway)`, multiplies by per-game expected-points across the 5×5 game count, then floors the absolute difference. *Important architectural note for R9:* this means the threshold's input is the **pair of per-player rating arrays**, NOT a single aggregated diff scalar — the T-transform must run per-player before summing (the sum-then-transform shortcut doesn't work because `2^(r/100)` is non-linear). Still validates Principle 8 (formula-shaped), but reveals the threshold input contract is richer than a univariate `diff`. |
| Mechanism (`start_points`) | Outputs `{home_start_points=0, away_start_points=8}` — weaker team gets head-start |
| Trigger (C) arming | acceptor=`match_started`, performer=`weaker_team.score = 8`, re-armer=single-shot |
| Trigger (A) arming | acceptor=`game_completed`, performer=`{winner.score += 10, loser.score += [0,7]}`, re-armer=always |
| Per-game loop | Button press → confirm → modal renders 0-7 counter for loser balls input → Trigger A fires bilateral allocation |
| End-of-match | Win Calc reads points totals; higher wins |

**Findings from Fargo 10-7 walk:**
- ✓ Framework holds; all concerns expressible
- ✓ Validates R1's (C) collapse — start_points = Trigger with `match_started` acceptor
- ✓ Validates R3's bilateral performer + input declaration (winner=10 integer, loser=[0,7] array)
- ✓ Validates R4 — threshold here is a FORMULA, not a chart (confirms Principle 8)
- ✓ Validates R9 — threshold module typed to FargoRate input; uses native FargoRate handicaps (no Converter needed for native-typed composition)
- ✓ Validates R8 orthogonality — Points System non-empty (Triggers A + C); Win Calc reads points

**What Fargo 10-7 did NOT exercise:**
- `race_length_adjustment` mechanism (Fargo 10-7 uses `start_points`, not race-length)
- Cross-handicap composition Converters (Fargo 10-7 is native-typed end-to-end)
- 3-Module-instance threshold composition (Fargo 10-7 uses single start_points threshold; 3v3 is the case with 3 threshold instances)

### What was sanity-checked (not full walk)

**3v3 Points** — walked sufficiently to confirm the (D) end-of-match aggregate sub-mechanism collapses to a Trigger with `match_completed` acceptor + conditional formula performer. Confirms R1's (D) collapse and R7's primary-rule slot for the games-based Win Calc case.

**BCA 1-Point** — walked sufficiently to confirm the degenerate case: empty Points System composition, Win Calc on games alone. Confirms the framework handles the empty-composition zero case (R19).

### What remains genuinely inferred (not yet walked)

- **Cross-handicap LO custom** (R10 Converters): walking *any concrete* cross-handicap pair (e.g., "LO wants to use 3v3 Points formula on Fargo handicaps") would validate the Converter contract. None walked. Pure vs Re-compute Converter distinction (R10) is architecturally posited but unwalked.
- **race_length_adjustment mechanism**: present in code (`src/systems/types.ts RaceLengthThreshold`) but not used by any of the 4 walked/checked systems. Out of scope for v1 per the narrowed assumption.
- **LO custom that doesn't fit (T+T) at all**: hypothetical scoring formats (cumulative season points, ladder formats, hybrid individual-vs-team) not validated against the framework. Success Criterion 2 ("framework accommodates LO custom") is inferred from architectural symmetry, not from walking any concrete LO custom case.

## Success Criteria

- **HIGH confidence:** All 3 shipped prepackaged Scoring Systems (Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man) can be expressed as compositions of Modules per the revised taxonomy — Percentage 5-Man via full walk, FargoRate 10-Point 5-Man via full walk (this refinement pass), 3v3 Points via sanity check. The degenerate BCA 1-Point case (empty Points System composition) is also handled by the framework.
- **Success Criterion 2 (scoped narrowly per user decision):** the framework accommodates LO customization **within the known module set** — parameter dials on shipped modules, mix-and-match of shipped Handicap Systems × Mechanisms × Thresholds × Points Systems × Win Calcs, with Converters bridging type mismatches. **Explicitly NOT a promise to handle arbitrary LO rules that need fundamentally new module kinds** (e.g., streak bonuses, captain-specific scoring, time-based scoring, no-match ladder formats). New module kinds are a future-work surface — if a real LO asks, build then. The framework's job is to make the 4 KNOWN packages composable + dial-tweakable, not to be infinitely flexible.
- A future Claude session can read this doc and continue the work (either compare stage or implementation planning) without re-deriving the architectural findings.

## Scope Boundaries

This brainstorm validated architectural VIABILITY of the modular system for scoring. The following are deliberately **out of scope**:

- **Compare stage** — quantifying "how much better than hardcoded" (LO flexibility gain vs refactoring cost vs added complexity). This is a separate brainstorm + analysis that consumes THIS doc as input.
- **Methodology doc writing** — the brainstorm SURFACED the methodology insights (R12–R15); writing them as a polished standalone doc is /ce:plan territory.
- **Module taxonomy doc updates** — locked README.md and locked Module READMEs may need rewrites based on this brainstorm's findings (e.g., Points System README's (A/B/C/D) framing collapses into (T+T) pairs). All such edits are lock-gate territory per Principle 7; they happen in a separate branch with explicit "unlock and make the changes" invocations.
- **Stats/Analytics Module, Confirmation/Audit System, Forfeit Policy** — the scoring modal is already built and handles these concerns directly. Not in scope for the modular Scoring System architecture; their own follow-up work if surfaced.
- **Detailed Win Calculator per-system rules** — Win Calc's 4-sub-mechanism shape is *hypothesized* (R7 is a Hypothesis, not Requirement); the actual primary rules, tiebreakers, and playoff specifications per Scoring System are content for the per-Scoring-System pages (Unit 9 in the locked doc plan) and/or a Win-Calc-specific brainstorm.
- **Wizard / LO-customization UI** — the framework supports a Wizard surface (e.g., for picking Converter variant when handicap-mismatch is detected), but actual UI design is deferred.
- **Strength dial implementation** — architectural prep only (R17); not for build now.
- **Actual code refactoring** — Step 2+ branch territory per the locked PRINCIPLES.md framing.

## Key Decisions

Decisions made during the brainstorm with their rationale travelling with them:

- **(T+T) is the fundamental unit, not (A/B/C/D).** Locked Points System README's (A/B/C/D) sub-mechanism types are descriptive of shapes that appear today, not architecturally distinct kinds. They collapse to (T+T) pairs with different parameters. This insight unifies the framework and removes a categorization that would otherwise constrain Points System composition.

- **(T+T) as fixed pair for v1.** Not splitting Threshold and Trigger into independently composable Modules. **Justification:** none of the 4 walked/checked Scoring Systems requires mix-and-match (one threshold driving multiple triggers, or one trigger fired from multiple thresholds). The fixed pair halves the type-contract surface for v1 and gives LOs a simpler mental model. **Reversal cost is low:** a future split is additive — existing fixed pairs become the degenerate case of the independent form, no data migration required. If LO custom ever needs multi-trigger-per-threshold, the System composing the pairs holds N pairs and the LO repeats the threshold across pairs as an interim accommodation.

- **Win Calc and Points System are orthogonal.** Win Calc's metric (games vs points) is independent of Points System composition richness. Treating these as independent simplifies both concerns and supports the BCA 1-Point degenerate case naturally.

- **Modal is out of scope; per-game allocator declares input contract.** The scoring modal is already built and handles stats / forfeit / confirm-deny / undo. The per-game allocator's job narrows to: declare input contract (integer / array / formula + label) and compute points from inputs. Modal renders from the declaration.

- **Threshold modules are typed; cross-handicap composition requires Converters.** Each threshold instance carries its expected input type. The system never refuses an LO's combination (per Principle 10's composability contract); when types don't match, a Converter slot in the composition gets filled.

- **Code shape ≠ Module shape (lesson banked mid-brainstorm).** When code-reality reports show bundled outputs (like a function returning a tuple), treat the bundle as code organization, not architecture. Each architectural concept owns its own Module instance.

## Dependencies / Assumptions

- **Assumption (verified in code-observer pass):** for the 4 prepackaged Scoring Systems (all single-rack-per-pairing), the existing game generator (`generateGameOrder` in `src/utils/gameOrder.ts`) handles single and double round-robin with breaker/racker positions. Pairings Generator Module can wrap this existing implementation; doesn't need rebuilding from scratch for v1. Race-length-adjustment Mechanism (per `src/systems/types.ts RaceLengthThreshold`) would need a separate Pairings Generator variant — out of scope for v1.
- **Assumption:** the 3 shipped prepackaged Scoring Systems (plus BCA 1-Point as degenerate target) are representative of the variation the architecture needs to express for the modular framework's V1 scope. LO custom scoring formats outside this set are inferred to fit by architectural symmetry, not walked — see Resolve-Before-Planning items.
- **Dependency:** any actual implementation of this architecture depends on the locked docs in `docs/league-system/` being updated to reflect the (T+T) collapse, the Pairings Generator split, the frozen-snapshot principle, and the typed-threshold + Converter architecture. Those updates are lock-gate work requiring explicit "unlock and make the changes" invocations per Principle 7.

## Outstanding Questions

### Resolve Before Planning

- **[Affects R5][User decision]** R5 (Pairings Generator split from Team Geometry) and R7 (Win Calc 4-slot hypothesis) propose changes to LOCKED canonical docs (`docs/league-system/README.md` 8-Module taxonomy; `docs/league-system/modules/win-calculator.md`). These require Principle-7 unlock procedure to become canonical. Planning cannot consume R5/R7 as Requirements until that gate happens. Decide: address the unlocks BEFORE planning (cleaner handoff) or as a Planning-stage step (more flexible but riskier)?

*(Note: a prior "validate one concrete LO custom case" item was removed per user scope clarification — the framework's customization promise is scoped to parameter tweaks + mix-and-match within the known module set, not arbitrary LO rules requiring new module kinds. See updated Success Criterion 2.)*

### Deferred to Planning

- **[Affects R5][Technical]** Should Pairings Generator's variants (single RR, double RR, modified) live as Mechanism atoms inside it, or as parameters on a single Mechanism? Affects whether LO custom for pairing rules looks like "pick a variant" or "tweak parameters."
- **[Affects R5][Technical]** Match Format's `pairing_format` axis overlap with `game_generation` — does Pairings Generator subsume that axis (Match Format shrinks to `race_length` only), or stay split?
- **[Affects R3][Needs research]** What's the actual condition / performer expression language richness needed for LO-custom Triggers? Simple comparison + arithmetic likely suffices; full DSL is overkill. Planning should scope this. Also: existing `src/systems/calculators/types.ts` has a `ScoringPopupSideSpec` discriminated by `kind: 'fixed' | 'counter'` — confirm whether R3's input contract aligns.
- **[Affects R10][Needs research]** What's the minimum Converter library needed to deliver on Principle 10's composability contract? At least one Converter per ordered handicap-system pair (Points↔Percentage, Points↔Fargo, Percentage↔Fargo); maybe more variants per pair. Decide: ship Pure variants only for v1, or both Pure and Re-compute?
- **[Affects R11][Technical]** Frozen-snapshot principle persistence shape: WHAT gets snapshotted (handicap value only, or also aggregator outputs and threshold outputs)? WHERE persisted (existing `match_games` / `match_lineups` rows, new `match_snapshots` table, JSON column on `matches`)? Behavior under forfeit-substitution / mid-match re-lineup / vacate-and-rescore unspecified — may require snapshot-versioning. Also: Re-compute Converters (R10) accessing raw game history — caching strategy needed?
- **[Affects R17][Technical]** Where does the strength dial's UI surface live in the wizard — on the Handicap System step or its own step? Affects wizard step count and LO mental model.
- **[Affects R7][User decision]** Per-Scoring-System Win Calc rules (primary rule + tiebreaker chain + termination + playoff) need filling in. Should this happen in (a) a dedicated Win Calc detail brainstorm BEFORE planning, or (b) as content for the per-Scoring-System pages (Unit 9 in the locked doc plan) DURING planning? V1 commitment is `win_condition` binary regardless.

## Next Steps

The viability question is answered positively for the 3 shipped prepackaged Scoring Systems (plus the BCA 1-Point degenerate case). Customization scope is narrowed per user clarification: framework promise = parameter tweaks + mix-and-match within known module set, NOT arbitrary LO rules requiring new module kinds.

**One Resolve-Before-Planning item (from Outstanding Questions above) gates the standard handoff:**

1. Decide R5/R7 lock-gate timing (before vs during planning).

**Once those resolve, three possible next phases (not mutually exclusive):**

1. **Compare stage** (separate brainstorm) — weigh "modular vs hardcoded" with effort/benefit tradeoffs. Inputs: this doc + survey of current hardcoded code's pain points + LO-demand signals.
2. **Planning** (`/ce:plan`) — structured implementation plan for the actual rework: which locked docs need unlock, in what order, with what changes. Inputs: this doc.
3. **Win Calc detail brainstorm** (separate, lower priority since v1 ships `win_condition` binary) — fully specify the per-Scoring-System primary rules, tiebreaker chains, and playoff escalation per system. Inputs: this doc + R7's hypothesis.

`-> Resume /ce:brainstorm` if Resolve-Before-Planning items, Win Calc detail, or compare stage should happen before planning.

`-> /ce:plan` if proceeding directly to structured implementation planning (assumes Resolve-Before-Planning items get addressed inside planning or the user accepts their risk).
