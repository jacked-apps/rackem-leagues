---
summary: Two screens still spot a bye by an empty team slot instead of its status
kind: task
added: 2026-06-09
checked: 2026-11-04
---

Two places still detect a bye with `home_team_id === null || away_team_id === null` instead of `status === 'bye'`:

- `src/operator/SeasonSchedulePage.tsx` (around line 162)
- `src/wizards/matchups-v2/steps/ReviewStep.tsx` (around line 108)

Move both to the status check, like the rest of the bye work from the 2026-06-09 fixes.
