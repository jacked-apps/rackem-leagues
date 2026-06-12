---
title: "feat: Change Season Length (lengthen / shorten an existing season)"
type: feat
status: active
date: 2026-06-11
origin: docs/brainstorms/2026-06-11-season-length-adjustment-requirements.md
deepened: 2026-06-11
---

# feat: Change Season Length (lengthen / shorten an existing season)

## Overview

Let a league operator change a season's **regular-season length** after creation —
an early "I meant 16, not 14" correction. The start date stays fixed; the change
only ever **appends weeks to the end** (lengthen) or **trims weeks from the end**
(shorten). It's gated by a **lock** (the 5th week's play-date), and driven through a
small **Change Season Length wizard** off the Manage Schedule page.

Lengthening is purely additive — **existing matchups are never touched**; we stamp
out the new weeks' matches from the hard-coded matchup chart. Shortening deletes the
tail weeks' matches + rows, **guarded** so it can never delete a match that's already
been played. It builds on the blackout re-flow (PR #209) for date helpers. Branch off
`fix/blackout-reflow` (or `main` once #209 merges).

## Problem Frame

Season length is chosen once in the creation wizard, with no way to fix it on an
existing season. Operators want to nudge it early without rebuilding. Per origin:
an **early-season, end-only** count change. (see origin:
docs/brainstorms/2026-06-11-season-length-adjustment-requirements.md)

**The shorten path needs a real played-match guard.** The lock (week-5 date) + the
10-week floor make it *unlikely* a removed week is played — but **not impossible**.
Matches have **no date gate**: a match starts/scores purely on its `status`
(`MatchPhaseGuard` never checks `scheduled_date`), so two teams can play a late-season
match early ("pre-played" — it happens). That played match could then fall in a
shorten's delete range. So shortening **must refuse** to delete a week whose matches
aren't all `scheduled`, re-checked fresh right before the delete. This is the
last-line safety at the irreversible action — cheap, ~a few lines, and correct
regardless of the future paywall (which will *also* make the situation rare by
locking out weeks 5+ until paid). Lengthen never deletes, so it needs no such guard.

## Requirements Trace

- **R1.** Operator can change a season's regular length within **[10, 52]** via a
  wizard, while unlocked.
- **R2.** **Lengthen** appends regular weeks at the end with correct chart pairings
  (from stored positions), dates them, and pushes the break + playoff weeks out.
  **Existing matchups are untouched.**
- **R3.** **Shorten** trims regular weeks from the end, deleting their matches + week
  rows, **but refuses** (and tells the operator) if any removed week has a match that
  isn't `scheduled`. Pulls the break + playoff dates in.
- **R4.** **Lock:** editable only while `today < the 5th regular week's
  scheduled_date`; after that the entry control is disabled. (Future: payment-made is
  an earlier trigger — note the seam.)
- **R5.** Lengthen's team count + matchup chart are derived from the **stored position
  set frozen at creation**, never from live team status.
- **R6.** `seasons.season_length` and `seasons.end_date` stay in sync after any change.
- **R7.** Existing matches are **never** regenerated or re-pointed; only the
  appended/removed tail weeks are touched.
- **R8.** Each team's (and the bye's) `schedule_position` is persisted when matchups
  are created, so it's available for later appends.
- **R9.** No snapshot/revert — the length is freely re-editable until lock.

## Scope Boundaries

- **End-only.** No inserting/removing a *middle* regular week.
- **Not the blackout re-flow.** Week-off add/remove stays PR #209's feature.

### Deferred to Separate Tasks

- **Payment lock + play-lockout.** When Jack's payment integration lands: "payment
  made" becomes an earlier length lock, and weeks 5+ are play-locked until paid. Note
  the seam in the lock helper; do not build it.
- **Pre-column seasons.** Seasons whose matchups were created *before* the
  `schedule_position` column lands have no stored positions. **Lengthen** is
  unsupported for them (the wizard shows a clear "regenerate this season" message);
  **shorten still works** (it's position-agnostic — it only deletes tail rows).
  Acceptable — app data is disposable. No backfill.

## Context & Research

### Relevant Code and Patterns

- `src/utils/matchupTables.ts` — hard-coded `MATCHUP_TABLES` keyed by **(even) team
  count including the bye**; `getMatchupTable`, `getMatchupCycleLength`. Week K's
  pairings = `table[K % cycleLength]`; odd counts use the next-even chart, the bye is
  a position.
- `src/utils/scheduleGenerator.ts` — `generateWeekMatches(seasonWeekId,
  weeklyMatchups, teamsByPosition, seasonId)` (**not currently exported** — export it
  or replicate its ~30-line loop); `match_number` = pair index + 1 per week. The
  creation chokepoint `generateSchedule({seasonId, teams})` resolves the real
  bye-team UUID (`createByeTeam`) and holds every team's position + id — the right
  place to persist positions. Creation also calls `assign_tables_for_season` after
  insert. Two callers pass through here: `matchups-v2/steps/ReviewStep.tsx` (passes
  the raw `BYE` sentinel) and `src/operator/ScheduleSetup.tsx` (pre-swaps the bye).
- `src/wizards/matchups-v2/steps/PositionsStep.tsx` — seeds `schedule_position`
  (synthetic `BYE` at `teams.length+1`); reads `status='active'` teams. Positions are
  currently **never persisted**.
- `src/types/schedule.ts` — has a **stale `TeamSchedulePosition` type** describing a
  *junction table* (`season_id, team_id, schedule_position`), exported via
  `src/types/index.ts`. It conflicts with this plan's column-on-`teams` choice; treat
  it as dead scaffolding (remove or ignore — do not build a junction table). Also has
  `TeamWithPosition` (already carries `schedule_position`).
- `src/utils/scheduleReflow.ts` + `scheduleReflowApply.ts` (PR #209) — **reuse the
  helpers** (`addWeeks`, the collision-safe DESC/ASC date-write ordering,
  `formatLocalDate`), **not** `computeBlackoutReflow` itself (see the dating decision
  below).
- `src/utils/scheduleUtils.ts` — `generateSchedule` walk (regulars → break → playoff,
  skipping blackout dates) is the *ordering* the length-change dating must produce;
  `"Week N"` naming convention for regular rows.
- `src/wizards/schedule-v2/useSaveScheduleV2.ts` — "delete + re-insert `season_weeks`
  rows" pattern to mirror.
- `src/operator/SeasonScheduleManager.tsx` — Manage Schedule page (shows "Season
  Length: N weeks"); host for the entry button. `extractWeekNumber` parses `"Week N"`.
- `src/components/match/MatchPhaseGuard.tsx` — confirms there is **no date gate** on
  starting/scoring a match (basis for the played guard).
- `src/api/mutations/teams.ts` — `deleteTeam` is a **soft delete** to
  `status='withdrawn'` (basis for freezing team count).
- `src/wizards/season-v2/steps/SeasonLengthStep.tsx` + `NumberStepper` — mirror for
  the wizard, **but it passes `min={6}`; this flow must use `min=10`**.
- `src/utils/formatters.ts` — timezone-safe date helpers (required).

### Institutional Learnings

- `docs/solutions/` has no schedule/season-length entries.
- Project memory: dev data is disposable; games-won data is sacred; DB tests touching
  real Postgres live under `src/__tests__/database/` (jsdom, sequential); migrations
  need full timestamps.

### External References

- None — entirely local patterns.

## Key Technical Decisions

- **Persist `schedule_position` on `teams`, inside `generateSchedule`.** Add the
  column; write each team's position (including the resolved real bye row) at the
  one chokepoint where positions + the bye UUID are both in hand. This covers both
  callers (`ReviewStep` and `ScheduleSetup`); persisting "in the wizard save" would
  miss `ScheduleSetup` and the bye. (Reverse-engineering positions from matches —
  rejected: fragile to hand-edited weeks.) Remove/ignore the stale junction-table
  `TeamSchedulePosition` type.
- **Lengthen freezes team count + chart to the stored position set.** Read the
  persisted positions (real teams **plus the bye row**, `status='bye'`); the chart is
  `getMatchupTable(<count of stored positions, incl. bye>)`, **never** the live active
  count. A post-creation withdrawal must not re-key the chart, or appended weeks would
  use a different rotation than weeks 1..N (silent broken weeks via generate's
  warn-and-skip).
- **Lengthen = append only the new weeks.** Insert N new regular `season_weeks` rows;
  for each new index K, `generateWeekMatches(table[K % cycleLength], positions)`;
  insert only those matches; re-run `assign_tables_for_season`. Existing matches
  untouched.
- **Shorten = guarded delete of the tail.** Identify the last N regular weeks; **fresh
  re-read** their matches and **abort if any isn't `status='scheduled'`** (return a
  typed block naming the week); else delete those matches + rows. Re-date break/playoff
  in. The check + delete should be as close to atomic as practical (re-check
  immediately before delete; a transactional RPC is the fully-atomic option, deferred).
- **Dating is a new length-aware routine, not `computeBlackoutReflow`.** That function
  re-dates *existing* play rows and pins the break as a *fixed* skip — the opposite of
  what's needed. Here: date the new/last regular weeks by walking the cadence forward
  from the **last regular week** (skipping blackout dates), then place break → playoff
  after them; for shorten, pull them in. Reuse #209's `addWeeks` + collision-safe write
  ordering + `formatLocalDate`. Do **not** rely on a date-only sort to order new
  regular weeks vs. playoffs (it can place a new regular week after the playoffs).
  `end_date` = the **max date across all surviving rows** (match #209's definition).
- **Lock by the 5th regular week's date.** Pure check, computed fresh (never cached);
  assumes a fully-created schedule; documented seam for a future `paymentMade` trigger.
- **Persistence = ordered client-side writes** for the date/row moves (consistent with
  #209); the shorten guard is the one place that wants the tightest atomicity.

## Open Questions

### Resolved During Planning

- *Where do positions come from?* — Stored on `teams.schedule_position` at creation;
  read directly (incl. the bye) on append.
- *What team count does lengthen use?* — The frozen stored-position count, not live
  status.
- *Is a played-match guard needed?* — **Yes** (matches have no date gate); shorten
  refuses to delete a non-`scheduled` week.
- *Do break/playoff move?* — Yes, via a new length-aware dating routine; blackout
  dates stay fixed.

### Deferred to Implementation

- Whether the shorten guard+delete uses ordered client writes (fresh re-check) or a
  transactional RPC for full atomicity.
- Exact helper/function and file names.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not
> implementation specification. The implementing agent should treat it as context, not
> code to reproduce.*

```
LENGTHEN (16 -> 18), 5 real teams (=> 6-with-bye chart, cycle 5), Wednesdays, a holiday blackout mid-season:
  1. read positions:  teams.schedule_position incl. bye  ->  {1:A,2:B,3:C,4:D,5:E,6:BYE}
                      chart = getMatchupTable(6)   (frozen count, NOT live active count)
  2. add rows:        create regular weeks 17 & 18  (week_name "Week 17","Week 18")
  3. re-date:         walk cadence forward FROM the last regular week (skip the holiday),
                      then place break, then playoff -> break/playoff slide out 2 weeks
                      (new regular weeks land BEFORE the break, not after the playoff)
  4. generate ONLY new weeks:
                      week17 = generateWeekMatches(table[16 % 5], positions)
                      week18 = generateWeekMatches(table[17 % 5], positions)
                      then assign_tables_for_season   (existing weeks untouched)
  5. sync:            season_length = 18, end_date = max date across all rows

SHORTEN (16 -> 12):
  1. tail:    the last 4 regular weeks (13..16)
  2. GUARD:   fresh-read their matches; if ANY is not 'scheduled' -> ABORT, name the
              week, delete nothing  (early pre-played match protection)
  3. delete:  those weeks' matches + season_weeks rows
  4. re-date: break/playoff pulled in 4 weeks
  5. sync:    season_length = 12, end_date = max date across all rows
```

## Implementation Units

- [x] **Unit 1: Length-change eligibility + bounds (pure)**

**Goal:** Pure helpers: is a season's length currently editable (week-5 lock), and
validate/classify a requested length against [10, 52].

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Create: `src/utils/seasonLengthEdit.ts`
- Test: `src/utils/seasonLengthEdit.test.ts`

**Approach:**
- `isLengthEditable(weeks, today)`: sort regular weeks by date *fresh*; editable while
  `today < regular[4].scheduled_date`. Fewer than 5 regular weeks → editable (assumes
  a fully-created schedule otherwise). Named seam for a future `paymentMade` arg.
- `classifyLengthChange(currentLen, requestedLen)`: validate [10, 52]; classify
  `lengthen` / `shorten` / `noop`. Timezone-safe via `@/utils/formatters` (compare ISO
  date strings; never `new Date('YYYY-MM-DD')`).

**Patterns to follow:** `src/utils/scheduleReflow.ts` (pure, typed, no I/O).

**Test scenarios:**
- Happy: 16 regular weeks, today before week-5 date → editable; request 12 → `shorten`
  delta −4.
- Edge: today **exactly equal** to the week-5 date → not editable (boundary).
- Edge: only 3 regular weeks so far → editable.
- Edge: request 9 → rejected (floor); 53 → rejected (ceiling); equal → `noop`.

**Verification:** unit tests pass; pure (no supabase import).

---

- [x] **Unit 2: Persist `schedule_position` on teams**

**Goal:** Add a `schedule_position` column to `teams` and write each team's position
(including the bye) at the `generateSchedule` chokepoint, so it's available for later
appends. Clean up the stale junction-table type.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/<full-timestamp>_add_team_schedule_position.sql`
- Modify: `src/utils/scheduleGenerator.ts` (persist inside `generateSchedule`, after
  the bye is resolved, over the full positions array)
- Modify: `src/types/schedule.ts` / `src/types/index.ts` (remove or clearly retire the
  stale `TeamSchedulePosition` junction-table type so it can't mislead)
- Test: `src/__tests__/database/teamSchedulePosition.db.test.ts`
  *(first line `// @vitest-environment jsdom`)*

**Approach:**
- Migration: `schedule_position` integer, **nullable**; full-timestamp filename.
  Update `supabase/schema_dump.sql` if tracked.
- Persist over `teamsForGeneration` (real teams + resolved bye UUID) — additive, does
  not change match generation. Covers both `ReviewStep` and `ScheduleSetup` callers.

**Execution note:** DB test first — "after creating matchups, every team (incl. bye)
has the right `schedule_position`" is the property the append depends on.

**Patterns to follow:** existing `teams` writes in `src/api/mutations/teams.ts`.

**Test scenarios:**
- Integration (even): create a 4-team season's matchups → teams have
  `schedule_position` 1..4 matching the positions that generated week 1.
- Integration (odd): 5-team season → the real bye row (`status='bye'`) carries its
  position too.
- Edge: positions passed **non-sequentially** (e.g. [3,1,2]) → stored as-passed, not
  renumbered by team id. *(Unit-level assert on the persist, not a full wizard fixture.)*

**Verification:** DB test passes; column present; positions persisted for new seasons;
stale type gone.

---

- [x] **Unit 3: Apply length change (DB)**

**Goal:** Apply a lengthen or shorten: mutate `season_weeks` + `matches`, re-place
break/playoff dates via the length-aware routine, sync `season_length` + `end_date`.

**Requirements:** R2, R3, R5, R6, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Create: `src/utils/applySeasonLengthChange.ts`
- Test: `src/__tests__/database/applySeasonLengthChange.db.test.ts`
  *(first line `// @vitest-environment jsdom`)*

**Approach:**
- **Lengthen:** read stored positions incl. the bye; if any are null (pre-column) →
  typed "regenerate this season" error. Chart = `getMatchupTable(<frozen stored count
  incl. bye>)`. Insert N new `regular` rows (`"Week N"` naming); date them by walking
  forward from the last regular week (skip blackouts), then place break/playoff after;
  generate matches via `generateWeekMatches(table[K % cycleLength], positions)` for the
  new weeks only; re-run `assign_tables_for_season`. **Never touch existing matches.**
- **Shorten:** identify the last N regular weeks; **fresh-read their matches and abort
  if any isn't `scheduled`** (typed block naming the week); else delete those matches +
  rows; re-date break/playoff in.
- Both: `end_date` = max date across surviving rows; update `seasons.season_length`.
  Reuse #209's collision-safe ordered date writes. Return typed `{ success, error }`.

**Execution note:** DB integration test first — "existing matches untouched after a
lengthen" and "the guard blocks a played tail" are integrity properties best pinned
against real Postgres before the UI exists.

**Patterns to follow:** `src/utils/scheduleGenerator.ts` (`generateWeekMatches`,
`table[K % cycleLength]`, `assign_tables_for_season`); `src/utils/scheduleReflowApply.ts`
(ordered date writes, result/error shape); `useSaveScheduleV2` (week-row writes).

**Test scenarios:**
- Integration (lengthen happy): 12-week, 4-team season → lengthen to 14 → two new
  regular weeks with chart pairings for weeks 13–14; **every pre-existing match
  byte-identical**; the new regular weeks land **between the old last regular week and
  the break/playoff** (not after playoffs); break/playoff pushed out 2 weeks;
  `season_length=14`; `end_date` advanced.
- Integration (lengthen, odd teams): 5-team season → new weeks include the correct
  team-vs-bye pairing from stored positions.
- Integration (lengthen, withdrawal): a team soft-deleted (`withdrawn`) after creation
  → lengthen still uses the **original** frozen count/chart; appended weeks match the
  existing rotation (no warn-and-skip, no missing matches).
- Integration (lengthen, blackout present): a mid-season holiday stays on its date
  while appended weeks + break/playoff flow around it.
- Integration (shorten happy): 16-week season, tail unplayed → shorten to 12 → those
  weeks' matches + rows gone, weeks 1–12 untouched, break/playoff pulled in,
  `season_length=12`, `end_date` pulled in; standings unchanged.
- Integration (shorten **guard**): a tail week (e.g. 15) has a match set to
  `completed`/`in_progress` → shorten **aborts**, names week 15, deletes nothing.
- Edge: lengthen/shorten by 1 with no break/playoff (regular-only) → end_date ±1.
- Error (pre-column): null `schedule_position` on **lengthen** → typed error, nothing
  written (shorten unaffected).

**Verification:** DB suite passes; manual lengthen + shorten on a seeded season behaves
correctly, the guard blocks a played tail, and history is intact.

---

- [x] **Unit 4: Change Season Length wizard + entry point**

**Goal:** A wizard to drive the change, launched from a "Change Season Length" button
on the Manage Schedule page that's disabled once locked.

**Requirements:** R1, R3, R4, R9

**Dependencies:** Unit 1, Unit 3

**Files:**
- Create: `src/wizards/season-length/` (steps + config, mirroring `season-v2`)
- Modify: `src/operator/SeasonScheduleManager.tsx` (entry button + locked hint)
- Test: co-located wizard/step test(s) (mocked apply helper)

**Approach:**
- Entry button uses `isLengthEditable` (Unit 1). When locked, disable it and render
  **static helper text beneath the button** (not a tooltip-on-disabled, which fails on
  mobile) showing the actual lock date, e.g. "Length locked after week 4 begins
  (Jun 24)."
- **Step 1:** set the new length — reuse the `NumberStepper` pattern from
  `SeasonLengthStep.tsx` but with **`min=10, max=52`**, pre-filled with the current
  length.
- **Step 2 — review, branched by direction:** show the concrete picture, not just a
  delta — the **new end date** (both directions), and the specific weeks **added**
  (lengthen, with the break/playoff shift) or **removed** (shorten, list the dates).
- **Confirm:** call `applySeasonLengthChange`; on success return to the schedule page
  (reloads). Surface errors **in place** without losing the operator's spot:
  the shorten **guard block** ("Week 15 has already been played — can't shorten past
  it"), and the **pre-column lengthen** error ("regenerate this season"). Pre-column
  gating: block lengthen at Step 1 for that direction only; **shorten stays available**
  for pre-column seasons. No snapshot/revert.

**Patterns to follow:** `src/wizards/season-v2/*`, `SeasonLengthStep.tsx` +
`NumberStepper`; shadcn/ui throughout.

**Test scenarios:**
- Happy: unlocked season → button enabled → Step 1 set 14 → Step 2 shows "+2 weeks,
  new end date X" → confirm calls `applySeasonLengthChange` with the right target.
- Happy: set below current → Step 2 lists the removed weeks + new end date → confirm
  calls apply.
- Edge: locked season → button disabled with the dated hint; wizard not reachable.
- Error: shorten guard block → Step 2 surfaces "week N already played" without
  navigating away.
- Error: pre-column lengthen → "regenerate this season"; shorten still offered.

**Verification:** wizard test(s) pass; manual run lengthens and shortens a seeded
season end-to-end, respects the lock, and surfaces the guard/pre-column errors cleanly.

## System-Wide Impact

- **Interaction graph:** Unit 2 adds a `teams.schedule_position` write to the matchup-
  creation path (additive). Unit 3 writes `season_weeks` (insert/delete/date),
  `matches` (insert for lengthen, delete for shorten), `seasons`
  (season_length, end_date), and re-runs `assign_tables_for_season` for appended weeks.
  Standings (`completed`-only) unaffected by unplayed deletes.
- **Error propagation:** apply returns typed `{ success, error }` for the shorten
  guard, pre-column lengthen, and DB errors; the wizard surfaces each in place.
- **State lifecycle risks:** the shorten guard is the load-bearing protection against
  destroying sacred games-won data — fresh re-check immediately before delete (tightest
  atomicity practical). `UNIQUE(season_id, scheduled_date)` during re-dating — reuse
  #209's ordered writes.
- **API surface parity:** the matchup generator stays the single source of pairing
  truth — appended weeks use the same `generateWeekMatches` + chart.
- **Integration coverage:** "existing matches untouched after lengthen," "guard blocks
  a played tail," and "withdrawal doesn't re-key the chart" are only provable against
  real Postgres (Unit 3).
- **Unchanged invariants:** match generation logic, the matchup charts, the blackout
  re-flow (#209), and the `matches`/`season_weeks` schemas are unchanged; the only
  schema change is the additive `teams.schedule_position` column.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A pre-played late match falls in a shorten's delete range → sacred data loss | The played-match guard (R3): fresh re-read + abort before delete; surfaced in the wizard. The future paywall makes it rarer, not the safety |
| Post-creation withdrawal changes live team count → wrong chart on lengthen | Freeze count/chart to the stored position set incl. bye (R5); covered by the withdrawal test |
| Treating the dating as drop-in reuse of `computeBlackoutReflow` (which pins the break) | New length-aware routine reusing #209's helpers only; date new regular weeks from the last regular week outward; test asserts new regulars land before break/playoff |
| Stale `TeamSchedulePosition` junction-table type misleads the implementer | Unit 2 removes/retires it; decision pins column-on-`teams` |
| `generateWeekMatches` not exported / `NumberStepper` min 6 / appended weeks table-less / week naming | Folded into Unit 3 + Unit 4 notes (export or replicate; min 10; re-run `assign_tables_for_season`; `"Week N"`) |
| Re-dating trips `UNIQUE(season_id, scheduled_date)` | Reuse #209's collision-safe ordered writes |
| Depends on PR #209's date helpers | Branch off `fix/blackout-reflow` (or `main` after #209 merges) |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for the new `src/utils/seasonLengthEdit.ts`,
  `applySeasonLengthChange.ts`, the migration, and the `src/wizards/season-length/`
  tree.
- Migration: additive nullable column; full-timestamp filename. Update
  `supabase/schema_dump.sql` if tracked.

## Sources & References

- **Origin document:** docs/brainstorms/2026-06-11-season-length-adjustment-requirements.md
- Related code: `src/utils/matchupTables.ts`, `src/utils/scheduleGenerator.ts`,
  `src/wizards/matchups-v2/steps/PositionsStep.tsx`,
  `src/wizards/matchups-v2/steps/ReviewStep.tsx`, `src/operator/ScheduleSetup.tsx`,
  `src/components/match/MatchPhaseGuard.tsx`, `src/api/mutations/teams.ts`,
  `src/utils/scheduleReflow.ts` + `scheduleReflowApply.ts`, `src/utils/scheduleUtils.ts`,
  `src/wizards/schedule-v2/useSaveScheduleV2.ts`,
  `src/operator/SeasonScheduleManager.tsx`,
  `src/wizards/season-v2/steps/SeasonLengthStep.tsx`, `src/types/schedule.ts`
- Related PRs: #209 (blackout re-flow — dependency/foundation)
- Schema: `supabase/migrations/20251130010824_baseline.sql` (`teams`, `season_weeks`,
  `matches`, `seasons.season_length` CHECK 10..52)
