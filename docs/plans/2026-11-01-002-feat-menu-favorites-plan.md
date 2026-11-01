---
title: "feat: grouped menu + player favorites"
type: feat
status: in progress — Units 1–3 built (grouped menu, Ed's reorder, account-saved stars); awaiting Ed's try-out (incl. whether Favorites keeps a title); Unit 4 mostly done alongside. Rooms left out of navEntries until feat/game-room's route lands.
date: 2026-11-01
branch: feat/menu-favorites
assumes: PR #310 (member-reached pages keep the sidebar) is merged to main
---

# feat: grouped menu + player favorites

## The problem

The signed-in menu (desktop sidebar `AppSidebar.tsx` and phone drawer
`AppDrawer.tsx`) is one long list: the My Match panel, seven links, then the
Operator section. More is coming. The host pages (`/rooms`, built on
`feat/game-room`) need a spot, and Home / About aren't in the signed-in menu
at all.

There's a second problem. The two menus are written separately and have
already drifted: the drawer shows **Season Re-Up** when a captain has an
open re-up form, and the sidebar doesn't. Every menu change has to be made
twice, and sometimes only one copy gets it.

## What Ed decided (2026-11-01 conversation)

Top to bottom, the same on desktop and phone (order revised by Ed after the
Units 1–2 checkpoint):

0. **You**: the name / avatar row (opens Profile, so there's no separate
   Profile entry), then **My Teams** and **Messages**, fixed and never
   starred. The automatic **Join requests (N)** and **Season Re-Up** appear
   right after them. Below My Match rather than above it, so a match appearing
   or ending never pushes these rows around.
1. **My Match**: the existing chips panel (`MyMatchPanel.tsx`).
   - A live match or one **today** (the `'live'` group in
     `useMyMatchSurfaces`): **forced open**, as today. One tap gets you to
     scoring, which is the point.
   - Only past-due makeups: chips show, but **closed** until tapped. Today
     the makeup list opens on its own, which is "constantly have one open"
     for nothing.
2. **Favorites**: only the entries a player starred; **hidden until there's
   at least one**. Whether it keeps a "Favorites" title (or just shows the
   stars) is Ed's open call after he tries it.
3. **Extras** (foldable): Tournaments, Rooms, Stats.
4. **Info** (foldable): Home, Rules, Learn, What's New, About. When What's
   New has something unseen, the folded heading reads "Info (New)" too, so
   the marker isn't hidden. The marker is the WORD, never a coloured dot.
   Ed is colourblind.
5. **Operator**: per org, **Dashboard** always. **Reports** only when there's
   at least one pending ("Reports (1)"). That's safe to hide because
   `OperatorDashboard.tsx` already links to Reports.

Each fold **remembers** whether it was left open or closed, so a Rules
regular can leave Info open.

**Favorites (step 2):** every entry in a fold gets a **star**. Starring
moves it up into Favorites, and un-starring moves it back. My Teams and
Messages are fixed at the top, so they have no star.

**Learn vs Rules stay separate pages.** Rules is the official CSI/BCA
rulebook plus the league's house rules. Learn is our glossary of how the app
uses words.

## Open questions, with recommended answers

Ed: say yes, or change any of these.

| Question | Recommended | Why |
|---|---|---|
| Can players reorder favorites? | **No, add/remove only.** Favorites show in the menu's own order. | Reordering is the expensive part (drag on a phone). Add it later if anyone asks. |
| Group names | **"Extras"** and **"Info"** (decided 2026-11-01) | "Non-league" read wrong, and Stats IS league. Extras = the things beyond league night that are about you. |
| Star on a phone (no hover) | **Always-visible small star** at the row's end, its own tap target (44px). Filled star = favorite, outline = not, plus an `aria-label` "Add/Remove … from favorites". | A hover-only star doesn't exist on a phone. Filled vs outline is a shape difference, not a colour one. |
| Limit on favorites | **None** | The list of entries is short (about 10), so the worst case is still short. |
| Where fold open/closed is saved | **This device** (browser storage) | It's a per-device habit, like a remembered tab, and it's harmless if lost. |
| Where favorites are saved | **The player's account** (database) | Players use a phone on match night and a computer at home. Favorites that vanish on the other device feel broken. |
| Bottom tab bar (phone) | **Unchanged** | It's a separate surface (My Teams / Messages / Profile / Manage). Not part of this. |

## How it's built

### Unit 1: one list of menu entries (the drift fix)

New `src/components/layout/navEntries.ts`: the ONE list both menus read.
Each entry has an id, label, path, group (`core`, `extras`,
`info`) and an optional `show` condition (for example Rooms: non-production
only, the same gate as its route).

`AppSidebar` and `AppDrawer` both render from it through shared section
components, so they can't drift again. The drawer wraps rows in `SheetClose`,
the same way `MyMatchPanel` takes `inSheet`. Season Re-Up gets fixed on
desktop for free.

The automatic entries (Join requests, Season Re-Up, Reports) are NOT in the
list. They're computed and placed by the sections, because they appear on a
count, not a choice.

Files stay under ~100 lines. `AppSidebar` (239) and `AppDrawer` (308) should
both get shorter.

### Unit 2: the grouped menu

- `NavFold` component: a heading button that opens and closes, built on
  the shadcn `accordion.tsx` already in `src/components/ui`. Fold state is
  saved per fold id in localStorage, wrapped in try/catch, and defaults to
  closed.
- The Info heading shows "(New)" from `useHasUnseenWhatsNew`.
- Operator: `OperatorOrgRow.tsx` hides Reports at 0 pending (the hook is
  already there: `usePendingReportsCount`).
- `MyMatchPanel`: when there are no live/today matches, the default
  selection is `null` (closed) instead of makeup. Live/today behaviour is
  unchanged.
- **Home and About are new in the signed-in menu.** PR #310 put member-reached
  pages inside `MemberLayout`. Do the same for `/about` (and decide whether
  Home `/` should: it's the marketing landing page, and a signed-in member may
  be redirected from it, so check what `Home` does for a signed-in user first).
  Add both to `MEMBER_REACHED` in `src/navigation/NavRoutes.test.tsx`.

**Checkpoint:** Ed looks at the grouped menu on desktop and phone before
step 2.

### Unit 3: favorites saved to the account

- Migration (real UTC timestamp, `supabase migration new`):
  `members.nav_favorites text[] DEFAULT NULL`. **NULL means "never
  customised"**, which today means no favorites (My Teams + Messages are fixed
  in the core block, not favorites). Nobody needs a backfill, and if we ever
  add default favorites they reach everyone who never customised. Ids not in
  `navEntries` are ignored on read, so a removed page can't break the menu.
  This follows the precedent of per-member settings as `members` columns
  (`profanity_filter_enabled`, `last_seen_whats_new`).
