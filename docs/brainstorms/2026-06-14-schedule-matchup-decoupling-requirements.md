# Schedule ⇄ Matchup Decoupling — Requirements

**Created:** 2026-06-14
**Status:** Ready for planning
**Type:** Architectural overhaul (scheduling model)

## Problem

Season "week numbers" are **stored** (`season_weeks.week_name = "Week 3"`) and set by
multiple code paths that disagree about how to count — so they drift, and the bug
class is real and live.

**Triggering prod case:** a 10-team / 14-week season with 3 holiday blackouts was
generated mis-numbered — its 13 regular play weeks are labeled **1, 3, 4, 5 … 14**
(the first blackout bumped the count once, so every regular week after it is one too
high; the 13th play week is "Week 14"). Then the **Change Season Length** feature
(in `src/operator/SeasonScheduleManager.tsx`) **collided** — it counts existing play
weeks to number the appended ones, hit the inflated count, and produced a duplicate
"Week 14". The matchups underneath were correct; only the stored labels were wrong.

The root cause is that a **derived fact (the week number) is being stored**, by
several writers, with no single source of truth — and the stored string is then
**parsed back into logic**: `SeasonScheduleManager.tsx` does
`extractWeekNumber(week.week_name)` to recover the integer, and four call sites
branch on `week_name === 'Season End Break'` to decide a week's *type*. So the label
isn't just displayed — it's load-bearing control flow today. That's the deeper bug:
intent is being round-tripped through a human-readable string.

## The model (locked in this brainstorm)

Decouple the two things that were tangled into "a week," so neither owns the other's
job:

### 1. The Schedule = a list of dated slots
A season's schedule is just weekly dates (7 days apart), each with **one of three
`week_type`s**:

- **`regular`** — a play date whose matches come from the chart.
- **`playoffs`** — a play date whose matches come from final standings.
- **`blackout`** — a **labeled skip** (no play). Carries a free **label/reason**
  ("Independence Day", "APA Nationals", or "Week Off").

The generator **walks** the dates from the start:

> for each weekly date:
>  • blackout date? → place a `blackout` (skip) with its label
>  • else regularCount < seasonLength? → place a `regular`, regularCount++
>  • else playoffCount < playoffWeeks? → place a `playoffs`, playoffCount++
>  • else → **stop.** The next date = the suggested **next-season start date**.

The schedule's only job is to produce enough `regular` dates, then the `playoffs`
dates. **It knows nothing about week numbers.**

The old **`season_end_break`** type is **dropped** — a "week off" before / between /
after playoffs is just a `blackout` labeled "Week Off". One skip concept, not two.

### 2. The Matchups own the order
The matchup **charts** (`src/data/matchupTables/`, e.g. `10-team.ts`) define a fixed
rotation: round 1 = `[1v2, 3v4, 5v6, …]`, round 2 = `[2v5, 4v6, 1v3, …]`, … . **Matches
must be played in that chart order, and that order IS the week number.** The order is
intrinsic to the matchups (from the chart), not to the calendar.

- **Regular** matches are **pre-made with teams** from the chart, in order.
- **Playoff** matches are created as **empty placeholders (no teams)** and **populated
  from final standings at season end** (`populatePlayoffMatches`). That matchup
  *source* (chart vs standings) is the **only** reason playoff weeks are typed
  differently from regular weeks.

### 3. The binding: round N → the Nth regular date
Round/order N plays on the Nth `regular` date. Week 1 → earliest regular date, week 2
→ 2nd regular date, etc. Because of this:

- **Add a blackout mid-season** → insert one `blackout` date; the regular dates shift
  by position and every match re-resolves to its Nth-regular date. Nothing to renumber.
- **Add weeks** → create more `regular` dates + generate matches for rounds N+1, N+2.
  No reordering, no relabeling, no collisions possible.

