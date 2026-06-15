# A Bye Match Is Not a Real Match — Requirements

**Created:** 2026-06-14
**Branch:** `feat/bye-not-a-real-match`
**Status:** Requirements captured (Ed walkthrough). Scope = two small,
well-bounded gaps; most of the bye groundwork already shipped.

## Problem / framing

A BYE is a real team row (`status='bye'`, system-created when the team count
is odd, permanently captainless). But a **matchup that contains a bye is not a
real match** — nobody actually plays it; the real team just gets their bye
week. Parts of the match machinery were written before byes became real-UUID
teams, so they still treat a bye matchup like a playable game. Two concrete
leaks remain.

The unifying rule: **"is this a real, playable match?" = both teams are real
teams.** That definition already exists as `hasTwoRealTeams()` in
`src/utils/match/manualScoringEligibility.ts` (checks both teams
`status !== 'bye'`). Both fixes below should route through that single
definition so the guards can't drift apart.

## In scope (this branch)

### 1. A bye match must not consume a table number

- **Current:** `assign_tables_for_week()`
  (`supabase/migrations/20251214211103_match_table_assignment.sql`) skips only
  matches with a **NULL** team id. Byes used to be NULL but are now real
  `teams` rows with real UUIDs, so a bye match slips past the filter and gets a
  real `assigned_table_number` — burning a physical table slot on a game
  nobody plays.
- **Desired:** a match where **either team is `status='bye'`** is excluded from
  table assignment (no `assigned_table_number`). Real matches in that week
  number normally, with no slot wasted on the bye.
- **Schedule display:** a bye match shows **no table** (blank / "—"), not a
  number and not "0".
- **Success:** assign tables for a week that contains a bye → the bye match has
  no table; the real matches are numbered with no gap left by the bye.

### 2. The bye-side team cannot enter the lineup page

- **Current:** the route `match/:matchId/lineup` → `MatchLineup`
  (`src/navigation/NavRoutes.tsx`) is gated only by `withMember` (logged-in
  member) and `MatchPhaseGuard` (match *status* phase). Neither checks for a
  bye. The real team whose opponent is a bye can open the lineup page, and it
  then tries to load a roster the bye doesn't have.
- **Desired:** when a match contains a bye, the lineup page does **not** show
  the normal lineup-entry flow. The real team's player lands on a clear bye
  state and is never asked to build a lineup against nobody.
- **Reuse:** gate on the same `hasTwoRealTeams()` definition the manual-scoring
  eligibility check already uses, so "real match" means one thing everywhere.
- **Success:** navigating to a bye match's lineup URL shows the bye state,
  never the lineup builder, and never errors on the missing roster.

## UX decisions

- **Lineup page (bye side):** **stay on the page** and show a friendly bye
  state — e.g. *"You have a bye this week — nothing to do."* Less jarring than
  a redirect, and it explains *why* there's nothing there. (Recommended;
  swap to a redirect-to-schedule if Ed prefers.)
- **Schedule table column (bye match):** show nothing / "—". No table because
  no game.

## Out of scope (already done, or tracked elsewhere)

- **Auto-forfeit (the win for a bye week):** ✅ DONE and verified firing in
  prod — `sweep_auto_forfeits()` daily `pg_cron`
  (`supabase/migrations/20260611000000_auto_forfeit_sweep.sql`). The bye
  forfeits by being captainless; the real team gets the win automatically.
  Not touched here.
- **Forfeit SCORING (points awarded for the win):** deliberately deferred —
  separate work, not this branch.
- **The display/visibility migration** (show the bye as a team everywhere
  except standings/stats; replace the leftover `team_id === null` bye-detection
  in `SeasonSchedulePage.tsx` / matchups `ReviewStep.tsx`): tracked in
  `docs/brainstorms/2026-06-09-bye-team-and-auto-forfeit-requirements.md` §1
  and the `LIST_FOR_ED.md` pick-up list. Not this branch.

## Acceptance criteria

- A week with an odd team count (one bye) assigns tables to exactly the real
  matches; the bye match has none.
- The bye-side player cannot reach the lineup builder — they see the bye state,
  with no roster-load error.
- No regression for normal two-real-team matches (tables + lineup unchanged).
- Existing tests stay green; add coverage for the two bye cases.

## References

- `docs/brainstorms/2026-06-09-bye-team-and-auto-forfeit-requirements.md` — the
  broader "bye is a real team" design this completes.
- `src/utils/match/manualScoringEligibility.ts` — `hasTwoRealTeams()`, the
  shared "real match" definition both fixes route through.
- `supabase/migrations/20251214211103_match_table_assignment.sql` —
  `assign_tables_for_week()` (the NULL-only filter to fix).
- `src/navigation/NavRoutes.tsx`, `src/player/MatchLineup.tsx`,
  `src/components/match/MatchPhaseGuard.tsx` — lineup route + existing guards.
- `supabase/migrations/20260611000000_auto_forfeit_sweep.sql` — the done
  auto-forfeit, for context.
