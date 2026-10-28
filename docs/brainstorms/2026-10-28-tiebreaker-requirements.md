# Tiebreakers — requirements

Date: 2026-10-28. Branch: `audit/tiebreaker-phase3`. Captured from a working
session with Ed. Input: `docs/audits/2026-10-28-tiebreaker-audit.md`.

Status: requirements agreed, not yet planned. No code written.

## Why this exists

A tiebreaker is **a coin flip with a cue**. Its only job is to answer "which team
won this match." It changes no points and no team games won.

The handicap rule attached to it is an **anti-sandbagging** measure, and it comes
from a real incident — Ed had a team deliberately playing for ties. The old
behaviour was that tiebreaker games did not count toward handicaps, so a strong
team could tie on purpose, win the tiebreaker, and bank free wins at no handicap
cost. Ed's rule removes the incentive: win the tiebreaker and your handicap pays
for it, so you are better off just winning the match outright and taking the
points.

## The rule (Ed, 2026-10-28)

Three games. Each player meets one opposing player; first team to two wins.

- The **winning team's three players each get a WIN** on their handicap record.
  All three — including a player who lost his game, and including a player who
  never shot.
- The **losing team gets nothing at all.** Not a loss — *as if they never
  played*.
- **No effect on match points or team games won.** The tiebreaker only names the
  winner.

Whether the third game is actually played is **inconsequential and not tracked**.
Two wins ends it. Sometimes a third is played anyway (two tables running at
once); usually it is not.

## The defect this has to fix

**The anti-sandbagging rule is currently switched off.** The scoring path writes
the three credited wins correctly (`MatchEndVerification.tsx`, comment:
"Anti-sandbagging rule for tiebreaker"), but every read path filters them away.
`calculatePlayerHandicap` → `fetchPlayerGameHistory` carries a hard
`.eq('is_tiebreaker', false)` (`playerGameHistory.ts:119`), so the winning
team's three players receive nothing and the original exploit is open again.

Nobody has exploited it — the current players do not know, and it is one season.

## Decisions

**D1 — Counting rule: `counts = is_win OR NOT is_tiebreaker`.** Exclude only
tiebreaker *losses*. A win always counts; a loss counts only when it is not a
tiebreaker. One expression delivers the whole rule: winners credited, losers
untouched, nothing special-cased by team.

**D2 — Two separate facts: the games stay truthful, the credit is derived.**
(Revised 2026-10-28 after Ed raised the head-to-head problem. The first pass had
the credited result overwrite the game result; that made "how did I play against
John in the tiebreaker" unanswerable, because the row said you beat him when you
had not.)

- **Game rows record what actually happened.** Lost to John → it says you lost to
  John. Never played → no winner, null. An unplayed game has no result, and that
  is the honest record of it.
- **Handicap credit is DERIVED from which team won the tiebreaker**, not written
  onto any game. All three winning players are credited — including the one who
  lost his game and the one who never shot — because the credit follows the team
  outcome, not a game row he does not appear in.
- **Head-to-head reads the game rows**, so a personal record is what happened at
  the table.

The overwrite that currently rewrites all three games as won by the winning team
**goes away**. It only ever existed to smuggle the credit into a column; once the
credit has its own home it is unnecessary, and it is the sole cause of the
fabricated-record problem.

This is also the load-bearing reason for D4. The tiebreaker record is not just
future-proofing for BCA/Fargo — it is the fact the handicap rule derives credit
from, and without it the rule cannot work without lying about the games.

**D3 — Tiebreaker games stay in `match_games` with the `is_tiebreaker` flag.** A
game result is a game result; the flag is the only difference. This is what lets
head-to-head include tiebreakers while handicaps discount them.

**D4 — Keep durable tiebreaker records (now load-bearing, see D2).** Nothing displays a tiebreaker today,
but players will ask, and it is unknown what BCA or Fargo will want. Retaining
the record also gives "did this match end in a tiebreaker" a direct answer
instead of an inference.

**D5 — Forward-only. No backfill.** One beta season, few affected matches, no
player is aware. Past data is out of scope.

**D6 — No database-level lineup lock.** Dropped after Ed's objection: player
swaps happen a few times a season and LO corrections are needed on top, so a
hard lock becomes permission plumbing and every exception is a new way to be
wrong. Direction inverts from *preventing* lineup changes to *recording* them —
hand-fixing stays the supported path, it just stops being invisible. (Ben vs
Duff was unanswerable precisely because nothing recorded who changed a handicap
or when.)

## Implementation notes carried from the audit

- **The history query must also match the credited-winner slot.** It currently
  finds games via the two "who played" columns
  (`home_player_id` / `away_player_id`). The winning player who never shot is in
  neither, so he would be missed despite being credited. Easy to overlook, and
  it half-works silently.
- **Leave the `weeksPlayed` divisor alone.** The points formula divides games by
  6; a tiebreaker win makes a 7th game that week. Let it land naturally — a
  tiebreaker win genuinely is an extra game played, and adjusting the divisor to
  preserve a round 6 is the kind of cleverness that bites later.
- **F1 is unshipped, not unwritten.** The tiebreaker re-lock fix (`2534033`)
  lives only on PR #291. Production still rewrites handicaps and the team bonus
  on re-lock.
- **F6 is parked** — an LO cannot fix a lineup on a finished match; logged as a
  TODO in `LIST_FOR_ED.md`.

## Open questions

- Where does the "which team won the tiebreaker" fact live — a column on
  `matches`, or its own table? D2 makes this REQUIRED rather than optional: the
  handicap rule derives credit from it. The shape is still a planning decision.
- Does anything need to *show* a tiebreaker once records exist, or is retention
  purely for future use? Ed: "not at the moment," but expects questions.
