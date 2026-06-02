---
date: 2026-04-26
topic: header-mobile-rework
---

# Global Header & Navigation Rework

## Problem Frame

The current `PageHeader` component (used on ~40 pages, no shared layout wrapper) has two compounding issues on mobile:

1. **Vertical bloat** — back button, org badge, title, subtitle, and optional actions stack into ~140px of sticky chrome, eating roughly 25% of usable phone viewport.
2. **No global navigation** — the app has no nav bar, drawer, or menu mounted at the root. The back button is the only navigation affordance most pages offer. `NavBar` and `OperatorNavBar` files exist in `src/navigation/` but are not imported by any caller (verified: zero importers — they are dead code). `StatsNavBar` is the only nav component actively rendered, and only on stats pages as a sub-nav. This branch introduces the first live global navigation in the app.

A secondary symptom users feel: on long scrolling pages, the back button is at the top of the sticky header — far from a thumb resting at the bottom of the phone. That ergonomic friction is what reads as "back button scrolls out of sight" even though it is technically still pinned. Keeping back inside the sticky bar (which the new design preserves) at least guarantees it is always visible.

Players and operators primarily use the app on phones. The header is on every page, so its size and behavior set the tone for mobile UX. This branch (`fix/header-mobile-rework`) replaces the header from scratch and introduces the app's first real navigation system.

## Requirements

**Slim sticky header**

- R1. The sticky portion of the header is a single line, ~48px tall on mobile, with hamburger (left) + title + user-identity slot (right).
- R2. When a page provides a back target (`backTo` or click handler), a back arrow appears immediately right of the hamburger. On root pages the back arrow is absent. Two icons + title remains uncluttered on a 360px-wide screen.
- R3. On mobile the back affordance is icon-only. On desktop (≥1024px) it includes the destination label (e.g., `← Back to My Teams`). When a page provides only `onBackClick` (no static destination), the desktop affordance falls back to icon-only — same as mobile.
- R4. Title is single-line and truncates with ellipsis if it overflows. The sticky bar carries no subtitle.
- R5. Header structure (anatomy) at all viewport sizes:

```
Mobile, root page (~48px sticky):
┌────────────────────────────┐
│ ☰   Team Schedule    👤   │
└────────────────────────────┘

Mobile, sub-page (back target set):
┌────────────────────────────┐
│ ☰ ←  Triple B Stars   👤  │
└────────────────────────────┘

Desktop ≥1024px, sub-page:
┌────────────────────────────────────────────────┐
│ ☰  ← Back to My Teams   Triple B Stars   👤   │
└────────────────────────────────────────────────┘
```

**Sub-header (scrolls with content)**

- R6. `subtitle`, organization badge, and decorative children (InfoButton, format chips, hints) render below the sticky bar as part of regular page content. They are visible on page load and scroll away as the user reads.
- R6a. **Primary action buttons (save/cancel/submit-style) do not scroll away.** Pages with a primary action pair render them in a sticky bottom action area (a small Tailwind `div` with `fixed bottom-0` or equivalent), not inside the header and not inline with content. The pattern is implemented inline on each page that needs it, not as a shared component — only one page (`src/operator/SeasonScheduleManager.tsx`, Cancel + Save Changes) is currently known to need it. If migration discovers 3+ pages with the same need, extract a shared component then. Migration audits the 14 `children`-using callers and classifies each: decorative children (InfoButton, format chips) move below the header and scroll with content; primary action pairs get an inline sticky bottom area on that page. Out of scope: behavior under mobile keyboard (accept that it covers the bar; fix if it becomes a real problem).
- R7. The seldom-used `preTitle` prop is retired. There are 3 call-sites across 2 files: `src/home/Home.tsx` lines 67 and 119, and `src/about/About.tsx` line 10. Convert all three to use the existing title or subtitle props.

**Drawer / global navigation**

