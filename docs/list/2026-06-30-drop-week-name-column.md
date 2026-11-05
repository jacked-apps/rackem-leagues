---
summary: Drop the unused week_name column once the staging week check passes
kind: task
added: 2026-06-30
checked: 2026-11-04
---

Phase C of the schedule and matchup decoupling. Remove the now-dead
`week_name` column on `season_weeks` and its references (around 124).

Wait for the staging week-numbers check first. The plan sequences this after
staging verification on purpose: once the column is gone there's no fallback
if a reader was missed. Until then the column stays. It's harmless, nothing
reads it.

Tell the mobile-app side before the column drop, since it reads
`season_weeks`.

Plan, with the Phase C steps:
`docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md`.
