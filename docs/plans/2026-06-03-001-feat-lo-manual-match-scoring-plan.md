---
title: "feat: LO Manual Match Scoring (v1 enter-from-blank)"
type: feat
status: active
date: 2026-06-03
deepened: 2026-06-03
origin: docs/brainstorms/lo-manual-match-scoring-requirements.md
---

# feat: LO Manual Match Scoring (v1 enter-from-blank)

## Overview

Give a League Operator (LO) a way to record a match that was played on paper
(power outage, dead device) so the app applies **normal scoring** — same modular
engine, thresholds, points, winner — as if it had been played live. v1 is
**enter-from-blank only**: the LO picks a not-yet-started match, enters both
lineups + handicaps, clicks **Setup Match** (freezes lineups, runs threshold math,
creates game rows via `prep_match`), then scores each game in a scoreboard view
reusing the live `ScoringDialog`, and clicks **Finalize Match** to write the
winner.

The scoring **math** is reused unchanged (`prep_match`, `updateMatchRunningTotals`,
the modular engine, `decideWinner`, `UnifiedScoreboard`, `ScoringDialog`). The
genuinely new code is a **thin LO-authoritative layer**: an LO lineup write that
bypasses team-membership gates, a direct `prep_match` driver, a per-game write that
fills **both** confirmation slots, and a finalize that fills **both** verification
slots — because one operator stands in for both parties.

## Problem Frame

There is no operator path to record a match after the fact. Live scoring is built
around two captains each confirming on their own device; when that can't happen,
results have no way into the system. (See origin: `docs/brainstorms/lo-manual-match-scoring-requirements.md`.)

## Requirements Trace

- R1. Enter both lineups on one page, mirroring the live lineup UI; dual-side
  layout is net-new (live page is single-side per captain).
- R2. LO can override each player's handicap; overrides write the frozen
  `match_lineups.playerN_handicap` fields; fields pre-populate from roster handicap.
- R3. Single **Setup Match** action: freezes lineups, runs threshold math, creates
  game rows — drives the `prep_match` RPC directly, not the two-captain
  `useMatchPreparation` orchestration.
- R4. After Setup Match, transition to Entry phase; loading/success/error states;
  re-click must not double-create (relies on `prep_match` `scheduled`-only guard).
- R5. Entry view reuses `UnifiedScoreboard` (running totals + thresholds + game
  grid); grid clearly marks scored vs. unscored.
- R6. Score each game by reusing `ScoringDialog`; per-game forfeit toggle hidden.
- R7. No two-party confirm — LO write fills **both** `confirmed_by_home` and
  `confirmed_by_away` in one op so the game counts in recompute.
- R8. After each write, `updateMatchRunningTotals` recompute runs unchanged.
- R9. LO can correct a scored game: tap it → `ScoringDialog` re-opens pre-filled →
  overwrite → recompute. No vacate ceremony.
- R10. Single **Finalize Match** action fills **both** `home_team_verified_by` and
  `away_team_verified_by`, drives the win-calculator, and writes `winner_team_id` +
  `status='completed'`.
- R11. Only matches with nothing recorded (`status='scheduled'`) are eligible;
  guard is an authoritative state read, not UI-only; picker marks eligibility.

## Scope Boundaries

- **v1 = enter-from-blank only.** No take-over of started/finished matches; no
  cross-session adjust beyond same-session game correction (R9).
- **Played-only.** No whole-match forfeit/no-show entry; the modal's per-game
  forfeit toggle is hidden.
- **No two-party / realtime flow** on this page — operator-attested by design.
- **No scoring-system / threshold-chart editing** (that is the separate future
  "workshop" build). This feature consumes the match's already-configured system.

### Deferred to Separate Tasks

- Take-over of in-progress/finished matches and cross-session adjust: future
  iteration. The `prep_match` `scheduled`-only gate means take-over needs its own
  write path (a documented landmine — see Risks).
- Match-level forfeit/no-show entry: deferred-with-demand (a forfeited match is
  also a plausible operator entry); prioritize in the end-state.
- Dedicated re-usable per-week match list beyond this feature's picker: out of scope.
- **Operator confirmer-audit view** (button on a scored game → modal listing each
  confirmer + their team, for dispute adjudication): future edit/take-over phase,
  dependent on the deferred many-eyes confirm/deny model. Not v1 (LO is sole
  confirmer here).

## Context & Research

### Relevant Code and Patterns

- **Operator page shell to mirror:** `src/operator/LeagueDetail.tsx` (useParams →
  load → loading/error guards → `<Card>` section composition). Entry-point card
  added here.
- **Schedule read view (reference only, not reused as entry):** `src/operator/ScheduleView.tsx`.
- **Routing:** `src/navigation/NavRoutes.tsx` — operator routes wrapped by
  `withOperator()` (`<Suspense>` + `<ProtectedRoute requireAuth requiredRole="league_operator">`). Role-gated only; no org-ownership check at the route layer → R11 must be a state read.
- **Lineup building blocks:** `src/components/lineup/PlayerSelectionRow.tsx`,
  `HandicapCell.tsx` (editable `Input` when `handicapType==='fargo'` + `onManualHandicapChange` — R2 extends this to all types), `MatchInfoCard.tsx`, `HandicapSummary.tsx`. Lock UI `LineupActions.tsx` is **not** reused (R3 uses one "Setup Match" button).
