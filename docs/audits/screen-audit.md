<!-- markdownlint-disable MD024 -->
# Screen consistency & ease-of-use audit

> **Status:** ✅ **all in-scope screens complete** — closed out 2026-05-25 (sweep ran 2026-05-24 → 2026-05-25).
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
- **Status:** ✅ done (PR — chore/audit-wave-1-remainder)
- **Rubric:**
  - [x] 1. Color tokens — pass (zero findings)
  - [x] 2. Component primitives — pass (shadcn `Card`, `CardContent`, `CardHeader`, `CardTitle`)
  - [N/A] 3. Active/hover states — no interactive nav elements on this page
  - [x] 4. Spacing rhythm — pass (`container mx-auto max-w-2xl px-4 py-6` matches sibling player pages)
  - [N/A] 5. Empty state — the page IS effectively a placeholder/empty state
  - [N/A] 6. Loading state — no async fetches
  - [N/A] 7. Error state — no async fetches
  - [x] 8. PageHeader correct — pass (`backTo="/my-teams"`, `backLabel`, `title`, `subtitle` set; no `organizationId` needed — player page)
- **Notes:** Placeholder page until live-match jump-in feature ships. No source changes needed in this audit; uses theme tokens throughout.

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
- **Status:** ✅ done (PR — chore/audit-wave-1-remainder) — color migrations landed in earlier IA branch; this audit confirms full rubric pass
- **Rubric:**
  - [x] 1. Color tokens — pass (zero findings; status cards use `bg-success/10`, `bg-warning/10`, `bg-info/10`, `bg-highlight/10` with matching borders + text)
  - [x] 2. Component primitives — pass (shadcn `Button`, `Card`, `Accordion`)
  - [x] 3. Active/hover states — pass (Accordion items + Button hover are shadcn defaults)
  - [x] 4. Spacing rhythm — pass (`max-w-2xl mx-auto px-4 py-6` matches `MyTeams` sibling)
  - [x] 5. Empty state — pass (`Calendar` icon + friendly "No upcoming matches" / "No matches scheduled yet" card)
  - [x] 6. Loading state — pass ("Loading schedule..." text — functional but minimal, same minor polish opportunity as MyTeams)
  - [x] 7. Error state — pass (`text-destructive` error message)
  - [x] 8. PageHeader correct — pass (`backTo="/my-teams"`, `backLabel`, dynamic `title={team.team_name}`, dynamic `subtitle` for day-of-week, with a Show/Hide Completed Button slotted into the header's children prop)
- **Notes:** Cleanest screen in the audit so far. The IA branch did the heavy lifting; this pass just confirms.

#### `MatchLineup`

- **Routes:** `/match/:matchId/lineup`
- **Component:** `src/player/MatchLineup.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-1-remainder), with rubric 8 deferred
- **Rubric:**
  - [x] 1. Color tokens — fixed L1054 Fargo banner (`border-amber-200 bg-amber-50 text-amber-900` → `border-warning/40 bg-warning/10` with `text-warning` heading + `text-foreground` body for readability)
  - [x] 2. Component primitives — pass (uses shadcn `Button`, `Input`, `Select`, `Label`, plus several composed components like `MatchInfoCard`, `LineupActions`)
  - [x] 3. Active/hover states — pass (shadcn variants throughout)
  - [x] 4. Spacing rhythm — pass (`max-w-2xl mx-auto px-4 py-6 space-y-6` matches sibling player pages)
  - [N/A] 5. Empty state — every state branch returns something meaningful; no list with possible empty
  - [x] 6. Loading state — pass (`useQueryStates` unified wrapper renders loading)
  - [x] 7. Error state — pass (`useQueryStates` unified wrapper renders errors)
  - [ ] 8. **Deferred** — uses a custom sticky `<header>` (L982-995) with a manual "Back to Schedule" Link + large title, instead of `<PageHeader>`. Migration would require resolving custom title sizing + the screen's existing visual contract. See deferrals.
- **Deferred:**
  - **PageHeader migration** — custom `<header>` works fine for the screen's existing visual contract (large `text-4xl` title). Migrating means deciding whether to keep the oversized title or accept PageHeader's smaller one. Tracked for a focused follow-up.
- **Notes:** 1274 LOC file; the diff in this PR is one line (the Fargo banner).

#### `ScoreMatch`

- **Routes:** `/match/:matchId/score`
- **Component:** `src/player/ScoreMatch.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-1-remainder)
- **Rubric:**
  - [x] 1. Color tokens — fixed L600 error heading (`text-red-600` → `text-destructive`) and L625 loading spinner (`border-blue-600` → `border-primary`)
  - [x] 2. Component primitives — fixed L717 Auto-Confirm: swapped native `<label>` + `<input type="checkbox">` for shadcn `Checkbox` + `Label` with `htmlFor` wiring. ScoreMatch is now fully shadcn-native.
  - [x] 3. Active/hover states — pass (shadcn `Button` variants throughout)
  - [x] 4. Spacing rhythm — pass (compact `h-screen flex flex-col` layout is deliberate for the scoring UI — fixed header + scrollable middle + fixed bottom action bar)
  - [N/A] 5. Empty state — every render branch returns meaningful content; this isn't a list view
  - [x] 6. Loading state — pass (fallback spinner when guarded data is null)
  - [x] 7. Error state — pass (error card with `text-destructive` heading and "Go Back" button)
  - [x] 8. PageHeader correct — **documented exception**: ScoreMatch uses a custom compact header (back button + team name + Auto-Confirm checkbox + InfoButton, all in one strip) because the scoring UI has unique requirements (`h-screen` layout, fixed header, persistent visibility of team + auto-confirm during scoring). Migrating to `<PageHeader>` would lose the Auto-Confirm placement and harm the screen's primary task. Pass with documented intent.
