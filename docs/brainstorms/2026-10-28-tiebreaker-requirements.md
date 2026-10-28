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

> **CORRECTED 2026-10-28 (document review).** This section previously claimed
> "the anti-sandbagging rule is currently switched off." **That was wrong.** The
> rule WORKS in production today. The error was mine: there are two exported
> functions named `fetchPlayerGameHistory`, and I read the wrong one. Both the
> feasibility and adversarial reviewers caught it independently. Everything
> below is the corrected account.

**The rule works today — but only because the game rows are fabricated.**

- `calculatePlayerHandicap.ts:17` imports `fetchPlayerGameHistory` from
  **`@/api/queries/matchGames`**, NOT from `playerGameHistory.ts`.
- That function (`matchGames.ts:128-141`) carries an explicit block commented
  **"TIEBREAKER HANDICAP RULE"**: keep every non-tiebreak game, keep a tiebreak
  game the player WON, drop a tiebreak game the player LOST. That is exactly
  Ed's rule.
- The credited wins exist because `MatchEndVerification.tsx:409-443` overwrites
  all three tiebreak games as won by the winning side. The overwrite is the
  **producer**; the filter above is the **consumer**.
- `playerGameHistory.ts:119` (which does filter every tiebreak game out) has
  exactly one caller: `src/stats/gameHistorySource.ts`, the My Stats page.

**So the real defect is not a broken rule — it is a working rule expressed by
writing results that did not happen.** That is what makes a personal record
against an opponent untrustworthy, and it is why the overwrite has to be
replaced rather than simply deleted.

**Consequence for sequencing (the thing this error nearly cost us):** deleting
the overwrite without a replacement in place would silently switch the rule OFF.
Any unit that removes it must ship together with the unit that credits wins from
the tiebreak record. They are one change, not two.

## The two-name trap, for the record

Two exported functions named `fetchPlayerGameHistory`, in different files, with
**opposite** tiebreaker semantics, is what produced the wrong claim above. This
is the third instance of the same pattern in one session (`week_name`,
`updateReportStatus`, this). Renaming one of them is cheap insurance.

## Decisions

**D0 — ARCHITECTURAL KEYSTONE: the tiebreak record is a parallel mini-match
record, and the match record is never touched.** (Ed, 2026-10-28. Everything
below hangs off this.)

The tiebreak record **mirrors the shape of the match record** — its own lineup
order per side, its own handicaps, its own games-needed threshold. It is a
self-contained mini-match sitting alongside the real one.

What that buys, in Ed's words: *"there would be no reason to unlock the match
record at all."*

