---
summary: Check on staging that schedule week numbers run 1 to N with no duplicates
kind: task
added: 2026-06-30
checked: 2026-11-04
---

Needs Ed. The schedule fix (Phases A and B) merged in PR #244. It stops
storing the week number and works out "Week N" from each week's date
position. That fixed the two-"Week 14" bug.

Still to do: verify on staging. Log in and open a league's schedule (the
operator schedule page, the manage/dates page, and a team's schedule). Confirm:

- weeks read Week 1 to N in order, with no duplicate
- blackouts show their label
- lengthening and shortening the season still works

The Lucky Cue 9-ball Summer 2026 season is the one that had two "Week 14"s.

Once this passes, Phase C can go ahead (see the drop-week-name-column item).

Plan: `docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md`.
