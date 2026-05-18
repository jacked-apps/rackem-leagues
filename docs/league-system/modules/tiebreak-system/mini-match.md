---
title: Mini Match (Tiebreak Mechanism)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Mini Match

A variant of the [Tiebreak System](README.md) — a Mechanism that **composes [Pairings Generator](../pairings-generator.md) + Threshold Trigger** to play a short round of pool with a stop-condition that produces edge.

Per PRINCIPLES, this is technically a small [System](../../PRINCIPLES.md#system--deep-dive) (composes existing Modules), but it satisfies the same chain-link contract as the atomic Mechanisms ([coin_flip](coin-flip.md), [roshambo](roshambo.md), [human_pick](human-pick.md)) — produce edge OR fall through to the next chain link.

## What it is

A short round of pool is played using the **same lineups** the regular match used, with a configurable **round shape** (how many games) and **stop threshold** (when one team has won enough to end the round). The trigger that fires when the stop threshold is reached awards edge to the leading team and ends the tiebreak. The round may also complete without the threshold firing (e.g., the trigger watches for "first to 2 wins" but the round is only 3 games and ends 1-1 with one game ungranted) — in which case Mini Match returns the no-edge sentinel and the Tiebreak System chain falls through to the next link.

## I/O contract

**Input:** the match context, the two locked lineups, plus configuration:
- **`round_shape`** — how many games in the mini-round. Examples: `3` (three games — used by Points 3-Man's current `best_of_3_short_race`), `5`, `7`, or `1` (a single game).
- **`stop_threshold`** — when one team reaches this win count, the trigger fires. Examples: `2` (best-of-3 stops at 2 wins), `3` (best-of-5 stops at 3), `1` (single game — first win takes it).
- **`pairing_shape`** — how the players in the mini-round are paired. Likely a sub-shape of the existing [Pairings Generator](../pairings-generator.md) (a short round-robin, a race-style single pairing, etc.).

**Output:** edge metric assigned to the team that reached the stop threshold first, OR a no-edge sentinel if the round completed without the threshold firing (triggers chain fallthrough).

## How it works

1. **Pairings Generator** (with mini-match config) produces the slot list for the short round, using the same lineups as the regular match.
2. The slots are played as normal scored games (the existing scoring runtime fills them in).
3. A **Threshold Trigger** (the canonical pattern documented in PRINCIPLES § System § 5) watches the running per-team win count.
4. When a team's win count hits `stop_threshold`:
   - The trigger fires.
   - **Award edge** to that team.
   - **End the tiebreak** (remaining games in the round are skipped — they don't matter; the match is decided).
5. If the round's games are all played without the trigger firing (rare, but possible with the right `round_shape` + `stop_threshold` combination), the Mini Match returns the no-edge sentinel and the chain falls through.

The parent [Win Calculator](../win-calculator.md) re-evaluates its metric stack once edge is produced, sees `edge` is now populated, and declares the team with edge as the match winner.

## Configurations covered

- **`best_of_3_short_race`** (Points 3-Man's current shipping format): `round_shape=3`, `stop_threshold=2`. Three games played; first team to 2 wins takes the match. Third game may be skipped if the second decides the series.
- **`single_game`**: `round_shape=1`, `stop_threshold=1`. One game played; the winner takes the match. Pool can't tie a single rack, so this always produces edge.
- **`race_to_n`** (variable): `round_shape=N`, `stop_threshold=⌈N/2⌉+1`. Effectively a short race; first team to win the majority takes the match.

The catalog deliberately does NOT proliferate one Mechanism per shape — these are all the same Mechanism with different `(round_shape, stop_threshold)` config.

## Status

Stub. Not yet implemented. The closest existing code is the hardcoded `bca3v3.ts` tiebreaker logic (games 19-21 for the 3v3 best-of-3) which the implementation pass will replace. Mini Match's implementation will reuse the Pairings Generator's mini-match invocation path and the Threshold Trigger pattern.

**Lineup ordering matters and is handled by the underlying Pairings Generator's mini-match config** — Mini Match itself doesn't decide who plays whom; it asks PG to produce the slot list using the same lineups as the regular match, with whatever mini-round ordering the Pairings Generator implements for that configuration.
