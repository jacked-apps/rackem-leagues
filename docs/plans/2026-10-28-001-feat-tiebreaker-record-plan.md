# PLAN — Tiebreaker as its own record

Date: 2026-10-28. Branch: `audit/tiebreaker-phase3` (rename or branch off for
implementation). Status: **drafted, not approved.**

Requirements: `docs/brainstorms/2026-10-28-tiebreaker-requirements.md`
Evidence: `docs/audits/2026-10-28-tiebreaker-audit.md`

## Goal

Give the tiebreaker its own record — a parallel mini-match carrying its own
lineups, handicaps and games-needed — so a tie never touches the match record or
its lineups (requirement D0).

## Scope call (Ed, 2026-10-28)

**The handicap counting fix is OUT of this plan.** Tiebreaker games continue not
to count toward handicaps, which is today's behaviour and is acceptable for now.
It is deferred to Unit 7, documented but not built.

The plan's obligation is that **recording is complete enough that Unit 7 needs no
schema change** — Ed: *"if we are just solid on how we are recording the tiebreak
games then we can figure out how to add it to the handicap calculator later."*
Unit 1 is designed against that constraint and Unit 7 states the check.

**These changes are invisible to players.** Both the handicap calculator and the
personal game history filter `is_tiebreaker = false` today
(`playerGameHistory.ts:119`), so nothing in Units 1–6 alters a single displayed
number. That is what makes it safe to land the architecture before the rule.

## What exists today

- A tie **unlocks both match lineups** so captains can pick a tiebreak order
  (`MatchEndVerification.tsx:492-501`). That unlock is the root of audit finding
  F1.
- The tiebreak order is stored on the tiebreak `match_games` rows by
  `useTiebreakerLineup`, while the lineup row keeps the regular-game order.
- `MatchLineup.tsx` enters tiebreak mode on `matchData.match_result === 'tie'`
  and swaps its handlers; the handicap column is hidden by rendering only.
- **"First to 2" is hardcoded** — `TiebreakerScoreboard.tsx:73` computes
  `matchComplete` as `homeWins >= 2 || awayWins >= 2` and passes literal `2`
  thresholds into `MatchEndVerification`.
- On resolution, **all three games are overwritten** as won by the winning
  team's players (`MatchEndVerification.tsx:409-442`) — the only way the "all
  three winners get credit" rule is expressed today, and the cause of the
  fabricated head-to-head record.
- The tiebreaker's own winner is counted from the REAL results before that
  overwrite (`TiebreakerScoreboard.tsx:60-69`), so removing the overwrite does
  not break winner determination.

---

## Unit 1 — The tiebreak record (schema)

**Goal:** Persist a tiebreaker as a mini-match.

**Dependencies:** none.

**Files:** new migration in `supabase/migrations/` — use
`supabase migration new tiebreak_records` for a REAL UTC timestamp (never the
legacy all-zeros form), then confirm the duplicate-version check comes back
empty. Regenerate `src/types/database.types.ts`; update `TABLE_OF_CONTENTS.md`.

**Approach:** two NEW tables, mirroring the match / `match_lineups` pair.

### Why new tables and not a `kind` column on `match_lineups`

Asked by Ed, 2026-10-28: would it be easier to reuse the existing tables with a
discriminator column? **No — separate tables.**

*The concrete failure.* `engineRunningTotals.ts:133-147` fetches every locked
lineup for a match and then picks home and away with `.find()` on `team_id`,
having checked only `length >= 2`. With a discriminator, a tied match has FOUR
locked rows carrying the same two team ids, and `.find()` takes whichever
Postgres returns first — an order that is not guaranteed. It would sometimes
compute the match's running totals from the TIEBREAK handicaps. No error, no
crash, occasionally wrong points.

That is one site. **22 app read sites touch `match_lineups`, plus 22 migration
files.** Each becomes a place where a forgotten filter is a silent bug.

*The pattern.* This audit chased two bugs of exactly that shape — `week_name`
(shared column, two writers disagreeing) and `is_tiebreaker` (write side sets
it, read side discards it, silently disabling the anti-sandbagging rule).
Finding F3 records that the tiebreak exclusion is "a convention, not an
enforcement." A `kind` column would be the third instance of the same pattern.

*It also undercuts D0.* The guarantee is "the match lineup is never touched."
In one table that holds only while every query remembers the filter — a promise.
In separate tables a query against `match_lineups` **cannot see** a tiebreak
lineup — impossible rather than disciplined. D0 asked for structural separation;
a discriminator gives the shape without the protection.

