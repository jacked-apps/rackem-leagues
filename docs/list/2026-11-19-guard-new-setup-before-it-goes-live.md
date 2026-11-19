---
summary: Before a league with a new setup goes live, give that setup's scoring code the full test pass
kind: task
added: 2026-11-19
checked: 2026-11-19
---

Today only the one real league's setup (3-man, points handicap, extra games,
linear_above_threshold) has had the full mutation-test pass and has a real
season replayed as a safety net. On that code the tests catch every
deliberate mistake that could change a result (80% overall; the rest have no
effect).

Every other setup (5-man, Fargo, 10-point, percentage, the trigger loader,
the workshop rooms) sits at about 72%: roughly a quarter of deliberate
mistakes there go unnoticed. Harmless while no league uses it; not OK the
night one does.

## When

As soon as a league that uses a setup other than the one above is about to
go live. Do it before its first match night, not after a wrong score.

## The pass

1. Run the mutation test on that setup's files (`pnpm test:mutation`;
   one file at a time works too).
2. For every miss that could change a result for that league: write a test
   from the rules (expected numbers worked out from the chart or rulebook by
   hand, never pasted from the code), and prove it can fail.
3. For a miss that can't change a result: a `// Stryker disable …: <reason>`
   comment, and a re-check note in that file's header (see CLAUDE.md,
   "Re-check mutation-skip comments").
4. If someone who knows that format can hand-score a few match nights on
   paper (include odd ones: forfeits, subs, lineup swaps, ties), turn them
   into a replay test like `src/__tests__/unit/seasonReplay.test.ts`.
5. Once that league finishes a season in the app, replay the real season
   too.

## Background

`docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md` (U8 results).
