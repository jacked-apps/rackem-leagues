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
- What's my record against Joe Smith?
- How do my last 50 games compare with the 50 before that?

The filters drive the summary as well as the list — "my record on table 2"
means the counts recompute, not just the rows filter.

**Head-to-head is in scope; other people's stats are not.** "What's my record
against Joe Smith?" is still my record — my games, filtered by who was across
the table, showing that list. What stays out is opening a page *about* Joe and
reading his numbers. The line is whose record is being reported, not whose name
appears on it.

## Three handicap systems, and why the number alone isn't enough

There are three today, all stored as plain numbers in the same column:

| `handicap_type` | Range | Used by |
|---|---|---|
| `points` | −2 to +2 | BCA 3v3 |
| `percentage` | 0–100 (win %) | BCA 5v5 |
| `fargo` | ~100–850 | Fargo 5v5 |

They *look* separable by magnitude — a 2% win rate and a Fargo of 100 are both
so bad as to be practically impossible, so a "2" is obviously a points handicap.
**We are not doing that.** Ed's requirement:

> There should be somehow in the record to see what handicaps those games are
> using... this is important as we may add more handicap systems and again
> these stats should be distinguishable.

Guessing the system from the number's range is the kind of rule that works
right up until a fourth system overlaps an existing one, and then it is wrong
silently and retroactively across every stat on the page. The system has to be
read, not inferred.

**It already is recorded.** `matches.system_snapshot` is a frozen copy of the
league's resolved configuration, written when the match starts, and it carries
`handicap_type`. So every match says which system it was played under, and it
says so as of that night — the same freeze-at-the-time principle as the
handicap values themselves, which is exactly right: a league that switches from
percentage to Fargo does not retroactively reinterpret its old seasons.

This also satisfies the extensibility requirement for free. A fourth system is
a new `handicap_type` string; nothing on the stats page needs teaching about
its number range.

**Two consequences for the page:**

- **Handicap filters are scoped to a system.** "Against 2s" is only meaningful
  once you know you mean points-handicap 2s. If a player has games under more
  than one system, the page needs a system filter — which is Ed's "a way to
  filter for which handicap I play if there are more than one."
- **Legacy matches may have no snapshot.** The column is NULL for matches that
  predate it. There is a `populateMatchSnapshotIfNeeded` backfill used
  elsewhere, but it fills from CURRENT league config — safe for a match being
  played now, wrong for an old one if the league has changed system since. For
  the stats page the honest treatment is to show those games as system-unknown
  rather than assume; how many are affected in production is worth checking
  before deciding.

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
| Which handicap **system** that match used | Yes | `matches.system_snapshot ->> 'handicap_type'` (frozen at match start; NULL on legacy matches) |
| Head-to-head vs one opponent | Yes | the other player id on the game row |
| Recent form vs earlier | Yes | order games by match date |

Two things worth noting rather than discovering later:

**Handicap is stored per match, not looked up live — and this is settled.**
`match_lineups` captures each player's handicap as it was on the night, and
that is the number the page uses. Ed, confirming it:

> I may have been a 1 a month ago and am now a 2, but if I ask about me vs 2s
> in the past it should just show what they were when I played them.

So an opponent who was a 2 that night counts as a 2 forever, even after they
move to a 1. Reading anyone's *current* handicap would silently rewrite the
past every time a rating changed — the sort of wrong that never announces
itself.

**Table and venue live on the match, not the game.** So "table 2" filters whole
nights, not individual racks. That is almost certainly what's wanted, but it
means a filtered game count moves in chunks of a match.

**Break & run, golden break and runout have history; early 8 does not.**
Those three have been recorded since April 2026. Early 8 starts from the day
the current branch ships, so it will read zero for everyone for a while. Worth
expecting rather than mistaking for a bug.

## Open questions

1. ~~**"Handicaps 50% and over" — what does 50% mean?**~~ **Answered: it is a
   different handicap SYSTEM.** See "Three handicap systems" below.

2. **Does "game" mean a rack or a match night?** It matters a lot for "last 50
   vs the 50 before": 50 racks is about four nights, 50 match nights is a
   couple of seasons. The endings are per rack; venue and table are per night.

3. **How far back does "my record" reach?** Everything I have ever played, or
   the current season by default with a way to widen it?

4. ~~**What does a player do with the answer?**~~ **Settled: the page reports,
   it does not conclude.** "For now we go solely off of the records." No
   "you're better than your record suggests" verdicts — show what happened and
   let the player read it. Cheaper to build, and it cannot be wrong.

## Working assumptions (say so if either is wrong)

**"Games" means racks, not match nights.** The endings live on individual
racks, so that is the unit the stats are made of, and "last 50 vs the previous
50" reads as 50 racks — roughly four nights, which is a form check rather than
a career arc. The game list still shows each rack in its context (opponent,
venue, table, date).

**"My record" reaches back over everything by default.** "How many games I have
played, how many teams I have been on" is a career question, so the page starts
wide and filters narrow it. A season filter is one of the filters, not the
default frame.

## Not decided yet

Where it lives (`PlayerStats` already exists and shows none of this), how much
of it is one page vs several, and whether the comparison view (last 50 vs
previous 50) is a filter or a distinct mode.
