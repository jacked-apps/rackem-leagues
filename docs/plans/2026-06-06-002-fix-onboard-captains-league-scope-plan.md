---
title: "fix: Re-scope Onboard-Captains to the league page (placeholder captains only)"
type: fix
status: active
date: 2026-06-06
---

# fix: Re-scope Onboard-Captains to the league page (placeholder captains only)

## Overview

The "Onboard my captains" card currently lives on the Operator Dashboard, scoped to the **whole organization**, and lists **every team in every league forever** — including bye teams (which have no captain) and captains who have already registered. This plan re-scopes it to a single **league**, filters it down to **only teams whose captain has not yet registered**, and moves the card from the Operator Dashboard to the league detail page.

The intent (per the product owner) is a **temporary, self-clearing** surface: "get my NEW captains onboarded." A captain who registers drops off the list permanently; next season's copied teams already carry registered captains, so they never appear. In practice the list is non-empty for roughly a week after a league's teams are seeded, then empties and the card hides itself.

## Problem Frame

`get_org_teams_for_onboarding(org_id)` (in `supabase/migrations/20260529000008_join_link_distribution.sql`) selects every team across every league in an org with no filtering on team status or captain registration state. Consequences:

1. **Wrong altitude.** Captains belong to a league, not an org. 5 leagues × 10 teams = 50 rows the LO must scroll past forever, on a dashboard that isn't where they manage a league.
2. **Bye teams leak in.** Bye teams have `status = 'bye'` and `captain_id = NULL`. The RPC has no status filter, so they render with an empty "Captain: " label.
3. **Onboarded captains never leave.** There is no filter on captain registration. Once a captain registers, their row should disappear (the onboarding job for that captain is done) — but it stays.

The fix is a league-scoped RPC that excludes bye teams and excludes registered captains, consumed by a league-scoped hook/component mounted on the league page.

## Requirements Trace

