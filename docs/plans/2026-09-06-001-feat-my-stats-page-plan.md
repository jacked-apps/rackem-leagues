# My Stats page — implementation plan

**Date:** 2026-09-06
**Status:** PLAN — awaiting Ed's sign-off, no code written
**Brainstorm:** `docs/brainstorms/2026-09-06-my-stats-page-requirements.md`
**Branch (proposed):** `feat/my-stats-page`

---

## What we're building

One page where a player examines their own record: summary counts, every rack
they have played with its context, and filters that reshape both.

**No schema changes.** Everything needed is already recorded. This is a
read-only feature over data we already have — which also means it works on
history from April 2026 onward the day it ships, not just on new games.

## Decisions already settled

| Decision | Why |
|---|---|
| Handicaps read as they were **that night** | An opponent who was a 2 then stays a 2 in that game forever. `match_lineups` already stores it this way. |
| Handicap **system** read, never inferred from the number | Three systems overlap in plausible ranges today; a fourth would break any magnitude rule silently and retroactively. |
| No snapshot → fall back to the **league's** `handicap_type` only | That one field is immutable per league by DB trigger, so it isn't a guess. Other snapshot fields can change, so no blanket backfill. |
| The page **reports, doesn't conclude** | "Solely off of the records." No verdicts. |
| Head-to-head yes, other players' stats no | It's still *my* record, sliced by who was across the table. |
| "Games" means **racks** | That's what carries an ending. Venue/table are per night and filter whole nights. |
| Default frame is **everything**, season is a filter | "How many teams have I been on" is a career question. |

## The performance requirement comes first

Ed:

> I would really like this to be snappy and reactive, not sluggish and constant
> spinnerations.

This is a design constraint, not a nice-to-have, and it decides the
architecture. A page that asks the server every time you change a filter shows
a spinner on every click by definition. So: **fetch the player's history once,
then every filter is instant and offline.** Changing "table 2" to "table 3"
costs a few milliseconds of array work and zero network.

That happens to also be the simpler build, but speed is the reason for it.

### What that costs at scale, with real numbers

At about 5 racks per player per night:

| Play pattern | Racks | Payload |
|---|---|---|
| Production today (45 matches, whole league) | few hundred | negligible |
| 3 nights a week, 10 years | ~6,000 | ~1 MB |
| 5 nights a week, 20 years | ~22,000 | ~4–5 MB |

Filtering 22,000 rows in a browser is instant — that was never the constraint.
**Sending** them is: several MB before the page can draw, on a phone, in a pool
hall. The approach stops being the fast one somewhere around **10,000 racks** —
roughly 15 years of one league night, or 5 years of three.

### Designed so that day is a one-file change

The two halves scale differently, and it's worth not conflating them:

- **Career totals** are a handful of numbers. Postgres can aggregate 22,000
  rows and return twenty bytes without noticing.
- **The game log** is the heavy part — and nobody scrolls 22,000 rows anyway;
  they filter down to what they care about.

So the long-term shape is totals computed in the database and the log fetched a
page at a time. Building that now would be solving a problem we will not have
for years, and it would be *slower to use* today.

The hedge is one module between the page and the data:

    src/stats/gameHistorySource.ts
      getPlayerHistory(memberId) → all rows          (today)
      later: getSummary(filter) + getPage(filter)    (same callers)

Everything above it — the summary maths, the filters, the page — works on rows
and a filter spec, and does not know where either came from. The day the swap is
needed it is that file plus the query beneath it, not the feature.

**Trigger for the swap:** when any single player's history passes ~10,000 racks,
or first load exceeds ~1 second on a phone. Worth writing down because nobody
will notice the slide otherwise.

## Units

Each unit is independently reviewable and leaves the app working.

### Unit 1 — The query and the boundary

`src/api/queries/playerGameHistory.ts` + `src/stats/gameHistorySource.ts`

One function returning a flat row per rack for a given member:

- rack: id, game number, won/lost, ending (`break_and_run`, `golden_break`,
  `runout`, `early_eight`, `win_by_forfeit`, or none)
- match: date, venue name, table number, season, league
- opponent: member id, display name, **handicap that night**, and the
  **handicap system** that match was played under

The opponent's handicap is the fiddly part: `match_games.home_position` /
`away_position` give the lineup slot (1–5), which selects
`match_lineups.player{N}_handicap`. Worth a dedicated pure helper plus tests,
because getting it off by one silently attributes the wrong handicap to every
opponent.

Also establishes the `gameHistorySource` boundary described above, so nothing
built on top ever calls Supabase directly.

**Done when:** the query returns correct rows for a seeded player, including a
game whose opponent's current handicap differs from their handicap that night,
and everything above the boundary depends only on rows plus a filter spec.

### Unit 2 — Summary maths

`src/stats/summarizeGames.ts` — pure, no React, no fetching.

Games played, won, lost, win rate, count per ending **in both directions** (won
by break & run / lost to break & run), teams played on, opponents faced.

**Done when:** unit tested against hand-built row sets, including the
both-directions case that is the whole point of the feature.

### Unit 3 — The page, unfiltered

`src/player/MyStatsPage.tsx` plus small presentational components.

Summary at the top, game log beneath: date, opponent, their handicap, venue,
table, result, ending. Route and nav entry.

Per the repo's file-size preference, the log row and summary block are their own
components rather than one long page file.

**Done when:** a logged-in player sees their real record. Shippable here — the
filters make it better, but this alone is worth having.

### Unit 4 — Filters

`src/stats/gameFilters.ts` (pure) plus filter controls.

Opponent, handicap system, handicap value or range, venue, table, season.
Filters compose, and they drive the **summary as well as the list** — "my record
on table 2" recomputes the counts.

The handicap filter is scoped by system: pick the system first (or it is implied
when the player has only one), then the value. This is where Ed's "a way to
filter for which handicap I play if there are more than one" lives.

**Done when:** each filter is unit tested as a pure function, and the summary
demonstrably recomputes rather than just hiding rows.

### Unit 5 — Recent vs previous

Last N racks against the N before them, side by side, using Unit 2's summary on
two slices.

Needs an honest empty state: below roughly 100 racks there is nothing to
compare, and saying so beats a comparison built on eight games.

**Done when:** correct at the boundaries (exactly N, fewer than N, fewer than
2N) and honest when there is not enough history.

## Risks

**Small production dataset.** 45 completed matches in total. The page will be
truthful but modest, and Unit 5 will be empty for most players. Worth knowing
before it is demoed rather than during.

**Position-to-handicap mapping is the one place a silent wrong answer can
hide.** Every other field is read directly; this one is derived, so an
off-by-one misattributes every opponent's handicap without ever erroring. Hence
the dedicated helper and tests in Unit 1.

**Substitutes — largely cleared.** Ed: subs have real player ids and play the
full match, so they occupy a lineup slot like anyone else and their handicap
sits with it. Still verified in Unit 1 against a real swapped lineup, since
`swap_new_player_handicap` exists and something must be writing it, but this is
no longer expected to be a design problem.

## Explicitly not in this plan

Other players' stats pages. Team or league-wide stats. Any verdict or coaching.
Exporting. Charts — the numbers come first, and whether a chart adds anything is
easier to judge once they are on screen.
