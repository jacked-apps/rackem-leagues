# File Split Backlog

A do-one-at-a-time list of files worth splitting, built 2026-06-06 from a
codebase sweep. **Criterion is single-responsibility, not line count** — a long
file that does one cohesive job is fine and is *not* listed. Each split is a
behavior-preserving refactor (extract, don't rewrite); land each as its own PR.

Ordered best-first within each tier. Check items off as they ship.

---

## Tier 1 — Easy wins (low risk, clean seams)

- [ ] **`src/operator/components/OrgPlaceholdersCard.tsx`** (600) — three components
  in one file. Move `PlaceholderRow` and `ArchivedRow` to their own files; export
  the row type + `fetchOrgPlaceholders` from a small `orgPlaceholders.ts`. The
  sub-components already have clean prop interfaces. **Effort: S.**
- [ ] **`src/components/PlayerNameLink.tsx`** (585) — a ~120-line inline "Set Starting
  Handicaps" Dialog (own form state + validation + `useMutation`) is grafted onto a
  name-link. Extract `SetStartingHandicapsModal.tsx`; optionally a
  `usePlayerActions(playerId)` hook for the block/message/report handlers. Drops the
  file well under 300 lines. **Effort: M.** *(Just refactored its props in PR #183 —
  know it well.)*
- [ ] **`src/operator/VenueLimitModal.tsx`** (584) — one component, but the logic half
  is a self-contained table-limits state machine (~12 handlers). Extract
  `useVenueTableLimits.ts` (state + derived available/unavailable/capacity + save);
  component becomes a thin render. **Effort: M.**
- [ ] **`src/login/ClaimPlayer.tsx`** (704) — ~320 lines is nine full-screen status
  states (loading/invalid/expired/already-claimed/success/rejected/error/…). Extract
  the terminal screens into presentational components (`ClaimStatusScreens.tsx` or a
  data-driven `<ClaimStatus state=… />`); keep orchestration + the interactive `valid`
  screen in the page. Pure view extraction, no logic risk. **Effort: M.**

## Tier 2 — Reports dedup (do the two together)

- [ ] **`src/operator/ReportsManagement.tsx`** (547) **+ `src/pages/AdminReports.tsx`**
  (601) — the report **detail panel** is duplicated ~90% verbatim across both, as are
  the `getSeverityColor`/`getStatusIcon` helpers and `Report`/`ReportDetails` types.
  Extract a shared `ReportDetailPanel.tsx` + `reportsUi.tsx` consumed by both, plus a
  `useAdminReports.ts` for the admin page's load/filter/sort. Highest dedup value in
  the batch — but do both files in one PR so the shared panel lands once. **Effort: M.**

## Tier 3 — Bigger operator pages (low risk, more effort)

- [ ] **`src/operator/PlayerManagement.tsx`** (800) — card boundaries are already
  comment-delineated. Extract `PlayerDetailsCard.tsx`, `GameHistoryHandicapsCard.tsx`
  (owns the handicap form + save/validate), `OrganizationInvitesCard.tsx`. **Effort: M.**
- [ ] **`src/operator/TeamManagement.tsx`** (837) — two concerns (venues vs teams) + a
  fat handler block. Extract `useTeamManagementActions.ts` + `VenuesPanel.tsx` +
  `TeamsPanel.tsx`. **Effort: L.** ⚠️ `handleImportTeams` is a **dead stub** (builds
  arrays, discards them, fakes a success toast) — confirm intent with the owner, don't
  carry it forward as if real. *(This is LIST_FOR_ED #5.)*
- [ ] **`src/operator/SeasonScheduleManager.tsx`** (532) — extract `useSeasonSchedule.ts`
  (load/transform/conflict-detect + blackout add/remove/renumber + save) and a
  `ChampionshipSummary.tsx` for the BCA/APA range block. Keep the renumbering logic
  intact when lifting. **Effort: M.**
- [ ] **`src/operator/SeasonCreationWizard.tsx`** (767) — lower priority (reducer + steps
  data already carry much of the load). Move `saveChampionshipPreference` to
  `api/queries` (pure Supabase, no React) and lift the step-type render switch into
  `WizardStepRenderer.tsx`. **Effort: M.**

## Tier 4 — Modals with caveats (verify before starting)

- [ ] **`src/operator/TeamEditorModal.tsx`** (611) — extract `useTeamEditorForm.ts`
  (venue capacity/exclusion derivations + validate/submit) + `TeamRosterSlots.tsx`.
  ⚠️ **Two callers** (operator TeamManagement + captain MyTeams via `variant`) — behavior
  must stay identical for both. **Effort: M, Risk: Medium.**
- [ ] **`src/components/InvitePlayerModal.tsx`** (671) — extract `useInviteActions`
  (save-email / send-invite / create-token) + `InviteOptionsView.tsx`. Free DRY win:
  hoist the duplicated `getEnvironment()` into `src/utils/getEnvironment.ts`. **Effort: M.**
- [ ] **`src/components/RegisterPlayerModal.tsx`** (559) — extract
  `DeviceHandoffSignupForm.tsx` + reuse the shared `getEnvironment()`. ⚠️ **Verify it's
  still reachable first** — InvitePlayerModal now owns the placeholder-invite flow; if
  this is superseded, the move may be **delete, not split**. **Effort: M.**
- [ ] **`src/wizards/teams-v2/steps/CaptainsTeamsStep.tsx`** (443) — four components in
  one file; move `TeamDisplayCard`/`TeamEditCard`/`AddTeamPanel` to siblings. ⚠️ Active
  wizard flow possibly mid-branch — confirm it's settled first. **Effort: S, Risk: Medium.**

## Tier 5 — Careful split (touches live scoring writes)

- [ ] **`src/api/mutations/loManualScoring.ts`** (768) — three clean "units" accreted:
  setup (`loSaveLineups`/`loSetupMatch`), scoring (`loScoreGame`/`loFinalizeMatch`),
  correction (`loReopen`/`loRestore`/`loVacate`/`loCorrect`/`loRestoreGame`). Split into
  `loMatchSetup.ts` / `loMatchScoring.ts` / `loMatchCorrection.ts` + shared types module.
  Seams are clean, but it writes live scoring — treat carefully. **Effort: M, Risk: Medium.**

---

## Deferred — scoring hot-path (coordinate with Jack; tie to the unified-scoreboard branch)

Big and worth eventually splitting, but they touch the live match/scoring flow where
"games won = correct" is sacred. Don't casually split — fold into the planned
unified-scoreboard / engine work.

- `src/player/ScoreMatch.tsx` (1388) · `src/player/MatchLineup.tsx` (1274) ·
  `src/components/scoring/MatchEndVerification.tsx` (790) ·
  `src/components/scoring/UnifiedScoreboard.tsx` (692) ·
  `src/hooks/useMatchScoringMutations.ts` (860) · `src/hooks/useMatchScoring.ts` (583)

## In flux — revisit later

- `src/operator/LeagueDetail.tsx` (519) — genuine split candidate (3 components: the page
  + `ActionCard` + `NextSeasonBanner`), but actively being edited (unmerged PR + second
  computer). Split once it settles.

## Leave-it (assessed, NOT worth splitting — long but cohesive)

`src/components/PageHeader.tsx`, `src/operator/PlayoffSetup.tsx`, `src/player/MyTeams.tsx`,
`src/components/season/ScheduleReview.tsx`, `src/api/mutations/autoConversations.ts`,
`src/api/mutations/matchLineups.ts`, `src/api/queries/players.ts`,
`src/hooks/playoff/usePlayoffSettingsReducer.ts`. Plus content/data files (glossary
entries, rulebook, format docs, question definitions) — long is fine for static content.

---

## Incidental findings (bugs/cleanups spotted during the sweep — track separately)

- **`src/operator/TeamManagement.tsx`** — `handleImportTeams` is a dead stub that fakes
  success. Decide: wire it up or remove it.
- **`src/api/queries/players.ts:396`** — `markMembershipPaid` uses
  `toISOString().split('T')[0]`, violating the project timezone-safe-date rule; should use
  `formatLocalDate`.
- **`src/components/RegisterPlayerModal.tsx`** — possibly dead code now that
  InvitePlayerModal owns placeholder invites. Verify before investing.
