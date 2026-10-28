# Tiebreaker audit (Phase 3) — read-only

Date: 2026-10-28. Branch: `audit/tiebreaker-phase3`. No code changed.

Phase 3 of `memory-bank/plans/PLAN-standings-points-fix.md`: list everything the
tiebreaker reads and writes, measure it against the agreed rule, and find what
else can rewrite a locked lineup.

## The rule (confirmed by Ed)

A tiebreaker is a separate best-of-3 mini-match. It may set the winner and mark
the match as tied. It must never change lineups, handicaps, games won (team or
player), targets, or points. Targets are fixed at match start; **swap player**
is the only legitimate mid-match recalculation.

## What the tiebreaker actually touches

| Step | Writes | Verdict |
|---|---|---|
| Tie detected | `matches`: `match_result='tie'`, `winner_team_id=null`, `status` stays `in_progress`, **`completed_at` stamped** | Mostly OK — see F4 |
| Create games | `match_games` rows 19–21, `is_tiebreaker=true` | OK |
| Unlock lineups | `match_lineups.locked=false`, `locked_at=null` | OK |
| Pick shooting order | `match_games.home_player_id` / `away_player_id` on rows 19–21 | OK — `useTiebreakerLineup`, never touches `match_lineups` |
| Re-lock | `locked`, `locked_at` only | OK **only on the PR #291 branch** — see F1 |
| Resolve | `matches` winner/result/status; `match_games` winner cols on 19–21 | OK |

Confirmed safe:

- **Games won and points exclude tiebreaker games.** `updateMatchRunningTotals`
  filters to confirmed non-tiebreaker games (`src/api/queries/matches.ts:991`).
- **Player and team stats exclude them too** — `playerStats.ts:90`,
  `teamStats.ts:199`, `featsStats.ts:108`, `playerGameHistory.ts:119` all filter
  `is_tiebreaker = false`. Standings read match-level totals, which already
  exclude them.
- **Targets survive.** The client skips prep once games exist, and `prep_match`
  only writes while `status='scheduled'`.
- **Ordering is correct.** `match_result='tie'` is written *before* the games are
  created and *before* the unlock, so `isTiebreakerMode` is already true by the
  time a captain's lineup screen re-renders.

## Findings

### F1 — The re-lock fix is not in production (highest impact)

