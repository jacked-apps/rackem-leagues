---
title: Lineup Swap with Match Recalibration
date: 2026-06-02
status: Requirements — ready for planning
scope: Allow a captain to swap a player out of the lineup mid-match for any
  player who has not yet had a game outcome recorded. Opponent approves.
  Approved swap cascades through unplayed games, re-runs the same SystemModule-
  dispatched recalibration that `prep_match` runs (handicaps → thresholds →
  Fargo start-points where applicable), then re-tallies the match's running
  totals so already-confirmed games are scored against the new bands.
not_in_scope: Operator-forced swap (no captain available). Re-opening Fargo
  start-points negotiation (use existing confirmed value, or recompute it
  silently — see Open Question 1). Visual redesign of the existing swap
  modals. Email/push notifications. Mobile-specific UX.
supersedes: Partially supersedes the December 2025 swap implementation. The
  DB schema (`supabase/migrations/20251211000000_add_lineup_change_request.sql`)
  and the modal components (`src/components/scoring/LineupChangeModal.tsx`,
  `LineupChangeRequestModal.tsx`) ship as-is. The mutations
  (`src/api/mutations/matchLineups.ts:376,516,634`) get a full rework to
  satisfy the recalibration contract and remove a modularity leak.
---

# Lineup Swap with Match Recalibration

## Problem

A captain whose player can't continue (food poisoning, no-show, family
emergency) needs to substitute another roster member into that lineup slot
without aborting the match. Today the only way to change a lineup after
`matches.status='in_progress'` is the operator-reset path — which doesn't
exist either.

A swap mechanism shipped in December 2025 with the right shape (request →
opponent approval → cascade) but three problems against today's system:

1. **The recalibration is incomplete.** `recalculateMatchThresholds`
   (`src/api/mutations/matchLineups.ts:424`) rewrites
   `*_to_win/tie/lose` but never calls `updateMatchRunningTotals`. Every
   other mutation in the app (score, vacate, confirm — see
   `useMatchScoringMutations.ts:254,329,484` and
   `useMatchPreparation.ts:379`) follows the same "after any change,
   re-derive match totals from the full game set" pattern. The swap
   mutation is the one exception, leaving `home_games_won`,
   `home_points_earned`, etc. stale against the new thresholds.

2. **The threshold recalc itself leaks system-specific logic into
   operation-level code.** `matchLineups.ts:458-460` detects handicap type
   by inspecting whether `player4_handicap` is populated and inferring
   `'percentage'` vs `'points'`. That's a heuristic that bypasses
   `handicap_type` in league prefs and bypasses SystemModule dispatch.
   It works for current configurations but breaks the modularity contract
   the rest of the app holds: operations are generic, system-specific math
   lives inside SystemModule.

3. **Fargo start-points are not part of the recalc.** `prep_match`'s
   threshold pipeline (`useMatchPreparation.ts:216-302`) dispatches by
   handicap system and, for Fargo, sources start-points from the confirmed
   `home_to_tie`/`away_to_tie` columns. A swap that changes a player's
   handicap can shift the Fargo start-points calculation, but the existing
   recalc never reconsiders them — a gap that's hidden today because the
   swap feature isn't actually surfaced to users in the version of the app
   that has Fargo support.

These together mean the existing swap code is partially functional, not
broken catastrophically — but it's not safe to leave in place once any
operator-handicap-league captain actually uses it.

## Strategic Identity

This is a **correctness + modularity fix** with a small surface of new UX,
not a greenfield feature. The trigger UX, the modals, and the schema are
already shipped. What changes: the mutation pipeline becomes a single
"recalibrate this match" operation that is fully system-agnostic at the
operation level, calls into SystemModule for every system-specific
decision, and finishes by re-running the same `updateMatchRunningTotals`
machinery every other mutation already uses.

## Architectural Principles

### Principle 1 — Operations are system-agnostic; SystemModule dispatches

A match-level operation (swap, prep, recalc, vacate, restart) must NOT
branch on `handicap_type`, `points_calculator`, or any other system
identity. The operation says "a thing changed, re-run the numbers"; the
modular system handles the math. Any operation-level branch keyed on
system identity is a leak to be fixed, not a pattern to extend.

