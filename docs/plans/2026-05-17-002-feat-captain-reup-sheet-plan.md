# Captain Re-Up Sheet — Implementation Plan

> **Date:** 2026-05-17
> **Status:** Plan drafted; implementation in progress
> **Brainstorm:** `docs/brainstorms/2026-05-17-captain-reup-sheet-requirements.md`
> **Branch:** `feat/captain-reup-sheet` (stacked on `feat/new-season-from-previous`)
> **Estimated scope:** ~1.5–2 days across 6 units
> **Defaults adopted for the 4 open brainstorm questions** (per Ed's "go" 2026-05-17): combined multi-team modal, regular weeks only, top-level hamburger item, page-header scoring button.

---

## Status table

| Unit | Title | Status |
|---|---|---|
| 1 | Schema + match-start trigger | ✅ shipped 2026-05-17 |
| 2 | Captain form (modal + dedicated page) | ✅ shipped 2026-05-17 |
| 3 | Modal-trigger hook (`useCaptainReupPrompt`) | ✅ shipped 2026-05-17 |
| 4 | Scoring-page inline button | ⏸ deferred (3 access paths already; gilding) |
| 5 | LO status card on league page | ✅ shipped 2026-05-17 |
| 6 | Wizard pre-fill integration | ⏸ deferred (needs teamsWizardConfig refactor) |

**Deferral notes:**
- **Unit 4 (scoring-page button):** captain already has THREE access paths — modal pops on app open, hamburger drawer's "Season Re-Up" item, dedicated `/reup` page. Adding a fourth inline in the 1000-line `ScoreMatch.tsx` adds maintenance debt for marginal value. Can revisit if real captains report missing the modal AND not navigating to the page AND not seeing the drawer.
- **Unit 6 (wizard pre-fill):** the existing `teamsWizardConfig` (used by both first-time and next-season flows) doesn't natively support "here are pre-decided teams + their captains." Wiring re-up data into it requires a real refactor of the shared component — that change should apply to both flows per Ed's rule (2026-05-17). Standalone re-up still gives LO 90% of the value: status card shows who's responded; LO walks into the wizard with the info already in mind. Wizard pre-fill is the bow on top. Worth its own follow-up.

**What landed (the 4 shipped units):**
- New `season_reup_responses` table + match-start trigger that clears dismissals
- Modal with 3 buttons (Same as last season / Make changes / Not now), combined multi-team panel, mounted via `<CaptainReupSyncer />` in `App.tsx`
- Dedicated `/reup` page reachable from the hamburger menu's "Season Re-Up" entry (only visible when there are open re-ups)
- `useCaptainReupPrompt` hook that gates everything off "captain of any active team whose season ends within 21 days, no submitted answer, no active dismissal"
- LO `LeagueReupStatusCard` rendered on `LeagueDetail` during the 3-week window, showing per-team response state (returning/same captain / returning/new captain / not returning / no response yet)

---

## Unit 1 — Schema + match-start trigger

**Files:**
- Create: `supabase/migrations/<date>_captain_reup_sheet.sql`
  - `CREATE TABLE season_reup_responses` (per brainstorm)
  - `CREATE FUNCTION clear_reup_dismissals_on_match_start()` (SECURITY DEFINER, locked-down GRANT)
  - `CREATE TRIGGER trg_match_start_clears_reup_dismissals` AFTER UPDATE OF status ON matches

**Test scenarios:**
- Insert a row with `dismissed_at` set → update a match's status to `in_progress` → trigger nulls the dismissal
- Update a match's status to `in_progress` where neither team has a re-up row → trigger no-ops (safe)
- UNIQUE (season_id, team_id) prevents duplicate rows

---

## Unit 2 — Captain form (modal + page)

**Files:**
- Create: `src/components/reup/CaptainReupModal.tsx` — modal shell with 3 buttons
- Create: `src/components/reup/CaptainReupForm.tsx` — the "Make changes" form (returning toggle + captain dropdown)
- Create: `src/pages/CaptainReupPage.tsx` — dedicated route for the hamburger entry point (reuses CaptainReupForm directly, no modal chrome)
- Create: `src/api/mutations/captainReup.ts` — `submitCaptainReup({teamId, returning, nextCaptainId})` mutation
- Create: `src/api/hooks/useSubmitCaptainReup.ts` — TanStack mutation hook
- Modify: `src/navigation/NavRoutes.tsx` — new route `/reup/:teamId` (or just `/reup` if combined multi-team)

**Combined multi-team handling (per brainstorm default):** if a captain has N qualifying teams, the modal shows one section per team with a submit-all button. Each team's answer is independent.

**Test scenarios:**
- Tap "Same as last season" → row in DB with `returning=true, next_captain_id=null, submitted_at=now()`
- Tap "Make changes" → opens form with captain dropdown pre-set; submit writes the chosen captain
- Tap "Not now" → row gets `dismissed_at=now()`, modal closes, no submitted_at
- Hamburger page renders even with no open modal — captain can still answer

---

## Unit 3 — Modal-trigger hook

**Files:**
- Create: `src/hooks/useCaptainReupPrompt.ts` — checks on app load:
  - Am I captain of any team whose season ends within 21 days?
  - For each: is there a row in `season_reup_responses` with `submitted_at IS NULL` AND (`dismissed_at IS NULL` OR row doesn't exist)?
  - If yes → return the list of teams that need a response
- Modify: `src/App.tsx` — mount a small `<CaptainReupSyncer />` (mirror of `DocumentTitleUnreadSyncer` pattern). Renders the modal when the hook returns non-empty results.

**Test scenarios:**
- Captain with no qualifying teams → hook returns `[]`, no modal
- Captain with one qualifying team + no row → modal pops
- Captain with one qualifying team + dismissed_at set → modal skipped
- Captain with one qualifying team + submitted_at set → modal skipped (already answered)
- After Unit 1's trigger clears dismissed_at → modal pops on next app load

---

## Unit 4 — Scoring-page inline button

**Files:**
- Modify: `src/player/ScoreMatch.tsx` — add a small header button "📋 Season re-up" visible only when:
  - Current user is captain of one of the teams in this match
  - That team's season ends within 21 days
  - The team has no `submitted_at` for the current season's reup
- Click → opens the same CaptainReupModal (or routes to `/reup`).

**Test scenarios:**
- Non-captain viewing the match → no button
- Captain whose season has 6 months left → no button
- Captain in last 3 weeks, no answer yet → button visible
- Captain who already answered → no button

---

## Unit 5 — LO status card on league page

**Files:**
- Create: `src/components/operator/LeagueReupStatusCard.tsx` — list of teams + their response state
- Create: `src/api/queries/leagueReupStatus.ts` — `getLeagueReupStatus(leagueId)` query
- Create: `src/api/hooks/useLeagueReupStatus.ts` — TanStack Query hook
- Modify: `src/operator/LeagueDetail.tsx` — render the card during the 3-week window

**Visibility rule:** card only renders when the league's most recent active season ends within 21 days. Outside that window, the card is gone.

**Test scenarios:**
- League with active season ending in 60 days → card not rendered
- League with active season ending in 14 days, no responses yet → card shows all teams with "⚠️ No response yet"
- Two teams responded "returning", one responded "not returning", rest no response → mixed state shown clearly

---

## Unit 6 — Wizard pre-fill integration

**Files:**
- Modify: `src/wizards/next-season/useNextSeasonStageDetection.ts` — when the upcoming season's teams are being detected, also load `season_reup_responses` for the previous (active or just-completed) season. Apply the responses to the wizard's initial team-selection state.
- Modify: `src/wizards/teams-v2/steps/<the team-list step>` — read pre-fill data from context and apply (check/uncheck per team, set captain dropdown to `next_captain_id` if present).

**Pre-fill rules (per brainstorm):**
- `returning_next_season=false` → checkbox UNCHECKED by default
- `returning_next_season=true, next_captain_id IS NULL` → checked, captain stays
- `returning_next_season=true, next_captain_id IS NOT NULL` → checked, captain dropdown pre-set to new captain
- No row at all → UNCHECKED with yellow warning ("no response — confirm before proceeding")

LO can override any of these by ticking/unticking or changing the captain dropdown.

**Test scenarios:**
- Wizard opens with all teams having "returning + same captain" responses → all teams checked, no warnings
- One team marked "not returning" → unchecked by default
- One team with captain change → checked + new captain pre-selected
- One team with no response → unchecked + warning badge

---

## Out of scope (deliberately, per brainstorm)

- Email / SMS reminders for non-responders
- LO override UI to set a captain's answer directly
- Multi-league aggregated dashboard
- Historical re-up reporting

## Cleanup work bundled with this PR

- Delete the now-redundant "Captain Re-Up Sheet" entry in `memory-bank/futureFeatures.md` (the brainstorm + plan are now the source of truth)

## PR strategy

Ship the whole feature as one PR with per-unit commits. Bundles the held doc edits + the new-season wizard work + this entire feature.
