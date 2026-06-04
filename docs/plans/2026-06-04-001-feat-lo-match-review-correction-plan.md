---
title: "feat: LO Match Review & Correction (view/edit an already-scored match)"
type: feat
status: active
date: 2026-06-04
deepened: 2026-06-04
origin: docs/brainstorms/lo-match-review-and-correction-requirements.md
---

# feat: LO Match Review & Correction (view/edit an already-scored match)

## Overview

v2 of LO manual scoring: let a League Operator **open an already-scored match,
see what was recorded (winner, achievements, and who confirmed each game), and
correct honest mistakes** after a player complaint — including matches scored
**live by the teams**. Corrections are **operator-authoritative** (the LO runs his
own league; the confirmation chain is operator/staff-only; accountability is
social — no role gates, required reason, or team notifications).

It reuses the v1 surface (`ManualScoringMatchPicker`, `ManualScoringPage`,
`EntryPhase`, `ScoringDialog`, `loFinalizeMatch`) and the locked vacate-and-rescore
accountability protocol, adding: a per-game **confirmer-audit** line, a **solo**
operator vacate-and-rescore that **appends an override row to `game_confirmations`**
(carrying an optional reason), and an explicit **reopen → fix → re-finalize**
lifecycle for completed matches. (See origin:
`docs/brainstorms/lo-match-review-and-correction-requirements.md`.)

