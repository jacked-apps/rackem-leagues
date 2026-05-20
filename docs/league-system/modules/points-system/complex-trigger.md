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
> the trigger schema to allow formulas in both the `when` and the `action`.

## A trigger is an if/then statement

Every trigger is fundamentally:

```
IF (when) THEN (action)
```

That's it. A condition, and a thing to do when the condition is true. There is
no `else` — if the condition is false, nothing happens.

## Simple trigger (shipped today)

A **simple trigger** is the restricted form currently in code:

- **when** — an EQUALITY check only. e.g. `home_wins === n` (where `n` is the
  value from a single bound threshold), or a timing condition (`receipt`,
  `match_end`).
- **action** — ASSIGN a fixed value or a reference. The value is a literal
  (`1.5`, `'home'`, `true`), the bound input (`n`), or another variable's
  current value. No math.

Example: *"when home reaches the win target, set home_points to 3.0."*

```
IF   home_wins === winTarget
THEN home_points = 3.0
```

Simple triggers are easy to author and hard to get wrong. They're the default
tier in the LO trigger builder.

## Complex trigger (the concept)

A **complex trigger** is the FULL if/then statement — both halves may be a
function/formula:

- **when** — a SINGLE comparison, not just equality. e.g.
  `home_wins > winTarget`, `games_played < total_games`. ONE flat comparison —
  no compound `AND`/`OR`, no range checks like `T <= x <= W`. If you think you
  need a compound condition, that's a signal to push the logic elsewhere (see
  "No nesting" below).
- **action** — a computed value via a registered OPERATION, not just an
  assignment. e.g. `home_points = (home_wins - winTarget) * multiplier`.
  **The formula is a registered operation** (operation_kind + args), shown here
  in readable form — NOT free-form math an LO types into a box. Same
  data-driven pattern as thresholds and allocator formulas: the math lives in
  code, the args are data.

Example: *"when home finishes above the win target, award the overage times
the multiplier."*

```
IF   home_wins > winTarget
THEN home_points = (home_wins - winTarget) * multiplier
```

Both the `when` and the `action` are formulas. That's the entire difference
from a simple trigger: **a complex trigger lets a formula run in the condition
AND in the action.**

## Two hard constraints

A complex trigger is a FULL if/then — but a BOUNDED one. Two rules keep it from
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

The formulas are FLAT. Neither the `when` nor the `action` may contain an
if/then inside it — no `(a > b ? x : y)`, no branching within an expression, no
compound/range conditions in the `when`.

**If you think you need a nested `when`, you're solving it in the wrong place.**
A nested condition is a signal — move the decision OUT of the trigger. Two ways
to flatten it:

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
`when` should never live inside a single trigger.**

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
| `when` | equality / timing only | full boolean formula |
| `action` | assign literal / reference | computed formula |
| `else` | n/a (none) | none (use another trigger) |
| nesting | n/a | none (flat formulas only) |
| status | shipped | design concept |

A complex trigger is a simple trigger with the brakes off in two specific
places — formulas allowed in the condition and the action — but still bounded
to a single, flat, else-less if/then.
