---
title: Tiebreak System (Module)
date: 2026-05-17
status: active
audience: developer + AI sessions
locked: true
---

> ## 🔒 LOCKED — DO NOT EDIT
>
> Before editing this file, read and apply the gate procedure in [Principle 7: Canonical-docs-as-policy](../../PRINCIPLES.md#7-canonical-docs-as-policy). The procedure requires explicit user invocation using specific gate-aware language; casual approvals are NOT sufficient.

# Tiebreak System

## Kind

**Tiebreak System is a [System](../../PRINCIPLES.md#system--deep-dive)-kind Module in the chain pattern (conditional fallthrough).** The LO configures an ordered list of atomic Tiebreak Mechanisms; each link runs only if the previous one failed to produce edge. The first link that does produce edge wins. A terminal human-handoff modal is **automatically appended to every chain** — the LO does not configure it — guaranteeing the chain always produces edge.

(Why this matters: PRINCIPLES § System § 4 names the **conditional fallthrough** chain sub-pattern — where each component runs only if the previous didn't produce a complete result — and cites this Module as its canonical example. The naming follows the singular-name rule for chain-pattern Systems per PRINCIPLES § Module § 9.)

## Essence

The **Tiebreak System** produces an **edge metric** — a single-valued indicator of which side gets the deciding nod — for the [Win Calculator](../win-calculator.md) to consume as the lowest-precedence metric in its decision stack. The System composes atomic Tiebreak Mechanism variants (coin flip, short race, roshambo, etc.) in an LO-configured chain. When fired, the chain runs through its links until one produces edge.

## Why the Tiebreak System exists

The [Win Calculator](../win-calculator.md) walks an ordered metric precedence stack to decide a match winner. When the stack runs out without producing a winner (all metrics tied), Win Calc has nothing left to decide on — unless edge is in the stack. The Tiebreak System exists to produce that edge metric, fired as a trigger when Win Calc's regular metrics tie out.

Different leagues have different cultural and operational preferences for *how* a tie should be broken — some want a single rack played; some want a coin flip; some want the teams to resolve it amongst themselves; some want roshambo because it's fast and traditional. The Tiebreak System exposes each of those as an atomic Mechanism variant; the LO chains them in their preferred fallback order.

## Boundary

The Tiebreak System is **only** the production of an edge metric when fired. It is **not**:

- The decision of *whether* to fire — that's [Win Calculator](../win-calculator.md)'s job (when its metric stack runs out with no winner, it fires this System).
- The metric precedence stack itself — that's [Win Calculator](../win-calculator.md)'s composition.
- The per-game tie-band rule (zero points awarded when teams tie at a threshold) — that's a [Points System](../points-system/README.md) calculator concern (see the locked `linear_above_threshold` rule).
- The season-aggregate standings sort — that lives **outside the modular Scoring System catalog entirely** as a separate Standings concern (architectural shape TBD via a future brainstorm; this Module does not touch it).

If a proposed feature changes *which method produces edge*, it belongs here as a new Tiebreak Mechanism variant. If it changes *when the Tiebreak System fires*, it belongs in Win Calculator. If it changes *how teams rank across the season when their match records tie*, it belongs in the Standings concern (outside this catalog).

## The chain — conditional fallthrough with guaranteed terminal handoff

The LO configures an ordered list of Tiebreak Mechanisms — a chain. The system **automatically appends a terminal human-handoff modal** to the chain at runtime (LO does not see or configure it). When the Tiebreak System fires:

1. Run the first LO-configured Mechanism in the chain.
2. If it produced edge, the Tiebreak System is done — edge goes back to Win Calc.
3. If it did NOT produce edge (e.g., a `single_round` Mechanism that itself ended tied), run the next configured Mechanism in the chain.
4. Repeat through every LO-configured link.
5. If all LO-configured links exhausted without edge, the auto-appended **terminal human-handoff modal** fires — using the same confirmation handoff/negotiation pattern used elsewhere for scoring-game confirmations. A human (the operator, or the teams' scorekeepers jointly, depending on the implementation pattern) picks the winner directly. Edge is produced. The chain always terminates.

Chain length is open. The same Mechanism may appear multiple times. Example chain: `single_round + coin_flip + coin_flip + roshambo` — try a single mini-round first; if tied, try two coin flips; finally roshambo; (and if even that somehow doesn't decide, the auto-terminal human modal does). The LO's chain CANNOT structurally fail to produce edge because the auto-terminal modal is always there to catch it.

**Empty LO chain is still a runnable configuration.** An LO who configures zero chain links effectively has a chain consisting of only the auto-appended terminal modal — every Win-Calc-triggered tie is resolved by direct human pick. The Tiebreak System still chains to runnable output per Principle 10; it just collapses to the terminal handoff.

## Catalog

The atomic Tiebreak Mechanisms this System composes:

| Variant | What it does | Edge production |
|---|---|---|
| [`coin_flip`](coin-flip.md) | RNG produces a 50/50 winner | Always — single trial decides |
| [`roshambo`](roshambo.md) | In-app rock-paper-scissors round between team representatives | Always — internal re-roll on a draw round |
| [`single_game`](single-game.md) | One rack of pool played between two selected players | Always — pool can't tie a rack |
| [`single_round`](single-round.md) | A short round (e.g., 4 pairings, each one rack) played as a mini-match | May tie out (then chain fallthrough) |
| [`race_to_n`](race-to-n.md) | A short race played between two selected players (LO sets N) | Always — race ends when one side hits N |
| [`manual`](manual.md) | Operator enters the result via dialog | Always — operator decides |
| [`teams_self_determine`](teams-self-determine.md) | Teams resolve amongst themselves (their own coin flip, race, talk) and report | Always — teams report a winner |

Plus the implicit **terminal human-handoff modal** (auto-appended; not LO-selectable; uses the same confirmation handoff/negotiation pattern as scoring-game confirmations).

The variant set is open; new Mechanisms add themselves to the chain configuration as they're built.

## How this Module interacts

**Upstream:**
- **[Win Calculator](../win-calculator.md)** — fires this System when its metric precedence stack ends with all metrics tied. Passes whatever runtime context the Mechanisms need (lineup data, match data, etc.).

**Downstream:**
- **[Win Calculator](../win-calculator.md)** — consumes the produced edge metric as the lowest-precedence metric in its stack. Win Calc then declares the match winner based on the team that received edge.

(Note: this Module both reads from and writes back to Win Calculator. That's not a circular dependency — Win Calc's metric-stack evaluator fires this System as a trigger, this System produces a value, Win Calc reads the value and continues its stack evaluation. The flow is sequential, not circular.)

## Validation invariants

| Invariant | Source of enforcement | Failure mode |
|---|---|---|
| Each Mechanism in the LO-configured chain is a known variant | application-layer validation of the chain configuration at preference-write time | preference write rejected with operator-facing error |
| Each Mechanism returns either edge-for-one-team OR a no-edge sentinel that triggers fallthrough | by construction (each variant's contract specifies which it produces; see variant pages) | regression test failure if a Mechanism returns ambiguous edge |
| The chain produces edge by the time it exhausts | by construction (the auto-appended terminal human-handoff modal is a deterministic edge-producer that runs after every LO-configured link) | not a real failure mode — guaranteed structurally |

## Future possibilities

- **LO-authored chain templates** — pre-built chains a new LO can pick from rather than configuring each link (e.g., "BCAPL Standard: single_round → coin_flip").
- **Per-Mechanism configuration** — some Mechanisms need their own settings (e.g., `race_to_n`'s N value). May warrant a `chain_link_config` shape that pairs a Mechanism with its config.
- **Cross-Mechanism game-source reuse** — when a `single_round` Mechanism plays games, those game outcomes are real match data. A future enhancement could allow Win Calc's metrics to consult that data even before the chain produces edge.
- **Stats-tracking integration** — when the future Standings concern is designed, tiebreaker outcomes may need to flow into personal stats (e.g., "wins-when-it-mattered" achievement). Cross-concern wiring TBD.

## Source of truth

This Module is new — it does not yet exist in code. Implementation will require:

- New preference column(s) describing the LO-configured chain (e.g., `tiebreak_chain JSONB` or a separate `tiebreak_chain_links` table)
- New runtime evaluator that walks the chain when Win Calc fires the trigger, with the terminal human-handoff modal auto-appended at evaluation time
- Per-Mechanism implementations matching the variant pages

Currently the closest existing code is the scattered tiebreaker-firing runtime hooks (`MatchEndVerification`, `computeMatchResult` in `bca3v3.ts`, `ManualTiebreakerDialog.tsx`). The implementation phase will consolidate these into the Tiebreak System chain evaluator. The auto-appended terminal modal will likely reuse the existing scoring-game confirmation handoff pattern.

**Anti-conflation note.** *"Tiebreak"* lowercase is the everyday-English noun (any tie-resolution act). *"Tiebreak Mechanism"* refers to an atomic variant (coin_flip, roshambo, etc.). *"Tiebreak System"* is this Module — the chain that composes those variants for an LO's league (per [PRINCIPLES § Module § 9](../../PRINCIPLES.md#9-naming-rule-plural-vs-singular)'s singular-naming rule for chain-pattern Systems).
