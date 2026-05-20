---
title: Complex Trigger (concept)
date: 2026-05-20
status: design
locked: false
---

# Complex Trigger

> **Status: design concept, not yet implemented.** The shipped trigger schema
> supports SIMPLE triggers only. This doc defines what a COMPLEX trigger is so
> the trigger model has a clear growth path. Implementing it means extending
> the trigger schema to allow computation in both the condition and the action.

## A trigger is TYPE + CONDITION + ACTION

Every trigger has three parts:

```
TYPE       when is it checked?   match_start | match_end | anytime
CONDITION  does it fire?         a flat comparison (or always-true)
ACTION     what does it do?      assign or compute a value
```

Read together it's still an if/then: *given the TYPE's timing, IF the CONDITION
holds, THEN run the ACTION.* There is no `else` — if the condition is false,
nothing happens.

### The three types

- **match_start** — fires immediately at match start. Pass-through triggers
  (like initial points) use this with an always-true condition.
- **match_end** — fires after all games are played OR the end chip (endmatch) is
  received. Handles both a natural finish AND an early clinch (race-to-X).
- **anytime** — fires whenever its condition holds during play, as games are
  recorded.

**TYPE is orthogonal to CONDITION.** "match_end + a comparison" is just
`type=match_end` with one flat comparison — NOT a compound condition. Separating
the two is what lets every trigger stay flat: the type handles *when*, the
condition handles *whether*, never mashed together.

> *Naming note:* "match" = the whole set of games; a "game" is one rack. These
> types fire at MATCH boundaries — hence match_start / match_end.

## Simple trigger (shipped today)

A **simple trigger** is the restricted form currently in code:

- **condition** — an EQUALITY check only. e.g. `home_wins === n` (where `n` is
  the value from a single bound threshold) — or always-true for a
  match_start / match_end pass-through.
- **action** — ASSIGN a fixed value or a reference: a literal (`1.5`, `'home'`,
  `true`), the bound input (`n`), or another variable's current value. The only
  math today is the limited `target + value` or `target × value` — no subtract,
  no divide, no multi-operand expressions.

Example *(type: anytime)*: "when home reaches the win target, set home_points to 3.0."

```
type: anytime
IF   home_wins === winTarget
THEN home_points = 3.0
```

Simple triggers are easy to author and hard to get wrong. They're the default
tier in the LO trigger builder.

## Complex trigger (the concept)

A **complex trigger** is the same TYPE + CONDITION + ACTION shape, but the
CONDITION and ACTION may compute:

- **condition** — a SINGLE comparison beyond equality: `>`, `<`, `>=`, `<=`.
  e.g. `home_wins > winTarget`. ONE flat comparison — no compound `AND`/`OR`,
  no range checks like `T <= x <= W`. If you think you need a compound
  condition, that's a signal to push the logic elsewhere (see "No nesting").
- **action** — a flat arithmetic expression: `( )`, `+`, `−`, `×`, `÷`,
  constants, and variables. e.g. `home_points = (home_wins - winTarget) * multiplier`.
  **It's a registered operation** (operation_kind + args), shown here in
  readable form — NOT free-form code an LO types into a box. Same data-driven
  pattern as thresholds and allocator formulas: the math lives in code, the
  args are data.

Example *(type: match_end)*: "when home finishes above the win target, award
the overage times the multiplier."

```
type: match_end
IF   home_wins > winTarget
THEN home_points = (home_wins - winTarget) * multiplier
```

That's the entire difference from a simple trigger: **a complex trigger adds
comparators to the condition and a flat arithmetic expression to the action.**
Not "full programming" — one flat statement, still bounded.

> **`÷` needs a zero-guard.** Divide-by-zero is the one arithmetic edge case: in
> JS `x / 0` is `Infinity` and `0 / 0` is `NaN`, which silently poison every
> later calculation. The rule: **throw on divide-by-zero** (fail loud), plus a
> build-time warning when a trigger uses `÷`. `+`, `−`, `×` need no guard.

## Two hard constraints

A complex trigger is still ONE flat statement — bounded. Two rules keep it from
becoming arbitrary code:

### 1. No `else`

A complex trigger fires or it doesn't. There is no `else` branch. If you need
to handle the opposite case, you write a SEPARATE trigger with the inverse
condition.

