---
title: Teams Self-Determine (Tiebreak Mechanism Variant)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Teams Self-Determine

A variant of [Tiebreak Mechanisms](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

The two teams resolve the tiebreaker amongst themselves — by whatever method they choose (their own coin flip, their own race, their own captains' talk, etc.) — and report the winner to the app. Functionally similar to [manual](manual.md) but with a distinct accountability model: *the teams* decide rather than the LO. The app presents a "report tiebreaker winner" prompt to the teams' scorekeepers rather than to the LO.

## I/O contract

**Input:** the match context, presented to the teams' scorekeepers via a dialog. May require both teams to agree on the same answer before edge is recorded.

**Output:** edge metric assigned to the team the scorekeepers selected.

## Status

Stub. Not yet implemented. Closely related to [manual](manual.md) but with a different UI flow (teams agree, then report) and a different accountability boundary. May share UI scaffolding with `ManualTiebreakerDialog` at implementation time.
