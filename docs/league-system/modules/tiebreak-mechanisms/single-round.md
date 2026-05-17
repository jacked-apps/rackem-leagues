---
title: Single Round (Tiebreak Mechanism Variant)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Single Round

A variant of [Tiebreak Mechanisms](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

A short round of pool — typically one rack per active player per team (e.g., 4 pairings in a 4v4 mini-round; 3 pairings in a 3v3). The team that wins more racks in the round gets edge. This Mechanism *may itself tie out* (e.g., 2-2 in a 4-rack round) — in which case the chain falls through to the next configured Tiebreak Mechanism.

## I/O contract

**Input:** the match context plus a player-selection scheme (default: same lineups as the regular match). May honor or skip handicap per Mechanism config.

**Output:** edge metric assigned to the team with more rack wins in the round, OR "no edge produced" if the round itself ends tied. The "no edge" case triggers conditional fallthrough to the next chain link.

## Status

Stub. Not yet implemented. The Pairings Generator chain pattern (per its blueprint) already covers generating the slot list for a short round — implementation likely reuses Pairings Generator with mini-match parameters.
