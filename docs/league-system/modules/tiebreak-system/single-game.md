---
title: Single Game (Tiebreak Mechanism)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Single Game

A variant of the [Tiebreak System](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

One rack of pool played between two selected players (one per team). Player selection is Mechanism-internal (random / captain choice / etc. — configurable). The rack's winner gets edge. Adds a skill component back into tie resolution while keeping extra-play overhead to a single game.

## I/O contract

**Input:** the match context, plus the two selected players, plus any per-game configuration (apply handicap to the rack or not — typically not, since tiebreaker games are short by design).

**Output:** edge metric assigned to the team whose player won the rack. Always single-valued — pool can't tie a rack.

## Status

Stub. Not yet implemented. Builds on the existing scoring runtime — a tiebreaker single rack is a normal scored game with elevated `game_number`. The runtime hooks for filing and scoring that game already exist (used by the current hardcoded best-of-3 in `bca3v3.ts`); the Tiebreak System integration will replace the hardcoded firing.
