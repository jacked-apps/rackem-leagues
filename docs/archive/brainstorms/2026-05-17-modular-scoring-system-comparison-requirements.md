---
date: 2026-05-17
topic: modular-scoring-system-comparison
---

# Modular Scoring System — Comparison Against Hardcoded Alternatives

## Problem Frame

The viability brainstorm ([`2026-05-16-modular-scoring-system-viability-requirements.md`](2026-05-16-modular-scoring-system-viability-requirements.md)) answered the FIRST question: can the modular architecture in `docs/league-system/PRINCIPLES.md` actually express what's hardcoded today? Answer: PARTIAL YES — native-typed compositions cover the 3 shipped prepackaged Scoring Systems (Points 3-Man, Percentage 5-Man, FargoRate 10-Point 5-Man) plus the BCA 1-Point degenerate case.

**This brainstorm answers the SECOND question:** is the modular framework worth building vs the alternatives below, given the long-term maintenance cost?

**Alternatives considered (per the compare-stage brief):**

- **(a) Status quo** — keep the 3 hardcoded calculators, accept zero LO customization
- **(b) Parameterized hardcoded** — keep the calculators, expose LO-tunable parameters (threshold values, strength multipliers, tiebreaker order); covers parameter tweaks at low refactor cost but cannot cross-compose building blocks (e.g., FargoRate handicap + 3v3 points formula)
- **(c) Modular framework** — build the (Threshold + Trigger) framework + Pairings Generator split + typed thresholds + Converters + frozen-snapshot persistence + parameter dials. *Note: Modules ship without dials first; a manual UI for the dials comes next; an eventual LO-facing wizard is a downstream concern and OUT OF SCOPE for this brainstorm's verdict.*

**Verdict: ship the modular framework (option c).**

## Verdict and Rationale

### Verdict

**Ship the modular framework as the next major work track.** This brainstorm answers Ed's three questions: *is the modular approach a better version, is it viable, is it worth pursuing or should we try something different.* Answers: better-yes, viable-yes (per the viability receipt), worth-pursuing-yes — no drawing-board alternative surfaces a categorically better leverage point for the goals.

### Rationale

Four threads support the verdict:

1. **No current pain.** The 3 hardcoded calculators work. The app has zero users today. The case for modular is NOT "the existing code hurts" — the existing code is fine. Any future reader of this doc should not infer accumulated technical debt as the motivation; there isn't any.

2. **Modular's payoff: surface what the architecture already implies.** Ed's read: "*each module has different dials that can be moved... we don't have to dream up new shit to hopefully get used.*" The modular framework's job is not to invent exotic customizations — it's to expose the dials and combinations the architecture naturally supports, instead of trapping them inside bundled calculators. That's a meaningfully different shape from hardcoded, even though the architecture is the same.

3. **Demand shape is structural, not feature-request-driven.** Ed's 20 years as an LO running one system + experience playing in 3 other leagues each operating very differently confirms that pool-league variation is real and substantial. The variation isn't a long list of specific feature requests; it's that "every league is a different recipe of the same ingredients." The modular framework matches that demand shape directly; (b) parameterized hardcoded does not, because (b) can't cross-mix between calculators (e.g., FargoRate handicap + 3v3 points formula).

4. **The "any combination that needs new module kinds" surface is deferred, not promised.** Per the viability receipt's narrowed Success Criterion 2, the framework's customization promise is scoped to *parameter tweaks + mix-and-match within the known module set*. New Module kinds (streak bonuses, captain-specific scoring, ladder formats) are a future-work surface — if a real LO eventually asks, build then. This bounds the v1 maintenance commitment.

### Why (a) and (b) are inadequate

- **(a) Status quo accepts that the product cannot serve the variation real pool leagues run on.** Every league that wants something different from the 3 shipped recipes requires a code change. That's not a scalable product shape, regardless of timing or competition.
- **(b) Parameterized hardcoded covers parameter tweaks but cannot deliver cross-system mix-and-match.** A hardcoded calculator that's been parameterized still bundles handicap + threshold + per-game allocation + win condition + tiebreaker into one shape. An LO who wants "FargoRate handicaps with 3v3-style points scoring" cannot get there from a parameterized version of the existing calculators — that combination is *between* calculators, not *inside* one. The modular framework's typed Modules + Converters specifically address this case (R9 and R10 in the viability receipt).

  *Acknowledged nuance from existing code:* `src/systems/buildSystemFromPreferences.ts` already does partial cross-axis composition (see "What already exists" below). The genuine differentiator the modular framework brings over (b) is *cross-handicap-type* composition via Converters, which the existing ad-hoc path does NOT cover.

