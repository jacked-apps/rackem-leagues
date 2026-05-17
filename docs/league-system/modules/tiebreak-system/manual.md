---
title: Manual (Tiebreak Mechanism Variant)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Manual

A variant of the [Tiebreak System](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

The operator enters the tiebreaker result directly via a dialog (winner team, plus any score adjustments). Used when the league's tiebreaker rule isn't pre-codified — e.g., "the captains rock-paper-scissors in real life," "the host venue's house rules apply," "we defer to the prior match's winner." A catch-all escape hatch for leagues with idiosyncratic rules.

## I/O contract

**Input:** the match context, presented to the operator via a dialog.

**Output:** edge metric assigned to the team the operator selected. Always single-valued — the operator's response is constrained to one team.

## Status

Already partially implemented in code — `src/components/scoring/ManualTiebreakerDialog.tsx` is the current operator-facing surface (per the old S&T `tiebreaker_format='manual'` setting). The Tiebreak System integration will route to this existing dialog when the `manual` Mechanism runs in a chain.
