---
summary: Rename the dates page from "Manage Schedule" to "Schedule"
kind: task
added: 2026-06-13
checked: 2026-11-04
---

`SeasonScheduleManager` is the dates and blackouts page. It is still titled "Manage Schedule" at `/manage-schedule`. It should be "Schedule" at `/schedule`, which is free now that the matchups page lives at `/matchups`.

It was held back while the Change Season Length work edited the same file. That landed in PR #235, so this is unblocked.

Places to change:
- the route in `src/navigation/NavRoutes.tsx` (`league/:leagueId/season/:seasonId/manage-schedule`)
- the regex in `src/components/layout/BottomTabBar.tsx` (around line 27)
- the navigate call in `src/operator/components/ScheduleCard.tsx` (around line 182)
- the page title in `src/operator/SeasonScheduleManager.tsx` (around line 393)
- the "Manage Schedule page" wording in `src/operator/components/ChangeSeasonLengthDialog.tsx`'s header comment