Stacks on the v1 branch `feat/lo-manual-scoring` (PR #167), which sits on the
many-eyes stack (`game_confirmations`, PR #157) — this feature has a **real data
dependency** on `game_confirmations` (unlike v1).

## Problem Frame

A player contests a scored match ("game 6 was wrong," "I should have 5 wins").
Today the LO can neither see what was recorded + who confirmed it, nor correct an
honest mistake (a wrongly-marked break-and-run, an unmarked 8-on-the-break, a wrong
winner). This is the take-over/adjust end-state deferred from v1.

## Requirements Trace

- R1. Open a non-scheduled match into a view-first, edit-inline surface.
- R2. Per game: winner, matchup, and **achievements only when present**.
- R3. Per game: a **confirmer line** — official confirmers (home/away, from the
  `match_games.confirmed_by_*` columns) + **"+N others"** (from `game_confirmations`),
  tap to reveal names + teams; no-log games (v1/pre-many-eyes) show "+0".
- R4. **Solo vacate-and-rescore** correction: Vacate (with "are you sure?" + reason
  entry), undo/restore, re-score + save.
- R5. Optional ~255-char **reason** stored on the operator override row.
- R6. Correction **appends an operator override row** to the append-only log
  (vacate marker + re-score), never a silent overwrite; the original team
  confirmations stay; the operator row in the chain is the "corrected" record.
- R7. **Reopen → fix → re-Finalize** lifecycle for completed matches; never strand
  a reopened match winnerless (tie handling).
- R8. **Completed / awaiting-verification** matches open into review/correct;
  scheduled route to v1 setup; in-progress/forfeited/postponed not openable
  (in-progress dropped to avoid the live-scoring race — see Key Decisions).

## Scope Boundaries
- **Roster/player-identity changes → v3** (the "John A not John L" fix). Interim:
  the LO can vacate-and-rescore winner/achievements only.
- **Operator-authoritative, light:** no role gating, no required reason, no
  team-facing badge/notification. The operator-only chain + optional reason is the
  record.
- **No new judging logic** — surfaces evidence; the LO investigates off-app.
- **Concurrency / standings-window kept light** — realistic case is a completed
  match; editing a live actively-scored match is an unoptimized edge case.

### Deferred to Separate Tasks
- Roster/player-identity correction: **v3**.

## Context & Research

### Relevant Code and Patterns
- **Reuse:** `src/operator/ManualScoringMatchPicker.tsx`,
  `src/operator/ManualScoringPage.tsx` (status dispatch host),
  `src/components/operator/manual-scoring/EntryPhase.tsx` (the game grid +
  scoreboard + reused `ScoringDialog`), `src/api/mutations/loManualScoring.ts`
  (`loScoreGame`, `loFinalizeMatch`).
- **game_confirmations** (`supabase/migrations/20260525000000_game_confirmations.sql`
  + `..._is_initiator.sql` + `..._auto_confirmed.sql`): columns `match_id, game_id,
  game_number, confirmer_id, side, action, <9 result fields>, is_initiator,
  auto_confirmed, created_at`. **`side` CHECK = home/away** (no operator/neutral),
  **`action` CHECK = confirm/vacate**. **No `reason`/text column** (must add).
- **`appendConfirmation`** (`src/api/mutations/appendConfirmation.ts`): params
  `{gameId, matchId, gameNumber, confirmerId, side, result: ConfirmationResult,
  action?, isInitiator (required), autoConfirmed?}`. **No-ops when
  `matches.status==='completed'`** (so reopen must precede any append) + an
  exact-dup guard.
- **Two-party vacate (do NOT reuse)** in `src/hooks/useMatchScoringMutations.ts`
  (`confirmOpponentScore`/`denyOpponentScore`, `vacate_requested_by`, Amendment-E
  endorser counting, the deny path). The solo version replicates only: wipe the
  `match_games` result + both `confirmed_by_*`, append a `action='vacate'` marker
  with the pre-wipe snapshot. No opponent, no `vacate_requested_by`, no deny.
- **`deriveDissents`/`deriveDisputes`** (`src/utils/match/deriveDissents.ts`,
  `deriveDisputes.ts`): scope to **post-latest-vacate** by `created_at`. An operator
  vacate marker correctly becomes the new `latestVacateAt`, scoping the window.
- **`useGameConfirmations`** (`src/api/hooks/useGameConfirmations.ts`): returns the
  full rows ordered by `created_at` asc; no member-name join (need one for R3).
  Name helpers: `getPlayerNicknameById` (`src/types/member.ts`).
- **`loFinalizeMatch` completion write** (`src/api/mutations/loManualScoring.ts`):
  sets `home/away_team_verified_by, winner_team_id, match_result,
  results_confirmed_by_home/away, completed_at, status='completed'`. Both
  `loScoreGame`/`loFinalizeMatch` hard-guard `status==='in_progress'`.
- **Standings** (`src/api/queries/standings.ts`): `.eq('status','completed')` +
  reads `winner_team_id`. Reopen drops the match out; re-finalize restores it —
  automatic (invalidate standings cache after re-finalize).
- **v1 eligibility** (`src/utils/match/manualScoringEligibility.ts`):
  `isMatchEligibleForManualScoring` = `status==='scheduled'` + two real teams.

### Institutional Learnings
- **Vacate-and-rescore is the locked fix path** (memory `project_scoring_accountability`)
  — solo operator version respects it without the two-party ceremony.
- **Confirmer-audit view is pre-designed** (memory `project_confirmer_audit_view`):
  operator-only, lists confirmers + teams; NOT a public badge. This is R3.
- **Officiality lives only on `match_games.confirmed_by_*`**; `game_confirmations`
  is additive audit data (`updateMatchRunningTotals` reads only the columns).
- **RLS off pre-launch** (don't add role/org gates); **disposable data** (no backfill
  for pre-many-eyes "no-log" games — handled by display logic); **DB tests** under
  `src/__tests__/database/` (jsdom, sequential, deterministic fixtures).

## Key Technical Decisions
- **Operator override = append to the log, not a silent column overwrite.** Two
  rows (resolved, not deferred — the vacate marker is load-bearing for dissent
  windowing): a **vacate marker** (`action='vacate'`, `is_initiator=false`,
  pre-wipe snapshot — matching the live vacate-marker convention) then, on re-score,
  the `match_games` columns are written (officiality: `confirmed_by_home =
  confirmed_by_away = loMemberId`) **plus an operator confirm row**
  (`action='confirm'`, `is_initiator=true`, `confirmer_id=loMemberId`, new result,
  **`reason`**). Replaces the v1 "latest-confirmer = signal" idea (fragile).
- **`side` for operator rows:** the schema CHECK forces `home`/`away` (no operator
  side). Use the winner's side for the confirm row, prior-winner's side for the
  vacate marker. The operator's identity in the `confirmed_by_*` columns is the
  official-confirmer signal. **`buildConfirmerAudit` excludes `confirmer_id ===
  loMemberId` outright** (the operator is never a "+N other"), so the operator row's
  side never matters to the audit.
- **`reason` plumbing:** `appendConfirmation` gains a `reason?: string` param (Unit
  3 modifies it). The override re-score uses a **sibling `loCorrectGame`** (not a
  flag on `loScoreGame`) so `loScoreGame`'s "writes no `game_confirmations`" v1
  contract stays intact; `loCorrectGame` does the same column write + recompute AND
  appends the operator confirm row.
- **Reopen just flips status; it does NOT clear the completion fields.**
  `loReopenMatch` sets `status='in_progress'` and leaves `winner_team_id,
  match_result, completed_at, *_verified_by, results_confirmed_by_*` in place
  (totals/thresholds/snapshot too). This is crash-safe: the prior result lives on
  the row, so **"restore" = re-stamp `status='completed'`** (no UI-held snapshot, no
  re-derive), and an **abandoned reopen is recoverable** — the picker detects
  `status='in_progress' AND completed_at IS NOT NULL` as "reopened, not re-finalized"
  and offers re-finalize / restore. Must run **before** any vacate/append
  (`appendConfirmation` no-ops on `completed`). It normalizes `completed` AND
  `awaiting_verification` → `in_progress`.
- **Never strand a reopened match:** if re-finalize would produce a games-mode tie
  (`loFinalizeMatch` throws — it uses `determineMatchResult` internally, there is no
  `decideWinner`), block the save with a clear message AND offer **"restore original
  result"** (re-stamp `completed`, leaving the prior winner intact).
- **Confirmer line:** official confirmer per side from the `confirmed_by_*` columns
  (member-name resolved), "+N others" = distinct `confirm`-row confirmers on that
  side **post-latest-vacate**, excluding `loMemberId`; "+0" when no log rows.
- **One picker, status-routed:** scheduled → v1 setup; **completed / awaiting-
  verification → review/correct** (`league/:leagueId/match-review/:matchId`);
  **in-progress / forfeited / postponed → not openable** (dropping `in_progress`
  avoids the live-scoring concurrency race — corrections target finished matches).
- **The review/correct surface is the Entry surface extended** (confirmer line +
  vacate affordance + reopen), not a separate page — view-first, edit-inline. It
  shows **only the confirmer-audit line** — not the live `DisputeBanner`/dissent UI.
  A reopened (mid-correction) match shows a **"correction in progress — re-finalize
  to commit"** banner so the operator never misreads a transient state as official.

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

```
Picker (status-routed)
  scheduled ──────────────► v1 Setup flow
  completed / awaiting ───► Review/Correct surface (league/:leagueId/match-review/:matchId)
  in_progress/forfeited/
  postponed ──────────────► not openable (greyed)
  (a reopened-not-refinalized match — in_progress AND completed_at set — shows
   "reopened, re-finalize or restore")

Correcting game N on a COMPLETED match:
  reopen (status→in_progress; KEEP winner/match_result/completed_at/verified) [once, on first edit]
    └─► Vacate game N  (are-you-sure + optional reason)
          • append game_confirmations: action='vacate', is_initiator=false (pre-wipe snapshot, reason)
          • wipe match_games result + both confirmed_by_*  →  updateMatchRunningTotals
          • [Undo] restores the pre-wipe match_games result; does NOT re-complete (explicit only)
    └─► Re-score game N  (loCorrectGame, reused ScoringDialog)
          • write match_games columns + both confirmed_by_* = loMemberId
          • append game_confirmations: action='confirm', is_initiator=true, confirmer_id=loMemberId, reason
          • updateMatchRunningTotals
    └─► Re-Finalize (gated: no game left vacated-pending-rescore)
          • loFinalizeMatch (determineMatchResult) → games-mode TIE: block + offer "restore original"
          • else overwrites completion → status='completed' → standings recompute on read
  Restore original = re-stamp status='completed' (prior winner still on the row)

Per-game confirmer line (read):
  official(home) = name(match_games.confirmed_by_home)   +N = post-vacate confirm rows on home (excl official)
  official(away) = name(match_games.confirmed_by_away)   +N = ... on away
  no game_confirmations rows → "+0 others"
```

## Implementation Units

- [ ] **Unit 1: Migration — `reason` column on `game_confirmations`**

**Goal:** Add a nullable free-text `reason` (≤255) to the append-only log for R5.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Create: `supabase/migrations/<ts>_game_confirmations_reason.sql`
- Modify: `src/types/database.types.ts` (regenerate)
- Test: `src/__tests__/database/gameConfirmationsReason.db.test.ts`

**Approach:** `ALTER TABLE game_confirmations ADD COLUMN reason text` (nullable;
enforce ≤255 via a CHECK or app-level). Regenerate types. Append-only convention
unchanged.

**Test scenarios:**
- Happy path (db): insert a row with a reason → reads back; insert without →
  null.
- Edge case: a >255 reason is rejected (if CHECK added) or truncated (decide).

**Verification:** A `game_confirmations` row can carry a reason; types reflect it.

- [ ] **Unit 2: Reopen + tie-safe re-finalize (lifecycle mutations)**

**Goal:** `loReopenMatch` (completed→in_progress with prior-completion snapshot) and
tie-safe re-finalize so a reopened match is never stranded.

**Requirements:** R7

**Dependencies:** None

**Files:**
- Modify: `src/api/mutations/loManualScoring.ts` (`loReopenMatch`; extend/ wrap
  `loFinalizeMatch` for restore-on-tie)
- Test: `src/api/mutations/__tests__/loManualScoring.test.ts` (extend)

**Approach:**
- `loReopenMatch(matchId)`: normalize `completed` OR `awaiting_verification` →
  `status='in_progress'`. **Do NOT clear the completion fields** (`winner_team_id,
  match_result, completed_at, *_verified_by, results_confirmed_by_*` stay) — the
  prior result lives on the row, making restore + crash-recovery trivial. Idempotent
  if already `in_progress`.
- `loRestoreCompletion(matchId)`: re-stamp `status='completed'` (the prior winner is
  still on the row — nothing to recompute). Used by the tie-block escape and the
  picker's "restore" on an abandoned reopen.
- Re-finalize: reuse `loFinalizeMatch` (overwrites the completion fields). On a
  games-mode tie it throws (`determineMatchResult`) — surface that to the UI as
  "creates a tie" with the restore escape.

**Test scenarios:**
- Happy path: reopen a completed match → `in_progress`; winner/totals/thresholds/
  snapshot all intact on the row.
- Edge case: reopen an `awaiting_verification` match → `in_progress`.
- Edge case: reopen an already-`in_progress` match → no-op.
- Happy path: `loRestoreCompletion` re-stamps `completed` with the unchanged winner.
- Error path: re-finalize after a correction that ties (games mode) → throws;
  restore returns the prior completed result.
- Integration (Unit 8 db): reopen → rescore → re-finalize round-trip; and an
  abandoned reopen (no re-finalize) is detectable (`in_progress` + `completed_at`).

**Verification:** A completed match can reopen, re-finalize, or restore; an abandoned
reopen is recoverable; a tie never strands the match.

- [ ] **Unit 3: Solo operator vacate + override write**

**Goal:** `loVacateGame` (solo) + the operator override re-score that appends to the
log with the optional reason.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 1 (reason column), Unit 2 (reopen must precede append)

**Files:**
- Modify: `src/api/mutations/appendConfirmation.ts` (add `reason?: string` to
  `AppendConfirmationParams` + the insert; **check its boolean return** at the call
  site so a failed vacate-marker append is surfaced, not silently swallowed — the
  marker is load-bearing for windowing)
- Modify: `src/api/mutations/loManualScoring.ts` (`loVacateGame`, `loCorrectGame`,
  `loRestoreGame`)
- Test: `src/api/mutations/__tests__/loManualScoring.test.ts` (extend)

**Approach:**
- `loVacateGame(matchId, gameId, { reason? })`: read the game; **append a vacate
  marker** (`action='vacate'`, `isInitiator=false`, `confirmerId=loMemberId`,
  `side`=prior winner's side, `result`=pre-wipe snapshot, `reason`) — **assert it
  succeeded** before/with the wipe (it anchors the dissent window); then wipe the
  `match_games` result + both `confirmed_by_*`; `updateMatchRunningTotals`.
- `loCorrectGame(...)`: a **sibling of `loScoreGame`** (do NOT add a flag to
  `loScoreGame` — keep its log-free v1 contract). Writes the same `match_games`
  columns + both `confirmed_by_* = loMemberId` + `updateMatchRunningTotals`, AND
  appends an operator confirm row (`action='confirm'`, `isInitiator=true`,
  `confirmerId=loMemberId`, `side`=new winner's side, new result, `reason`).
- `loRestoreGame(matchId, gameId, snapshot)`: re-write the pre-vacate snapshot to
  `match_games` + recompute. **Does not re-complete the match** (completion stays
  explicit — see Unit 7). No extra log row.

**Test scenarios:**
- Happy path: `loVacateGame` appends a `vacate` marker + wipes the game.
- Happy path: `loCorrectGame` appends a `confirm` row (`is_initiator=true`, reason)
  + sets the columns to `loMemberId`.
- Edge case: vacate marker resets the dissent window (a pre-vacate dissenting vouch
  no longer flags after re-score).
- Edge case (regression): v1 `loScoreGame` still appends **no** `game_confirmations`
  row.
- Error path: the vacate-marker append failing is surfaced (not silently swallowed).
- Note: these mutations assume the match is already `in_progress` (Unit 7 calls
  `loReopenMatch` first); a direct call on `completed` would no-op the append.
- Integration (Unit 8 db): appended rows readable + scoped correctly.

**Verification:** A correction leaves a documented chain (vacate → operator confirm
+ reason) and correct `match_games` state.

- [ ] **Unit 4: Confirmer-audit read/derive**

**Goal:** Per-game view model: official confirmers (names) + "+N others" (names +
teams), with the no-log fallback.

**Requirements:** R3

**Dependencies:** None for the pure derive (testable with synthetic rows); the
live integration consumes Unit 3's appended rows.

**Files:**
- Create: `src/utils/match/confirmerAudit.ts` (pure `buildConfirmerAudit`)
- Create: `src/utils/match/__tests__/confirmerAudit.test.ts`
- Modify (maybe): `src/api/hooks/useGameConfirmations.ts` or a new members-name
  fetch to resolve `confirmer_id → name + team`.

**Approach:**
- `buildConfirmerAudit(game, confirmations, nameTeamById, loMemberId)` → per side:
  `{ officialName, others: Array<{name, team}> }`. Official = name of
  `match_games.confirmed_by_<side>`; "+N others" = distinct `confirm`-row
  `confirmer_id`s on that side, **post-latest-vacate**, **excluding `loMemberId`
  outright** (the operator is never an "other," regardless of side) and the per-side
  official id; resolve names + teams from a member→{name,team} map. No confirmations
  → others = [].
- Name/team resolution: the match's two team rosters (already loaded via
  `useTeamDetails` in EntryPhase) give member→team; names via `getPlayerNicknameById`.
  A confirmer not on either roster (shouldn't happen) falls back to id.

**Test scenarios:**
- Happy path: a game with official home/away + 2 extra home confirmers → home
  shows official + "+2 others" with names; away official + 0.
- Edge case: no `game_confirmations` rows → both officials from columns, "+0".
- Edge case: confirmers before the latest vacate are excluded from "+N".
- Edge case: the operator's own confirm row is **never** counted as an "+N other"
  on either side (excluded by `loMemberId`).

**Verification:** The view model matches "official + +N others" for live, LO-entered,
and pre-many-eyes games.

- [ ] **Unit 5: Review eligibility + picker routing**

**Goal:** Open non-scheduled matches into the review surface; route by status.

**Requirements:** R8

**Dependencies:** None

**Files:**
- Modify: `src/utils/match/manualScoringEligibility.ts` (add
  `isMatchEligibleForReview`)
- Modify: `src/operator/ManualScoringMatchPicker.tsx` (route by status)
- Modify: `src/navigation/NavRoutes.tsx` (review route, dev-gated like v1)
- Test: `src/utils/match/__tests__/manualScoringEligibility.test.ts` (extend);
  `src/operator/__tests__/ManualScoringMatchPicker.test.tsx` (extend)

**Approach:**
- `isMatchEligibleForReview` = `status ∈ {completed, awaiting_verification}` + two
  real teams (not bye). **`in_progress` is excluded** (avoids the live-scoring
  concurrency race — corrections target finished matches), along with
  `forfeited`/`postponed`. A **reopened-not-refinalized** match
  (`in_progress` AND `completed_at` set) is also review-eligible and badged so an
  abandoned correction is recoverable.
- Picker: a `scheduled` match → v1 `league/:leagueId/manual-scoring/:matchId`; a
  review-eligible match → `league/:leagueId/match-review/:matchId`; else greyed.
  Both clickable types coexist in the same week accordion. (Route is leagueId-scoped
  to match v1's registration; the page reads `leagueId` from `useParams`.)

**Test scenarios:**
- Happy path: a completed match is clickable → routes to `.../match-review/:matchId`.
- Edge case: scheduled → v1 setup; in_progress/forfeited/postponed greyed.
- Edge case: a reopened-not-refinalized match shows the recovery badge + is openable.
- Edge case: a bye is never openable.

**Verification:** From the picker, a completed match opens the review surface; v1
flow unchanged.

- [ ] **Unit 6: Review/correct surface — confirmer line + view**

**Goal:** Extend the Entry surface with the per-game confirmer line + achievements,
routed for non-scheduled matches.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 4 (audit derive), Unit 5 (routing)

**Files:**
- Modify: `src/operator/ManualScoringPage.tsx` (dispatch completed/awaiting →
  review surface)
- Modify/Create: `src/components/operator/manual-scoring/EntryPhase.tsx` (or a thin
  `ReviewPhase` wrapping its grid) — add the confirmer line per game + the "+N
  others" popover
- Create: `src/components/operator/manual-scoring/ConfirmerLine.tsx`
- Test: `src/components/operator/manual-scoring/__tests__/ConfirmerLine.test.tsx`

**Approach:**
- The host renders the review surface for non-scheduled matches; it loads
  `useGameConfirmations` + rosters, builds the audit (Unit 4), and renders each
  game row with the existing winner/achievement display + the new `ConfirmerLine`
  (official names + "+N others" with a popover on tap). Achievements only when
  present (already in EntryPhase).
- View-first, edit-inline (no unlock mode); the Vacate affordance (Unit 7) lives on
  each row.

**Test scenarios:**
- Happy path: a game renders winner + achievements (when present) + the confirmer
  line; tapping "+N others" reveals names/teams.
- Edge case: a no-log game shows "+0 others".
- Edge case: achievements hidden when absent.

**Verification:** The LO can open a scored match and read winner + achievements +
who confirmed, per game.

- [ ] **Unit 7: Correction flow UI — vacate / undo / re-score / re-finalize**

**Goal:** Wire the operator correction flow into the surface, including the
completed-match reopen + tie handling.

**Requirements:** R4, R5, R6, R7

**Dependencies:** Unit 2, Unit 3, Unit 6

**Files:**
- Modify: `src/components/operator/manual-scoring/EntryPhase.tsx` (or `ReviewPhase`)
- Create: `src/components/operator/manual-scoring/VacateConfirmDialog.tsx` (the
  "are you sure?" + optional reason textarea)
- Test: `src/components/operator/manual-scoring/__tests__/ReviewCorrection.test.tsx`

**Approach:**
- The **first** edit of a `completed`/`awaiting_verification` match calls
  `loReopenMatch` **once** (guard so subsequent vacates don't re-reopen). While
  reopened (mid-correction), show the **"correction in progress — re-finalize to
  commit"** banner so the operator never reads the transient state as official.
- A per-row **Vacate** button → `VacateConfirmDialog` (confirm + optional ~255-char
  reason, client-capped to 255) → `loVacateGame`. The vacated row shows a distinct
  **"vacated — re-score"** state with an **Undo** (`loRestoreGame`, restores that one
  game; does **not** re-complete) and a **Score** action (reuse `ScoringDialog` →
  `loCorrectGame`).
- **Re-Finalize** gated until no game is vacated-pending-rescore. On a games-mode
  tie, show the block message + **"Restore original result"** (`loRestoreCompletion`,
  re-stamps `completed` — prior winner intact).
- On finalize/restore success, route back / completion screen (reuse v1) +
  invalidate standings + match-confirmations caches.

**Test scenarios:**
- Happy path: vacate → row shows vacated state → re-score → re-finalize → completed
  with the new winner.
- Edge case: editing a completed match triggers **exactly one** reopen (not per game).
- Edge case: Undo restores that game's original result and leaves the match reopened
  (completion stays explicit — no auto re-complete).
- Edge case: Re-Finalize disabled while any game is vacated-pending-rescore.
- Error path: a correction that ties → re-finalize blocked; "Restore original result"
  returns the prior completed winner.
- Edge case: the mid-correction banner is shown while reopened, gone once re-finalized.

**Verification:** The LO can correct a game on a completed match end-to-end and
re-finalize, or restore on a tie.

- [ ] **Unit 8: DB round-trip integration test**

**Goal:** Prove the correction lifecycle against real Postgres.

**Requirements:** R6, R7 (correctness)

**Dependencies:** Units 1–3

**Files:**
- Create: `src/__tests__/database/loMatchReview.roundtrip.db.test.ts`
  (`// @vitest-environment jsdom`)

**Approach:** Build a completed-match fixture that **seeds pre-existing team
`game_confirmations` rows** (the v1 round-trip fixture is log-free, so it can't
exercise "+N others" / post-vacate exclusion against real team confirmers — seed
them explicitly). Run `loReopenMatch` → `loVacateGame` → `loCorrectGame` →
`loFinalizeMatch`. Assert: vacate + operator confirm rows appended (with reason);
the original team confirm rows still present (append-only); `match_games` reflects
the new result; match re-completed with the corrected winner; standings includes it
again. Assert the tie path → restore leaves the prior completed result. Assert an
abandoned reopen (no re-finalize) is `in_progress` with `completed_at` still set.
Clean up.

**Test scenarios:**
- Happy path: full reopen→vacate→rescore→re-finalize → corrected completed match +
  appended log rows with reason.
- Edge case: a correction producing a games-mode tie → restore leaves the prior
  completed result.
- Edge case: reopened match is excluded from standings until re-finalize, then
  re-included.

**Verification:** The real-DB lifecycle produces a documented, correctly-scored
correction.

## System-Wide Impact
- **Interaction graph:** `loVacateGame`/override → `appendConfirmation` +
  `match_games` + `updateMatchRunningTotals`; `loReopenMatch`/re-finalize →
  `matches` row → standings (read-time). `EntryPhase` gains review/confirmer paths.
- **State lifecycle risks:** the reopen window (match briefly out of standings) —
  kept light per scope; re-finalize restores. Append-must-follow-reopen ordering is
  load-bearing (appendConfirmation no-ops on completed).
- **API surface parity:** v1 enter-from-blank stays log-free — corrections use the
  sibling `loCorrectGame`; `loScoreGame` is untouched.
- **Unchanged invariants:** officiality stays on `match_games.confirmed_by_*`;
  `updateMatchRunningTotals`/`decideWinner`/standings unchanged; the two-party live
  vacate/score paths untouched; `system_snapshot` reused (not recomputed) on
  re-finalize.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Append no-ops on `completed` → silent data loss if vacate runs first | Reopen is a hard prerequisite (Unit 7 reopens once before any vacate; Unit 8 asserts) |
| Abandoned reopen / crash mid-correction strands the match | Reopen KEEPS the completion fields (crash-safe); picker detects `in_progress`+`completed_at` and offers re-finalize / restore (Units 2, 5) |
| Tie on re-finalize strands a reopened match | Block + "restore original" re-stamps `completed` (prior winner still on the row — no UI snapshot needed) |
| `side` CHECK (home/away) can't express an off-team operator | Operator rows use the winner's side; `buildConfirmerAudit` excludes `loMemberId` outright so side never affects the audit (Key Decisions, Unit 4) |
| Vacate marker append is best-effort (`appendConfirmation` never throws) | Operator vacate checks the boolean return + surfaces failure — the marker anchors dissent windowing (Unit 3) |
| Standings cache stale during the reopen window | Invalidate standings/TanStack after re-finalize/restore; window kept short (light scope) |
| v1 enter-from-blank accidentally starts writing log rows | `loCorrectGame` is a sibling; `loScoreGame` stays log-free; regression test (Unit 3) |
| Depends on unmerged many-eyes `game_confirmations` (#157) | We're stacked on it; confirm merge ordering before shipping |

## Documentation / Operational Notes
- Update `TABLE_OF_CONTENTS.md` for new files. Entry remains **dev-gated** like v1.
- Final user-facing copy (button labels, reason placeholder) is the user's call.

## Sources & References
- **Origin document:** [docs/brainstorms/lo-match-review-and-correction-requirements.md](docs/brainstorms/lo-match-review-and-correction-requirements.md)
- Related: `src/api/mutations/loManualScoring.ts`, `src/api/mutations/appendConfirmation.ts`,
  `src/utils/match/deriveDissents.ts`, `src/api/hooks/useGameConfirmations.ts`,
  `src/api/queries/standings.ts`, `supabase/migrations/20260525000000_game_confirmations.sql`
- Related PRs: #167 (v1, stacked on), #157 (many-eyes)
