<!-- markdownlint-disable MD024 -->
# Screen consistency & ease-of-use audit

> **Status:** active. Started 2026-05-24.
> **Plan:** [`docs/plans/2026-05-24-001-refactor-screen-consistency-audit-plan.md`](../plans/2026-05-24-001-refactor-screen-consistency-audit-plan.md)
> **Origin requirements:** [`docs/brainstorms/2026-05-24-screen-consistency-audit-requirements.md`](../brainstorms/2026-05-24-screen-consistency-audit-requirements.md)
> **Auto-scan findings (regenerated):** [`docs/audits/scan-findings.md`](scan-findings.md) — run `pnpm audit:scan` to refresh.

This file is the living checklist for the cross-app polish pass. The auto-scan
in `scan-findings.md` covers the mechanical violations; this file tracks the
manual rubric pass per screen, status, and deferrals.

---

## How to use this doc

For each screen:

1. Open the linked component file. Cross-reference `scan-findings.md` for the
   findings on that file.
2. Boot the dev server (`pnpm dev`), navigate to the screen in **both light
   and dark mode**, and walk the rubric below.
3. For each rubric item, mark `[x]` pass, `[ ]` pending, or `[N/A]` not
   applicable with a one-line reason.
4. Resolve scan findings inline as you go — or use the deferral protocol below.
5. Flip the screen's **Status** to one of: `⏳ pending` · `🟡 in progress` ·
   `🟠 cascade-fixed, awaiting verify` · `✅ done` · `🚫 skipped`.
6. Commit per screen (or per cluster of related screens, capped ~300 LOC),
   referencing the screen's heading in the PR description.

**Deferral protocol** — if a finding can't be fixed in the current PR:

```markdown
> ⚠ Deferred: <one-line reason>. Follow-up: <issue link or TODO line ref>.
```

Add the deferral to the **Deferrals appendix** at the bottom of this file so
the closeout pass can review every open item.

---

## Conventions & exception policy

- **Color tokens are the single source of truth.** When migrating a hardcoded
  shade, pick the semantic theme token (`bg-success/10`, `text-info`,
  `border-warning/40`, `text-destructive`, `text-primary`) based on the
  meaning of the element — not literal color match.
- **shadcn primitives only.** Replace native `<button>` / `<input>` /
  `<select>` / `<label>` with shadcn `Button` / `Input` / `Select` / `Label`.
  Exception: native elements inside an `asChild` slot (intentional).
- **Behavior changes allowed for primitive swaps.** Native → shadcn changes
  keyboard / focus / event semantics — accepted as an upgrade, not a
  regression.
- **Cascade-first overrides impact-first** for the top 3 shared components
  (`PageHeader`, `InfoButton`, `StatsNavBar`). After those land, screen order
  follows highest-impact-first.
- **Multi-screen cascade PRs** set affected screen statuses to
  `🟠 cascade-fixed, awaiting verify`. Only the per-screen pass flips ✅.

---

## Rubric — pass/fail definitions

| # | Item | Pass when | N/A when |
|---|---|---|---|
| 1 | **Color tokens** | No findings in `scan-findings.md` for this file, OR each remaining flag has a one-line justification (e.g. semantic neutral like the search-highlight `<mark>`) | n/a |
| 2 | **Component primitives** | No `<button>` / `<input>` / `<select>` / `<label>` findings, OR each instance is intentional (`asChild` slot) | Screen renders no form/button surfaces |
| 3 | **Active/hover states** | Nav-like elements use `hover:bg-primary/10`; active state `bg-primary/15 font-semibold`. Other buttons use shadcn `<Button>` variants | Screen has no interactive nav elements |
| 4 | **Spacing rhythm** | Padding/gap classes consistent within the screen; container width matches sibling pages in same area | n/a — always evaluable |
| 5 | **Empty state** | Renders a friendly empty UI when data is absent or empty | Screen renders no list/grid/data view |
| 6 | **Loading state** | Async fetches render a skeleton or spinner | Screen does no async fetch |
| 7 | **Error state** | Async errors render a fallback (not blank, not console-only) | Screen does no async fetch |
| 8 | **PageHeader correct** | Imports `<PageHeader>` with correct `title`, `backTo` where contextually expected, `subtitle` where useful, `organizationId` on operator pages | Screen is intentionally chromeless (e.g. auth flows, splash). Document the omission inline |

---