### Why "go back to the drawing board" is rejected

The viability brainstorm validated R1-R19 — the framework can express the 3 shipped systems with the revisions captured there. The architectural shape is sound. A drawing-board alternative would need to either:

- Reject Modules-with-typed-contracts in favor of something else (a small scripting DSL, an event-sourcing model with user-defined rules, a plugin model) — but these are all variants of the same family the (T+T) framework already inhabits, with different tradeoffs but not categorically better leverage for the customization goal.
- Or abandon the LO-customization goal entirely — which collapses back to (a), and is rejected on the product-shape grounds above.

No drawing-board alternative surfaces a categorically better path.

### The "works, not perfect" standard

A core design principle for this v1: **the framework has to work, not be perfect.** This is load-bearing for the verdict because it directly addresses the pattern of "but this isn't proven to industrial-grade." For example: the Points ⇄ Percentage Converter doesn't need a calibrated cross-rating model. The math is a 5-bucket lookup: Percentage 0–20 → Points −2, 21–40 → Points −1, 41–60 → 0, 61–80 → +1, 81–100 → +2 (or analogous for the reverse direction). That's an obvious mapping, an LO can read it and predict behavior, and if it's slightly imprecise at the edges that's acceptable. The framework's promise is *runs and produces sensible output for any combination the LO wires up* (Principle 10's composability contract), not *produces analytically optimal output*. This standard is what makes Converters cheap and what makes the whole framework's scope finite.

## Evidence Supporting the Verdict

This section documents what was actually established during the brainstorm vs what is inferred.

### What the viability brainstorm established (consumed as input here)

- The 3 shipped prepackaged Scoring Systems can be expressed as Module compositions (Percentage 5-Man via full walk, FargoRate 10-Point 5-Man via full walk, Points 3-Man via sanity check).
- The BCA 1-Point degenerate case (empty Points System composition) is handled.
- The framework's customization promise is scoped to parameter tweaks + mix-and-match within the known module set; new Module kinds are deferred future work.

### What this brainstorm established