### 4. Numbers are derived, never stored
There is **no stored `week_name`.** "Week N" is **derived** from a regular week's
position among the regular weeks (by date). Playoffs render "Playoffs" (or "Playoffs
Week k", k = position among playoff weeks); blackouts render their label. **A blackout
never gets a week number.**

**Load-bearing invariant:** the derived number is only correct if *regular weeks'
dates are monotonic in chart-round order* — i.e. the Nth-earliest regular date holds
chart round N. This holds today because (a) `season_weeks` enforces
`UNIQUE(season_id, scheduled_date)`, so no two regular weeks share a date and the
order is total; and (b) dates are only ever written by the generator and the reflow
(both walk 7-day steps in order) — there is no free-form per-week date editor. If such
an editor is ever added, this invariant must be guarded (the order is by date, not by
an independent stored round). This is the one assumption the whole model rests on, so
it is stated explicitly rather than left implicit.

## Decisions resolved in this brainstorm

1. **Where the order-number lives → derive from position (no second source of truth).**
   The order = a regular week's position among regular weeks (by date), read at render
   time. Matches keep binding to their slot via `season_week_id`; the slot's regular
   position *is* the round (by construction — the generator fills the Nth regular slot
   with chart round N). *(Ed delegated this call; the alternative — stamping an explicit
   `order` column on matches — was rejected: a pure version would rip `season_week_id`
   out of every match query (huge churn, risky for a live app), and a hybrid version
   reintroduces the exact two-writers drift this overhaul exists to kill. Deriving is the
   single-source-of-truth, and the blackout-reflow already maintains it.)* **Prior
   art:** a `database/migration_matches_add_round_number.sql` draft already exists (an
   immutable `round_number` stamped at generation — writer = generator only, so NOT the
   two-writers case). The planner should weigh it as the strongest form of the
   alternative; an immutable round stamped once is defensible, but the read-time
   derivation still wins on *zero schema change to a live `matches` table* and on the
   reflow already maintaining position. Settle it in the plan, not by reflex.
2. **Blackout label home.** With `week_name` gone, a blackout's reason ("Independence
   Day" / "Week Off") moves to a dedicated **label/reason** field used only by skips.
   **This requires a one-time backfill**, not free self-healing: every existing blackout
   stores its reason *inside* `week_name` today (`SeasonSchedulePage.tsx:366` reads it),
   so the migration must copy `week_name → label` for `week_type IN ('blackout',
   'season_end_break')` *before* `week_name` stops being read. (The `notes` column is
   currently NULL on all blackout rows — reusing it is one option for the planner.)
3. **`season_end_break` is dropped** as a distinct type — folded into `blackout`
   ("Week Off"). Three week types total: `regular` / `blackout` / `playoffs`.
4. **`nextSeasonStartDate`** = the date immediately after the last placed week; surfaced
   as a *suggestion* to the next-season setup flow.

## Requirements

- **R1** — The schedule generator produces dated slots via the walk above; `regular`
  count = `seasonLength`, `playoffs` count = `playoffWeeks`, blackouts skipped; stop
  after the last playoff; expose the next date as the suggested next-season start.
- **R2** — Three week types only: `regular` / `blackout` / `playoffs`. A blackout
  carries a free label/reason. No `season_end_break`.
- **R3** — No stored week number. "Week N" for a regular week = its 1-based position
  among the season's regular weeks ordered by date. Playoffs = "Playoffs" / "Playoffs
  Week k". Blackouts show their label, never a number.
- **R4** — Matches bind to their slot (`season_week_id`); the round = the slot's regular
  position. Regular matches are pre-filled from the chart in round order; playoff
  matches are placeholders filled from standings at season end (unchanged from today).
- **R5** — Add-a-blackout and change-season-length operate purely on slots: insert/
  remove dated slots + (for lengthen) generate matches for the new rounds. Neither
  renumbers anything; numbers re-derive. The blackout-reflow already follows this model
  (`scheduleReflow.ts`) — align generation + lengthen to it.
- **R6** — A single derive-the-label helper is the one source for week labels; every
  *display* surface uses it (see Blast radius). Deriving **self-heals existing
  mis-numbered regular-week NUMBERS** (the bad stored numbers simply stop being read) —
  but **not blackout labels**, which need the one-time backfill (Decision #2).
- **R7** — Every place that **branches on** `week_name` (control flow, not display) must
  be converted to read `week_type` instead: the four `week_name === 'Season End Break'`
  type-decisions and the `extractWeekNumber(week.week_name)` parse. A display helper
  cannot replace these — they are logic that currently reads intent out of a string.

## Scope boundaries (non-goals)

- **Not** changing the matchup **charts** (`src/data/matchupTables/`) — the rotations
  are correct.
- **Not** changing how playoffs **seed** (the place-pairing / standings → bracket
  logic shipped separately).
- **Not** the one-off **prod data fix** for the existing mis-numbered season (a renumber
  SQL is drafted, to run after the live Week-1 games — that's a data fix, not this
  overhaul). Once this ships, deriving makes that data fix unnecessary going forward.
- **Not** changing the match ⇄ week binding mechanism (`season_week_id` stays).

## Success criteria

- A blackout season generates with **no number gaps and no duplicate labels** — regular
  weeks read 1…N consecutively.
- **Adding a blackout or lengthening** a season never produces a duplicate or skipped
  week number, on any season including ones with blackouts.
- Existing mis-numbered seasons **render correct regular-week numbers** with no data
  migration (numbers derived from position). Existing **blackout labels** survive via
  the one-time `week_name → label` backfill.
- No live match is disrupted; the match ⇄ slot binding is unchanged. The rollout order
  (helper + all readers/control-flow migrated off `week_name` *before* the column is
  dropped) never leaves a live captain's view blank mid-season.

## Blast radius (for the planner)

- **Schema:** retire `season_weeks.week_name`; add a blackout **label/reason** field;
  drop/merge the `season_end_break` type.
- **Generator:** rewrite to the three-type walk. Pinpoint the *actual* save path that
  mis-numbered the prod season (`generateSchedule()` in `src/utils/scheduleUtils.ts` is
  already play-numbered + skips blackouts, so the bug is in the saved path — likely the
  v2 wizard `src/components/season/ScheduleReview.tsx` + `src/wizards/schedule-v2/useSaveScheduleV2.ts`,
  or an older non-v2 generator).
- **`week_name` sweep — split into TWO buckets** (~26 files reference it; they are not
  all display):
  - *Display* → route through one derive helper: `SeasonSchedulePage`, `ScheduleView`,
    `WeekCard`/`WeekEditorView`, `MatchCard`/`MatchDetailCard`, `ReviewStep`, operator
    cards, player spectate/`MyTeams`.
  - *Control flow* → convert to read `week_type` (R7): `seasons.ts:169`,
    `useSaveScheduleV2.ts:24`, `ScheduleReview.tsx:149`, `ScheduleWeekRow.tsx:34`
    (all `=== 'Season End Break'`), and `SeasonScheduleManager.tsx:128/197`
    (`extractWeekNumber`). These silently evaluate false/NaN if missed — no crash,
    worst failure mode. Enumerate every use as display-vs-control before touching it.
- **Align to the shared model:** the lengthen lives in `src/operator/SeasonScheduleManager.tsx`
  (stop counting/parsing stored labels; append regular slots + their matches and let the
  number derive) and the blackout-reflow (`scheduleReflow.ts` / `scheduleReflowApply.ts`,
  already correct). The reflow's snapshot/revert path (`restoreScheduleSnapshot`) must
  restore the new blackout-label field for skip rows, not `week_name`.
- **Rollout ordering (live seasons):** (1) ship derive helper + migrate ALL readers and
  control-flow off `week_name`/`'Season End Break'`; (2) backfill `week_name → label` for
  skip rows, migrate `season_end_break` rows → `blackout`, relax the `week_type` CHECK
  constraint; (3) only then drop `week_name` (`NOT NULL` today, written by ~8 insert
  sites + dev seeds — all updated in lockstep). Keep-but-ignore through the transition,
  not a same-deploy drop. Decide whether the separate prod renumber SQL still runs or is
  cancelled (derivation makes it moot).

## Constraints

React 19 + TS + react-router + Supabase. **Live matches must never be disrupted**
(36 players mid-match). KISS. The `scheduleReflow.ts` model is already locked + correct
(its header: *"the Nth play week resolves to the Nth play-night once skips are removed
from the calendar walk … re-dates play rows in place and NEVER touches matches"*) —
generation + lengthen align to it.

## Open questions (deferred to planning)

- Exact migration strategy for retiring `week_name` (drop the column vs keep-but-ignore
  during a transition) given live seasons — a plan-time call.
- Where precisely the `nextSeasonStartDate` suggestion surfaces in the next-season setup
  flow.