## Look-for-these (manual eyeball, not in the scan)

While auditing, keep a lookout for these — the auto-scan can't catch them:

- Spacing / typography drift across sibling pages
- Hover with stale colors painted by a parent over a shadcn `Button`
- Lucide icon size / stroke inconsistency
- Button hierarchy (two primary CTAs in one view)
- Card density & border-radius drift
- `PageHeader` prop misuse (stale `backTo`, missing `organizationId`)
- Loading skeleton ↔ final layout mismatch (layout shift)
- Mobile drawer parity (pages with custom headers may bypass the unified drawer)
- Toast / notification one-off styling
- Form validation messages using `text-red-600 dark:text-red-400` (has dark pair, but wrong token — should be `text-destructive`)
- Cascade-introduced regressions in either light or dark mode after a shared-component PR lands

---

## Cascade priority

These are the highest-leverage targets — fixing each cascades the fix into
many consumers automatically. **Audit and fix in this order before the
per-screen sweep begins in earnest.**

| Order | Component | Consumers | Status |
|---|---|---|---|
| 1 | `src/components/PageHeader.tsx` | 39 | ✅ done (PR — chore/audit-page-header) |
| 2 | `src/components/InfoButton.tsx` | 22 | ✅ done (PR #137) |
| 3 | `src/components/StatsNavBar.tsx` | 4 | ✅ done (PR — chore/audit-stats-nav-bar) |
| 4 | `src/components/PlayerNameLink.tsx` | 5 | ⏳ pending |
| 5 | `src/components/playoff/PlayoffTemplateSelector.tsx` | 4 | ⏳ pending |
| 6 | `src/components/playoff/PlayoffSettingsCard.tsx` | 4 | ⏳ pending |
| 7 | `src/components/playoff/PlayoffMatchRulesCard.tsx` | 4 | ⏳ pending |
| 8 | `src/components/operator/DashboardCard.tsx` | 4 | ⏳ pending |
| 9 | `src/components/MemberCombobox.tsx` | 4 | ⏳ pending |
| 10 | `src/components/UnsavedChangesDialog.tsx` | 3 | ⏳ pending |
| 11 | `src/components/playoff/PlayoffBracketPreviewCard.tsx` | 3 | ⏳ pending |
| 12 | `src/components/operator/VenueCreationModal.tsx` | 3 | ⏳ pending |

Re-run `pnpm audit:scan` after each cascade PR — the table will update with new counts.

---

## Cascade-fix log

### `InfoButton` — 2026-05-24 — branch `chore/audit-info-button`

**Rubric pass:**

- [x] 1. Color tokens — fixed L139 (`bg-blue-100 text-blue-600 hover:bg-blue-200` → `bg-info/15 text-info hover:bg-info/25 transition-colors`). Picked `text-info` over `text-primary` because this is informational chrome, semantically distinct from brand-nav. Also fixed a no-op hover on the close × button (`hover:text-muted-foreground` → `hover:text-foreground`).
- [x] 2. Component primitives — two native `<button>` elements remain (round "?" trigger + close ×), both intentional: tightly-styled small elements where a shadcn `Button` swap would obscure intent. Documented as exceptions per the conventions.
- [x] 3. Active/hover states — popup trigger now uses `bg-info/15 text-info hover:bg-info/25 transition-colors`; close × uses `text-muted-foreground hover:text-foreground transition-colors`.
- [x] 4. Spacing rhythm — popup uses `p-4`, `mb-2`, `w-80` consistently; trigger has size-variant `w-4 h-4` / `w-6 h-6`.
- [N/A] 5. Empty state — no data view.
- [N/A] 6. Loading state — synchronous render.
- [N/A] 7. Error state — synchronous render.
- [N/A] 8. PageHeader correct — this is a helper, not a page.

**Consumers downstream (22 importers, page-level surfaces below):**

Direct page-level: `ScoreMatch`, `NewPlayerForm`, `FeatsOfExcellence`, `LeagueDetail`, `OrganizationPlayoffSettings`, `SeasonScheduleManager`, `ScheduleSetupPage` (via `ScheduleSetup`), `TeamManagement`, `PlayerManagement`, `LeaguePlayoffSettings`, `SeasonCreationWizard`, `PlayoffsSetupWizard`, `PlayoffSetup`. Transitive (via shared components like `wizard/*`, `lineup/*`, `season/*`, `operator/preferences/*`, `FormField`, `PersonalInfoSection`): also `Profile`, `LeagueWizardV2Page` (and its sub-wizards), and any operator preferences/settings flows.

Wherever an InfoButton "?" appears on screen, it now reads as the punchier `info` blue (distinct from the Simonis-blue nav). Pages affected flip to **🟠 cascade-fixed, awaiting verify** below.

### `StatsNavBar` — 2026-05-24 — branch `chore/audit-stats-nav-bar`

**Rubric pass:**

- [x] 1. Color tokens — fixed L75 active-tab styling (`border-blue-600 text-blue-600` → `border-primary text-primary`). Zero remaining findings on this file.
- [x] 2. Component primitives — four native `<button>` elements (one per tab). Documented exception: tab-style triggers with border-underline transitions don't map cleanly to shadcn `Button` variants; the styling is tightly coupled to the tab pattern.
- [x] 3. Active/hover states — active tab uses `border-primary text-primary font-semibold` (Simonis blue underline + text). Inactive hover uses `hover:text-foreground hover:border-border`, which is the standard tab convention (text strengthens + border hint appears) rather than the sidebar `hover:bg-primary/10` pattern. Internally consistent and uses brand tokens.
- [x] 4. Spacing rhythm — `gap-1` between tabs, `px-4 py-3` per tab, `mb-6 -mx-4 px-4` on the container. Consistent.
- [N/A] 5. Empty state — purely structural nav, no data.
- [N/A] 6. Loading state — no async.
- [N/A] 7. Error state — no async.
- [N/A] 8. PageHeader correct — this is a helper, not a page.

**Consumers downstream (4 importers):**

`Standings`, `TopShooters`, `TeamStats`, `FeatsOfExcellence`. All four stats-detail pages get the Simonis-blue active-tab styling for free. They flip to **🟠 cascade-fixed, awaiting verify** below (FeatsOfExcellence was already flipped by the InfoButton cascade — adds another reason).

---

## Status legend

- ⏳ **pending** — not started
- 🟡 **in progress** — actively being audited / fixed
- 🟠 **cascade-fixed, awaiting verify** — shared-component PR landed; needs per-screen visual confirmation
- ✅ **done** — all rubric items checked or N/A; findings resolved or deferred
- 🚫 **skipped** — out of scope for this audit (dev-only, redirect-only, etc.)

---

## Screens

Ordered highest-impact first. ~58 routes collapse to ~54 entries (some routes share a component).

### Wave 1 — Player core (5)

#### `MyMatch`

- **Routes:** `/my-match`
- **Component:** `src/player/MyMatch.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `MyTeams`

- **Routes:** `/my-teams`
- **Component:** `src/player/MyTeams.tsx`
- **Status:** ✅ done (PR — chore/audit-my-teams) — **pilot screen** for the per-screen sweep
- **Rubric:**
  - [x] 1. Color tokens — fixed 8 findings, all migrated to status tokens with semantic intent: `SETUP INCOMPLETE` badge → `text-warning bg-warning/15`; MAKEUP tag → `text-warning bg-warning/15`; UPCOMING/IN PROGRESS tag → `text-info bg-info/15`; Quick Score buttons → `text-warning hover:bg-warning/10` / `text-info hover:bg-info/10`; Team Setup Incomplete callout → `bg-warning/10 border-warning/40 text-warning`; captain self-highlight → `text-primary`. Zero remaining findings.
  - [x] 2. Component primitives — uses shadcn `Button`, `Card`, `Accordion`. One exception: Quick Score uses `<div role="button">` because it sits inside an `AccordionTrigger` (a `<button>`) and HTML forbids nested buttons. See deferrals.
  - [x] 3. Active/hover states — Quick Score buttons now use `hover:bg-{warning|info}/10` (token-based); shadcn `Button` variants used elsewhere. No nav-like elements on this screen.
  - [x] 4. Spacing rhythm — accordion uses `space-y-4`; per-item `pl-4 pr-1 py-4`; content `px-4 pb-4 pt-2 space-y-4`. Container `max-w-2xl mx-auto px-4 py-6` matches `TeamSchedule` (sibling player page). Consistent.
  - [x] 5. Empty state — friendly "You are not currently on any teams" card with Users icon (L466-472).
  - [x] 6. Loading state — "Loading your teams..." text. Functional but minimal — could be a skeleton; deferred polish.
  - [x] 7. Error state — `text-destructive` error message on fetch failure (L440-446).
  - [x] 8. PageHeader correct — `<PageHeader title="My Teams" />`. No `backTo` (correct — top-level destination); no `subtitle` (acceptable, optional); no `organizationId` (correct — player-scoped, multi-org).
- **Deferred (not in scope for this audit):**
  - **`<div role="button">` for Quick Score** (L246-266) — nested interactive workaround inside `AccordionTrigger`. Real fix would restructure so Quick Score lives outside the trigger. Tracked for a follow-up component refactor.
  - **`window.location.href` for navigation** (L256, L286, L380) — full-page reload instead of React Router `useNavigate`. Three call sites. Pre-existing pattern; not introduced or worsened here.
  - **Minimal loading state** — text-only "Loading your teams..." could be a skeleton. Polish, not consistency.
- **Pilot workflow notes:**
  - Per-screen entries are best as a "Status + rubric + Deferred + Notes" 4-block structure (vs the cascade-fix log's "Rubric pass + Consumers downstream"). Different shape, same spirit.
  - Workflow per screen took ~15 min: read file → cross-reference scan findings → fix → re-scan → update checklist. Manageable.
  - Status-token mapping isn't always 1:1 with the original color: `yellow` could map to `warning` (status) or kept as text-foreground (body). Semantic choice matters more than literal color match — repeated the guideline from conventions.

#### `TeamSchedule`

- **Routes:** `/team/:teamId/schedule`
- **Component:** `src/player/TeamSchedule.tsx`
- **Status:** ⏳ pending — partial fixes already landed in IA branch (status cards migrated to status tokens); re-audit
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `MatchLineup`

- **Routes:** `/match/:matchId/lineup`
- **Component:** `src/player/MatchLineup.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>` (rubric 8 risk)
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `ScoreMatch`

- **Routes:** `/match/:matchId/score`
- **Component:** `src/player/ScoreMatch.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton), awaiting verify — also flagged as bypassing `<PageHeader>` (rubric 8 risk)
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

