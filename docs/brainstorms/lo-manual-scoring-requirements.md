---
title: League Operator Manual Scoring
type: requirements
status: active
date: 2026-04-20
revision: 5
---

# League Operator Manual Scoring — Requirements

## Revision History

- **Rev 1**: "edit anything" — rejected: cached-aggregate corruption risk.
- **Rev 2**: "reuse player UI with `asOperator` flag" — rejected: 9 components would need operator-mode branching.
- **Rev 3**: dedicated operator page, share mutation layer only — accepted.
- **Rev 4**: reordered slices review-first, corrected RLS scope, named twin-UI cost, defined save states.
- **Rev 5 (this)**: resolved the remaining specific findings. Key changes: dropped partial-save (localStorage handles interruption instead, preserving the collaborative contract), acknowledged broader completion-math extraction scope, named stale RLS reconciliation as a prerequisite, added server-side lineup-lock guard, downgraded the RLS "defense in depth" claim to be honest about the existing permissive policy.

## Problem Frame

A league operator needs two things the app doesn't provide:

1. **Audit a completed match** game-by-game including who confirmed each entry — without opening the database.
2. **Record a match that wasn't scored through the app** (paper-only league, app was down, pre-onboarding teams, match that teams abandoned mid-scoring).

Neither requires retroactive edits to player-confirmed data. That property keeps the feature's scope and risk small.

## Users

- **Primary**: League Operator (LO) with admin access to a league. Desktop/laptop user transcribing paper scores or performing admin review. Mobile supported but not the optimization target.
- **Not a user**: Regular players. Their scoring UI is unchanged except for the single `determineMatchResult` extraction noted below.

## Strategic Costs (Acknowledged)

Building a dedicated operator UI instead of reusing the player UI creates **two scoring surfaces** that must stay functionally aligned:

- **Canonical direction**: The player scoring UI is canonical. When scoring behavior changes, it lands in the player UI first. The operator UI follows within one release.
- **What's enforceable vs. what isn't**: Completion math divergence (winner determination, points totals) is enforceable — shared pure utilities + tests pin the behavior. Cosmetic modifier-UI drift is NOT enforceable and will accumulate over time; that's accepted.
- **Concrete enforcement mechanism**: add a note or CODEOWNERS entry in `src/components/scoring/` stating "changes to player scoring behavior must include operator-UI review." Turns the policy into a forcing function during PR review. If scoring changes are frequent enough to demand automation later, add a shared-completion-layer test that fails CI when the two paths diverge.

## The Feature: One Page, Three States

A single operator match page serves any match in the LO's league. Content is driven by match state:

- **Completed**: read-only review. Every drawer tappable to expand/collapse; no edit affordances.
- **Blank** (no games scored): full edit. LO enters lineups, scores every game, saves in one session (see "No partial-save" below).
- **Partial** (some games scored by players): LO can review the player-scored games and the remaining empty games, but **cannot score or complete the match in this feature**. Finishing partial matches is deferred to a future operator dispute-resolution feature because the collaborative-contract implications (see rev 5 revision notes) require more design than this feature should absorb.

**Edge case: "lineup entered but no games scored"** — classified as **Blank**. LO can keep or replace the lineup, then score.

Same page, same component tree. A per-row `isEditable(game, matchState)` predicate drives per-drawer behavior. The predicate's rule: editable iff `matchState === 'blank'` AND `winner_player_id IS NULL`.

## No Partial-Save (v1)

**Rev 5 change.** Earlier revisions specified a "Save Progress" button that persisted partial LO work to the database. That design had a critical flaw: once the LO stamped both `confirmed_by_home` and `confirmed_by_away` with their member ID on a game, that game became:
- Locked from further LO edits (the isEditable rule excludes games with both confirmations)
- Locked from player scoring (the player UI treats double-confirmed games as complete)

So a partial LO save would block players from scoring their own match and trap the LO if they miskeyed a value. The collaborative-scoring contract doesn't survive this.

