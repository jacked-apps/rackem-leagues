---
title: Trigger (v2 — candidate)
date: 2026-05-20
status: candidate
locked: false
audience: developer + AI sessions
---

# Trigger (v2)

> **Status: candidate replacement, in the locking process — NOT yet canonical.**
> This doc replaces the scattered, mis-framed trigger content in the locked docs
> (Points System README sub-mechanism (B) "Threshold trigger"; PRINCIPLES
> § System § 5). It exists because we found a FUNDAMENTAL flaw in that content —
> a false coupling baked into the model — not a typo or a missing operator. It
> must pass the full cold-read process before it locks. It also supersedes the
> exploratory `complex-trigger.md`.

## The flaw in v1

The old model coupled two independent things:

- It named the sub-mechanism **"Threshold trigger"** and gave the trigger a
  dedicated **threshold input slot** (`input.thresholdRef` + an `inputSpec`
  shape-contract). That framing said: a trigger is bound to a threshold.
- It isn't. A threshold and a trigger are **independent primitives** that
  communicate only through shared match state. A trigger reads state; it does
  not care where the state came from. Binding a trigger to a specific threshold
  is like insisting a `useEffect` must contain an `if` — it often does, but
  requiring it calcifies a dependency that isn't real.

v2 removes the coupling. There is no threshold input slot. A trigger reads and
writes the **state bag** by name, full stop.

## Anatomy

v2 keeps the canonical four sub-mechanisms from PRINCIPLES § System § 5 — a
Trigger is a System, not an atom — and gives them author-facing names:

| Canonical sub-mechanism | Author-facing part | Job |
|---|---|---|
| Event acceptor | **TYPE + CONDITION** | what to watch + when |
| Event detector | (the engine) | does the watching — not author-configured |
| Task performer | **ACTION** | what to do when it fires |
| Re-armer | **RE-ARM** | whether/when it fires again |

Plus two properties every trigger carries: **ORDER** (a fire-order number + a
before/after-allocator bool) and **DISPLAY** (label + target value for the UI).

Read together it's an if/then: *given the TYPE's timing, IF the CONDITION holds,
THEN run the ACTION; the RE-ARM decides whether it can fire again.* There is no
`else` — if the condition is false, nothing happens.

## TYPE — the three types

- **match_start** — fires immediately at match start. Pass-through triggers
  (e.g. initial points) use this with an always-true condition.
- **match_end** — fires after all games are played OR the end chip (endmatch) is
  received. Covers both a natural finish AND an early clinch (race-to-X).
- **anytime** — evaluated per-game during play; fires whenever its condition
  holds (subject to RE-ARM). ("anytime" = during the body of the match, between
  start and end — not literally start/end.)

TYPE is orthogonal to CONDITION. "match_end + a comparison" is just
`type=match_end` with one flat comparison — NOT a compound condition.

> *Naming:* "match" = the whole set of games; a "game" is one rack. These types
> fire at MATCH boundaries — hence match_start / match_end.

## Threshold = state setter (runs first). Trigger = state consumer.

The two primitives are decoupled, connected only by the **state bag** (the
universal match-state namespace — PRINCIPLES, Composability):

- A **threshold** computes a value and **writes it into state** under a name
  (`winTarget`, `tieTarget`, …). It is a **state setter**.