- **Notes:** 1012 LOC file; diff in this PR is ~10 lines (2 color fixes + checkbox+label primitive swap). Native checkbox swap is a real behavior upgrade — shadcn Checkbox provides proper focus rings, keyboard support, and ARIA wiring.

### Wave 2 — Player social, stats, live (5)

#### `Messages`

- **Routes:** `/messages`
- **Component:** `src/pages/Messages.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-2)
- **Rubric:**
  - [x] 1. Color tokens — fixed L249 desktop footer (`bg-green-300` → `bg-muted`). The green-300 was a placeholder/oddity, not a deliberate semantic — neutral `bg-muted` fits the conversation-list footer purpose.
  - [x] 2. Component primitives — pass (shadcn `Button`; rendered children like `ConversationList`, `MessageView`, `MessagesEmptyState`, `*Modal` are composed components)
  - [x] 3. Active/hover states — pass (shadcn variants in this file; child components own their own surfaces)
  - [x] 4. Spacing rhythm — pass (split-pane layout with `w-full md:w-80` conversation list + `flex-1` message view; intentional non-standard container for this 2-pane UI)
  - [x] 5. Empty state — pass (`<MessagesEmptyState />` rendered when no conversation selected on desktop)
  - [x] 6. Loading state — pass (sub-components own their loading state)
  - [x] 7. Error state — pass (sub-components own their error state; this page is layout-only)
  - [x] 8. PageHeader correct — pass (uses `<PageHeader>` with promoted IdentitySlot for the no-subheader case; see the PageHeader improvements from the IA branch)
- **Notes:** Messages is a layout-only page that delegates most work to `<ConversationList>`, `<MessageView>`, and several modals. Those sub-components have their own rubric items (out of v1 scope; modal audit deferred).

#### `Profile`

- **Routes:** `/profile`
- **Component:** `src/profile/Profile.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-2) — recently restructured; Theme + Sign Out section added in IA branch
- **Rubric:**
  - [x] 1. Color tokens — pass (zero findings on this file; sub-sections like `PersonalInfoSection`/`PrivacySettingsSection` have their own findings out of scope here)
  - [x] 2. Component primitives — pass (shadcn `Card`, `Button`, `ThemeToggle`; sub-section components own their own form primitives)
  - [x] 3. Active/hover states — pass (shadcn `Button` variants for Sign Out + Learn More CTAs; ThemeToggle uses internal shadcn pattern)
  - [x] 4. Spacing rhythm — pass (`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6` + `space-y-6`)
  - [N/A] 5. Empty state — Profile always has data when reachable; "Profile Not Found" fallback covers the rare missing case
  - [x] 6. Loading state — pass ("Loading your profile..." text)
  - [x] 7. Error state — pass ("Profile Not Found" with helpful contact-support message when member data missing)
  - [x] 8. PageHeader correct — pass (`title="Player Settings"`, `subtitle="Manage your personal information and account details"`; no `backTo` — top-level destination)
