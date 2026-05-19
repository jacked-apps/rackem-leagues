---
title: "feat: Navigation IA Overhaul — Bottom Tabs, Sidebar, Org Selector"
type: feat
status: active
date: 2026-04-30
origin: docs/brainstorms/2026-04-30-navigation-ia-overhaul-requirements.md
---

# feat: Navigation IA Overhaul — Bottom Tabs, Sidebar, Org Selector

## Overview

Replace the hamburger-drawer-only navigation with a layered navigation system: a fixed bottom tab bar on mobile, a persistent sidebar on desktop, and an org-switcher dropdown in the header for operators. Remove the Dashboard page and make My Teams the default landing page. Ship as one cohesive IA overhaul. (see origin: docs/brainstorms/2026-04-30-navigation-ia-overhaul-requirements.md)

## Problem Statement

The app's navigation relies entirely on a hamburger drawer for all destinations at all viewport sizes. On mobile, reaching high-frequency destinations (My Teams, Messages, Live) requires 2-3 taps. On desktop, there is no persistent navigation. Operators must scroll past player content on the Dashboard or dig into the drawer to find their organization. The Dashboard page is essentially a launcher for destinations that should be directly accessible.

## Proposed Solution

Introduce a shared layout route (`MemberLayout`) that wraps all authenticated member and operator pages. This layout hosts three new navigation surfaces:

1. **Mobile bottom tab bar** (below `lg`) — 4 tabs for players, 5 for operators
2. **Desktop persistent sidebar** (`lg+`) — reuses AppDrawer's role-aware navigation structure
3. **Org-switcher dropdown** in PageHeader — contextual on operator routes only

Then remove the Dashboard page and redirect `/dashboard` to `/my-teams`.

## Technical Approach

### Architecture

The core architectural change is introducing a **nested layout route** in React Router. Today every page renders `<PageHeader>` individually and there is no shared layout. The new `MemberLayout` component will wrap authenticated routes and render the tab bar and sidebar alongside page content via `<Outlet>`.

```
App.tsx
  └─ ThemeProvider
       └─ RouterProvider
            └─ RootLayout (bare <Outlet/>)
                 ├─ Public routes (no layout)
                 ├─ Auth routes (no layout)
                 └─ MemberLayout  ← NEW
                      ├─ Sidebar (desktop, lg+)
                      ├─ <Outlet/> (page content)
                      └─ BottomTabBar (mobile, <lg)
```

**PageHeader stays per-page.** Each page continues to render `<PageHeader>` with its own props (title, backTo, subtitle, organizationId, children). The layout does not own the header — it only owns the sidebar and tab bar. This avoids re-architecting 35+ page files.

**The hamburger menu is conditionally hidden on desktop** when the sidebar is visible. PageHeader receives this signal via a CSS media query class (`hidden lg:hidden` on the hamburger trigger) rather than prop drilling.

### Deferred Questions Resolved

These were flagged in the origin document as "Deferred to Planning":

1. **Tab bar + fixed bottom action bars (R4)**: **Hide the tab bar on pages that have fixed action bars.** The two affected pages (TeamManagement, SeasonScheduleManager) are operator-only routes. The `MemberLayout` can read the current route and suppress the tab bar on those paths. Alternatively, those pages can set a layout context flag (`hideTabBar: true`) that the layout respects.

2. **Sidebar collapsibility (R9)**: **Always fully expanded on desktop.** Keeps the MVP simple. A collapsible icon-only mode can be added later if users want more content space. The sidebar width should be a CSS variable (e.g., `--sidebar-width: 16rem`) for easy adjustment.

3. **Org-switching UX (R7)**: **Always navigate to the new org's operator dashboard.** URL rewriting (swapping `:orgId` in the current path) is fragile — different operator pages have different URL structures. Navigating to `/operator-dashboard/:newOrgId` is safe and predictable.

4. **Dashboard feature relocation (R15)**:
   - **PWA install prompt** → Already rendered in `App.tsx` (global). No change needed.
   - **Pending invites modal** → Move to `App.tsx` or `MemberLayout` so it triggers on any authenticated page, not just Dashboard.
   - **"Share App" card** → Move to Profile page.
   - **"Become a League Operator" CTA** → Move to Profile page.

5. **Manage tab with multiple orgs (R2)**: **Default to the user's primary org (owner first, then first alphabetically).** If no org is "active" in the current session, the Manage tab navigates to the primary org's operator dashboard. The org-switcher in the header then allows switching.

### Implementation Phases

#### Phase 1: Shared Layout Shell

**Goal:** Introduce `MemberLayout` as a nested React Router layout route wrapping all member and operator routes. No visual changes yet — just the structural refactor.

**Files:**
- `src/components/layout/MemberLayout.tsx` — new component: renders `<Outlet/>` with placeholder slots for sidebar and tab bar
- `src/navigation/NavRoutes.tsx` — restructure member and operator routes as children of the new layout route

