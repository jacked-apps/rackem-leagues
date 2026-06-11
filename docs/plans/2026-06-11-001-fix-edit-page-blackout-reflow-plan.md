---
title: "fix: Edit-page blackout re-flow (advisory-date schedule)"
type: fix
status: active
date: 2026-06-11
---

# fix: Edit-page blackout re-flow (advisory-date schedule)

## Overview

On the active-season schedule **edit** page (`src/operator/SeasonScheduleManager.tsx`),
marking a week as a blackout only relabels that week's row (`week_type` →
`blackout`, `week_name`) and persists nothing else. It does **not** re-date the
rest of the season and does **not** preserve the play-week count. The matchups
that were on the blacked-out date are left pinned to a now-non-playing row, and
the season silently drops a play week (16 → 15).

This plan makes the edit-page blackout add/remove a true **re-flow**: blacking
out a date inserts a skip on that night and slides every later play week one
play-night down the calendar, so the play-week count is preserved and the season
tail extends by one week. Removing a blackout is the inverse (the season
contracts by one week).

## Problem Frame

The schedule is an **ordered run of weekly play-nights**. Each `season_weeks` row
sits on one league-night (e.g. consecutive Wednesdays). Per Ed's locked model:

- A **match is position-only** — it knows "I'm week 7," nothing about dates. It
  just wants to be played. Players can play any match on any date (pre-played and
  make-up matches are routine); the schedule is only "the night the main group is
  *supposed* to play."
- **Play weeks** (regular + playoffs) are the dated slots matches hang off.
  Playoffs are "just an extra regular play week with a different label" — a 16-week
  season with 1 playoff week is a **17-play-week** season; the playoff plays the
  last play-night.
- **Skip weeks** (blackout + season-end break) are league-nights with no play.
  A "week off" / "season end break" is "a blackout date with a different title."
- **Date is a positional lookup**, never stored on the match: the Nth play week
  resolves to the Nth play-night once skips are removed from the calendar walk.

The bug is that the edit page mutates a single row in place instead of re-running
that calendar walk. The **generator already honors the model** — `src/utils/
scheduleGenerator.ts` fetches only `week_type='regular'` rows ordered by
`scheduled_date` (that ordered list *is* the play-date array) and binds matches by
position. The edit page is the only place that violates it.

## Requirements Trace

- **R1.** Blacking out a play-week date inserts a `blackout` skip row on that
  date and re-dates every later play week one play-night later; the play-week
  count (regular + playoff) is unchanged.
- **R2.** Removing a blackout deletes that skip row and pulls every later play
  week one play-night earlier; play-week count unchanged.
- **R3.** Matches are never re-pointed, deleted, or stranded. Every play row keeps
  its `id` (and therefore its bound matches and any recorded results) across a
  re-flow; only `scheduled_date` changes.
- **R4.** Playoffs are treated as play weeks (they shift with the season); season-
  end break weeks are treated as skips (fixed calendar nights the walk flows
  around, same as blackouts).
- **R5.** Editing a **past** date or an **already-played** (`week_completed`) week
  is **warned but allowed** — never hard-blocked. The schedule is advisory; the
  operator may fix or break it freely.
- **R6.** `seasons.end_date` is updated to the new last play-night after a re-flow.
- **R7.** No schema change; no new columns; the existing `season_weeks` rows are
  the play-date array.

## Scope Boundaries

- **Only** the edit-page blackout **add** and **remove** operations and their
  persistence. The setup-time flow (`src/components/season/ScheduleReview.tsx`,
  `ScheduleReviewTable`) already re-flows correctly and is untouched.