- **The match lineups are NEVER unlocked.** Today a tie unlocks both so captains
  can choose a tiebreak order, and that unlock is the root of F1: re-locking
  recalculates handicaps from data that now includes tonight's games,
  re-derives the team bonus, and can clear a double-duty player's slots. With a
  separate record there is nothing to unlock, so **the entire bug class becomes
  structurally impossible rather than guarded against.** The guard shipped in
  `2534033` (PR #291) stops being load-bearing.
- **The lineup page asks a different question.** It does not need to read the
  match as unlocked; it can tell a *tiebreak lineup* is asking rather than a
  *match lineup*. Lock state on the match is left alone entirely.
- **No new player can appear.** The tiebreak lineup's choices derive from the
  **match lineup records**, not the team roster — so only players who actually
  played the match are selectable. Enforced by where the data comes from, not
  by a check that can be forgotten.
- **Format-agnostic by construction.** Games-needed lives ON the record, so a
  4v4 or 5v5 tiebreaker needing 3 wins is a different number, not a new branch.
  Consistent with the house rule that match operations never switch on format —
  they read what the record declares.
- **Frozen handicaps.** Mirroring the handicaps onto the record snapshots them
  at resolution time, so a later hand-edit of `match_lineups` (see the Ben vs
  Duff investigation) cannot retroactively move them.

**D1 — The handicap math.** (Ed, 2026-10-28, corrected twice. Read the
`weeksPlayed` note below before touching any of this.)

    wins   = regular wins + tiebreak wins credited to this player
    losses = regular losses ONLY  (a tiebreak loss never counts — it is as if
             the game never happened)
    weeks  = (wins + losses) / 6
    points handicap = (wins - losses) / weeks

A credited tiebreak win is a **win**, so it lands in the numerator *and*, via
`wins + losses`, in the denominator. It is not numerator-only.

*Two earlier readings here were wrong and are recorded so they are not
re-derived: (a) "let the extra game land in the divisor naturally" reasoned from
the code instead of the rule; (b) "a separate tally keeps the game count from
moving" mistook the separate CELL in Ed's spreadsheet — a bookkeeping device so
he could see tiebreak wins — for separate MATH. The cell folds into wins.*

### Why `weeks = games / 6` and not real weeks

**This is deliberate, it is not a bug, and it has already been tried the other
way.** When tiebreak games started counting, a week was sometimes 6 games and
sometimes 7. Ed tried tracking the true week count: it got messy, and it did not
work. Dividing the game total by a flat 6 is arbitrary, far simpler, and in
practice **more accurate**. Leave it alone.

**D2 — Three independent facts; nothing is rewritten.**
(Revised twice on 2026-10-28. First pass had the credited result overwrite the
game result, which made "how did I play against John in the tiebreaker"
unanswerable. Second pass derived the credit from the winning team's lineup.
Ed improved on both: store the credited players ON the tiebreak record.)

- **Tiebreak record** — the parallel mini-match of D0: both tiebreak lineups,
  handicaps, games-needed, and which side won. **The credited players need no
  separate list** — they ARE the winning side's tiebreak lineup on this record,
  and the record is frozen, so they stay immune to any later edit of
  `match_lineups`.
- **Game rows** — what actually happened. Lost to John → it says you lost to
  John. Never played → no winner, null.
- **Handicap** — regular games plus the credited tiebreak wins (D1).
- **Head-to-head** — reads the game rows, so a personal record is what happened
  at the table.

**Why the credit lives on the tiebreak record, not on `match_lineups`.** This
same audit proved `match_lineups` can be hand-edited months later with no trace
(see the Ben vs Duff investigation), so deriving credit from it would let a
later edit silently change who was credited for a tiebreaker a season ago. The
tiebreak record is written at resolution time and not touched again.

The overwrite that currently rewrites all three games as won by the winning team
**goes away**. It only ever existed to smuggle the credit into a column; once the
credit has its own home it is unnecessary, and it is the sole cause of the
fabricated-record problem.

**D3 — Tiebreaker games stay in `match_games` with the `is_tiebreaker` flag.** A
game result is a game result; the flag is the only difference. This is what lets
head-to-head include tiebreakers while handicaps discount them.

**D4 — Keep durable tiebreaker records (load-bearing — D1 and D2 both read them).** Nothing displays a tiebreaker today,
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
- **Truthful game rows alone cannot produce the credit — the record is
  required.** On the winning team, a player who actually LOST has a row saying
  he lost, and a player who never shot has no row at all. Reading games alone
  credits neither. This is precisely why the current code overwrites all three
  games, and why removing that overwrite obliges us to add the record.
- **`losses` can no longer be shortcut as `gamesPlayed - wins`.**
  `calculatePlayerHandicap.ts:85` derives losses that way today, which only
  holds while every win is a row in the list. Credited tiebreak wins are not
  rows, so losses must be counted explicitly.
- **F1 is unshipped, not unwritten.** The tiebreaker re-lock fix (`2534033`)
  lives only on PR #291. Production still rewrites handicaps and the team bonus
  on re-lock.
- **F6 is parked** — an LO cannot fix a lineup on a finished match; logged as a
  TODO in `LIST_FOR_ED.md`.

## Open questions

- Shape of the tiebreak record. D0 makes it a mini-match — two lineups,
  handicaps, games-needed, winning side — so it is its own table (or small set
  of them), not columns on `matches`. Exact shape at planning time.
- How much of the match record it mirrors, and whether any of that structure
  can be shared rather than duplicated.
- The window. Handicaps look at the last 200 games; the credited tiebreak wins
  need a matching window so both halves cover the same period.
- Does anything need to *show* a tiebreaker once records exist, or is retention
  purely for future use? Ed: "not at the moment," but expects questions.