- **Thresholds always run FIRST, at match start, unconditionally.** There are NO
  conditional thresholds — a threshold has no `when`; it always runs and always
  sets its var (the var may hold `0` or `null` from internal computation, but
  that's branching MATH inside the operation, not a gate on whether it runs).
  Think of thresholds as state set at the top of scope, before the body.
- A **trigger** reads state in its condition and reads/writes state in its
  action. It references state vars **by name** and has no idea which primitive
  set them.

This fixes the runtime ordering: **thresholds resolve → then triggers fire.** A
match_start trigger reading `winTarget` is safe because `winTarget` was set
first.

**The "Threshold Trigger pattern" is still a valid PATTERN** (a threshold sets a
value + a trigger reads it = a common composition). But it is a *pattern of two
independent primitives*, not a single bound thing. Anything conditional or
mid-match is a TRIGGER by definition — never a threshold.

## CONDITION — a single flat comparison

ONE flat comparison between state vars and/or constants:

```
home_wins === winTarget
home_wins  >  winTarget
games_played < total_games
```

Operators: `===`, `>`, `<`, `>=`, `<=`. **One comparison** — no compound
`AND`/`OR`, no range checks like `T <= x <= W`. If you reach for a compound
condition, flatten it — see "No nesting."

**Always-true** is an explicit condition value (`always`), not an omitted field —
every trigger has a condition slot, even pass-throughs. A match_start initial-
points trigger is `condition: always`.

## ACTION — write one state var via a flat expression

```
home_points = home_points + 1.5
home_points = (home_wins - winTarget) * multiplier
edge        = 'home'
endmatch    = true
```

- Writes ONE state var. (Two effects on one event = two triggers, same condition.)
- Operands: state vars, constants. Operators: `(`, `)`, `+`, `−`, `×`, `÷`. A
  single flat expression — no branching inside it.
- **`÷` zero-guard:** divide-by-zero **throws** (fail loud); the builder warns
  when a trigger uses `÷`. In JS `x/0`=`Infinity`, `0/0`=`NaN`, which silently
  poison downstream math, so a raw result never escapes. `+`/`−`/`×` need no guard.

## RE-ARM — whether the trigger fires again

Default and modes (canonical Re-armer, PRINCIPLES § System § 5):

- **single-shot (default)** — fires ONCE per match, then never again. This is
  why a normal trigger is a "once" action; a milestone bonus fires the one time
  its count is reached.
- **periodic** — re-arms after firing, so it can fire again on a later tick (the
  pattern a per-game effect would use).
- **manual reset** — re-arms only when another trigger/condition resets it.

Re-arm is what controls firing frequency — NOT the condition. Without it, an
`anytime` trigger whose condition stays true (`home_wins > winTarget`) would be
ambiguous; single-shot makes it fire once.

## ORDER — fire-order number + before/after-allocator bool

Every trigger is assigned two things at creation:

- a **number** — its position in the fire order (ascending: 1 fires first)
- a **bool — "before the per-game allocator?"** — `true` = fires before the
  allocator; `false` = after

The per-game allocator is a fixed **pivot**, NOT sorted into the number line — it
never needs a number. Each per-game (anytime) trigger declares which side of the
pivot it fires on (the bool) and its order within that side (the number).

**Sort rule: bool is the PRIMARY key, number is SECONDARY.** Partition by bool
first (before-group → allocator → after-group), then sort each group by number
ascending. It is NOT a global number sort. The per-game fire sequence is:

```
[ anytime triggers, before=true, sorted by number ]
        → per-game allocator →
[ anytime triggers, before=false, sorted by number ]
```

Numbers only ever compare WITHIN a group, so interleaved numbers across groups
are fine — e.g. before={1,3,5}, after={2,4} resolves to `1, 3, 5 → allocator →
2, 4`. (A global number sort would be impossible: numbers 1-before, 2-after,
3-before would demand the allocator run both after 2 and before 3. The
bool-first partition avoids that — the number is unique only so within-group
order is deterministic; its absolute value is irrelevant.)

- **match_start / match_end are separate phases** — the bool is moot for them
  (they're inherently before/after all per-game activity).
- **Same-event triggers resolve by number** within their side (give-points lower
  number than end-match, so it runs first and isn't negated).
- **endmatch-not-last → soft flag.** An endmatch trigger that isn't last in its
  side's order gets a build WARNING — firing it there negates the triggers below
  it. Usually a mistake, but it MIGHT be what the LO wants, so it's a flag, not a
  hard error. (The `endmatch` flag it sets stops FUTURE games; within-tick order
  is the number sort.)
- **Mirrored (home/away) order is a don't-care.** Whether the home or away
  trigger of a symmetric pair fires first doesn't affect correctness.

(That the allocator is a fixed pivot — not just another numbered trigger — is a
small point in favor of it staying a distinct primitive; see the open per-game
question below.)

## DISPLAY — UI contract (kept for canonical-compat; likely belongs elsewhere)

PRINCIPLES § System § 5 (lines 606-611) says every Trigger exposes a display
contract:

- **Label** — short text (e.g. *"win"*, *"1.5 bonus"*)
- **Target value** — the value being watched (e.g. `11`, `1.5`)
- **Status** — active / met / not-yet-met (lets the scoreboard sort by proximity)
- *(optional)* description, icon, ordering hint

**Open question — does display belong on the trigger at all?** A trigger is
purely an if/then that changes state; you don't "trigger" a scoreboard item.
Display is a SCOREBOARD concern, and the displayable labels logically belong on
the **thresholds** that hold the values (`winTarget = 11` labeled "win"), not on
the triggers — possibly in a dedicated display module later. This looks like a
second misplacement in the canonical model, the same shape as the
threshold-coupling flaw.

For now, display is exposed via the state bag; this contract is kept here for
canonical-compatibility but is **minor and unused** — flagged as a likely
relocation (display → thresholds / scoreboard) when revisited.

## Two hard constraints

### 1. No `else`

A trigger fires or it doesn't. The opposite case is a SEPARATE trigger with the
inverse condition. Keeps each trigger atomic — one condition, one outcome.

### 2. No nesting

Neither condition nor action may contain an if/then — no `(a > b ? x : y)`, no
branching in an expression, no compound conditions.

**A nested condition means you're solving it in the wrong place.** Two ways to
flatten:

1. **Push the decision into a threshold (primary).** A threshold may compute
   conditionally and resolve the right TARGET value; the trigger then uses that
   number with no choosing (e.g. a `pointTarget` threshold → trigger is a single
   flat `points = games_won - pointTarget`).
2. **Split into separate triggers (fallback).** When the branches do genuinely
   different ACTIONS, write one flat trigger per branch.

## The end-of-match aggregate is expressible as match_end triggers

The locked model has a distinct canonical sub-mechanism — **(D) end-of-match
aggregate.** v2 does NOT remove it. v2 only shows its logic expresses as
match_end triggers, so it's not architecturally *distinct* from a trigger:

```
type: match_end   IF home_wins > winTarget   THEN home_points = (home_wins - winTarget) * multiplier
type: match_end   IF home_wins < tieTarget   THEN home_points = (home_wins - tieTarget) * multiplier
(tie band: neither fires → home_points keeps its default 0)
```

(Per-side: declare the matching pair for the away side.) No compound condition,
no nesting, no `else` — reproduces the locked 3-band behavior exactly.

**Deprecating (D) is a SEPARATE downstream step**, not part of enstating v2.
Until then the EOGA remains canonical and the locked docs continue to describe
it. v2 establishes only that the trigger model *can* absorb it.

## The per-game allocator — possibly a periodic trigger (open)

The per-game allocator (sub-mechanism (A)) is NOT folded into triggers here. It
differs from a trigger today: it has **no condition** (it just fires every game)
and it **collects scorer inputs**. A **periodic** re-arm + input handling MIGHT
let a trigger absorb it — but that's an open evaluation, deliberately AFTER
locking v2 and assessing EOGA. v2 leaves (A) standing.

## There is no separate "complex trigger"

There is just **the trigger** — comparators in the condition, a flat arithmetic
expression in the action. The genuinely complex thing (nested if/thens, `else`,
multi-step logic) is deliberately **out of scope** ("super complex") — too
dangerous for non-coder authoring. A separate, deliberate decision if ever needed.

## Safety lives in the authoring UI, not a schema contract

v1's `inputSpec` shape-contract is dropped — it was scaffolding for the false
1:1 binding and merely re-declared what the condition already names. The real
safety is the **constrained, ESLint-style builder**:

- Build a threshold = "set me a state" (named state var).
- Build a trigger = pick from a LIST of available states + allowed operators —
  can't reference a non-existent/mistyped var.
- "State set but never used" → orphan warning.
- "State read before it's set" → write-before-read warning.

Earlier and stronger than a build-time shape-check. The only thing nothing
catches is picking a valid-but-wrong state (a logic error) — that's what a
preview/test pass is for.

## Summary

| Part | What it is |
|---|---|
| TYPE | match_start / match_end / anytime |
| CONDITION | one flat comparison (`=== > < >= <=`), or always-true |
| ACTION | write one state var via a flat expression (`( ) + − × ÷`, state vars, constants) |
| RE-ARM | single-shot (default) / periodic / manual reset |
| ORDER | fire-order number + "before per-game allocator?" bool (allocator is a fixed pivot); endmatch flagged if not last |
| DISPLAY | label + target + status for the UI (minor/unused; likely relocates to thresholds/scoreboard) |
| else | none (use another trigger) |
| nesting | none (push to a threshold, or split triggers) |
| threshold coupling | none — threshold sets state, trigger reads state, decoupled via the bag |

A trigger is a single flat **TYPE + CONDITION + ACTION (+ RE-ARM, ORDER,
DISPLAY)** that reads and writes shared match state. Thresholds set state first;
triggers consume it; nothing binds them but the state bag.