- The matchup generator (`src/utils/scheduleGenerator.ts`) is **not** rewritten.
- No change to how matches are created or to the matchup tables.
- Championship/holiday **conflict detection** display is unchanged (it already
  reads the source-of-truth date table after PR #208).

### Deferred to Separate Tasks

- **Repairing already-stranded data** from past in-place blackouts (matches
  pinned to a `blackout` row, short play-week counts): a one-time reconciliation.
  Out of scope here — dev data is disposable and Ed has already regenerated his
  affected league. Capture as a follow-up only if a real season needs it.
- Adding/removing **season-end break** weeks as a first-class edit action. This
  plan *respects* existing break rows as skips but the toggle target is the
  blackout the operator clicks.

## Context & Research

### Relevant Code and Patterns

- `src/utils/scheduleUtils.ts` → `generateSchedule()` — the canonical
  "walk league-nights weekly, skip blackout dates, collect N play weeks, then
  append break + playoff weeks" logic. The re-flow reuses this exact walk shape;
  the pure reconciliation function should mirror its date-stepping (`+7` days,
  `formatDateForDB`, `parseLocalDate`) rather than reinvent it.
- `src/operator/SeasonScheduleManager.tsx` — `addBlackoutWeek`,
  `removeBlackoutWeek`, `handleSaveChanges`, `handleToggleWeekOff`,
  `canEditWeek`, `getCurrentPlayWeek`. Loads all `season_weeks` ordered by
  `scheduled_date`; maps `blackout` + `season_end_break` → UI type `week-off`,
  `playoffs` → `playoffs`, else `regular`; stores `dbId`, `dbWeekType`,
  `weekCompleted` per row.
- `src/utils/scheduleGenerator.ts` — confirms matches bind to a specific
  `season_weeks` row via `season_week_id` and that play-week order = ascending
  `scheduled_date` among non-skip rows. Read-only reference; not modified.
- `src/types/season.ts` — `WeekEntry`, `formatDateForDB`, `ChampionshipEvent`.
- `src/utils/formatters.ts` — `parseLocalDate` / `formatLocalDate` (timezone-safe;
  **required** for all date math — never `new Date('YYYY-MM-DD')` or
  `toISOString().split`).
- `src/hooks/useConfirmDialog.ts` — already imported in the edit page; reuse for
  the warn-but-allow confirm on past/played edits.
- `src/components/modals/WeekOffReasonModal.tsx` — existing blackout-reason input;
  unchanged.

### Institutional Learnings

- `docs/solutions/` has no schedule/date entries (checked) — no prior art to mirror.
- Project memory: **dev data is disposable** (skip backfill plumbing); **DB tests
  that touch real Postgres** live under `src/__tests__/database/` and run
  sequentially (jsdom); **string sentinels / explicit values** over silent nulls.

### External References

- None needed. The cadence-walk is a local, well-established JS pattern
  (`generateSchedule`); no framework or external-API surface is involved.

## Key Technical Decisions

- **Re-date rows in place; never re-point matches.** The targeted play week keeps
  its row `id` and slides to a later date; a new `blackout` row is created on the
  vacated date. This is simpler and safer than the originally-floated "re-point
  match `season_week_id`" approach: matches never move, FK bindings and recorded
  results are untouched, and the stranded-games bug becomes structurally
  impossible. (Honors "the match doesn't care about dates" literally.)
- **Unified play/skip classification.** The walk treats `regular` + `playoffs` as
  ordered play weeks (regular by week number, then playoff weeks), and `blackout`
  + `season_end_break` as fixed-date skips it flows around. No special-casing of
  playoffs or breaks beyond their play/skip class.
- **Pure reconciliation function + ordered client-side writes** (not a PL/pgSQL
  RPC). A pure TS function computes the re-flow plan (which rows change date, the
  row to insert/delete, the new season end date); the apply step writes it via
  supabase-js. Rationale: reuses the existing JS date-walk (DRY), gives fast
  parallel unit tests for the tricky logic, keeps the change in Ed's TS codebase,
  and avoids a new SQL surface. Dates are **advisory**, so strict transactional
  atomicity is not sacred — a partial failure leaves a recoverable schedule, which
  Ed has explicitly accepted ("they can fix or break it").
  - *Alternative considered:* a transactional RPC with a `DEFERRABLE` unique
    constraint. Rejected for now as heavier (PL/pgSQL date-walk duplicates the JS
    one) and unnecessary given advisory dates. Revisit only if partial-failure
    recovery ever becomes a real operator pain.
- **Unique-constraint collision avoidance via update ordering.** `season_weeks`
  has `UNIQUE(season_id, scheduled_date)`, checked per-row immediately. When the
  re-flow shifts dates **later** (add blackout), update play rows in **descending**
  date order so each target night is vacated before it's filled; when shifting
  **earlier** (remove blackout), update in **ascending** order. This avoids
  transient duplicate-date violations without a transaction.
- **Apply per toggle, not via a batched Save** *(confirmed by Ed)*. Because a
  blackout edit is now a whole-schedule structural recompute (insert row + N date
  updates + season end), each add/remove applies immediately to the DB and
  refetches, replacing the current "stage changes then Save" model. The Save button
  is removed. Batching multiple blackouts before applying would require composing
  several walks and is unnecessary complexity.
- **Warn-but-allow replaces hard-block.** `canEditWeek` currently returns `false`
  for past/completed weeks and `handleToggleWeekOff` toasts an error. Replace with
  a confirm-dialog warning that the operator can accept, per R5.

## Open Questions

### Resolved During Planning

- *Do playoffs/break shift when the season extends?* — Yes for playoffs (they're
  play weeks); break weeks are fixed-date skips the walk flows around (Ed: "playoff
  = extra regular play; week-off = blackout with a label").
- *Re-point matches or re-date rows?* — Re-date rows in place; no match changes.
- *RPC or client-side?* — Client-side pure function + ordered writes.

### Deferred to Implementation

- Exact helper/function names and file co-location (e.g. whether the apply step
  lives in `scheduleUtils.ts` or a new `src/api/mutations/` module) — settle when
  touching the code.
- (none remaining — apply-on-toggle and Save-button removal are confirmed)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review,
> not implementation specification. The implementing agent should treat it as
> context, not code to reproduce.*

Add-blackout walk, 3 regular + 1 playoff season, league night = Wednesday.
`R`=regular play, `P`=playoff play, `X`=skip (blackout/break):

```
BEFORE (blackout the 7/08 play night):
  7/01  R  Week 1
  7/08  R  Week 2     <-- operator blacks this out
  7/15  R  Week 3
  7/22  X  Season End Break   (fixed-date skip)
  7/29  P  Playoffs

WALK: skip set = { 7/08 (new), 7/22 (break) }; play order = [W1, W2, W3, Playoff]
  7/01  not skip -> W1
  7/08  skip     -> blackout (NEW row)
  7/15  not skip -> W2      (row kept, re-dated 7/08 -> 7/15, matches intact)
  7/22  skip     -> break   (kept, fixed)
  7/29  not skip -> W3      (re-dated 7/15 -> 7/29)
  8/05  not skip -> Playoff (re-dated 7/29 -> 8/05)

AFTER: 4 play weeks preserved; +1 blackout row; season end 7/29 -> 8/05.
Matches: untouched — every play row kept its id.
```

Reconciliation plan the pure function returns (directional shape):

```
{
  insertSkips:  [{ scheduled_date: '2026-07-08', week_type: 'blackout', week_name }],
  deleteWeekIds: [],                       // populated on REMOVE instead
  dateUpdates:  [ {id: W2.id, date:'2026-07-15'},
                  {id: W3.id, date:'2026-07-29'},
                  {id: P.id,  date:'2026-08-05'} ],  // applied desc-date order
  newSeasonEndDate: '2026-08-05'
}
```

## Implementation Units

- [ ] **Unit 1: Pure re-flow reconciliation function**

**Goal:** Given the current `season_weeks` (id, date, type, weekNumber,
weekCompleted) and an action (`add` | `remove` a blackout at date `D`), compute
the reconciliation plan: rows to insert, rows to delete, per-row date updates, and
the new season end date — using the canonical weekly cadence walk, timezone-safe.

**Requirements:** R1, R2, R3, R4, R6, R7

**Dependencies:** None

**Files:**
- Create: `src/utils/scheduleReflow.ts`
- Test: `src/utils/scheduleReflow.test.ts`

**Approach:**
- Classify rows: play = `regular` + `playoffs` (ordered: regular by week number
  ascending, then playoffs by date ascending); skip = `blackout` +
  `season_end_break` (kept at their dates).
- Build the new skip-date set: current skip dates `∪ {D}` for add, `\ {D}` for
  remove. (`D` for add is the date of an existing play row; for remove it's an
  existing blackout row.)
- Walk league-nights weekly from the season's first week date using `+7` day
  steps and `formatDateForDB`/`parseLocalDate`. For each night: if it's a skip
  date, it's a skip row; otherwise assign the next play week in play order,
  recording a `dateUpdate` when the play row's date changed.
- For **add**: emit an `insertSkips` entry for `D` (carry the reason/label).
  For **remove**: emit `deleteWeekIds` for the blackout row at `D`.
- `newSeasonEndDate` = max assigned date across all rows after the walk.
- Return a plain data object; perform **no** I/O. Determinism: output dates
  strictly increasing, one play row per play week, play-week count invariant.

**Patterns to follow:**
- `src/utils/scheduleUtils.ts` `generateSchedule()` cadence/step logic.
- `src/utils/formatters.ts` for every date conversion.

**Test scenarios:**
- *Happy path:* add blackout on a mid-season regular night → that date appears in
  `insertSkips`; every later play week's date shifts exactly +7; play-week count
  unchanged; `newSeasonEndDate` = old end +7.
- *Happy path:* add blackout on the **first** play night → all play weeks shift +7.
- *Happy path (playoffs):* season with a playoff week → playoff date shifts +7 with
  the rest; playoff remains the last play week.
- *Edge:* an existing `season_end_break` sits after the target → break date stays
  fixed; play weeks flow around both the new blackout and the break.
- *Edge:* shifting pushes a play week onto an existing skip date → walk skips it and
  lands on the following night (no play week assigned to a skip date).
- *Remove:* remove a mid-season blackout → its id in `deleteWeekIds`; every later
  play week shifts −7; `newSeasonEndDate` = old end −7; play-week count unchanged.
- *Remove edge:* remove a blackout adjacent to a break → break stays; play weeks
  pull in by one night only.
- *Invariant:* for any input, returned play-week count == input play-week count,
  and returned dates contain no duplicates and are strictly increasing.

**Verification:** `scheduleReflow.test.ts` passes; the function is pure (no
supabase import) and reused by Unit 2.

---

- [ ] **Unit 2: Apply the reconciliation plan (persistence)**

**Goal:** Apply a reconciliation plan from Unit 1 to the database: insert the
blackout row (or delete it on remove), update play-row dates in collision-safe
order, and update `seasons.end_date` — leaving all `matches.season_week_id`
bindings intact.

**Requirements:** R1, R2, R3, R6, R7

**Dependencies:** Unit 1

**Files:**
- Create: `src/utils/scheduleReflowApply.ts` (or co-locate in `scheduleUtils.ts`
  — decide at implementation time)
- Test: `src/__tests__/database/scheduleReflowApply.test.ts`
  *(first line: `// @vitest-environment jsdom`)*

**Approach:**
- For **add**: shift play-row date updates in **descending** date order (vacate
  target nights first), then `insert` the new `blackout` row. For **remove**:
  `delete` the blackout row first, then apply date updates in **ascending** order.
  This dodges the immediate `UNIQUE(season_id, scheduled_date)` check without a
  transaction.
- Update `seasons.end_date` to `newSeasonEndDate`.
- Never touch `matches`. After apply, every pre-existing play row's `id` still
  exists with its matches bound.
- Return a typed result/error; log failures via `src/utils/logger.ts`.

**Execution note:** Add DB-level characterization coverage first — assert
match-binding invariants against real Postgres before wiring the UI, since the
silent-strand bug is exactly a binding/integrity failure.

**Patterns to follow:**
- `src/utils/scheduleUtils.ts` `syncPlayoffWeeks()` for the supabase
  insert/update shape against `season_weeks`.
- `src/__tests__/database/` existing suites for local-Postgres setup, sequential
  jsdom env, and BEGIN/ROLLBACK-style isolation.

**Test scenarios:**
- *Integration (add):* seed a season (e.g. 3 regular + 1 playoff) with generated
  matches → apply add-blackout → DB has a new `blackout` row on `D`; the four play
  rows are re-dated per plan; **every match's `season_week_id` is unchanged** and
  match count is identical; no unique-constraint error; `seasons.end_date` advanced.
- *Integration (remove):* apply remove-blackout → blackout row gone; play rows
  pulled in; matches still bound; `end_date` pulled in.
- *Integration (played week):* a play row with `week_completed=true` and recorded
  match results gets re-dated → results and bindings survive; only the date changes.
- *Error path:* a forced mid-sequence failure leaves the schedule recoverable
  (rows valid, no orphaned matches) — documents the accepted non-atomic behavior.

**Verification:** the database suite passes under the `db` project; a manual
re-flow on a seeded season shows preserved play-week count and intact matchups.

---

- [ ] **Unit 3: Wire the edit page + warn-but-allow**

**Goal:** Make `SeasonScheduleManager` call the Unit 1/2 re-flow on blackout
add/remove (applying immediately and refetching), and replace the past/completed
hard-block with a warn-but-allow confirm.

**Requirements:** R1, R2, R5

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/operator/SeasonScheduleManager.tsx`
- Test: `src/operator/SeasonScheduleManager.test.tsx`
  *(co-located unit test; mocked supabase / re-flow apply)*

**Approach:**
- `handleToggleWeekOff`: on adding a blackout, collect the reason via the existing
  `WeekOffReasonModal`, then compute (Unit 1) + apply (Unit 2) + refetch. On
  removing, compute + apply + refetch directly.
- Replace `canEditWeek`'s hard-block: if the target week is past
  (`date < today`) or `week_completed`, show a `useConfirmDialog` warning
  ("This week is in the past / already played — players may have already used these
  dates. Re-flow anyway?") and proceed only on confirm. Never block.
- Remove the staged-changes "Save" model now that toggles apply immediately
  (confirmed — see Key Technical Decisions).
- Keep conflict-detection display wiring as-is.

**Patterns to follow:**
- Existing `useConfirmDialog` usage in this file (`handleCancel`).
- Existing `WeekOffReasonModal` invocation.

**Test scenarios:**
- *Happy path:* toggling a future regular week to blackout (with a reason) invokes
  apply with an `add` action and refetches.
- *Happy path:* toggling an existing blackout off invokes apply with a `remove`
  action.
- *Warn path:* toggling a **past** or **completed** week opens the confirm dialog;
  confirming proceeds to apply; cancelling makes no DB call.
- *Edge:* apply failure surfaces a toast and leaves the displayed schedule
  consistent after refetch.

**Verification:** `SeasonScheduleManager.test.tsx` passes; manual click-through on
a seeded active season: blacking out a mid-season week extends the tail by one
week, the matchups follow their weeks, and the play-week count holds; a past-week
edit warns first.

## System-Wide Impact

- **Interaction graph:** writes to `season_weeks` (insert/delete/date-update) and
  `seasons.end_date`. Readers that order `season_weeks` by `scheduled_date`
  (`ScheduleView`, conflict detection, the generator's regular-week fetch) keep
  working — they already assume date order, not contiguity.
- **Error propagation:** apply step returns typed errors → toast in the component;
  partial failure is recoverable (accepted) and logged.
- **State lifecycle risks:** the `UNIQUE(season_id, scheduled_date)` constraint is
  the main hazard — mitigated by ordered updates (Unit 2). No cache duplication;
  the page refetches after apply.
- **API surface parity:** the setup-time re-flow (`ScheduleReview`) already behaves
  correctly and is intentionally left as the separate, generation-time path — this
  plan brings the *edit* path to the same model without merging the two.
- **Integration coverage:** the match-binding invariant (R3) is the load-bearing
  guarantee and is covered by the `db` project test in Unit 2 — unit mocks alone
  cannot prove `matches.season_week_id` survives a real re-date.
- **Unchanged invariants:** matchup generation, the matchup tables, match creation,
  and the `season_weeks` schema are all unchanged; matches are never re-pointed.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Transient `UNIQUE(season_id, scheduled_date)` violation during multi-row date shift | Ordered updates: descending-date for extend, ascending-date for contract (Unit 2) |
| Non-atomic apply leaves a half-shifted schedule on mid-failure | Accepted — dates are advisory and recoverable (Ed: "fix or break it"); failure is logged + toasted; re-running the toggle re-derives a clean walk |
| Pre-existing stranded matches from past in-place blackouts | Out of scope (Deferred to Separate Tasks); dev data disposable; affected league already regenerated |
| UX shift from staged-Save to apply-on-toggle surprises the operator | Confirmed by Ed; per-toggle confirm dialog (for past/played weeks) keeps the action deliberate |
| Timezone off-by-one in the date walk | Exclusively use `parseLocalDate` / `formatLocalDate` / `formatDateForDB`; covered by Unit 1 pure tests |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for the new `src/utils/scheduleReflow.ts` (and the
  apply module + test files).
- No migration required (no schema change). If the RPC alternative is ever chosen,
  it would need a full-timestamp migration and a `DEFERRABLE` constraint — not in
  this plan.

## Sources & References

- Related code: `src/operator/SeasonScheduleManager.tsx`,
  `src/utils/scheduleUtils.ts` (`generateSchedule`, `syncPlayoffWeeks`),
  `src/utils/scheduleGenerator.ts`, `src/types/season.ts`,
  `src/utils/formatters.ts`
- Schema: `supabase/migrations/20251130010824_baseline.sql`
  (`season_weeks`, `matches`, `UNIQUE(season_id, scheduled_date)`)
- Related prior fix: PR #208 (conflict flags read the source-of-truth date table)
- Adjacent design doc: `docs/brainstorms/2026-06-09-bye-team-and-auto-forfeit-requirements.md`
