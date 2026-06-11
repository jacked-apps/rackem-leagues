---
title: Lineup Race-Condition Fix (Match Preparation Gating)
date: 2026-04-24
status: Requirements — ready for planning
scope: Fix only. Mobile/UX polish and visual refresh are separate brainstorms.
---

# Lineup Race-Condition Fix (Match Preparation Gating)

## Problem

On the lineup entry page (`src/player/MatchLineup.tsx`), match preparation —
computing handicap thresholds, inserting all game rows into `match_games`,
and auto-navigating both clients to the scoring page — fires too eagerly.
Live testing on `main` surfaced two failure modes:

1. **Games are created with substitute placeholder UUIDs.** When a captain
   locks their lineup with `SUB_HOME_ID` / `SUB_AWAY_ID` in a slot, the
   opposing captain is still mid-`OpponentSubstituteModal` choosing which
   of the four real players plays double duty. But `useMatchPreparation`
   sees both lineups locked and runs immediately, inserting game rows whose
   `home_player_id` or `away_player_id` is the placeholder UUID. When the
   opponent finishes the modal, their update patches the *lineups* row but
   the already-inserted *game* rows still reference the placeholder. Those
   rows show as "Unknown" downstream in scoring.

2. **Away team navigates before games exist.** `useMatchPreparation.ts` has
   the away-team branch literally do `await new Promise(resolve =>
   setTimeout(resolve, 2000))` and then navigate. If the home client is
   slow (network, threshold math, or Fargo negotiation just finished), the
   away client arrives on `/match/:matchId/score` before the rows exist.

The Fargo start-points negotiation shipped in PR #72 already solves a
related problem via `fargoNegotiationBlocking` in `useMatchPreparation` —
match prep is fully skipped while Fargo is unconfirmed. The fix in this
document generalizes that pattern to cover substitutes and game-row
visibility, instead of adding more ad-hoc flags.

## Strategic Identity

This is a **correctness fix**, not a feature. Success = no more "Unknown"
player rows in `match_games` and no more premature navigation. The shape
of the fix is chosen to slot into the existing `useMatchPreparation`
contract with minimal new surface area.

## Architectural Principle: Preferences Drive Behavior

A cross-cutting rule this doc inherits and enforces: **new code in the
lineup flow must key off `handicap_type`, `lineup_size`, and
`roster_size` from resolved preferences, not off the legacy
`team_format` values (`5_man` / `8_man`).**

The app was originally linear — two hard-coded formats (3v3 +
percentage, 5v5 + BCA). Adding Fargo pushed us toward a modular system
where every format, handicap system, and sub type must compose freely.
`team_format` as a discriminator bakes the old shape into new logic and
must be considered deprecated for new reads. Existing touches are
grandfathered until touched; NO new logic in this fix may branch on
`team_format`, `5_man`, or `8_man`.

The gates below therefore compose from format-agnostic predicates
only.

## Goals

1. **Match preparation never runs against an incomplete lineup.** The
   test is lineup completeness (right number of entries per
   `lineup_size`, a handicap for every slot, any double-duty slot
   resolved by the opposing captain). Invariant across every
   combination of format, handicap system, and sub type — driven by
   preferences (`handicap_type`, `lineup_size`), not by `team_format`
   sentinels.
2. **Away team never navigates before game rows exist.** Navigation is
   driven by the realtime `match_games` channel, not by a blind timeout.
3. **Idempotent re-entry.** Browser-back or page remount after a
   successful match prep never re-runs threshold writes or game inserts.
4. **The preparation overlay is dismissible.** A user waiting on opponent
   action can back out to the schedule without killing the app.
5. **Every waiting state is visible.** If progress is blocked on
   opponent action, the UI names what we're waiting on — no silent
   spinners, no dead screens.
6. **At most one substitute per lineup.** Anonymous OR double-duty
   (not both, not two of either). The lock button is disabled until
   this holds.

## Non-Goals

- **Stuck-state automation.** No auto-pick of opponent's double-duty
  player, no timeout forfeit, no "pick for the opponent" button. Teams are
  co-located on league night; in-person resolution is the assumed norm.
