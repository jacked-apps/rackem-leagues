---
summary: Retest - the first team to lock its lineup gets stuck on Match Setup
kind: task
added: 2026-05-02
checked: 2026-11-04
---

## Ed: retest

Retest with the original steps below. No fix targets this bug.
PR #100 added retry logic to `prep_match`, but not for the suspected cause.

## Symptom

When the FIRST team locks its lineup, its screen gets stuck on
"Match Setup". "Try Again" succeeds on the retry. Long-running, seen in
many sessions before 2026-05.

## Repro (it follows the first locker, not home/away)

- Home locks first: stuck on Match Setup, "Try Again" works.
- Home locks second: both go in cleanly.
- Reproduced again after a Supabase restart with home locking first.

## Likely cause

A race. The first locker may be racing the realtime visibility of its own
commit, or the visibility of the other team's lineup row.

## Investigation hints

- `src/hooks/lineup/useMatchPreparation.ts`: the branch that runs
  prep_match and the branch that waits on realtime.
- `trigger_auto_create_match_lineups` should create both lineup rows on
  match insert. Confirm both are visible when the lock fires.
- `supabase/migrations/20260424000000_prep_match_rpc.sql` (3 retries with backoff).
- Capture the real error from failed attempts. The toast swallows it.