### Wave 2 — Player social, stats, live (5)

#### `Messages`

- **Routes:** `/messages`
- **Component:** `src/pages/Messages.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `Profile`

- **Routes:** `/profile`
- **Component:** `src/profile/Profile.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton, via PersonalInfoSection), awaiting verify — recently restructured; Theme + Sign Out section added
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `PlayerStats`

- **Routes:** `/stats`
- **Component:** `src/player/PlayerStats.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `SpectateMyLiveMatches`

- **Routes:** `/live`
- **Component:** `src/player/SpectateMyLiveMatches.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `SpectateLiveMatches`

- **Routes:** `/league/:leagueId/live`
- **Component:** `src/player/SpectateLiveMatches.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

### Wave 3 — Operator main (5)

#### `OperatorDashboard`

- **Routes:** `/operator-dashboard/:orgId`
- **Component:** `src/operator/OperatorDashboard.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify — has tabbed inner views; audit each visible tab as a sub-section
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `OperatorWelcome`

- **Routes:** `/operator-welcome`
- **Component:** `src/operator/OperatorWelcome.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>` (rubric 8 risk)
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `PlayerManagement`

- **Routes:** `/manage-players/:orgId`
- **Component:** `src/operator/PlayerManagement.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify — scan flagged 6+ color findings still inline
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `LeagueDetail`

- **Routes:** `/league/:leagueId`
- **Component:** `src/operator/LeagueDetail.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton), awaiting verify
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

