# Duplicate "Week 14" — investigation findings (Phase 6)

Date: 2026-10-28. Investigation only. No code or data changed, by Ed's call.

Phase 6 of `memory-bank/plans/PLAN-standings-points-fix.md` (that plan file lives
on PR #291's branch; flip its Phase 6 checkbox when #291 merges).

## Symptom

The real season held two `season_weeks` rows named "Week 14" (2026-10-04 and
2026-10-11); the weeks after were labelled 15, 16.

## Root cause

The week number used to be **stored as text** in `season_weeks.week_name`, and
two writers disagreed about how to count it:

- Season creation numbered the regular weeks 1..N as it generated them.
- `applySeasonLengthChange.lengthen()` named each appended week
  `Week ${regulars.length + j + 1}` — which is only correct if the stored names
  are already a clean 1..N run, and renumbers nothing when they are not.

The real league's run was already broken before the length change: a blackout
week bumped the count, producing `1, 3, 4 … 14`. The length change then collided
a second "Week 14" on top of it.

This was already diagnosed in June — see
`docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md:19`.

## Why it is already fixed — and why the data still shows it

Both halves of the fix are on `main`:

1. **Nothing stores a week number.** `deriveWeekLabels`
   (`src/utils/scheduleDisplayUtils.ts:159`) computes "Week N" from the week's
   position by date.
2. **The colliding writer is gone.** `e0d975c3` replaced the formula with a bare
   placeholder.

The timing is what left the data dirty: that work was written 2026-06-30 but sat
on a branch until **PR #244 merged 2026-08-18**, shipping in **v1.8.0 on
2026-08-25** — after the season was built and length-adjusted.

The fix also never repaired existing rows. The June migration
(`20260621000000`) deliberately left `week_name` alone on regular weeks, and the
"controlled renumber SQL" the plan called for was never written — there is no
such file in the repo.

## No guard to build

Phase 6 originally asked for a unique constraint or renumber-on-write plus a
regression test. That is moot: no number is stored, and
`UNIQUE(season_id, scheduled_date)` (`unique_season_date`, baseline:2372) makes
the derived order total. A duplicate is impossible by construction.

## Past data left as-is (Ed, 2026-10-28)

One beta season, season over, nobody noticed. Verified the stale text cannot
reach handicaps or player profiles:

- `week_name` is read by three files — `SpectateLiveMatches.tsx`,
  `SpectateMyLiveMatches.tsx`, `TeamSchedule.tsx` — all display-only, and all
  derive the label first, using the stored value only as a fallback.
- Nothing in handicaps, stats, standings or scoring reads it.
- In the database it is a plain column: no trigger, no function, no view
  (baseline:1996 is its only occurrence).
- The old code that **parsed** "Week 14" back into control flow is gone
  entirely — that was the genuinely dangerous part.

## Leftover (not urgent)

`week_name` is a dead `NOT NULL` column still required on every insert. Dropping
it is "Phase C" of the decoupling plan and was never done. Cleanup, not
correctness.

Also dead: `src/components/schedule/WeekCard.tsx` renders the raw stored name
with no derived fallback, but it has no callers.
