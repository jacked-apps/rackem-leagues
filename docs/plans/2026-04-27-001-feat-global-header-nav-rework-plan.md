---
title: "feat: Global header and navigation rework"
type: feat
status: active
date: 2026-04-27
origin: docs/brainstorms/header-mobile-rework-requirements.md
---

# feat: Global header and navigation rework

## Overview

Replace the existing `PageHeader` (used at 37 call sites) with a slim ~48px sticky header that hosts a hamburger button. Tapping the hamburger opens a `Sheet`-based drawer with role-aware navigation: root-level destinations for everyone, plus per-org operator shortcuts (Dashboard / Create League / Reports for each operator org, capped at 4 visible).

The drawer is the app's primary global navigation surface — the first time the app has one. From any page, the drawer is one tap away. Root destinations live there for everyone (Home, My Teams, Stats, Messages, Profile, etc.); operators additionally see per-org shortcuts. The `/dashboard` page remains the in-your-face home with messages and summaries — the drawer doesn't replace it, just gives users a fast lane that skips the dashboard middle-step when they already know where they're going.

The current `PageHeader` stacks back button + org badge + title + subtitle + optional children into ~140px of sticky chrome on mobile, eating roughly 25% of the viewport. The new design moves subtitle/org-badge/decorative children below the sticky bar (where they scroll with content), reclaiming roughly 80–90px of sticky chrome on every page (less on dev/staging where the env banner stays sticky-stacked above the new header — the banner itself is ~28px). On pages whose `children` carried meaningful above-fold context (org badge, format chips), the chrome shrinks but the content has effectively relocated rather than been removed; on pages whose `children` were purely decorative or empty, the win is the full ~80–90px.

The branch is `fix/header-mobile-rework`.

## Problem Frame

Players and operators primarily use the app on phones. The header is on every page, so its size and behavior set the tone for mobile UX. Today there is no global navigation: the back button is the only navigation affordance most pages offer. `NavBar.tsx` and `OperatorNavBar.tsx` exist in `src/navigation/` but are dead code (zero importers — verified). `StatsNavBar` is the only nav component actively rendered, and it's a sub-nav scoped to stats pages.

This rework introduces the first live global nav and shrinks the per-page sticky chrome from ~140px to ~48px.

(See origin: `docs/brainstorms/header-mobile-rework-requirements.md`.)

## Requirements Trace

Origin doc requirements R1–R24 are addressed across these implementation units:

| Requirement | Implemented in |
| --- | --- |
| R1–R5 (slim sticky header, back conditional, anatomy) | Unit 2 |
| R6, R6a (sub-header content + sticky save/cancel pattern) | Unit 2, Unit 6 |
| R7 (retire `preTitle`) | Unit 4 |
| R8–R14 (drawer architecture and items) | Unit 1, Unit 2 |
| R15 (delete dead nav files) | Unit 7 |
| R16 (avatar → Profile, no dropdown) | Unit 2 |
| R17 (logged-out Sign-in button + auth-flow suppression) | Unit 2, Unit 4 |
| R18 (env banner stacking via CSS variable) | Unit 3 |
| R19 (dev banner copy unchanged, verify 320px) | Unit 8 |
| R20 (staging banner single-line at 320px) | Unit 8 |
| R21 (no production banner) | already true; no change |
| R22 (replace PageHeader at all call sites) | Unit 2 (most callers); Unit 4 (special cases); Unit 5 (TeamSchedule duplicate) |
| R23 (StatsNavBar untouched) | scope boundary; not implemented |
| R24 (drawer-internal badges, no chrome dots) | Unit 1 |

## Scope Boundaries

- **Not in scope**: bottom tab bar, persistent sidebar, top desktop nav strip, breadcrumbs for deep flows, floating back button / FAB, collapsing-on-scroll header animation
- **Not in scope**: redesigning `StatsNavBar` (within-page filter on stats pages — separate concern)
- **Not in scope**: changing per-page content layout, route structure, auth flows, or role/permission logic
- **Acknowledged trade-off**: thumb reach for the back button on long scrolling pages is not solved beyond keeping the button visible in the sticky bar

### Deferred to Separate Tasks

- Drawer header "Operating as: <org>" indicator — deemed redundant for v1 because R12's drawer items are already org-named; revisit if multi-org operators report disorientation in the field

## Context & Research

### Relevant Code and Patterns

