---
date: 2026-06-03
topic: lo-manual-match-scoring
---

# LO Manual Match Scoring

## Problem Frame

A live match is normally scored by both teams present, each captain confirming
every game on their device. When that can't happen — a power outage forces paper
scoring, a device fails, or a match otherwise gets played without the app — the
results have no way into the system. Today there is no operator path to record a
match after the fact.

This feature gives a **League Operator (LO)** a single page to manually enter a
match's lineups and game results so the app applies **normal scoring** — the same
modular engine, thresholds, points, and winner logic as a live match — as if it
had been played in-app. The LO acts as both confirming parties.

v1 covers **enter-from-blank on a match that was actually played**. It is the
on-ramp to a deliberately broader end-state (see Scope Boundaries): the LO will
eventually take over a match from *any* point — untouched, mid-match, or finished
— and adjust what's already recorded. v1's page shell and data flow should not
foreclose that, with one honest caveat surfaced in review: the live "set up"
primitive (`prep_match`) only acts on `status = 'scheduled'` matches by design, so
taking over an *in-progress/finished* match later will need its own write path.
The "extension, not rewrite" intent therefore applies to the page/UX shell and the
scoring-entry surface — not to the setup primitive itself.

## Requirements

**Setup phase (lineups → match ready)**
- R1. The LO enters both home and away lineups on one page, in a layout that
  mirrors the existing live lineup page (familiar look/feel, LO-specific changes
  as needed). Because one actor fills *both* sides at once (the live page is
  single-side per captain), the dual-side layout is a net-new arrangement to
  resolve in planning, especially on mobile.
- R2. The LO can manually set/override each player's handicap during setup (no
  two-captain negotiation; the LO's entered values are authoritative for the
  match). Handicap fields pre-populate from the player's current roster handicap
  (same source the live lineup uses) and the LO edits exceptions; an override
  writes the frozen `match_lineups.playerN_handicap` fields the engine reads.
- R3. A single **"Setup Match"** action finalizes setup: it freezes the entered
  lineups and handicaps, runs the prematch threshold math, and creates the game
  rows — the same end state the live two-captain lineup-lock produces. Mechanically
  this should drive the `prep_match` RPC + threshold computation **directly**, not
  the live two-captain orchestration hook (`useMatchPreparation`), which is gated
  on opponent-locked / home-only / realtime-discovery logic that has no meaning for
  a single operator. "Setup Match" is the LO-facing label; there is no second
  party, so no "lock" ceremony language.
- R4. After "Setup Match," the page transitions to the Entry phase showing the
  created games. The action is a multi-step server operation, so it needs a
  loading state, a success confirmation (e.g. "Match set up — N games created"),
  an error/retry path if it fails, and disabled-until-both-lineups-complete gating.
  Re-clicking after success must not double-create (the RPC no-ops off
  `scheduled`); the page simply shows the Entry phase.

**Entry phase (score each game)**
- R5. The LO sees a scoreboard-style view that mirrors the live scoreboard
  (`UnifiedScoreboard`): per-side running totals, thresholds (to-win / to-tie /
  to-lose), and the grid of created games — so totals update live as a sanity
  check against the paper sheet. The grid must clearly distinguish scored vs.
  unscored games so the LO doesn't skip or double-enter. (Whether `UnifiedScoreboard`
  renders single-operator by stubbing its live-flow props or needs a thin wrapper
  is a planning question — same class as the `ScoringDialog` one below.)
- R6. The LO scores each game by reusing the existing live scoring modal
  (`ScoringDialog`) UI, capturing the winner plus the per-game extras the active
  scoring system supports (break-and-run, golden break, calculator inputs, etc.).
  The per-game forfeit toggle is hidden in the LO context (forfeits are out of
  scope for v1).
- R7. There is **no two-party confirmation step**: the LO is both confirming
  parties. This requires a thin LO-authoritative write path (not the live
  single-slot write): each game write fills **both** `confirmed_by_home` and
  `confirmed_by_away` in one operation, so the game counts toward totals exactly as
  a live mutually-confirmed game does. Target ~3–4 taps per game (winner → extras →
  save → next).
