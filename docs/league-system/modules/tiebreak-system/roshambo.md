---
title: Roshambo (Tiebreak Mechanism)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Roshambo

A variant of the [Tiebreak System](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

An in-app rock-paper-scissors round between team representatives. Two players (one per team — selection method is a Mechanism-internal sub-concern, typically captain) each pick rock / paper / scissors via the app; the round resolves per standard RPS rules. Fast, traditional, and has a tiny skill/psychology component (better than pure RNG).

## I/O contract

**Input:** the match context, plus a way to identify which player from each team participates (defaults to team captain).

**Output:** edge metric assigned to one team. Always single-valued — the Mechanism re-rolls internally on a draw round (both picked the same) until edge is produced.

## Status

Stub. Not yet implemented. Requires new in-app UI for the simultaneous pick-and-reveal flow. Implementation cost is small because each Mechanism is independent — adding this doesn't touch any other Module.