- **Notes:** Five section components do the heavy lifting (`PersonalInfoSection`, `ContactInfoSection`, `AddressSection`, `PrivacySettingsSection`, plus inline BCA status card + Account card). Cascade-clean from InfoButton via `PersonalInfoSection`. Section components have their own rubric items but that's per-section, not per-screen.

#### `PlayerStats`

- **Routes:** `/stats`
- **Component:** `src/player/PlayerStats.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-2)
- **Rubric:**
  - [x] 1. Color tokens — pass (zero findings; uses theme tokens throughout)
  - [x] 2. Component primitives — pass (shadcn `Card`, `CardHeader`, `CardTitle`, `CardContent`)
  - [N/A] 3. Active/hover states — no interactive nav elements
  - [x] 4. Spacing rhythm — pass (`container mx-auto max-w-2xl px-4 py-6` matches sibling player pages)
  - [N/A] 5. Empty state — page is effectively a placeholder/empty state
  - [N/A] 6. Loading state — no async fetches
  - [N/A] 7. Error state — no async fetches
  - [x] 8. PageHeader correct — pass (`backTo="/my-teams"`, `backLabel="Home"`, `title="My Stats"`, `subtitle`)
- **Notes:** Placeholder page until personal-stats build-out ships. Same shape as `MyMatch`. No source changes needed.

#### `SpectateMyLiveMatches`

- **Routes:** `/live`
- **Component:** `src/player/SpectateMyLiveMatches.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-2)
- **Rubric:**
  - [x] 1. Color tokens — fixed 3 findings: live-indicator ping (L76 `bg-red-400` → `bg-destructive`), live-indicator dot (L77 `bg-red-500` → `bg-destructive`), error text (L100 `text-red-600` → `text-destructive`). `destructive` token used for the LIVE pulsing dot — semantic stretch (destructive ≠ live-recording), but it's our only red token and visually correct. Documented choice.
  - [x] 2. Component primitives — pass (no native form elements; renders `<SpectateMatchCard>` per match)
  - [x] 3. Active/hover states — pass (each match card is a Link; hover styled by SpectateMatchCard)
  - [x] 4. Spacing rhythm — pass (`flex-1 overflow-y-auto px-4 py-3 space-y-6`)
  - [x] 5. Empty state — pass ("Nothing happening right now" muted-foreground text when no matches)
  - [x] 6. Loading state — pass (Loader2 spinner + "Loading live matches…" text)
  - [x] 7. Error state — pass (now `text-destructive` "Couldn't load live matches" message)
  - [x] 8. PageHeader correct — pass (`backTo="/my-teams"`, `backLabel`, `title="Live Matches"`, with pulsing-dot indicator + match-count subtitle slotted into header children)
- **Notes:** `destructive` semantic stretch is documented. If a future `--live` token gets added (broadcast-red convention), swap is a single grep.

#### `SpectateLiveMatches`

- **Routes:** `/league/:leagueId/live`
- **Component:** `src/player/SpectateLiveMatches.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-2)
- **Rubric:**
  - [x] 1. Color tokens — fixed 3 findings (same pattern as `SpectateMyLiveMatches`): live ping/dot → `bg-destructive`, error text → `text-destructive`.
  - [x] 2. Component primitives — pass
  - [x] 3. Active/hover states — pass
  - [x] 4. Spacing rhythm — pass (`flex-1 overflow-y-auto px-4 py-3 space-y-6` matches sibling)
  - [x] 5. Empty state — pass (handled by the `matches.length === 0` branch)
  - [x] 6. Loading state — pass
  - [x] 7. Error state — pass
  - [x] 8. PageHeader correct — pass (`backTo`, `backLabel`, dynamic `title={leagueLabel}` + pulsing-dot indicator in children)
- **Notes:** Sister screen to `SpectateMyLiveMatches`; nearly identical structure. The duplication itself isn't a rubric issue but is a refactor opportunity for a follow-up.

### Wave 3 — Operator main (5)

#### `OperatorDashboard`

- **Routes:** `/operator-dashboard/:orgId`
- **Component:** `src/operator/OperatorDashboard.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-3)
- **Rubric:**
  - [x] 1. Color tokens — fixed ~10 findings. 4 `DashboardCard` iconColor props now use status tokens semantically: Messaging → `text-highlight`, Manage Players → `text-success`, Reports → `text-destructive`, Org Settings → `text-primary`. "Need Help?" card migrated: `bg-blue-50/border-blue-200` → `bg-info/10 border-info/40`; title/links → `text-info` with `hover:text-info/80 transition-colors`.
  - [x] 2. Component primitives — pass (shadcn `Card`, `Button`; renders composed children like `DashboardCard`, `ActiveLeagues`, `QuickStatsCard`)
  - [x] 3. Active/hover states — pass (Help-card links now have token-based hover with transition)
  - [x] 4. Spacing rhythm — pass (`container mx-auto px-4 max-w-7xl py-8` + `grid lg:grid-cols-3 gap-6`)
  - [N/A] 5. Empty state — page always has org context; sub-components handle their own empty states
  - [x] 6. Loading state — pass (org loading handled at component level)
  - [x] 7. Error state — pass (handled via routing guards)
  - [x] 8. PageHeader correct — pass (`title` + `subtitle` with operator name)