This is the principle the existing `recalculateMatchThresholds` violates
(see Problem #2) and the principle the new recalibration operation must
hold.

### Principle 2 — Match totals are always re-derived, never accumulated

`updateMatchRunningTotals` (`src/api/queries/matches.ts:869`) reads the
full set of confirmed games and recomputes `home_games_won`,
`home_points_earned`, etc. from scratch. Every state-changing mutation
in the app calls it. The swap operation must follow the same pattern.
This is why vacates re-assess cleanly and why the swap operation does not
need a special "freeze old games" path — re-derivation from the new
thresholds against the existing confirmed games produces the correct
totals automatically.

### Principle 3 — Player swaps preserve the unplayed; never touch the played

A swap is allowed only when the outgoing player has no `match_games` row
with `winner_player_id IS NOT NULL` recorded against them. The cascade
re-assigns the outgoing player's `player_id` only on rows where the swap
is provably safe. Already-played games (won OR lost) keep the original
player_id forever.

## Goals

1. **Captain-initiated swap of an unplayed player.** Any captain can swap
   any of their own lineup positions for any roster member who is not
   currently in the lineup, provided the outgoing player has no completed
   games (wins or losses) in this match.

2. **Opponent approval, universal across systems.** The opposing captain
   sees the request with old player → new player visualization, approves
   or denies. Same flow for every handicap system (Fargo, points,
   percentage, none). No per-system branches at the operation level.

3. **Full recalibration on approve.** The approved swap re-runs the same
   SystemModule-dispatched calculations `prep_match` runs: lineup
   handicap totals → thresholds → Fargo start-points where applicable.
   Then `updateMatchRunningTotals` re-derives match totals from the new
   thresholds against the existing confirmed games.

4. **Player cascade into unplayed games.** Every `match_games` row where
   the outgoing player is assigned and no winner is recorded gets the
   new player's UUID. Already-played games are untouched.

5. **Audit trail.** Who requested, who approved, and when — preserved on
   the lineup row so disputes have a record.

6. **Initiator visibility.** The captain who initiated the swap sees a
   visible "waiting for opponent" state until the opponent acts. On deny,
   they see "declined." On approve, the scoreboard updates via realtime
   like any other state change.

7. **Modularity leak fixed.** `recalculateMatchThresholds`'s
   handicap-type heuristic is replaced with proper SystemModule dispatch.
   No operation-level code branches on system identity.

## Non-Goals

- **Operator-forced swap.** A separate future feature for the
  "no captain present" case. This brainstorm assumes both captains are
  available and online.
- **Re-opening Fargo start-points negotiation.** Captains do not
  re-negotiate after a swap; the recalibration handles start-points
  silently (see Open Question 1 for the exact policy).
- **Visual redesign of the swap modals.** `LineupChangeModal` and
  `LineupChangeRequestModal` ship as-is.
- **Multiple concurrent swaps.** One pending swap per lineup at a time
  is preserved from the current schema.
- **Cross-match swap history.** No view aggregating "all swaps in this
  league this season." The audit columns exist on the lineup row only.
- **Cancelling a pending swap (initiator side).** If the initiator
  changes their mind before the opponent responds, they wait it out or
  the opponent denies. Adding a cancel button is a polish item, not a
  correctness one.
- **Notifications via email/push.** Realtime within the open app only.

## Target Users

- **Primary:** League captains, mid-match, who need to substitute a
  player and don't have an operator on hand. Today they have no path —
  either play short or restart the match.
- **Secondary:** Operators who currently get pinged to manually edit
  game rows in the DB. This feature removes that ask from their plate.

## The Recalibration Operation

A single new function, `recalibrateMatchAfterSwap(matchId)`, replaces
the current `recalculateMatchThresholds`. It runs server-side or
client-side (planning picks; recommend server-side as a single RPC for
atomicity — see Open Question 3) and is invoked only after
`approveLineupChange` writes the new `player_id` and `player_handicap`
to the lineup row.

The operation:

1. **Reads both lineups fresh** — `match_lineups` rows for home and away,
   including all `player{N}_id` and `player{N}_handicap` columns.
2. **Reads league prefs fresh** — `handicap_type`, `lineup_size`,
   `points_calculator`, anything else the prep pipeline keys on.
3. **Dispatches threshold + start-points math through SystemModule** — the
   same dispatch path `prep_match` uses (see
   `src/hooks/lineup/useMatchPreparation.ts:216-302`). No branch on
   `handicap_type` at the operation level; the dispatch lives inside
   SystemModule. For Fargo specifically, the start-points recalc reads
   the same operation (`fargo-start-points-for-side.ts`) used at prep.
4. **Writes `home_to_win/tie/lose`, `away_to_win/tie/lose`, and (for
   Fargo) `home_to_tie`/`away_to_tie`** to the matches row in a single
   UPDATE.
5. **Calls `updateMatchRunningTotals(matchId)`** — the existing function
   re-derives every match-level total from the new thresholds against
   the existing confirmed games. No special-casing needed.

The operation is idempotent: running it twice in a row against an
unchanged lineup produces no DB change beyond timestamps.

## Player Cascade Contract

Cascade is part of `approveLineupChange`, not part of the recalibration
operation. Order matters:

1. Re-verify the outgoing player has no `match_games` row where they are
   assigned AND `winner_player_id IS NOT NULL`. If any exists, abort with
   a user-facing error ("Player has completed games — swap no longer
   possible"). The check guards against a race where a game completes
   between request and approval.
2. Update the lineup row: write `player{N}_id` and `player{N}_handicap`
   to the new values, clear all `swap_*` columns, write the audit fields
   (see Audit Trail below).
3. Update every `match_games` row where the outgoing player is assigned
   AND `winner_player_id IS NULL`: set the new player's UUID in the
   appropriate `home_player_id` or `away_player_id` column.
4. Call `recalibrateMatchAfterSwap(matchId)`.

Steps 2–4 should be one transaction; planning picks the mechanism (RPC
recommended).

## Trigger UX (already shipped, verify intact)

The trigger is the existing player-name popover in
`src/components/PlayerNameLink.tsx`. The popover already accepts a
`customActions` array, and `src/components/scoring/UnifiedScoreboard.tsx:474-482`
already registers a "Swap Player" action in that slot.

Two issues to verify and address:

1. **Eligibility gate disagreement.** Today's popover shows "Swap Player"
   only when the player has 0 wins AND 0 losses (`UnifiedScoreboard.tsx:472`).
   The server-side approval guard checks for any `match_games` row where
   the player is assigned AND `winner_player_id IS NOT NULL`
   (`matchLineups.ts:552-565`). These need to agree. The server check is
   correct (a loss counts as "played"); the popover gate should match.
2. **The popover is the only entry point.** No other surface (lineup page,
   match detail page) exposes swap. That's intentional for this branch.

## Audit Trail

Add two columns to `match_lineups`:

- `swap_requested_by_member_id UUID REFERENCES members(id)` — written by
  `requestLineupChange`, cleared by `approveLineupChange` /
  `denyLineupChange`.
- `swap_last_resolution JSONB` — written by `approveLineupChange` /
  `denyLineupChange` with `{kind: 'approved' | 'denied',
  by_member_id, resolved_at, position, old_player_id, new_player_id}`.
  Overwritten on each subsequent swap; not a history log.

The JSONB shape is intentionally narrow — this is dispute resolution
support, not analytics. A future "swap history" view would be a separate
table or an event-log pattern; out of scope here.

## Initiator-Side UX

Today the initiator's modal closes the moment the request is sent
(`ScoreMatch.tsx:173`) with no indication anything is in flight. Two
small additions:

1. **"Waiting for opponent" banner** at the top of the scoreboard while
   `userLineup.swap_position` is non-null. Mirrors the existing
   "Confirm score" banner pattern.
2. **Toast on resolution.** When realtime fires on the lineup row and
   `swap_position` goes from non-null to null, the initiator's client
   reads `swap_last_resolution.kind` and shows either a success toast
   ("Lineup change approved by {opponent}") or a denial toast
   ("{opponent} declined the lineup change"). No modal, no blocker.

## Success Criteria

- **Universal swap across systems.** Test: complete a swap-and-approve
  cycle in matches using each of `handicap_type` ∈ `{points, percentage,
  fargo, none}`. Each one updates lineup, cascades unplayed games,
  re-runs thresholds, and re-derives match totals. No code path branches
  on `handicap_type` outside SystemModule.
- **Already-played games preserved.** Test: play 3 games, swap a player
  who has played at least one. Server rejects with the "completed games"
  error. Test: play 3 games where player X won/lost, then swap player Y
  (in a different position). The 3 played games keep their original
  player IDs and outcomes.
- **Match totals re-derive correctly.** Test: in a points-handicap
  match, play 5 games of a 21-game schedule, swap a player whose new
  handicap shifts the team's threshold band by 1. After approval,
  `home_games_won`/`home_points_earned` reflect the new band against the
  same 5 games. No double-counting, no stale values.
- **Fargo start-points respond.** Test: in a Fargo match, swap in a
  significantly higher- or lower-rated player. The recalibration writes
  a new `home_to_tie`/`away_to_tie` value consistent with the new
  lineup's ratings. (See Open Question 1 for whether captains see this
  change in any UI.)
- **Modularity audit passes.** Test: grep `matchLineups.ts` and any new
  recalibration code for `'fargo'`, `'points'`, `'percentage'`,
  `'none'`, `player4_handicap`, `team_format`. No hits in
  operation-level code. All system-specific dispatch lives in
  `src/systems/`.
- **Audit columns populate.** Test: complete an approve cycle and a
  deny cycle. `swap_last_resolution` reads correctly in both; the
  member IDs match the acting captains.
- **Initiator sees state.** Test: initiate a swap. Banner appears on
  initiator's scoreboard. Opponent approves. Initiator sees the success
  toast and the banner clears. Repeat with deny.
- **Eligibility gates agree.** Test: a player with 0 wins but 1 loss —
  the popover does NOT offer "Swap Player." (Today's gate would offer
  it incorrectly.) The server guard rejects if it slips through.
- **Idempotent recalibration.** Test: run the recalibration operation
  twice against an unchanged lineup. Second run is a no-op against the
  matches row.

## Open Questions for Planning

1. **Fargo start-points policy after swap.** Two viable shapes:
   (a) silently recompute the proposed `*_to_tie` value from the new
   lineup ratings and write it without re-opening negotiation —
   captains see a one-time toast "Start-points recalibrated";
   (b) recompute, write, AND mark both confirmation flags cleared so
   captains have to re-confirm before the next game can be scored.
   Option (a) is consistent with "swap is approved by opponent, so the
   downstream math doesn't need re-confirming." Option (b) is safer for
   captains who care about the exact start-points value. Recommend (a);
   the opponent's swap approval is the consent point.
2. **Drop or keep the existing `swap_*` columns?** The schema from the
   Dec 2025 migration is sufficient with the addition of the audit
   columns. Recommend keeping and extending. Planning verifies no rename
   churn is needed.
3. **Server RPC or client-side orchestration?** The cascade + recalibrate
   + re-tally chain wants atomicity. Recommend a single
   `swap_player_in_lineup` RPC mirroring `prep_match`. Planning picks
   the mechanism and confirms transaction boundaries.
4. **Popover gate change scope.** Fixing the 0W/0L → "no completed
   games" disagreement requires either reading match_games from the
   scoreboard component (the player popover doesn't have it today) or
   plumbing a computed flag down from the parent. Planning picks.
5. **Does the approval modal show projected new thresholds?** Today's
   `LineupChangeRequestModal` shows old player → new player only. A
   "this will change your team's games-to-win from X to Y" line might
   help the opponent decide informedly, but adds computation at modal
   render time. Recommend deferring to a follow-up unless planning sees
   a cheap path.

## Adjacent / Future Work (not in this branch)

- **Operator-forced swap** — no-captain-present case. Separate feature.
- **Swap history view** — per-match or per-season list of completed
  swaps. Requires moving from JSONB-on-lineup-row to a proper
  event/audit table.
- **Cancelling a pending swap from the initiator side** — polish, not
  correctness.
- **In-app notifications for swap approval/denial when the captain
  isn't actively on the scoring page** — current scope assumes the
  realtime channel is open.
- **Fargo start-points re-negotiation flow** — if Open Question 1
  lands on Option (a) and operators later complain that silent
  recompute is too opaque, the re-negotiation path becomes its own
  brainstorm.
