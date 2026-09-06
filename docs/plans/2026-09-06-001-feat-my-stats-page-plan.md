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

## Architectural call worth making explicit

**Fetch the player's full history once, filter in memory.**

Production is 45 completed matches — a few hundred racks for the most active
player. Every filter Ed described (opponent, handicap, system, venue, table,
recent-vs-previous) is trivial over an array that size, and the filters have to
recompute the *summary* as well as the list, which is far simpler when
everything is already in hand.

The alternative — a server-side filter API — means a round trip per filter
change and a query builder per dimension, to solve a scale problem we do not
have. If a league ever reaches tens of thousands of racks, this becomes a
paginated server query; the pure functions in Unit 2 would be reused as-is.

This is a deliberate, reversible bet on current scale, not an oversight.

## Units

Each unit is independently reviewable and leaves the app working.

### Unit 1 — The query

`src/api/queries/playerGameHistory.ts`

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

**Done when:** the query returns correct rows for a seeded player, including a
game whose opponent's current handicap differs from their handicap that night.

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

**Substitutes and mid-match swaps.** `match_lineups` carries
`swap_new_player_handicap`, so a substitute may not sit in the slot their
handicap implies. To be checked during Unit 1 rather than assumed — flagged here
so it is not discovered in Unit 4.

## Explicitly not in this plan

Other players' stats pages. Team or league-wide stats. Any verdict or coaching.
Exporting. Charts — the numbers come first, and whether a chart adds anything is
easier to judge once they are on screen.
