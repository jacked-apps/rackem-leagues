---
title: Human Pick (Tiebreak Mechanism)
date: 2026-05-17
status: stub
audience: developer + AI sessions
---

# Human Pick

A variant of the [Tiebreak System](README.md) — a [Mechanism](../../PRINCIPLES.md#mechanism--deep-dive)-kind Module.

## What it is

The two teams' scorekeepers resolve the tiebreak amongst themselves — by whatever method they choose (their own coin flip, their own race, their own captains' talk, the venue's house rules, etc.) — and report the winner to the app via an in-app prompt. The app accepts the reported winner and produces edge.

The accountability model is **teams decide, teams report.** The operator (LO) is intentionally NOT in the loop for this Mechanism — LOs shouldn't be doing match-night dispute resolution work. Teams handle their own tiebreakers and self-report.

## I/O contract

**Input:** the match context, presented to the teams' scorekeepers via a dialog. Both scorekeepers may need to confirm the same answer before edge is recorded (implementation detail TBD — single-confirm vs. both-must-agree is a parameter).

**Output:** edge metric assigned to the team the scorekeepers selected. Always single-valued — the dialog constrains the response to one team.

## Status

Stub. Not yet implemented. The existing `src/components/scoring/ManualTiebreakerDialog.tsx` (legacy of the prior `tiebreaker_format='manual'` preference, before the Tiebreak System refactor) may provide reusable UI scaffolding — the new Mechanism targets the teams' scorekeepers rather than the operator. The prior `manual` Mechanism (operator-decides) was deliberately removed during the Tiebreak System slimming pass; we don't want operators doing this work.