- **Lineup completeness gate (reuse):** `src/utils/lineup/computePrepBlockedReason.ts` — reuse for R4 disabled-until-complete, bypassing the two-party orchestration around it.
- **Prep math to extract:** `src/hooks/lineup/useMatchPreparation.ts` — threshold
  dispatch (Fargo+points → `*_to_tie`=start-credit; Fargo+games → `computeFargoGamesWonThresholds`; else → `calculateHandicapThresholds`), `computeGameCount` (`@/systems/team-geometry`), `generatePairings` (`@/systems/pairings`). The `useEffect`/opponent-locked/home-only/realtime parts are **not** reused.
- **prep_match RPC:** `supabase/migrations/20260504000000_harden_prep_match_write_guards.sql` — `prep_match(p_match_id, p_thresholds, p_game_rows)`, all writes `WHERE status='scheduled'`, game insert `ON CONFLICT (match_id, game_number) DO NOTHING`. Idempotent no-op on re-call.
- **Per-game write to vary:** `src/hooks/useMatchScoringMutations.ts` `handleConfirmScore` — currently sets one slot via `isHomeTeam = userTeamId === match.home_team_id`. LO variant sets both. Extras contract: `break_and_run, golden_break, break_fouled, runout, win_by_forfeit, winner_value, loser_value`.
- **Recompute (reused):** `src/api/queries/matches.ts` `updateMatchRunningTotals` — counts only fully-confirmed non-tiebreaker games.
- **Membership gates to bypass:** `src/api/mutations/matchLineups.ts` `saveMatchLineup`/`lockMatchLineup`/`unlockMatchLineup` (team_players check throws "not a member of this team").
- **Finalize chokepoint:** `src/components/scoring/MatchEndVerification.tsx` — on `bothVerified`, elects a first-verifier, runs `decideWinner` (`@/systems/win-calculator`), writes `winner_team_id, match_result, completed_at, status`. `src/player/ScoreMatch.tsx` `handleVerify` writes one verified_by slot.
- **Reuse surfaces (props-stubbed, no wrappers):** `src/components/scoring/UnifiedScoreboard.tsx` (`isHomeTeam`, `onVerify`, `onSwapPlayer` are the live-flow props to stub) and `src/components/scoring/ScoringDialog.tsx` (pure input UI; add a flag to hide the forfeit toggle).
- **UX parts bin (mine, do not lift code):** old branch `lo-manual-scoring` —
  `src/components/operator/match-list/WeekAccordionHeader.tsx`, `MatchRow.tsx`,
  `MatchListPage.tsx`, and `match-editor/*` layout. Predates current stack; UX only.

### Institutional Learnings

- RLS intentionally disabled pre-launch — membership-gate bypass works via direct
  `match_lineups` writes today; don't flag RLS-off as a bug.
- `prep_match` idempotency (`status='scheduled'` guard) is the backstop for R4/R11.
- `system_snapshot` is frozen lazily at first scoring event — for after-the-fact
  entry that's later than when the match was played (config-drift risk, see Risks).
- DB-touching tests go under `src/__tests__/database/` (sequential, jsdom, add
  `// @vitest-environment jsdom`); shared Postgres → pick fixtures deterministically.
- Tiebreaker completion uses separate `*_tiebreaker_verified_by` columns
  (`MatchEndVerification` reused via `TiebreakerScoreboard`).

## Key Technical Decisions

- **Operator-attestation identity:** LO writes **its own `members.id`** into both
  `confirmed_by_home`/`confirmed_by_away` (R7) and both `home_team_verified_by`/
  `away_team_verified_by` (R10). It's a real `members` row (satisfies the FK), and
  it honestly records "operator entered this," which is the correct audit signal.