- R8. Hamburger opens a Sheet drawer (shadcn `Sheet`, already installed) sliding in from the left.
- R9. The drawer is the same component on mobile and desktop. There is no persistent sidebar and no top desktop nav strip.
- R10. The drawer holds **only root-level entry points**, not sub-pages. Schedules, lineups, scoring, league setup, and similar context-dependent pages are reached via the linear flow that owns them, not from the menu.
- R11. Drawer items (logged-in player): Dashboard, My Teams, Stats, Messages, Profile, Sign out. ("Dashboard" goes to `/dashboard` — the member home page with messages, summaries, and in-your-face context. The drawer is a *shortcut* to other destinations; the dashboard remains the primary home.)
- R12. Drawer items (logged-in operator): the player items above, plus an "Operator" section that acts as a **traveling shortcut** to org-scoped destinations. The drawer does not replace `/dashboard` (which remains the primary home page with in-your-face messages, summaries, etc.); it lets the user jump from any page directly to any org's Dashboard, Create League, or Reports without first stopping at /dashboard.

  Real-world shape: an LO is typically involved with one org (the one they own). A few are staff on 1–3 others. The very rare power user (e.g., a developer setting up new orgs) may be staff on many — the drawer should not become a wall of orgs in that case.

  **Drawer caps at 4 total operator orgs.** The display order:
  1. Orgs the user owns (almost always 1; show all of them — owners always get a slot)
  2. Staff orgs, alphabetical, filling remaining slots up to the cap of 4
  3. If the user has more operator orgs than fit, the drawer ends with a "More on Dashboard →" link that goes to `/dashboard` (which lists everything as cards today). No overflow flyout, no scroll inside the drawer — keep it simple.

  Single-org operator (the common case): the Operator section flat-lists Dashboard, Create League, Reports for that single org. No org name needed in the label since there's only one.

  Multi-org operator: each operator org appears as an expandable sub-section labeled with the org name; expanding it reveals Dashboard, Create League, Reports for *that* org. Each link goes directly to the existing org-scoped route.

  Pending-reports count appears as a badge on the Reports item per R24.
- R13. Drawer items (logged out): Home, About, Pricing, Rules, Sign in.

  Drawer items map to the routes they currently take in the codebase:

  | Item | Route |
  | --- | --- |
  | Dashboard (logged-in) | `/dashboard` |
  | Home (logged-out) | `/` |
  | My Teams | `/my-teams` |
  | Stats | `/stats` (entry into the stats hub) |
  | Messages | `/messages` |
  | Profile | `/profile` |
  | About | `/about` |
  | Pricing | `/pricing` |
  | Rules | `/rules` |
  | Sign in | `/login` |
  | Sign out | (mutation, no route) |
  | [Org Name] Dashboard | `/operator-dashboard/<orgId>` (per-org direct link) |
  | [Org Name] Create League | `/create-league/<orgId>` (per-org direct link) |
  | [Org Name] Reports | `/operator-reports/<orgId>` (per-org direct link) |
- R14. Drawer header shows: app brand, current user identity (when logged in), and current org context (when viewing operator pages).
- R15. `src/navigation/NavBar.tsx` and `src/navigation/OperatorNavBar.tsx` are deleted as part of this branch. They are dead code today (zero importers), so this is file cleanup, not a behavior migration.


**Right-side identity slot**