**Acceptance Criteria:**
- [ ] All existing member and operator pages render identically (no visual regression)
- [ ] The `MemberLayout` component wraps the `<Outlet/>` and is the parent of all `withMember()` and `withOperator()` routes
- [ ] Pages still render their own `<PageHeader>` with existing props
- [ ] Build passes

#### Phase 2: Mobile Bottom Tab Bar

**Goal:** Render a fixed bottom tab bar on mobile with 4 player tabs + conditional 5th operator tab.

**Files:**
- `src/components/layout/BottomTabBar.tsx` — new component
- `src/components/layout/MemberLayout.tsx` — integrate tab bar, hidden on `lg+`

**Tabs:**
| Tab | Icon | Route | Active when |
|-----|------|-------|-------------|
| My Teams | `Users` | `/my-teams` | `/my-teams`, `/team/*` |
| Live | `Radio` | `/live` | `/live`, `/league/*/live` |
| Messages | `MessageSquare` | `/messages` | `/messages` |
| Profile | `Settings` | `/profile` | `/profile` |
| Manage | `Building2` | `/operator-dashboard/:primaryOrgId` | `/operator-*`, `/league/*`, `/venues/*`, `/manage-*`, `/create-league/*` |

**Behavior:**
- Fixed at bottom of viewport, above any PWA update prompts
- Uses semantic theme tokens (dark-mode compatible)
- Active tab highlighted with `text-primary` + filled icon variant or underline
- Hidden on pages with fixed bottom action bars (TeamManagement, SeasonScheduleManager)
- Uses CSS variable `--tab-bar-height` so pages can add bottom padding
- `z-30` (same as header and existing fixed action bars)
- Unread message count badge on Messages tab (reuse `useUnreadMessageCount`)

**Acceptance Criteria:**
- [ ] Tab bar renders on mobile (below `lg`) for all member/operator pages
- [ ] 4 tabs for players, 5 tabs for operators
- [ ] Active tab highlights based on current route
- [ ] Tab bar hidden on TeamManagement and SeasonScheduleManager pages
- [ ] Unread count badge appears on Messages tab
- [ ] Tab bar does not overlap page content (bottom padding applied)
- [ ] Dark mode compatible

#### Phase 3: Desktop Persistent Sidebar

**Goal:** On `lg+` screens, render a persistent left sidebar with the same navigation structure as the AppDrawer. Hide the hamburger menu.

**Files:**
- `src/components/layout/AppSidebar.tsx` — new component, reuses AppDrawer's section components
- `src/components/layout/MemberLayout.tsx` — integrate sidebar, visible on `lg+` only
- `src/components/PageHeader.tsx` — hide hamburger trigger on `lg+`

**Sidebar Content (reuses existing components):**
- Player nav links (PlayerSection from AppDrawer)
- Operator org section (OperatorSection from AppDrawer) — caps at 4 orgs with overflow
- Theme toggle
- Sign Out

**Layout:**
- Sidebar width: `--sidebar-width: 16rem` (256px)
- Fixed position, full height below the sticky header
- Page content gets `lg:ml-[var(--sidebar-width)]` margin
- Sidebar scrolls independently if content exceeds viewport height

**Acceptance Criteria:**
- [ ] Sidebar renders on desktop (`lg+`) with the same nav items as the drawer
- [ ] Hamburger menu hidden on desktop when sidebar is visible
- [ ] Page content shifts right to accommodate sidebar width
- [ ] Sidebar scrolls independently if content overflows
- [ ] Sidebar is dark-mode compatible
- [ ] Tab bar hidden on desktop (sidebar replaces it)
- [ ] Drawer still works on mobile (no regression)

#### Phase 4: Org Selector in Header

**Goal:** Add an org-switcher dropdown to the PageHeader on operator routes.

**Files:**
- `src/components/OrgSwitcher.tsx` — new component (dropdown using shadcn Select or Popover)
- `src/components/PageHeader.tsx` — conditionally render OrgSwitcher on operator routes

**Behavior:**
- Appears only on operator routes (detected by route pattern matching)
- Shows active org name with Building2 icon
- Multi-org: dropdown with list of all user's orgs
- Single-org: static display, no dropdown affordance
- Switching navigates to `/operator-dashboard/:newOrgId`
- Compact design: fits in the 48px header bar alongside title

**Acceptance Criteria:**
- [ ] Org dropdown appears on operator pages only
- [ ] Multi-org operators can switch via dropdown
- [ ] Single-org operators see their org name (no dropdown)
- [ ] Switching orgs navigates to the new org's operator dashboard
- [ ] Does not appear on player pages (My Teams, Messages, etc.)

#### Phase 5: Dashboard Removal & Route Cleanup

**Goal:** Remove the Dashboard page, make My Teams the home page, and relocate displaced features.

**Files:**
- `src/dashboard/Dashboard.tsx` — delete
- `src/navigation/NavRoutes.tsx` — remove `/dashboard` route, add redirect to `/my-teams`
- `src/player/MyTeams.tsx` — update: remove `backTo="/dashboard"`, adjust to be landing page
- `src/components/layout/AppDrawer.tsx` — remove "Dashboard" link from PlayerSection, update "More on Dashboard" overflow link
- `src/components/layout/AppSidebar.tsx` — same drawer link updates
- `src/profile/Profile.tsx` — add "Share App" card and "Become Operator" CTA
- `src/components/layout/MemberLayout.tsx` or `src/App.tsx` — move pending invites modal

