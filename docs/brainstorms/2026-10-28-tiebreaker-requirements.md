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

- **Tiebreak record** — which match, which team won, and **the three credited
  player ids**, frozen that night.
- **Game rows** — what actually happened. Lost to John → it says you lost to
  John. Never played → no winner, null.
- **Handicap** — regular games plus the credited tiebreak wins (D1).
- **Head-to-head** — reads the game rows, so a personal record is what happened
  at the table.

**Why the credited players are STORED, not derived.** Deriving them from the
winning team's lineup means reading `match_lineups`, which this same audit
proved can be hand-edited months later with no trace (see the Ben vs Duff
investigation). A later lineup edit could silently change who was credited for a
tiebreaker a season ago. Recording the three ids at resolution time makes the
credit immutable.

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

- Shape of the tiebreak record. It must hold the match, the winning team and
  three credited player ids (D2), which points at its own table rather than
  columns on `matches`. Confirm at planning time.
- The window. Handicaps look at the last 200 games; the credited tiebreak wins
  need a matching window so both halves cover the same period.
- Does anything need to *show* a tiebreaker once records exist, or is retention
  purely for future use? Ed: "not at the moment," but expects questions.
