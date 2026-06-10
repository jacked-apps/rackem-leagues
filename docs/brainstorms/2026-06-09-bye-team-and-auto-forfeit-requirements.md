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
  matchups) with Postgres error 27000 → surfaced as a bare HTTP 400. **MERGED.**
- **PR #204** — surfaces the bye in **Manage Teams** (`includeBye` option on the
  team query; `TeamCard` labels it "BYE — open slot"). **MERGED.**
- **PR #206** — gates **"Add Team"** when a bye exists (steer the LO to fill the
  bye instead of stacking a redundant team). The "can't-happen-again" guard.
- **PR #207** — **fill the bye**: a "Fill" button opens the normal team editor;
  saving a bye with a captain flips `status` bye→active (no reschedule — it keeps
  its slot). Turned out to be ~4 tiny touches (a bye IS a regular team).

## To build (later — coherent feature set, needs its own ce:plan)

### 1. Finish the visibility migration
- Show `status='bye'` as a real team **everywhere a team shows** (schedule,
  matchups, "you're playing the BYE"), **except standings and player stats**.
- Replace the leftover `team_id === null` bye-detection with `status === 'bye'`
  (SeasonSchedulePage, matchups ReviewStep, any others).
- Confirm standings/stats explicitly exclude `status='bye'` (today they rely on
  active-only list helpers — verify that holds on every surface).

### 2. Fill the bye — ✅ SHIPPED (PR #207, pre-season case)
Done: name it, assign a captain + roster → `status` bye→active, no reschedule.
Remaining (deferred): the **mid-season** fill, where bye weeks already banked as
auto-wins must be **un-awarded** so the now-real games can be played.

### 3. ~~Remove the bye~~ — DROPPED (YAGNI, 2026-06-10)
A bye exists **iff** the league is odd; you get rid of it by **filling** it
(making the league even), not by deleting it. The only way to get a *redundant*
bye was the now-prevented wedged-league bug (#206 gate). A bad-data case is a
one-time SQL repair, not a recurring feature. No "remove bye" UI needed.

### 4. Auto-forfeit sweep (NEW — first pg_cron job)
A **once-daily** scheduled SQL job (Supabase `pg_cron`) over **all leagues at
once** (one set-based query, not per-league):

> For every match that is `scheduled`, unfinished, and **past-due**:
> - both teams `status='active'` → **ignore** (real game to be played)
> - exactly one team is non-active (`'bye'` or `'withdrawn'`) → the **active**
>   team is the **winner** (forfeit); mark the match completed
>   (`scheduled → completed`, skip `in_progress`)
> - both teams non-active → **deferred edge** (double-forfeit / manual)

This single status-based rule produces **bye weeks automatically** (a bye is
`status='bye'`, so it always forfeits) AND handles **mid-season departures** (a
withdrawn team is `status='withdrawn'`, so its remaining opponents get bye-week
wins). See §"forfeit keys on STATUS" for why this replaced the earlier
"no-captain" trigger.

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

### 5. Mid-season team departure (a team quits)
When a team quits **after the season has started** (games already played):
- Set `status = 'withdrawn'`. **Keep the captain + roster untouched** — do NOT
  rename to "BYE": that would corrupt the labels of the team's already-played
  matches, which must stay as "X vs [the real team]". (Demote the captain's
  `is_captain` flag only for tidiness if desired; the status change is the point.)
- **Past matches:** keep the real team name → history intact.
- **Future matches:** team is now `status='withdrawn'` → the §4 sweep
  auto-forfeits them, so each opponent gets a bye-week win.
- **Standings:** exclude non-active teams (standings already run active-only).

Same forfeit rule as the bye — a bye and a quit team both forfeit by their
**status**, not by captain.

NOTE: the originally-planned `drop_team` RPC (withdraw + reassign future matches
to a fresh bye row) was **never built** — only a stale migration comment
references it. Today's `deleteTeam` just flips `status='withdrawn'` and does
nothing else. This §5 flow supersedes that intent.

### 6. Captain-abandonment accountability counter
A captain whose **team quit mid-season** is an offense LOs want to track, and the
reputation should follow the player **cross-org**.
- **Stored integer column on `members`** (e.g. `mid_season_captain_withdrawals`)
  — read **for free** with the member record (no extra query on the common
  captain-assign path; that's why a stored column beats deriving on every assign).
- **Incremented at the rare withdrawal event**, only when the team had already
  played matches (a *pre-season* reshuffle is NOT an offense — must not tag).
- Tags **whoever was captain when the team quit** (`captain_id` at withdrawal) —
  a captain who stepped down and was *replaced* before the quit is NOT tagged;
  only the one who rode it into the ground. (A captain *swap* ≠ a team *quit*.)
- **Reconstructable** from the teams table (count of withdrawn teams the member
  captained — possible because §5 keeps the captain) → the query is the
  **audit/rebuild** backstop if the counter drifts, not the read path.
- **Soft warning** when an LO assigns this member captain (count > 0):
  *"This player has captained N teams that quit mid-season — are you sure?"*
  **Informational, not a hard block** (sometimes it's not the captain's fault).

## Key design distinction — forfeit keys on STATUS (not captain)
- **Forfeit logic keys on `status != 'active'`** (`'bye'` or `'withdrawn'`), NOT
  on "no captain." This:
  - **Preserves captain history** — withdrawing never strips the captain, which
    §6's abandonment counter depends on.
  - **Won't misfire** on a real `active` team that's temporarily between captains
    (that's the LO's to fix, not an auto-forfeit).
  - Unifies the **bye** (`status='bye'`) and **mid-season quit**
    (`status='withdrawn'`) under one rule.
- **Bye IDENTITY stays EXPLICIT (`status='bye'`).** A captainless *active* team is
  NOT a bye — show "Sharks — needs a captain" (chase the captain), never relabel
  "BYE" or drop from standings.
- (The live DB had 8 captainless `active` teams / 0 byes — exactly why "no
  captain" is the wrong forfeit signal; an earlier draft of this doc keyed on it.)

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