- **Do NOT write `game_confirmations`; the two `match_games` uuid columns suffice.**
  `confirmed_by_home`/`confirmed_by_away` are `uuid` (member-ID) columns and are the
  *sole* source of officiality — `updateMatchRunningTotals` reads only them. The
  `game_confirmations` table (the "many-eyes" multi-confirmer witness log, built on
  the unmerged `feat/many-eyes-confirmation-tracking-phase-3` stack, PRs #147/#155/
  #157) is purely additive audit data nothing consults for counting; its migration
  explicitly keeps the two columns unchanged. The LO's id in both uuid slots already
  records operator-attestation on the match record. A single operator transcribing
  paper is not a live witness, so injecting LO rows into the witness log adds no
  function and muddies its semantics (and dissent/dispute derivation).
  A future confirmer-audit view reads "operator-entered" off the match record (both
  slots = the same off-team LO id) without needing `game_confirmations` rows.
- **Base branch = the many-eyes stack tip, for integration safety (not data
  dependency).** We're *functionally* independent of `game_confirmations` (above),
  but this feature **mirrors** three scoring files the stack rewrote —
  `useMatchScoringMutations` (the per-game extras contract `loScoreGame` copies),
  `GamesList` (the entry grid), and `MatchEndVerification` (the completion writes
  `loFinalizeMatch` mirrors). To build against their final shapes and avoid a merge
  surprise when the stack lands, base this work on `feat/scoring-participation-modes`
  (PR #157, the all-inclusive tip of #143→#147→#155→#156→#157), per the
  branch-off-open-PRs pattern. `ScoringDialog`, `UnifiedScoreboard`, `HandicapCell`,
  and `updateMatchRunningTotals` are unchanged vs `main`, so their reuse is identical.
- **Extract prep math into a shared pure helper** rather than fork it: live hook
  and LO driver both call one source of truth (DRY; avoids drift between two
  threshold/pairings implementations).
- **Direct finalize write over component `useEffect`:** the LO finalize writes both
  verified_by slots and performs the completion (run `decideWinner`, write
  `winner_team_id` + `status='completed'`) in one operator action, mirroring
  `MatchEndVerification`'s completion writes. Reusing the component's two-device
  first-verifier election for a single actor is awkward and timing-dependent; a
  direct write is in the spirit of R7's dual-slot philosophy and uses the same
  win-calculator path (honoring R10's intent).
- **Bypass membership gates with new LO mutations**, not by loosening the live
  `matchLineups.ts` functions — keeps the two-party paths untouched.
- **Reuse `UnifiedScoreboard`/`ScoringDialog` by prop-stubbing**, no wrapper
  variants — both are already presentational/driver-agnostic.
- **Breaker assignment is non-authoritative in v1** (see Open Questions): the LO
  accepts engine-generated `home_action`/`away_action`; break-and-run/golden-break
  eligibility follows the generated breaker, which may not match the paper sheet.
- **Freeze `system_snapshot` at `loSetupMatch`** (review finding): the LO flow has
  no first-score event to trigger the live lazy freeze, so it freezes the snapshot
  explicitly at setup — otherwise completion math runs off live config and the
  consistency audit self-disables.
- **Games-mode tie blocks finalize** (review finding): rather than mirror the live
  auto-tiebreaker path (which needs a second device and would strand the match), the
  LO finalize refuses a tied games-mode result with a clear message, leaving the
  match reversible. Tiebreaker reproduction is a deferred end-state concern.
- **`loMemberId` derived server-side** from the session, never client-supplied (no
  audit-slot spoofing).
- **No "operator-entered" badge; attestation is an internal audit signal.** The
  `confirmed_by`/`verified_by` identity records who entered/confirmed each game in
  the data — there is **no** public UI badge on schedule/standings/history. The
  right consumer of this data is a future **operator-only confirmer-audit view** (a
  small button on a scored game → modal listing each confirmer + their team) used to
  adjudicate disputes. That view is **out of v1 scope** (in enter-from-blank the LO
  is the sole confirmer, so the list is trivially "LO"). Its multi-confirmer data
  layer (`game_confirmations`) is already built on the unmerged many-eyes stack (not
  in `main` yet); the view itself belongs to the edit/take-over phase. See Deferred
  to Separate Tasks.

## Open Questions

### Resolved During Planning

- Which `members.id` in the confirmer/verifier slots? → the LO's own, derived
  server-side (decision above).
- Reuse `useMatchPreparation` or drive `prep_match` directly? → direct, via a
  **standalone** LO helper; the live hook is NOT modified in v1.
- Wrapper vs prop-stub for the reused scoreboard/dialog? → prop-stub.
- Finalize via component or direct write? → direct write through the win-calculator,
  including the `auditMatchScoringConsistency` call.
- `system_snapshot`? → frozen explicitly at `loSetupMatch` (resolved, was a gap).
- Games-mode tie? → finalize blocks with a message; not stranded (resolved).
- Entry point? → new card on `LeagueDetail` → new match-picker page → match-scoring
  page (per user direction; distinct from the schedule-edit page).

### Deferred to Implementation

- ~~**Fargo+points start-credit calc**~~ RESOLVED in Unit 1: use
  `fargo5v5.handicapMechanism.compute(...)` → map to weaker team's `*_to_tie`.
- ~~**`loSaveLineups` vs `updateMatchLineup`**~~ RESOLVED in Unit 2: `updateMatchLineup`
  can't *create* a row on a fresh scheduled match, so `loSaveLineups` does a gate-free
  upsert on the `(match_id, team_id)` constraint instead.
- **`ScoringDialog` forfeit hide:** verify whether omitting `onWinByForfeitChange`
  already hides it before adding a `hideForfeit` prop.
- **Per-game breaker vs paper order:** v1 accepts generated breaker (decision
  above). Per-game breaker override is the future fix if mis-credits matter.
- **Tiebreaker reproduction:** a paper match that needed a tiebreaker is blocked in
  v1 (decision above); full reproduction is an end-state concern.
- Exact helper/function names and file split within the LO data layer.

### Deferred to the Pre-Launch Auth/RLS Pass

- **Operator-owns-league enforcement** (review P1): the new LO mutations and
  `prep_match` are role-gated (`league_operator`) but have **no org-ownership
  check** — any operator could write any league's match. This matches the current
  posture of the rest of the operator surface and the deliberate "RLS/auth deferred
  until launch" decision (memory: `project_rls_disabled_until_launch`). It is
  **not** scoped into this feature; it belongs to the dedicated pre-launch auth pass,
  which must cover all four LO mutations + the `prep_match` RPC (operator-of-owning-org
  policy), not just the live paths. Recorded here so the pass doesn't miss them.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review,
> not implementation specification. The implementing agent should treat it as
> context, not code to reproduce.*

```
LeagueDetail (new "Score a Match" card)
        │
        ▼
Match-Picker page  ──(weeks accordion → match rows w/ status; eligible = clickable)
        │  pick eligible match (status='scheduled')
        ▼
Manual-Scoring page
  ┌───────────────── Setup phase ─────────────────┐
  │ two columns of PlayerSelectionRow (home/away)  │
  │ handicap override (HandicapCell, all types)    │
  │ [Setup Match]  ── disabled until both complete │
  │      │  computeThresholds()+generatePairings() │  ← shared pure helper
  │      ▼  loSetupMatch(): supabase.rpc('prep_match', …) (status='scheduled' guard)
  └──────│─────────────────────────────────────────┘
         ▼ (games created)
  ┌───────────────── Entry phase ──────────────────┐
  │ UnifiedScoreboard (isHomeTeam stub, onVerify→   │
  │   finalize, onSwapPlayer undefined)             │
  │ game grid: scored / unscored                    │
  │ tap game → ScoringDialog (forfeit hidden)       │
  │   onConfirm → loScoreGame(): write BOTH         │
  │     confirmed_by_home & _by_away = LO member id │
  │     → updateMatchRunningTotals() (reused)       │
  │ tap scored game → re-open pre-filled → overwrite│  (R9)
  │ [Finalize Match] → loFinalizeMatch():           │
  │   write BOTH *_team_verified_by = LO member id  │
  │   run decideWinner → winner_team_id, completed  │  (R10)
  └─────────────────────────────────────────────────┘
```

## Implementation Units

- [x] **Unit 1: LO prep-payload helper (standalone, does NOT touch the live hook)** — DONE (`src/utils/match/computeMatchPrepPayload.ts` + 10 tests; typecheck/lint clean)

**Goal:** Build a standalone helper that produces a `prep_match`-ready payload
(thresholds + gameRows) for the LO driver. **Do not modify `useMatchPreparation`**
— mirror its dispatch in a new helper so the live path keeps zero regression
surface (DRY wire-up of the live hook is deferred to a later refactor; review
flagged touching the live hook as the wrong risk for v1).

**Requirements:** R3 (foundation)

**Dependencies:** None

**Files:**
- Create: `src/utils/match/computeMatchPrepPayload.ts`
- Create: `src/utils/match/__tests__/computeMatchPrepPayload.test.ts`

**Approach:**
- Input: lineup size, game-generation mode, both lineups (players + handicaps +
  positions + actions), handicap type, win condition, mechanism, league game_type,
  **and `home_team_id`, `away_team_id`, `season_id`** (the non-Fargo branch's
  `calculateHandicapThresholds` is **async** and does a team-bonus DB lookup keyed
  on these — so this branch is not purely synchronous; the helper is async).
- Output: `{ thresholds: <prep_match p_thresholds shape>, gameRows: <p_game_rows shape> }`.
- Threshold dispatch mirrors the live hook: Fargo+games → `computeFargoGamesWonThresholds`;
  non-Fargo → `calculateHandicapThresholds`; game rows + count via
  `generateGameOrder(lineupSize, doubleRoundRobin)` (from `@/utils/gameOrder` — the
  actual function the live hook uses; NOT `generatePairings`/`computeGameCount`).
- **Fargo + points start-credit, RESOLVED:** the live hook reads `*_to_tie` from
  `matchData` (written by the two-captain negotiation the LO flow doesn't run), so
  the helper instead computes the credit from the frozen ratings via
  `fargo5v5.handicapMechanism.compute(homeRatings, awayRatings, overrides)` (the same
  pure calc `useFargoStartPointsNegotiation`'s `computedDefault` uses) and maps it to
  the weaker team's `*_to_tie` (even → 0/0); degrades to 0/0 on any guard miss
  (scoring never breaks).

**Patterns to follow:** `src/hooks/lineup/useMatchPreparation.ts` (the dispatch),
`src/hooks/lineup/useFargoStartPointsNegotiation.ts` (start-credit mapping),
`src/utils/gameOrder.ts`, `src/utils/handicap/fargoGamesWonThresholds.ts`,
`src/utils/calculateHandicapThresholds.ts`.

**Test scenarios:**
- Happy path: Fargo+points config → thresholds carry computed start-credit in
  `*_to_tie` (from ratings, not from a passed-in negotiated value), `*_to_win`/
  `*_to_lose` null; gameRows length == `computeGameCount`.
- Happy path: Fargo+games-won config → thresholds match `computeFargoGamesWonThresholds`.
- Happy path: non-Fargo config → thresholds match `calculateHandicapThresholds`
  (including the async team-bonus lookup).
- Edge case: asymmetric handicaps home vs away → both sides computed independently.
- Edge case: each lineup size / game-generation mode → gameRows count + positions
  + home/away_action match `generatePairings`.
- Integration: payload for a representative config matches the live hook's payload
  for the same inputs (cross-check the two implementations agree).

**Verification:** Helper returns a `prep_match`-ready payload for all
handicap/win-condition combinations; the live prep flow is untouched.

- [x] **Unit 2: LO-authoritative setup + lineup write** — DONE (`src/api/mutations/loManualScoring.ts`: `loSaveLineups` + `loSetupMatch`; 7 tests; typecheck/lint clean). `loSaveLineups` uses a gate-free **upsert** per side (not `updateMatchLineup`, which can't create a row on a fresh match); `loSetupMatch` guards `status='scheduled'`, reads the saved lineups, builds the payload (Unit 1), calls `prep_match`, freezes `system_snapshot`, seeds totals.

**Goal:** A data-layer module that writes both lineups (bypassing team-membership
gates) and drives `prep_match` directly to freeze/create the match.

**Requirements:** R2, R3, R4, R11

**Dependencies:** Unit 1

**Files:**
- Create: `src/api/mutations/loManualScoring.ts` (`loSaveLineups`, `loSetupMatch`)
- Create: `src/api/mutations/__tests__/loManualScoring.test.ts` (unit; mocked client)
- Reference: `src/api/mutations/matchLineups.ts` (shape, minus the membership check),
  `src/hooks/useMatchScoringMutations.ts` (`populateMatchSnapshotIfNeeded` call site)

**Approach:**
- `loSaveLineups`: write both `match_lineups` rows (player ids, positions, per-player
  handicap overrides, `home_team_modifier`) with `locked` semantics — **no**
  `team_players` check. Frozen handicaps land in `playerN_handicap`. **Verify first
  whether the existing `updateMatchLineup` (which skips the membership check when
  `teamId`/`memberId` are omitted) already satisfies this** — if so, reuse it and
  drop `loSaveLineups` (scope review flagged it as possibly redundant).
- `loSetupMatch`: read match, assert `status='scheduled'` (R11 authoritative guard),
  call `computeMatchPrepPayload` (Unit 1, async), `supabase.rpc('prep_match', …)`,
  **then `populateMatchSnapshotIfNeeded(matchId, leagueId)` to freeze
  `system_snapshot`** (the live path does this at first score; the LO path has no
  first-score event, so freeze it here — without it the completion math runs off
  live config and `auditMatchScoringConsistency` silently disables itself), then
  `updateMatchRunningTotals(matchId)` to seed start-credit points. Requires
  `leagueId` threaded into the LO data layer (resolve from match→season→league).
- Idempotency: rely on `prep_match`'s `status='scheduled'` guard; a second call is a
  safe no-op (R4).

**Patterns to follow:** `src/api/mutations/matchLineups.ts`, the RPC-call + retry
shape in `useMatchPreparation.ts`, the `populateMatchSnapshotIfNeeded` call in
`useMatchScoringMutations.ts`.

**Test scenarios:**
- Happy path: both lineups written with overridden handicaps in `playerN_handicap`.
- Happy path: `loSetupMatch` on a `scheduled` match calls `prep_match`, then freezes
  `system_snapshot`, then `updateMatchRunningTotals`.
- Edge case: handicap override differs from roster default → frozen value persisted.
- Edge case: after `loSetupMatch`, `system_snapshot` IS NOT NULL (assert explicitly).
- Error path: `loSetupMatch` on a non-`scheduled` match → guard refuses (no RPC call).
- Error path: re-running `loSetupMatch` after success → no duplicate games (no-op).
- Integration (db project, Unit 7): real round-trip asserts rows + thresholds + snapshot.

**Verification:** After `loSetupMatch`, `match_games` rows exist, thresholds set,
`system_snapshot` frozen, `status='in_progress'`; running totals reflect start-credit.

- [x] **Unit 3: LO dual-slot game write + finalize** — DONE (`loScoreGame` + `loFinalizeMatch` in `loManualScoring.ts`; 8 tests; typecheck/lint clean). Correction: the real winner judge is `determineMatchResult` (from `@/utils/determineMatchResult`) for games-mode + a points comparison — there is NO `decideWinner` in `@/systems/win-calculator`; the plan's `decideWinner` name was wrong throughout. Games-mode tie is BLOCKED (throws, match left unchanged); audit fired fire-and-forget.

**Goal:** The per-game write that fills both confirmation slots, and the finalize
that fills both verification slots and completes the match.

**Requirements:** R7, R8, R9, R10

**Dependencies:** Unit 2

**Files:**
- Modify: `src/api/mutations/loManualScoring.ts` (`loScoreGame`, `loFinalizeMatch`)
- Modify/Test: `src/api/mutations/__tests__/loManualScoring.test.ts`
- Reference: `src/hooks/useMatchScoringMutations.ts` (`handleConfirmScore` extras),
  `src/components/scoring/MatchEndVerification.tsx` (completion writes),
  `@/systems/win-calculator` (`decideWinner`)

**Approach:**
- `loScoreGame(gameId, result)`: assert `match.status='in_progress'` (reject writes
  on a `completed` match), then UPDATE the existing game row with the full extras
  contract (`winner_team_id, winner_player_id, break_and_run, golden_break,
  break_fouled, runout, win_by_forfeit, winner_value, loser_value`) **and** both
  `confirmed_by_home = confirmed_by_away = loMemberId`; then
  `updateMatchRunningTotals` (reused). Same function handles R9 overwrite (it's an
  UPDATE either way) — it does NOT go through the live `handlePlayerClick`, whose
  both-confirmed block would refuse a re-score.
- `loFinalizeMatch`: compute the result via `determineMatchResult` (games) / points
  comparison over the match-row totals **first**; **if it's a
  games-mode tie (no winner), BLOCK finalize with a clear message and leave the
  match at `status='scheduled'`/`in_progress` unchanged** — do NOT mirror the live
  path's auto-tiebreaker-create + lineup-unlock (the LO has no second device to play
  a tiebreaker; that path would strand the match). Otherwise set both
  `home_team_verified_by = away_team_verified_by = loMemberId` +
  `results_confirmed_by_home/away`, write `winner_team_id, match_result,
  completed_at, status='completed'`, **then fire
  `void auditMatchScoringConsistency(matchId)`** (the live completion does this; it's
  the only post-completion safety net and matters more for a single-operator write).
- `loMemberId` is derived from the authenticated session server-side, never accepted
  as a client parameter (no audit-slot spoofing).

**Patterns to follow:** the exact UPDATE column set in `handleConfirmScore`; the
completion `updates` object + the `auditMatchScoringConsistency` call in
`MatchEndVerification.tsx`.

**Test scenarios:**
- Happy path: `loScoreGame` writes both confirmation slots → recompute counts it.
- Happy path (R9): re-scoring an already-scored game overwrites winner + extras;
  totals recompute to the new result.
- Edge case: break-and-run / golden-break / calculator `winner_value`/`loser_value`
  persisted per the extras contract.
- Happy path (R10): `loFinalizeMatch` with all games scored → both verified_by set,
  `winner_team_id` from `decideWinner`, `status='completed'`, audit fired.
- Edge case: points-mode vs games-mode (clear winner) both finalize with correct `status`.
- Error path: games-mode tie → finalize blocked with message, match left reversible.
- Error path: finalize before all games scored → blocked (mirror live guard).
- Error path: `loScoreGame` on a `completed` match → rejected.
- Integration (db project, Unit 7): full setup→score→finalize round-trip.

**Verification:** A fully-scored, finalized LO match has identical
`home/away_games_won`, points, and `winner_team_id` to an equivalent live match;
the consistency audit ran (snapshot present); a tied match is never stranded.

- [x] **Unit 4: Match-picker page + routing/guard** — DONE (`ManualScoringMatchPicker.tsx` + `ManualScoringPage.tsx` stub + `manualScoringEligibility.ts` pure util; routes registered in `NavRoutes.tsx` **dev-gated** via `isProduction`; 14 tests; typecheck clean). The visible **dashboard card on `LeagueDetail` is deferred to land with Unit 6** (per "entry lands last" — nothing user-facing exposed until the scoring page is real; reachable by URL in dev/staging for now). Eligibility predicate = `status==='scheduled'` + two real teams; accordion defaults all weeks expanded.

**Goal:** Navigation: a "Score a Match" card on the league dashboard → a new
weeks-accordion match picker → the manual-scoring page; enforce R11 eligibility.

**Requirements:** R11, R1 (entry), R5 (navigation to entry phase)

**Dependencies:** Routes/picker can be built early, but the **visible dashboard
entry card lands last** (after Units 5–6) — or is gated behind a feature flag (off
until 5–6 land) — so the LO never reaches a half-built page (project principle:
hide user-facing entry until the feature is usable).

**Files:**
- Create: `src/operator/ManualScoringMatchPicker.tsx` (week grouping + match rows as
  unexported sub-components; extract to separate files only if it grows past ~130 lines)
- Create: `src/operator/__tests__/ManualScoringMatchPicker.test.tsx`
- Modify: `src/operator/LeagueDetail.tsx` (add entry card/button — flag-gated/last)
- Modify: `src/navigation/NavRoutes.tsx` (register routes under `withOperator`)
- Reference (UX only): old branch `match-list/WeekAccordionHeader.tsx`, `MatchRow.tsx`

**Approach:**
- Picker lists weeks by date (accordion); each match row shows a status badge. The
  **authoritative eligibility predicate is `status='scheduled'`** (matches
  `prep_match`'s own guard so the page guard and RPC guard can never disagree);
  "has games" is a display-only hint. Eligible rows are clickable → manual-scoring
  page for that `matchId`. Ineligible rows are non-clickable with an explicit status
  badge — vocabulary: `Scheduled` (eligible, clickable), `In Progress`, `Completed`
  (greyed, not clickable). Empty state when no eligible matches.
- Routes: `operator/league/:leagueId/manual-scoring` (picker) and
  `.../manual-scoring/:matchId` (the page). Role-gated via `withOperator`; the
  page itself re-reads `status='scheduled'` for the R11 guard (don't trust the list).
- Working labels (final copy is the user's call): card "Score a Match", page title
  "Enter Match Scores".

**Patterns to follow:** `src/operator/LeagueDetail.tsx` shell + `<Card>` sections;
`withOperator()` route registration.

**Test scenarios:**
- Happy path: weeks render with their matches; `scheduled` matches are clickable.
- Edge case: an `in_progress`/`completed` match shows its status badge, not clickable.
- Edge case: no eligible matches → empty state copy.
- Integration: clicking an eligible match routes to `.../manual-scoring/:matchId`.
- Edge case: the dashboard card appears on `LeagueDetail` (when enabled) and links
  to the picker.

**Verification:** LO reaches a specific scheduled match's scoring page in a few
clicks from the league dashboard; ineligible matches cannot be opened for scoring;
no entry point is exposed before the scoring page is usable.

- [ ] **Unit 5: Setup phase UI (dual lineup + handicap override + Setup Match)**

**Goal:** The Setup half of the manual-scoring page: enter both lineups, override
handicaps, click Setup Match.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 2 (calls `loSaveLineups`/`loSetupMatch`); Unit 4 (route)

**Files:**
- Create: `src/operator/ManualScoringPage.tsx` (phase host + Setup section inline;
  split `SetupPhase`/`EntryPhase` into separate files only if the page grows past
  ~150 lines — start single-file per YAGNI/scope review)
- Create: `src/operator/__tests__/ManualScoringPage.test.tsx`
- Modify: `src/components/lineup/HandicapCell.tsx` — add an explicit
  `editableOverride?: boolean` prop (default `false`); when `true`, the cell is
  editable for **all** handicap types. All existing callsites pass nothing →
  live behavior unchanged (grep callsites as a verification step).
- Reference: `src/components/lineup/PlayerSelectionRow.tsx`,
  `src/utils/lineup/computePrepBlockedReason.ts`

**Approach:**
- Two columns of `PlayerSelectionRow` (home/away). Mobile dual-side layout: **stack
  vertically (home then away) on narrow viewports** (lets the LO see both sides for
  the completeness check; default). Revisit tabs only if 5v5 scroll depth proves
  painful — if tabs, an incomplete inactive tab must show a badge.
- Handicaps pre-populate from roster (same source as live) and are editable for all
  types via `HandicapCell` `editableOverride`. An **overridden value is visually
  distinguished** from the roster default (e.g. accent color / "edited" marker) so
  the LO can audit their own changes before Setup Match.
- **Setup Match** disabled until both lineups complete (reuse
  `computePrepBlockedReason`); on click → `loSaveLineups`(/`updateMatchLineup`) then
  `loSetupMatch`; show loading ("Setting up…"), then a **persistent confirmation
  banner at the top of the Entry phase** ("Match set up — N games created" — a
  banner, not a dismissing toast, since the LO cross-checks N against the paper
  sheet), and an error/retry path; on success the page host switches to Entry phase.

**Patterns to follow:** live lineup composition in `src/player/MatchLineup.tsx`
(structure only); shadcn `Card`/`Button`.

**Test scenarios:**
- Happy path: both lineups filled → Setup Match enabled → success transitions to Entry.
- Edge case: one side incomplete → Setup Match disabled with a reason.
- Happy path (R2): editing a handicap (any type) updates the value sent to setup;
  overridden value renders visually distinct from default.
- Edge case: existing `HandicapCell` callsites (no `editableOverride`) unchanged.
- Error path: `loSetupMatch` fails → error shown, page stays in Setup, retry works.
- Edge case (R4): re-click after success does not double-create (no second prep).
- Integration: success path results in game rows the Entry phase renders.

**Verification:** LO can enter both lineups with overrides and produce a prepared
match ready to score; the live lineup page is unaffected by the `HandicapCell` change.

- [ ] **Unit 6: Entry phase UI (scoreboard + grid + scoring + finalize)**

**Goal:** The Entry half: scoreboard, game grid, per-game scoring via reused modal,
in-place correction, and Finalize Match.

**Requirements:** R5, R6, R7, R8, R9, R10

**Dependencies:** Unit 3 (`loScoreGame`/`loFinalizeMatch`); Unit 5 (phase host)

**Files:**
- Create: `src/components/operator/manual-scoring/EntryPhase.tsx`
- Create: `src/components/operator/manual-scoring/__tests__/EntryPhase.test.tsx`
- Modify: `src/components/scoring/ScoringDialog.tsx` — hide the forfeit toggle for
  the LO. **First verify whether omitting `onWinByForfeitChange` already suppresses
  it**; only add a `hideForfeit` prop if the switch renders regardless.
- Reference: `src/components/scoring/UnifiedScoreboard.tsx`,
  `src/player/ScoreMatch.tsx` (how it wires scoreboard + dialog; note its
  `handlePlayerClick` both-confirmed block — the LO path must NOT reuse it)

**Approach:**
- Render `UnifiedScoreboard` with live-flow props stubbed: `isHomeTeam` constant,
  `onSwapPlayer` undefined, `onVerify` → Finalize handler, `isVerifying` from state.
- Game grid marks scored vs. unscored: a **scored cell shows the winning player/side
  name** (double duty as a paper-sheet cross-check); an unscored cell shows a tap
  affordance. Game number always visible.
- Scoring uses a **dedicated LO tap handler** (not the live `handlePlayerClick`,
  which blocks both-confirmed games). Tap unscored → `ScoringDialog` (forfeit
  hidden), with `winnerWasScheduledBreaker` **computed by the parent** from the game
  row's `home_action`/`away_action` vs the selected winner (same logic
  `handlePlayerClick` uses) so achievement eligibility renders correctly → `onConfirm`
  → `loScoreGame` (both slots) → recompute updates totals.
- R9 correction: tap a **scored** game → the parent reads the stored game row,
  initializes the dialog's local state (breakAndRun, goldenBreak, winner/loser
  values, etc.) **before** opening (no loading spinner inside the dialog) → overwrite.
- **Finalize Match** → `loFinalizeMatch`; a blocked finalize (unscored games) shows
  an **inline message naming the count** ("N games not yet scored") below the button,
  not a toast. On completion, **route back to the picker with a persistent banner**
  ("Match recorded: Home beat Away N–M"). A games-mode tie shows the block message
  from Unit 3 (not supported in v1).

**Patterns to follow:** `src/player/ScoreMatch.tsx` scoreboard+dialog wiring (minus
realtime/confirmation queue and the `handlePlayerClick` both-confirmed block).

**Test scenarios:**
- Happy path: tap unscored game → modal → save → grid shows the winner, totals update.
- Happy path (R9): tap scored game → modal pre-filled with prior values → change
  winner → totals recompute (does not hit a both-confirmed block).
- Edge case (R6): forfeit toggle not rendered in the LO dialog.
- Edge case: `winnerWasScheduledBreaker` correct for a non-breaker winner (right
  achievement set shown).
- Edge case: per-game extras (break-and-run, calculator inputs) captured + persisted.
- Happy path (R10): all games scored → Finalize → winner shown, routed to picker
  with banner.
- Error path: Finalize with unscored games → inline "N games not yet scored".
- Error path: games-mode tie → block message, match not stranded.
- Integration: scoreboard totals match `updateMatchRunningTotals` after each write.

**Verification:** LO scores every game and finalizes; standings/points/winner match
a live-scored equivalent.

- [ ] **Unit 7: DB integration round-trip test**

**Goal:** End-to-end DB test proving an LO-entered match equals a live-scored one.

**Requirements:** R7, R8, R10 (correctness guarantee)

**Dependencies:** Units 2–3

**Files:**
- Create: `src/__tests__/database/loManualScoring.roundtrip.test.ts`
  (first line `// @vitest-environment jsdom`)
- Reference: `src/__tests__/database/matchGames.rls.test.ts`,
  `src/__tests__/README.md`, `src/test/dbTestUtils.ts`

**Approach:**
- Against local Postgres: pick a deterministic scheduled match fixture; run
  `loSaveLineups` → `loSetupMatch` → `loScoreGame` for each game → `loFinalizeMatch`.
- Assert: `match_games` rows created; `system_snapshot` frozen (NOT NULL); both
  confirmation slots set; running totals + points match expected; `winner_team_id` +
  `status='completed'` written; consistency audit did not short-circuit.
- Snapshot/restore or tx-scope shared rows; choose fixtures deterministically
  (sequential shared DB).

**Execution note:** DB project (sequential, jsdom). Keep writes isolated to avoid
shared-row flakiness.

**Test scenarios:**
- Happy path: full round-trip yields a completed match with correct winner + totals
  and a frozen `system_snapshot`.
- Edge case: games-mode (clear winner) vs points-mode both finalize with correct `status`.
- Edge case: a games-mode tie → finalize blocked, match remains reversible (not stranded).
- Edge case: a re-scored game (R9) yields the corrected totals after finalize.

**Verification:** A fresh LO round-trip produces a completed, correctly-scored match
against the real RPC + recompute.

## System-Wide Impact

- **Interaction graph:** `loSetupMatch`→`prep_match` RPC→`match_games`/`matches`;
  `loScoreGame`→`updateMatchRunningTotals`→modular engine; `loFinalizeMatch`→
  `decideWinner`/win-calculator. `HandicapCell` change affects the live lineup page
  (extension is additive/guarded — verify no regression).
- **Error propagation:** setup/score/finalize surface errors to the LO inline
  (toast + retry); recompute remains non-throwing (logs + swallows) as in live.
- **State lifecycle risks:** double-click Setup (guarded by `scheduled`-only RPC);
  partial entry (match sits `in_progress` until Finalize — acceptable, resumable);
  `system_snapshot` frozen at `loSetupMatch` (so the post-completion consistency
  audit runs); a games-mode tie is blocked at finalize, never left stranded.
- **API surface parity:** none of the live two-party paths change; new LO mutations
  are additive. The membership-gate bypass is isolated to `loManualScoring.ts`.
- **Integration coverage:** Unit 7 DB round-trip covers what component mocks can't
  (real RPC + recompute + completion).
- **Unchanged invariants:** live scoring, lineup-lock, and `MatchEndVerification`
  two-party flows are untouched; `prep_match`, `updateMatchRunningTotals`,
  `decideWinner`, `UnifiedScoreboard`, `ScoringDialog` behavior unchanged (consumed,
  not modified — except the additive `HandicapCell` all-types edit and `ScoringDialog`
  `hideForfeit` flag, both guarded).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Operator can score another org's match (role-gated, no org check) | Deferred to the pre-launch auth/RLS pass (consistent with the whole operator surface); the four LO mutations + `prep_match` listed there explicitly so it isn't missed |
| Membership-gate bypass writes `match_lineups` directly; relies on RLS-off | Isolate in `loManualScoring.ts`; pre-launch operator-write policy covers it |
| LO path could skip `system_snapshot` freeze → audit self-disables, finalize off live config | Explicit `populateMatchSnapshotIfNeeded` at `loSetupMatch`; Unit 2/7 assert snapshot present |
| Games-mode tie could strand the match in `in_progress` | Finalize blocks a tied games-mode result with a message; match left reversible |
| `prep_match` is `scheduled`-only → blocks the future take-over end-state | Documented landmine; take-over phase needs its own reset/write path (clear games+thresholds before re-prep) |
| Generated breaker ≠ paper order → mis-credited break-and-run/golden-break | v1 accepts generated breaker (documented limitation); per-game breaker override is the future fix |
| `HandicapCell` all-types edit could regress the live lineup page | New `editableOverride` prop defaults false; existing callsites unchanged (grep-verified); covered by existing + new tests |
| `loFinalizeMatch` drifts from `MatchEndVerification` completion writes | Mirror its `updates` object + audit call; cross-reference in code; Unit 7 parity assertion |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for every new file (project rule).
- Final user-facing copy (card label, page titles, button text) is the user's call
  before ship — working labels used in the plan.
- Consolidate migrations within the PR if any are added (none currently required —
  reuses existing `prep_match`).

## Sources & References

- **Origin document:** [docs/brainstorms/lo-manual-match-scoring-requirements.md](docs/brainstorms/lo-manual-match-scoring-requirements.md)
- Related code: `src/hooks/lineup/useMatchPreparation.ts`,
  `src/hooks/useMatchScoringMutations.ts`, `src/api/queries/matches.ts`,
  `src/api/mutations/matchLineups.ts`, `src/components/scoring/MatchEndVerification.tsx`,
  `src/components/scoring/UnifiedScoreboard.tsx`, `src/components/scoring/ScoringDialog.tsx`
- RPC: `supabase/migrations/20260504000000_harden_prep_match_write_guards.sql`
- Prior art (UX only, do not lift code): old branch `lo-manual-scoring`
  (`src/components/operator/match-list/*`, `match-editor/*`)