- R8. After each game write, the match running totals recompute through the normal
  path (`updateMatchRunningTotals` → modular engine), identical to live play. This
  recompute genuinely is reused unchanged — it is the per-game and match-end
  *write* layers that need an LO variant, not the scoring math.
- R9. The LO can correct a game they entered: tapping an already-scored game
  re-opens `ScoringDialog` pre-filled with the prior values; the LO overwrites and
  saves, and totals recompute (R8). No vacate ceremony — the LO is the sole
  authority, so the two-party vacate-and-rescore protocol is unnecessary here.
- R10. A single **"Finalize Match"** action completes the match: it fills **both**
  home/away verification slots (`home_team_verified_by` / `away_team_verified_by`)
  in one operation, driving the normal `MatchEndVerification` path that writes
  `winner_team_id` and `status = 'completed'`. Without this, a fully-scored match
  stays "in progress" with no winner — failing the core goal. Mirrors R7's
  dual-slot approach at the match-end layer.

**Eligibility / safety**
- R11. In v1, manual scoring is offered only for matches with nothing recorded yet
  (`status = 'scheduled'`, no locked lineups, no scored games), preventing this
  tool from stomping a match that was started or scored live. The guard must be
  enforced on an authoritative read (server/DB), not a UI-only hide — direct URL
  access must also be refused. `prep_match`'s own `scheduled`-only gate is a
  natural backstop. The selection surface needs an empty state for when no eligible
  matches exist.

## Success Criteria
- An LO can take a completed paper scoresheet and, in one sitting, reproduce the
  match in-app — including finalizing it — so standings, points, games-won, and
  **winner** come out identical to a live in-app scoring of the same results.
- No new *scoring/points math* is introduced — the feature drives the existing
  engine, recompute, scoreboard, and scoring-modal UI. The genuinely new code is a
  thin LO-authoritative layer: a dual-slot game write (R7), a dual-slot match
  finalize (R10), and a path that bypasses the live team-membership gates for an
  operator who is on neither team.
- Per-game entry is fast (~3–4 taps) and feels familiar to an LO who also plays
  in the league.
- The page shell and entry surface do not fork a second code path; later
  iterations add take-over/adjust as affordances on populated data. (Setup-primitive
  caveat noted in Problem Frame.)

## Scope Boundaries
- **v1 = enter-from-blank only.** Taking over a match that was already started or
  finished live, and adjusting already-entered games across sessions, are deferred.
  The page shell should anticipate them; the `scheduled`-only setup primitive will
  not extend to them and is explicitly a later, separate write path.
- **Played-only.** Whole-match forfeits and no-shows are out of scope, and the
  reused modal's per-game forfeit toggle is hidden in the LO context. (Noted: a
  forfeited/no-show match is also a plausible after-the-fact operator entry — this
  is deferred-with-demand, not out-of-domain, and should be prioritized in the
  end-state rather than forgotten.)
- **No two-party / realtime confirmation flow** for this page — single-operator
  entry by design. This is a deliberate accountability stance: manually-entered
  matches are **operator-attested** (one party fills both confirmation and
  verification slots), bypassing the two-party verification the live flow
  guarantees. Whether such matches are visibly marked as operator-entered for
  downstream trust/audit is an open question.
- **Workshop / threshold-chart editing is a separate future build.** The old
  branch tangles manual-scoring with threshold-chart editors; those must stay
  separated. Nothing in this feature edits scoring systems or threshold charts —
  it consumes the match's already-configured system.

## Key Decisions
- **Reuse the math, add a thin write layer:** drive the real engine, recompute
  (`updateMatchRunningTotals`), `UnifiedScoreboard`, and `ScoringDialog` UI. The
  "apply scoring as if live" promise comes from routing through the same recompute.
  Review correction: the live per-game write fills only one confirmer slot and the
  match-end verification is two-party, so a small LO-authoritative write/finalize
  layer is genuinely new — this is not zero-new-code, and the doc says so honestly.
- **LO is both confirming parties:** each manual game write fills both per-game
  confirmation slots (R7) and the finalize action fills both match verification
  slots (R10) so totals, winner, and status match a live mutually-confirmed match.