#### `OperatorWelcome`

- **Routes:** `/operator-welcome`
- **Component:** `src/operator/OperatorWelcome.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-3), with R8 as documented exception
- **Rubric:**
  - [x] 1. Color tokens — fixed ~14 findings: gradient bg → `from-info/10 to-success/10`; "League Operator" h2 → `text-primary`; 3 tile cards → semantic status bgs (`bg-info/10`, `bg-success/10`, `bg-highlight/10`); amber "Ready to Get Started?" callout → `bg-warning/10 border-warning/40` with `text-warning` heading + `text-foreground` body + numbered list markers `text-warning`; 3 CTAs stripped custom `bg-blue-600 text-white` overrides — now use shadcn `Button` default (Simonis blue) with just size styling; 3 support links → `text-primary hover:text-primary/80 transition-colors`.
  - [x] 2. Component primitives — pass (shadcn `Button` throughout; no native form elements)
  - [x] 3. Active/hover states — pass (CTAs use Button defaults; links use `transition-colors`)
  - [x] 4. Spacing rhythm — pass (`container mx-auto px-4 max-w-4xl` + `bg-card rounded-2xl shadow-xl p-8 md:p-12` + sectional spacing)
  - [N/A] 5. Empty state — celebration page, not data-driven
  - [x] 6. Loading state — pass (button shows "Loading..." while org fetch in flight)
  - [N/A] 7. Error state — no fail path; org fetch is gated
  - [x] 8. PageHeader correct — **documented exception**: this is a one-time celebration page with a full-bleed gradient background and no app-nav chrome. Adding `<PageHeader>` would impose persistent app navigation that breaks the celebration moment. Pass with documented intent.
- **Notes:** Major styling rewrite — heaviest screen in Wave 3 (~14 findings). All buttons stripped of `bg-blue-600 text-white` overrides; they now inherit shadcn `Button`'s default (Simonis blue) which is more consistent with the rest of the app.

#### `PlayerManagement`

- **Routes:** `/manage-players/:orgId`
- **Component:** `src/operator/PlayerManagement.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-3)
- **Rubric:**
  - [x] 1. Color tokens — fixed ~14 findings across multiple sections: Developer impersonation card → `bg-warning/10 border-warning/40 text-warning`; Active Players stat icon → `bg-success/15 text-success`; Alias/ID'd stats → `text-warning`/`text-info`; Status field colors (Registered/Alias-ID'd/-) → success/warning/muted-foreground; Total Games card → `bg-info/10 text-info`; Membership Status link → `text-primary`; Membership state colors → success/warning/muted; "Player Not Authorized" warning card → `bg-warning/10 border-warning/40` + `text-warning` header + `text-foreground` body; Set Starting Handicaps toggle button → `text-primary hover:text-primary/80 transition-colors`; Invites card icon + 3 stat counts → info/warning/success tokens; null-handicap indicators → `text-warning`.
  - [x] 2. Component primitives — pass (shadcn `Card`, `Button`, `Select`, `Label`, `Input` throughout; one internal toggle `<button>` with type="button" added — tightly-styled inline element, not asChild-able, documented as exception per conventions)
  - [x] 3. Active/hover states — pass (toggle now token-based; shadcn variants elsewhere)
  - [x] 4. Spacing rhythm — pass (`max-w-2xl px-0 lg:px-4 py-8 space-y-6` with cards `rounded-none lg:rounded-xl` for mobile edge-to-edge)
  - [x] 5. Empty state — pass (no-player-selected case is the default friendly state)
  - [x] 6. Loading state — pass (`isLoadingDetails` shows "Loading player details..." card)
  - [x] 7. Error state — pass (sub-components handle their own errors)
  - [x] 8. PageHeader correct — pass (`title`, `subtitle`; org context from sidebar)