*Fair to the other side.* Reuse wins when two things are read TOGETHER and share
a lifecycle, since splitting then forces constant joins. Not the case here:
tiebreak lineups are read only by the tiebreak flow, created later, locked
separately, frozen. The real cost of splitting is duplicated shape (5 slots +
5 handicaps defined twice) — a genuine cost, but it lives in the table
definition, not the UI; the lineup picker and lock controls are shared.
`match_lineups` also carries 5 swap columns that are meaningless for a
tiebreak, and reuse would inherit them.

*Sub-question: header columns on `matches` instead of a table?* More defensible
than sharing `match_lineups`, since nullable columns add no rows and break
nothing. Still going with the small table: `matches` is already wide, a
tiebreaker is rare and optional, and redoing one becomes deleting a row rather
than nulling four columns.

`match_tiebreakers` — one row per tied match:

- `id`, `match_id` (FK, UNIQUE — one tiebreaker per match)
- `games_needed` int NOT NULL — wins required. Frozen at creation, **not**
  hardcoded 2. This is the column that makes a 4v4 tiebreaker needing 3 wins a
  number rather than a branch.
- `game_count` int NOT NULL — how many games the tiebreaker lays out.
- `winning_team_id` uuid NULL until resolved.
- `resolved_at` timestamptz NULL — **required by Unit 7** to place a credited
  win inside the handicap's lookback window.
- `created_at`, `updated_at`

`match_tiebreaker_lineups` — one row per side, mirroring `match_lineups`:

- `id`, `tiebreaker_id` (FK), `team_id`
- `player1_id`..`player5_id`, `player1_handicap`..`player5_handicap`
  (5 slots so larger formats need no migration; handicaps **snapshotted** here
  so a later hand-edit of `match_lineups` cannot move them — the Ben vs Duff
  failure mode)
- `locked`, `locked_at`
- UNIQUE `(tiebreaker_id, team_id)`