*Why:* keeps every trigger atomic and one-directional — one condition, one
outcome. An `else` would smuggle two behaviors into one row, which is harder to
read, edit, and validate. Two triggers each doing one thing beats one trigger
doing two.

### 2. No nesting

The formulas are FLAT. Neither the condition nor the action may contain an
if/then inside it — no `(a > b ? x : y)`, no branching within an expression, no
compound/range conditions in the condition.

**If you think you need a nested condition, you're solving it in the wrong
place.** A nested condition is a signal — move the decision OUT of the trigger.
Two ways to flatten it:

1. **Push the decision into a threshold (primary).** A threshold is a value
   producer — it's ALLOWED to read outside sources (state, prefs, charts) and
   compute conditionally. Let it resolve the right TARGET value, then the
   trigger just uses that locked-down number with no choosing. Example: instead
   of a trigger that branches on "is there a tie?", add a `pointTarget`
   threshold that resolves to the correct number, and the trigger becomes a
   single flat `points = games_won - pointTarget`.

2. **Split into separate triggers (fallback).** When the branches do genuinely
   different ACTIONS (not just pick a different number), write one flat trigger
   per branch, each with a single condition.

*Why:* nesting is where logic becomes unreadable and un-validatable — and it's
the most dangerous thing to expose to a non-coder LO. Pushing the decision into
a threshold keeps the conditional in code (the operation), where it's tested and
safe; splitting into flat triggers keeps each rule glance-readable. **A nested
condition should never live inside a single trigger.**

## Relationship to the end-of-match aggregate (EOGA)

The EOGA's three-band per-side formula LOOKS like it needs a compound condition
— the tie band is `tieTarget <= games_won <= winTarget`. But per the no-nesting
rule, that compound middle band flattens. The clean shape is **two
single-comparison triggers + the tie band as the default**:

```
IF games_won > winTarget   THEN points = (games_won - winTarget) * multiplier   [above-win]
IF games_won < tieTarget   THEN points = (games_won - tieTarget) * multiplier   [below-tie]
(tie band: NEITHER fires → points keeps its default 0)
```

No compound condition, no nesting, no `else` — and it reproduces the locked
3-band behavior exactly, because the tie zone is simply "no trigger fired."
That's escape hatch #2 (split triggers).

Escape hatch #1 would push the band-selection into a `pointTarget` threshold so
the trigger collapses to a single `points = games_won - pointTarget`. Cleaner
still — but note a single `pointTarget` changes which reference applies above
the win line, so it's a behavior change, not a drop-in replacement for the
locked formula. Use it only if you intend that change.

Today the EOGA stays a SEPARATE primitive because the shipped trigger schema
can't run formula actions yet. If/when complex triggers land, the EOGA could
dissolve into these flat triggers — though that's more rows (2-3 per side) than
the single bundled aggregate, so keeping it bundled may stay the better choice.
The point isn't that the EOGA MUST become triggers — it's that the same logic
expresses as FLAT complex triggers, **no nesting required.**

## Exposing this to LOs is risky — gate it

Complex triggers let non-coders author conditions and computed values. That's
inherently dangerous: a misconfigured formula or condition can produce unfair or
nonsensical scoring, and a non-coder won't always see it coming. Treat the
complex tier as an ADVANCED, gated capability:

- Default LOs to SIMPLE triggers; put complex triggers behind an explicit
  "advanced" affordance.
- Lean on composition-build validation (ref resolution, shape/side checks,
  unknown-operation checks) to catch mistakes before they ship.
- Prefer presets/templates over from-scratch authoring in the complex tier.
- The no-nesting rule is itself a safety guardrail — it bounds how wrong a
  single trigger can go.

A "super complex trigger" (nesting, `else` branches, multi-step logic) is
deliberately OUT of scope for exactly this reason: the more power exposed, the
dicier it gets.

## Summary

| | Simple trigger | Complex trigger |
|---|---|---|
| type | match_start / match_end / anytime | same |
| condition | equality (`===`) only | single comparison (`> < >= <=`) |
| action | assign literal/ref, or `target +/× value` | flat arithmetic expr `( ) + − × ÷` |
| else | none | none (use another trigger) |
| nesting | none | none (flat only) |
| status | shipped | design concept |

A complex trigger is a simple trigger with two specific brakes released —
comparators in the condition, a flat arithmetic expression in the action — but
still bounded to a single, flat, else-less **TYPE + CONDITION + ACTION**.
