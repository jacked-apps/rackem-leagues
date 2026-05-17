---
title: Tiebreak Mechanisms (Module)
date: 2026-05-17
status: active
audience: developer + AI sessions
---

# Tiebreak Mechanisms

## Kind

**Tiebreak Mechanisms is a [System](../../PRINCIPLES.md#system--deep-dive)-kind Module that composes [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind alternatives in a conditional-fallthrough chain.** The LO configures an ordered list of Tiebreak Mechanisms; each link runs only if the previous one failed to produce edge. The first link that does produce edge wins.

(Why this matters: the chain pattern in PRINCIPLES § System § 4 traditionally describes Systems where *all* components run together (e.g., Points System). This Module is a slight variation — a **conditional fallthrough** where each component runs only when needed. Worth noting because the pattern surfaces here for the first time.)

## Essence

A **tiebreak mechanism** produces an **edge metric** — a single-valued indicator of which side gets the deciding nod — for the [Win Calculator](../win-calculator.md) to consume as the lowest-precedence metric in its decision stack. Each Mechanism in the chain is one method for producing edge: a coin flip, a short race, a roshambo round, an operator-entered decision, etc. The Mechanism's only job is to produce edge; nothing else.

## Why Tiebreak Mechanisms exist

The [Win Calculator](../win-calculator.md) walks an ordered metric precedence stack to decide a match winner. When the stack runs out without producing a winner (all metrics tied), Win Calc has nothing left to decide on — unless edge is in the stack. The Tiebreak System exists to produce that edge metric, fired as a trigger when Win Calc's regular metrics tie out.

Different leagues have different cultural and operational preferences for *how* a tie should be broken — some want a single rack played; some want a coin flip; some want the teams to resolve it amongst themselves; some want roshambo because it's fast and traditional. Tiebreak Mechanisms exposes each of those as an atomic Mechanism variant. The LO chains them in their preferred fallback order.

## Boundary

A tiebreak mechanism is **only** the production of an edge metric when fired. It is **not**:

- The decision of *whether* to fire — that's [Win Calculator](../win-calculator.md)'s job (when its metric stack runs out with no winner, it fires this System).
- The metric precedence stack itself — that's [Win Calculator](../win-calculator.md)'s composition.
- The per-game tie-band rule (zero points awarded when teams tie at a threshold) — that's a [Points System](../points-system/README.md) calculator concern (see the locked `linear_above_threshold` rule).
- The season-aggregate standings sort — that lives **outside the modular Scoring System catalog entirely** as a separate Standings concern (architectural shape TBD via a future brainstorm; this Module does not touch it).

If a proposed feature changes *which method produces edge*, it belongs here as a new Mechanism variant. If it changes *when the Tiebreak System fires*, it belongs in Win Calculator. If it changes *how teams rank across the season when their match records tie*, it belongs in the Standings concern (outside this catalog).

## The chain — conditional fallthrough

The LO configures an ordered list of Tiebreak Mechanisms — a chain. When the Tiebreak System fires:

1. Run the first Mechanism in the chain.
2. If it produced edge, the Tiebreak System is done — edge goes back to Win Calc.
3. If it did NOT produce edge (rare; e.g., a `single_round` Mechanism that itself ended tied), run the next Mechanism in the chain.
4. Repeat until edge is produced or the chain is exhausted.

Chain length is open. The same Mechanism may appear multiple times. Example chain: `single_round + coin_flip + coin_flip + roshambo` — try a single mini-round first; if tied, try two coin flips; finally roshambo. Including at least one deterministic edge-producer in the chain (e.g., `coin_flip`, `manual`, `teams_self_determine`) guarantees the chain terminates with edge.

## Variants index

| Variant | What it does | Edge production |
|---|---|---|
| [`coin_flip`](coin-flip.md) | RNG produces a 50/50 winner | Always — single trial decides |
| [`roshambo`](roshambo.md) | In-app rock-paper-scissors round between team representatives | Usually single trial decides; re-roll on draw |
| [`single_game`](single-game.md) | One rack of pool played between two selected players | Always — pool can't tie a rack |
| [`single_round`](single-round.md) | A short round (e.g., 4 pairings, each one rack) played as a mini-match | May tie out (then chain fallthrough) |
| [`race_to_n`](race-to-n.md) | A short race played between two selected players (LO sets N) | Always — race ends when one side hits N |
| [`manual`](manual.md) | Operator enters the result via dialog | Always — operator decides |
| [`teams_self_determine`](teams-self-determine.md) | Teams resolve amongst themselves (their own coin flip, race, talk) and report | Always — teams report a winner |

The set is open; new Mechanisms add themselves to the chain configuration as they're built.

## How this Module interacts

**Upstream:**
- **[Win Calculator](../win-calculator.md)** — fires this System when its metric precedence stack ends with all metrics tied. Passes whatever runtime context the Mechanisms need (lineup data, match data, etc.).

**Downstream:**
- **[Win Calculator](../win-calculator.md)** — consumes the produced edge metric as the lowest-precedence metric in its stack. Win Calc then declares the match winner based on the team that received edge.

(Note: this Module both reads from and writes back to Win Calculator. That's not a circular dependency — Win Calc's metric-stack evaluator fires this System as a trigger, this System produces a value, Win Calc reads the value and continues its stack evaluation. The flow is sequential, not circular.)

## Validation invariants

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| Each Mechanism in the chain is a known variant | application-layer validation of the chain configuration | preference write rejected with operator-facing error |
| The chain is non-empty when Win Calc's stack includes edge | application-layer combo coherence | warning at LO setup; runtime falls back to `'accept_tie'` semantics if Win Calc fires this System with an empty chain |
| At least one Mechanism in the chain is a deterministic edge-producer | application-layer combo coherence (advisory) | warning at LO setup; runtime may exhaust the chain without producing edge, in which case it falls back to `'accept_tie'` semantics |
| Edge produced is single-valued (assigned to exactly one team) | by construction (each Mechanism's contract specifies this) | regression test failure if a Mechanism returns ambiguous edge |

## Future possibilities

- **LO-authored chain templates** — pre-built chains a new LO can pick from rather than configuring each link (e.g., "BCAPL Standard: single_round → coin_flip").
- **Per-Mechanism configuration** — some Mechanisms need their own settings (e.g., `race_to_n`'s N value). May warrant a `chain_link_config` shape that pairs a Mechanism with its config.
- **Cross-Mechanism game-source reuse** — when a `single_round` Mechanism plays games, those game outcomes are real match data. A future enhancement could allow Win Calc's metrics to consult that data even before the chain produces edge.
- **Stats-tracking integration** — when the future Standings/Statistics concern is designed, tiebreaker outcomes may need to flow into personal stats (e.g., "wins-when-it-mattered" achievement). Cross-concern wiring TBD.

## Source of truth

This Module is new — it does not yet exist in code. Implementation will require:

- New preference column(s) describing the LO-configured chain (e.g., `tiebreak_chain JSONB` or a separate `tiebreak_chain_links` table)
- New runtime evaluator that walks the chain when Win Calc fires the trigger
- Per-Mechanism implementations matching the variant pages

Currently the closest existing code is the scattered tiebreaker-firing runtime hooks (`MatchEndVerification`, `computeMatchResult` in `bca3v3.ts`, `ManualTiebreakerDialog.tsx`). The implementation phase will consolidate these into the Tiebreak System chain evaluator.

**Anti-conflation note.** *"Tiebreak"* lowercase is the everyday-English noun (any tie-resolution act). Capitalized *"Tiebreak Mechanism"* or *"Tiebreak System"* refers to this Module specifically (per [PRINCIPLES § Module § 9](../../PRINCIPLES.md#9-naming-rule-plural-vs-singular)).