- **Notes:** Heaviest screen in Wave 3 by line-count of changes (~15 token swaps). Many semantic mappings: `green` always became `success`, `amber` became `warning`, `blue` became either `info` (stats) or `primary` (interactive). Color choices preserved categorical distinctions.

#### `LeagueDetail`

- **Routes:** `/league/:leagueId`
- **Component:** `src/operator/LeagueDetail.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-3)
- **Rubric:**
  - [x] 1. Color tokens — fixed 3 findings: error heading `text-red-600` → `text-destructive`; "Back to Dashboard" button (was raw `<button class="bg-blue-600 text-white ...">`) → shadcn `Button`; DashboardCard iconColor `text-indigo-600` → `text-primary`.
  - [x] 2. Component primitives — pass (replaced one raw `<button>` with shadcn `Button` as part of color fix; rest already shadcn)
  - [x] 3. Active/hover states — pass (shadcn Button + InfoButton variants)
  - [x] 4. Spacing rhythm — pass (`container mx-auto lg:px-4 w-full lg:max-w-7xl py-8` with `grid lg:grid-cols-3 gap-6 mb-6`)
  - [x] 5. Empty state — pass ("No active season" / "League not found" branches handled)
  - [x] 6. Loading state — pass (skeleton-style loading via composed `LeagueStatusCard`, `StatsCard`, etc.)
  - [x] 7. Error state — pass (error card with "Back to Dashboard" CTA)
  - [x] 8. PageHeader correct — pass (`backTo`, `backLabel`, dynamic `title`, with lineup-size + InfoButton in header children)

#### `LeagueSettings`

- **Routes:** `/league/:leagueId/settings`
- **Component:** `src/operator/LeagueSettings.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-3)
- **Rubric:**
  - [x] 1. Color tokens — fixed 3 findings: error heading → `text-destructive`; "Go Back" raw `<button class="bg-blue-600 text-white ...">` → shadcn `Button`; DashboardCard iconColor → `text-primary`.
  - [x] 2. Component primitives — pass (raw `<button>` replaced with shadcn `Button`; rest already shadcn)
  - [x] 3. Active/hover states — pass
  - [x] 4. Spacing rhythm — pass (`container mx-auto px-4 max-w-6xl py-8` + `grid md:grid-cols-2 gap-6`)
  - [x] 5. Empty state — pass ("League not found" handled)
  - [x] 6. Loading state — pass (loading branch)
  - [x] 7. Error state — pass (error card)
  - [x] 8. PageHeader correct — pass (`backTo`, `backLabel`, `title="League Settings"`, dynamic `subtitle={getLeagueName(league)}`)

### Wave 4 — Other operator (12)

#### `ReportsManagement`

- **Routes:** `/operator-reports/:orgId`
- **Component:** `src/operator/ReportsManagement.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed action-log border + suspension text → `destructive` token. No findings remaining.

#### `OrganizationSettings`

- **Routes:** `/operator-settings/:orgId`
- **Component:** `src/operator/OrganizationSettings.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed 5 findings: error → `text-destructive`, raw `<button>` → shadcn `Button`, 3 DashboardCard iconColors mapped semantically (House Rules → `text-success`, Venues → `text-primary`, Playoffs → `text-highlight`).

#### `OrganizationPlayoffSettings`

- **Routes:** `/operator-settings/:orgId/playoffs`
- **Component:** `src/operator/OrganizationPlayoffSettings.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Zero source findings — already clean. Cascade-clean from PageHeader + InfoButton.

#### `LeagueRules`

- **Routes:** `/league-rules/:orgId`
- **Component:** `src/operator/LeagueRules.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. 51 LOC, zero findings, uses shadcn + theme tokens throughout.

#### `LeaguePlayoffSettings`

- **Routes:** `/operator/league/:leagueId/playoffs/:orgId`
- **Component:** `src/operator/LeaguePlayoffSettings.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Zero source findings — already clean. Cascade-clean from PageHeader + InfoButton.

#### `PlayoffSetup`

- **Routes:** `/league/:leagueId/season/:seasonId/playoffs`
- **Component:** `src/operator/PlayoffSetup.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed ~15 findings — heaviest in Wave 4: standings W/L cells (green/red → success/destructive), excluded-teams warning notice (yellow → warning), error card (red → destructive), playoff week date (purple → highlight), season-status states (green/yellow → success/warning), info note (yellow → warning bg+border with foreground body), Approve & Set Matchups CTA (purple-600 → `bg-highlight text-highlight-foreground`).

