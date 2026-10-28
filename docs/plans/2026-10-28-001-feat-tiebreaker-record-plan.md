# PLAN — Tiebreaker as its own record

Date: 2026-10-28. Branch: `audit/tiebreaker-phase3` (branch off for
implementation). Status: **revised after document review; drafted, not
approved.**

Requirements: `docs/brainstorms/2026-10-28-tiebreaker-requirements.md`
Evidence: `docs/audits/2026-10-28-tiebreaker-audit.md`

## Revision note — read this before anything else

The first draft of this plan rested on a **false premise**: that tiebreak games
do not count toward handicaps, which made the handicap work safe to defer. That
was wrong. A four-persona document review caught it, and two reviewers found it
independently.

**Ed's anti-sandbagging rule WORKS in production today.** `calculatePlayerHandicap`
imports `fetchPlayerGameHistory` from `@/api/queries/matchGames` (NOT the
same-named function in `playerGameHistory.ts`), and that function carries an
explicit "TIEBREAKER HANDICAP RULE" block keeping tiebreak wins and dropping
tiebreak losses.

Two consequences, both structural:

1. **The three-game overwrite is load-bearing.** It produces the credited wins
   the handicap counts. Deleting it without a replacement switches the rule off.
2. **The handicap work is IN SCOPE** (Ed, 2026-10-28: "if we should bring it in
   bring it in"). It is no longer a deferred Unit 7 — it ships with the unit
   that removes the overwrite, because they are one change.

A second P0 also came out of review: the lineup unlock this plan removes is a
**signal three other code paths depend on**, two of which were in no unit.

## Goal

Give the tiebreaker its own record — a parallel mini-match carrying its own
lineups, handicaps and games-needed — so a tie never touches the match record or
its lineups (requirement D0), **while preserving the anti-sandbagging rule
exactly**.

## What exists today

- A tie **unlocks both match lineups** so captains can pick a tiebreak order
  (`MatchEndVerification.tsx:490-504`). Root of audit finding F1.
- **Three other paths read that unlock as a signal** (found in review; see
  Unit 2):
  - `MatchEndVerification.tsx:534-554` polls up to 10s for both lineups to be
    UNLOCKED, then throws `Timeout waiting for lineups to be unlocked`.
  - `useMatchPreparation.ts` auto-navigates to `/score` when both lineups are
    locked and games exist — which is always true in a tiebreak.
  - `ScoreMatch.tsx:924-925` requires `bothLineupsLocked` for its tiebreak mode.
- The tiebreak order is stored on the tiebreak `match_games` rows by
  `useTiebreakerLineup`; the lineup row keeps the regular-game order.
- `MatchLineup.tsx:289` enters tiebreak mode on `match_result === 'tie'`.
- **"First to 2" is hardcoded** (`TiebreakerScoreboard.tsx:73`), and so is the
  game geometry: `useTiebreakerLineup.ts` computes `18 + position` in three
  places with exactly three setters, and `ScoreMatch.tsx:931` filters
  `gameNumber >= 19 && gameNumber <= 21`. `src/utils/tiebreaker/gameNumbers.ts`
  already exists for this and is used only by `MatchEndVerification`.
- On resolution, **all three games are overwritten** as won by the winning
  team's players (`MatchEndVerification.tsx:409-443`). This is what makes the
  handicap rule work, and also what makes a per-game record untrue.
- The tiebreaker's own winner is counted from the REAL results *before* that
  overwrite (`TiebreakerScoreboard.tsx:60-69`) — verified in review, so removing
  the overwrite does not disturb winner determination.
- `tiebreaker_format` has **four** values (`resolvedSystemConfig.ts:92`):
  `best_of_3_short_race`, `single_short_race`, `accept_tie`, `manual`. Only the
  first is the flow described above. `manual` returns early at
  `MatchEndVerification.tsx:449` before any of it.

---

## Unit 1 — The tiebreak record (schema)

**Goal:** Persist a tiebreaker as a mini-match.

**Dependencies:** none.

**Files:** new migration via `supabase migration new tiebreak_records` (REAL UTC
timestamp, never the legacy all-zeros form); confirm the duplicate-version check
is empty. Regenerate `src/types/database.types.ts`; update `TABLE_OF_CONTENTS.md`.

**Approach:** two NEW tables, mirroring the match / `match_lineups` pair.

`match_tiebreakers` — one row per tied match:

- `id`, `match_id` (FK, UNIQUE — one tiebreaker per match)
- `games_needed` int NOT NULL — wins required. Frozen at creation.
- `game_count` int NOT NULL — how many games the tiebreaker lays out.
- `players_per_side` int NOT NULL — **how many players the tiebreaker credits.**
  Added in review: for a 5v5 match with a best-of-3 tiebreaker, seeding copies
  five players but only three take part, so "non-null slots" cannot tell the
  handicap step who to credit.
- `game_type` NOT NULL — **added in review.** Handicaps are per game type
  (`matchGames.ts:88` filters `.eq('game_type', gameType)`), so a credited win
  with no game type cannot be routed. Known at creation; `match_games` already
  denormalizes it for the same reason.
- `winning_team_id` uuid NULL until resolved
- `resolved_at` timestamptz NULL — places a credited win in the handicap
  lookback window.
- `created_at`, `updated_at`

`match_tiebreaker_lineups` — one row per side, mirroring `match_lineups`:

- `id`, `tiebreaker_id` (FK), `team_id`
- `player1_id`..`player5_id` + handicaps. Five slots **mirrors the existing
  `match_lineups` shape**, and 4v4/5v5 already exist in this codebase
  (games-needed-4v4/5v5 formulas, wizard format steps) — verified in review.
  This is consistency with shipped schema, not speculative generality.
- `locked`, `locked_at`
- UNIQUE `(tiebreaker_id, team_id)`

**Realtime + access (added in review).** `match_games` and `match_lineups` are
in the `supabase_realtime` publication
(`supabase/migrations/20251212000000_enable_realtime.sql:38-40`) and subscribed
by `useMatchRealtime.ts`. That is how one captain's pick reaches the other's
phone. **Add both new tables to the publication** using the existing idempotent
guard pattern, and state the RLS/grants posture explicitly.

**Open — decide at implementation:** per-slot handicaps on the tiebreak lineup
have no reader in this plan (a credited win is a win regardless of rating).
Review flagged them as ten columns defending a path they are not on. Keep them
only if a reader is identified; otherwise drop them and keep player ids.

**Test scenarios:** rows insert and read back; `match_id` uniqueness rejects a
second tiebreaker; deleting a match cascades; **the one historical tiebreak
`match_games` set has no record and nothing assumes one** (folded in from the
old Unit 5, which review correctly called a checklist item, not a unit). Place
under `src/__tests__/database/`.

---

## Unit 2 — Create the record on a tie; stop unlocking the match lineups

**Goal:** A tie writes a tiebreak record instead of unlocking match lineups.

**Dependencies:** Unit 1.

**Files:** `src/components/scoring/MatchEndVerification.tsx`; new
`src/api/mutations/tiebreakers.ts`; **and the three unlock-dependent paths found
in review** — `src/components/scoring/MatchEndVerification.tsx:534-554`
(the unlock poll), `src/hooks/lineup/useMatchPreparation.ts` (auto-navigate),
`src/player/ScoreMatch.tsx:924-925` (`bothLineupsLocked`).

**Approach:** replace the two unlock calls with creation of the tiebreaker row
plus its two lineup rows, seeded from the match lineups. Seed **only the
participating slots** (`players_per_side`), leaving the rest null.

**The unlock is a signal, not just a hazard — this is the P0 from review.**
Removing it without re-pointing these three breaks the feature outright:

1. The poll waits for an unlock that never comes → throws after 10s → the tie
   never completes and captains never reach the lineup page. **Re-point it at
   the tiebreak record existing.**
2. `useMatchPreparation` would bounce captains straight to `/score` before they
   could choose an order. **Must exclude the tiebreak case.**
3. `ScoreMatch`'s `bothLineupsLocked` flips true the instant tiebreak games
   exist, changing the surface mid-tie. **Re-point at the record.**

**Keep writing `match_result = 'tie'`.** `MatchPhaseGuard.computePhaseRedirect`
still routes on it; a later tidy-up that stops writing it would strand captains.

**`tiebreaker_format` is four-valued (review).** State behaviour for each:
`best_of_3_short_race` → record as described; `single_short_race` → record with
`games_needed = 1`, `players_per_side = 1`; `accept_tie` → **no record**;
`manual` → **OUT OF SCOPE (Ed, 2026-10-28).** The LO has the result on paper;
how a manual tiebreaker credits handicaps is a rules question for later and
"realistically it only matters for specific instances." Do not design for it,
do not block on it. The only requirement is that the `manual` early-return at
`MatchEndVerification.tsx:449` keeps working exactly as it does today — Unit 2
rewrites that region, so leaving it intact is a test case, not an assumption.

**`games_needed` / `game_count` have no numeric config source (review).**
`resolved_league_preferences` carries only the `tiebreaker_format` enum. The
enum → (games_needed, game_count, players_per_side) mapping must be written and
given a home; it is an architectural decision this plan owes.

**Test scenarios:** a tie creates one tiebreaker + two lineup rows; match
lineups keep `locked = true` and their original `locked_at`; re-firing creates
nothing further; a tie still navigates both captains to the lineup page.

---

## Unit 3 — Tiebreak lineup page reads and writes the record

**Goal:** Captains set their tiebreak order against the tiebreak record.

**Dependencies:** Unit 2.

**Files:** `src/player/MatchLineup.tsx`, `src/hooks/lineup/useTiebreakerLineup.ts`,
`src/hooks/lineup/useLineupPersistence.ts`, `src/realtime/useMatchRealtime.ts`.

**Approach:** the page asks *"is a tiebreak lineup being requested?"* rather than
reading match lock state. Order writes to the tiebreak lineup row; `locked` /
`locked_at` are the tiebreak's own. Add realtime subscriptions for the new
tables so the two-device handshake still propagates.

**The player pool comes from the MATCH LINEUP rows, not the team roster** — only
players who actually played are selectable, enforced by where the data comes
from.

**Replace the hardcoded geometry (review).** `useTiebreakerLineup.ts` computes
`18 + position` in three places with three fixed setters. Use
`tiebreakerGameNumbers` / `tiebreakerGameToPosition` from
`src/utils/tiebreaker/gameNumbers.ts` and an indexed slot array sized by the
record. Without this, `games_needed` is a column nothing downstream honours.

**Watch:** `isTiebreakerMode` (`MatchLineup.tsx:289`) drives roughly a dozen
branches. See "Unit 3 is the one real risk" below.

**Test scenarios:** picking an order writes the tiebreak lineup only; the match
lineup row is byte-identical before and after; a player not in the match lineup
cannot be selected.

---

## Unit 4 — Resolve from the record, replace the overwrite, keep the rule

**Goal:** The tiebreaker completes against its own `games_needed`, the game rows
keep their real results, **and the anti-sandbagging rule keeps working across
the change.**

**Dependencies:** Units 1–3. **Ships together with Unit 5 — not before.**

**Files:** `src/components/scoring/TiebreakerScoreboard.tsx`,
`src/components/scoring/MatchEndVerification.tsx`, `src/player/ScoreMatch.tsx`
(the `19..21` filter).

**Approach:** replace the hardcoded `2` with `games_needed`. On resolution write
`winning_team_id` and `resolved_at`. **Delete the three-game overwrite** — but
only in the same change that lands Unit 5, because the overwrite is the only
producer of the credited wins the handicap currently reads.

An unplayed game keeps a null winner. Note the overwrite is also the only writer
of `confirmed_by_home` / `confirmed_by_away` on tiebreak rows, and today it puts
member-id strings into boolean columns — removing it is an improvement, but
record that those rows will now sit unconfirmed.

**Test scenarios:** a 2–1 leaves the losing game recorded as a loss for the
winning team's player; a 2–0 leaves game 3 with a null winner; `games_needed = 3`
does not complete at 2 wins.

---

## Unit 5 — Credit tiebreak wins from the record (was the deferred Unit 7)

**Goal:** Preserve Ed's rule exactly, sourced from the record instead of from
fabricated game rows.

**Dependencies:** Units 1–4. **Must ship with Unit 4.**

**Files:** `src/utils/calculatePlayerHandicap.ts`,
`src/api/queries/matchGames.ts`.

**Approach**, per requirement D1:

    wins   = regular wins + credited tiebreak wins
    losses = regular losses ONLY
    weeks  = (wins + losses) / 6
    handicap = (wins - losses) / weeks

- Credited players are the winning side's tiebreak lineup on the record, capped
  at `players_per_side`.
- **Avoid the double count (review).** D3 keeps tiebreak rows in `match_games`,
  and `matchGames.fetchPlayerGameHistory` currently KEEPS tiebreak wins. The
  regular tally must now filter `is_tiebreaker = false`, so credited wins come
  solely from the record. A player who played and won must gain exactly one win,
  not two. **Add a parity test asserting that.**
- `losses` can no longer be shortcut as `gamesPlayed - wins`
  (`calculatePlayerHandicap.ts:85`), because credited wins are not rows.
- Scope by `game_type` and league using the record's `game_type` and
  `match_id` → `matches` → `seasons`.
- `weeks = games / 6` is **deliberate** — real week-counting was tried, 6-vs-7
  got messy and did not work. Do not "fix" it.

**The acceptance bar is parity.** For a tiebreaker resolved before and after this
change, every affected player's handicap must come out **identical**. That is
the whole point: the rule does not change, only where the credit comes from.

---

## Unit 6 — Deploy cutover for a tie in flight

**Goal:** A match that is already tied when this ships must not be stranded.

**Dependencies:** Units 1–5.

**Approach:** D5 says forward-only for *resolved history*, and that stands. But
review found the dangerous direction is a tie that is **unresolved at deploy**:
`match_result='tie'`, three tiebreak `match_games` rows, both match lineups
already UNLOCKED, and no record. After Unit 3 that match renders the lineup page
in NORMAL mode against unlocked match lineups — captains then write straight into
`match_lineups` through the four unguarded writers (audit F2). That is the exact
D0 violation this plan exists to prevent, caused by the deploy itself. After
Unit 4 its `games_needed` is undefined, so it can never complete.

Pick one and write it down: a one-off repair script creating records for
in-flight ties; a lazy create-on-read in Unit 3; or a release step requiring all
ties resolved before deploy. **Given one league and rare ties, the release step
is probably sufficient and cheapest — but it must be explicit, not assumed.**

---

## Unit 7 — Cleanup

**Goal:** Clear the small findings while the code is open.

- **Rename one `fetchPlayerGameHistory`.** Two exported functions with the same
  name and opposite tiebreaker semantics produced this plan's central wrong
  claim. Cheap insurance; the natural home is here.
- Delete the dead `autoSaveLineup` (`useLineupPersistence.ts:282`, audit F5).
- F4: a tied match is stamped `completed_at` while `status` stays
  `in_progress` — harmless today, a trap for any future "finished" query.
- F3 (tiebreak exclusion in `completeMatch` is a caller convention, not an
  enforcement) — note only, no change.

### Unit 7b — Fix `MatchWithDetails` properly (Ed: do NOT paper over)

**Ed's instruction:** make sure this plan FIXES this rather than adding to it. A
third workaround type is a plan violation, not a shortcut.

*The problem.* `MatchWithDetails` (`src/types/schedule.ts:113`) declares none of
the verification columns, `started_at`, or the `season`/`league` embed that
`src/api/queries/matches.ts` selects. Every query ends in `as MatchWithDetails`
(`:122,156,196,240,307,437`), and a cast switches checking OFF — so a field that
never arrives reads `undefined` at runtime with no warning. Two places already
encode that the real shape is bigger: `MyMatchRow`
(`useMyMatchSurfaces.ts:37`) and `MatchWithVenueDetails` (`schedule.ts:193`).

*Split it (review).* The halves are not the same size:

- **Safe half:** add the missing fields; delete `MyMatchRow`.
- **Risky half:** remove the six casts, and `MatchWithVenueDetails` is not a
  pure duplicate — it narrows `street_address` from optional to required, so
  deleting it changes its consumers' contract. Size this separately.

**Gate:** if implementing any unit requires a new `X & { ... }` patch type over
`MatchWithDetails`, stop and fix the declaration instead.

---

## Sequencing and risk

Units 1→2→3 are a chain. **Units 4 and 5 ship together** — splitting them
switches off the anti-sandbagging rule for the gap. Unit 6 gates the deploy.
Unit 7 can ride along.

### Unit 3 is the one real risk

Tiebreak mode on the lineup page hangs off one boolean driving roughly a dozen
branches in a 1,200-line file, and Unit 3 re-points what feeds it.

Worst first:

1. **A player-change branch still in normal mode writes to `match_lineups`** —
   the exact thing D0 exists to prevent, returning through the screen rewritten
   to remove it.
2. **A timing gap.** The flag flips on record existence rather than on
   `match_result`; if realtime has not delivered the record, the page renders in
   the wrong mode briefly. Review notes the "one derived value" mitigation
   addresses re-derivation, not propagation delay — the realtime subscription in
   Unit 3 is what actually closes it.
3. **A missed branch** leaves half the page in tiebreak mode — visibly wrong,
   so least dangerous.

Mitigation: inventory the branches before editing; one derived value computed
once; land Unit 3 alone; **assert the match lineup row is byte-identical across
the whole tiebreak flow** — it fires whichever branch leaked.

**Reproducing a tie (review).** Unit 3's mitigation assumes a tie can be produced
on demand. A tie is rare, multi-device and realtime-gated. Confirm there is seed
data or a dev path for it, or the end-to-end check cannot actually be run.

### Honest scope of what this fixes

This closes the **unlock instance** of "a locked lineup is not protected" (F1).
It does NOT close F2 — the four unguarded writers in `MatchLineup.tsx` remain,
by decision D6 (no DB-level lock; swaps and LO corrections are routine). A
reader should not come away thinking lineups are now immutable.

**Do-nothing baseline (review).** PR #291 already guards the re-lock path. Once
it merges, the live damage from F1 is contained, and everything here becomes
improvement rather than repair. That remains a legitimate option.
