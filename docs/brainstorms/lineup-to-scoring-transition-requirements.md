---
title: Lineup → Scoring Transition Stability (Cache + Component Reset)
date: 2026-05-04
status: Requirements — ready for planning
scope: Eliminate the recurring TanStack-cache + component-state bleed that
  causes the lineup → scoring transition to fail intermittently. Replace
  the 6-month-old retry-and-hope polling shim with deterministic state
  resolution. Decouple Fargo captain-confirmation storage from match
  thresholds. Multi-device captain recovery UX.
not_in_scope: Score-entry / winner-selection modal (LIST_FOR_ED #23 — own
  branch). Unified scoreboard internals (PR #99 — leave alone). Anything
  mid-match. Mobile / visual polish.
supersedes: Partially supersedes `docs/brainstorms/lineup-race-condition-fix-requirements.md`
  for the cache and recovery-UX aspects. That doc shipped (PR #87) and
  correctly addressed lineup-completeness gating; it did NOT touch the
  ScoreMatch retry loop or the cache-key wiring, which is what this
  brainstorm fixes.
---

# Lineup → Scoring Transition Stability (Cache + Component Reset)

## Problem

The transition from `MatchLineup` to `ScoreMatch` has been intermittently
failing for ~6 months. The most common surface failure is
`ScoreMatch.tsx:599-643` showing a "Match Preparation Failed" card after
its retry loop exhausts (10 attempts at 1-second intervals). The user-
discovered workaround is a full browser refresh, which always works.
In-app retries do not.

Two captured bugs (`LIST_FOR_ED.md` items #21 and #22, added in PR #99)
are concrete instances of this larger pattern, NOT isolated edge cases:

- **#21**: A multi-device captain scenario landed the user's phone at the
  prep overlay's "Back to Schedule"-only error state instead of the more
  common "Try Again / Back to Lineup" recovery card. The phone never
  navigated; the opposing device entered scoring normally.
- **#22**: After hitting #21 and routing back to schedule → back to
  lineup, the lineup page re-prompted Fargo start-points confirmation
  even though the opposing captain had already confirmed and was
  scoring.

A third related bug (`LIST_FOR_ED.md` #19) describes cross-match state
bleed during navigation between matches — the same root cause family.

### Why prior fixes did not stick

Investigation found that every prior attempt patched a downstream symptom
rather than the underlying state-management contract. Specifically:

1. **The retry loop in `src/player/ScoreMatch.tsx:507-529` invalidates
   the wrong query key.** It calls `queryClient.invalidateQueries({
   queryKey: ['match', matchId] })`, but the actual key for the data it
   needs is `[...queryKeys.matches.detail(matchId), 'leagueSettings']`
   (declared in `src/api/hooks/useMatches.ts:216`). TanStack does not
   fuzzy-match these — the invalidation has been a no-op since
   2025-11-13 (`8937272`). All 10 retries hit a stale cache.
2. **`useMatchWithLeagueSettings` is configured with a 10-minute
   `staleTime`.** `src/api/hooks/useMatches.ts:219` uses
   `STALE_TIME.SCHEDULES` instead of `STALE_TIME.MATCH_LIVE`. Even when
   `refetch()` is called, TanStack treats the cached data as fresh and
   skips the network round-trip.
3. **`window.location.reload()` resets things `invalidateQueries`
   cannot.** Component-local refs (`matchPreparedRef`,
   `completionStartedRef`, `initialWriteFiredRef`) and `useMemo`-derived
   values (`homeThresholds`, `awayThresholds`) survive
   re-renders. They only reset on full unmount. A page reload is the
   sledgehammer that resets *everything*; it is the only consistently
   effective recovery available today, which is direct evidence that
   the surviving component state — not just the server cache — is the
   poisoned surface.
4. **The bug-#22 root cause is the column overload itself, not a
   specific cleanup write.** `home_to_lose` / `away_to_lose` are doing
   double-duty as both "captain confirmed" markers (read in
   `src/hooks/lineup/useFargoStartPointsNegotiation.ts:127-131`) and
   "match threshold values" (written by `prep_match` and threshold-
   recalculating client paths). The `prep_match` RPC for Fargo points-
   mode actually preserves these values via
   `matchData?.home_to_lose ?? null` in
   `src/hooks/lineup/useMatchPreparation.ts:254-272` — it does NOT
   blanket-NULL them as an earlier draft of this doc claimed. The
   actual failure mechanisms for bug #22 are: (a) stale `matchData` at
   prep-call time (the staleTime bug — see point 2 above) means
   `home_to_lose ?? null` reads a stale value and writes the wrong one
   back; and (b) the editor flow in
   `useFargoStartPointsNegotiation.ts:165-166, 220-223` deliberately
   NULLs both confirms when a captain edits the proposed value, and a
   transient cache hiccup can leave the lineup page believing a confirm
   that's actually been cleared. Either way, the structural problem is
   the same: confirmation meaning and threshold meaning share storage.
   Defense 3 still solves this — but for a deeper reason than the
   earlier draft claimed.

## Strategic Identity & Sequencing

This is a **stability fix**, not a feature. Success looks like: every
attempted lineup → scoring transition either (a) completes cleanly
without user-visible failure, or (b) lands on a real, actionable
recovery surface that always offers a non-page-refresh path forward.
There is no in-between "Match Preparation Failed" terminal state.

The bar: a captain who experiences a transient prep failure and clicks
"Try Again" should get the same effect as a hard browser refresh —
a clean component reset and a fresh server read — without losing their
session or having to re-authenticate.

**Sequencing context**: this is the third lineup-area fix in six
months (PR #87 race-condition lineup gating; PR #99 unified
scoreboard; this branch). LIST_FOR_ED items #2 (Fargo 5v5 routing),
#3 (double-duty broken), #4 (Fargo start-points during scoring) are
also blockers for "meaningful Fargo league use." This branch
deliberately ships *before* those Fargo-correctness items because
PR #99 introduces bug #22 right now — every Fargo points-mode match
on PR #99 has the re-prompt. Fixing Fargo correctness while #22 is
still live makes it impossible to isolate which fix solved what
during testing. Land this branch first, then the Fargo correctness
items in clean conditions.

This branch is the structural fix for LIST_FOR_ED #19/#21/#22 and
the foundation for cleanly testing #2/#3/#4 in subsequent branches.
It is not the last word on lineup-area state management — it does
not, for example, address `started_at`'s overloaded meaning across
files (same class of bug as #22, scoped out here for size). That
follow-up is named in Adjacent Work.

## Architectural Principles

Three principles drive the fix shape. All three must hold for the system
to be rock-solid.

### Principle 1 — One authoritative server signal for "match prepped"

`matches.status = 'in_progress'` is the canonical "this match has
moved past lineup setup" signal. It is set atomically by the
`prep_match` RPC (in
`supabase/migrations/20260502000002_prep_match_rpc_renamed_columns.sql`)
in the same transaction as threshold writes and game inserts. There
is no half-state: status flips when the entire prep completed.

All transition-related decisions (whether to render lineup UI, whether
to render scoring UI, whether to show recovery UX) read this one
column. No more dispatch on `home_to_win !== null`, no more dispatch
on `started_at !== null`, no more dispatch on
`match_games.length > 0`. One signal, one source of truth.

The `started_at` setter in `src/hooks/lineup/useLineupPersistence.ts:182`
that fires when both lineups lock should remain as-is for now — but
no transition logic reads `started_at` for the "is this match
prepped" decision. (Renaming or removing the lineup-lock setter is a
follow-up cleanup.)

### Principle 2 — Component reset, not cache invalidation, at navigation boundaries

`queryClient.invalidateQueries` is not strong enough for the
match-transition use case. It resets server cache but not component
state. The fix uses React's built-in `key` prop pattern: when a
component's `key` changes, React fully unmounts and remounts the
subtree, resetting all useState, useRef, useMemo, and useEffect-
managed state.

Match-scoped page components (lineup page, scoring page) take
`matchId` as their `key`. Cross-match navigation triggers a full
component teardown + rebuild — the same effect as a page refresh,
but instant and contained to that subtree.

### Principle 3 — Storage shapes encode meaning, not scratch state

A column that means "this captain has confirmed the Fargo
start-points credit" must not also mean "match threshold value."
Sharing the column for both meanings is the root cause of bug #22 and
will keep generating regressions every time prep cleanup logic
evolves.

Confirmation flags get their own dedicated storage. Threshold values
get theirs. Prep cleanup operates on threshold columns only, never on
confirmation columns.

## Goals

1. **No "Match Preparation Failed" terminal state under normal
   operation.** Transient races, multi-device captain orderings, and
   network hiccups all resolve invisibly to the user. The 10-retry
   polling loop is deleted, not tuned.

2. **In-app recovery == page-reload recovery.** Whatever a hard refresh
   fixes, an in-app "Try Again" must also fix. No surviving refs, no
   stale `useMemo` values, no cache poisoning across attempts.

3. **Cross-match state bleed eliminated.** Navigating from match A to
   match B never serves match A's state under match B's identity.
   (Closes the LIST_FOR_ED #19 family of bugs.)

4. **Fargo confirmation persists across prep_match.** The column-
   overload that bug #22 exposed is structurally eliminated.
   Confirmation state survives any future cleanup logic on threshold
   columns.

5. **One unified failure-recovery surface.** Path B (lineup-page
   "Back to Schedule" overlay) and Path C (scoring-page "Match
   Preparation Failed" card) collapse into one component used in both
   places. Same buttons, same behavior: smart Try Again, Back to
   Lineup, Back to Schedule.

6. **Multi-device captain race resilience.** A captain whose device
   loses the prep race (because the opposing captain got there first)
   discovers the win and follows the leader, instead of stranding on a
   failure UX.

7. **No new behavior depends on `team_format`, `'5_man'`, `'8_man'`.**
   Inherited from the prior race-condition brainstorm. New code keys
   off resolved preferences (`handicap_type`, `lineup_size`,
   `points_calculator`, etc.).

## Non-Goals

- **Score-entry / winner-selection modal correctness** (`LIST_FOR_ED.md`
  #23). Same root-cause family — `system_snapshot` is captured lazily —
  but the fix surface is its own component and its own branch.
- **Unified scoreboard rendering** (PR #99). Just shipped; do not touch.
- **Mid-match anything.** Tiebreaker, completion, score-entry mutations
  are out of scope. The fix terminates at the moment the scoring page
  successfully renders for both captains.
- **Mobile / visual polish on the lineup page.** Inherited non-goal
  from the prior brainstorm.
- **Renaming or removing `started_at`.** Worth a follow-up cleanup
  brainstorm — it's currently double-written in two places and means
  different things in different files. **Important note**: this is the
  same class of bug as #22 (one column, two meanings, different
  files) that Defense 3 fixes for Fargo confirmation. Leaving
  `started_at` as-is is correct for *this* branch's scope but the
  vulnerability is structural and will surface again the next time a
  contributor edits one of the files that read `started_at`.
- **Rebuilding the score-entry retry mechanism.** This branch deletes
  the broken polling loop at `src/player/ScoreMatch.tsx:507-529`
  (which has been a no-op for ~6 months due to a query-key collision
  — see Defense 5.1) and replaces it with deterministic status-based
  recovery via Defense 1 + Defense 4. The recovery surface itself is
  a navigation guide, not a retry mechanism. If a future feature
  needs retry semantics for some other reason, that's its own design.

## Target Users

- **Primary:** League captains, mid-match-night, who currently hit
  "Match Preparation Failed" and recover by browser-refreshing. The
  goal is to remove the need for that workaround entirely.
- **Secondary:** Captains running multi-device sessions (phone +
  laptop, partner-as-co-captain testing scenarios). The 3-captain
  edge case in bug #21 lives here.
- **Tertiary:** Future contributors who otherwise inherit the same
  "add another retry" pattern when this surface fails again. The
  fix shape is the durable answer.

## The Fix Architecture

Seven independent defenses. Any one missing degrades the others'
guarantees, but each addresses a distinct failure mode so they
compose cleanly.

### Defense 1 — Synchronous route guard on `matches.status`

Every match-scoped page component (`MatchLineup`, `ScoreMatch`)
renders a single guard component as its outermost child. The
spectate flow uses card-per-match rendering inside list pages
(`src/player/SpectateMatchCard.tsx`); applying the same guard pattern
to spectate is deferred to a follow-up — it doesn't fit the
"outermost child of route" shape and would need a different design.
The guard does one job:

1. Read `matches.status` for the current `matchId` from the server.
   While loading: render a spinner with status message ("Loading
   match…").
2. Once resolved (status branch):
   - `status = 'scheduled'` → render lineup UI.
   - `status = 'in_progress'` → render scoring UI. If the user is on
     the lineup page, navigate to scoring (`/match/:id/score`) before
     rendering anything.
   - `status = 'completed'` / `'forfeited'` / `'postponed'` → render
     the appropriate post-match surface (out of scope for this branch
     beyond the redirect; existing surfaces handle these).
   - Any other value (NULL, unknown future status) → render the
     recovery surface (Defense 4).
3. Query-error branch (network failure, RLS denial, match-not-found):
   - Network error or timeout → render the recovery surface with a
     "connection" reason. The recovery surface's smart Try Again
     re-fetches; succeeds when connectivity returns.
   - 404 / row not found (PGRST116) → render a "match not found"
     terminal surface (out of scope to design here beyond a sane
     fallback message and Back to Schedule).
   - The status query inherits `retry: 1` from the QueryClient
     defaults, matching today's behavior. Planning may tune.

The guard runs on every mount AND re-runs when `matchId` changes.
While it runs, no decision-bearing UI renders. This eliminates the
"Fargo card flashes during initial render" failure mode that bug #22
relies on.

The match-status query uses `staleTime: 0` and
`refetchOnMount: 'always'` so a remount always hits the server. (See
also Defense 5 — the cache hygiene fixes.)

### Defense 2 — Component remount via compound key prop

The route-level component for match-scoped routes takes a compound
`key` of the form `${matchId}:${recoveryEpoch}`. Two triggers cause
a full subtree remount:

1. **`matchId` changes** — cross-match navigation. React tears down
   the entire match-A component subtree (all useState, useRef,
   useMemo, useEffect handlers, and Realtime channel subscriptions)
   and rebuilds for match B from zero. Solves the LIST_FOR_ED #19
   family (cross-match state bleed).
2. **`recoveryEpoch` increments** — within-match recovery. When the
   user clicks "Try Again" on the recovery surface (Defense 4), an
   epoch counter on the route-level component bumps. Same-match
   subtree remounts. Solves the "refs survive across recovery
   attempts" failure mode that today only `window.location.reload()`
   fixes.

The epoch counter lives on the route-level component (one source of
truth for the whole match subtree). Try Again calls
`setRecoveryEpoch(e => e + 1)`. The state lift is shallow — one
`useState` on the layout component, no context, no global store.

**Why a single key isn't enough**: keying on `matchId` alone misses
the within-route case (Try Again on the same match doesn't change
matchId, doesn't trigger remount, leaves refs polluted). Keying on
the epoch alone doesn't reset across matches. The compound key
delivers reload-equivalent reset for both cases.

**Architectural placement**: which component holds the compound key
depends on the route structure decision (see Open Question 2 — it
involves a real route-restructuring tradeoff that is surfaced for
user judgment, not auto-resolved).

### Defense 3 — Decoupled Fargo confirmation columns

`matches.home_fargo_start_points_confirmed_by` and
`matches.away_fargo_start_points_confirmed_by` (or equivalent —
planning picks the exact shape) replace the current overload of
`home_to_lose` / `away_to_lose` as confirmation flags.

The column stores either a captain's `system_player_number` (matching
today's "non-null = confirmed" semantics) or a timestamp + captain
identifier — planning decides. The constraint: a captain confirming
their side writes ONLY their side's column; the opposing captain's
column is untouched. Editing the start-points value clears BOTH
confirmation columns and restamps only the editor's side (current
behavior, just relocated).

`prep_match` no longer writes anything to confirmation columns.
Threshold cleanup for points-mode runs against `*_to_lose` /
`*_to_win` only; confirmation persists.

`useFargoStartPointsNegotiation` reads `myConfirmed` /
`opponentConfirmed` from the new columns. **All code paths that today
read `home_to_lose !== null` or `away_to_lose !== null` as a
confirmation signal are updated to read the new dedicated columns
instead.** After this branch, `*_to_lose` is read and written ONLY
for threshold purposes — never as a confirmation signal. Planning
audits for any other readers beyond the negotiation hook.

**Atomicity contract.** Editing the proposed start-points value must
clear both confirmation columns AND write the new tie value in a
single SQL UPDATE statement. Two-write implementations (e.g., a
separate `match_captain_confirmations` table updated in a second
statement) are rejected: a realtime tick between the two writes can
let the opponent see "value changed but still confirmed," which
locks them into scoring on the wrong value. Single statement, atomic.

Migration: a single Supabase migration adds the new columns. Per
project convention (all app data is disposable dev test data — see
`feedback_dev_data_disposable.md`), no backfill is needed; any
in-flight Fargo negotiation at migration time is truncated and
re-run. The migration also drops `*_to_lose` / `*_to_win` from any
confirmation-meaning use; those columns become threshold-only after
this branch.

### Defense 4 — Unified recovery surface

A single React component replaces today's Path B (overlay-only Back
to Schedule) and Path C (`ScoreMatch.tsx:599-643` "Match Preparation
Failed" card). Used by both the lineup page and the scoring page
when the route guard (Defense 1) returns "anything else." Same
buttons everywhere, same behavior:

- **Try Again (smart).** First re-fetches `matches.status`. If
  `'in_progress'`, navigates to scoring. Otherwise re-runs whatever
  prep step is owed (home team) or waits on realtime (away team)
  with progress messaging. **Crucially**: this NEVER triggers a
  `window.location.reload()`. The Defense 2 key-prop remount + the
  Defense 5 cache hygiene make a clean component reset achievable
  in-page.
- **Back to Lineup.** Navigates to `/match/:id/lineup`. Defense 3
  prevents this from triggering bug #22's re-prompt loop.
- **Back to Schedule.** Existing escape hatch. Always available.

The 10-retry polling loop in `src/player/ScoreMatch.tsx:507-529` is
**deleted**. The recovery surface only renders when the route guard
deterministically returns "not prepped after a fresh server read."

### Defense 5 — Cache hygiene fixes

Three targeted corrections to TanStack configuration:

1. **`useMatchWithLeagueSettings` `staleTime` change.**
   `src/api/hooks/useMatches.ts:219` switches from
   `STALE_TIME.SCHEDULES` (10 min) to `STALE_TIME.MATCH_LIVE` (0).
   Match-state reads must always hit the server. The schedule-list
   surfaces that read longer-lived match data use a separate query
   path; planning verifies no regression there.
2. **Realtime invalidation switches from `refetch()` to
   `invalidateQueries()`.** `src/realtime/useMatchRealtime.ts:144,
   159, 175` calls `onMatchUpdateRef.current?.()` etc. — these
   resolve to refetch handlers from the parent components.
   Refetches respect `staleTime`; invalidations don't. With
   Defense 5.1 above, this distinction matters less, but the
   correct verb is `invalidateQueries` keyed to the exact query
   key (not the `['match', matchId]` partial that fails today).
3. **Cross-match cleanup at navigation boundaries.** When the
   match-route component unmounts (Defense 2 takes care of this
   automatically via key change), match-scoped queries are removed
   from the cache via `queryClient.removeQueries({ queryKey:
   queryKeys.matches.detail(matchId) })` in a cleanup effect.
   Belt-and-suspenders with Defense 2's component teardown.

These fixes are individually small but eliminate the specific
"invalidation says it ran but it didn't" smoking gun.

### Defense 6 — `prep_match` write guards

The current `prep_match` RPC
(`supabase/migrations/20260502000002_prep_match_rpc_renamed_columns.sql`)
guards only the `status` column from being clobbered on a second
call (`status = CASE WHEN status = 'scheduled' THEN 'in_progress'
ELSE status END`). All other writes — threshold columns, started_at
— run unconditionally. This leaves a multi-device race window: two
devices both authenticated as home captain (same user on phone +
laptop, partner-as-co-captain testing) both qualify the prep gate,
both call `prep_match`, both UPDATEs run, last writer wins on
threshold values. If the two devices' `matchData` differs (because
one missed a Fargo-edit cache invalidation), the loser's threshold
values silently overwrite the winner's.

The fix: ALL UPDATE writes in `prep_match` are guarded by `WHERE
status = 'scheduled'` (added at the SQL level via the WHERE clause,
not via CASE). The second call becomes a true no-op — no writes,
no row updated, no error. Combined with `INSERT ... ON CONFLICT DO
NOTHING` on game inserts (already in place), the RPC is now fully
idempotent: a second call from any race-loser leaves the database
exactly as the first call left it.

This makes Defense 4's "smart Try Again" trivially safe to call
even if it doesn't strictly need to (e.g., in the rare case where
re-fetch shows `'scheduled'` but the home write is actually in
flight on another device, racing the Try Again against the original
prep just lets Postgres serialize them — the loser is a no-op).

### Defense 7 — Foreground polling for dropped-realtime recovery

Realtime delivery is best-effort. A captain whose websocket
reconnects (mobile network blip, app backgrounded, OS-level
throttling) after `prep_match` fires can miss the UPDATE
notification entirely. With Defenses 1–6, that captain sits on the
lineup page indefinitely with no automatic discovery of the prep
success — only a manual Try Again or page refresh recovers. That's
a regression from today's broken-but-existing 10-retry behavior
which auto-recovered within ~10 seconds.

The fix: when the lineup page is in a "waiting on opponent" state
(opponent lineup locked, my lineup locked, prep not yet visible),
poll `matches.status` every 5–10 seconds (planning picks the
exact cadence). When status flips to `'in_progress'`, the route
guard's existing redirect-to-scoring logic fires automatically. No
new UX surface — just a backstop refetch loop on the
already-existing query.

This is **not** the broken retry pattern resurrected. The
distinctions:

- **Polling target**: a fresh server read of `matches.status`
  (not a no-op cache invalidation).
- **Polling scope**: only fires when the lineup page is in
  "waiting" state. Cancels on navigation, on status change, on
  unmount.
- **Backed by Defense 5.1**: the underlying query has
  `staleTime: 0`, so each poll is guaranteed to hit the server.
- **No retry counter, no failure surface**: polling continues
  indefinitely until status flips. Manual Back to Schedule remains
  as the user-initiated escape hatch.

A captain on a flaky mobile network experiences a delay of up to
~10 seconds between actual prep success and their device's
discovery — but they never strand. Combined with Defense 4's
recovery surface (which only fires on actual error states, not on
"still waiting"), this closes Goal #6's coverage gap.

## Recovery UX shape

Single component, used in two places. Inputs:

- `matchId`
- `userTeamId` (needed for the Back-to-Schedule destination,
  matching today's `MatchLineup.tsx:1253` pattern)
- The reason for the failure (loading too long, RPC error, missing
  data after fresh fetch, etc.) — drives the headline message
- The recovery actions available (always: Try Again, Back to
  Schedule; sometimes: Back to Lineup, when on the scoring page)

**Render structure**: the route guard (Defense 1) renders fullscreen
during the initial match-status load — no other UI shows behind it.
Once resolved, if the status is `'scheduled'` the lineup UI renders
beneath; if `'in_progress'` the scoring UI renders beneath; otherwise
the recovery surface renders fullscreen on a blank background. The
recovery surface is **not** an overlay on top of active scoring or
lineup UI. (Today's overlay-on-lineup-page pattern in
`src/player/MatchLineup.tsx:1239-1260` is replaced by the route
guard's fullscreen treatment.)

Visual style: matches the existing Path C "Match Preparation Failed"
card so users with muscle memory still recognize it. Headline copy
is reason-aware ("Match setup didn't complete," "Lost connection
mid-setup," etc.) but the affordances are constant.

The component does not contain its own retry loop. It is purely a
view layer over the route guard's deterministic state. Detailed copy
mapping (reason → headline → body) and in-flight Try Again states
(button label, disabled, internal spinner) are deferred to planning;
this brainstorm intentionally underspecifies them to keep scope
focused on architecture.

## Success Criteria

- **No "Match Preparation Failed" surface during normal flow.**
  Test: 50 consecutive lineup-lock-and-transition cycles across
  representative configs (BCA 3v3, BCA 5v5%, Fargo 10-7 points,
  Fargo games). No user-visible failure surface fires. Spinner
  states are acceptable.
- **In-app recovery matches reload behavior.** Test: simulate the
  scenarios that historically hit Path C (network blip during
  prep_match, opposing captain wins the prep race). Click "Try
  Again." Outcome must equal the outcome of `window.location.reload()`
  in the same scenario.
- **Cross-match navigation is clean.** Test: open match A, close,
  open match B. Match B's view never displays match A's data. The
  LIST_FOR_ED #19 reproducer no longer reproduces.
- **Fargo confirmation survives prep_match.** Test: complete a Fargo
  start-points negotiation, run prep_match, navigate back to
  lineup. The lineup page does NOT re-prompt confirmation. (Closes
  bug #22.)
- **Multi-device captain race resolves cleanly.** Test: with three
  authenticated captain devices on the same match, race lineup-lock
  + prep across devices. The slowest device discovers prep
  succeeded and follows to scoring within ~10 seconds even if its
  realtime channel missed the prep notification (Defense 7 polling
  catches this). No device strands on Path B. (Closes bug #21.)
- **Realtime-drop self-healing.** Test: simulate a websocket
  disconnect on the away device between the home device's
  `prep_match` write and the away device's next mount. Within ~10
  seconds, Defense 7's foreground poll re-reads `status`, the route
  guard sees `'in_progress'`, and the away device navigates to
  scoring without manual user action.
- **No `team_format` dependency in new code.** Inherited test from
  prior brainstorm — grep new code for `team_format`, `'5_man'`,
  `'8_man'`.
- **The 10-retry loop is removed, not tuned.** Test: grep
  `src/player/ScoreMatch.tsx` for `MAX_RETRIES`, `retryCount`,
  `setTimeout(.*1000)` polling — gone.
- **`staleTime` and invalidation key audits pass.** Test: every
  `invalidateQueries` call in match-scoped hooks references a key
  shape that exists in `queryKeys.matches.*`. Every match-state
  query uses `STALE_TIME.MATCH_LIVE` or `staleTime: 0`.

## Open Questions for Planning

1. **Confirmation column shape.** Boolean flag, captain
   `system_player_number`, or timestamp + captain identifier?
   Recommend captain `system_player_number` to match current "I
   confirmed" semantics with no migration of intent. Planning picks.
2. **Where the `key` prop lives.** At the route level
   (`src/navigation/NavRoutes.tsx` wrapping `/match/:matchId/*`) or
   at the page-component level (`MatchLineup`, `ScoreMatch`
   individually). Recommend route level — single edit, full coverage,
   matches React Router idiom. Planning verifies.
3. **Branch base.** This branch is currently off `main`, but PR #99
   (`feature/unified-scoreboard`) is the source of the bug-#22 root
   cause (`prep_match` cleanup of `*_to_lose`). Recommend rebasing
   this branch off `feature/unified-scoreboard` once #99 merges, or
   merging both branches in a coordinated sequence. Planning picks
   the merge strategy.
4. **`staleTime` change scope.** ~~Originally an open question.~~
   **Resolved during document review.** Codebase audit confirms all
   five consumers of `useMatchWithLeagueSettings` are match-scoped
   single-record reads: `src/player/MatchLineup.tsx:83`,
   `src/hooks/useMatchScoring.ts:56`,
   `src/components/scoring/MatchEndVerification.tsx:105`,
   `src/hooks/useSpectateMatch.ts:39`, and `src/player/ScoreMatch.tsx`
   (via `useMatchScoring`). No schedule-list view shares this query
   key (lists use `queryKeys.matches.season(...)` /
   `queryKeys.matches.team(...)` shapes). Switching to
   `STALE_TIME.MATCH_LIVE` is safe across all consumers — no split
   needed.
5. **Realtime invalidation keys.** Defense 5.2 requires picking the
   exact query keys to invalidate from the realtime channel.
   Planning enumerates each table's affected queries and writes the
   invalidation map.
6. **Recovery surface naming.** The component's filename and
   component name are open. Suggest `MatchTransitionFallback.tsx`
   or similar. Planning picks.
7. **What does "Try Again" do for the home team specifically?**
   `prep_match` is *partially* idempotent: status only flips from
   `'scheduled'` (`CASE WHEN status = 'scheduled'` in the RPC), and
   game inserts use `ON CONFLICT (match_id, game_number) DO NOTHING`.
   But threshold writes are unguarded — a second call rewrites them,
   potentially with different values if `matchData` differs between
   calling devices. Recommend Try Again logic: re-fetch first; if
   `status='in_progress'`, navigate to scoring; if still
   `'scheduled'`, re-run `prep_match`. Related question planning must
   resolve at the same time: should `prep_match` itself be hardened
   to guard *all* writes (not just status) with `WHERE
   status='scheduled'` so a second call is fully a no-op? Recommend
   yes; this also resolves the multi-device threshold race
   (surfaced separately for user judgment).

## Adjacent / Future Work (not in this branch)

- **Score-entry modal calculator-from-snapshot fallback** (LIST_FOR_ED
  #23). Same lazy-snapshot family; separate branch.
- **`started_at` rename / cleanup.** It currently means "lineups
  locked" in `useLineupPersistence` and "match prepped" in some
  scoring code. Future cleanup brainstorm.
- **Operator-set lineup-lock deadline / auto-forfeit.** Inherited
  from prior brainstorm; still future work.
- **Generalizing the route-guard pattern to spectate views.** The
  spectate flow uses card-per-match rendering inside list pages
  (`SpectateMatchCard`) and doesn't fit the "outermost child of
  route" guard pattern. A follow-up generalizes the guard to wrap
  each card or pushes spectate into its own match-scoped route.
- **Telemetry for cache-key correctness.** A development-only
  assertion (or runtime warning) when `invalidateQueries` is
  called with a key that has no entries in the cache, to catch
  future drift before it becomes a 6-month-old retry loop.
