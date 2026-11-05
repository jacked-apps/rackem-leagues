---
summary: Add a test proving one failed team chat does not break season activation
kind: task
added: 2026-05-12
checked: 2026-11-04
---

The season-activation trigger (`auto_create_season_conversations`) wraps each
team chat in a `BEGIN/EXCEPTION WHEN OTHERS THEN RAISE WARNING` block. One
failed chat should not stop the other chats or the season UPDATE.

The code is there. What's missing is a runtime test that forces one chat to
fail and checks the rest still go through. Low risk; this is a test gap only.

## Why it was hard

The FK constraints are strict, so faking a per-chat failure from outside the
function needs destructive setup. Deleting members cascades the roster, and
`session_replication_role = replica` is too hacky for a fixture.

## Ways to do it

1. A small SQL helper that raises, called from a test-only fork of the
   function. Heavy.
2. A custom Postgres role with limited INSERT rights, so one block fails.
   Cleaner, but needs role setup.
3. An injectable "force failure for team" debug param. Adds prod surface for
   a test-only need.

The test belongs under `src/__tests__/database/`.

Source: the Adversarial scenario under Unit 4 in
`docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`.