**Replacement in v1**: localStorage-backed client-side draft. As the LO edits, dirty state persists to localStorage scoped to `match:${matchId}:${userId}:operator-draft` (user-scoped so drafts don't leak across operators sharing a workstation). On logout, the user's drafts are cleared. Navigating away and returning within the same user session restores the draft. Only "Save & Complete Match" actually writes to the database — a single atomic write that finalizes the match.

**Trade-off**: LO cannot split a transcription across devices. That's acceptable in v1 — paper transcription is typically a single-session desktop activity.

## Design Principles

1. **Not the player UI.** New, dedicated components under `src/operator/match-scoring/` or similar. No imports from `ScoreMatch.tsx`, `ScoringDialog.tsx`, scoreboards, or real-time hooks.
2. **Share the completion layer, not the UI.** The pure utilities (`calculateFargoMatchTotals`, `calculatePoints`, `calculateBCAPoints`) already exist as shared functions. A new `computeMatchCompletion(matchContext, gameResults)` utility must be extracted from `MatchEndVerification.tsx` — this includes `determineMatchResult` AND the Fargo/BCA branch for points-total calculation AND the `updates`-payload construction. That extraction is the **only edit to any player-UI file**, and it's a substantial extraction (~80–120 lines), not a one-function move. Name the module `src/utils/matchCompletion.ts`.
3. **No modals.** All interaction on the page. No scoring dialog popup, no opponent-confirm roundtrip.
4. **No real-time subscriptions on the operator page.** Uses queries and mutations only. Outbound propagation still happens — the operator's writes fire the same Supabase realtime channels player writes do, so other views update normally.
5. **Dumb inputs, direct entry.** Plain text inputs, toggles, dropdowns, checkboxes. No auto-calc, no smart defaults.
6. **Desktop-primary, mobile-acceptable.** Wide layouts (≥768px) use horizontal space. Narrow layouts stack.

## UI Shape

### Page Header

- Match title, date, week label
- Match status badge: `Scheduled` / `In Progress` / `Completed` (always visible)
- Back button to operator match list

### Lineups Section

**Wide (≥768px)**: Home left column, Away right column, side-by-side.

**Narrow (<768px)**: **Stacked** — Home on top, Away below. No tabs. Rationale: tabs hide one team's data, which complicates cross-team verification during entry. Stacking is longer but keeps everything visible with a scroll. (Rev 5 resolves the prior stack-vs-tab open question in favor of stacking.)

Each slot shows:
- **Player picker**: roster-constrained combobox with type-to-search. Only members on that team's roster appear. A member can be picked only once per team (dedup).
- **Handicap/rating input**: for BCA systems, manual entry by LO (types from paper). For Fargo, plain integer 100–850. For "none" handicap type, field hidden. All entry is manual (no auto-pull from history).
- **Empty slots**: allowed. See "Short-roster handling" below.

**For Fargo**: below the lineups, a plain integer input labeled "Start points" and a dropdown labeled "Applied to" with options `Home`, `Away`, `Neither`. **Structural validation**: if "Applied to" is `Neither`, the start-points input is disabled and set to 0. If "Applied to" is `Home` or `Away`, the value must be a non-negative integer. The mutation rejects other combinations.

**Edit state per match state**: Blank = editable. Partial = read-only (but this feature doesn't offer a path to complete partial matches anyway, so this is inspection-only). Completed = read-only.

### Games Section

A flat accordion list. Defaults by match state:
- **Blank**: all drawers OPEN (ready to score). "Collapse all" toggle in section header.
- **Partial**: read-only. Player-scored drawers closed (summary only); empty drawers closed with an "Unscored — finish in app" note. LO can tap to inspect but not edit.
- **Completed**: all drawers closed. Tap to expand and read.

**Closed drawer content**:
- Game number
- Home player — "vs" — Away player
- Breaker indicator: "⚡Home breaks" or "⚡Away breaks" (small, left-aligned) — visible in all match states as reference info
- Winner indicator: winner's name highlighted, or "Unscored"
- Up to 3 modifier badges. If more than 3 set, show 2 + "+N more" chip. Narrow screens abbreviate (B&R, GB, RO, BF, WbF).
- Attribution badge on completed-match review: "Ed" or "Operator Ed" or "Removed member" (see Attribution below).

**Open drawer (blank-match editable) content**:
- **Winner toggle**: two buttons — home player name, away player name. Tap to select. **Tapping the already-selected button deselects it**, returning the game to unscored.
- **Modifier checkboxes**: Break & Run, Golden Break, Runout, Break Fouled, Win by Forfeit. All visible at all times.
- **Loser balls pocketed** (Fargo only): integer 0–7. Accepts blank (treated as 0).
- **Breaker toggle**: editable, home breaks / away breaks.

**Open drawer (read-only in completed or partial)**: same layout, inputs disabled. Attribution line at the bottom: "Confirmed for Home: [name]. Confirmed for Away: [name]."

### Save Action

- **Completed match**: button hidden.
- **Partial match** (read-only, inspection-only): button hidden. A note reads "This match has partial scoring. Use the app to complete it, or use the vacate flow to restart."
- **Blank match**: button labeled "Save & Complete Match". States:
  - **Disabled** if lineups are incomplete OR any scheduled game has no winner. Tooltip explains what's missing.
  - **Enabled** once all scheduled games have winners AND lineups are complete.
  - **Loading** ("Saving...") during the mutation.
  - **On success**: localStorage draft cleared, navigate to match list with success toast.
  - **On failure**: stay on page. localStorage draft preserved (so refresh can recover). Error banner per failure type (see Errors).
- **Navigation guards**:
  - Back button / link click: confirm dialog "You have unsaved changes. Leave anyway?" triggered by dirty localStorage.
  - **Tab close (`beforeunload`)**: browser shows its native unload warning. Custom text is not supported in modern browsers. This is acknowledged, not a gap.

### Errors

- **Invalid match ID**: "Match not found." with back-to-list link.
- **RLS denial on page load**: "You don't have permission to open this match."
- **RLS denial on save**: "You no longer have operator access to this league. Your draft is preserved — refresh when access is restored."
- **Constraint violation on save**: plain-language messages for known constraints (e.g., `uq_match_games_game_number` → "This match already has games recorded. Refresh and try again."). Unknown constraint → "Unexpected error. Please contact support." Do not surface raw constraint names.
- **Network failure**: "Save failed. Check your connection and try again." Draft preserved.
- **Skeleton loading** during initial data fetch.

### Attribution

Display-name helper handles three cases for each UUID:
- **Found, normal member**: show display name.
- **Found, LO member** (when comparing against the league's operators): show "Operator [name]" (so reviewers can tell at a glance which games the LO scored).
- **Not found** (member deleted): show "Removed member".

Note: a member whose `organization_staff` row was removed but whose `members` row still exists renders with their normal display name. "Removed member" is only for fully-deleted members.

## Short-Roster Handling

For teams with fewer than 5 active roster members:
- LO can leave lineup slots empty.
- **Empty slots generate no game row in the mutation.** The match will complete with fewer than the format's scheduled game count (e.g., 4v4 generates 16 games instead of 25).
- Standings math tolerates variable game counts (it sums, not averages — verify before Slice 2).
- No validation for "every slot filled." LO takes responsibility.

## What This Feature Does NOT Do

- **Edit a completed match.** Review-only.
- **Finish a partial match.** Inspection-only in v1. Deferred to a future operator dispute-resolution feature where the collaborative-contract implications can be properly designed.
- **Edit player-scored games under any circumstance.** No UI path, no mutation path, no RLS path permits LO overwrite of rows with both confirmations.
- **Add/remove games beyond the scheduled count.**
- **Modify league settings, handicap type, or threshold charts.**
- **Handle LO-vs-LO concurrency.** Last-write-wins silently. Acceptable for v1.
- **Handle LO-vs-player concurrency.** Refresh picks up new state; no live reconciliation. See "Lineup lock" below for the one race this feature DOES guard against.
- **Player-visible "edited by operator" markers** in the player scoring UI.
- **Fargo rating range validation** (100–850). LO takes responsibility for semantic correctness.

## Issues Noted But Not Fixed By This Feature

Rev 5 acknowledges these pre-existing issues surfaced during review. They are NOT in scope for this feature but deserve their own future work:

1. **Permissive `match_games` RLS policy** ("Authenticated users can update match games") exists today and allows any authenticated user to write to any match_games row. This means Success Criterion #5's "no LO overwrite" invariant can only be enforced at the UI + mutation layers here, not at the RLS layer. Adding a stricter LO policy would not restrict anyone because Postgres RLS policies are OR-combined across policies for the same command. **Fixing this is a separate project** that must reauthorize every existing scoring mutation against a tighter policy.
2. **Stale RLS migrations**: current live policies on `matches` reference a dropped `league_operators` table / `leagues.operator_id` column. The `add_rls_policies.sql` migration file is zero bytes. **This feature's Slice 2 migration must DROP-and-replace these stale policies, not just ADD new ones.** Called out explicitly in the Slice 2 scope below.

## In Scope

### Slice 1 — Review-only

- **TS type fix pre-work**: `match_games.confirmed_by_home` / `confirmed_by_away` are UUIDs, currently typed as `boolean` in `src/types/match.ts`. Fix the type. Also update `src/__tests__/database/matchGames.rls.test.ts` lines 127–128 and 220–221 to use UUID or null literals instead of true/false. Lands as the first commit.
- **Operator match list page**: port `MatchListPage.tsx`, `MatchRow.tsx`, `WeekAccordionHeader.tsx` from `lo-manual-scoring` branch. Rewire data source from the branch's stale `league_format_settings` to the current `useResolvedLeaguePrefs`.
- **Operator match page (completed state only)**: read-only rendering of lineups, games, attribution. No save button.
- **Display-name helper** with LO-attribution and removed-member handling.
- **Gate**: LO navigates from league detail to any completed match and sees its full detail with correct attribution.
- **Does NOT need**: RLS migration (reads already allowed), new mutations, concurrency handling, localStorage drafting. (localStorage drafting is a Slice 2 concern — Slice 1 is read-only and has nothing to draft.)

### Slice 2 — Blank-match scoring

- **Completion-layer extraction**: extract `computeMatchCompletion(matchContext, gameResults)` from `MatchEndVerification.tsx` into `src/utils/matchCompletion.ts`. Both paths (player completion, LO completion) call the new utility. Acknowledged: this is ~80–120 lines of extraction, not a single-function move. It's the only edit to any player-UI file.
- **RLS migration**: DROP stale `league_operators`-referencing policies on `matches` (they're broken against current schema anyway). CREATE new league-scoped policies joining `seasons → leagues → organizations → organization_staff` for operator INSERT/UPDATE on `match_games`, `match_lineups`, and `matches`. Policies must include appropriate `WITH CHECK` to allow the dual-LO-UUID confirmation pattern (both `confirmed_by_home = confirmed_by_away = LO_member_id`).
- **Atomic completion RPC**: a Postgres stored function `operator_complete_match(match_id, lineups_payload, games_payload, aggregates_payload, snapshot_payload)` that writes:
  1. Both `match_lineups` rows
  2. All `match_games` rows (with both confirm columns set to LO member ID). **Guard: the RPC rejects any game row in the payload whose `match_id + game_number` already exists in `match_games` with `winner_player_id IS NOT NULL`.** This is the RPC-layer half of the collaborative-contract invariant in Success Criterion #5 — the UI half is the `isEditable` predicate. RLS is explicitly not counted (see "Issues Noted But Not Fixed").
  3. `matches` aggregates (pre-computed by the client via the extracted `computeMatchCompletion` TS utility and passed in as `aggregates_payload`) + both verification columns + `status='completed'` + `fargo_start_points` if Fargo
  4. `system_snapshot` if not already populated
  
  All in one transaction. Sequential-mutations alternative is rejected because no rollback exists on partial failure.
  
  **Resolution of the "RPC vs TS completion math" question**: Postgres cannot call TypeScript, so the completion math runs **client-side** via the extracted `computeMatchCompletion` utility. The client passes the pre-computed `aggregates_payload` (winner_team_id, home/away_team_score, match_result, home/away_games_won, home/away_points_earned) to the RPC. The RPC is a transactional write coordinator, not a math surface. This keeps completion math in one place (the TS utility), at the cost of trusting client-computed totals. Defense: the same client-side `computeMatchCompletion` is called by `MatchEndVerification.tsx` for the player path, so "trust the client" is already the player-path posture. We are not making a new trust decision, only reusing it.
- **Server-side lineup-lock guard**: the RPC checks `SELECT COUNT(*) FROM match_games WHERE match_id = $1 AND winner_player_id IS NOT NULL` before writing lineups. If count > 0, the RPC aborts with a clear error. This is the one concurrency guard the feature needs — prevents LO lineup save from corrupting player-scored game player-references.
- **Operator match page (blank state)**: full edit with save button and localStorage drafting.
- **Gate**: LO scores a blank match end-to-end, match completes, standings update.

### Deferred — Partial-match completion

Moved out of v1 entirely. A future "operator dispute resolution" feature will address both partial-match completion and completed-match edits, with proper treatment of the collaborative-contract implications.

## Success Criteria

1. **(Slice 1)** LO navigates from league detail to any completed match and sees full per-game detail with attribution.
2. **(Slice 2)** LO can score a blank match end-to-end: enter lineups, toggle winners on every game, add modifiers, save. Match completes correctly.
3. **(Slice 2)** Mid-scoring interruption: LO can close the tab and reopen the match URL within the same user session; localStorage restores their draft.
4. **(Slice 2)** Player scoring behavior is functionally unchanged. Only the extraction of `computeMatchCompletion` touches `MatchEndVerification.tsx`; the refactor preserves the player completion path byte-identical in its observable behavior (same writes, same order, same outputs).
5. **Collaborative-scoring invariant preserved (two-layer enforcement)**: the invariant is enforced by (a) the UI's `isEditable` predicate, which hides edit affordances for games with a winner, and (b) the RPC's explicit guard rejecting any game-payload row whose existing DB row has `winner_player_id IS NOT NULL`. RLS is explicitly NOT a defense layer due to the pre-existing permissive policy (see "Issues Noted But Not Fixed").
6. **(Slice 2)** Race resistance: if a player scores a game while the LO is filling in lineups on the same match, the LO's save is rejected cleanly by the server-side lineup-lock guard. Their localStorage draft is preserved so they can refresh and re-plan.
7. Desktop layout (≥768px) renders side-by-side lineups cleanly. Narrow layout (360px) renders stacked and is usable.

## Dependencies

- **Fargo PR #72 must merge first.** This feature writes to match tables reshaped by Fargo work.
- **TS type fix** is Slice 1 pre-work (first commit).

## Open Questions (Implementation-Step, Non-Blocking)

1. Specific `organization_staff.position` tier required for operator write access (e.g., `owner` only, or `owner | admin`). Deciding during Slice 2 planning.
2. Attribution UI treatment for a member whose `organization_staff` role was removed but whose `members` row persists — show as normal, or as "Former operator"? Slice 1 planning decision.
3. Mobile landscape handling (tablet-portrait-but-not-phone viewport sizes). Defer to implementation; probably fine with the ≥768px breakpoint.

## Sources

- Review findings from rev 1 through rev 4 (captured in conversation log)
- Predecessor branch: `lo-manual-scoring` (match-list subtree only is useful port)
- Parent system work: `docs/plans/2026-04-18-001-refactor-modular-handicap-scoring-systems-plan.md` and `docs/brainstorms/modular-handicap-scoring-requirements.md`
- Existing DB artifacts checked:
  - Live `match_games` UPDATE policy is currently permissive to any authenticated user
  - `matches` policies reference dropped `league_operators` table — require DROP in Slice 2
  - `supabase/migrations/20251130014152_add_rls_policies.sql` is zero bytes
  - `supabase/migrations/20260418000003_add_matches_system_snapshot.sql` (tier-3 snapshot, must be populated by operator save path)
  - `src/components/scoring/MatchEndVerification.tsx` — completion math spread across lines 129–244 and 284–328 (not just `determineMatchResult`)
  - `src/utils/fargoMatchTotals.ts` and `src/types/match.ts` — pure utilities already reusable