#### `LeagueSettings`

- **Routes:** `/league/:leagueId/settings`
- **Component:** `src/operator/LeagueSettings.tsx`
- **Status:** ⏳ pending
- **Rubric:**
  - [ ] 1. Color tokens
  - [ ] 2. Component primitives
  - [ ] 3. Active/hover states
  - [ ] 4. Spacing rhythm
  - [ ] 5. Empty state
  - [ ] 6. Loading state
  - [ ] 7. Error state
  - [ ] 8. PageHeader correct
- **Notes:**

### Wave 4 — Other operator (12)

#### `ReportsManagement`

- **Routes:** `/operator-reports/:orgId`
- **Component:** `src/operator/ReportsManagement.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template — see header)_
- **Notes:**

#### `OrganizationSettings`

- **Routes:** `/operator-settings/:orgId`
- **Component:** `src/operator/OrganizationSettings.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `OrganizationPlayoffSettings`

- **Routes:** `/operator-settings/:orgId/playoffs`
- **Component:** `src/operator/OrganizationPlayoffSettings.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `LeagueRules`

- **Routes:** `/league-rules/:orgId`
- **Component:** `src/operator/LeagueRules.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `LeaguePlayoffSettings`

- **Routes:** `/operator/league/:leagueId/playoffs/:orgId`
- **Component:** `src/operator/LeaguePlayoffSettings.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `PlayoffSetup`

- **Routes:** `/league/:leagueId/season/:seasonId/playoffs`
- **Component:** `src/operator/PlayoffSetup.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `PlayoffsSetupWizard`

