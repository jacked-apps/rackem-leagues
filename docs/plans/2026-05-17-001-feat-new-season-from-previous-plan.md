# New Season From Previous — Implementation Plan

> **Date:** 2026-05-17
> **Status:** Plan drafted; awaiting sign-off before implementation
> **Brainstorm:** `docs/brainstorms/2026-05-17-new-season-from-previous-requirements.md`
> **Branch (planned):** `feat/new-season-from-previous`
> **Estimated scope:** ~1 day total across 6 units

---

## Overview

End-of-season → start-of-next-season is the highest-frequency operator task. Today it's a full re-entry exercise. This plan ships a wizard that pre-fills the league-creation flow with data from the previous season — operator confirms or adjusts each step.

**Architectural rule (from brainstorm):** this is **not a new wizard**, it's the existing league-creation wizard with pre-filled data + a different entry point. Reuse `WizardShell`, `WizardFlowShell`, `WizardFlowStageRenderer`, and the stage components in `src/components/wizard/`.

**Operator vs captain rule (from brainstorm):** operator handles dropouts + captain changes only. Rosters and team names are captain's job (post-activation, via existing TeamEditorModal).

**League = identity rule (from brainstorm):** league preferences (lineup size, game type, scoring, handicap) are read-only in this wizard. Changing them = a different league. No per-season override schema work.

---

## Status table

| Unit | Title | Status |
|---|---|---|
| 1 | Entry points — button on LeagueDetail + hint badge on ActiveLeagues | ✅ shipped 2026-05-17 |
| 2 | Route + wizard shell + previous-season data pre-loader | ✅ shipped 2026-05-17 |
| 3 | Step "Dates" — pre-filled start date + week count + derived name | ✅ shipped 2026-05-17 |
| 4 | Step "Teams" — carry-forward + dropouts + captain changes | ✅ shipped 2026-05-17 |
| 5 | Step "Venues" — carry-forward + add/remove | ✅ shipped 2026-05-17 |
| 6 | Activation — RPC for atomic season + teams + venues + welcome message | ✅ shipped 2026-05-17 (welcome message deferred — see notes) |

**Notes (2026-05-17 implementation):**

**Architectural correction (2026-05-17 same-day):** the initial implementation (commit `e1be874`) wrote a custom wizard shell + custom step components + a mega RPC, treating the next-season flow as a separate piece of code. Ed flagged this as over-engineering — the existing wizard scaffold (`WizardFlowShell` + per-stage `wizardConfig`s) is specifically designed for reuse, and "next season" is just "the same scaffold with the League stage skipped + pre-filled context."

