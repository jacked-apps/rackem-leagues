# Change Season Length — Requirements

**Date:** 2026-06-11
**Status:** Ready for `ce:plan`
**Depends on:** blackout re-flow (PR #209, `src/utils/scheduleReflow.ts` — reuse its date-walk primitive)

## Problem & Context

A league operator picks a regular-season length when creating a season (e.g. 16
weeks). Sometimes they get it wrong and want to adjust it early — "I meant 16,
not 14" or "make it 12, not 16." Today there's no way to change it on an existing
season; they'd have to rebuild.

This is an **early-season correction**, not a mid-season undo. The start date
stays the same; the change only ever **trims or extends the end** of the regular
season. It is gated by a **lock** (see below) so it can't be used to rewrite a
season that's underway.

### Why this is separate from the blackout re-flow

The blackout re-flow (PR #209) only **re-dates** existing play weeks and never
touches matches — play-week count is invariant. Changing season length changes
the **count** of play weeks, which is a **matchup** operation: lengthening
**generates** new matches; shortening **deletes** unplayed matches. Different
subsystem, different risk. It *reuses* the re-flow's date-walk to date the new
last weeks and shift the playoff/break dates.

## What the code already settles (verified)

- **Pairings for added weeks — solved.** The generator
  (`src/utils/scheduleGenerator.ts`) maps each regular week by
  `weekIndex % cycleLength` against the team-count's matchup table
  (`src/utils/matchupTables.ts`). The rotation **wraps**, so appended week *K*
  deterministically plays `matchupTable[K % cycleLength]`. Byes are already baked
  into each team-count's table (odd counts use the `status='bye'` team row). No
  new matchup logic is needed — appending just continues the rotation.
- **Standings impact — none.** The standings query (`src/api/queries/standings.ts`)
  counts only `status='completed'` matches. Deleting **unplayed** matches is
  invisible to standings, points, and head-to-head.
- **Playoff/break dates — handled.** They sit after the regular weeks; the re-flow
  date primitive already pushes them out (lengthen) or pulls them in (shorten).

## The Lock

Season length is editable until a cutoff, then read-only.

- **Trigger (for now):** the **5th regular week's play-date**. While
  `today < week-5 date`, length is editable; once it arrives, the control is
  **locked** (operators can play week 4, then it locks). This mirrors the
  business rule "pay by week 4, then the length is locked in" without depending on
  the unbuilt payment system.
- **Future:** when Jack's payment integration lands, "payment made" becomes an
  **additional, earlier** lock trigger (whichever comes first). Out of scope now;
  note the seam.
- **Floor / ceiling:** minimum **10** weeks, maximum **52** (the
  `seasons.season_length` CHECK). The wizard never lets the operator go below 10
  or above 52.

## Behaviors

### Lengthen (more weeks) — append to the end

- Append the requested number of regular weeks **after** the current last regular
  week. Date them by continuing the weekly cadence (skipping existing skip nights)
  via the re-flow date primitive; this pushes the season-end break and playoff
  weeks out accordingly.
- Generate matches for each new week by continuing the rotation
  (`matchupTable[K % cycleLength]`) using the season's existing team positions.
- Update `seasons.season_length` and `seasons.end_date`.

### Shorten (fewer weeks) — trim from the end

- Remove regular weeks from the **end** down to the requested count, deleting
  their (unplayed) matches and the week rows. Pull the season-end break and
  playoff dates back in.
- **Played-match guard (hard block):** if any week in the trim range has a match
  that is completed or in progress, **block** the change and tell the operator
  which week. Games-won data is sacred and must never be destroyed by this flow.
  (In practice this should rarely trigger — the lock keeps it early — but it's a
  required safety net.)
- Update `seasons.season_length` and `seasons.end_date`.

## UX — Change Season Length wizard

- **Entry:** the Manage Schedule page (`src/operator/SeasonScheduleManager.tsx`)
  already shows "Season Length: N weeks." Add a **"Change Season Length"** button
  next to it. The button is **disabled once locked** (week-5 date passed), ideally
  with a short "locked after week 4" hint.
- **Wizard** (mirror the creation flow's length step,
  `src/wizards/season-v2/steps/SeasonLengthStep.tsx` + its `NumberStepper`; the
  repo has wizard infrastructure under `src/wizards/*-v2`):
  - **Step 1 — set the new length.** "This is a 16-week season. How many weeks
    should it be?" with the same stepper/slider control (min 10, max 52).
  - **Step 2 — review, branched by direction:**
    - **Fewer weeks:** show exactly what's removed (e.g. "removes weeks 15–16 and
      their matchups; playoffs move up a week"). If the played-match guard trips,
      show the blocking message instead of a confirm.
    - **More weeks:** show what's added (e.g. "adds weeks 17–18 with matchups;
      playoffs move out two weeks").
  - **Confirm → apply**, then return to the schedule page showing the new schedule.
- **No snapshot/revert** (unlike the blackout flow). The length is freely
  re-editable until lock, so "change it again" is the undo. A clear review/confirm
  step is enough.

## Scope Boundaries / Non-Goals

- **End-only.** No removing or inserting a *middle* regular week — that re-pairs
  the rotation and tangles with played matches. Trim/append the tail only.
- **No removing played weeks.** The played-match guard hard-blocks it; this flow
  never destroys recorded results.
- **No payment integration.** The lock uses the week-5 date for now; the
  payment-made trigger is a future addition (note the seam, don't build it).
- **Not the blackout re-flow.** Skip add/remove (week-off) stays its own feature
  (PR #209); this only changes the *count* of regular weeks.

## Open Questions for Planning

- Exact reuse vs extension of the re-flow date primitive for **appending** new
  weeks (it currently re-dates existing weeks; appending adds rows then walks).
- Whether append/trim + match gen/delete + `season_length`/`end_date` updates run
  as a single DB transaction/RPC or ordered client writes (the blackout flow chose
  ordered client writes; this one creates/deletes matches, so weigh atomicity).
- Where the team-position map comes from at append time (the generator needs
  positions; confirm they persist on an existing season).

## Success Criteria

- An operator can raise or lower a season's length (10–52) before the week-5 lock,
  via the wizard, and the schedule + matchups update correctly:
  - Lengthen adds correctly-paired weeks and pushes playoffs/break out.
  - Shorten removes the tail weeks' unplayed matches and pulls playoffs/break in.
- The played-match guard makes it impossible to delete a completed/in-progress
  match.
- After the week-5 date, the control is locked (disabled).
- `seasons.season_length` and `end_date` stay in sync with the real schedule.
