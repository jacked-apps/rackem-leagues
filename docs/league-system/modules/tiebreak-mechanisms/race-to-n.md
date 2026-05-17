---
title: Race to N (Tiebreak Mechanism Variant)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Race to N

A variant of [Tiebreak Mechanisms](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

A short race played between two selected players (one per team). First to N rack wins takes edge. N is Mechanism-internal config (typically 3 or 5 — short enough to fit a tiebreaker window, long enough to be more decisive than a single game). Higher skill fidelity than single-game, lower overhead than full match replay.

## I/O contract

**Input:** the match context, the two selected players, the race target N, plus handicap-honor configuration.

**Output:** edge metric assigned to the team whose player reached N first. Always single-valued — a race ends when one side hits N.

## Status

Stub. Not yet implemented. Builds on the same scored-game infrastructure as single-game. Race-to-N race semantics already partially exist in the Match Format `race_to_n` pairing format (per its blueprint); the Tiebreak System integration likely reuses that infrastructure with the race scoped to one pairing rather than the whole match.
