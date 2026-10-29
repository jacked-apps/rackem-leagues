# PLAN — Tiebreaker as its own record

Date: 2026-10-28. Branch: `audit/tiebreaker-phase3` (branch off for
implementation). Status: **ALL UNITS BUILT on `feat/tiebreaker-record` (2026-10-29)** —
Units 1–5 and 7 in code, Unit 6 decided as a release step (release outside
Sunday play). 7b's risky half was sized and needs its own plan. Ed tested a
real tie end to end. No PR yet.

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

> **DECIDED 2026-10-28 (implementation, Ed): `accept_tie` is not a real
> choice.** Found while starting this unit: today the code special-cases only
> `manual` — every other value, `accept_tie` included, runs best-of-3. And
> `accept_tie` was the DEFAULT in the `preferences` column, the resolved view's
> fallback, the scoring screen's fallback, and the wizard; every stored row said
> it without anyone choosing it. Implementing "`accept_tie` → no record" as
> written above would have switched tiebreakers OFF for every league. Ed: it was
> a just-in-case option suggested during an earlier plan, never meant as the
> default, and no league he runs allows ties — take it off default; no way to
> select it is fine. Done in migration `20261028204853_tiebreaker_default_best_of_3`
> (default + stored rows + view fallback → best-of-3) and the wizard (option
> removed). **Consequence for this unit:** frozen match snapshots can still
> carry `accept_tie`; they map to best-of-3, which is exactly what they get
> today. Do NOT implement a "no record" path for it.

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

> **TIGHTENED 2026-10-28 (Ed, during implementation).** "Selectable from the
> players who played" was still too loose. The rule: **the same players who
> played the match MUST play the tiebreaker; the only thing that may change is
> the order.** John, Joe and Sara tied in that order → the tiebreak lineup is
> John, Joe and Sara, starting in that order (Unit 2 seeds it exactly so).
>
> **How (Ed): change the LIST, not the page.** The lineup page's dropdowns
> already take "the players allowed to play" and already drop a player from
> the other dropdowns once picked — so nobody plays twice (double duty is its
> own thing; out of scope here). For a tiebreaker, feed those SAME dropdowns
> the players from the match lineup record instead of the team roster. Same
> page, same controls — no new screen for players to learn. Do NOT build a
> separate "reorder" UI (an earlier draft of this note proposed one).
>
> **Double duty and subs (Ed).** Both are settled at the start of the match.
> A resolved double duty is the SAME member id in two slots — so the
> tiebreak list is the lineup's SLOTS, not its unique players. Do NOT dedupe:
> that person plays twice in the tiebreaker too. The existing "remove once
> picked" filtering must therefore count — a player listed twice stays
> available until picked twice.
>
> **No math (Ed).** Handicaps are copied from the lineup record, never looked
> up or recalculated. The number of games is preset by the format
> (`getTiebreakerShape`), never derived from thresholds.
>
> **And it is not a captain action.** Anyone on the team can set the lineup —
> captains are often absent, exactly as anyone on the team can score. The
> lineup page is not captain-gated today; keep it that way. Wherever this plan
> says "captain", read "someone from that team".

**Replace the hardcoded geometry (review).** `useTiebreakerLineup.ts` computes
`18 + position` in three places with three fixed setters. Use
`tiebreakerGameNumbers` / `tiebreakerGameToPosition` from
`src/utils/tiebreaker/gameNumbers.ts` and an indexed slot array sized by the
record. Without this, `games_needed` is a column nothing downstream honours.

**Watch:** `isTiebreakerMode` (`MatchLineup.tsx:289`) drives roughly a dozen
branches. See "Unit 3 is the one real risk" below.

> **AS BUILT 2026-10-28.** Recorded so the choices are not re-derived:
> - **`isTiebreakerMode` still keys off `match_result = 'tie'`, not record
>   existence.** `match_result` is written before the games and the record, so
>   the page is in tiebreak mode before the record arrives; until it loads,
>   tiebreak mode renders ZERO dropdowns (slot count comes from the record).
>   That closes risk #1/#2 below by construction — the page can never be in
>   normal mode during a tie and write `match_lineups`.
> - **Lock copies the order onto the tiebreak `match_games` rows, then locks.**
>   Scoring reads who shoots each tiebreak game from those rows; the lineup row
>   is the credit list. Order matters: the lock is the "ready" signal.
> - **Two writers found that the old unlock had kept quiet:** the Fargo
>   start-points negotiation (writes the MATCH row's targets; it ran whenever
>   both match lineups were locked) and the opponent-sub popup. Both now
>   explicitly off in tiebreak mode.
> - **Realtime is its own channel** (`useTiebreakerRealtime`), not more
>   bindings on `useMatchRealtime`: the tiebreak lineup table has no match_id,
>   so it filters by tiebreaker_id, known only once the record exists — adding
>   that to the main channel would rebuild the scoring connection mid-flow.

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