- `src/components/PageHeader.tsx` — current component (37 call sites). Will be replaced in place (same export, mostly compatible props) so most callers don't need to change.
- `src/components/EnvironmentBanner.tsx`, `src/config/environment.ts` — banner that must stack above the new sticky header. Currently `sticky top-0 z-50`.
- `src/components/ui/sheet.tsx` — shadcn Sheet (already installed). Existing callers to mirror: `src/rules/RuleDetailPage.tsx:38-109`, `src/rules/HouseRuleDetailPage.tsx:30`, `src/rules/HouseRulesScopePicker.tsx:24`. Pattern: `useState` for open + `<SheetClose asChild>` wrapping each `<Link>` for auto-close on nav.
- `src/navigation/NavRoutes.tsx` — `RootLayout` body (lines 133–135) is literally `<Outlet />`. No competing layout wrappers exist. Operator routes parameterized by `:orgId` confirmed at lines 220, 221, 223.
- `src/navigation/NavBar.tsx`, `src/navigation/OperatorNavBar.tsx` — dead code (zero importers, verified).
- `src/components/StatsNavBar.tsx` — out of scope but rendered today on stats pages; will continue to render below the new sticky header on those pages.
- `src/dashboard/Dashboard.tsx:225` — existing org-list pattern (operator org cards). The drawer mirrors this data shape but doesn't need to share the component.
- `src/operator/SeasonScheduleManager.tsx:400-419` — confirmed caller with a Save/Cancel action pair in `PageHeader`'s `children`.
- `src/operator/TeamManagement.tsx:485-538` — confirmed second caller. `children` mixes a decorative `InfoButton` with a true Save & Exit / Save & Continue action pair (lines 506–535). Decision: it qualifies. The InfoButton stays in sub-header decorative children; the Save & Exit / Save & Continue pair moves to the sticky bottom action area.
- `src/home/Home.tsx:67, 119, 122` — uses `preTitle` (twice) and `rightContent` (once). Only caller of `rightContent`.
- `src/about/About.tsx:10` — third `preTitle` caller.
- `src/player/TeamSchedule.tsx:132` — gotcha: this file inlines its own header markup rather than using `<PageHeader>`. It must be migrated explicitly to use the new component or it will keep the old visual.

### Auth and Role Hooks (verified by research)

- `src/context/useUser.ts` → `useUser()` returns `{ isLoggedIn, user, loading, logout }`
- `src/api/hooks/useUserProfile.ts:67` → `useUserProfile()` returns `{ member, loading, hasRole, canAccessLeagueOperatorFeatures(), canAccessDeveloperFeatures(), hasMemberRecord() }`. Convenience `useIsOperator()` at line 137.
- `src/api/hooks/useOrganizations.ts:42` → `useOrganizations(memberId)` returns the user's operator orgs (the data shape the per-org drawer items consume).
- `src/hooks/usePendingReportsCount.ts:19` → `usePendingReportsCount(organizationId)` for the Reports badge per R24.
- `src/api/hooks/useMessages.ts:164` → `useUnreadMessageCount(memberId)` for the Messages badge per R24.

### Z-Index Map (verified)

- `z-50`: EnvironmentBanner, all shadcn overlays (Sheet, Dialog, AlertDialog, Popover, DropdownMenu, Select, Calendar), Sonner Toaster, custom modals, InfoButton popover, PWA prompt
- `z-[60]`: outlier — `TableConfigureModal.tsx:298` (modal-on-modal)
- `z-10`: today's `PageHeader`, `SearchInput` sticky bar, ad-hoc card overlays
- New header gets `z-30` — sits above page content but stays beneath shadcn overlays so menus/dialogs always cover it

### External References

- shadcn Sheet (Radix Dialog underneath) — patterns for the drawer behavior, focus trap, and SheetClose semantics. Already in repo at `src/components/ui/sheet.tsx`.
- React Router v7 data router — `RootLayout` already mounts as the parent route; the cutover is one wrap.

### Institutional Learnings

`docs/solutions/` does not exist in this repo — no past learnings to surface. Worth capturing a learning entry after this lands (see Documentation / Operational Notes).

## Key Technical Decisions

- **PageHeader owns the drawer (no `AppLayout` wrapper introduced).** PageHeader is already on every page; co-locating the hamburger button with the Sheet that opens it keeps the design simple, mirrors the existing Sheet usage idiom (trigger and content sit together), and avoids a context-provider plumbing layer for state most users never see. The Sheet portal-mounts; per-page remount cost is negligible because the drawer is closed by default and `SheetClose asChild` auto-closes on link tap. (Origin doc deferred this to planning; chosen here.)
- **Same export name (`PageHeader`) and a near-compatible prop API.** The new component file replaces `src/components/PageHeader.tsx`. Props that survive: `backTo`, `backLabel`, `onBackClick`, `title`, `subtitle`, `organizationId`, `children`, `hideBack`. Props retired: `preTitle` (3 callers — Unit 4); `rightContent` (1 caller — Unit 4 absorbs into the new built-in identity slot). Most of the 37 call sites need no change; only the 5 identified special cases get touched.
- **Migration is one PR with phased commits, no feature flag.** Only 5–6 call sites have special cases; ~35 are mechanically compatible. The `RootLayout` cutover affects all routes simultaneously regardless. Flag complexity buys little safety; sequential commits per phase give granular revertability if anything regresses.
- **Drawer's per-org operator shortcuts cap at 4 total** (owners first, alphabetical staff next, "More on Dashboard →" overflow). Matches the realistic distribution: most LOs run 1 org; the dev case (~20) is rare and temporary.
- **Drawer-internal badges only** (Messages count, Reports count). No notification dots on hamburger, avatar, or sticky chrome. "You have mail" pattern at point-of-navigation.
- **Env banner stacking via a CSS variable.** EnvironmentBanner sets `--env-banner-height` from a `ResizeObserver`; the new header consumes `top: var(--env-banner-height, 0px)`. No magic numbers, no flicker on banner copy reflow.