- **LO-demand shape.** Variation across leagues is real and structural (Ed's 20+ years of LO experience + 3-league player exposure). Demand is not a specific feature-request list; it is "each league is a different recipe of the same ingredients." Modular framework matches this shape; status quo and parameterized-hardcoded do not.
- **Current code has no accumulated pain.** The 3 hardcoded calculators were built one at a time, each works. **The justification for modular is forward-looking; nothing in today's code forces the rewrite.** This is acknowledged honestly so a future reader doesn't invent a debt narrative.
- **Converters are simple under the "works, not perfect" standard.** Ed walked the Points ⇄ Percentage Converter in plain math during the brainstorm: 5 buckets on a 100-point scale, obvious mapping. This concrete example resolves the question that the viability brainstorm flagged as unwalked — Converter implementation is bucket-lookup math, not a re-calibration problem. Re-compute Converter variants (per R10) and additional handicap-system pairs (when added) follow the same standard: pick a sensible mapping, let LOs read it, ship it.
- **Modular's value is exposing already-architectural dials.** Modular framework doesn't invent customizations — it surfaces what the architecture naturally supports. (b) parameterized hardcoded can't reach the same surface because it can't cross-mix between calculators.

### What already exists in code (brownfield, not greenfield)

The modular work is NOT starting from zero. Significant scaffolding has already shipped under prior planning iterations and should be reconciled (not re-derived) during `/ce:plan`:

- **`src/systems/buildSystemFromPreferences.ts`** — runtime resolver with a fast-path preset detection + an ad-hoc-path cross-axis composition. The ad-hoc path already composes across `lineup_size × handicap_type × game_generation × mechanism × points_calculator` axes for off-preset combinations.
- **`src/systems/__tests__/off_preset_combos.test.ts`** — test coverage proving non-preset combinations already run end-to-end.
- **`matches.system_snapshot` JSONB column** (migration `20260418000003_add_matches_system_snapshot.sql`) — frozen-snapshot persistence per R11 is already plumbed at the schema level.
- **`resolved_league_preferences` DB view + `ResolvedSystemConfig` type** — the resolved-configuration surface that flows into runtime composition.
- **Prior plans:** [`docs/plans/2026-04-28-001-feat-modular-league-system-plan.md`](../plans/2026-04-28-001-feat-modular-league-system-plan.md) and [`docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md`](../plans/2026-05-01-001-feat-modular-league-system-v2-plan.md), plus a supplements directory. These predate the viability and compare brainstorms — their architectural decisions need reconciliation against the R1-R19 framework, not blanket adoption or blanket replacement.

**Implication for the verdict:** "ship the modular framework" means *align the partially-shipped scaffolding to PRINCIPLES.md + R1-R19* — closer to a guided convergence than a from-scratch build. The (b) parameterized-hardcoded option's critique above ("can't deliver cross-system mix-and-match") needs a more precise framing: existing code already does partial cross-axis composition along the ad-hoc path; the genuine differentiator the modular framework brings is *cross-handicap-type* composition via Converters (R9 + R10), which the existing ad-hoc path does NOT cover.

### What remains inferred (not directly walked here)

- **Maintenance cost projection** for snapshot persistence and locked-doc alignment was not walked in detail. Ed accepted these costs as part of the framework rather than treating them as deciding factors. Conservative interpretation: the verdict accepts these costs as the cost of doing business; exact magnitude is a planning concern. Sizing these is `/ce:plan` work.
- **Cross-handicap composition end-to-end walk** (e.g., "FargoRate handicap + 3v3 points formula"): the viability receipt notes this case wasn't walked end-to-end. The Converter math for it is the same shape as Points ⇄ Percentage (bucket the source range, map to target range). Likely fine; walked first cross-handicap case during planning or first implementation pass.

## Success Criteria

The compare-stage verdict is successful if:

- **The receipt is enough for `/ce:plan` to start.** A future Claude session reads this doc + the viability receipt and can begin structured implementation planning without re-deriving the architectural framework or re-litigating the build decision.
- **The "works, not perfect" standard is preserved.** Future-Ed (or any future reader) reads this doc and sees that the v1 bar is "runs and produces sensible output for any combination an LO wires up" — not "produces industrial-grade analytics." If anyone tries to gate modular work later citing "but this isn't proven to industrial-grade," the receipt reminds them that "works, not perfect" was always the standard.
- **The deferred surfaces are explicit.** New Module kinds (streak bonuses, ladder formats, etc.) are documented as future work; the build order is named as planning-stage work; downstream UI surfaces (manual dial UI → eventual LO wizard) are noted as separate later concerns.

## Scope Boundaries

The verdict is "ship the modular framework." The following are deliberately **out of scope** for this brainstorm:

- **Implementation sequencing.** Which Modules get touched first, what aligns vs gets revised, how many lock-doc unlocks the work needs and in what order — all `/ce:plan` work. This brainstorm answers "yes, ship it"; planning answers "in what order."
- **UI for the dials.** Modules ship without dials first. A manual UI for the dials comes next. An eventual LO-facing wizard is a further-downstream concern. None of these UI surfaces are part of the verdict and they don't need to exist for the framework to be valuable.
- **New Module kinds** (streak bonuses, captain-specific scoring, ladder formats, hybrid individual-vs-team formats). Per the viability receipt's narrowed Success Criterion 2, these are deferred future work — built only if a real LO asks. Not in v1 scope.
- **Detailed maintenance cost estimation.** Converters per handicap-system pair, snapshot persistence edge cases (forfeit-sub, vacate-and-rescore). Real costs the framework carries; sizing is `/ce:plan` work.
- **Per-Scoring-System Win Calculator rules** (primary rule + tiebreaker chain + termination + playoff). Per the viability receipt's R7 hypothesis, these are content for per-Scoring-System pages (Unit 9 in the locked doc plan) and/or a dedicated Win Calc detail brainstorm. Not addressed here.

## Key Decisions

Decisions made during the brainstorm with their rationale travelling with them:

- **The verdict is forward-looking, not debt-driven.** Captured explicitly so a future reader does not invent a debt narrative that the brainstorm did not find. The hardcoded calculators are fine; the modular work is about giving the product a shape that can serve the variation real pool leagues run on.

- **"Works, not perfect" is the v1 design standard.** This is load-bearing: it makes Converters cheap (bucket lookup math, not calibration models), makes Module variants tractable (sensible-default thresholds, not optimized ones), and bounds the maintenance surface. Principle 10's composability contract is the runtime teeth on this — any combination chains to runnable output; the LO is responsible for choosing combinations that produce sensible results, the framework is responsible only for never breaking.

- **Demand shape framing: "every league is a different recipe of the same ingredients."** The modular framework's job is to expose the dials and combinations the architecture already supports, not to invent exotic features. This narrows the build commitment in a useful way and keeps the maintenance surface bounded.

- **Drawing-board alternatives were considered and rejected.** No alternative architecture (small DSL, event sourcing with user rules, plugin model, curated-menu) surfaces a categorically better path. The R1-R19 framework is the chosen shape.

- **Modular work is brownfield, not greenfield.** Significant scaffolding already exists (see "What already exists in code" above). The verdict means *align partially-shipped scaffolding to PRINCIPLES.md + R1-R19*, not from-scratch build. Planning needs a reconciliation pass against the two prior plans before drafting new units.

## Dependencies / Assumptions

- **Dependency on the viability receipt.** This compare brainstorm consumes [`2026-05-16-modular-scoring-system-viability-requirements.md`](2026-05-16-modular-scoring-system-viability-requirements.md) as its primary input. If R1-R19 changes substantively in later work, the verdict here may need re-examination.
- **Dependency on locked-doc alignment.** Several R-items (especially R5 Pairings Generator split, R7 Win Calc 4-slot hypothesis) propose changes to LOCKED canonical docs in `docs/league-system/`. Per Principle 7 in `PRINCIPLES.md`, these require explicit "unlock and make the changes" invocation. Planning must address the unlock sequence; this brainstorm does not.
- **Assumption: "works, not perfect" is acceptable as the v1 quality bar.** The framework promises runnable output for any combination, with sensible defaults — not optimized output. Some LO combinations will produce slightly-imprecise results at the edges; that's by design. If the project later decides a higher bar is needed for a specific module or Converter, that's incremental tightening, not framework re-derivation.
- **Assumption: prior plans (2026-04-28 and 2026-05-01-v2) need reconciliation, not blanket replacement.** Some prior decisions will align with R1-R19; some will diverge. Planning needs to inventory both before drafting new units. Risk: if the prior plans made decisions that fundamentally conflict with R1-R19 in ways the existing code already depends on, the reconciliation cost is larger than expected.

## Outstanding Questions

### Resolve Before Planning

- **None.** A prior framing in this receipt treated the viability receipt's R5/R7 lock-gate item as a blocker on `/ce:plan`. On closer reading, neither one is a blocker:
  - **R7** (Win Calc 4-slot hypothesis) was downgraded to a hypothesis in the viability brainstorm itself; v1 ships `win_condition` binary; the locked `modules/win-calculator.md` already frames the 4-piece shape as "Future architectural picture, NOT YET BUILT." No edit needed.
  - **R5** (Pairings Generator split from Team Geometry) only needs a locked-doc unlock if v1 implementation actually splits them. That's a planning decision — if `/ce:plan` decides to defer the split, no unlock; if it commits to the split, the unlock happens at that point with the specific change (8 → 9 Modules table) known in advance per Principle 7.

### Deferred to Planning

- **Implementation sequencing.** Which Modules get touched / refactored / aligned in what order. Whether (T+T) framework or Pairings Generator split is the lead piece. How the snapshot persistence layer gets introduced.
- **Reconciliation against prior plans.** Inventory of which decisions in `2026-04-28-001-feat-modular-league-system-plan.md` and `2026-05-01-001-feat-modular-league-system-v2-plan.md` align with R1-R19 vs need revision.
- **R5 Pairings Generator split — go/no-go for v1.** If yes, triggers a locked-doc unlock (`README.md` 8 → 9 Modules table). If no, defer the split until later.
- **Maintenance cost detail.** Empirical estimation of Converter variants, snapshot persistence edge cases (forfeit-sub, vacate-and-rescore, mid-match re-lineup). The verdict accepts these costs; planning sizes them.
- **Per-Scoring-System Win Calc rules.** Per the viability receipt's R7 deferral, either a dedicated Win Calc detail brainstorm OR per-Scoring-System pages (Unit 9) — choice belongs to planning.

## Next Steps

The compare question is answered: **ship the modular framework**. The next phases:

1. **`/ce:plan`** — structured implementation plan. Inputs: this doc + the viability receipt. Outputs: ordered unit list covering lock-doc unlocks, Module implementation sequence, snapshot persistence shape, and reconciliation pass against the two prior plans.

2. **(Optional, lower priority) Win Calc detail brainstorm** — fully specify per-Scoring-System primary rules, tiebreaker chains, playoff escalation per the viability receipt's R7 hypothesis. Not blocking; v1 ships `win_condition` binary regardless.

`-> /ce:plan` is the recommended next step. The verdict is committed; planning is now unblocked.