The refactor (this commit) collapses the custom wizard down to:
- A 100-line flow config `createNextSeasonFlow` listing the 4 stages
- A handlers hook that reuses the SAME mutation hooks the first-time flow uses (`useCreateSeasonV2`, `useSaveScheduleV2`, `useSaveTeamsV2`), just omits the league handler
- A detection hook scoped to "what's incomplete for the latest UPCOMING season for this league?" (vs. the first-time detection's "latest any-status season")
- A ~50-line page component that mounts `WizardFlowShell` with the above

Files deleted in the refactor: custom wizard shell, 3 custom step components, the mega RPC migration, the per-feature mutation + hook, the prefill query (detection hook supersedes it). Behavior is identical to the original brainstorm's 4-step intent but with the existing scaffold doing the heavy lifting.

**Demo-relevant consequences of the refactor:**
- The new-season wizard now feels EXACTLY like the first-time wizard, just shorter — operators learn one flow, use it in two contexts.
- Schedule + Matchups stages ARE in the flow now (since we're using the existing scaffold), so the wizard goes all the way through to activation with one continuous experience. The earlier "we hand off to existing pages" cut is gone.
- Pause/resume works for free: hitting "Start Next Season" again from the league page re-runs detection, which finds the in-progress upcoming season and drops the operator at the right stage. Same affordance as the first-time wizard's "Continue Setup."
- Local DB still needs the messaging-stack migrations applied; no migration in this branch (no new RPC).

Schedule and Matchups steps reuse the existing first-season flow components as-is. No new units needed for those — the wizard just navigates through them.

---

## Unit 1 — Entry points

**Goal:** make the "Start Next Season" action discoverable from the operator's two natural starting points (org page + league page).

**Files:**
- Modify: `src/components/operator/ActiveLeagues.tsx` — add small "📋 Plan next season" hint badge on a league row when its `calculateProgress() ≥ 85%` or its current season is `completed`. Click → navigate to that league's `LeagueDetail` page.
- Modify: `src/operator/LeagueDetail.tsx` — find the `ActionCard` rendered next to `LeagueStatusCard`. Add a new state to it: when the league's progress is ≥85% or current season is `completed`, the card's primary action becomes "Start Next Season". Routes to `/operator/start-next-season/:leagueId`.
- Reuse: the existing `calculateProgress()` math in `LeagueStatusCard` — extract it to a shared helper if needed, or expose it via the same hook the card uses.

**Soft-warn case** (per brainstorm decision #8): if the operator opens the route while the season has > ~2 weeks left, the wizard's first screen shows a soft confirm: *"Your current season has N weeks left. You can start planning the next one now if you want, but most LOs wait until the last 2 weeks. Continue?"* — not blocking.

**Test scenarios:**
- League with active season at 50% → no badge on org page, no Start Next Season button on league page
- League with active season at 90% → badge appears on org page, button appears on league page
- League with `completed` season → both visible
- Click button on league page → lands on the new route with `leagueId` populated

---

## Unit 2 — Route + wizard shell + previous-season data pre-loader

**Goal:** stand up the new route, pre-load all the data we'll need (previous season, teams, venues, schedule pattern), pass it down to the wizard stages as initial values.

**Files:**
- Create: `src/operator/NewSeasonFromPreviousPage.tsx` — top-level route component. Fetches previous-season data, mounts the wizard shell, wires the stages.
- Create: `src/api/queries/newSeasonPrefill.ts` — single query function `getNewSeasonPrefill(leagueId)` that returns `{previousSeason, returningTeams, leagueVenues, schedulePattern, leaguePrefs}` in one round-trip (or close to it).
- Create: `src/api/hooks/useNewSeasonPrefill.ts` — TanStack Query hook wrapping the above.
- Modify: `src/navigation/NavRoutes.tsx` — add `{ path: 'operator/start-next-season/:leagueId', element: withOperator(NewSeasonFromPreviousPage) }`.

**Wizard shell setup:** reuse `WizardShell` + `WizardFlowShell` from `src/components/wizard/`. Pre-fill the wizard's form state from the prefill query result. Stages are wired in subsequent units.

**Test scenarios:**
- Hit route with valid `leagueId` that has a previous season → page loads with prefill data
- Hit route with `leagueId` that has NO previous season → friendly error: "This league has no completed or active season to copy from. Use [Create First Season] instead."
- Loading state while prefill query runs

---

## Unit 3 — Step "Dates"

**Goal:** the first wizard step — operator confirms start date, week count, season name. Reuses existing helpers.

**Files:**
- Create: `src/components/wizard/steps/NewSeasonDatesStep.tsx` — wizard step component. Pre-fills:
  - Start date = previous_end_date + 7 days (next-same-day-of-week)
  - Week count = previous season's `season_length`
  - End date = start_date + (week_count × 7) — read-only display
  - Season name = `deriveDateFields(start_date)` → `"{season} {year}"` (e.g., "Fall 2026"), editable text input
- Modify: `NewSeasonFromPreviousPage.tsx` — register this step in the wizard flow.
- Surface holiday/championship conflict warnings using the existing logic (currently in `src/wizards/league-v2/steps/StartDateStep.tsx` or its helpers — verify and reuse).

**Test scenarios:**
- Defaults populate correctly from previous season
- Changing start date recomputes end date and re-derives season name
- Holiday/championship conflicts surface in the warning area
- Season name accepts override (operator types "Spring 2026" even if month says Fall)

---

## Unit 4 — Step "Teams"

**Goal:** the wizard step where the operator confirms which teams return + handles captain changes. Per Ed: this is the ONLY operator-decision step in the team/roster domain.

**Files:**
- Create: `src/components/wizard/steps/NewSeasonTeamsStep.tsx` — table of teams from the previous season:
  - All checked by default (opt-out)
  - Per row: team name (read-only display), captain dropdown (editable when previous captain is archived/unavailable)
  - Yellow row warning if captain is broken — must be fixed before "Next"
  - Informational `N vacancies` badge if archived players left roster gaps — non-blocking
  - "Add new team" button at the bottom → small inline form (team name + captain dropdown only — minimal, like first-time setup)
- Validation: at least one team must be checked; every checked team must have a valid captain.

**Test scenarios:**
- All teams returning, no captain issues → "Next" enabled
- One team's captain archived → row warning, "Next" disabled until captain picked
- Uncheck a team → no warnings, "Next" stays enabled
- Add a new team via inline form → appears in list, requires captain
- Team with archived roster players → shows "3 vacancies" badge, no blocking

---

## Unit 5 — Step "Venues"

**Goal:** same pattern as teams — confirm which venues carry forward, add/remove if needed.

**Files:**
- Create: `src/components/wizard/steps/NewSeasonVenuesStep.tsx` — table of `league_venues` from the previous season:
  - All checked by default
  - Uncheck = venue no longer used
  - "Add venue" button → picks from the org's `venues` table (only ones not already in the league)
- Validation: at least one venue must be checked.

**Note on team home venues:** each returning team's `home_venue_id` is carried forward by Unit 6's RPC. If a team's home venue is unchecked in this step (no longer in the league), Unit 6 will set its `home_venue_id` to NULL and Unit 4 surfaces a warning in the next-time-around team review. (Per brainstorm decision #6.)

**Test scenarios:**
- All venues carry, none unchecked → "Next" enabled
- Uncheck a venue → "Next" still enabled
- Add a venue from the org's available list → appears in checked state
- Try to uncheck all → "Next" disabled with "at least one venue required"

---

## Unit 6 — Activation (the RPC)

**Goal:** the atomic database operation that creates the new season + carries forward teams + venues + fires the messaging triggers.

**Files:**
- Create: `supabase/migrations/<date>_new_season_from_previous_rpc.sql` — a `create_season_from_previous(...)` RPC that:
  1. Inserts a new `seasons` row (status `upcoming`)
  2. For each `(team_id_old, new_captain_id, included)` pair from the wizard, if `included` insert a new `teams` row referencing the new season + carrying forward `team_name`, `home_venue_id`, etc.
  3. Inserts `team_players` rows for each carried team (skip archived members)
  4. Inserts `league_venues` rows for the new season's venue set
  5. Returns `{new_season_id, summary: {teams_carried, players_carried, vacancies}}`
  6. Transactional — all or nothing
- Create: `src/api/mutations/seasons.ts` — `createSeasonFromPrevious(params)` wrapper that calls the RPC
- Create: `src/api/hooks/useCreateSeasonFromPrevious.ts` — TanStack Query mutation hook
- Modify: `NewSeasonFromPreviousPage.tsx` — wire the final "Activate" button to the mutation; on success navigate to the new season's view + show a toast confirmation

**Activation triggers (no new code, just confirmation that existing triggers fire correctly):**
- `auto_create_season_conversations` trigger fires on season-active → team chats + captains chat created
- New season starts in `status='upcoming'`; operator can activate it manually OR the wizard's "Activate" button sets it to `'active'` directly (Unit 6 RPC handles this)

**Welcome message:** after activation, post a system message to each new team chat: *"New season started. Open your team to confirm/edit your roster."* — gives captains a clear pickup point.

**Test scenarios:**
- Activate with all defaults → new season created, all teams carried, all rosters intact, chats created
- Activate with some teams unchecked → only included teams created
- Activate with some venues unchecked → only included venues in `league_venues`
- Archived player in a roster → skipped silently, vacancy count in summary
- RPC error mid-way → entire transaction rolls back, no orphan rows

---

## Schedule + Matchups steps

These are NOT new units. The wizard navigates to the existing schedule + matchup steps from the first-time league flow, pre-filled with the previous season's pattern. If existing components support being mounted with initial values, just mount them. If not, factor out the inner panels into a reusable form component (small refactor — handle if needed during Unit 2).

---

## Risks / things to watch

- **The existing league wizard's stage components may have hard-coded "this is a NEW league" assumptions** — e.g., a stage that always creates a league row. We'll need to skip or skip-with-different-behavior those when the entry mode is "from previous." Worth a quick code walk before Unit 2 to spot any landmines.
- **The "championship dates" conflict checker** depends on the `championship_date_options` table being populated. If it's empty in dev, the conflict warning has nothing to compare against. Test data may be needed.
- **`get_captain_team_edit_data` was just extended to also return `lineupSize`** (PR #119). Make sure the pre-fill query stays compatible.
- **Two operators clicking "Start Next Season" concurrently** — use a server-side guard in the RPC (e.g., row-lock the league or check no `upcoming` season exists for this league).

---

## Out of scope (deliberately)

- **Roster editing in the wizard** — captain's job (per brainstorm)
- **Per-season preference overrides** — league = identity (per brainstorm)
- **Captain re-up sheet** — separate feature, captured in `memory-bank/futureFeatures.md`
- **Cross-league copy-team primitive** — separate feature; can be built later using the same patterns
- **First-time league wizard refactor** — same separation-of-concerns rule should be applied (rosters not part of wizard) but that's a separate change with its own scope

---

## PR strategy

Each unit can land as its own small PR (3-6 of them total) OR the whole thing can ship as one larger PR if the units stay tight. My recommendation: **ship as one PR** since it's all the same feature and unit boundaries are mostly artificial — but commit per unit so the history is reviewable. Bundles all the held doc commits (pitch strategy, brainstorm, futureFeatures re-up sheet, list-for-jack closures, etc.) per the no-solo-doc-PR rule.

---

## Open questions before starting

~~All three open questions resolved by the pre-implementation audit on 2026-05-17:~~

### Audit results (2026-05-17)

1. **Wizard stage reusability: PARTIALLY REUSABLE.** Step components in `src/wizards/league-v2/steps/*.tsx` are pure props-driven (accept `WizardStepProps<TValue, LeagueWizardFormData>`) and have no shared-context coupling — they can be mounted directly with pre-filled values. BUT `src/wizards/league-v2/useCreateLeagueV2.ts` always calls `createLeague()` which INSERTs a new league row. **Action:** in Unit 2, factor the handler layer to accept a `mode: 'create' | 'nextseason'` flag (or build a parallel `useCreateSeasonFromPrevious` that reuses everything except the league-insert step). Adds ~30–60 min to Unit 2.
2. **Conflict checker: FAILS GRACEFULLY.** `buildConflictList` in `src/utils/conflictDetectionUtils.ts` checks for championship object before using; `getChampionshipPreferences` in `src/api/queries/seasons.ts` returns `[]` on empty table; holidays come from the `date-holidays` npm package (no DB dependency). **Action:** none. Empty `championship_date_options` table just means no championship warnings shown.
3. **Soft-confirm dialog: EXISTS.** `src/components/shared/ConfirmDialog.tsx` (component) + `src/hooks/useConfirmDialog.tsx` (promise-based hook). **Action:** use the hook in Unit 1 for the "you're more than 2 weeks out — most LOs wait" soft confirm. Pattern to copy: `src/components/messages/BlockedUsersModal.tsx` line 19.