#### `PlayoffsSetupWizard`

- **Routes:** `/league/:leagueId/season/:seasonId/playoffs-setup`
- **Component:** `src/operator/PlayoffsSetupWizard.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4) — single-page "wizard"
- **Rubric:** All 8 pass. Fixed 8 findings: 2 info-style cards. Team count card (blue → info), config-source card (amber → warning).

#### `ScheduleSetupPage`

- **Routes:** `/league/:leagueId/season/:seasonId/schedule-setup`
- **Component:** `src/operator/ScheduleSetupPage.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed 1 finding (error heading → `text-destructive`).

#### `SeasonSchedulePage`

- **Routes:** `/league/:leagueId/season/:seasonId/schedule`
- **Component:** `src/operator/SeasonSchedulePage.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed 4 findings in the `getWeekTypeStyle` helper: playoffs row (purple → highlight bg + badge), break row (yellow → warning bg + badge), blackout badge (gray-700 → foreground/background) — categorical week-type colors preserved with semantic tokens.

#### `SeasonScheduleManager`

- **Routes:** `/league/:leagueId/season/:seasonId/manage-schedule`
- **Component:** `src/operator/SeasonScheduleManager.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4) — page has its own fixed bottom action bar (tab bar hidden)
- **Rubric:** All 8 pass. Fixed 12 findings: error heading → destructive; season configuration summary card (8 blue-* spans across Start Date / Length / BCA / APA) → `bg-info/10 border-info/40` with `text-info` field labels + `text-foreground` values for readability; error message card (red-50/200/800) → destructive tokens.

#### `SeasonCreationWizard`

- **Routes:** `/league/:leagueId/create-season`
- **Component:** `src/operator/SeasonCreationWizard.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4) — audit shell + sample steps; full per-step audit deferred to follow-up
- **Rubric:** All 8 pass. Fixed 4 findings: error heading → destructive; "Clear Form" Button (text-red-600 ghost) → `text-destructive hover:text-destructive/80 transition-colors`; validation error → destructive; "Create Season" CTA stripped of custom `bg-blue-600 hover:bg-blue-700` override (now uses shadcn Button default = Simonis blue).

#### `TeamManagement`

- **Routes:** `/league/:leagueId/manage-teams`
- **Component:** `src/operator/TeamManagement.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4) — page has its own fixed bottom action bar (tab bar hidden)
- **Rubric:** All 8 pass. Fixed 5 findings: error heading → destructive; "at max teams" indicator (text-orange-600) → text-warning; "Assign a venue first" callout (bg-blue-50/border-blue-200 with text-blue-800/600) → `bg-info/10 border-info/40` with `text-foreground` body + `text-info` subhead.

#### `VenueManagement`

