---
title: Locked-Doc Revision Protocol
date: 2026-05-23
status: active
audience: AI sessions + expert dev
---

# Locked-Doc Revision Protocol

Companion to [PRINCIPLES.md § 7 — Canonical-docs-as-policy](PRINCIPLES.md#7-canonical-docs-as-policy). § 7 defines the **unlock ritual** for editing a LOCKED file; this doc defines the **revision workflow** that produces the content that ritual swaps in. Read both before touching any LOCKED `docs/league-system/` file.

## Why this exists

Locked docs are policy contracts (§ 7) — the hard-lined scaffolding the modular Scoring System hangs on. Editing them in place during design produces **drift**, and drift is what previously made the modular/tinker goal unbuildable. This protocol keeps the locked canon stable while a revision is designed, and forces the new content to prove it still fits the whole locked-doc puzzle before it is locked.

## The workflow

### 1. Draft alongside — never edit the locked doc during design
Create `<name>-v2.md` beside the locked `<name>.md`, **unlocked** (`status: draft`, NO 🔒 banner — lock only finished docs). All design churn happens in the draft; the locked original stays canon until swap.

### 2. Surgical-diff discipline — the draft is v1 + only the deltas
The draft is the locked v1 **verbatim**, with **only** the specific changes applied, each for a stated reason:
- Preserve every untouched section **byte-for-byte**.
- Rewrite a section only where a delta demands it.
- Stay in v1's register (a different voice is itself a puzzle-fit break — see [Register](#register)).

Verify with `diff <name>.md <name>-v2.md`: the diff must equal the delta list and nothing more.

**Why surgical, not from-scratch:** v1 already fits the locked-doc puzzle (it passed the locks). A from-scratch rewrite must re-establish fit across **every** locked doc — high drift risk, likely fails the gate. v2 = v1 + surgical deltas inherits v1's fit; only the deltas need validating.

### 3. Carry an explicit delta list (draft-only)
The draft holds a "Changes vs the locked v1" section enumerating every change + reason. It is review scaffolding; **remove it at swap** — it does not belong in the locked doc.

### 4. The implementation plan is the validation gate
Build the plan **against the v2 draft**, not the locked original. Planning is the stress-test: friction is resolved by changing the plan (draft still right) OR by a cheap edit to the draft (it's unlocked — no ritual; absorbing plan-driven edits is the draft's purpose). Iterate until plan + draft converge and the design is buildable. **Never ratify before the plan exists** — a locked doc the plan then forces to change means redundant ritual.

### 5. Ratification — the 3-cold-read gate, then swap
Before locking, the draft must fit the whole locked-doc puzzle exactly and pass **three cold reads by a fresh AI session with no context**:
1. read the v2 draft alone;
2. cold-read ALL locked docs with focus on whether this one fits the puzzle;
3. a final cold-read with no particular focus.

It locks only if it passes all three without issue. Then run the [§ 7](PRINCIPLES.md#7-canonical-docs-as-policy) unlock→swap→relock atomic cycle to replace the locked body with the draft's (minus the delta list). Small changes may use a lighter ritual; large swaps get the full gate.

## Register

Locked docs and their drafts are dense AI/expert-dev scaffolding: maximal precise information per token, jargon used undefined, deliberately beyond a non-expert readthrough. Novice-facing explanation lives in chat and the separate instruction manual — never in the doc. The meaning must remain *extractable* (PRINCIPLES § 4), but the doc itself stays dense.

## Worked example

`modules/win-calculator-v2.md` (2026-05-23) is the first artifact built under this protocol: a surgical diff of the locked `modules/win-calculator.md` carrying 6 deltas, pending plan-validation and the cold-read gate.

## Relationship to PRINCIPLES

This protocol does not override § 7; it feeds it. § 7 is the gate (how to unlock/swap/relock); this is the workflow (how to produce a swap-ready draft and prove it earns the lock). A future § 7 ratification may add a back-reference to this file.
