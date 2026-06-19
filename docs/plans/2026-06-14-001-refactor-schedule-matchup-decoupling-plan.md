---
title: "refactor: Schedule ⇄ Matchup decoupling — derive week numbers, drop stored week_name"
type: refactor
status: active
date: 2026-06-14
origin: docs/brainstorms/2026-06-14-schedule-matchup-decoupling-requirements.md
---

# refactor: Schedule ⇄ Matchup Decoupling

## Overview

Stop **storing** the season week number. Today `season_weeks.week_name` holds
`"Week 3"` and is written by several code paths that disagree about how to count — and
worse, it is **parsed back into control flow** (`extractWeekNumber`, four
`week_name === 'Season End Break'` branches, a second lock-parser, and BCA/APA
substring matches). That round-trip of intent through a human string is the bug class:
a blackout-bumped count produced a season labeled `1, 3, 4 … 14` in prod, then the
Change Season Length feature collided into a duplicate `"Week 14"`.

The fix: the **schedule** is a list of dated, typed slots (`regular` / `blackout` /
`playoffs` — `season_end_break` folds into `blackout` with a label); the **matchups**
own the round order from the chart (`src/data/matchupTables/`), already bound round-N →
Nth regular date by `scheduled_date ASC`; and **"Week N" is derived** from a regular
week's position among regular weeks, never stored. Blackout reasons move out of
`week_name` into the existing-but-unused `notes` column.

This is sequenced as three independently-shippable phases so no live season (36 players
mid-match) is ever disrupted: **A.** add the derive helper + move every reader/branch
off `week_name` (read-only, self-heals mis-numbered seasons); **B.** data migration —
backfill labels into `notes`, collapse `season_end_break` → `blackout`, align writers;
**C.** drop the `week_name` column.

## Problem Frame

See origin: `docs/brainstorms/2026-06-14-schedule-matchup-decoupling-requirements.md`.
A derived fact (the week number) is stored by multiple writers with no single source of
truth, then parsed back into logic. The exact historical writer that produced the prod
mis-numbering (`generateSchedule()` churn vs. `applySeasonLengthChange.ts`'s
count-based `Week ${regulars.length + j + 1}`) is **moot under this refactor** — once the
number is derived from position and never stored, no writer can drift or collide. The
matchups underneath were always correct; only the stored labels were wrong.

## Requirements Trace

- **R1** — Generation/display produces consecutive `Week 1…N` for regular weeks by date
  position, with no gaps or duplicates, even with interspersed blackouts. (origin R1, R3)
- **R2** — Three week types only: `regular` / `blackout` / `playoffs`; `season_end_break`
  removed. A blackout carries a free label. (origin R2)
- **R3** — No stored week number; "Week N" derived from regular-week position. Playoffs
  → "Playoffs"/"Playoffs Week k"; blackouts → their label. (origin R3)