- **Routes:** `/league/:leagueId/season/:seasonId/playoffs-setup`
- **Component:** `src/operator/PlayoffsSetupWizard.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify — single-page "wizard"
- **Rubric:** _(8-item template)_
- **Notes:**

#### `ScheduleSetupPage`

- **Routes:** `/league/:leagueId/season/:seasonId/schedule-setup`
- **Component:** `src/operator/ScheduleSetupPage.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton, via ScheduleSetup), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `SeasonSchedulePage`

- **Routes:** `/league/:leagueId/season/:seasonId/schedule`
- **Component:** `src/operator/SeasonSchedulePage.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `SeasonScheduleManager`

- **Routes:** `/league/:leagueId/season/:seasonId/manage-schedule`
- **Component:** `src/operator/SeasonScheduleManager.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton), awaiting verify — page has its own fixed bottom action bar (tab bar hidden)
- **Rubric:** _(8-item template)_
- **Notes:**

#### `SeasonCreationWizard`

- **Routes:** `/league/:leagueId/create-season`
- **Component:** `src/operator/SeasonCreationWizard.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton), awaiting verify — audit shell + 1–2 sample steps; full step audit deferred
- **Rubric:** _(8-item template)_
- **Notes:**

#### `TeamManagement`

- **Routes:** `/league/:leagueId/manage-teams`
- **Component:** `src/operator/TeamManagement.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify — page has its own fixed bottom action bar (tab bar hidden)
- **Rubric:** _(8-item template)_
- **Notes:**

#### `VenueManagement`

- **Routes:** `/venues/:orgId`
- **Component:** `src/operator/VenueManagement.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 5 — Onboarding (4)

#### `CompleteProfileForm`

- **Routes:** `/complete-profile`
- **Component:** `src/completeProfile/CompleteProfileForm.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `NewPlayerForm`

- **Routes:** `/new-player`
- **Component:** `src/newPlayer/NewPlayerForm.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton, via FormField), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `BecomeLeagueOperator`

- **Routes:** `/become-league-operator`
- **Component:** `src/leagueOperator/BecomeLeagueOperator.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `LeagueOperatorApplication`

- **Routes:** `/league-operator-application`
- **Component:** `src/leagueOperator/LeagueOperatorApplication.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 6 — Auth flows (6)

#### `Login`

- **Routes:** `/login`
- **Component:** `src/login/Login.tsx`
- **Status:** ⏳ pending — likely chromeless (no PageHeader); document omission on rubric 8
- **Rubric:** _(8-item template)_
- **Notes:**

#### `Register`

- **Routes:** `/register`
- **Component:** `src/login/Register.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `ForgotPassword`

- **Routes:** `/forgot-password`
- **Component:** `src/login/ForgotPassword.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `ResetPassword`

- **Routes:** `/reset-password`
- **Component:** `src/login/ResetPassword.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `EmailConfirmation`

- **Routes:** `/confirm`
- **Component:** `src/login/EmailConfirmation.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `ClaimPlayer`

- **Routes:** `/claim-player`
- **Component:** `src/login/ClaimPlayer.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 7 — Public / marketing (3)

#### `Home`

- **Routes:** `/`
- **Component:** `src/home/Home.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `About`

- **Routes:** `/about`
- **Component:** `src/about/About.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

#### `Pricing`

- **Routes:** `/pricing`
- **Component:** `src/about/Pricing.tsx`
- **Status:** ⏳ pending
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 8 — Info / format pages (3)

#### `FiveManFormatDetails`

- **Routes:** `/5-man-format-details`
- **Component:** `src/info/FiveManFormatDetails.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>`; lots of color findings (20+)
- **Rubric:** _(8-item template)_
- **Notes:**