- R1. The onboarding list is scoped to a single league, not the org.
- R2. Bye teams never appear in the list.
- R3. Teams whose captain has already registered never appear in the list.
- R4. When no teams qualify, the card renders nothing (no empty shell).
- R5. The card appears on the league detail page (`/league/:leagueId`) and is removed from the Operator Dashboard.
- R6. The org-scoped RPC is removed cleanly (its only consumer is this surface).
- R7. Access stays gated to org staff (parity with the existing RPC's auth check).

## Scope Boundaries

- No change to the join/claim flow itself (`request_team_join`, `approve_join_request`, the merge RPC) — only the read-side distribution list.
- No change to per-team join-token generation or rotation (`get_team_join_token`, `rotate_team_join_token`).
- No season-scoping column or filter — the `captain user_id IS NULL` predicate is the de-facto scope (a registered captain, including a copied-team captain, is excluded by definition).
- No "mark as onboarded" manual control — onboarding state is derived from registration, never set by hand.

## Context & Research

### Relevant Code and Patterns

- `supabase/migrations/20260529000008_join_link_distribution.sql` — the existing org RPC `get_org_teams_for_onboarding` (lines ~61–110). Mirror its structure (jsonb_agg of per-team objects, org-staff auth gate, `member_display_name`/`league_display_name` helpers, SECURITY DEFINER, `SET search_path = public`).
- `src/api/queries/teamJoin.ts` — `getOrgTeamsForOnboarding` (line ~191) + `OrgOnboardingTeam` interface (line ~182). The query-layer wrapper to replace.
- `src/api/hooks/useTeamJoinDistribution.ts` — `useOrgTeamsForOnboarding` (line ~39). The hook to replace.
- `src/onboarding/OnboardCaptainsList.tsx` — the card component; currently takes `orgId`, already returns `null` on empty/loading (line ~25).
- `src/operator/OperatorDashboard.tsx` — current mount (lines ~77–80), gets `orgId` from `organization.id`.
- `src/operator/LeagueDetail.tsx` — target mount. Gets `leagueId` from `useParams` (line ~46); loads a `league` object that carries `organization_id`. Layout is a vertical stack of cards each wrapped in `mb-6`; `TeamsCard` is the natural neighbor (~line 273).
- `src/api/queryKeys.ts` — `queryKeys.teamJoin.*` namespace (has `orgTeams`; add `leagueTeams`).

### Key facts confirmed during planning

- **Captain-registered signal:** `members.user_id`. `NULL` = placeholder awaiting onboarding; `NOT NULL` = registered. There is **no** `is_placeholder` column on `members`. (The `is_placeholder` field seen elsewhere is a computed return value of a different RPC, not a column.)
- **Onboarding merges and deletes the placeholder:** when a captain claims their spot, `merge_placeholder_into_member_v2` rewrites `team_players` + `teams.captain_id` to the registered member and deletes the placeholder row. So after onboarding, `teams.captain_id` points at a member with `user_id IS NOT NULL` — `WHERE m.user_id IS NULL` cleanly excludes them.
- **Bye teams:** `status = 'bye'`, `captain_id = NULL`. An inner join on the captain member drops them; an explicit `status <> 'bye'` is kept as defensive clarity.

## Key Technical Decisions

- **New RPC, drop the old one** (rather than filter client-side): keeps the auth gate and the filtering in one trusted place and avoids shipping org-wide team data to the browser. Decided per R6 — the org RPC has exactly one consumer.
- **Predicate for "needs onboarding":** `l.id = p_league_id AND t.status <> 'bye' AND m.user_id IS NULL`, with `members m` inner-joined on `t.captain_id`. The inner join also guarantees bye teams (NULL captain) fall out even if a status value drifts.
- **Drop `league_name` from the row shape.** On a league-scoped page the league name is redundant; each row becomes Team · Captain · Copy link.
- **Auth gate unchanged in spirit:** the new RPC resolves the actor's member id and confirms org-staff membership for the league's org before returning rows (mirror the existing check, joining league → org).

## Open Questions

### Resolved During Planning

- Season scoping? — No explicit season filter. The `user_id IS NULL` predicate naturally limits the list to genuinely-new captains; registered/copied captains are excluded. (Owner decision: surface is temporary, new-captain-only.)
- `is_placeholder` vs `user_id`? — `user_id IS NULL` is the authoritative placeholder signal; `members` has no `is_placeholder` column.
- Keep or drop the org RPC? — Drop; sole consumer is this card.

### Deferred to Implementation

- Exact regenerated TypeScript types for the new RPC (run `pnpm db:types` after the migration; the `Database['public']['Functions']` entry for the old RPC is removed and the new one added).
- Whether `LeagueDetail` should pass `league.id` directly or guard for the pre-load state (resolve when wiring the mount — the page already renders other cards only after the league loads).

## Implementation Units

- [ ] **Unit 1: League-scoped onboarding RPC (replaces the org RPC)**

**Goal:** A new `get_league_teams_for_onboarding(p_league_id)` SECURITY DEFINER function that returns one row per non-bye team in the league whose captain is still a placeholder; drop `get_org_teams_for_onboarding`.

**Requirements:** R1, R2, R3, R6, R7.

**Dependencies:** None.

**Files:**
- Create: `supabase/migrations/20260606000000_onboard_captains_league_scope.sql`
- Test: `src/__tests__/database/onboard-captains-league-scope.test.ts`

**Approach:**
- New function mirrors `get_org_teams_for_onboarding`'s shape: resolve `auth.uid()` → member; confirm that member is org staff for the **league's** org (join `leagues l` → `organization_staff os` on `l.organization_id`); return `'[]'::jsonb` on any auth miss.
- Row set: `FROM teams t JOIN leagues l ON l.id = t.league_id JOIN members m ON m.id = t.captain_id WHERE l.id = p_league_id AND t.status <> 'bye' AND m.user_id IS NULL`.
- Returned object per team: `team_id`, `team_name`, `captain_name` (via `member_display_name(t.captain_id)`), `join_token`. Order by `t.team_name`. (No `league_name`.)
- `DROP FUNCTION IF EXISTS public.get_org_teams_for_onboarding(uuid);` in the same migration.
- `GRANT EXECUTE ... TO authenticated;` + a `COMMENT ON FUNCTION` describing the transient-onboarding purpose and the placeholder predicate.

**Patterns to follow:**
- `supabase/migrations/20260529000008_join_link_distribution.sql` (function skeleton, auth gate, grant, comment style).
- DB test conventions in `src/__tests__/database/` and `src/__tests__/README.md` (the `db` project; add `// @vitest-environment jsdom` only if the test uses supabase-js write paths). Per `memory/feedback_seed_files_dev_only.md`, any seeding stays dev-local.

**Test scenarios:**
- Happy path: a league with two teams, both captains placeholders (`user_id IS NULL`) → both rows returned with correct `team_name`, `captain_name`, `join_token`.
- Edge case (R3): a team whose captain has `user_id IS NOT NULL` → excluded.
- Edge case (R2): a bye team (`status = 'bye'`, `captain_id = NULL`) in the league → excluded.
- Edge case (R1): a team in a *different* league with a placeholder captain → excluded.
- Edge case (R4-supporting): a league where every captain is registered → returns `[]`.
- Error/permission path (R7): caller who is not org staff for the league's org → returns `[]`.
- Cleanup: `get_org_teams_for_onboarding` no longer exists after the migration (calling it errors / is absent from `information_schema.routines`).

**Verification:**
- The new RPC returns only placeholder-captain, non-bye teams for the given league, gated to org staff; the old RPC is gone.

- [ ] **Unit 2: Query + hook + queryKeys (league-scoped)**

**Goal:** Replace the org-scoped data access with a league-scoped path the component can consume.

**Requirements:** R1, R6.

**Dependencies:** Unit 1.

**Files:**
- Modify: `src/api/queries/teamJoin.ts` (replace `getOrgTeamsForOnboarding` + `OrgOnboardingTeam` with `getLeagueTeamsForOnboarding` + `LeagueOnboardingTeam`)
- Modify: `src/api/hooks/useTeamJoinDistribution.ts` (replace `useOrgTeamsForOnboarding` with `useLeagueTeamsForOnboarding`)
- Modify: `src/api/queryKeys.ts` (add `teamJoin.leagueTeams(leagueId)`; remove `orgTeams` if unused elsewhere)
- Modify: `src/types/database.types.ts` (regenerated via `pnpm db:types` — old RPC entry removed, new one added)

**Approach:**
- `getLeagueTeamsForOnboarding(leagueId)` calls `supabase.rpc('get_league_teams_for_onboarding', { p_league_id: leagueId })`, returns `LeagueOnboardingTeam[]`.
- `LeagueOnboardingTeam = { team_id; team_name; captain_name; join_token }` (no `league_name`).
- `useLeagueTeamsForOnboarding(leagueId)` mirrors the old hook (enabled on `!!leagueId`, `staleTime: 60_000`, keyed by `queryKeys.teamJoin.leagueTeams(leagueId)`).
- Grep for any other reference to `getOrgTeamsForOnboarding` / `useOrgTeamsForOnboarding` / `orgTeams` before deleting, to confirm the sole consumer.

**Patterns to follow:**
- Existing `getOrgTeamsForOnboarding` / `useOrgTeamsForOnboarding` shapes (this is a near-mechanical rename + reshape).

**Test scenarios:**
- Test expectation: none for the query/hook themselves (thin supabase-rpc wrappers with no branching) — coverage comes from the RPC test (Unit 1) and the component test (Unit 3). If a hook test is added, it belongs under the `unit` project with mocked supabase-js.

**Verification:**
- TypeScript compiles with no remaining references to the removed org symbols; the new hook returns league-scoped rows.

- [ ] **Unit 3: Component reshape + move to the league page**

**Goal:** `OnboardCaptainsList` takes `leagueId`, renders Team · Captain · Copy link, and is mounted on `LeagueDetail` instead of `OperatorDashboard`.

**Requirements:** R1, R4, R5.

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/onboarding/OnboardCaptainsList.tsx` (prop `leagueId`; use `useLeagueTeamsForOnboarding`; drop the `league_name` prefix from the row subtitle)
- Modify: `src/operator/LeagueDetail.tsx` (mount the card near `TeamsCard`, wrapped in `mb-6`, passing `league.id`)
- Modify: `src/operator/OperatorDashboard.tsx` (remove the card + its `mb-6` wrapper + the now-unused import)
- Test: `src/onboarding/OnboardCaptainsList.test.tsx`

**Approach:**
- Component: swap `orgId` → `leagueId`; subtitle becomes `Captain: {captain_name}` (league is implied by the page). Keep the existing `null`-on-empty/loading guard (satisfies R4). Keep the copy-link behavior + "Copied!" state.
- `LeagueDetail`: render `<div className="mb-6"><OnboardCaptainsList leagueId={league.id} /></div>` in the card stack (adjacent to `TeamsCard`), only once the league object is loaded.
- `OperatorDashboard`: delete the mount block and the import. Leave `JoinRequestList` (separate concern) untouched.

**Patterns to follow:**
- Card spacing/stack convention in `src/operator/LeagueDetail.tsx` (`mb-6` wrappers).
- shadcn `Card`/`Button` usage already in `OnboardCaptainsList.tsx`.

**Test scenarios:**
- Happy path: hook returns two teams → two rows render with team name + `Captain: <name>`, each with a Copy link button.
- Edge case (R4): hook returns `[]` → component renders nothing.
- Edge case: loading state → renders nothing.
- Interaction: clicking Copy link writes `${origin}/join/${join_token}` to the clipboard and flips that row's label to "Copied!" (mock `navigator.clipboard.writeText`).

**Verification:**
- The card shows only on the league page, lists only that league's not-yet-registered captains, and is absent from the Operator Dashboard.

- [ ] **Unit 4: Docs + index**

**Goal:** Keep the project index honest.

**Requirements:** Project standards (`feedback_table_of_contents_always`).

**Dependencies:** Units 1–3.

**Files:**
- Modify: `TABLE_OF_CONTENTS.md` (new migration entry; note the RPC rename + the card's move from dashboard → league page; update the date stamp)

**Approach:**
- Add the migration row; update the `OnboardCaptainsList` / `teamJoin` / hook entries to say league-scoped; remove/adjust any line that described the org-scoped behavior.

**Test scenarios:** None — documentation.

**Verification:**
- TOC reflects the new migration and the moved/renamed surface; date stamp current.

## System-Wide Impact

- **Interaction graph:** Read-only surface. The only callers of the removed org RPC/hook are this card (confirmed in Unit 2's grep step). Removing them is contained.
- **Error propagation:** RPC returns `'[]'` on auth miss (no throw); the query wrapper throws only on a real supabase error (parity with the existing wrapper); the component already no-ops on empty/loading.
- **State lifecycle risks:** None — no writes. The list is derived purely from `members.user_id` + `teams.status`; it self-clears as captains register.
- **API surface parity:** This is the only onboarding-distribution list. The per-team token hooks (`get_team_join_token`, `rotate_team_join_token`) are unaffected.
- **Unchanged invariants:** Join/claim/merge flow, token generation/rotation, and `JoinRequestList` all stay as-is.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| A non-bye team legitimately has `captain_id = NULL` and silently drops from the list | Acceptable: a captain-less team has no captain to onboard. The inner join is intentional; documented in the RPC comment. |
| `pnpm db:types` not run, leaving `database.types.ts` referencing the dropped RPC | Unit 2 explicitly regenerates types; TypeScript build fails loudly if the old symbol lingers, surfacing the miss. |
| Another consumer of the org RPC exists that research missed | Unit 2 begins with a repo-wide grep for the three org symbols before deletion; if a second consumer appears, reassess before dropping. |
| Migration applied to local DB but not documented for the partner | Per `memory/feedback_seed_files_dev_only.md` + the DB-operations convention, the migration file is the handoff artifact; note it in the TOC + PR body. |

## Sources & References

- Related code: `supabase/migrations/20260529000008_join_link_distribution.sql`, `src/api/queries/teamJoin.ts`, `src/api/hooks/useTeamJoinDistribution.ts`, `src/onboarding/OnboardCaptainsList.tsx`, `src/operator/LeagueDetail.tsx`, `src/operator/OperatorDashboard.tsx`
- Origin plan for the surface being changed: `docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md` (Unit 7)
