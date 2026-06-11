# Bye Team as a Real Team + Auto-Forfeit Sweep — Requirements

**Created:** 2026-06-09
**Status:** Requirements captured from a live walkthrough (Ed). Some pieces already shipped (see "Already shipped"); the rest is to-build.

## Problem / framing

A BYE is **a real team** — a phantom team that forfeits every match. Whoever is
paired with it that week gets their **bye week** (sits out, usually an automatic
win/points per league rules). It must be treated like a team in **almost every
respect** — it participates in matchups and the schedule — and is excluded only
from **standings** and **player stats** (you don't accrue stats against nobody).

Odd team count → the generator adds the bye as the extra team to make it even
(5 real → 6 with the bye → normal 6-team round-robin; each week one real team
draws the bye and sits).

### The bug that exposed all this (the "hidden bye trap")
The bye-as-real-team conversion is **half-migrated**: the data layer does it
right, but the display layer was never fully switched over.
- **Correct (engine):** `generateSchedule` materializes the bye into a real
  `teams` row (`status='bye'`) and writes its UUID into matches (no NULL team
  ids, no `'BYE'` literal). A migration (`backfill_null_bye_matches`) even
  converted legacy NULL-team byes → real bye rows.
- **Crossed wires (UI):**
  1. Team-list queries filter `status='active'`, so the bye is **hidden**. An LO
     with 5 real + 1 hidden bye sees "5 teams," tries to add a 6th, and instead
     stacks a **7th** row (6 real + stale bye = odd again). They can never cleanly
     reach an even count.
  2. Two screens still detect a bye the OLD way (`home_team_id === null`):
     `src/operator/SeasonSchedulePage.tsx`, `src/wizards/matchups-v2/steps/ReviewStep.tsx`.
     This is now wrong — a regular-week bye is non-null, and `null` now means a
     **playoff TBD** match.

## Already shipped (this session)
- **PR #203** — dropped the redundant `BEFORE DELETE` trigger
  `trigger_auto_delete_match_lineups` that broke bulk match deletes (regenerate
  matchups) with Postgres error 27000 → surfaced as a bare HTTP 400.
- **PR #204** — surfaces the bye in **Manage Teams** (`includeBye` option on the
  team query; `TeamCard` labels it "BYE — open slot"). Visibility half only;
  the bye's Edit/Delete are hidden for now.

## To build

### 1. Finish the visibility migration
- Show `status='bye'` as a real team **everywhere a team shows** (schedule,
  matchups, "you're playing the BYE"), **except standings and player stats**.
- Replace the leftover `team_id === null` bye-detection with `status === 'bye'`
  (SeasonSchedulePage, matchups ReviewStep, any others).
- Confirm standings/stats explicitly exclude `status='bye'` (today they rely on
  active-only list helpers — verify that holds on every surface).

### 2. Fill the bye (convert bye → real team)
The intended "add a team to an odd league" path. Take the existing bye row and:
name it, assign a captain + roster, flip `status` `'bye'`→`'active'`. Because the
bye already owns its rotation slot, its "Team X vs BYE" matches just become real
games — **no reschedule**.
- **Pre-season (no bye results awarded yet):** genuinely instant, zero cleanup.
- **Mid-season:** bye weeks already banked as auto-wins must be **un-awarded** so
  the now-real games can be played. (Deferred detail.)

### 3. Remove the bye
Drop the bye to go to an even count, then regenerate (no phantom needed).

### 4. Auto-forfeit sweep (NEW — first pg_cron job)
A **once-daily** scheduled SQL job (Supabase `pg_cron`) over **all leagues at
once** (one set-based query, not per-league):

> For every match that is `scheduled`, unfinished, and **past-due**:
> - both teams have a captain → **ignore** (real game to be played)
> - exactly one team has a captain → that team is the **winner** (forfeit); mark
>   the match completed (`scheduled → completed`, skip `in_progress`)
> - neither has a captain → **deferred edge** (double-forfeit / manual)

This single rule produces **bye weeks automatically**: the bye is permanently
captainless, so it's always the forfeiting side and its opponent always wins.

**Why this shape:**
- A **forfeit = declaring a winner** (`winner_team_id`). Points-for-the-win ride
  on top per league rules — **deferred** to forfeit-scoring work.
- Keyed on **"all past-due + unfinished"** (status-based), NOT a specific date —
  it's **self-healing** (a skipped run is swept up next day; nothing falls
  through the cracks).
- **Cheap + flat at scale:** a partial index already covers
  `status IN ('scheduled','in_progress')`, the result set is tiny (most matches
  are `completed`), and it's ONE query for every league — cost scales with
  *missed matches*, not league count. Daily is correct; less-frequent only delays
  forfeits (stale standings) for no real compute saving.

## Key design distinction
- **Forfeit logic keys on the CAPTAIN** ("no captain → can't field a lineup →
  forfeits"). This unifies the bye (permanently captainless) with a real team
  that loses its captain.
- **Bye IDENTITY stays EXPLICIT (`status='bye'`).** "No captain" does NOT mean
  "bye": the live DB has **8 active teams with no captain** (and 0 byes). A
  captainless *real* team should show as "Sharks — needs a captain" (go chase the
  captain), not be relabeled "BYE" or dropped from standings. Same forfeit
  behavior, different identity/handling.

## Open / deferred questions
- **Forfeit scoring** — points awarded for a bye/forfeit win (league-configurable:
  fixed value / % of max / average / etc.). Deferred but required for standings
  to be correct.
- **Forfeit timing** — *when* the daily sweep fires ("6am next day" was a
  placeholder, not a spec). Configurable per league? Timezone handling?
- **Neither-team-captained edge** — double-forfeit vs. leave-for-manual.
- **The 8 captainless `active` teams + 0 `bye` rows** in the live/local DB — data
  anomaly to understand (test cruft? lost captains? half-migration residue?).
- **Mid-season fill** — un-awarding already-banked bye wins when a bye is filled.

## Constraints
KISS/DRY/YAGNI; shadcn components; behavior-preserving where it touches the
generated schedule; pnpm + Vitest; RLS intentionally off (not a factor).
