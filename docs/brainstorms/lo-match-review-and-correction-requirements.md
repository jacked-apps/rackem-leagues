---
date: 2026-06-04
topic: lo-match-review-and-correction
---

# LO Match Review & Correction (take-over / adjust an already-scored match)

## Problem Frame

After a match is scored, a player sometimes contests it: *"game 6 wasn't scored
right,"* or *"I should have 5 wins, not 4."* Today the League Operator has no way
to look into it — no view of what was recorded, who confirmed it, or what
achievements were marked — and no way to correct an honest mistake (a game marked
break-and-run that wasn't, an unmarked 8-on-the-break, a wrong winner).

This is the **take-over / adjust** end-state deferred from LO manual scoring v1
(see origin: `docs/brainstorms/lo-manual-match-scoring-requirements.md`). It covers
**matches scored live in-app by the teams**, not just the LO's own manual entries —
i.e. the **dispute-adjudication** case. It is largely a **reuse** of the v1 Entry
phase: an already-scored match already has locked lineups, created games, frozen
thresholds, and a snapshot, so there is **no Setup/`prep_match`** step.

The real investigation (calling/interviewing players) happens **off-app**. The
app's job is to **surface what transpired** and let the operator **correct** it —
not to judge. This is **operator-authoritative**: the LO runs his own league, the
confirmation chain is visible only to him and his staff, and the real check on
abuse is social (act in bad faith, lose your players), not a technical gate (see
Key Decisions).

## Requirements

**Review / investigate (read-first, edit available inline)**
- R1. The LO can open an already-scored match into a view of every game. It is the
  same surface as the v1 Entry phase with a few more labels; the LO is authorized,
  so edit affordances (vacate) are available inline — no separate "unlock" mode.
- R2. Each game row shows: game number, the matchup (home player vs away player),
  the winner, and **achievements only when present** (break-and-run, golden break,
  etc.) — e.g. "Game 6 · John vs Mike · Winner John" / "Game 7 · Steve vs Dave ·
  Winner Dave · Break & Run".
- R3. Each game row shows a **confirmation line**: the two **official confirmers**
  (home + away) read from `match_games.confirmed_by_home`/`_away`, each with a
  **"+N others"** count of additional people who vouched on that side (read from
  the many-eyes `game_confirmations` witness log); tapping **+N reveals their names
  and team**. A game with no witness rows (a v1 LO-entered game, or any game scored
  before many-eyes) shows the two official confirmers + **"+0 others"** — for an
  LO-entered game both official confirmers are the operator, which quietly marks it
  operator-entered. Names/teams require a members lookup join (new read path).

**Correct (operator vacate-and-rescore)**
- R4. The LO corrects a game with **vacate-and-rescore**, done **solo** (no second
  team): a **Vacate** button with an **"are you sure?"** confirm (there is no
  two-party deny), an **undo/restore** to put the original result back if vacated
  by mistake, then **re-score + save** the corrected result (reusing the v1 scoring
  modal). The vacate confirm is where the optional reason (R5) is entered.
- R5. The correction can carry an **optional ~255-character reason**. It is
  **always optional** — even when overturning a team-confirmed game (operator-
  authoritative; see Key Decisions). When provided, it is stored on the operator's
  override record in the confirmations log and shown in the confirmer-audit.
- R6. A correction is **recorded in the append-only confirmations log**, never a
  silent column overwrite: the correction **appends an operator override row** (the
  re-scored result, attributed to the LO, carrying the optional reason). The
  original team confirmations stay in the log untouched, so the chain reads "teams
  confirmed X → operator changed it to Y [because Z]". This operator row in the
  chain is the "this was corrected" record — visible to the LO/staff in the
  confirmer-audit. (No visible badge or notification to the teams — operator-
  authoritative; the chain is the record.)

**Lifecycle (finalized matches)**
- R7. Editing a **completed** match requires an explicit **reopen** transition
  (`completed → in_progress`, clearing winner/verification/completed-at so a clean
  re-finalize can recompute) — this transition does **not** exist today and is a
  named new step, not a reuse. Sequence: **reopen → vacate → rescore → re-Finalize**
  (the deliberate "I'm changing the official result now" moment, reusing v1
  Finalize to re-stamp the winner; standings recompute from the match row on next
  read). A reopened match must **never be stranded winnerless**: if a correction
  would produce a games-mode tie (which v1 Finalize blocks), the operator must
  resolve the outcome (or the prior completed result is restored) rather than
  leaving the match reopened with no winner.

**Eligibility**
- R8. **Non-scheduled** matches (completed, awaiting-verification, in-progress) are
  openable in this review/correct surface; **scheduled** matches route to the v1
  enter-from-blank setup flow. This is a **distinct eligibility predicate + routing
  fork** from v1's scheduled-only guard (net-new logic, not a label tweak), and
  must decide where `forfeited`/`postponed` route.

## Success Criteria
- An LO who gets a complaint can open the match, see exactly what was recorded —
  winner, achievements, and who confirmed each game (official + "+N others") — and
  decide whether the complaint holds, using real evidence.
- When a correction is warranted, the LO can vacate-and-rescore the specific game(s)
  solo, optionally record why, and re-finalize so standings reflect the truth.
- Every correction is preserved in the operator-visible confirmation chain (teams
  said X → operator changed to Y [because Z]); the original confirmations are never
  erased.
- Reuses the v1 Entry phase, scoring modal, and Finalize; the genuinely new pieces
  are the confirmer read path, the operator-override write (log row + reason), the
  reopen transition, and the relaxed eligibility.

## Scope Boundaries
- **Roster / player-identity changes are out → v3.** Fixing "it was John A, not John
  L" (the wrong person in the lineup) is a bigger blast radius and is deferred. The
  LO can fix winner + achievements + per-game data, not who is in the lineup. (Note:
  this is one of the named complaint examples — interim remedy is to vacate-and-
  rescore winner/achievements only; full identity fix waits for v3.)
- **Operator-authoritative, deliberately light on safeguards** — no required reason,
  no operator-role gating, no team-facing badge or notification. The LO controls his
  own league; the operator-only confirmation chain + optional reason is the record;
  accountability is social. (This consciously declines the heavier-trust options the
  review raised.)
- **No new judging logic.** The app surfaces evidence; the operator investigates
  off-app and decides.
- **Setup/`prep_match` is not involved** — these matches already have games.
- **Concurrency / standings-window kept light:** the realistic case is a completed
  match a player complains about after the fact; editing a *live, actively-scored*
  match is an edge case not optimized for in this version (noted for planning, not
  guarded heavily).

## Key Decisions
- **Operator-authoritative override** (Ed): the LO can change any score in his own
  league; the confirm chain is operator/staff-only; social accountability, not a
  technical gate. → optional reason, no roles, no notifications.
- **Correction appends an operator override row to `game_confirmations`** (not a
  silent column overwrite). This is functional, not security: it's what makes the
  override + reason visible in the confirmer-audit. **Supersedes the earlier
  "LO = latest confirmer is the signal" idea**, which the review showed is fragile
  (v1 writes no log rows; a late player vouch could overtake it).
- **Solo vacate-and-rescore is a new mutation**, not the existing two-party vacate
  (which needs an opponent + a deny). It clears the result, appends a vacate marker
  + the operator re-score row. Respects the locked accountability principle
  (vacate-and-rescore is the fix path) without the two-party ceremony.
- **Reopen is an explicit `completed → in_progress` transition** — load-bearing and
  net-new; the reused mutations currently hard-guard `in_progress`.
- **A reopened match is never left winnerless** (tie handling on re-finalize).
- **Confirmer line = official columns + witness "+N" layer** + a members join.
- **Reason is entered in the vacate "are you sure?" confirm**, tied to the decision.
- **View-first but edit-inline** (no unlock mode) — the operator is authorized.

## Dependencies / Assumptions
- Builds directly on **LO manual scoring v1** (branch `feat/lo-manual-scoring`,
  PR #167): reuses `ManualScoringMatchPicker`, `ManualScoringPage`, `EntryPhase`,
  the reused `ScoringDialog`, and `loFinalizeMatch`.
- Leans on the **many-eyes `game_confirmations`** log (append-only, `is_initiator`,
  dissent derivation) from the stack we're based on (#157).
- **New schema:** a nullable `reason` text column (~255) on `game_confirmations`
  (or a small sibling table) for R5.
- **New write paths (not reuse):** a solo `loVacateGame` + an operator re-score that
  appends to `game_confirmations`; a `reopen` transition; a relaxed/forked
  eligibility predicate. `loScoreGame`'s `status='in_progress'` guard needs the
  reopen step before it.
- All data is disposable test data — no backfill concern for pre-many-eyes matches.

## Outstanding Questions

### Deferred to Planning
- [Affects R6/R5][Technical] The operator override row shape in `game_confirmations`
  — `is_initiator`/`action`/`side` values for an operator who is on neither team
  (the `side` CHECK is `home`/`away`), which row carries the `reason`, and how the
  vacate marker + re-score row relate.
- [Affects R7][Technical] The `reopen` mutation: exactly which match columns to
  clear (`winner_team_id`/`match_result`/`completed_at`/`*_verified_by`/
  `results_confirmed_by_*`) and the ordering vs `appendConfirmation`'s no-op-on-
  completed guard.
- [Affects R7][Technical] Tie-on-reopen handling: detect before/at re-finalize and
  either require the operator to designate the result or restore the prior completed
  result — never strand the match.
- [Affects R3][Technical] The confirmer read path: official confirmer (columns) +
  "+N others" (log) + member name/team join; behavior for games with no log rows.
- [Affects R8][Technical/Design] The non-scheduled eligibility predicate + routing
  (incl. `forfeited`/`postponed`), distinct from v1's scheduled-only path.
- [Affects R4][Design] Does the operator vacate-and-rescore here unify with v1's
  in-session tap-to-re-enter (which is a simple overwrite, no log row), or stay a
  distinct path? Confirm whether v1's path also gains an override row.
- [Affects R7] Standings/playoff-seeding behavior during the brief reopen window
  (low priority per the light posture; confirm seeds recompute live vs snapshot).

## Next Steps
-> /ce:plan for structured implementation planning.