## Open Questions

### Resolved During Planning

- *Mount strategy* (origin doc deferred): PageHeader owns the drawer; no `AppLayout` wrapper introduced. See Key Technical Decisions.
- *Auth/role hook* (origin doc deferred): the drawer reads `useUser`, `useUserProfile` (via `useIsOperator`), `useOrganizations(member?.id)`, `useUnreadMessageCount(member?.id)`, and `usePendingReportsCount(orgId)` per the verified shapes above.
- *Migration shape* (origin doc deferred): one PR, phased commits, no feature flag.
- *Drawer header "Operating as: <org>" cue* (origin doc deferred): omitted for v1 because drawer items are already org-named in R12.

### Deferred to Implementation

- Exact pixel padding / icon sizes / Tailwind class polish for the new header — settle while building, not in the plan
- Whether `TeamManagement.tsx` qualifies as a sticky-save/cancel candidate or just decorative-with-button — confirm during Unit 6's audit
- Final `Sheet` width/responsive sizing for desktop (default `w-3/4 max-w-sm` may be too narrow on a 27" monitor) — only override if it looks bad in practice

### Deferred to Separate Owners

(Resolved during planning — see Unit 8 for the approved staging copy.)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌──────────────────────────────────────────────────────────────────┐
│  App.tsx (unchanged structure)                                   │
│  ├── EnvironmentBanner (sticky top-0 z-50)   <-- sets CSS var   │
│  └── RouterProvider                                              │
│      └── RootLayout                                              │
│          └── <Outlet/>                                           │
│              └── Page (e.g. SeasonScheduleManager)               │
│                  ├── <PageHeader title=… backTo=…>               │
│                  │   ├── sticky top-[var(--env-banner-height)]   │
│                  │   ├── Hamburger button (left)                 │
│                  │   ├── Back arrow if backTo set                │
│                  │   ├── Title (truncate)                        │
│                  │   ├── Right slot (Avatar | Sign in | hidden)  │
│                  │   └── <Sheet> (drawer, mounted in same tree)  │
│                  │       └── <AppDrawer/>                        │
│                  │           ├── Drawer header (brand + identity)│
│                  │           ├── Player section                  │
│                  │           ├── Operator section (capped at 4)  │
│                  │           └── Sign out / Sign in              │
│                  ├── (sub-header: subtitle, org badge,           │
│                  │    decorative children — scrolls with content)│
│                  └── (page body)                                 │
│                      ─ optional: inline FIXED bottom save bar    │
│                        for save/cancel pages (Unit 6)            │
└──────────────────────────────────────────────────────────────────┘

AppDrawer item sets (from R11–R13):

  logged-out:   Home / About / Pricing / Rules / Sign in
  player:       Dashboard / My Teams / Stats / Messages(N) / Profile / Sign out
  operator:     player items + Operator section:
                  single-org:  Dashboard / Create League / Reports(N)
                  multi-org:   per-org expanders, owners first, staff alpha,
                               cap 4 total, "More on Dashboard →" overflow
```

## Implementation Units

The work is grouped into three phases. Phase 1 builds the new pieces in isolation. Phase 2 cuts over and migrates special cases. Phase 3 cleans up and tests.

### Phase 1 — Build

- [ ] **Unit 1: AppDrawer component**

**Goal:** Build the role-aware Sheet content rendered when the hamburger is tapped.

**Requirements:** R8, R10, R11, R12, R13, R14, R24

**Dependencies:** None

**Files:**
- Create: `src/components/layout/AppDrawer.tsx` (top-level drawer + per-section components)
- Create: `src/components/layout/OperatorOrgRow.tsx` (the per-org sub-component that owns `usePendingReportsCount`)
- Test: `src/components/layout/AppDrawer.test.tsx`

**Approach:**
- Stateless top-level component that accepts `open` and `onOpenChange` props (state lives in PageHeader so the trigger and content stay co-located).
- Reads top-level hooks once: `useUser`, `useUserProfile` (exposes `useIsOperator`), `useOrganizations(member?.id)`, `useUnreadMessageCount(member?.id)`. Per-org `usePendingReportsCount(orgId)` is **not** called in a loop here — that would violate React's Rules of Hooks. Instead, each operator org row is a child sub-component (`<OperatorOrgRow org={org} />`) that calls `usePendingReportsCount` once. Number of hook calls per render is therefore fixed by component shape, not by data.
- Renders three branches based on auth state: logged-out, logged-in player, logged-in operator. The operator branch is the player branch plus an Operator section.
- Operator section uses the `position` field returned by `useOrganizations` (values: `'owner' | 'admin' | 'league_rep' | null`). Classification: `position === 'owner'` → owned; `'admin'` and `'league_rep'` → staff. Render owned first (alphabetical within); then staff (alphabetical within); cap the visible total at 4. If `organizations.length > 4`, render the first 4 and append a "More on Dashboard →" link to `/dashboard`.
- Single-org operator: flat-list `Dashboard / Create League / Reports` for the only org. Multi-org: each org is a collapsible group; **default state is collapsed** so the drawer opens compact. Tapping an org header expands it independently (any number can be open simultaneously — no accordion behavior).
- Each link uses `<SheetClose asChild>` wrapping a `<Link>` so the drawer auto-closes on nav.
- Badges: Messages and per-org Reports both render as `(N)` text suffix on the item label when `count > 0` (e.g., `Messages (4)`). No red dots, circles, or pills — keeps "drawer-internal text-only" consistent with R24.
- Loading/error handling: while any of `useUser` / `useUserProfile` / `useOrganizations` is loading, render the drawer with what's already known and skip uncertain sections (e.g., no Operator section yet if `organizations` is loading). On hook error, render the row without a count and log the error — never crash the drawer. Same rule for `useUnreadMessageCount` and `usePendingReportsCount` inside their owning components: loading or error → no badge.
- Drawer header shows app brand + user identity (display name from `useUserProfile`, or a "Sign in" prompt if logged-out).
- Accessibility: drawer container inherits Radix `aria-modal` and focus trap. Each interactive element gets an explicit accessible name: drawer-close button → `aria-label="Close menu"`; expandable org headers → `aria-expanded` reflecting state. Sheet's built-in focus trap and Esc-to-close behavior are sufficient; no custom keyboard handling needed.

**Patterns to follow:**
- Sheet usage idiom from `src/rules/RuleDetailPage.tsx:38-109` (state, SheetClose-asChild, sizing).

**Test scenarios:**
- *Happy path* — logged-out renders public items (Home / About / Pricing / Rules / Sign in)
- *Happy path* — logged-in player renders player items including Messages and Profile
- *Happy path* — logged-in operator with one operator org (`position: 'owner'`) sees a flat Operator section with Dashboard / Create League / Reports
- *Happy path* — logged-in operator with two operator orgs sees both as collapsed-by-default expandable groups; tapping a header expands that group independently
- *Edge case* — unread count 0 renders "Messages" with no badge; >0 renders "Messages (3)"
- *Edge case* — pending reports count 0 renders "Reports" with no badge
- *Edge case* — operator with 5 orgs (1 owner, 4 staff) renders only 4 (owner first, then 3 alphabetical staff) plus a "More on Dashboard →" link
- *Edge case* — operator with 0 `'owner'` orgs but 2 staff orgs (`'admin'` or `'league_rep'`) renders both as staff (no owner section)
- *Edge case* — `useOrganizations` is loading → operator section is omitted (skeleton-free; just absent until ready)
- *Edge case* — `useOrganizations` errors → operator section is omitted; error is logged
- *Edge case* — `usePendingReportsCount` errors for one org → that org's Reports row renders without a badge; the rest of the drawer stays usable
- *Integration* — clicking a drawer link calls `onOpenChange(false)` and triggers React Router navigation (via SheetClose-asChild + Link)

**Verification:** AppDrawer renders the correct items for each auth/role combination; clicks dismiss the drawer.

- [ ] **Unit 2: New PageHeader implementation**

**Goal:** Replace `src/components/PageHeader.tsx` with the slim sticky bar that hosts the hamburger trigger, drawer, back button, title, and identity slot.

**Requirements:** R1, R2, R3, R4, R5, R6, R8, R16, R17, R22

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify (rewrite contents): `src/components/PageHeader.tsx`
- Test: `src/components/PageHeader.test.tsx` (new)

**Approach:**
- Same export name (`PageHeader`), same import path. Surviving props: `backTo`, `backLabel`, `onBackClick`, `title`, `subtitle`, `organizationId`, `children`, `hideBack`. Removed: `preTitle`, `rightContent` (Unit 4 migrates the callers).
- Sticky `<header>` element at `z-30` with `top: var(--env-banner-height, 0px)` and a `bg-white border-b` chrome. Single 48px row on mobile.
- Internal `useState` for drawer open. Renders `<Sheet open={open} onOpenChange={setOpen}>` wrapping `<SheetTrigger asChild><HamburgerButton aria-label="Open menu" /></SheetTrigger>` and `<SheetContent side="left">{open ? <AppDrawer open={open} onOpenChange={setOpen} /> : null}</SheetContent>`. **AppDrawer renders only while the Sheet is open** — this is load-bearing for performance, not just a render optimization. Closed-state: zero subscriptions to `useOrganizations`, `useUnreadMessageCount`, `usePendingReportsCount` across all 37 PageHeader instances. Open-state: hooks fire only on the page where the user actually opened the drawer. Without this guard, every page navigation would refetch all drawer queries for every user; with it, page navigations are unaffected by drawer machinery.
- Effect: `useEffect` listening on `useLocation().pathname` calls `setOpen(false)` on path change. Belt-and-suspenders defense in case `<SheetClose asChild>` doesn't fire on a programmatic navigation.
- Back button: shown when `backTo` or `onBackClick` is set and `hideBack` is false. Mobile: icon only with `aria-label={backLabel ?? 'Back'}`. Desktop (`lg:`): icon + `backLabel` text (e.g., `← Back to My Teams`). When only `onBackClick` is provided (no static destination), desktop falls back to icon-only.
- Title: single line, truncate with ellipsis (`truncate` Tailwind class).
- Right slot: avatar/initials button if logged in (links to `/profile`, `aria-label={\`\${displayName}'s profile\`}`); "Sign in" button if logged out — suppressed on the six auth-flow routes via an inline `const AUTH_FLOW_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/confirm', '/claim-player']` array and a one-line `AUTH_FLOW_ROUTES.includes(pathname)` check inside the component. No separate helper file.
- Below the sticky bar (NOT sticky), within the same component output: render `subtitle`, organization badge (driven by `organizationId`), and `children` (decorative content) as page-content-style siblings. These scroll with the page.
- Avatar component: small Tailwind round button with initials from `member.display_name` or email; no internal dropdown — taps go to `/profile`.

**Patterns to follow:**
- Existing PageHeader prop semantics for `backTo`/`backLabel`/`onBackClick` (preserve behavior).
- Tailwind breakpoints in this repo: `lg:` = ≥1024px (per current PageHeader's `lg:text-4xl` usage at line 92).

**Test scenarios:**
- *Happy path* — renders title, no back button when `backTo` and `onBackClick` are absent
- *Happy path* — renders back button when `backTo` is provided (mobile: icon only)
- *Happy path* — desktop viewport renders back button with `backLabel` text
- *Happy path* — `onBackClick` only (no `backTo`) renders icon-only back button at all viewport widths
- *Happy path* — `subtitle` and organization badge render below the sticky bar
- *Happy path* — `children` render below the sticky bar
- *Happy path* — logged-in user renders avatar/initials button linking to `/profile`
- *Happy path* — logged-out user on `/` renders "Sign in" button
- *Edge case* — logged-out user on `/login` does NOT render the right-slot Sign-in button
- *Edge case* — `hideBack: true` hides the back affordance even when `backTo` is set
- *Edge case* — long title truncates with ellipsis at ~360px viewport
- *Integration* — tapping the hamburger opens the drawer (`AppDrawer` mounts only when open); tapping a drawer link closes it
- *Integration* — programmatic navigation (e.g., a redirect) while drawer is open closes it via the location-change effect

**Verification:** every existing PageHeader caller still renders sensibly with the new component (manual smoke test of dashboard, my-teams, stats, an operator dashboard, scoring screen).

- [ ] **Unit 3: Env banner stacking via CSS variable**

**Goal:** Make the new sticky header sit immediately below the sticky env banner without overlap or magic numbers.

**Requirements:** R18

**Dependencies:** None (parallel-safe with Unit 1)

**Files:**
- Modify: `src/components/EnvironmentBanner.tsx`
- Modify: `src/index.css` — add `--env-banner-height: 0px;` default in `:root`

**Approach:**
- EnvironmentBanner uses `useLayoutEffect` (NOT `useEffect`) to read its rendered height synchronously after first layout and set `document.documentElement.style.setProperty('--env-banner-height', \`\${height}px\`)`. `useLayoutEffect` fires before paint, so the new PageHeader's first paint already reads the correct value — no flicker, no position jump.
- Within the same effect, attach a `ResizeObserver` to the banner DOM node to handle later reflows (e.g., narrow viewport wraps banner copy to two lines). Disconnect the observer on unmount.
- When the banner unmounts (production builds skip rendering it entirely), the layout effect never runs — the CSS default `0px` covers the production case. Add an explicit reset on unmount path anyway for hot-reload safety: `document.documentElement.style.removeProperty('--env-banner-height')`.
- Default value defined in CSS so the variable is always present, even before mount: in `src/index.css` (Tailwind v4's CSS entry — verified during research as the location for global CSS vars in this repo), add `:root { --env-banner-height: 0px; }`.
- The new PageHeader (Unit 2) consumes `top-[var(--env-banner-height,0px)]` for its sticky positioning.

**Patterns to follow:**
- React effect cleanup pattern (return-from-useEffect for ResizeObserver disconnect).

**Test scenarios:**
- *Happy path* — banner mounts, `--env-banner-height` reflects banner's offsetHeight in px
- *Happy path* — banner unmounts (production), `--env-banner-height` is removed (CSS default `0px` applies)
- *Edge case* — banner copy reflows (e.g., narrow viewport wraps to two lines), CSS variable updates to the new height
- *Edge case* — first paint with banner present uses the correct offset (no flicker / jump from `0px` to banner-height) — verify visually with a slow-motion screen recording on cold load
- *Integration* — with banner mounted, header `top` computed style equals banner height

**Verification:** in a dev/staging build, the slim header sits flush against the bottom of the env banner with no overlap and no gap, including after a viewport resize.

### Phase 2 — Migrate

- [ ] **Unit 4: Migrate `Home` and `About` (preTitle + rightContent retirement)**

**Goal:** Move the 4 special-case PageHeader props to the new design.

**Requirements:** R7, R17

**Dependencies:** Unit 2

**Files:**
- Modify: `src/home/Home.tsx`
- Modify: `src/about/About.tsx`

**Approach:**
- `Home.tsx` lines 67 and 119: convert the `preTitle="Welcome to"` + `title="Rack 'Em"` pair into a single `title="Welcome to Rack 'Em"` (or whatever reads best — call this out in the diff so the user can adjust copy).
- `Home.tsx` line 122: remove the manual `rightContent={authButtons}` — the new PageHeader's built-in right slot handles "Sign in" when logged out and renders an avatar (linking to `/profile`) when logged in.
- **Conscious trade-off**: Home.tsx's current `authButtons` block has two branches. Logged-out: Login + Sign Up buttons. Logged-in: Dashboard quick-link + Log Out button. Under the new design, logged-in users on `/` reach Dashboard and Log Out via the hamburger drawer (which has Dashboard at the top of the player section and Sign Out at the bottom) rather than inline header buttons. This is acceptable and matches R12's drawer-as-traveling-shortcut pattern. If user research surfaces that landing-page users expect a more direct path, revisit by adding an inline Dashboard CTA below the sticky bar — out of scope for this branch.
- `About.tsx` line 10: same `preTitle` → `title` consolidation.

**Patterns to follow:**
- Existing copy style on Home.tsx — keep the welcome phrasing recognizable, just collapsed into one line.

**Test scenarios:**
- *Happy path* — Home renders with the consolidated title; no `preTitle` / `rightContent` props remain in JSX
- *Happy path* — About renders with the consolidated title
- *Happy path* — logged-in Home shows the avatar in the header right slot (from Unit 2's built-in behavior); logged-out Home shows "Sign in"
- *Edge case* — logged-out Home on `/` still has a clear path to register/sign-in (sanity check that removing the inline auth buttons didn't create a dead end)

**Verification:** typecheck + manual smoke test of `/` and `/about` in both auth states.

- [ ] **Unit 5: Migrate `TeamSchedule.tsx` inline header duplicate**

**Goal:** Replace the hand-rolled header markup at `src/player/TeamSchedule.tsx:132` with a `<PageHeader>` instance so this surface gets the new design too.

**Requirements:** R22

**Dependencies:** Unit 2

**Files:**
- Modify: `src/player/TeamSchedule.tsx`

**Approach:**
- Read the existing inline header block to identify which props it's emulating (likely `title`, possibly `subtitle` or back nav).
- Replace it with a `<PageHeader>` call carrying the same data through the standard prop API.
- Confirm any wrapper styling (containers, spacing) still composes correctly.

**Patterns to follow:**
- The 36 other PageHeader call sites — TeamSchedule was an outlier; bringing it into the fold is the goal.

**Test scenarios:**
- *Happy path* — TeamSchedule renders with the new sticky header anatomy
- *Happy path* — back navigation (whatever the inline duplicate had wired) continues to work via PageHeader's `backTo`/`onBackClick`
- *Integration* — opening the team schedule from `/my-teams → team → schedule` continues to back out cleanly

**Verification:** the team schedule view visually matches the rest of the app's new sticky-bar treatment.

- [ ] **Unit 6: Fixed bottom action bar for action-pair pages; smoke-check decorative-children pages**

**Goal:** Move primary save/cancel action pairs out of `<PageHeader children>` and into a fixed bottom bar so they don't scroll out of view on long edit forms. Smoke-check the remaining decorative-children pages so nothing visually breaks.

**Requirements:** R6, R6a

**Dependencies:** Unit 2

**Files:**
- Modify: `src/operator/SeasonScheduleManager.tsx` (Cancel + Save Changes pair → fixed bottom bar)
- Modify: `src/operator/TeamManagement.tsx` (Save & Exit + Save & Continue pair → fixed bottom bar; InfoButton stays in sub-header decorative children)

**Approach:**
- The two pages that need the new bar are confirmed: `SeasonScheduleManager` and `TeamManagement`. Decision made above in Context — no audit deferral needed.
- For each qualifying page: remove the action buttons from `<PageHeader>`'s `children`. Render them at the bottom of the page body inside `<div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t p-3 grid grid-cols-2 gap-2">` (note: `fixed`, not `sticky` — the bar pins to the viewport regardless of scroll position; "sticky" would let it scroll until a threshold).
- Add `pb-20` (or equivalent — measure against the fixed bar's actual rendered height) to the page body's main wrapper so the last row of content is not occluded.
- Save button states: default (enabled + label), disabled (`!hasChanges() || saving` — Tailwind `disabled:opacity-50 disabled:cursor-not-allowed`), in-flight (existing `isLoading`/`loadingText` prop on the shadcn `Button` component handles spinner + label swap).
- Out of scope: behaving correctly when the mobile keyboard opens. Accept that the OS keyboard covers the bar — fix later if it becomes a real problem.

**Decorative-children smoke-check (no migration needed; just visual verification):** `LeagueDetail`, `OrganizationPlayoffSettings`, `LeaguePlayoffSettings`, `SeasonCreationWizard`, `PlayoffsSetupWizard`, `PlayoffSetup`, `LeagueRules`, `VenueManagement`, `BecomeLeagueOperator`, `Standings`, `TopShooters`, `TeamStats`, `FeatsOfExcellence`, `SeasonSchedulePage`. Per page, confirm the decorative children (InfoButton, format chips, export buttons) render below the new sticky bar without layout breakage. No code changes expected; this is a checklist for the migration commit.

**Patterns to follow:**
- Existing `fixed` + `inset-x-0` + `z-30` patterns (none in the repo for this exact case yet — this is the new pattern).

**Test scenarios:**
- *Happy path* — SeasonScheduleManager loads with the fixed bottom bar visible; scrolling the schedule does not move the bar
- *Happy path* — TeamManagement loads with the fixed bottom bar; InfoButton renders below the new sticky header in the sub-header area
- *Happy path* — Save Changes button still calls `handleSaveChanges`; Cancel still calls `handleCancel` (SeasonScheduleManager); Save & Exit / Save & Continue handlers preserved (TeamManagement)
- *Edge case* — disabled state on Save Changes (`!hasChanges() || saving`) renders correctly in the new location
- *Edge case* — in-flight state during save shows the existing shadcn `Button` `isLoading` spinner + `loadingText`
- *Edge case* — page body content does not render behind the fixed bar (visual: bottom of the schedule list is fully visible above the bar)

**Verification:** edit a schedule on a long page, scroll to the bottom, confirm Save is reachable in one tap from the thumb zone.

### Phase 3 — Cleanup and verification

- [ ] **Unit 7: Delete dead nav files**

**Goal:** Remove `NavBar.tsx` and `OperatorNavBar.tsx` — they have zero importers and exist only as legacy clutter.

**Requirements:** R15

**Dependencies:** None (these files are unreferenced)

**Files:**
- Delete: `src/navigation/NavBar.tsx`
- Delete: `src/navigation/OperatorNavBar.tsx`

**Approach:**
- Run a final pre-delete grep to confirm zero importers (already verified during research, but re-check on the eve of deletion).
- Delete the files. Do not touch `StatsNavBar.tsx` — out of scope per R23.

**Patterns to follow:** —

**Test scenarios:**
- Test expectation: none — pure file deletion, no behavior change.

**Verification:** `pnpm run build` and `pnpm run typecheck` both pass.

- [ ] **Unit 8: Trim staging banner copy**

**Goal:** Make the staging banner fit a single line at 320px width.

**Requirements:** R19, R20

**Dependencies:** None

**Files:**
- Modify: `src/config/environment.ts`

**Approach:**
- Replace the current 89-char staging `message` ("You are testing a pre-release build. Features may change. Report issues to Ed or to the league operator running tonight.") with: `"Pre-release build — report issues to Ed or your LO."` (49 chars, approved during planning).
- The dev `message` ("Development build — not connected to production data.", 49 chars) already fits one line at 360px; verify it still fits at 320px during implementation.
- Production has no banner — no change.

**Patterns to follow:**
- Current `ENV_BANNER_CONFIG` shape in `src/config/environment.ts:39-77`.

**Test scenarios:**
- *Happy path* — at 320px viewport width, the staging banner renders on a single line with no horizontal overflow
- *Happy path* — at 320px viewport width, the dev banner renders on a single line
- *Happy path* — production renders no banner

**Verification:** open `localhost` and a staging preview at 320px in DevTools' device emulator and confirm both banners stay one line.

- [ ] **Unit 9: Playwright e2e for hamburger navigation**

**Goal:** Lock in the new drawer-nav user flow with one end-to-end smoke test that exercises the hamburger interaction in a real browser.

**Requirements:** Provides cross-layer regression coverage (component tests for AppDrawer/PageHeader live in Units 1 and 2; this unit adds the e2e on top).

**Dependencies:** Units 1, 2, 5

**Files:**
- Create: `tests/e2e/header-drawer-nav.spec.ts`

**Approach:**
- Single happy-path test: logged-in player on the dashboard taps the hamburger, verifies the drawer opens and lists Dashboard / My Teams / Stats / Messages / Profile / Sign out, taps "My Teams", verifies the drawer closes and the page navigates to `/my-teams`.
- No e2e operator scenario in v1 — operator drawer behavior is covered by Unit 1's component tests.

**Patterns to follow:**
- Existing Playwright e2e setup in `tests/e2e/dashboard.spec.ts` and `tests/e2e/auth.setup.ts`.

**Test scenarios:**
- *Happy path (e2e)* — logged-in player on dashboard taps hamburger, sees drawer with all six player items, taps My Teams, lands on `/my-teams`
- *Integration* — existing page-level integration tests (e.g., `RulesPage.test.tsx`) continue to pass with the new PageHeader (transitive coverage; verified by running the test suite, not a new test)

**Verification:** `pnpm run test` and the project's Playwright command both pass.

## System-Wide Impact

- **Interaction graph:** the new PageHeader is invoked by 37 call sites. Drawer state is local per-PageHeader-instance and resets on route change; this is acceptable because the drawer is closed by default, `SheetClose asChild` auto-closes on link tap, and a `useLocation`-based effect closes any orphaned open state on programmatic navigations.
- **Hook subscription cost:** `AppDrawer` mounts only inside `<SheetContent>` while the Sheet is open (`{open ? <AppDrawer .../> : null}`). On pages where the user never opens the drawer during a visit, none of `useOrganizations`, `useUnreadMessageCount`, or `usePendingReportsCount` ever subscribes — the drawer's data layer is dormant. When the user opens it, the hooks fire on that page only.
- **Error propagation:** the drawer reads several hooks (`useUser`, `useUserProfile`, `useOrganizations`, `usePendingReportsCount`, `useUnreadMessageCount`). On loading: skip uncertain sections silently (operator section absent until orgs load). On error: log and render the row without a count. Never crash. Caught in Unit 1's tests.
- **State lifecycle risks:** `--env-banner-height` is set imperatively in JS. If EnvironmentBanner mounts before the new PageHeader, the variable is set first and consumed correctly. If it never mounts (production), the CSS default `0px` covers it. ResizeObserver disconnect on unmount must be wired (Unit 3).
- **API surface parity:** `PageHeader` keeps its export name and the surviving props' shapes. Most callers do not need any change. Special cases (preTitle x3 — Home.tsx x2 + About.tsx; rightContent x1 — Home.tsx; action pairs x2 — SeasonScheduleManager + TeamManagement; TeamSchedule duplicate x1) are listed and migrated.
- **Integration coverage:** Unit 9 adds a Playwright e2e for the hamburger flow. Existing page-level integration tests transitively exercise the new PageHeader.
- **Unchanged invariants:** route structure, auth flows, `withMember` / `withOperator` route guards, `StatsNavBar`, organization data fetching, scoring/lineup/schedule logic — all untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| First-paint flicker: header positions at `top: 0` then jumps to banner-height after observer fires | Unit 3 uses `useLayoutEffect` (synchronous before paint), not `useEffect` — first paint already has the correct value. The `ResizeObserver` only handles later reflows. |
| Dev/staging banner gets covered by the open drawer (Sheet overlay is `z-50`, banner is `z-50`; Sheet portals to end of body so it stacks on top) | Acceptable trade-off. The banner reappears the moment the user dismisses the drawer. Bumping the banner to `z-[60]` would collide with `TableConfigureModal`'s outlier z-index — not worth it. |
| `Sheet` width default (`w-3/4 max-w-sm`) feels wrong on a 27" desktop | Deferred-to-implementation — only override if the as-shipped width is genuinely awkward. Adding a desktop-specific size is one className change. |
| Per-PageHeader Sheet instances accumulate listeners or cause subtle leaks | `AppDrawer` is lazy-mounted (`{open ? <AppDrawer .../> : null}`) so closed-state PageHeaders don't subscribe to anything. Sheet itself is portal-mounted from Radix and closes on unmount. |
| Drawer's per-org operator section misreads `position` data when an org returns `null` or an unexpected value | Unit 1 explicitly tests the position-based split. `null` and unrecognized values are treated as staff (alphabetical alongside `'admin'`/`'league_rep'`). |
| The special-case migrations (Units 4–6) silently break a page nobody manually verifies | Mitigation: phased commit shape isolates regressions; Unit 6 enumerates the 14 children-using pages and includes an explicit smoke-check checklist for the decorative ones. |
| Cap-at-4 hides operator orgs the dev account (~20) actively switches between, frustrating the person who exercises the drawer most during development | **Accepted** for v1 per origin doc decision. The dev workflow can fall back to `/dashboard` (which lists all orgs) for navigation during development. If it becomes a real friction, raise the cap or add a dev-only mode in a follow-up. |
| `useLayoutEffect` on the banner runs SSR warnings if this app ever introduces SSR | Vite SPA today; if SSR is added later, swap to `useIsomorphicLayoutEffect` pattern. Document but do not solve preemptively. |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` when the new files (`AppDrawer.tsx`, test files, e2e spec) are added.
- After this lands, write a `docs/solutions/` entry capturing two reusable patterns:
  1. CSS-variable + ResizeObserver for stacking sticky elements without magic numbers.
  2. Replacing a 40-call-site component in place by keeping the same export name and preserving the prop API for the common case.
- No production deploy steps beyond standard CI; no migrations; no env-var changes.

## Sources & References

- **Origin document:** `docs/brainstorms/header-mobile-rework-requirements.md`
- Related code: `src/components/PageHeader.tsx`, `src/components/EnvironmentBanner.tsx`, `src/navigation/NavRoutes.tsx`, `src/navigation/NavBar.tsx`, `src/navigation/OperatorNavBar.tsx`, `src/components/ui/sheet.tsx`, `src/operator/SeasonScheduleManager.tsx`, `src/player/TeamSchedule.tsx`
- Related auth/role hooks: `src/context/useUser.ts`, `src/api/hooks/useUserProfile.ts`, `src/api/hooks/useOrganizations.ts`, `src/hooks/usePendingReportsCount.ts`, `src/api/hooks/useMessages.ts`
- Existing Sheet pattern: `src/rules/RuleDetailPage.tsx:38-109`
- Branch: `fix/header-mobile-rework`