- `useNavFavorites` hook: read from the member profile, write with an
  optimistic update (the star flips instantly and rolls back on error).
  Mutation goes in `src/api/mutations/members.ts` beside
  `profanity_filter_enabled`.
- Star button on each folded row, plus Favorites rows (to un-star). Uses
  shadcn `Button`, and the star icon is from lucide.

### Unit 4: tests + docs

- `navEntries`: every entry's path is a real route, and every member-reached
  one is inside `MemberLayout` (extend the NavRoutes guard).
- Sections: favorites render first; a starred entry leaves its fold; Reports
  hidden at 0; Info "(New)"; My Match closed when only makeups.
- Database test (`src/__tests__/database/`): the column exists and defaults
  to NULL.
- TABLE_OF_CONTENTS, a What's New note (`src/whatsNew/notes/feat-menu-favorites.json`),
  and the migration file documented for Ed + partner to run locally.

## Coordination

- **`feat/game-room`** adds a gated `Rooms` link straight into both
  `AppSidebar` and `AppDrawer`. Whichever merges second must put Rooms in
  `navEntries` (group `extras`, `show: !isProduction`) instead. If this
  branch merges first, the game-room branch needs that one-line move.
  The gate must cover the entry AND the route (CLAUDE.md, Feature Gating).
- Don't stack this on another branch. Branch from main after #310 merges.

## Not doing

- Reordering favorites (see open questions).
- Changing the bottom tab bar.
- Favoriting the automatic entries (My Match, Join requests, Re-Up, Reports).
- Merging Learn and Rules.

## Done when

- Desktop and phone menus show the same groups in the same order, from one
  list.
- My Match opens on live/today and stays closed for makeups only.
- Starring an entry moves it to Favorites on every device the player signs
  in on.
- Reports appears only with something pending.
- Build, unit and database tests green; the NavRoutes guard covers the new
  entries.