- **"Setup Match" must precede entry:** game rows don't exist until lineups lock,
  so a single up-front action must materialize them before the grid can render —
  rejecting an "enter everything then one big save" shape. Drive `prep_match`
  directly, not the two-captain orchestration hook.
- **UX source is the live pages, old branch is light inspiration only:** the page
  should look/feel like the existing lineup and scoring pages with LO-specific
  changes. The `lo-manual-scoring` branch predates the current scoring stack
  (modular engine, frozen locked `match_lineups`, `system_snapshot`,
  `UnifiedScoreboard`); mine it for UX ideas (lineup layout, handicap-override
  affordance) but do **not** lift its scoring/data code. Its per-week match list is
  a *candidate entry-point pattern to evaluate*, not a committed v1 deliverable
  (entry point is deferred — see Outstanding Questions). Keep its threshold-editor /
  workshop half out entirely.
- **Don't over-build for the end-state:** the negative constraint is what matters —
  do not introduce data shapes, page structure, or write paths that would require
  forking a second code path to add take-over/adjust later. This is a guard against
  wrong moves, not a mandate for speculative abstraction (the data is already
  populated by doing v1 correctly).

## Dependencies / Assumptions
- Live scoring stack is the source of truth (verified during the brainstorm scan):
  `match_lineups` (`locked`, frozen `playerN_handicap`, `home_team_modifier`),
  `match_games` (`confirmed_by_home` / `confirmed_by_away` as FKs to `members.id`,
  per-game extras, `home_action` / `away_action` breaker assignment),
  `prep_match` RPC, `updateMatchRunningTotals`, `MatchEndVerification`
  (`home_team_verified_by` / `away_team_verified_by`), and the modular engine.
- A scheduled `matches` row already exists for any match the LO scores (the LO
  fills a scheduled match; it does not create matches).
- `system_snapshot` is populated lazily at the first scoring event from league
  config *as of that moment*. For after-the-fact entry that moment is later than
  when the match was played — a potential config-drift mismatch to address.

## Outstanding Questions

### Deferred to Planning
- [Affects R7/R10][Technical] What `members.id` is written into
  `confirmed_by_home` / `confirmed_by_away` and `home/away_team_verified_by` for an
  LO who is on neither team — the LO's own member ID (explicit operator marker), a
  captain ID, or a sentinel — and does any downstream attribution/audit key off it?
- [Affects R1/R3/R6/R7][Technical] Cleanest LO-authoritative path that bypasses the
  `team_players` membership checks in the lineup mutations and the
  roster-derived home/away routing in the scoring write, without disturbing the
  live two-party paths.
- [Affects R3][Technical] Confirm `prep_match` can be driven with one actor
  supplying both lineups/thresholds, and that the LO flow skips `useMatchPreparation`.
- [Affects R5/R6][Technical] Confirm `UnifiedScoreboard` and `ScoringDialog` render
  in single-operator mode by stubbing live-flow props, or scope thin wrappers.
- [Affects R2/R3][Technical] For points/Fargo formats, how is start-credit
  (`*_to_tie`) derived without the two-captain start-points negotiation? (The
  "start-credit is a pure calc from frozen ratings" direction likely resolves this —
  confirm the LO path computes it rather than reading negotiation scratch state.)
- [Affects R6][Technical] Per-game breaker (`home_action` / `away_action`) is
  engine-assigned by pairing generation and may not match the paper sheet's actual
  breaking order, which gates break-and-run / golden-break eligibility. Decide
  whether the LO can override breaker per game, or breaker is non-authoritative for
  after-the-fact entry.
- [Affects R10][Technical] How does the LO reproduce a paper match whose real
  result was a tie that required a tiebreaker game (games-mode even formats)?
- [Affects R1/R11][Technical/Design] Entry point: a per-week match list vs. an
  action on the existing match/schedule view, and how R11's guard + refusal state
  surface there.

## Next Steps
-> `/ce:plan` for structured implementation planning. All open items are
planning/technical and can be carried into `/ce:plan`.