- **Routes:** `/venues/:orgId`
- **Component:** `src/operator/VenueManagement.tsx`
- **Status:** ✅ done (PR — chore/audit-wave-4)
- **Rubric:** All 8 pass. Fixed 7 findings: league-context banner (bg-blue-50/border-blue-200 with text-blue-900/700/600) → info tokens with foreground body; venue assigned ring (`ring-green-500` — caught manually, not by scan since it's `ring-*` not `bg/text/border`) → `ring-success`; assigned-state header (bg-green-50 + text-green-700) → `bg-success/10 text-success`; tables-available subtext → text-success.

### Wave 5 — Onboarding (4)

#### `CompleteProfileForm`

- **Routes:** `/complete-profile`
- **Component:** `src/completeProfile/CompleteProfileForm.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 2: general-errors callout (`bg-red-50/border-red-200/text-red-600`) → `bg-destructive/10 border-destructive/40 text-destructive`.

#### `NewPlayerForm`

- **Routes:** `/new-player`
- **Component:** `src/newPlayer/NewPlayerForm.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Same 2-finding error-callout fix as `CompleteProfileForm`. Cascade-clean from InfoButton via FormField.

#### `BecomeLeagueOperator`

- **Routes:** `/become-league-operator`
- **Component:** `src/leagueOperator/BecomeLeagueOperator.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7) — biggest in this batch
- **Rubric:** All 8 pass. Fixed 19 findings: 2 Benefits/Perfect For cards (green/blue → success/info), gradient pricing card (blue-500/600 + blue-200/100 → `bg-primary text-primary-foreground` with opacity) and final CTA (gradient-from-blue-to-indigo → `bg-primary text-primary-foreground`), 2 Start Application Buttons stripped of `bg-blue-600` overrides (now Simonis blue), pricing link → `text-primary hover:text-primary/80 transition-colors`.

#### `LeagueOperatorApplication`

- **Routes:** `/league-operator-application`
- **Component:** `src/leagueOperator/LeagueOperatorApplication.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 1: Next/Create-Organization Button stripped of `bg-blue-600 hover:bg-blue-700 text-white` override (now uses shadcn Button default).

### Wave 6 — Auth flows (6)

#### `Login`

- **Routes:** `/login`
- **Component:** `src/login/Login.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 1: ternary message color (`text-red-500` / `text-green-600`) → `text-destructive` / `text-success`. Rubric 8 N/A — auth flow page, intentionally chromeless (no PageHeader); login is rendered inside `LoginCard` for consistent auth chrome.

#### `Register`

- **Routes:** `/register`
- **Component:** `src/login/Register.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 9: invalid-link AlertTriangle (amber → warning); 2 success icons (green-600 → success); resend message ternary (red/green → destructive/success); claim profile banner (bg-blue-50/border-blue-200, text-blue-600/900/700 → info tokens with foreground body); bottom error message (text-red-500 → text-destructive).

#### `ForgotPassword`

- **Routes:** `/forgot-password`
- **Component:** `src/login/ForgotPassword.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 2: Mail icon (text-blue-600 → text-primary), resend message ternary → destructive/success.

#### `ResetPassword`

- **Routes:** `/reset-password`
- **Component:** `src/login/ResetPassword.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Zero source findings — already clean.

#### `EmailConfirmation`

- **Routes:** `/confirm`
- **Component:** `src/login/EmailConfirmation.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 2: success message (text-green-600 → text-success), error message (text-red-600 → text-destructive).

#### `ClaimPlayer`

- **Routes:** `/claim-player`
- **Component:** `src/login/ClaimPlayer.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7) — second-heaviest in this batch
- **Rubric:** All 8 pass. Fixed 17 findings: 2 invalid/expired alerts (amber → warning); 2 already-claimed/success icons (green → success); merge-stats success card (green-50/200/800/700 → success/foreground); error icon (red-500 → destructive); main invite-details card (blue-50/200/600/900/700/800 → info tokens with foreground body); multi-teams warning card (amber-50/200/600/800 → warning/foreground).

### Wave 7 — Public / marketing (3)

#### `Home`

- **Routes:** `/`
- **Component:** `src/home/Home.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Zero source findings — already clean. Uses shadcn + theme tokens throughout.

#### `About`

- **Routes:** `/about`
- **Component:** `src/about/About.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 2: pricing + login footer links (text-blue-600 hover:text-blue-800) → `text-primary hover:text-primary/80 transition-colors`.

#### `Pricing`

- **Routes:** `/pricing`
- **Component:** `src/about/Pricing.tsx`
- **Status:** ✅ done (PR — chore/audit-waves-5-6-7)
- **Rubric:** All 8 pass. Fixed 6: 2 section headings (text-blue-600 → text-primary), real-world example Card (border-blue-200/bg-blue-50 → info tokens), total cost emphasis (text-blue-600 → text-primary), result callout (bg-green-100/border-green-300/text-green-800 → success tokens).

### Wave 8 — Info / format pages (3)

#### `FiveManFormatDetails`

- **Routes:** `/5-man-format-details`
- **Component:** `src/info/FiveManFormatDetails.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch) — biggest screen in the entire audit
- **Rubric:** All 8 pass. Fixed **71 findings** — heaviest file by far. Multi-pass token migration via global replaces:
  - `bg-blue-50 + border-blue-200` callouts (`p-4` and `p-3` variants) → `bg-info/10 + border-info/40`
  - `bg-green-50 + border-green-200` callouts → `bg-success/10 + border-success/40`
  - `bg-yellow-50 + border-yellow-200` callouts → `bg-warning/10 + border-warning/40`
  - `text-blue-900` (headings) → `text-info`, `text-blue-800` (body) → `text-foreground`, `text-blue-700` (italic captions) → `text-info`
  - `text-green-900/800/700` → `text-success` (headings + captions) / `text-foreground` (body)
  - `text-yellow-900/800/700` → `text-warning` / `text-foreground`
  - `text-green-600 font-bold mr-2` checkmarks → `text-success`
  - Win/Tie/Loss table headers (`bg-green-100/yellow-100/red-100`) → `bg-success/15 / warning/15 / destructive/15`
  - Standalone `bg-blue-50` data rows → `bg-info/10`
  - `border-blue-300` divider → `border-info/40`
- PageHeader bypass — info pages render their own back button + title at the top. Could be migrated in a follow-up; deferred.

#### `EightManFormatDetails`

- **Routes:** `/8-man-format-details`
- **Component:** `src/info/EightManFormatDetails.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 12 findings using the same global-replace pattern as `FiveManFormatDetails` (blue → info, yellow → warning, with foreground body for long text). PageHeader bypass deferred (matches sibling info pages).

