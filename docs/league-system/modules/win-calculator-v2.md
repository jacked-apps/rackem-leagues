---
title: Win Calculator (Module) — v2 DRAFT
date: 2026-05-23
status: draft
supersedes: win-calculator.md (pending ratification)
audience: AI sessions + expert dev
---

> ## ✍️ DRAFT — NOT YET CANON
> Proposed v2 replacement for locked [`win-calculator.md`](win-calculator.md) (2026-05-23 endgame brainstorm). Unlocked by design; carries no locked banner; not authoritative. Ratify by swapping this content into the locked file via the [Principle 7](../PRINCIPLES.md#7-canonical-docs-as-policy) unlock→swap→relock cycle; the [delta list](#what-this-changes-vs-the-locked-v1) is the diff to apply.

# Win Calculator (v2 draft)

## Essence

Side-effect-free **verdict function** `(match state) → result`, with `result ∈ {home, away, ∅}` (∅ ≡ no winner ≡ tie). Resolution is short-circuiting:

1. **Chip set?** If `result` already holds a winner (an affirmative write during play), return it; comparators skip.
2. **Else walk the comparator switch** — the LO-ordered winner predicates; the first decisive one writes `result`.
3. **Else ∅** — a tie is the terminal *residue*, never an emitted value.

Pure/idempotent: re-invocation on identical state yields the identical verdict; the Module allocates no points, emits no flow-control, performs no I/O. (Extractable analogy: handicap lays the track; Win Calc is the finish tape + photo-finish — judgment only, not setup or operation.)

## Why it exists

Anti-conflation of *production* vs *decision*. A match accumulates two data streams — games (recorded per game) and points (allocated by [Points System](points-system/README.md)). Producing point data and deciding the winner are distinct responsibilities; this Module is solely the latter.

## Boundary

Owns winner determination only. NOT: per-game point production → [Points System](points-system/README.md); strength encoding → [Handicap System](handicap-systems/README.md); asymmetry kind (head-start vs asymmetric race) → [Handicap Mechanism](handicap-mechanisms/README.md); target derivation → [Threshold Chart](threshold-charts/README.md); edge production → [Tiebreak System](tiebreak-system/README.md); match termination → the `endMatch` token (runtime-consumed); endgame sequencing (point awards, confirmation, undo, recording) → the runtime/"director", **outside the Scoring System catalog**.

Classifier: *what data declares the winner* → here; *how points are produced* → Points System; *when play stops* → `endMatch`/runtime; *how a tie is broken* → Tiebreak System.

## Verdict model — `result` + win chip

`result` carries a **winner only** (`home|away`), never `tie` (tie ≡ ∅, see [Ties](#ties)). The **win chip** is any affirmative winner-write into `result`, from three interchangeable producers:

- a **win-threshold trigger** during play (clinch; `anytime` or `match_end` TYPE per [Trigger](points-system/trigger.md));
- a **comparator** at terminal;
- the **[Tiebreak System](tiebreak-system/README.md)** post-∅.

Chip is **checked first → short-circuit/override**. Mandatory: asymmetric per-side targets make cross-side raw comparison undefined, so a clinch must bind unconditionally rather than be re-litigated by a comparator. **Recalc** = re-invocation after a producer mutates `result`; the Tiebreak path is guaranteed to terminate it (Tiebreak is a total function — its chain auto-appends a terminal human-pick).

## Comparator switch (internal composition)

Win Calc is a [System](../PRINCIPLES.md#system--deep-dive) composing **comparator Mechanisms**; the LO selects + orders them (the "switch"), persisted as **data** (workshop-exposable, no engine change to add/reorder). Catalog is a 2×2:

| | totals-compare (symmetric) | target-compare (asymmetric) |
|---|---|---|
| **games** | max games | games vs per-side games-target |
| **points** | max points | points vs per-side points-target |

- **totals-compare** — valid iff the handicap advantage is folded into the totals (e.g. [`start_points`](handicap-mechanisms/README.md) head-start); decisive only at terminal; ∅ on equality.
- **target-compare** — reads per-side targets from the [Threshold Chart](threshold-charts/README.md) ([`extra_games`](handicap-mechanisms/README.md)); the only comparator that **clinches early** (emits the chip mid-play).

Switch examples: asymmetric-games (BCA 3v3) = `[target-compare games]`; pure-points (Fargo 10-7) = `[totals-compare points, totals-compare games, →Tiebreak]`; either (Percentage 5v5) = LO choice.

## `endMatch` — orthogonal termination token

Stopping play is a **separate flow-control token** (`endMatch`), runtime-consumed, not Win Calc's. The two dissociate: win∧¬end (threshold-mode clinch, play continues), end∧¬chip (schedule exhausted, comparators then decide), win∧end (race-mode). Race-mode = **two triggers on one condition** (one writes `result`, one writes `endMatch`; per Trigger "two effects = two triggers"). "Ends on threshold met" is therefore a per-league setting ≡ presence of the `endMatch` trigger; the chip is unchanged.

## Ties

∅ is a **concluded residue, not a signal** — concludable only at terminal state, which structurally forbids premature ties. target-compare: the chart supplies a win-target **and** a tie-target; ∅ recognized only at terminal with no win chip and no side at its win-target. totals-compare: ∅ ≡ equality.

Routing of ∅: **tiebreak assigned** → runtime executes it → winner → chip → recalc → verdict; **unassigned** → `result` stays ∅ through full resolution → recorder persists a tie. **Allow-Ties = explicit slot occupant** (no null/empty sentinel — absence cannot distinguish "deliberate" from "unconfigured"). An assigned tiebreak cannot itself yield ∅ (terminal human-pick is total) ⇒ persisted-tie ⟺ Allow-Ties selected.

**Config vs execution**: tiebreak selection/order/allow-ties ∈ Scoring System (the terminal winner-determination piece); execution (coin flip, played mini-match, human pick — human/async) ∈ runtime. A mini-match tiebreaker is a second match; matches are runtime-run.

## Director boundary

Win Calc = pure verdict; the **runtime/"director"** (outside the catalog) sequences everything around it. Match-end point awards = `match_end` triggers reading `result` from the state bag, ORDER-sequenced — **no Win Calc→Points call**. Confirmation (two-scorekeeper handshake) + recording = runtime-driven reactions to the verdict; Win Calc never hands off. Undo = recompute (vacate-and-rescore), free given purity. The runtime **invokes modules by contract, never reaches internals**. Purity ⇒ the never-break floor: a side-effect-free verdict has minimal throw surface.

## Current implementation status

Stand-in: binary `win_condition ∈ {games, points}`; the unified model is not in code. target-compare/chip requires a **Threshold Trigger**, which requires **[Threshold Charts](threshold-charts/README.md)** + the **[Trigger](points-system/trigger.md)** primitive in code — hence build order Threshold Charts → Trigger → this Module. (Unit sequencing → migration plan, not this blueprint.)

## Remaining open design space

Comparator-switch persistence shape; race-mode `endMatch` semantics (no race league ships today); comparator-catalog growth via registry (data, not engine).

## How this Module interacts

Upstream: games + points data + per-side targets ([Handicap Mechanisms](handicap-mechanisms/README.md) + [Threshold Charts](threshold-charts/README.md)). Output: `result` (or ∅ → recorded tie). Tiebreak: ∅ fires [Tiebreak System](tiebreak-system/README.md) via the runtime; the winner re-enters as the chip → recalc (sequential, not circular). Downstream: per-match verdict → Standings concern (outside the catalog).

## What this changes vs. the locked v1

Diff to apply when swapping out [`win-calculator.md`](win-calculator.md):

1. **Two-mode framing dropped.** 2026-05-18 "chip-mode vs cascade-mode" → one judge (chip-short-circuit + comparator switch). "chip-mode" ≡ a target-compare comparator configured; "cascade-mode" ≡ totals-compare comparators.
2. **`result` win-only; tie = ∅ residue.** v1 "metric precedence stack with `edge` as lowest entry" → chip-override + recalc; no `edge`-as-bottom-metric.
3. **Comparators = explicit 2×2** ({games,points}×{totals,target}) vs abstract "metric precedence stack."
4. **`endMatch` modeled as its own token** (v1 unmodeled; 2026-05-18 lumped "end game now" onto the chip).
5. **Orchestration removed from Win Calc.** v1 + 2026-05-18 had Win Calc fire the tiebreak and orchestrate the end-cascade; here Win Calc is pure and the runtime/director sequences tiebreak, point awards, confirmation, recording.
6. **Allow-Ties = explicit module** in the tie slot (no null/empty-slot sentinel for ties-allowed).

## Source of truth

- Prior direction (superseded by this v2): `docs/brainstorms/2026-05-18-win-calculator-trigger-and-cascade-direction-requirements.md` — the two-mode framing this draft replaces, developed forward in the 2026-05-23 Win Calculator / endgame brainstorm.
- Current primitive code: `src/types/preferences.ts` (`win_condition`); `src/systems/win-calculators/` (cascade-mode-only scaffolding); `src/systems/buildSystemFromPreferences.ts`.
- The unified model above is not yet in code.