#### `EightManFormatDetails`

- **Routes:** `/8-man-format-details`
- **Component:** `src/info/EightManFormatDetails.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>`; ~8 color findings
- **Rubric:** _(8-item template)_
- **Notes:**

#### `FormatComparison`

- **Routes:** `/format-comparison`
- **Component:** `src/info/FormatComparison.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>`; ~13 color findings (table-heavy)
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 9 — Stats detail (5)

#### `Standings`

- **Routes:** `/league/:leagueId/season/:seasonId/standings`
- **Component:** `src/pages/Standings.tsx`
- **Status:** 🟠 cascade-fixed (StatsNavBar), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `TopShooters`

- **Routes:** `/league/:leagueId/season/:seasonId/top-shooters`
- **Component:** `src/pages/TopShooters.tsx`
- **Status:** 🟠 cascade-fixed (StatsNavBar), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `TeamStats`

- **Routes:** `/league/:leagueId/season/:seasonId/team-stats`
- **Component:** `src/pages/TeamStats.tsx`
- **Status:** 🟠 cascade-fixed (StatsNavBar), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `FeatsOfExcellence`

- **Routes:** `/league/:leagueId/season/:seasonId/feats`
- **Component:** `src/pages/FeatsOfExcellence.tsx`
- **Status:** 🟠 cascade-fixed (InfoButton + StatsNavBar), awaiting verify
- **Rubric:** _(8-item template)_
- **Notes:**

#### `MatchDataViewer`

- **Routes:** `/league/:leagueId/season/:seasonId/match-data`
- **Component:** `src/pages/MatchDataViewer.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>`
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 10 — Player detail (1)

#### `PlayerProfile`

- **Routes:** `/player/:playerId`
- **Component:** `src/pages/PlayerProfile.tsx`
- **Status:** ⏳ pending — flagged as bypassing `<PageHeader>`
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 11 — Rules (1 entry, 3 routes)

#### `RulesPage / RuleDetailPage / HouseRuleDetailPage`

- **Routes:** `/rules`, `/rules/:game/:ruleId`, `/rules/house/:scope/:scopeId/:ruleId`
- **Components:**
  - `src/rules/RulesPage.tsx`
  - `src/rules/RuleDetailPage.tsx`
  - `src/rules/HouseRuleDetailPage.tsx`
- **Status:** ⏳ pending — recent IA work expanded container to `max-w-4xl` and merged chip rows
- **Rubric:** _(8-item template)_
- **Notes:**

### Wave 12 — Wizards (1)

#### `LeagueWizardV2Page`

- **Routes:** `/create-league/:orgId`
- **Component:** `src/wizards/league-v2/LeagueWizardV2Page.tsx`
- **Status:** 🟠 cascade-fixed (PageHeader org badge), awaiting verify — single audit entry for the page chrome + `WizardFlowShell`. Composes 27 sub-steps via `createNewLeagueFlow` (league/schedule/teams/matchups). Per-step audit is deferred to a follow-up.
- **Rubric:** _(8-item template)_
- **Notes:**

---

## Out-of-scope (logged for completeness)

| Route | Component | Reason |
|---|---|---|
| `/dashboard` | _(redirect)_ | Redirects to `/my-teams` — no UI surface |
| `/test/handicap-lookup` | `src/pages/HandicapLookupTest.tsx` | Dev test page |
| `/dev/rls-tests` | `src/dev/RLSTestPage.tsx` | Dev-only (DevOnly gate) |
| `/admin-reports` | `src/pages/AdminReports.tsx` | Developer-only gate; deferred |

---

## Deferred follow-ups (out of v1 scope)

- **Wizard sub-step audit** — each step within `LeagueWizardV2Page` and `SeasonCreationWizard`.
- **Modal audit** — all modals in `src/components/modals/`, `src/components/messages/*Modal.tsx`, etc.
- **Role-gated state audit** — loading spinners and access-denied views from `<ProtectedRoute>`.
- **404 / not-found** — no page currently exists; design + ship as a separate task.
- **Comprehensive rubric (a11y, copy, mobile-responsive QA)** — once Standard reveals systemic gaps.
- **Lint rule** — add `no-restricted-syntax` ESLint rule for hardcoded-shade patterns once Phase 4 is well underway.

---

## Deferrals appendix

_Per-screen deferrals tracked here. Format: `[screen] reason → follow-up reference`._

_(empty)_