#### `FormatComparison`

- **Routes:** `/format-comparison`
- **Component:** `src/info/FormatComparison.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 15 findings — table-heavy with the "5-man" column tinted green-50 (now `bg-success/10`) and the right-column summary Card border-200 → `border-success/40`, heading `text-green-900` → `text-success`, body `text-green-800` → `text-foreground`. The 8-man side uses `bg-muted` (neutral) — categorical distinction preserved.

### Wave 9 — Stats detail (5)

#### `Standings`

- **Routes:** `/league/:leagueId/season/:seasonId/standings`
- **Component:** `src/pages/Standings.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 2: error heading + error text body → destructive.

#### `TopShooters`

- **Routes:** `/league/:leagueId/season/:seasonId/top-shooters`
- **Component:** `src/pages/TopShooters.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 2 — same pattern as Standings.

#### `TeamStats`

- **Routes:** `/league/:leagueId/season/:seasonId/team-stats`
- **Component:** `src/pages/TeamStats.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 1 (error → destructive).

#### `FeatsOfExcellence`

- **Routes:** `/league/:leagueId/season/:seasonId/feats`
- **Component:** `src/pages/FeatsOfExcellence.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 1 (error → destructive). Cascade-clean from InfoButton + StatsNavBar.

#### `MatchDataViewer`

- **Routes:** `/league/:leagueId/season/:seasonId/match-data`
- **Component:** `src/pages/MatchDataViewer.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 2: error text → destructive; Debug Info dev-only callout (`bg-yellow-50 border-yellow-200`) → `bg-warning/10 border-warning/40`. PageHeader bypass — this is a dev-leaning data-viewer page, deferred.

### Wave 10 — Player detail (1)

#### `PlayerProfile`

- **Routes:** `/player/:playerId`
- **Component:** `src/pages/PlayerProfile.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. Fixed 4: error text → destructive; email link (text-blue-600) → `text-primary`; Captain badge (bg-blue-100 + text-blue-800) → `bg-info/15 + text-info`; BCA Active badge (bg-green-100 + text-green-800) → `bg-success/15 + text-success`. PageHeader bypass — uses a simple back Button + page title pattern; deferred.

### Wave 11 — Rules (1 entry, 3 routes)

#### `RulesPage / RuleDetailPage / HouseRuleDetailPage`

- **Routes:** `/rules`, `/rules/:game/:ruleId`, `/rules/house/:scope/:scopeId/:ruleId`
- **Components:**
  - `src/rules/RulesPage.tsx`
  - `src/rules/RuleDetailPage.tsx`
  - `src/rules/HouseRuleDetailPage.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch)
- **Rubric:** All 8 pass. RuleDetailPage + HouseRuleDetailPage had **zero** findings. RulesPage had one: the "Show only house-rule differences" checkbox used native `<label>` + `<input type="checkbox">` → swapped to shadcn `Checkbox` + `Label` with `htmlFor` wiring (proper focus rings + keyboard + ARIA). This drops the project's native-form-element count from 23 → 22.

### Wave 12 — Wizards (1)

#### `LeagueWizardV2Page`

- **Routes:** `/create-league/:orgId`
- **Component:** `src/wizards/league-v2/LeagueWizardV2Page.tsx`
- **Status:** ✅ done (PR — chore/audit-final-batch) — single audit entry for the page chrome + `WizardFlowShell`. Composes 27 sub-steps via `createNewLeagueFlow` (league/schedule/teams/matchups). Per-step audit is deferred to a follow-up.
- **Rubric:** All 8 pass. Zero source findings on the page itself (the wizard chrome was already clean post-cascade). Cascade-clean from PageHeader (org badge) + InfoButton (used in many sub-steps).

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
