---
date: 2026-11-17
topic: trustworthy-tests
---

# Trustworthy Tests — proving AI-written tests actually test something

## Problem Frame

Almost every test in this repo (392 files, 92 against the real database) was
written by an AI. Albert Sikkema's "Your AI Tests Are Probably Lying to You"
(2026-06-08) describes how AI-written tests pass without checking anything:
tests that only check a fake database answer they set up themselves, checks
that never run, vague checks ("something came back"), happy-path-only
coverage, and failing tests quietly dropped from the report.

It has already happened here once: the My Stats page (PR #277) shipped with a
query Postgres rejected outright (an ambiguous embed) while ~4,800 unit tests,
typecheck and build all passed — none of them asked Postgres anything. Ed
found it in seconds of real use.

Ed is new to testing, wants to be protected, and does **not** want to watch
tests run. He wants to see **results**: what passed, what failed, and evidence
that each test guards something that matters — so neither his time nor
Claude's is spent on tests that protect nothing.

**The core tension (from review):** the same AI writes the tests, proves them,
and writes the summary Ed reads. So wherever a machine can do the checking,
the machine does it, and Claude's word is never the only evidence.

## Requirements

**Machine guards (CI checks that don't depend on Claude's honesty)**
- R1. A PR that changes database query code without a real-DB test covering
  that query is flagged by CI on its own — not by the summary. (This is what
  stops the next My Stats.)
- R2. A PR that adds a skipped, todo, or focus-only test fails CI unless it
  carries an allow-listed reason. Stops "skip it to get green."
- R3. A test file that matches no vitest project (and so silently never runs)
  fails CI. (None exist today, but a `.tsx` file under
  `src/__tests__/database/` would silently run in neither project.)

**Proving each test can fail ("watch it fail first")**
- R4. Every new test, and every existing test whose checks change, is proven
  able to fail: Claude breaks the behavior the test guards in the way the
  test is meant to catch (wrong filter, wrong number — not just "delete the
  function"), confirms red, restores. A test that stays green when its code
  is broken is rewritten or deleted, never shipped. Pure renames and import
  moves are exempt.
- R5. The proof is kept, not just claimed: the PR carries a collapsed section
  with, per test, the exact break that was made and the red result.
- R6. For database-side behavior (triggers, RLS, RPCs), the break happens
  inside a rolled-back transaction so Ed's local database is never left
  broken.

**Real database for real queries**
- R7. Any new test of a database read or write runs against the real local
  Postgres. Real-DB tests insert known rows and check the exact expected
  result, including at least one row that must be left out. Exception: cases
  the real DB can't easily produce (a timeout, a dropped connection) may use
  a fake, and say why.
- R8. Existing tests that fake the data layer — the Supabase client (17
  files) **and** the query/hook layer above it (45 files; this is where the
  My Stats tests faked) — get a triage list: **keep** (with reason),
  **convert** (to real DB), or **delete**. Conversions happen highest-risk
  first (user-facing, recently changed), in small batches, not one big push.
  `src/__tests__/database/17-point-smoke.test.ts` is the template: it points
  the client at the real test database instead of faking it.

**Mutation testing on the math that matters most**
- R9. Scoring and handicap math gets mutation testing: a tool makes many
  small deliberate mistakes in that code and reports which ones no test
  noticed. It covers the TypeScript scoring engine and hard-coded systems.
  Scoring stored as DB modules is protected by parity tests, not mutation
  testing (see Scope).
- R10. Each mistake no test noticed is covered by a new or strengthened test,
  or accepted. Accepted ones are shown to Ed as a separate count with the
  actual code change, not just Claude's one-line reason. Tests in that area
  that catch nothing are flagged to strengthen or delete.
- R11. The scoring math's expected values come from at least one source that
  isn't the code itself, so the tests can't just lock in wrong behavior.
  **Answer key = the one completed production season** (Sunday 9-ball,
  standard handicap, 64 played matches, 2026-06-14 → 2026-10-25). This is a
  regression check against league-accepted results: per-game winners are
  human-confirmed, but targets and points were computed by our code at the
  time. Ed confirmed it
  is real, finished, league-accepted data (2026-11-17). Each game's winner
  was entered and confirmed by both teams on the night; the replay test feeds
  those recorded games through the scoring code and must reproduce the
  recorded games-won and points for every match. Player and team names are
  replaced with fake ones before anything enters the repo. A replay mismatch
  is investigated, not auto-"fixed" either way: it's either a scoring bug or
  a mid-season data fix (e.g. the sub-slot credit fix).

**Results Ed can read**
- R12. When Claude finishes work that touches tests, Ed gets one short,
  plain-language summary in the PR description (chat gives a one-line pointer
  to it). Fixed format: failures first, then pass/fail/skip counts taken from
  the CI run with a link to it, then one line per new or changed test saying
  what it protects in user terms and naming the exact value it checks.
- R13. Mutation results are a readable report: "of N deliberate mistakes in
  the scoring math, tests caught X; here are the ones they missed, in plain
  words, and what we did about each."
- R14. Failures are never hidden. If anything fails, the summary leads with
  it, and the counts must match CI.

**Cleaning up what's already there**
- R15. Every currently skipped test in the suite (today: 4 database groups
  waiting on seed data) gets a decision: wire it up, or delete it. Tests that
  silently skip themselves (e.g. "no rows → return" before any check) count
  as skipped and are made to fail instead.

## Success Criteria

- A My-Stats-style bug can't ship: CI flags a query change with no real-DB
  test, whatever the summary says.
- Ed can read any summary and say what each new test protects, and every
  "protects" line points at a specific checked value plus a recorded break.
- The scoring mutation report exists, and every missed mistake has a test or
  a visible, Ed-reviewable acceptance.
- No test in the suite is skipped without a recorded decision, and CI stops
  new ones.

## Scope Boundaries

- **No AI test-reviewer checklist** (the article's own fix). It has the same
  blind spot as the AI that wrote the tests. Can revisit later.
- **No coverage-percentage target.** Coverage measures what code ran, not
  whether anything was checked.
- **No rewrite of all 392 test files.** Existing tests are touched only via
  R8, R10 and R15; everything else improves as code is changed.
- **Mutation testing stays on the scoring/handicap TypeScript code.** Not UI,
  not the whole app, not DB-stored module programs (those rely on parity
  tests against the hard-coded originals).

## Key Decisions

- **Recommendation accepted (2026-11-17):** watch-it-fail + real DB for
  queries + mutation testing on scoring math. Ed: "go with your
  recommendation."
- **Results, not runs:** Ed's protection comes from readable outcomes, not
  from watching tests execute.
- **Machines check, Claude reports (added after review):** the original
  draft relied on Claude's own summary for the key promises. R1–R3, CI-sourced
  counts (R12), and kept break records (R5) make the important claims
  checkable without trusting the AI that wrote the tests.
- **R7 alone would have caught My Stats:** that query errored outright, so
  any real-DB test would have gone red. The exact-value rule in R7 is for the
  quieter bugs (wrong filter, the 1000-row cap).

## Dependencies / Assumptions

- CI's `db-tests` job already runs the real-DB project on every PR
  (`.github/workflows/checks.yml`), so real-DB tests need no new CI job.
- The `db` vitest project only picks up `.ts` files; converting `.tsx`
  component/hook tests to real DB needs that widened (covered by R3's guard).
- CI starts Supabase without realtime, so realtime tests stay fakes (R7
  exception).
- R11 reads production read-only via the existing `PROD_SERVICE_ROLE_KEY`
  in `.env.local` (same access `scripts/clone-prod-to-local.mjs` uses). Only
  one league and system exists in production today, so other handicap systems
  and playoffs get answer keys later, as real seasons complete.

## Outstanding Questions

### Deferred to Planning
- [Affects R9][Needs research] Mutation tool for vitest 4 + TypeScript
  (Stryker likely); it must run only the `unit` project, never the db one;
  run time on Ed's machine (already `--maxWorkers=2`); per-test attribution
  so "this test catches nothing" can be shown.
- [Affects R9, R13][Technical] On demand, scheduled, or in CI when scoring
  files change — and if on demand, what stops it quietly never running.
- [Affects R9][Technical] Exactly which folders count as scoring/handicap
  math (likely `src/systems/` and the handicap/scoring utils).
- [Affects R1][Technical] How CI recognises "query code" and "a real-DB test
  covering it."
- [Affects R4, R12][Technical] The persistent rule + summary template so the
  break-test doesn't drift across sessions (likely a CLAUDE.md rule + PR
  template section).
- [Affects R15][Technical] Whether existing seed files are enough to wire up
  the skipped groups, or new fixtures are needed.

## Next Steps

-> `/ce:plan` for structured implementation planning