Commits `2534033` (tiebreaker re-lock) and `559959d` (points par rule) exist
**only** on `claude/reckem-standings-issue-wgeffe` (PR #291). Neither is an
ancestor of `main`.

Production today still runs the old path: re-locking after a tiebreaker rewrites
the lineup row with handicaps recalculated on that device (which by then can
include tonight's games) and a freshly re-derived home-team bonus. Unlocking can
also clear a double-duty player's slots.

Nothing to build — it ships when Jack merges #291.

### F2 — `locked` is a flag, not a lock

This is the structural finding, and it is wider than the tiebreaker.

`match_lineups` is a live scratchpad. The lineup screen writes to it on every
dropdown change, and **four of those writers sit directly in
`src/player/MatchLineup.tsx`, outside the guarded persistence hook**:

- `:175` manual handicap edit (300 ms debounce) → `playerN_handicap`
- `:781` opponent-sub choice → opponent's `playerN_id` + handicap
- `:843` player change → `playerN_id` + freshly computed handicap
- `:865` clear player → `playerN_id=null`, `playerN_handicap=0`

None checks `locked`. None checks tiebreaker mode. There is no DB constraint,
trigger, or RLS rule preventing a write to a locked lineup.

The `2534033` fix guards `handleLockLineup` / `handleUnlockLineup` only. Today's
protection for the other four is *"the UI doesn't render that control in
tiebreaker mode"* (`hideHandicap={isTiebreakerMode}`, and player changes route to
`handleTiebreakerPlayerChange`). That is a rendering decision standing in for a
data guarantee.

### F3 — Tiebreaker exclusion is a convention, not an enforcement

`completeMatch` (`src/api/queries/matches.ts:833`) omits the score columns for a
tiebreaker by having the *caller* leave them `undefined`. The comment says
"Only update scores if provided (regular match, not tiebreaker)". A future caller
that passes them will silently fold tiebreaker games into games-won. Same shape
as F2: correct today, unenforced.

### F4 — A tied match carries a `completed_at` while still in progress

On a tie the update sets `completed_at` but leaves `status='in_progress'`
(`MatchEndVerification.tsx:370-391`). Harmless today; a trap for any future query
that treats `completed_at IS NOT NULL` as "finished".

### F5 — Dead code

`autoSaveLineup` (`src/hooks/lineup/useLineupPersistence.ts:282`) writes player
IDs and handicaps for positions 1–3 only, with no lock or tiebreaker guard. It is
defined and returned but **never called anywhere**. Delete it — if it were ever
wired up it would bypass every guard in F2 and silently ignore players 4–5.

## Ben vs Duff (`92b799f2…`) — most likely Ed's own beta-era data repair

Queried 2026-10-28 (read-only). What the data says:

- **No tiebreaker.** `tiebreaker_games = 0`, result is a decisive `home_win`
  11–7 (a full 18-game BCA 3v3 round robin). The re-lock path (F1) is ruled out.
- **No swap.** `swap_last_resolution` is NULL on both lineup rows. Not a false
  negative: `swap_player_in_lineup` stamps that column in the *same
  transaction* as the swap, and the columns have existed since
  `20260602000000` — this match is 2026-07-19.
- **No app-path lineup write after the match started.** Every app route that
  writes a lineup also stamps `locked_at` (`handleLockLineup`, and the
  gate-free `loSaveLineups`). Both rows still carry their pre-match locks
  (home 22:31, away 22:46; match completed 01:34). Neither was bumped.
- **`home_team_modifier = 0` is not a clue** — the team bonus is hardcoded to 0
  today (`useLineupPersistence.ts:139`), so 0 is correct everywhere.
- Both sides total the same handicap now (home −1+0+2 = 1, away 1+0+0 = 1).

**Proven: the lineup handicaps DID change after prep.** Step 4 returned
`home_to_win 9 / home_to_lose 8 / home_to_tie NULL` and
`away_to_win 10 / away_to_lose 9 / away_to_tie NULL`, against equal stored
totals (home 1, away 1). Run those through the 3v3 games-needed formula
(`games-needed-3v3-formula.ts`, byte-exact from Ed's 2026-05-18 formulas,
`game_count = 18`):

- `stronger_win = ceil((18+2)/2) + floor(|diff|/2) = 10 + floor(|diff|/2)`.
  Stored `away_to_win = 10` forces `floor(|diff|/2) = 0`, so `|diff|` is 0 or 1.
- Both `to_tie` are NULL, which only happens when `remaining = 18 − |diff|` is
  ODD. So `|diff|` is odd → **`|diff| = 1`**, with AWAY the stronger side.
- Check: `remaining = 17` → weaker `win = 9`, `lose = 8`. Exactly the stored
  home row.
- A diff of 0 would give `remaining = 18` (even) → `to_tie = 9`, `to_win = 10`,
  `to_lose = 8` on BOTH sides. The stored row has `to_tie = NULL`. Impossible.

At prep, away's total was exactly **1 higher** than home's. Today they are equal.
One handicap moved by 1 after the match was prepped.

**It was a handicap edit, not a player change.** Step 3 shows a perfect double
round robin — the same six players across all 18 games, each home player meeting
each away player twice. No substitution, and none of the six is Rene Enciso, so
this is a *different* repair from the one Ed recalls.

**Impact — small, but not nil.**

- *Winner unchanged.* Home won 11–7. It needed 9 under the saved targets and
  would have needed 10 under equal handicaps. Home wins either way.
- *Standings points differ by 1 for the away side.* Saved targets allow no tie,
  so par is `to_win`: home `11 − 9 = +2`, away `7 − 10 = −3`. Equal handicaps
  would allow a tie, making par 9: away `7 − 9 = −2`. Per Ed's confirmed rule
  the saved targets win, so **−3 is correct** and the stale handicap is cosmetic
  for standings.
- *The real exposure is recalculation.* `engineRunningTotals` reads thresholds
  from the match row (safe) but recomputes `homeHandicapDiff`/`awayHandicapDiff`
  from the CURRENT lineup handicaps (`engineRunningTotals.ts:153-162`). Any
  system whose allocator reads the diff is no longer insulated from a later
  lineup edit.

**Still no app bug indicated.** Every app route that writes a lineup also stamps
`locked_at`, and neither row's stamp moved. The change was made outside the
app — consistent with Ed's beta-era SQL repairs.

## F6 — A player in a substitute slot earns no stats credit

Surfaced by the Rene case above, and it will recur.

Substitutes share one sentinel member id per side, and `playerStats.ts:164`
deletes the sentinels from the results — correctly, since they are fictional
placeholders. The consequence is that a real person who played in a sub slot
gets **zero** games in their record, and the only repair today is an operator
editing `match_lineups` by hand in SQL.

That is a product gap, not a data accident: every season will produce "it was
actually this player" corrections. Worth a supported correction path — one that
reassigns the slot, recredits the games, and leaves a record of who changed it.
It also undercuts the audit trail generally: while SQL surgery is the only way
to fix a common situation, lineup history will have holes in it.

## Outcome — brainstormed same day, requirements agreed

**→ `docs/brainstorms/2026-10-28-tiebreaker-requirements.md`** is the live
document. This audit is the evidence behind it; the requirements supersede the
questions this section originally posed.

How each open question resolved:

- **Does a locked lineup become DB-immutable?** **No.** Ed: player swaps happen
  a few times a season and LO corrections are needed on top, so a hard lock
  becomes permission plumbing and every exception is a new way to be wrong.
  Direction inverted from *preventing* lineup changes to *recording* them.
- **Do tiebreaker games stay in `match_games`?** **Yes**, with the
  `is_tiebreaker` flag — that is what lets head-to-head include them while
  handicaps discount them. No blast radius.
- **Is lineup history worth recording?** Largely **overtaken**. The keystone
  decision (D0) means a tiebreaker never unlocks the match lineup at all, so the
  motivating exposure disappears structurally rather than being audited.
- **Does F6 come first?** **No** — parked as a low-priority TODO in
  `LIST_FOR_ED.md` per Ed: one league, rare, he can repair it by hand.

What the audit's findings became:

- **F1** (re-lock fix unmerged) — stands, and stays urgent until PR #291 merges.
  D0 eventually makes the fix redundant, not unnecessary in the meantime.
- **F2** (`locked` is a flag) — dissolved for the tiebreaker by D0; the four
  unguarded writers in `MatchLineup.tsx` remain as-is, accepted.
- **F3** (tiebreaker exclusion is convention) — unchanged, still worth a glance
  during implementation.
- **F4** (`completed_at` on a tied match) — unchanged, harmless, still a trap
  for any future "finished" query.
- **F5** (dead `autoSaveLineup`) — delete during implementation.
- **F6** (sub slot earns no stats credit) — parked, see above.

Phase 3 of `memory-bank/plans/PLAN-standings-points-fix.md` is complete. That
plan file lives on PR #291's branch, so flip its Phase 3 and Phase 6 checkboxes
when #291 merges.
