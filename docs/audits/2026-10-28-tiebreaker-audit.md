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

## Ben vs Duff (`92b799f2…`) — not explainable from code alone

Reported: lineup handicaps changed in a match with **no** tiebreaker, so the
re-lock path (F1) is ruled out. The code leaves exactly three candidates:

1. Someone had the lineup screen open and changed a pick or edited a handicap —
   F2's writers fire live, per change, with no lock check.
2. An unlock → re-lock before the match started (handicaps recompute on re-lock).
3. The `swap_player_in_lineup` RPC — the legitimate path, which is audited:
   `swap_requested_by_member_id` and `swap_last_resolution` on the lineup row.

Candidate 3 is self-identifying — if `swap_last_resolution` is populated, it was a
swap and the change was legitimate. If it is NULL, the change came from 1 or 2 and
there is **no audit trail at all** to say which, who, or when.

Needs a read of the match's two `match_lineups` rows. Pending Ed's go-ahead on
which database.

## Recommendation

Brainstorm before Phase 4. The audit changed the question: the problem is not
"the tiebreaker is wired wrong" but "a locked lineup is not actually protected,
and nothing records who changed it." Giving the tiebreaker its own table fixes the
tiebreaker and leaves F2 standing. Open design questions worth settling together:

- Does a locked lineup become immutable (DB-enforced), with swap as the only
  sanctioned edit?
- Do tiebreaker games keep living in `match_games`? Many stats queries filter
  `is_tiebreaker`; moving them is a wide blast radius.
- Is lineup history worth recording, so "the handicaps changed" is answerable
  next time instead of a forensic exercise?