**Why this satisfies the Unit 7 constraint.** The deferred handicap fix needs
exactly four things, all present: which team won (`winning_team_id`), the
credited players (the winning side's lineup row), when (`resolved_at`), and the
match (`match_id`). No later migration.

**Test scenarios:** a tiebreaker row and its two lineup rows insert and read
back; the `match_id` uniqueness constraint rejects a second tiebreaker; deleting
a match cascades. Place under `src/__tests__/database/` (sequential, jsdom) per
the testing conventions.

---

## Unit 2 — Create the record on a tie; stop unlocking the match lineups

**Goal:** A tie writes a tiebreak record instead of unlocking match lineups.

**Dependencies:** Unit 1.

**Files:** `src/components/scoring/MatchEndVerification.tsx`; new mutation module
(e.g. `src/api/mutations/tiebreakers.ts`).

**Approach:** replace the two `updateLineupMutation` unlock calls with creation
of the tiebreaker row plus its two lineup rows, seeded from the match lineups
(same players, same handicaps, order initially unset). Compute `games_needed` and
`game_count` from the league's resolved configuration at creation and freeze
them. Keep the existing "skip if already created" guard — the tie effect re-fires
on re-mount and realtime.

**This is where F1 dies.** With no unlock there is no re-lock, so nothing can
recalculate handicaps or re-derive the team bonus. The guard in `2534033`
(PR #291) stops being load-bearing — leave it in place, it becomes dead weight
rather than a risk.

**Test scenarios:** a tie creates one tiebreaker + two lineup rows; match lineups
keep `locked = true` and their original `locked_at`; re-firing the effect creates
nothing further.

---

## Unit 3 — Tiebreak lineup page reads and writes the record

**Goal:** Captains set their tiebreak order against the tiebreak record.

**Dependencies:** Unit 2.

**Files:** `src/player/MatchLineup.tsx`, `src/hooks/lineup/useTiebreakerLineup.ts`,
`src/hooks/lineup/useLineupPersistence.ts`.

**Approach:** the page asks *"is a tiebreak lineup being requested?"* rather than
reading match lock state. Order is written to the tiebreak lineup row; its
`locked` / `locked_at` are the tiebreak's own.

**The player pool comes from the MATCH LINEUP rows, not the team roster** — so
only players who actually played are selectable, enforced by where the data comes
from rather than by a check. (Today's equivalent is a filter in the render path,
`MatchLineup.tsx:961-965`.)

**Watch:** `isTiebreakerMode` currently keys off `matchData.match_result === 'tie'`
(`MatchLineup.tsx:289`) and drives roughly a dozen branches. Re-point it at the
presence of a tiebreak record and re-check every one; the handicap column is
hidden by rendering (`hideHandicap`), which stops mattering once the match lineup
is untouchable.

**Test scenarios:** picking an order writes the tiebreak lineup only; the match
lineup row is byte-identical before and after; a player not in the match lineup
cannot be selected.

---

## Unit 4 — Resolve from the record; stop overwriting the games

**Goal:** The tiebreaker completes against its own `games_needed`, and the game
rows keep their real results.

**Dependencies:** Units 1–3.

**Files:** `src/components/scoring/TiebreakerScoreboard.tsx`,
`src/components/scoring/MatchEndVerification.tsx`.

**Approach:** replace the hardcoded `2` with `games_needed` from the record (both
the `matchComplete` test and the thresholds passed down). On resolution write
`winning_team_id` and `resolved_at`, and **delete the three-game overwrite
block** — credit now lives on the record, so fabricating game results is
unnecessary. An unplayed game keeps a null winner, which is the honest record of
a game that never happened.

**Safe to land without Unit 7:** every read path still filters tiebreak games
out, so no displayed number changes.

**Test scenarios:** a 2–1 leaves the losing game recorded as a loss for the
winning team's player; a 2–0 leaves game 3 with a null winner; `games_needed = 3`
does not complete at 2 wins.

---

## Unit 5 — Backfill decision

**Goal:** Decide what happens to the one historical tiebreaker set.

**Dependencies:** Unit 1.

**Approach:** D5 says forward-only, no backfill. Confirm no code path assumes
every tiebreak `match_games` row has a matching record, so old matches keep
working untouched. Likely zero code; written down so it is a decision rather than
an oversight.

---

## Unit 6 — Audit cleanup

**Goal:** Clear the small findings while the code is open.

**Files:** `src/hooks/lineup/useLineupPersistence.ts` (delete the dead
`autoSaveLineup`, F5 — it writes handicaps for slots 1–3 only with no lock or
tiebreak guard, and is never called); `MatchEndVerification.tsx` (F4 — a tied
match is stamped `completed_at` while `status` stays `in_progress`; harmless
today, a trap for any future "finished" query).

F3 (tiebreak exclusion in `completeMatch` is a caller convention, not an
enforcement) — note only, no change.

---

## Unit 7 — DEFERRED: count tiebreak wins toward handicaps

**Not in this plan.** Ed, 2026-10-28: current behaviour is acceptable; revisit
later.

When it happens, per requirement D1:

    wins   = regular wins + credited tiebreak wins
    losses = regular losses ONLY
    weeks  = (wins + losses) / 6
    handicap = (wins - losses) / weeks

- Credited players are the winning side's tiebreak lineup on the record.
- `losses` can no longer be shortcut as `gamesPlayed - wins`
  (`calculatePlayerHandicap.ts:85`), because credited wins are not rows.
- `weeks = games / 6` is **deliberate** — real week-counting was tried, 6-vs-7
  games got messy and did not work. Do not "fix" it.
- Open: the lookback window. Handicaps take the last 200 games; the credited wins
  need a matching window, which is what `resolved_at` is for.

**Gate before building Unit 7:** confirm Unit 1 shipped all four facts it needs.
If any is missing, that is a plan defect, not a Unit 7 problem.

---

## Sequencing and risk

Units 1→4 are a chain. Units 5 and 6 are independent and can ride along.

### Unit 3 is the one real risk

Everything about tiebreak mode on the lineup page hangs off one boolean. Today
it is "the match result says tie"; Unit 3 re-points it at "a tiebreak record
exists." That switch drives roughly a dozen branches — which handler a dropdown
calls, where the lock button writes, whether the handicap column renders, which
players are offered — scattered through a 1,200-line file.

What it risks, worst first:

1. **A player-change branch still in normal mode writes to `match_lineups`** —
   the exact thing D0 exists to prevent. The bug being removed would return
   through the screen rewritten to remove it.
2. **A timing gap.** The flag currently flips when the tie is recorded;
   afterwards it flips when the record exists. If those are not the same instant
   (realtime not yet delivered, say), the page renders in the wrong mode briefly
   and a fast tap lands in the wrong path.
3. **A missed branch** leaves half the page in tiebreak mode. Visibly wrong
   rather than silently wrong, so the least dangerous of the three.

Mitigation:

- **Inventory the branches before editing, not during.** A dozen call sites is
  small enough to enumerate properly first.
- **One derived value, computed once** — not re-derived per branch, so there is
  exactly one thing to get right instead of twelve.
- **Land Unit 3 alone** and exercise a real tie end-to-end before Unit 4, so a
  regression has one suspect.
- **The test that actually catches it:** assert the match lineup row is
  byte-identical before and after the whole tiebreak flow. It fires regardless
  of which branch leaked.

Two things work in our favour: Units 1–6 change nothing a player sees, and with
Unit 3 landed before Unit 4 the old overwrite is still running, so results stay
consistent while it is shaken out.

**Unrelated but still live:** PR #291 carries the F1 guard for the code as it
exists today. This plan eventually makes that guard redundant; until the plan
ships, production still rewrites handicaps on a tiebreak re-lock, so #291 remains
the urgent item.
