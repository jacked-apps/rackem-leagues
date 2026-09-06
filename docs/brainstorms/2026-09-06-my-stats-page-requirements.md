# My Stats — requirements brainstorm

**Date:** 2026-09-06
**Status:** brainstorm — open questions at the bottom, not yet a plan
**Origin:** the early-8 work (`feat/scoring-early-eight`), which surfaced that
we record how every game ends and then never show it to anyone.

---

## The idea in one line

A page where a player can go over their own record objectively — not just how
many they won, but **how** they won and lost, sliced by whatever they want to
ask about.

## Why it matters

Ed's framing, which is the thing to keep hold of:

> If I have 100 wins and 100 losses I'd be pretty even. If I compare 2 players
> with those same stats and one lost by break and run 10 times and the other
> lost with 50 break and runs, the story changes quite a bit doesn't it?

Two identical records, two completely different players. One is losing to
opponents who run out on them; the other is losing games they were still in.
A win-loss line alone cannot tell them apart, and that is the gap this fills.

## The correction that made it possible

The per-game flags — break & run, golden break, runout, early 8, forfeit —
were being thought of as things the WINNER earned. They are not. They describe
**how the game ended**, and every game has a winner and a loser, so each flag
reads from both chairs:

| The record says | Winner reads it as | Loser reads it as |
|---|---|---|
| `break_and_run` | I won with a break & run | I lost to a break & run |
| `early_eight` | I won on their early 8 | I lost on an early 8 |

Nothing in the schema had to change for this — the row already carries
`winner_player_id` alongside both players. It was only ever described wrong.
Every question below falls out of that symmetry.

## Principle: the page assumes the data is correct

Leagues differ. One plays 9-ball; golden breaks may not count, or count
differently; a league may simply not bother recording break & runs.

**The page does not know or care.** It renders what was recorded. If a league
doesn't record something, that league sees zeroes — their loss of data, not a
case for the page to handle. No per-league branching, no "this league doesn't
track that" special-casing. This keeps the stats page out of the business of
knowing every league's rules, which is exactly the trap the scoring system is
being restructured to escape.

## What Ed asked for

**A summary of me.** Games played, teams I've been on, wins, losses, break &
runs, and the rest of the endings.

**Every game I've played** — against whom, where, and on what table.

**Filters, which are the real feature.** Not a fixed set of numbers but a way
to ask questions:

- What's my record against 2-handicaps?
- What's my record against handicaps 50% and over?
- What's my record on table 2 at Butera's Billiards?
- How do my last 50 games compare with the 50 before that?

The filters drive the summary as well as the list — "my record on table 2"
means the counts recompute, not just the rows filter.

**Not in scope for now:** looking up another player's stats. Same data would
serve it, but this is a tool for examining your own game.

## What the data already supports

Checked against the live schema on 2026-09-06.

| Question | Available? | Source |
|---|---|---|
| Wins / losses | Yes | `match_games.winner_player_id` vs `home_player_id` / `away_player_id` |
| How each game ended | Yes | `match_games.break_and_run`, `golden_break`, `runout`, `win_by_forfeit`, `early_eight` |
| Who I played | Yes | the other player id on the game row |
| Where | Yes | `matches.actual_venue_id` → `venues` |
| What table | Yes | `matches.assigned_table_number` |
| Teams I've been on | Yes | `team_players` (team + season) |
| Opponent's handicap **at the time** | Yes | `match_lineups.player{1..5}_handicap`, joined via `match_games.home_position` / `away_position` |
| Recent form vs earlier | Yes | order games by match date |

Two things worth noting rather than discovering later:

**Handicap is stored per match, not looked up live.** `match_lineups` captures
each player's handicap as it was on the night. That is the correct number for
"my record against 2s" — a player who was a 2 last year and is a 4 now should
count as a 2 in the games they played as one. Using their current handicap
would quietly rewrite history.

**Table and venue live on the match, not the game.** So "table 2" filters whole
nights, not individual racks. That is almost certainly what's wanted, but it
means a filtered game count moves in chunks of a match.

**Break & run, golden break and runout have history; early 8 does not.**
Those three have been recorded since April 2026. Early 8 starts from the day
the current branch ships, so it will read zero for everyone for a while. Worth
expecting rather than mistaking for a bug.

## Open questions

1. **"Handicaps 50% and over" — what does 50% mean here?** Handicaps are stored
   as plain numbers (2, 3, 4…), so a percentage is something else: the top half
   of the handicap range? A percentile against the league? A different system
   entirely? This one changes the filter design and I'd rather not guess.

2. **Does "game" mean a rack or a match night?** It matters a lot for "last 50
   vs the 50 before": 50 racks is about four nights, 50 match nights is a
   couple of seasons. The endings are per rack; venue and table are per night.

3. **How far back does "my record" reach?** Everything I have ever played, or
   the current season by default with a way to widen it?

4. **What does a player do with the answer?** If the page should land a
   conclusion — "you are better than your record suggests" — that is a very
   different page from one that lays out numbers and leaves the reading to
   them. Worth deciding before layout.

## Not decided yet

Where it lives (`PlayerStats` already exists and shows none of this), how much
of it is one page vs several, and whether the comparison view (last 50 vs
previous 50) is a filter or a distinct mode.