- R16. Logged in: a small avatar/initials button. Tapping it goes to the Profile page. No additional dropdown menu — Sign out lives in the drawer, keeping each surface single-purpose.
- R17. Logged out: a "Sign in" button. Suppressed on auth-flow routes where the button would be redundant or wrong: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/confirm`, `/claim-player`. This replaces the manual `rightContent` prop currently used only on `Home.tsx`.

**Environment banner**

- R18. The dev/staging environment banner remains mounted at the app root above the header. To prevent the new sticky header from overlapping the sticky banner, the header's sticky `top` offset is driven by the banner's rendered height (e.g., a CSS variable `--env-banner-height` updated by the banner via `ResizeObserver`, with the header consuming `top: var(--env-banner-height, 0px)`). When the banner does not render (production), the header sits at `top: 0`. EnvironmentBanner keeps its current `z-50`; the new header uses a lower z-index (e.g., `z-30`) so any modal/dialog still wins.
- R19. The current dev banner copy ("Development build — not connected to production data.", 49 chars) already fits a single line at 360px. No copy change required for dev; verify single-line layout at 320px during implementation.
- R20. Staging banner remains informative but fits on a single line at viewport widths down to 320px (smallest supported phone). Trim the current 89-char message in `src/config/environment.ts` accordingly. Final copy needs Ed's approval (deferred question below).
- R21. Production renders no banner (already true).

**Page-level adoption**

- R22. The new header replaces `PageHeader` everywhere it is used (40 call-sites, verified by grep). The new component may have a different name and a different prop API; `PageHeader` does not have to survive.
- R23. `StatsNavBar` (page-specific tabs on stats pages) is out of scope. It is a within-page filter nav (Standings / Top Shooters / Team Stats / Feats) — not a list of entry points to other parts of the app — so it does not belong in the global drawer. On stats pages it continues to render below the new sticky header as page content (not sticky); the 80px vertical-space win still applies because StatsNavBar itself is unchanged.

**Live signals**

- R24. **Badges live inside the drawer, not on the always-visible chrome.** When the drawer is open, the Messages item shows an unread count (e.g., "Messages (4)" or a red dot with the number). The Reports item, when shown to operators, shows a pending-reports count the same way. The hamburger button, the avatar, and the rest of the sticky header chrome stay plain — no notification dots on them. Rationale: messaging and reports are async, mostly in-person context (attendance/tardy/reschedule for messages; rare LO-handled disputes for reports). The user shouldn't be poked by them on every screen, but at the point of navigation ("I'm choosing where to go") they should see what's pending. This is a "you have mail" pattern, not a real-time alert.

## Success Criteria

- Sticky header chrome on mobile is ≤56px tall (down from ~140px today), reclaiming roughly 80px of vertical space on every page.
- Every page in the app has the same global navigation entry point (the hamburger), regardless of route or role.
- Back navigation remains visible on long scrolling pages because it lives inside the sticky bar. (Visibility is the success bar here — tapping back still requires reaching the top of the screen; thumb-reach ergonomics on long pages is an explicit acknowledged trade-off, see Scope Boundaries.)
- A logged-out visitor can reach all five public destinations from the drawer; a logged-in player can reach all five player root pages; an operator additionally sees per-org shortcuts to Dashboard, Create League, and Reports for each of their operator orgs.
- No regressions: dev/staging banner continues to render with correct colors and stays sticky above the new header.

## Scope Boundaries

- **Not in scope**: bottom tab bar, persistent sidebar, top desktop nav strip, breadcrumbs for deep flows, floating back button / FAB, collapsing-on-scroll header animation.
- **Not in scope**: redesigning `StatsNavBar`. It is a sub-nav for stats pages — a separate concern.
- **Not in scope**: changing per-page content layout. Only the global header and nav change; page bodies stay as they are.
- **Not in scope**: changing route structure, auth flows, or role/permission logic.
- **Acknowledged trade-off**: thumb reach for the back button on long scrolling pages is not solved beyond keeping the button visible in the sticky bar. Tapping back still requires reaching the top of the screen.

## Key Decisions

- **Drawer everywhere over sidebar or nav strip.** The app's flows are linear and hierarchical (team → schedule → night → lineup → scoring; org → league → spot). A persistent menu of "destinations" does not match how users navigate. A small drawer of root anchors does. Sidebar would also waste horizontal space the app cannot afford on stats tables and schedule grids.
- **Back button is the primary in-flow nav.** Because flows are linear, back does most of the navigation work. It must always be visible when applicable, which is why it lives inside the sticky bar.
- **Hamburger always visible; back conditional.** Matches Android / Material patterns. The user explicitly preferred a visible back affordance over the iOS hide-and-swap pattern.
- **Subtitle/org badge scroll with content.** Keeps sticky chrome at its minimum. The drawer header carries persistent org context for operators so first-screen org awareness is not lost.
- **Single drawer for player and operator.** Unifies the three pre-existing nav components. Operator section appears conditionally on role.
- **Drawer is a "traveling shortcut," not a chooser or a replacement for `/dashboard`.** Operator items in the drawer link directly to org-scoped routes (per-org Dashboard / Create League / Reports). The dashboard remains the primary in-your-face home with messages and summaries; the drawer just lets users skip the dashboard middle-step when they know exactly where they want to go. No new chooser screens or landing pages.
- **Full rewrite over patching `PageHeader`.** The user has explicitly OK'd starting fresh; the existing prop API is acceptable to break.

## Dependencies / Assumptions

- shadcn `Sheet` is installed at `src/components/ui/sheet.tsx` and is used elsewhere in the app (verified during exploration).
- An auth/role hook already exposes enough information to decide whether to render the Operator section in the drawer (assumption — exact hook to be confirmed during planning).
- React Router is the routing layer and provides the navigation primitives the drawer needs.

## Outstanding Questions

### Resolve Before Planning

None — the brainstorm produced enough product clarity to plan.

### Deferred to Planning

- [Affects R11–R13][Technical] Confirm which auth/role hook the drawer uses to gate items, and whether logged-out vs logged-in transition needs any reactive handling.
- [Affects R22][Technical] Migration shape: ship the new header in one PR with all 40 pages migrated, or behind a feature flag with progressive migration. Either is acceptable; planning should pick based on test coverage and risk appetite.
- [Affects R14][Technical] Decide whether the drawer header *also* shows current org context when the user is on an operator page (e.g., "Operating as: TripleB"). Less load-bearing now that R12's drawer items are org-named, but still potentially useful as a visual cue. If yes, planning picks the mechanism (route handle metadata via `useMatches()`, a context provider, or similar).
- [Affects R20][Needs human approval] Final staging banner copy — must trim to a single line at 320px width without losing required testing-program guidance. Ed to approve final string.
- [Affects R8/R22][Technical] Mount strategy: introduce a shared `AppLayout` wrapping `<Outlet/>` in `src/navigation/NavRoutes.tsx` that owns the sticky header + drawer (preferred), or continue mounting a header per-page with drawer state lifted to a top-level provider. Per-page mount risks drawer-state remount on route change; shared layout is cleaner but a bigger touch.

## Next Steps

-> `/ce:plan` for structured implementation planning
