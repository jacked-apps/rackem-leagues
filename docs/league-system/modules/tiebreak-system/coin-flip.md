---
title: Coin Flip (Tiebreak Mechanism)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Coin Flip

A variant of the [Tiebreak System](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

A 50/50 RNG draw produces edge for one side. Fastest possible resolution; zero pool play involved. Suitable for leagues that prioritize finishing on time over competitive resolution, or as a fallback link in a longer tiebreak chain.

## I/O contract

**Input:** the match context (which two teams are tied). No additional configuration.

**Output:** edge metric assigned to one team. Always single-valued — a coin flip cannot tie.

## Status

Stub. Not yet implemented. Full design (RNG source, seed persistence for reproducibility, UI surface for the result reveal) is implementation-phase work.