> **CHANGED 2026-10-29 (Ed, while testing): the tiebreak order starts BLANK.**
> Seeding it from the match order meant removing players just to reorder them.
> `createTiebreakerRecord` now writes empty lineups; each pick still copies the
> player's handicap from the match lineup, and the dropdown list is still the
> match lineup — so no new player can appear. A later "use same order" button
> that fills it in is Ed's idea, NOT built.

> **AS BUILT 2026-10-29 (Units 4 + 5, one commit).** Recorded so the choices
> are not re-derived:
>
> - **Finish line.** `TiebreakerScoreboard` takes `gamesNeeded` from the record;
>   ScoreMatch picks tiebreak games by `is_tiebreaker`, not by number 19–21.
> - **Overwrite → record.** `resolveTiebreakerRecord` writes `winning_team_id` +
>   `resolved_at` (only if unresolved) BEFORE the match completes, so a failure
>   leaves the match retryable rather than completed without credit.
> - **Where the credit is read.** `fetchTiebreakSlots` (one entry per slot,
>   capped at `players_per_side`, double duty twice). `fetchHandicapHistory`
>   merges those with regular rows and SKIPS tiebreak rows whose match has a
>   record — no double count. Losses are counted explicitly (wins + losses =
>   games), not as games − wins.
> - **Ties settled before the record (D5, no backfill).** Their rows still
>   carry the overwrite and have no record, so the old row rule still applies to
>   them. Without this, past tiebreak credit would have silently vanished.
> - **Exact window parity.** Losing slots also take their place in the newest-N
>   window and are dropped after, as the old loss rows were. The 25% fetch
>   buffer and the 50-game league threshold behave identically.
> - **Renamed** `matchGames.fetchPlayerGameHistory` → `fetchHandicapHistory`
>   (Unit 7's first bullet, done here because the function was rewritten anyway).
>   The profile game counts use it too, so they keep counting tiebreak wins.
> - **ONE deliberate difference from the old code — Ed CONFIRMED 2026-10-29
>   ("don't copy that behavior, it seems wrong").** The old overwrite
>   credited by the MATCH lineup's slot order, but the row's player was the
>   TIEBREAK order. When a side reordered, a winner whose position changed got
>   no credit at all (the row's winner was someone not on that row). The new
>   code credits every player on the winning tiebreak lineup (D2). It is
>   identical whenever the order was kept, and that is what the parity test
>   pins. In 5v5, credit also follows who actually played, not slots 1–3.
> - **Parity test** (`tiebreakHandicapParity.db.test.ts`): 2-1, 2-0 with game 3
>   unplayed, and double duty, across three windows, against a frozen copy of
>   the old code. Mutation-checked: dropping the credit or allowing the double
>   count both fail it.

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

> **DECIDED 2026-10-29 (Ed): release step, no code.** The league plays Sunday
> afternoons and ties are played out the same session. **Release this work
> when no one is playing — never during Sunday afternoon play.** A tie left
> half-done across the release (old flow started it, no tiebreak record) is
> the only case that strands, and it cannot arise outside play. No repair
> script, no self-healing create. Carry this line into the PR description so
> whoever deploys sees it.

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

> **AS BUILT 2026-10-29 (Unit 7).**
>
> - **Rename** — done in Units 4–5 (`fetchHandicapHistory`).
> - **`autoSaveLineup` deleted** — it had no callers.
> - **F4 fixed** — a tie no longer stamps `completed_at`
>   (`MatchEndVerification`, games-condition branch). The tiebreaker's
>   completion stamps it. Nothing read the tie's stamp; the only
>   `completed_at` reader (manual-scoring "reopened for correction") keys on
>   status `updating`, which a tie never has.
> - **F3** — note only, per the plan. Also found: `completeMatch` /
>   `useCompleteMatch` have NO callers at all, so F3's convention guards dead
>   code. Left alone — outside this plan.
> - **7b safe half — done.** `Match` now declares every column `select('*')`
>   returns (lineup ids, `started_at`, winner, `match_result`, both confirm
>   flags, all four verified-by ids, `system_snapshot`), and
>   `MatchWithDetails` declares the `season → league` embed. `MyMatchRow` is
>   deleted, and every `as any` that reached for those fields is gone
>   (MatchDetailCard, ScoreMatch, SpectateMatchCard, both Spectate pages). The
>   type checker then caught one real gap: a missing season week fed
>   `undefined` into the week-label lookup on both Spectate pages — now guarded.
> - **7b risky half — SIZED, not done.** Removing the six `as MatchWithDetails`
>   casts produces ZERO type errors — and that is the finding: the app's
>   `supabase` client (src/supabaseClient.ts) is created WITHOUT the
>   `Database` type, so every query result is loosely typed and the casts
>   neither add nor remove checking. Only typing the client
>   (`createClient<Database>`) makes these queries checked, and that touches
>   every query in the app; `database.types.ts` is also behind the schema
>   (no `matches.lms_entered_at`), so it must be regenerated first. That is
>   its own plan, not a cleanup bullet. `MatchWithVenueDetails` left as is
>   (its required `street_address` is a real contract difference).

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
