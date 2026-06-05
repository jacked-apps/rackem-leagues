---
date: 2026-04-30
topic: navigation-ia-overhaul
---

# Navigation & Information Architecture Overhaul

## Problem Frame
The app's navigation relies entirely on a hamburger drawer for all destinations across both mobile and desktop. On mobile, reaching high-frequency destinations (My Teams, Messages, Live) requires 2-3 taps. On desktop, there is no persistent navigation — the same drawer pattern is used at all viewport sizes. Operators must scroll past player content on the Dashboard or dig into the drawer to find their organization context. The Dashboard page exists primarily as a launcher for destinations that could be directly accessible via persistent navigation.

## Requirements

### Mobile Bottom Tab Bar
- R1. Render a fixed bottom tab bar on mobile (below `lg` breakpoint) with 4 tabs for all users: **My Teams**, **Live**, **Messages**, **Profile**
- R2. For users with the `league_operator` or `developer` role, add a 5th **Manage** tab that navigates to the operator dashboard for their active organization
- R3. Highlight the active tab based on the current route
- R4. The tab bar must not overlap with fixed bottom action bars (Save/Cancel patterns on pages like lineup, scoring)

### Org Selector in Header
- R5. On operator pages (routes under `/operator-*`, `/league/*`, `/venues/*`, `/manage-*`, `/create-league/*`, `/league-rules/*`), render an org-switcher dropdown in the sticky header bar
- R6. The dropdown shows the active organization name and allows switching to another org the user belongs to
- R7. Switching orgs navigates to the equivalent page for the new org (or falls back to the new org's operator dashboard if no equivalent exists)
- R8. Single-org operators see their org name displayed (no dropdown arrow / no switcher needed)

### Desktop Persistent Sidebar
- R9. On desktop (`lg+` breakpoint), replace the hamburger drawer with a persistent left sidebar showing the same role-aware navigation items currently in the AppDrawer
- R10. The sidebar should contain the same sections as the current drawer: player nav, operator nav (with org context), and theme toggle
- R11. The hamburger menu in the header is hidden on desktop when the sidebar is visible
- R12. Page content shifts right to accommodate the sidebar width

### Dashboard Removal
- R13. Remove the `/dashboard` route and `Dashboard.tsx` page
- R14. Redirect logged-in users' default landing page to `/my-teams` (My Teams becomes the home page)
- R15. Move the PWA install prompt and pending invites modal to a global location (e.g., app root or My Teams page) so they still function
- R16. Move the "Become a League Operator" CTA and "Share App" card to appropriate locations (e.g., Profile page or drawer)

## Success Criteria
- Mobile users can reach My Teams, Live, Messages, and Profile in a single tap from any page
- Operators can switch organizations from the header without navigating away from their current workflow
- Desktop users have persistent navigation without needing to open a drawer
- No orphan Dashboard page — all its useful content is relocated
- Tab bar, sidebar, and org selector are all dark-mode compatible (use semantic theme tokens)

## Scope Boundaries
- Not changing the operator page structure or operator dashboard layout (just how you navigate to them)
- Not adding breadcrumbs (could be a follow-up)
- Not redesigning the AppDrawer content — the sidebar reuses the same navigation structure
- Not building a responsive tablet-specific layout (tablet gets desktop sidebar or mobile tabs based on the `lg` breakpoint)
- Not adding route transition animations

## Key Decisions
- **My Teams is the new home page**: Dashboard launcher cards are redundant once tabs/sidebar exist. My Teams is the most common player destination.
- **4 player tabs + 1 operator tab**: My Teams, Live, Messages, Profile for everyone. Operators get a 5th "Manage" tab. Keeps the tab bar clean for the majority of users.
- **Org dropdown only on operator pages**: Avoids adding operator chrome to the player experience. Appears contextually when the user is in operator routes.
- **All-at-once delivery**: Ship as one cohesive IA overhaul rather than phasing. Avoids intermediate states where some nav is old and some is new.
- **Sidebar reuses drawer content**: The persistent desktop sidebar renders the same role-aware nav items as the current AppDrawer. No new navigation structure to maintain.

## Dependencies / Assumptions
- The `AppDrawer` component already has well-structured role-aware sections that can be reused for the sidebar
- The `PageHeader` sticky bar has space for an org dropdown (currently has: back button, title, hamburger/avatar)
- Fixed bottom action bars (Save/Cancel) on scoring/lineup pages will need to coexist with the tab bar

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] How should the bottom tab bar interact with pages that have fixed bottom action bars (e.g., lineup Save/Cancel)? Options: hide tabs, stack above, or use a different pattern for those pages.
- [Affects R9][Technical] Should the sidebar be collapsible (icon-only mode) or always fully expanded on desktop?
- [Affects R7][Technical] What's the best UX for org-switching on routes that are org-scoped (e.g., `/operator-dashboard/:orgId`)? Replace `:orgId` in the URL, or always navigate to the new org's dashboard?
- [Affects R15][Needs research] Which global features currently on Dashboard (PWA prompt, pending invites modal, share card) need new homes, and where?
- [Affects R2][Technical] When an operator taps the Manage tab with multiple orgs and no active org selected, should it show an org picker or default to their primary org?

## Next Steps
-> `/ce:plan` for structured implementation planning