- **Operator-set lineup deadlines / auto-forfeit.** A future feature the
  user wants ("operator sets a start time, auto-lock or forfeit at X
  minutes after") is explicitly deferred to its own brainstorm.
- **Mobile visibility, nickname tooltips, density, idiot-proof UX, and
  visual polish.** All scoped out to a follow-up brainstorm.
- **Changes to the Fargo negotiation card's visual design or interaction
  model.** The existing `FargoStartPointsCard` +
  `useFargoStartPointsNegotiation` internals (labels, buttons, edit/
  confirm flow, copy) are kept intact. We DO change the card's activation
  condition — it must wait for Step 1 (lineup completeness) to pass on
  BOTH sides before rendering. Visibility timing is in scope; visual
  redesign is not.
- **Redesigning `OpponentSubstituteModal`.** Functionality is correct; we
  only change what it gates.

## Target Users

- **Primary:** Active-league captains on mobile, mid-match-night, who
  currently hit "Unknown" players in their scored games and have to ask
  the operator to clean up data.
- **Secondary:** Non-tech-savvy / elderly players who need the "something
  is happening, and I can back out if it feels stuck" affordance on the
  preparation overlay.

## The Readiness Checklist

A single sequential flow. Each step must pass before the next runs.
Failures surface as explicit waiting states, not silent hangs — the
captain always knows what is holding things up.

The underlying principle: **match preparation doesn't care what kind of
handicap system or what kind of substitute is in play. It cares whether
the lineup data is complete enough to compute thresholds and create
games.** Anonymous vs double-duty, Fargo vs BCA, 3v3 vs 5v5 — all
collapse into "is this lineup complete for the match it represents?"

### Step 1 — Lineup completeness (each team independently)

For each lineup, ALL must be true:

- **Slot count matches `lineup_size`** from resolved preferences (not
  `team_format`).
- **Every slot has a player selection.** Real roster member, anonymous-
  sub placeholder, or a resolved double-duty real-member UUID.
- **Every slot has a handicap value.** No null / not-yet-entered.
- **Anonymous sub slots are complete at entry time.** The captain who
  chose the sub provides the handicap at the same moment. No opposing-
  captain action is required.
- **Double-duty sub slots are complete only once the opposing captain
  resolves them.** Resolution means the placeholder UUID has been
  replaced with a real player UUID and that player's handicap, via
  `OpponentSubstituteModal`'s mutation.

**At most one substitute slot per match.** The UI must prevent a
captain from locking a lineup that contains more than one placeholder
(either anonymous or double-duty). If the captain picks a second sub
in a second slot, the UI blocks lock with a validation message.

**Format and handicap-system invariance.** Both sub types are valid in
any format (3v3, 5v5, any future size) and under any handicap system
(Fargo, points, percentage, none). Step 1's test does not branch on
`team_format` or on the handicap system — it only asks "for each
slot in this lineup of size `lineup_size`, is this slot resolved?"

### Mechanism for distinguishing sub types

The test "is this slot resolved?" must answer correctly from persisted
state that BOTH clients can read (the originating captain's client,
after refresh; the opposing captain's client, at any time). Planning
picks the mechanism; acceptable options include:

- Encoding the type in the placeholder sentinel UUID itself (e.g., a
  separate "double-duty sentinel" distinct from the existing
  anonymous-sub sentinels), so `player{N}_id` alone is self-describing
- Adding a single `substitute_slot` + `substitute_type` pair of
  columns on `match_lineups` (since there is at most one sub per
  lineup)
- A handicap-sentinel convention (e.g., null = unresolved double-duty,
  any number = resolved/anonymous) — only acceptable if DB defaults
  and captain-entry UI together guarantee the sentinel holds

The requirement: whichever mechanism planning picks must be visible
from the persisted lineup row, not from React component state, and
must NOT rely on `team_format`.

### Step 2 — Handicap-system agreement

Match branches on `handicap_type`:

- **`fargo`** — Both captains must confirm `fargo_start_points` via
  the existing `FargoStartPointsCard` +
  `useFargoStartPointsNegotiation` flow. No changes to that flow
  other than its activation condition: the card renders only after
  Step 1 passes for BOTH lineups.
- **All other systems** (`points`, `percentage`, `none`): no
  cross-team agreement. Step 2 is implicitly complete the moment
  Step 1 passes for both sides; there is no separate check. Thresholds
  are computed unilaterally by the home team in Step 3.

### Step 3 — Threshold calculation and game creation (home team only)

Home team only. Executed in this order:

1. **Idempotency short-circuit (runs first, before anything else).**
   If `match_games` already contains rows for this match where
   `length === expectedGameCount`, skip all writes — including the
   Step 1/2 prerequisite check — and go straight to Step 4. Handles
   browser-back and page remount after a successful earlier run.
2. **Partial-insert repair (before Steps 1/2 verify).** If
   `match_games` has rows for this match but `length <
   expectedGameCount`, a prior attempt crashed mid-insert. Proceed to
   Step 1/2 verify and threshold/insert path; the insert must be
   idempotent (see below) so it safely fills the missing rows without
   duplicating. Thresholds may be re-written (re-computation from the
   same inputs is deterministic; Fargo re-reads the already-agreed
   `fargo_start_points`).
3. **Verify Steps 1 and 2 have passed.** Re-read fresh lineup state
   via `refetchLineups()` and, for Fargo, the match row. If either
   step fails, abort.
4. **Compute thresholds and write.**
- Compute thresholds per the league's handicap system.
- Write thresholds to the matches row.
- Insert all game rows into `match_games` with
  `ON CONFLICT (match_id, game_number) DO NOTHING` (requires a
  `UNIQUE(match_id, game_number)` constraint on the table — planning
  confirms or adds this). This makes partial-then-retry idempotent
  and removes the fragile `gamesError.message.includes('duplicate
  key')` swallow in the current code.
- `expectedGameCount = generateGameOrder(lineupSize,
  leaguePrefs.game_generation === 'double_round_robin').length`
  where `lineupSize` comes from resolved preferences, not
  `team_format`.
- **Pre-insert verification.** Reconstruct game rows from the FRESH
  lineup data from `refetchLineups()`, not stale component props. If
  any row would carry a placeholder UUID in `home_player_id` or
  `away_player_id`, abort and emit a monitoring log (not a user-facing
  toast). Step 1 should prevent this; a placeholder escape is a
  regression signal, not a user action to take.

### Step 4 — Navigation

- **Home team** — navigates immediately after its own insert completes
  (or after idempotency check passes in the re-entry case).
- **Away team** — waits until `matchGamesQuery.data?.length ===
  expectedGameCount` via the existing `useMatchRealtime` channel.
  Fallback timeout (≥10s) surfaces a toast with a Retry action. Retry
  calls `matchGamesQuery.refetch()` and resets the timer. After N
  retries (planning picks N; suggest 3), surface a persistent error
  and dismiss the overlay so the captain can back out. Never navigate
  speculatively.

### Correction on Gate 1 from an earlier draft

An earlier version of this doc described a "Gate 1: bothLineupsLocked"
that unlocked `OpponentSubstituteModal`. That was wrong — the modal
opens as soon as `opponentLineup.locked && opponentHasPlaceholder`,
regardless of my own lineup's lock state. The modal trigger is not a
gate in this flow.

## Implementation Shape

Planning fills in the details; these are the chosen shapes.

1. **`canPrepareMatch` composed in the caller, with a named reason.**
   `MatchLineup.tsx` computes a discriminated value, not a bare boolean,
   so observability survives:

   ```
   type PrepBlockedReason =
     | { kind: 'lineup_incomplete'; team: 'home' | 'away'; detail: string }
     | { kind: 'waiting_on_sub_resolution'; awaitingTeam: 'home' | 'away' }
     | { kind: 'fargo_pending'; myConfirmed: boolean; oppConfirmed: boolean }
     | null // null = ready to prepare
   ```

   `useMatchPreparation` accepts this as `blockedReason`; any non-null
   value short-circuits the effect (replaces `fargoNegotiationBlocking`).
   The UI surfaces the reason in the overlay and waiting banners; logs
   include it for prod debugging.

   **Precedence when multiple variants could apply.** Use a single pure
   function `computePrepBlockedReason(...)` that returns the highest-
   priority variant in this fixed order: `lineup_incomplete` >
   `waiting_on_sub_resolution` > `fargo_pending` > `null`. Rationale:
   completeness is upstream of negotiation; negotiation can't happen on
   an incomplete lineup. The "Waiting states on the lineup page" table
   below is the authoritative list of user-visible messaging derived
   from this reason; lifecycle events such as away-team retry
   exhaustion live in Step 4 and do NOT flow through `blockedReason`.

2. **Realtime-driven away-team navigation.** Replace the blind
   `setTimeout(2000)` in the away-team branch of
   `useMatchPreparation.ts` with a wait on `matchGamesQuery.data?.length
   === expectedGameCount`. `useMatchRealtime` already subscribes to
   `match_games`; rely on that channel. Expected count derived per
   Step 3 above. Fallback policy: 10s without the condition → toast
   with Retry that calls `matchGamesQuery.refetch()` and resets the
   timer; after 3 retries surface a persistent error and dismiss the
   overlay.

3. **Pre-insert placeholder guard (home team), reading fresh data.**
   Before `supabase.from('match_games').insert(gameRows)`, read the
   lineup rows freshly via `refetchLineups()` and rebuild `gameRows`
   from that fresh data. Assert no placeholder UUID appears in
   `home_player_id` or `away_player_id`. Violation → abort insert and
   emit a monitoring log with `matchId`, which captain's lineup had
   the placeholder, and which slot. Step 1 should prevent this path;
   the guard is defense against a future regression, not a normal
   code path, so no user-facing toast is required.

4. **Dismissible preparation overlay.** Add a "Back to Schedule"
   button inside the overlay. Clicking Back calls
   `setIsPreparingMatch(false)` synchronously then immediately
   `navigate(\`/team/${userTeamId}/schedule\`)` in the same handler —
   one frame transition, no flash of the underlying lineup page. The
   component unmounts, resetting `matchPreparedRef`. DB state persists.
   Returning to the match resumes from whichever step is next
   incomplete per the readiness checklist.

5. **Step 1 is a new pure function over persisted lineup rows.** Do
   NOT reuse `useLineupValidation` — its existing `hasSub` check only
   scans slots 1–3 and its semantics are scoped to the lock-button
   gate, not match-prep gating. The new function reads the lineup row
   directly from React Query data, iterates slots 1..`lineup_size`
   (from resolved prefs), and returns a `Step1Status = 'complete' |
   { incomplete: [list of slot-level reasons] }`. Two callers use it:
   `MatchLineup.tsx` for computing `blockedReason`, and the Fargo
   hook's new Step-1-aware input (see below).

6. **Fargo hook's readiness input upgraded.**
   `useFargoStartPointsNegotiation` currently takes
   `bothLineupsLocked` (just the locked flags). Rename the input
   semantically (and add to the hook signature) to
   `bothLineupsReady = bothLineupsLocked && step1CompleteBothSides`.
   The hook's internal `applicable`, initial-write effect, and status
   derivation all key off the new input. Without this, the home
   client's initial `fargo_start_points` write can fire against ratings
   that still include placeholder slots.

## Waiting states on the lineup page

Every incomplete step must have a named, visible waiting state. No step
is allowed to produce a silent spinner.

| Blocking condition                                      | UI the captain sees                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| My lineup incomplete (count, missing handicap, etc.)    | Inline field-level messaging in the roster (existing behavior); no overlay.                                                                                                                                                                                                                              |
| My locked lineup has a double-duty placeholder          | Non-blocking banner: "Waiting for {opponentCaptainName} to pick your substitute." Unlock-lineup button remains (pre-prep only).                                                                                                                                                                          |
| Opponent's locked lineup has a double-duty placeholder  | `OpponentSubstituteModal` opens (existing behavior). If I dismiss the modal (Cancel), a persistent banner remains: "{opponentTeamName} needs a double-duty player." The banner has a trailing button labeled "Choose" that re-opens the modal.                                                           |
| Both sides have double-duty placeholders simultaneously | Each captain sees both: banner for their own unresolved slot, modal for the opponent's. Modal takes priority if both are unresolved from my side. If the opposing captain resolves their side mid-session, the realtime update simply clears the modal/banner for that side; no extra transition needed. |
| Fargo negotiation pending                               | `FargoStartPointsCard` visible (existing). Remains until both-confirmed. Captain who has confirmed sees the card's existing "Waiting for {opponent} to confirm" state (unchanged).                                                                                                                       |
| Home-team preparation running                           | Preparation overlay with spinner, status message ("Setting up the match..."), and Back-to-Schedule button. Unlock is NOT accessible through the overlay — Back is the only escape.                                                                                                                       |
| Away-team waiting on games to appear                    | Preparation overlay same as home; message: "Waiting for match to be set up..." Back-to-Schedule available.                                                                                                                                                                                               |
| Away-team retry exhausted (3 failed refetches)          | Overlay dismisses; persistent toast: "Match setup didn't complete. Contact the opposing captain or try again." Toast stays until manually dismissed (X) or until the captain navigates away; reappears on re-entry if the underlying condition persists.                                                 |
| Re-entry after successful prep (idempotency hit)        | No overlay; captain is redirected to `/match/:matchId/score` directly. Already-prepared matches skip all visible prep UI.                                                                                                                                                                                |

## Lineup-unlock cleanup contract

This contract applies to the **bulk unlock** path
(`useLineupPersistence.handleUnlockLineup`) — the "I want to
renegotiate from scratch" operation. It does NOT apply to future
narrow-scope lineup mutations (see "Forward-looking note" below); those
will be separate operations with their own semantics.

### Pre-prep unlock (no game rows exist yet)

When either lineup transitions from `locked = true` back to
`locked = false` AND `match_games` has no rows for this match, clear
the following as part of the same mutation (single DB transaction if
possible):

- `matches.fargo_start_points` → `null`
- `matches.fargo_start_points_confirmed_by_home` → `null`
- `matches.fargo_start_points_confirmed_by_away` → `null`

Client-side, `useFargoStartPointsNegotiation`'s `initialWriteFiredRef`
must reset when the hook's `bothLineupsLocked` input transitions from
`true` to `false` — add a `useEffect` dependency on that value.
Without the reset, the hook refuses to re-propose a default on the
next lock cycle even though the DB has been cleared. (The variable
`bothLineupsLocked` is kept as a plain derived boolean, not as the
discarded "Gate 1" concept from the earlier draft.)

`OpponentSubstituteModal`'s visibility already reacts to
`opponentLineup.locked`; no additional handling needed there.

### Post-prep bulk unlock (game rows exist)

Bulk unlock is rejected once `match_games` contains rows for the
match. `handleUnlockLineup` short-circuits with a user-facing toast:
"Match already started — ask an operator to reset if you need to
change the lineup." The operator-reset path is out of scope for this
fix.

This rule is scoped to `handleUnlockLineup` only. The DB schema does
NOT enforce it via CHECK / trigger — it's a client-side guard on the
bulk operation. That leaves the door open for future narrow-scope
mutations (next section).

### Forward-looking note: narrow-scope mutations (future feature, not in this fix)

A future feature will allow severely limited lineup changes after
prep — e.g., swapping a single player in one slot when a real player
can no longer play. Those mutations will be distinct operations with
their own flows and cascade logic (e.g., updating the relevant
`match_games` rows to point at the new player, leaving already-scored
games alone). They are explicitly NOT an extension of
`handleUnlockLineup`.

**Constraint on this fix**: do not bake "lineups are immutable once
`match_games` exists" into any shared invariant, DB constraint, or
type-level assumption. The forbid-unlock rule is scoped to the bulk
operation only. Data shape, mutation routes, and Step 3's idempotency
check must remain compatible with future per-slot changes.

The principle: bulk unlock = renegotiate from scratch (pre-prep only).
Targeted mutations = narrow, explicit operations with their own
semantics (out of scope here, but don't preclude them).

## Success Criteria

- **No placeholder UUID in `match_games` via the UI.** Test: lock a
  lineup with a double-duty sub; games are not created until the
  opposing captain resolves the modal.
- **Anonymous subs never block match prep.** Test: lock a 3v3 lineup
  with an anonymous sub (captain-entered handicap, placeholder UUID);
  match prep proceeds once both lineups pass Step 1 and any Fargo
  agreement lands.
- **Both-sides-have-subs scenario progresses.** Test: any format, any
  handicap system, both captains lock with a double-duty placeholder.
  Each captain sees a "waiting for opponent" banner for their own
  unresolved slot and the `OpponentSubstituteModal` for the opponent's.
  Match prep runs once both modals are resolved.
- **At-most-one-sub rule enforced.** Test: captain tries to pick two
  subs (any combination of anonymous and double-duty) in two slots;
  lock button disabled with a validation message.
- **No `team_format` dependency in new code.** Test: grep the diff for
  `team_format`, `'5_man'`, `'8_man'` — any hits in newly-written
  lineup/match-prep code are regressions.
- **Idempotent re-entry.** Test: complete a match prep successfully,
  navigate to scoring, browser-back to the lineup page. No duplicate
  `match_games` inserts, no overwrite of `home_games_to_win`. Captain
  is re-navigated forward (or sees a benign state).
- **Away team arrives only when rows exist.** Test: throttle the home
  client; away client waits on the realtime channel, then navigates
  cleanly.
- **Fargo card gated on Step 1 both sides.** Test: Fargo 5v5, one side
  locks with a double-duty placeholder; `FargoStartPointsCard` does not
  render until the opponent resolves the sub.
- **Unlock clears Fargo consensus.** Test: both captains confirm Fargo
  start-points; one captain unlocks lineup; both confirm columns clear
  in DB, and the card re-renders from initial-proposal state on re-lock.
- **Back-to-Schedule works mid-prep.** Test: click Back during the
  preparation overlay; lands on the schedule; return to match; flow
  resumes at whichever step is still incomplete. No partial writes.
- **Every waiting state has UI.** Test: each of the blocking rows in
  the "Waiting states" table produces the specified UI without a silent
  spinner.

## Open Questions

1. **Unlock cleanup location.** The doc mandates that pre-prep unlock
   clears `matches.fargo_start_points*` columns. Planning decides
   whether this happens server-side (DB trigger tied to the
   lineups-row UPDATE) or client-side (inside `handleUnlockLineup`).
   Server-side is more robust against clients that skip the mutation;
   client-side is simpler. Recommend DB trigger if migrations are
   cheap.
2. **Retry count N for the away-team fallback.** Suggested 3; planning
   picks a final number based on league-night connectivity
   expectations.
3. **Sub-type discriminator mechanism.** Planning picks one of the
   three options listed under "Mechanism for distinguishing sub types"
   (sentinel-UUID encoding, dedicated columns, or handicap-sentinel
   convention). Constraint: whichever is chosen must work under any
   `lineup_size` and any `handicap_type`, and must be readable from
   the persisted lineup row without referencing `team_format`.
4. **`match_games` unique constraint.** Planning verifies that a
   `UNIQUE(match_id, game_number)` constraint exists on `match_games`
   or adds a migration. Required for the `ON CONFLICT DO NOTHING`
   idempotent insert strategy.

## Adjacent / Future Work (not in this brainstorm)

- Operator-set lineup-lock deadline with auto-forfeit on timeout.
- Mobile visibility and density pass on the lineup page (nicknames
  everywhere, long-press-for-full-name, accordion/drawer for rosters,
  reduced vertical padding, larger text for older users).
- Visual polish pass (color system, micro-animations, card styling).
- Idiot-proof UX pass (progressive disclosure, clearer status language,
  fewer decisions visible at once).