**Acceptance Criteria:**
- [ ] `/dashboard` redirects to `/my-teams`
- [ ] `Dashboard.tsx` deleted
- [ ] My Teams page loads as default landing page for logged-in users
- [ ] My Teams no longer shows "Back to Dashboard" back button
- [ ] Pending invites modal still triggers for users with unclaimed invites
- [ ] PWA install prompt still functions (already in App.tsx)
- [ ] "Share App" and "Become Operator" CTA appear on Profile page
- [ ] Drawer/sidebar "Dashboard" link replaced with "My Teams" (or removed if tab/sidebar already covers it)
- [ ] Drawer/sidebar "More on Dashboard" overflow link updated (e.g., "View all organizations" leading to a simple org list, or removed if org-switcher covers it)

## System-Wide Impact

### Interaction Graph

- `MemberLayout` mounts → sidebar hooks fire (useOrganizations, useUnreadMessageCount) on every page load (desktop). This is a change from today where these hooks only fire when the drawer is opened. Mitigate with TanStack Query's 5-minute stale time — the hooks won't refetch on every navigation.
- `BottomTabBar` mounts → `useUnreadMessageCount` fires on mobile. Same mitigation.
- `OrgSwitcher` mounts on operator routes → `useOrganizations` fires. Already happens via PageHeader's org badge today.
- Removing Dashboard → any code that navigates to `/dashboard` (back buttons, redirects) needs updating.

### State Lifecycle Risks

- **Active org state**: No global org context exists. The "active org" is derived from route params (`:orgId`). The Manage tab needs to know which org to navigate to when tapped. Solution: derive the primary org from `useOrganizations()` (owner first, then alphabetical) and store the last-visited org ID in localStorage as a convenience.
- **Pending invites modal relocation**: Moving it from Dashboard to MemberLayout means it could trigger on any page. Add a session flag (already exists: `invitesModalDismissed`) to prevent re-showing after dismissal.

### API Surface Parity

- Navigation links in AppDrawer, AppSidebar, and BottomTabBar must stay in sync. Extract a shared `NAV_ITEMS` constant or shared component to avoid drift.
- The operator org section in the drawer and sidebar must use the same `OperatorOrgRow` component and the same 4-org cap logic.

## Dependencies & Risks

- **35+ pages render PageHeader individually**: The layout refactor must not break any page's header props. Using a nested `<Outlet>` route (not wrapping PageHeader) avoids this risk entirely.
- **Performance**: Sidebar hooks firing on every desktop page load (vs. only on drawer open) is a new cost. TanStack Query's 5-minute stale time makes this negligible — the hooks will return cached data on most navigations.
- **Fixed action bars on 2 operator pages**: Hiding the tab bar on those pages is the simplest solution. A CSS variable (`--tab-bar-height`) lets those pages adjust their own `pb-*` padding independently.
- **Drawer "More on Dashboard" overflow**: With Dashboard removed, this link needs a new target. Options: remove it entirely (the org-switcher covers org access), or point to a simple "All Organizations" page (new page, likely overkill for MVP). Recommend: remove the overflow link and rely on the org-switcher in the header.

## Scope Boundaries (see origin)

- Not changing operator page structure or operator dashboard layout
- Not adding breadcrumbs
- Not redesigning AppDrawer content — sidebar reuses the same structure
- Not building tablet-specific layout (tablet uses `lg` breakpoint to pick sidebar or tabs)
- Not adding route transition animations

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-30-navigation-ia-overhaul-requirements.md](docs/brainstorms/2026-04-30-navigation-ia-overhaul-requirements.md) — Key decisions: My Teams as home page, 4+1 tab layout, org dropdown on operator pages only, all-at-once delivery, sidebar reuses drawer content

### Internal References

- Layout entry point: `src/App.tsx:21-45`
- Route definitions: `src/navigation/NavRoutes.tsx:148-244`
- AppDrawer: `src/components/layout/AppDrawer.tsx:75-267`
- OperatorOrgRow: `src/components/layout/OperatorOrgRow.tsx:1-92`
- PageHeader: `src/components/PageHeader.tsx:95-170`
- Dashboard: `src/dashboard/Dashboard.tsx:28-266`
- MyTeams: `src/player/MyTeams.tsx:458-513`
- Fixed action bars: `src/operator/TeamManagement.tsx:514`, `src/operator/SeasonScheduleManager.tsx:406`
- Prior header rework plan: `docs/plans/2026-04-27-001-feat-global-header-nav-rework-plan.md`
- Prior header rework requirements: `docs/brainstorms/header-mobile-rework-requirements.md`

### Related Work

- PR #94: Dark mode toggle (just merged — all new components must use semantic theme tokens)
- PR #92: Dev seed + README