- **R4** — Matches keep binding via `season_week_id`; no new match column. (origin R4, decision #1)
- **R5** — Existing mis-numbered seasons render correct **numbers** with no data
  migration; existing blackout **labels** survive via a one-time `week_name → notes`
  backfill. (origin R6, success criteria)
- **R6** — Every reader through one derive helper (display) or `week_type`/position
  (control flow); no silent NaN/false failures. (origin R6, R7)
- **R7** — Live-season-safe rollout order; matches never disrupted; reflow's
  position-binding model preserved. (origin constraints)

## Scope Boundaries

- **Not** changing the matchup charts (`src/data/matchupTables/`) — rotations are correct.
- **Not** redesigning playoff seeding/bracket math; playoff matches stay placeholders
  filled from standings via `populatePlayoffMatches` (`src/utils/playoffGenerator.ts`).
- **Not** changing the match ⇄ week binding mechanism (`season_week_id` stays).
- **Not** adding the immutable `round_number` match column (the
  `database/migration_matches_add_round_number.sql` draft) — derive-from-position wins
  (see Key Technical Decisions); that draft is parked/deleted.

### Deferred to Separate Tasks

- **`nextSeasonStartDate` output** (date after the last placed week, fed to the
  next-season wizard): additive feature, not part of killing the drift bug. Origin
  Decision #4 resolves the *value*; *where it surfaces* stays a follow-up.
- **Per-week free-form date editor guard:** none exists today (dates only written by
  generator + reflow), so the monotonic-date invariant holds. If such an editor is ever
  built, it must guard the invariant — out of scope here.
- **`nextSeasonStartDate`** surfacing — see above.

> **NOT cancelled — sequenced:** the one-off prod renumber SQL is **kept and run
> deliberately *before* Phase A**, not cancelled. See "Live-season renumber is a
> conscious act" below — derivation does the renumber too, but invisibly and all-at-once
> on a code deploy, which is *less* safe than a controlled SQL run at a chosen quiet
> moment.

## Context & Research

### Prerequisite: branch from fresh main

This branch (`fix/ios-bottom-nav-dvh`) is **8 commits behind `origin/main`** and does
**not** contain the Change Season Length feature. Implement on a new branch cut from
**updated `origin/main`**, which has `src/utils/applySeasonLengthChange.ts`,
`src/operator/components/ChangeSeasonLengthDialog.tsx`, and migration
`supabase/migrations/20260611000002_add_team_schedule_position.sql`. Re-confirm all
file:line references below against fresh main before editing.

### Relevant Code and Patterns

**Schema** (`supabase/migrations/20251130010824_baseline.sql:1992-2003`, mirror
`database/schema_dump.sql:1752-1758`):
- `week_name text NOT NULL`
- `week_type varchar(20) NOT NULL CHECK (week_type IN ('regular','blackout','playoffs','season_end_break'))`
- `notes text` (nullable, **currently unused** — every writer hardcodes `notes: null`)
- `week_completed boolean NOT NULL default false` (lock logic, adjacent)
- `UNIQUE(season_id, scheduled_date)` (named `unique_season_date`) — the invariant that
  makes regular-weeks-by-date a **total** order

**Generator/binding** (`src/utils/scheduleGenerator.ts`): `fetchSeasonWeeks()`
selects `week_type='regular'` ordered by `scheduled_date ASC`; `generateAllMatches()`
indexes `matchupTable[weekIndex % cycleLength]` — so the Nth regular date by definition
holds chart round N. Already exactly the model.

**Reflow** (`src/utils/scheduleReflow.ts` locked header): play = `regular`+`playoffs`,
skip = `blackout`+`season_end_break`; re-dates play rows in place, never touches
matches. `restoreScheduleSnapshot()` (`src/utils/scheduleReflowApply.ts:200-219`)
restores `week_name` for **both** play and skip rows on revert — a Phase B/C touch-point.

**Writers of `season_weeks.week_name`:** `src/api/mutations/seasons.ts:164-193`
(`createSeason`), `src/wizards/schedule-v2/useSaveScheduleV2.ts:30-62`,
`src/utils/scheduleUtils.ts:107-201` (`syncPlayoffWeeks`),
`src/utils/scheduleReflowApply.ts:108,203,213`, `src/utils/applySeasonLengthChange.ts`
(on main; `Week ${regulars.length + j + 1}`), dev seeds (`database/dev_starting_point.sql`
+ other seed files).

**Readers — CONTROL FLOW (convert to `week_type`/position/label):**
- `src/api/mutations/seasons.ts:169`, `src/wizards/schedule-v2/useSaveScheduleV2.ts:24`,
  `src/components/season/ScheduleReview.tsx:149`,
  `src/components/season/ScheduleWeekRow.tsx:34` — `=== 'Season End Break'`
- `src/operator/SeasonScheduleManager.tsx:128,197-200` — `extractWeekNumber(week_name)`
- `src/components/season/ScheduleWeekRow.tsx:40-50` — `getPlayWeekNumber` (second parser)
- `src/operator/SeasonScheduleManager.tsx:479,495` — `weekName.includes('bca'|'apa'|'championship')`

**Readers — DISPLAY (route through helper):** `src/components/MatchCard.tsx:70`,
`src/components/MatchDetailCard.tsx:92`, `src/components/schedule/WeekCard.tsx:39`,
`src/components/schedule/WeekEditorView.tsx:193`,
`src/components/season/ScheduleWeekRow.tsx:80`,
`src/components/operator/PlayoffsCard.tsx:165`, `src/components/operator/ScheduleCard.tsx:131`,
`src/components/operator/SeasonCard.tsx:107` (blackout reason),
`src/wizards/matchups-v2/steps/ReviewStep.tsx:184`, `src/operator/ScheduleView.tsx:90,203`,
`src/operator/SeasonSchedulePage.tsx:366`, `src/operator/PlayoffSetup.tsx:351`,
`src/player/MyTeams.tsx:265`, `src/player/TeamSchedule.tsx:209,372`,
`src/player/SpectateLiveMatches.tsx:110-112`, `src/player/SpectateMyLiveMatches.tsx:126-128`.

### Institutional Learnings

- **Blackout-reflow plan** (`docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md`):
  every play row keeps its `id`/bound matches across a re-flow; align to this model.
- **db vitest isolation** (`memory: project_db_test_shared_postgres_isolation`): the `db`
  project runs sequentially vs one shared local Postgres with no reset — any
  `season_weeks`-mutating test must tx-scope (`BEGIN…ROLLBACK`) or snapshot+restore in
  `afterAll`, pick fixtures deterministically (`ORDER BY id LIMIT 1`).
- **Consolidate migrations in a PR** (`memory: feedback_consolidate_migrations_in_pr`):
  collapse add-then-drop sequences into clean migrations before merge; forward-only.
- **Stale doc:** `memory-bank/scheduleReviewSystem.md` documents the *stored-weekName*
  model this refactor overturns — retire/update it.
- **Dev data disposable** (`memory: feedback_dev_data_disposable`): no real users — but
  the brainstorm deliberately treats this as a *live-season* migration (existing seasons
  must keep rendering), so the rollout ordering is real, not skippable.

## Key Technical Decisions

- **Derive-from-position, not a stored `round_number`** (origin decision #1): the
  generator already binds round N → Nth regular week by `scheduled_date`; the reflow
  already maintains position; deriving needs **zero schema change to the live `matches`
  table** (36 players mid-match). The drafted immutable-`round_number` migration is the
  strongest counter-form, but an immutable column still adds a write/read surface and a
  backfill to `matches` for no gain over position. **Park/delete the draft.**
- **Blackout label home = the existing `notes` column** (origin decision #2): nullable
  and unused today, so reusing it needs no new column — just a backfill and writer
  updates. (If a future reader needs to *machine-distinguish* a season-end break from a
  holiday, that needs a structured flag, not a label-substring match — noted, not built.)
- **One pure derive helper** over an already-loaded ordered week list, returning a
  `weekId → label` map (computed once per season fetch) — **never a per-call DB fetch**
  (avoids N+1). Branches on `week_type`: `regular` → `Week ${position}` (1-based among
  regular weeks by date); `blackout` → its label (`notes ?? week_name` during transition);
  `playoffs` → `Playoffs` / `Playoffs Week ${position-among-playoffs}`.
- **Three-phase keep-but-ignore rollout**, never a same-deploy column drop. `week_name`
  stays `NOT NULL` and keeps being written through Phases A–B (satisfying the constraint,
  read by nothing) and is dropped only in Phase C after staging verification.

## Live-Season Safety (read before Phase A)

Phase A is **not** a silent backend cleanup for a season that is mid-play. Two live
hazards must be handled before it deploys:

1. **Live-season renumber is a conscious act.** The prod season currently displays its
   stored labels (`1, 3, 4 … 14`). The instant Phase A deploys, every surface re-derives
   by position, so the post-blackout weeks **visibly shift down by one** (today's
   "Week 14" → "Week 13"). Players, captains, scorekeepers, standings sheets, and makeup
   references ("we owe a Week 9") have been using the old numbers all season. This is a
   user-visible relabel of already-played and in-progress weeks — present it as such, not
   as cost-free. **Mitigation (chosen): run the parked controlled renumber SQL
   deliberately *before* Phase A**, at a quiet moment, so stored == derived at deploy time
   and Phase A is a visual no-op for that season. (Alternative: deploy Phase A only between
   seasons / at an announced maintenance window with LO + captain notification.) Confirm
   with the affected LO before either path; check for external artifacts (printed
   standings, a league site) that reference the old numbers and will permanently mismatch.

2. **Verify the monotonic-date invariant against real data first.** Every derived number
   assumes regular weeks sorted by `scheduled_date ASC` equal chart-round order `1…N`.
   The plan trusts the generator/reflow to maintain this — but those same paths are what
   churned the prod labels, and the season was just reflowed/lengthened. **Phase A
   precondition (read-only gate):** for each live season, confirm the Nth-by-date regular
   week actually holds chart round N's matches (rank-by-date == the matchup-round the
   matches resolve to). If it fails, the season needs a data fix *before* derivation — a
   clean consecutive `1…N` bound to the *wrong* matchups is an invisible failure worse
   than a visible mislabel. *(Note: the current prod season's positions were already
   reconstructed + solver-verified earlier — `schedule_position` rebuilt from Week-1
   match order, all 13 play weeks checked — so it passes; bake the check in as a gate for
   any future live season regardless.)*

## Open Questions

### Resolved During Planning

- *Does the Change Season Length lengthen feature exist?* — Yes, on `origin/main`
  (`src/utils/applySeasonLengthChange.ts`), absent only from this stale branch. It is a
  writer to align in Phase B.
- *Where does the blackout label go?* — Reuse `notes` (nullable, unused).
- *Stored round vs derived?* — Derived (decision above).

### Deferred to Implementation

- Exact helper signature/name and whether it lives in `src/utils/scheduleDisplayUtils.ts`
  (exists) vs a new `src/utils/deriveWeekLabel.ts` — implementer's call; keep it pure.
- Whether `extractWeekNumber`/`getPlayWeekNumber` lock detection is cleanest as
  `week_type === 'regular'` + position-from-the-helper, or a small shared selector — settle
  while converting (both must yield the same play-week index the parser produced).
- Final consolidated migration shape (one file vs phase-per-file) — consolidate before
  merge per the learnings; phases may still land as separate PRs.

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

```
                 ┌─────────────────────────────────────────────┐
   SCHEDULE      │ season_weeks rows (dated, typed slots)        │
   (dates+types) │  week_type: regular | blackout | playoffs     │
                 │  scheduled_date (UNIQUE per season)           │
                 │  notes = blackout label (was week_name)       │
                 │  week_name = REMOVED in Phase C               │
                 └───────────────┬─────────────────────────────┘
                                 │  ordered by scheduled_date ASC
                                 ▼
   deriveWeekLabels(orderedWeeks) → Map<weekId, label>   ← ONE pure helper
                                 │   regular  → "Week " + (position among regulars)
                                 │   blackout → notes ?? week_name
                                 │   playoffs → "Playoffs[ Week k]"
                                 ▼
   every DISPLAY surface reads the map (no week_name)
   every CONTROL-FLOW branch reads week_type / position (no string parse)

   MATCHUPS: matches.season_week_id → slot; round = slot's regular position
             (generator already binds chart[weekIndex] → Nth regular date)
```

## Implementation Units

### Phase A — Derive + sweep (no schema change; read-only; self-heals numbers)

- [ ] **Unit A1: Pure derive-label helper + tests**

**Goal:** One pure function that, given a season's `season_weeks` rows, returns a
`weekId → display label` map with numbers derived from regular-week position.

**Requirements:** R1, R3, R6

**Dependencies:** None (branch from fresh main first)

**Files:**
- Create: `src/utils/deriveWeekLabel.ts` (or extend `src/utils/scheduleDisplayUtils.ts`)
- Test: `src/__tests__/unit/deriveWeekLabel.test.ts`

**Approach:**
- Input: an array of week rows (id, `week_type`, `scheduled_date`, `notes`, `week_name`).
- Sort regular weeks by `scheduled_date ASC`; the 1-based index = the number →
  `Week ${n}`. Sort playoff weeks the same way → `Playoffs` (single) or
  `Playoffs Week ${k}` (multi). Blackouts → `notes ?? week_name` (transition fallback;
  the `?? week_name` is removed in Phase C).
- Return a `Map`/record keyed by week id so callers compute **once per fetch**, never
  per row. Pure — no Supabase calls.

**Patterns to follow:** `src/utils/scheduleReflow.ts` (pure, I/O-free, `wk()` test
factory in `src/utils/scheduleReflow.test.ts`); `src/__tests__/unit/scheduleUtils.test.ts`.

**Test scenarios:**
- Happy path: 14 weeks, 13 regular + 1 blackout interspersed → regular weeks labeled
  `Week 1..13` consecutively; blackout shows its label, no number.
- Edge (the prod bug): rows whose stored `week_name` reads `1,3,4…14` (mis-numbered) →
  helper ignores stored strings and yields `Week 1..N` by position (self-heal).
- Edge: blackout before any regular week → first regular still `Week 1`.
- Edge: multiple playoff weeks → `Playoffs Week 1`, `Playoffs Week 2`; single → `Playoffs`.
- Edge: blackout label read from `notes` when present, else `week_name` (transition).
- Edge: single regular week; all-blackout season (no regulars) → no crash, empty numbers.

**Verification:** Helper is pure and unit-tested; given a mis-numbered fixture it returns
consecutive numbers; no DB access in the function.

---

- [ ] **Unit A2: Route every DISPLAY reader through the helper**

**Goal:** All ~16 display surfaces render the derived label instead of raw `week_name`.

**Requirements:** R3, R5, R6

**Dependencies:** A1

**Files (modify):** `src/components/MatchCard.tsx`, `src/components/MatchDetailCard.tsx`,
`src/components/schedule/WeekCard.tsx`, `src/components/schedule/WeekEditorView.tsx`,
`src/components/season/ScheduleWeekRow.tsx`, `src/components/operator/PlayoffsCard.tsx`,
`src/components/operator/ScheduleCard.tsx`, `src/components/operator/SeasonCard.tsx`,
`src/wizards/matchups-v2/steps/ReviewStep.tsx`, `src/operator/ScheduleView.tsx`,
`src/operator/SeasonSchedulePage.tsx`, `src/operator/PlayoffSetup.tsx`,
`src/player/MyTeams.tsx`, `src/player/TeamSchedule.tsx`,
`src/player/SpectateLiveMatches.tsx`, `src/player/SpectateMyLiveMatches.tsx`
- Test: `src/components/schedule/WeekCard.test.tsx` (representative render test)

**Approach:**
- **Two surface classes — the load-bearing decision, NOT mechanical:**
  - *Has the full week list in scope* (`ScheduleView`, `WeekCard`, `WeekEditorView`,
    `ReviewStep`, `SeasonSchedulePage`, operator cards): build the A1 map once, look up
    by id. `ScheduleView.tsx` groups by `week_name` today — regroup by week id, label via
    the map. `SeasonSchedulePage`'s no-op `blackout ? week_name : week_name` ternary →
    blackout uses label, others derived number.
  - *Only receives a single `match.season_week`* (`MatchCard`, `MatchDetailCard`,
    `SpectateLiveMatches`, `SpectateMyLiveMatches`, `MyTeams`, `TeamSchedule`): a single
    row **cannot** yield a position-based number. These need an explicit dependency —
    fetch the match's **own season's** ordered regular weeks once (a sibling
    `season_weeks` query, `order('scheduled_date')`), build the map, and pass a
    precomputed `weekLabel` **prop** down to `MatchCard` et al. Name the new query + the
    prop change here; do not ship a per-row derive (N+1) or a stale fallback. **Caveat:**
    the live/spectate views can show makeup matches from different weeks/seasons on one
    night — scope the position derive to *each match's own season*, not the visible set.
- **`MatchCard` prop change:** add `weekLabel?: string`; callers that have the season's
  week map pass it; the component stops reading `match.season_week.week_name`.

**Patterns to follow:** existing list-then-map rendering in `src/operator/ScheduleView.tsx`;
the matches queries in `src/api/queries/matches.ts` (where the sibling week-list fetch
attaches).

**Test scenarios:**
- Happy path: a week list with a blackout renders consecutive `Week N` + the blackout
  label (one representative component test; the rest are mechanical type-checked swaps).
- Integration: a mis-numbered season fixture renders corrected numbers end-to-end on one
  schedule surface.

**Verification:** `npx tsc --noEmit -p tsconfig.app.json` + `pnpm lint` + `pnpm build`
clean; no display surface references `week_name` directly except as the A1 fallback.

---

- [ ] **Unit A3: Convert every CONTROL-FLOW branch off `week_name`**

**Goal:** No logic reads intent out of a `week_name` string; all branch on `week_type`,
position, or the label field. Eliminates the silent-NaN/false failure mode.

**Requirements:** R2, R6

**Dependencies:** A1

**Files (modify):** `src/api/mutations/seasons.ts:169`,
`src/wizards/schedule-v2/useSaveScheduleV2.ts:24`,
`src/components/season/ScheduleReview.tsx:149`,
`src/components/season/ScheduleWeekRow.tsx:34,40-50`,
`src/operator/SeasonScheduleManager.tsx:128,197-200,479,495`
- Test: `src/components/season/ScheduleWeekRow.test.tsx`; for lock detection, extract the
  index/threshold logic into a pure helper and unit-test it at
  `src/__tests__/unit/scheduleManagerLock.test.ts` (golden test vs the old regex result)

**Approach — three DISTINCT conversions (don't unify them):**
- **(i) Type decisions** — the four `=== 'Season End Break'` branches → compare the
  in-memory `WeekEntry.type` field (`'week-off'`/`'season-end-break'`), not the human
  string. Writers still emit a `week_type`; Phase B changes *which* type, A3 only removes
  the string dependency.
- **(ii) Lock detection** — `extractWeekNumber` / `getPlayWeekNumber` → derive the
  play-week index from `week_type === 'regular'` + position (reuse A1's ordering), not a
  regex. `getCurrentPlayWeek()` / `isWeekLocked` behavior must stay **identical**
  (golden-tested). *(Note: this is the one place the swap is provably safe — both the
  threshold and the per-row index come from the same number source before and after, so
  the locked SET is invariant even for the `1,3,4..14` season.)*
- **(iii) Championship detection** — BCA/APA/championship `.includes()`
  (`SeasonScheduleManager.tsx` ~510/526 on main) is a **label substring search**, *not* a
  `week_type` read — do not pretend it converts to type. It stays a substring heuristic;
  it just needs to read the label from the right place. **Timing:** during Phase A the
  label is still in `week_name` (notes isn't backfilled until B1), so A3 leaves this
  reading `week_name`/`WeekEntry.weekName` *as a deliberate temporary exception*; **B2**
  threads `notes` into the `WeekEntry`/loader and repoints it. Honesty note: this is the
  same stringly-typed fragility the refactor exists to kill, **consciously left as a
  heuristic here** — a structured fix exists upstream (`operator_blackout_preferences.
  preference_type = 'championship'` + `championship_id`) but is not on the `season_weeks`
  row, so machine-identifying championship weeks is its own follow-up, out of scope.

**Inventory is a grep, not this hand list:** before editing, run
`git grep -nI 'week_name\|weekName' -- 'src/**/*.ts' 'src/**/*.tsx' ':!*.test.*'` on fresh
main (~32 files) and treat its output as the authoritative reader set — the line numbers
above are indicative only (this branch is 8 behind; e.g. `ScheduleReviewTable.tsx:65`
reads `weekName` in a render key and was missed by the brainstorm's hand list).

**Test scenarios:**
- Happy path: lock detection — given weeks with `week_completed`/position, the locked set
  is identical to today's regex-based result (golden test against a fixture).
- Edge: a blackout sits between regular weeks → play-week index for the next regular week
  is unchanged vs the old parser.
- Edge: season-end-break toggle still increments/decrements correctly without the string.
- Error/silent-failure guard: removing `week_name` from a fixture does **not** turn any
  branch into NaN/false (the whole point) — assert the type-based path is taken.

**Verification:** Lock/championship/break behavior unchanged by golden tests; grep shows
no remaining `week_name`/`weekName` string comparison or regex in control flow.

### Phase B — Data migration + writer alignment (additive schema; collapse `season_end_break`)

- [ ] **Unit B1: Migration — backfill labels, collapse `season_end_break`, relax CHECK**

**Goal:** Move blackout reasons into `notes`, convert `season_end_break` rows to
`blackout`, and relax the `week_type` CHECK to the three-type set. `week_name` stays
(now fully ignored).

**Requirements:** R2, R5, R7

**Dependencies:** A1–A3 deployed (nothing reads `week_name` for logic anymore)

**Files:**
- Create: `supabase/migrations/2026061x000000_schedule_decouple_labels_and_types.sql`
  (timestamp sorting after `20260612000000`; consolidate to one clean file before merge)
- Modify (mirror): `database/schema_dump.sql`, `database/season_weeks.sql`
- Test: `src/__tests__/database/scheduleDecoupleMigration.db.test.ts`

**Approach (directional SQL, not final):**
- `UPDATE season_weeks SET notes = week_name WHERE week_type IN ('blackout','season_end_break') AND notes IS NULL;`
- `UPDATE season_weeks SET week_type = 'blackout' WHERE week_type = 'season_end_break';`
- Drop + re-add the `week_type` CHECK without `'season_end_break'`
  (`regular`/`blackout`/`playoffs`).
- Leave `week_name` (`NOT NULL`) in place.
- **Order + atomicity:** convert the `season_end_break` rows → `blackout` **before**
  re-adding the narrowed CHECK (else `ADD CONSTRAINT` validation fails on surviving rows),
  and run the UPDATEs + CHECK swap in **one transaction** so a partial apply can't leave a
  `season_end_break` row that the new CHECK rejects on the next write. `UNIQUE(season_id,
  scheduled_date)` and the `matches` FK are untouched (no row deleted, no `id`/date
  changed), so they don't interfere.

**Execution note:** Characterization-first — capture a real season's blackout
labels/types before the migration and assert they survive after.

**Test scenarios (db project, jsdom, sequential; snapshot+restore in `afterAll`):**
- Happy path: a season with a holiday blackout (`week_name='Independence Day'`,
  `notes=NULL`) → after migration, `notes='Independence Day'`, `week_type='blackout'`.
- Happy path: a `season_end_break` row → `week_type='blackout'`, `notes` carries its label.
- Edge: a row with `notes` already set is not overwritten.
- Error: inserting a new `season_end_break` row after the migration is rejected by the CHECK.
- Integration: after migration, the A1 helper reads the blackout label from `notes`.

**Verification:** Migration runs clean on a copy of the dev DB; no `season_end_break`
rows remain; CHECK rejects the dropped type; blackout labels intact.

---

- [ ] **Unit B2: Align writers, generator, reflow, and seeds to the new model**

**Goal:** All write paths emit `blackout` (never `season_end_break`), put the label in
`notes`, and stop computing/parsing a stored number. `week_name` is still written
(transition, `NOT NULL`) but is now a dead value.

**Requirements:** R1, R2, R4, R7

**Dependencies:** B1

**Files (modify):** `src/api/mutations/seasons.ts`,
`src/wizards/schedule-v2/useSaveScheduleV2.ts`, `src/utils/scheduleUtils.ts`
(`generateSchedule` + `syncPlayoffWeeks`), `src/utils/scheduleReflowApply.ts`
(`applyBlackoutReflow` + `restoreScheduleSnapshot` — also snapshot/restore `notes`),
`src/utils/applySeasonLengthChange.ts`, dev seeds (`database/dev_starting_point.sql`,
`dev_seed_full.sql`, `dev_seed_minimal.sql`, `e2e_seed.sql`,
`database/staging_seeds/`)
- Test: `src/__tests__/database/scheduleReflowApply.db.test.ts` (extend),
  `src/__tests__/database/applySeasonLengthChange.db.test.ts` (extend),
  `src/__tests__/integration/SeasonCreationWizard.critical.test.tsx`

**Approach:**
- `generateSchedule()` emits `blackout` + `'Week Off'` label instead of
  `season_end_break`; stops needing to compute a correct `Week N` for storage (it may
  still set `week_name` for the transition, but nothing reads it).
- `syncPlayoffWeeks` writes the playoff label into `notes` (or leaves derived);
  `applySeasonLengthChange` stops the `Week ${regulars.length + j + 1}` numbering — it
  just appends `regular` slots + their matches; the number derives.
- `restoreScheduleSnapshot` snapshots/restores `notes` alongside the rest for skip rows.
- **Thread `notes` into the `WeekEntry`/`WeekDisplay` UI model + loaders** (e.g.
  `SeasonScheduleManager` loader) and repoint the championship `.includes()` (A3-iii)
  from `week_name` to `notes` now that B1 has backfilled it.
- Dev seeds: set `week_type` + `notes` per the new model; keep a placeholder `week_name`
  until Phase C.
- **Do NOT remove any `week_name` write in B2** — it stays `NOT NULL` until Phase C, so
  every insert path must keep supplying *some* value (the derived label is fine). Removing
  a `week_name` write before C breaks inserts.

**Test scenarios:**
- Happy path: creating a season with a season-end break writes a `blackout` row with
  `notes='Week Off'`, no `season_end_break` row.
- Happy path: lengthening a season appends regular slots whose derived numbers continue
  consecutively (no duplicate "Week 14").
- Integration: reflow add-blackout then revert preserves blackout labels via `notes`
  and never re-points matches (`season_week_id` stable).
- Integration: full season-creation wizard save round-trips to correct derived labels.

**Verification:** New seasons + lengthen + reflow produce only the three types, labels in
`notes`, consecutive derived numbers; `season_week_id` bindings unchanged; db + unit
suites green.

### Phase C — Drop `week_name` (final; after staging verification of A + B)

- [ ] **Unit C1: Drop the `week_name` column**

**Goal:** Remove the dead column and every remaining reference; "Week N" is now purely
derived with no stored fallback.

**Requirements:** R3, R5

**Dependencies:** A + B verified on staging

**Files:**
- Create: `supabase/migrations/2026061x000001_drop_season_weeks_week_name.sql`
- Modify: `src/utils/deriveWeekLabel.ts` (remove the `?? week_name` fallback),
  all writer `INSERT`/`UPDATE` payloads that set `week_name`, all `select('… week_name …')`
  clauses (`src/api/queries/matches.ts`, `src/utils/scheduleGenerator.ts`,
  `src/utils/playoffGenerator.ts`, `src/utils/scheduleReflowApply.ts`,
  `src/components/operator/{ScheduleCard,SeasonCard}.tsx`), the dev seeds, the type
  defs (`src/types/season.ts`, `src/types/schedule.ts`, `src/types/scheduleReview.ts`,
  `src/types/database.types.ts` — regenerate), `database/schema_dump.sql`,
  `database/season_weeks.sql`
- Test: `src/__tests__/database/scheduleDecoupleMigration.db.test.ts` (extend)

**Approach:** Drop the column (already `NOT NULL` + written-but-unread). Regenerate
`database.types.ts` so the field vanishes from the typed surface and any straggler
reference becomes a compile error. **Safety-net caveat:** missed *writers* fail loudly
(missing `week_name` in an INSERT), but a missed *reader* in a `select('… week_name …')`
clause fails **silently** — Postgres returns the row without the column and the property
reads `undefined`, no error. So the verification gate is the grep, not just `tsc`: run the
A3 inventory grep again and confirm **zero** `week_name` references remain (selects, types,
seeds, schema mirrors) before dropping.

**Test scenarios:**
- Happy path: inserting a `season_weeks` row without `week_name` succeeds post-drop.
- Edge: the derive helper still produces correct labels with no `week_name` column.
- Integration: a full schedule render + a season-create round-trip work with the column gone.

**Verification:** `npx tsc --noEmit -p tsconfig.app.json` clean (no `week_name`
references remain); db + unit suites green; column absent from schema.

### Docs & cleanup

- [ ] **Unit D: Retire stale docs, park the round_number draft, update TOC**

**Goal:** Leave the docs consistent with the new model.

**Files (modify/delete):** **retire** `memory-bank/scheduleReviewSystem.md` (it documents
the stored-`weekName` model this refactor overturns; the new model is canonical in this
plan's High-Level Design), delete `database/migration_matches_add_round_number.sql`
(decision: derive, not stamp), `TABLE_OF_CONTENTS.md` (new migration + helper files),
`LIST_FOR_ED.md` if a gated step lands.

**Test expectation:** none — docs only.

**Verification:** TOC reflects new files; no doc still describes stored week numbers as
current.

## System-Wide Impact

- **Interaction graph:** schedule generation (`scheduleGenerator`), blackout reflow
  (`scheduleReflow`/`Apply`), season-length change (`applySeasonLengthChange`), playoff
  placeholder fill (`playoffGenerator`) all read the same `season_weeks` slots — the
  derive helper and the three-type model unify them. Lock detection
  (`getCurrentPlayWeek`/`isWeekLocked`, reads `week_completed` + position) must keep
  identical behavior.
- **Error propagation:** the whole point is to remove silent NaN/false from string
  parsing — A3 must convert *every* control-flow site (including the two the brainstorm
  missed: `ScheduleWeekRow.tsx:40-50`, `SeasonScheduleManager.tsx:479,495`). Missing one
  fails quietly.
- **State lifecycle risks:** migrations run on live seasons — phases A→B→C are ordered so
  nothing reads `week_name` before it is backfilled/dropped; matches' `season_week_id`
  binding is never touched.
- **API surface parity:** mobile app mirrors some DB calls — `week_name`'s removal is
  web-driven; the mobile side reads the same columns, so the `notes` label + dropped
  column must be communicated (Documentation Notes).
- **Unchanged invariants:** `season_week_id` match binding, the matchup charts, playoff
  seeding, and the reflow's position-binding model are explicitly unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Phase A visibly renumbers a live in-flight season (post-blackout weeks shift down) | Run the controlled renumber SQL first so stored==derived at deploy (Phase A = visual no-op), or deploy between seasons w/ LO notice (Live-Season Safety) |
| Derived numbers bind to WRONG matchups if a season's regular dates aren't monotonic in chart-round order | Read-only invariant gate per live season before Phase A; current prod season already solver-verified |
| A reader/control-flow site missed → silent NaN/false/undefined | Authoritative inventory is the grep (not the hand list), run at A2/A3/C1; missed reader confirmed already (`ScheduleReviewTable.tsx`) |
| Migration corrupts live blackout labels | B1 is characterization-first (capture→assert), runs on a dev-DB copy, snapshot+restore in tests; backfill is `WHERE notes IS NULL` (idempotent) |
| `week_name NOT NULL` breaks inserts mid-transition | Keep writing `week_name` through A–B; only drop in C after all writers are updated |
| Branch staleness (season-length feature absent here) | Implement on a branch from fresh `origin/main`; re-confirm file:line refs |
| db tests race on shared Postgres | tx-scope or snapshot+restore in `afterAll`; deterministic fixtures (per learnings) |
| Mobile app reads `week_name` | Flag in Documentation Notes; coordinate the column drop |

## Documentation / Operational Notes

- Phases may land as separate PRs (A, then B, then C) but **must deploy in order**;
  C only after A+B are verified on staging.
- **Run the controlled prod renumber SQL before Phase A deploys** (see Live-Season
  Safety) — and run the read-only monotonic-date invariant check on each live season as a
  Phase-A gate.
- **B1 and B2 must deploy together (or B2 immediately after B1)** — once B1 relaxes the
  CHECK and converts `season_end_break` rows, any writer still on the old model corrupts
  data; B2 is what moves the writers. Don't let unrelated PRs land between them.
- **A must be fully live before B's migration runs.** If A and B ride the same deploy,
  there's a window where B has converted `season_end_break` → `blackout` but a stale
  client still does `=== 'Season End Break'` (now matches nothing → silent loss of
  special handling). Severity is capped today (disposable data, no live mobile clients),
  but gate B's merge on A-verified-on-staging.
- Notify the mobile-app side before Phase C (column drop) — it reads `season_weeks`.
- Cancel the parked one-off prod renumber SQL once Phase A ships (derivation self-heals).
- Update `memory-bank/scheduleReviewSystem.md` (or retire it) as part of Unit D.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-06-14-schedule-matchup-decoupling-requirements.md`
- Locked reflow model: `docs/plans/2026-06-11-001-fix-edit-page-blackout-reflow-plan.md`
- Season-length feature (on main): `docs/plans/2026-06-11-002-feat-change-season-length-plan.md`,
  `src/utils/applySeasonLengthChange.ts`
- Schema: `supabase/migrations/20251130010824_baseline.sql:1992-2003`
- Charts + binding: `src/data/matchupTables/`, `src/utils/scheduleGenerator.ts`
- Parked alternative: `database/migration_matches_add_round_number.sql`
