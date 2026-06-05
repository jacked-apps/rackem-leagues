---
title: "feat: Official Rulebook Reader (Branch 1)"
type: feat
status: active
date: 2026-04-17
origin: docs/brainstorms/official-rulebook-reader-requirements.md
deepened: 2026-04-17
---

# feat: Official Rulebook Reader (Branch 1)

## Overview

Build a global, public, searchable, mobile-first reader for the official CSI/BCA rulebook inside the rackem-leagues app. Players (and their opponents) need to settle disputes fast during league play by pulling up the authoritative rulebook text; a secondary audience wants to read the rulebook cover-to-cover. The current raw PDF-to-text dump (`src/officalBCARulebook/bca_rules_sections.json`) is not renderable as a readable document — this plan produces a cleanup pipeline that turns the source PDF into structured, deep-linkable rule data, and a reader UI on top of it.

This is **Branch 1** of a larger set of rule-related features. A separate Branch 2 will add league-scoped house rules; the later AI helper feature will interpret described events against the rulebook. Branch 1's data shape is designed so both follow-ons can retrieve against it without a re-cleanup.

**Branch:** `feature/official-rulebook-reader` (new branch off `main`).

## Problem Frame

**Primary user job (from origin doc):** settling disputes mid-match. A player, LO, or opponent opens `/rules` on mobile under time pressure, looks up a rule, often shares the URL with the other party via the app's existing in-app messaging (or pastes it elsewhere). The feature must return the right rule text fast, on any device, without a login wall.

**Secondary capability:** cover-to-cover reading for new players, LOs, or the curious.

**Acknowledged gap (carried from origin):** a search-only reader doesn't fully solve disputes when the disagreement is about *interpretation*, not *wording*. That is the later AI helper's job. Branch 1 is deliberately the foundation it retrieves against.

## Requirements Trace

Carried forward from `docs/brainstorms/official-rulebook-reader-requirements.md`:

- **R1** — structured rulebook data (game sections, numbered rules, heading, clean body).
- **R2** — no PDF page artifacts visible in the reader.
- **R3** — each rule has a stable deep-linkable ID (a pair of `game` slug + rule number, e.g., `8-ball` + `6-1`). Edition-update handling (redirect map for renumbered rules) is **deferred** to the first time CSI publishes a new edition (out of v1 scope per the document review; the fallback for unknown IDs is a clear "rule not found" message, not a broken page).
- **R4** — `/rules` is discoverable from two entry points: (a) a "Rules" card/link on the Player Dashboard (visible to logged-in members) and (b) a small "Browse the rulebook" link on the public Home page (visible to logged-out visitors). The existing `NavBar` component is not in active use in the app and is NOT modified.
- **R5** — on-entry: search input + game picker + TOC of selected game; remember last-selected game.
- **R5a** — "All games" view groups every game with collapsible headers.
- **R6** — mobile-first reader; sticky search; drawer TOC on narrow; 44×44 px touch targets; semantic h2/h3 headings; skip-link; `/` focuses search on desktop.
- **R7** — debounced keyword search over heading + body.
- **R8** — game filter (single game or "All games" = no filter, not a data section).
- **R9** — results show rule ID, heading, and a ~120–160 char snippet centered on the match with highlight; heading-only matches fall back to first ~150 chars of body.
- **R9a** — empty-query state shows the TOC.
- **R9b** — zero-results state names query + filter with clear-filter / clear-search actions.
- **R9c** — unknown deep-link ID redirects to `/rules` with a toast: `Rule <id> not found — showing all rules instead.`
- **R10** — public route in the `Public Routes` block of `src/navigation/NavRoutes.tsx`.
- **R11** — attribution (publishing org, edition date, link to CSI's hosted source PDF) on every rule page and the rulebook landing.

## Scope Boundaries

- No league-scoped or organization-scoped **house rules** (Branch 2).
- No AI helper / rule interpreter (later feature).
- No figures / diagrams rendered in v1 — figure references remain as text (see origin).
- No in-app editing of official rules.
- No export, print, or PDF download from within the app. The R11 attribution link opens CSI's own hosted PDF in a new tab — this is a link to an external resource, not an in-app download feature.
- No in-app external-share sheet (SMS/email) in v1 — the Copy-link button below plus the existing in-app messaging system cover v1.
- No commenting, bookmarking, or highlighting.
- No version history / diffing between rulebook editions in v1.
- No rule-renumbering redirect map in v1 (deferred to when CSI actually publishes a new edition with renumbered rules).
- No rulebook-selector UI for BCA-vs-CSI divergence (data model leaves room, but UI is out of v1 scope).

### Deferred to Separate Tasks

- **Branch 2: House rules CRUD + display** — LO authoring UI, tiered scope (org/league/season) mirroring the `preferences` table pattern. Separate branch, separate plan.
- **Later: AI rules helper** — interprets described events against the cleaned rule data from this branch. Separate project.
- **Later: Figures pass** — extract figures from the source PDF and render them inline. Non-breaking addition to this plan's data model.
- **Later: Rule-renumbering redirect layer** — build when CSI first publishes a renumbered edition, using real edition diffs as the design input.
- **Later: External share (SMS/email, native share sheet)** — build on top of the v1 Copy-link button once friction shows up.

## Context & Research

### Relevant Code and Patterns

- `src/navigation/NavRoutes.tsx` — lines 137–150 show the `Public Routes` block pattern. `/rules` and `/rules/:game/:ruleId` are added here with no wrapper.
- `src/about/About.tsx`, `src/about/Pricing.tsx`, `src/info/FormatComparison.tsx` — public content-page template.
- `src/dashboard/Dashboard.tsx` — logged-in-member landing; a "Rules" card/link is added here.
- `src/home/Home.tsx` — public landing; a small "Browse the rulebook" link is added here for logged-out discovery.
- `src/navigation/NavBar.tsx` — **not in active use**; not modified by this plan.
- `src/components/ui/` — shadcn primitives in play: `Button`, `Input`, `Tabs`, `ScrollArea`, `Sheet` (for the mobile drawer), `Accordion`, `Skeleton`, `Toaster`/`sonner`.
- `src/officalBCARulebook/` — existing folder for the raw JSON and the one figure PNG. The committed cleaned output lives under a `cleaned/` subfolder. Note: folder name has a typo ("offical") — plan keeps the existing path to avoid a cross-cutting rename.
- `src/__tests__/unit/`, `src/__tests__/integration/`, `src/__tests__/database/` — existing test directories.
- `supabase/migrations/20251130010824_baseline.sql` — the existing RLS role-check pattern: policies use `EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'developer')` against a `members` table. Unit 6 mirrors this exact pattern.
- `package.json` — React 18, react-router-dom 7 (data router), Vitest 4, Supabase client 2.57, TanStack Query, shadcn/Radix primitives, `sonner` for toasts. **No PDF-parsing dependency yet** — cleanup script adds `pdfjs-dist` (via its Node-safe entrypoint `pdfjs-dist/legacy/build/pdf.mjs`).

### Institutional Learnings

- No `docs/solutions/` directory exists in this repo at plan time; no prior learnings to carry forward.

### External References

- Not required. The feature is self-contained over static content.

## Key Technical Decisions

- **Cleanup output format = TypeScript data modules, split per game, plus an index.** The cleanup script emits `.ts` files (not `.json`) so imports are type-safe without changing `tsconfig.app.json` (which does not have `resolveJsonModule` enabled; no existing code imports `.json`). Output lives at `src/officalBCARulebook/cleaned/`: an `index.ts` with edition metadata, games list, a `defaultGame` slug, and a precomputed `(game, ruleId) → rule ref` idMap; one file per game (`8-ball.ts`, `9-ball.ts`, …) containing that game's ordered `Rule[]`.

- **PDF is not committed to the repo.** CSI hosts the official PDF publicly, so the R11 attribution link points to CSI's hosted URL (a placeholder `CSI_SOURCE_PDF_URL` constant, filled in with the exact URL during Unit 5). The cleanup script reads the PDF from an operator-supplied path (CLI arg), not a committed file. Future contributors download their own copy from CSI to re-run cleanup. This removes any redistribution question about hosting CSI's PDF from our own domain.

- **Deep-link URL shape = `/rules/:game/:ruleId`** (e.g., `/rules/8-ball/6-1`). Game context is visible in the shared URL, back-button semantics are clean, future-proof for SEO. The bare `/rules` lands on the reader shell.

- **Search implementation = in-memory substring filter for v1.** Cleaned data size is small (a few hundred rules, expected well under 300 KB gzipped — Unit 1 verifies). Substring filter is fast, needs no library, ships with the static bundle. Upgrade path to Fuse.js/MiniSearch if post-launch zero-results rate is high.

- **TOC visual = shadcn `Tabs` per game + ordered list of rule cards within each tab.** Mobile-first: the same layout works on wide viewports. The `All games` tab uses shadcn `Accordion` for cover-to-cover reading. On the detail page, a shadcn `Sheet` (drawer) gives mobile users in-game navigation without returning to `/rules`.

- **Instrumentation = Supabase event-log table, counts only (no free-text storage).** New `rules_page_events` table with columns `id`, `event_type`, `created_at`, `game` (nullable, short), `rule_id` (nullable, short), `result_count` (nullable int). Three event types: `page_open`, `search_query`, `deep_link_open`. Deliberately **no** raw query text column — removes PII concern, removes abuse-payload vector. RLS allows anonymous INSERT with check constraints on `event_type` and text-column length; SELECT is restricted to `developer` role via the baseline SQL pattern. Motivation: owner wants visibility into search volume to forecast future AI-helper costs — volume counts are what matter, not the queries themselves.

- **Cleanup script uses `pdfjs-dist/legacy/build/pdf.mjs`.** Default switched from `pdf-parse` to `pdfjs-dist` to avoid `pdf-parse`'s well-known ENOENT bug at import time when run via `tsx` from a project root.

- **Cleanup output serves both the reader AND the future AI helper.** Per-rule structure: `{ id, heading, body: string[], game, order, sourcePage? }`. `body` is plain-text paragraphs. Chunked enough for retrieval, simple enough for rendering — the same files back the later AI helper.

- **Lazy route + Suspense fallback.** `/rules` is lazy-loaded via `React.lazy` with a skeleton fallback matching the eventual layout so mobile cold loads don't flash a blank screen.

- **Error boundary.** The rules routes are wrapped in an error boundary that renders a minimal "Couldn't load the rulebook — try again" UI if any cleaned-data module fails to load.

- **Copy-link button on rule pages.** One-tap share affordance using `navigator.clipboard.writeText` + sonner toast. Matches the primary in-app-messaging share flow. No native share sheet / SMS / email in v1.

## Open Questions

### Resolved During Planning

- **JSON vs TypeScript data files?** → TypeScript. Avoids enabling `resolveJsonModule` project-wide; types flow end-to-end with no `any`.
- **PDF parsing library?** → `pdfjs-dist` via its Node entrypoint.
- **Where does the PDF live?** → Not in the repo. Read from an operator-supplied path during cleanup; attribution links to CSI's public URL.
- **Are rule IDs globally unique or scoped by game?** → Scoped by game. Unit 1 verifies both that per-game IDs are unique AND that there is cross-game overlap (confirming the `(game, ruleId)` URL shape is needed). Cleanup fails loudly if either assumption is wrong.
- **Edition-update story?** → Deferred to when the first new edition actually ships. Unknown-ID handler (R9c) gives a graceful fallback today; the redirect layer is added against real diffs later.

### Deferred to Implementation

- Exact PDF parsing edge cases (multi-column layouts, mid-rule page breaks, figure captions) — discover during script development.
- Whether search highlighting uses a small library or hand-rolled `<mark>` spans.
- Whether to memoize the search index at module load or per-query — micro-performance.
- Specific thresholds for "modest volume" — owner sets after seeing the first two weeks of data.

## Output Structure

```
docs/plans/2026-04-17-001-feat-official-rulebook-reader-plan.md  (this file)
scripts/
  clean-rulebook.ts                                # PDF -> cleaned TS modules
src/
  officalBCARulebook/
    bca_rules_sections.json                        # LEGACY; kept until cleanup replaces it
    BCA Rules Figure 2-1.png                       # LEGACY; retained, not rendered in v1
    cleaned/
      index.ts                                     # edition meta + games + idMap + defaultGame
      8-ball.ts
      9-ball.ts
      10-ball.ts
      one-pocket.ts
      14-1-continuous.ts
      bank-pool.ts
      wheelchair.ts
      scotch-doubles.ts
      general.ts
  rules/                                           # new feature folder
    RulesPage.tsx                                  # /rules landing shell
    RuleDetailPage.tsx                             # /rules/:game/:ruleId
    GameTOC.tsx                                    # rule-list view inside a game tab
    AllGamesAccordion.tsx                          # cover-to-cover view
    RuleCard.tsx                                   # one rule row in the TOC
    RuleView.tsx                                   # full rule render
    SearchInput.tsx                                # sticky search input
    SearchResults.tsx                              # list + states
    SearchSnippet.tsx                              # snippet extraction + highlight
    CopyLinkButton.tsx                             # one-tap share
    Attribution.tsx                                # R11 source-and-edition attribution
    RulesSkeleton.tsx                              # Suspense fallback skeleton
    RulesErrorBoundary.tsx                         # error boundary around rules routes
    useRulebook.ts                                 # typed data loader
    useRulebookSearch.ts                           # in-memory search hook
    useRulesEvents.ts                              # posts usage events to Supabase
    resolveRuleId.ts                               # (game, ruleId) -> rule or null
    rulebook.types.ts                              # Rule, Game, Rulebook types
  __tests__/
    unit/
      resolveRuleId.test.ts
      useRulebookSearch.test.ts
      searchSnippet.test.ts
      copyLinkButton.test.ts
    integration/
      RulesPage.test.tsx
      RuleDetailPage.test.tsx
    database/
      rulesPageEvents.rls.test.ts
supabase/
  migrations/
    20260417000000_rules_page_events.sql           # new events table + RLS
```

Per-unit `Files:` sections below are authoritative. The tree is a scope declaration.

## Implementation Units

- [ ] **Unit 1: Cleanup script + cleaned TypeScript data modules**

**Goal:** Turn the source PDF into clean, structured, deep-linkable rule data committed to the repo as TypeScript modules. Establish the data shape the rest of the feature consumes and the future AI helper will retrieve against.

**Requirements:** R1, R2, R3.

**Dependencies:** None.

**Files:**
- Create: `scripts/clean-rulebook.ts`
- Create: `src/officalBCARulebook/cleaned/index.ts`
- Create: `src/officalBCARulebook/cleaned/<game>.ts` (one per game: 8-ball, 9-ball, 10-ball, one-pocket, 14-1-continuous, bank-pool, wheelchair, scotch-doubles, general)
- Create: `src/rules/rulebook.types.ts` (shared types: `Rule`, `Game`, `Rulebook`)
- Test: `src/__tests__/unit/cleanup.smoke.test.ts`

**Approach:**
- Script accepts a `--pdf` CLI arg pointing to a local CSI PDF (not committed). Operator downloads the PDF from CSI's website before running.
- Parses via `pdfjs-dist/legacy/build/pdf.mjs` (Node-safe entrypoint, avoids `pdf-parse`'s ENOENT gotcha).
- Splits text by rule-ID markers (regex over raw page text), strips running headers/footers (`OFFICIAL RULES OF CUESPORTS INTERNATIONAL`, page numbers), collapses broken line-wraps into paragraphs.
- Per-rule output: `{ id, heading, body: string[], game, order, sourcePage }`. `body` is an array of paragraph strings (no markup).
- `index.ts` exports: `{ publisher: 'CSI', edition: '2025-08-12', sourcePdfUrl: '<CSI hosted URL>', defaultGame: '8-ball', games: [{ slug, name, ruleCount }], idMap: Record<'<game>:<ruleId>', { game, ruleId }> }`.
- Pre-cleanup verification (script asserts and fails loudly if violated): (a) each game's rule IDs are unique within that game; (b) at least one rule ID exists in more than one game (confirms the `(game, ruleId)` URL shape is necessary); (c) no body paragraph contains `OFFICIAL RULES OF CUESPORTS INTERNATIONAL` or bare page-number lines; (d) no body paragraph contains raw HTML characters `<` or `>` (XSS defense in depth).
- Script prints 3 sample rules per game for manual QA and emits a total-gzipped-size metric so the owner can confirm the < 300 KB budget before committing.

**Execution note:** Run once against the 2025-08-12 PDF. Iterate on parsing heuristics until the product owner agrees the text is clean.

**Patterns to follow:**
- `supabase/migrations/` timestamp naming for the later migration.
- `src/utils/handicap/*.ts` style for small, focused, typed utility modules.

**Test scenarios:**
- Happy path: `index.ts` imports as a valid module; `games` is non-empty; `idMap` is populated; `defaultGame` is `'8-ball'`.
- Happy path: every cleaned game module exports a non-empty `Rule[]` with each entry carrying non-empty `id`, `heading`, and `body.length >= 1`.
- Edge case: no duplicate `id` within a single game.
- Edge case: at least one `id` exists in multiple games (verifies URL-shape decision).
- Edge case: no body paragraph contains `OFFICIAL RULES OF CUESPORTS INTERNATIONAL`.
- Edge case: no body paragraph contains raw `<` or `>` characters.

**Verification:**
- `pnpm tsx scripts/clean-rulebook.ts --pdf <local-path>` exits 0 with all files written.
- `cleanup.smoke.test.ts` passes.
- Owner spot-reads ≥3 rules from each game and confirms they match the source PDF.

---

- [ ] **Unit 2: Rulebook loader + search hook + rule-ID resolver**

**Goal:** Provide the typed data-access layer the UI uses. Three focused modules: loader, substring search, resolver.

**Requirements:** R1, R3, R7.

**Dependencies:** Unit 1.

**Files:**
- Create: `src/rules/useRulebook.ts`
- Create: `src/rules/useRulebookSearch.ts`
- Create: `src/rules/resolveRuleId.ts`
- Test: `src/__tests__/unit/useRulebookSearch.test.ts`
- Test: `src/__tests__/unit/resolveRuleId.test.ts`

**Approach:**
- `useRulebook` statically imports `index.ts` and each game module, merges them into a `Rulebook` singleton, memoized at module load. Throws a typed error at load if `games` is empty so the error boundary can render a user-facing fallback.
- `useRulebookSearch(query, gameFilter)` returns `{ rule, matchType: 'heading' | 'body', matchIndex }[]` using `String#toLowerCase().includes()`. Empty/whitespace query returns `[]`.
- `resolveRuleId(game, ruleId)` looks up the pair in `index.idMap`; returns the rule or `null`. No redirect map in v1 (deferred per scope).

**Patterns to follow:**
- `src/utils/handicap/get5v5GamesNeeded.ts` for small, typed, testable modules with co-located tests.

**Test scenarios:**
- Happy path: search for a known substring returns all rules whose heading or body includes it (case-insensitive), with correct `matchType`.
- Happy path: game filter narrows results to the selected game.
- Edge case: empty / whitespace-only query returns `[]`.
- Edge case: no-match query returns `[]`.
- Edge case: query with regex-special chars (`.`, `*`, `?`) is treated as a literal substring — no throw.
- Happy path: `resolveRuleId('8-ball', '6-1')` returns the matching rule for a known ID.
- Edge case: `resolveRuleId('8-ball', 'does-not-exist')` returns `null`.
- Edge case: `resolveRuleId('bogus-game', '6-1')` returns `null`.

**Verification:**
- Unit tests pass.
- `pnpm run build` completes with no `any` usage in these modules.

---

- [ ] **Unit 3: Routing + nav link + `/rules` shell page + Attribution + Skeleton + ErrorBoundary**

**Goal:** Wire the public route, add the nav link, render the reader shell with search, game picker, TOC, attribution, a loading skeleton, and an error boundary.

**Requirements:** R4, R5, R5a, R6, R7, R8, R10, R11 (landing portion).

**Dependencies:** Unit 2.

**Files:**
- Modify: `src/navigation/NavRoutes.tsx` (add `/rules` and `/rules/:game/:ruleId` to Public Routes; wrap both in `RulesErrorBoundary` + `Suspense fallback={<RulesSkeleton />}`)
- Modify: `src/dashboard/Dashboard.tsx` (add a "Rules" card/link for logged-in members)
- Modify: `src/home/Home.tsx` (add a small "Browse the rulebook" link for logged-out visitors)
- Create: `src/rules/RulesPage.tsx`
- Create: `src/rules/GameTOC.tsx`
- Create: `src/rules/AllGamesAccordion.tsx`
- Create: `src/rules/RuleCard.tsx`
- Create: `src/rules/SearchInput.tsx`
- Create: `src/rules/Attribution.tsx`
- Create: `src/rules/RulesSkeleton.tsx`
- Create: `src/rules/RulesErrorBoundary.tsx`
- Test: `src/__tests__/integration/RulesPage.test.tsx`

**Approach:**
- Routes added to the Public Routes block in `NavRoutes.tsx`, both wrapped in `<RulesErrorBoundary><Suspense fallback={<RulesSkeleton />}>…</Suspense></RulesErrorBoundary>`.
- `RulesPage` layout (mobile-first): sticky `SearchInput` → shadcn `Tabs` header listing each game + an "All games" tab → body = `GameTOC` for a single game or `AllGamesAccordion` for "All games".
- Initial selected game comes from `localStorage` key `rackem:rules:lastGame`; if missing or unknown, falls back to `index.defaultGame` (which is `'8-ball'` per Unit 1). Bad `localStorage` values are overwritten with the default.
- `SearchInput` is sticky at the top, debounced 250 ms, uses shadcn `Input`; on desktop, pressing `/` focuses it (ignored when another input is focused).
- `Attribution` renders below the main content on the landing: "Official Rules — CSI / BCA — August 12, 2025 edition — [View source PDF]" where the link points to `index.sourcePdfUrl` (CSI's hosted URL, opens in a new tab with `rel="noopener noreferrer"`).
- `RulesSkeleton` is a shadcn `Skeleton`-based placeholder matching the eventual layout (search bar row, tab row, 6-8 rule card placeholders). No layout shift when the real content loads.
- `RulesErrorBoundary` catches load errors from `useRulebook` and renders a minimal fallback: "We couldn't load the rulebook. Please reload the page." with a reload button.
- The existing `NavBar.tsx` is not in active use and is left untouched. Discovery entry points are added where real users land: the Player Dashboard (for logged-in members) and the public Home page (for logged-out visitors).

**Patterns to follow:**
- `src/about/About.tsx` as a public-page template.
- shadcn `Tabs` usage elsewhere in the app.
- `sonner` toast usage for share feedback (used in Unit 5).

**Test scenarios:**
- Happy path: navigating to `/rules` (logged-out) renders the search input, tab row for every game, and the default-game TOC.
- Happy path: switching tabs swaps the TOC content and persists the selection in `localStorage`.
- Happy path: selecting "All games" renders the Accordion with every game section.
- Happy path: `Attribution` renders with the CSI source-PDF link set to `index.sourcePdfUrl` and `target="_blank" rel="noopener noreferrer"`.
- Edge case: `localStorage` holds an unknown slug → falls back to `defaultGame`, overwrites the bad value.
- Edge case: `/` on desktop focuses search; `/` while another input is focused does not steal focus.
- Integration: clicking a `RuleCard` in a game's TOC navigates to `/rules/:game/:ruleId`.
- Integration (a11y): heading hierarchy is `h2` per game, `h3` per rule heading; skip-link lands on main content.
- Integration: rendering `/rules` while `useRulebook` throws triggers `RulesErrorBoundary`'s fallback.

**Verification:**
- `pnpm run dev` serves `/rules` publicly (no login redirect); the page renders; tabs work; skeleton appears on cold loads; error boundary renders when data is broken.
- Integration tests pass.

---

- [ ] **Unit 4: Search results + empty / zero-result / snippet states**

**Goal:** When the user types, swap the TOC for a results list implementing R9, R9a, R9b, including snippet extraction and multi-match handling.

**Requirements:** R7, R8, R9, R9a, R9b.

**Dependencies:** Unit 3.

**Files:**
- Create: `src/rules/SearchResults.tsx`
- Create: `src/rules/SearchSnippet.tsx`
- Modify: `src/rules/RulesPage.tsx` (branch: TOC when query empty, `SearchResults` when non-empty)
- Test: `src/__tests__/unit/searchSnippet.test.ts`
- Test: `src/__tests__/integration/RulesPage.test.tsx` (extend with search-state scenarios)

**Approach:**
- `SearchSnippet` rule: when the query matches the body (anywhere), snippet centers on the **first** body match, wraps that match in `<mark>`, and additional matches visible in the window are also highlighted. Length ~120–160 chars, word-boundary truncation with ellipsis. If the match is heading-only, snippet is the first ~150 chars of the body with no `<mark>` (heading match is shown in the heading row).
- `<mark>` is always rendered around known-escaped substrings of already-escaped React text. Never `dangerouslySetInnerHTML` (XSS defense, matches Unit 1's cleanup guarantee that body text contains no raw HTML).
- `SearchResults` consumes `useRulebookSearch(query, gameFilter)` and renders hits as clickable cards (`[rule-id]  [heading]  [snippet]`) that navigate to `/rules/:game/:ruleId`.
- Empty-query branch (R9a): handled in `RulesPage` — show TOC.
- Zero-results branch (R9b): two copy variants depending on whether a game filter is active:
  - Single-game filter active: `No rules match "{query}" in {gameName}.` with both `Clear filter` and `Clear search` buttons.
  - "All games" filter active: `No rules match "{query}".` with only `Clear search` (no filter to clear).

**Patterns to follow:**
- Existing shadcn `Card` components for list items.

**Test scenarios:**
- Happy path: typing a known-hit term renders a non-empty list; each item carries id, heading, snippet; matched substring wrapped in `<mark>`.
- Happy path: snippet length lies between 100 and 200 chars and ends on a word boundary or ellipsis.
- Edge case: heading-only match — snippet falls back to first ~150 body chars with no `<mark>`.
- Edge case: multi-match body — snippet centers on first match, any subsequent match visible in the window is also `<mark>`ed.
- Edge case: single-game filter + zero results → two clear actions rendered; both reset correctly.
- Edge case: "All games" + zero results → only Clear search rendered.
- Edge case: regex-special chars in query render as literal text and do not throw.
- Smoke: 500+ hit query renders without freezing the UI (no virtualization required for v1).

**Verification:**
- Unit tests pass for snippet extraction with quantified bounds.
- Integration tests cover empty → typing → results → zero-results → cleared transitions.

---

- [ ] **Unit 5: Rule detail page + attribution + drawer TOC + Copy-link button + unknown-ID fallback**

**Goal:** Render a single rule at `/rules/:game/:ruleId` with full body, attribution, a mobile drawer for same-game navigation, a one-tap Copy-link button, and a graceful unknown-ID fallback.

**Requirements:** R3, R6 (drawer), R9c, R11.

**Dependencies:** Unit 2, Unit 3 (reuses `Attribution`).

**Files:**
- Create: `src/rules/RuleDetailPage.tsx`
- Create: `src/rules/RuleView.tsx`
- Create: `src/rules/CopyLinkButton.tsx`
- Test: `src/__tests__/unit/copyLinkButton.test.ts`
- Test: `src/__tests__/integration/RuleDetailPage.test.tsx`

**Approach:**
- `RuleDetailPage` reads `:game` and `:ruleId` from the URL and calls `resolveRuleId`. If resolved, renders `RuleView`. If `null`, `navigate('/rules', { replace: true })` and fires a `sonner` toast: `Rule <id> not found — showing all rules instead.`
- `RuleView` renders: `<article>` wrapper, `<h1>` heading, `<p>` per body paragraph, a shadcn `Sheet` (drawer) trigger button in the top bar ("Browse rules"), and the `CopyLinkButton` beside the heading.
- The `Sheet` drawer (R6 mobile requirement) shows the current game's TOC with the current rule highlighted; clicking another rule navigates in-drawer and closes.
- `CopyLinkButton` writes `window.location.href` to the clipboard via `navigator.clipboard.writeText`, fires a toast on success (`Link copied`), and a different toast on failure (`Couldn't copy link — try manual copy instead`). Button is a shadcn `Button` with a 44×44 px touch target.
- `Attribution` (reused from Unit 3) renders as a footer on the detail page with the same CSI link.

**Patterns to follow:**
- `sonner` toast usage elsewhere in the app.
- `react-router-dom` `useParams`/`useNavigate` (e.g., `src/pages/PlayerProfile.tsx`).
- shadcn `Sheet` for the drawer.

**Test scenarios:**
- Happy path: visiting `/rules/8-ball/6-1` for a live rule renders `RuleView` with heading, all body paragraphs in order, drawer trigger, `CopyLinkButton`, and `Attribution`.
- Happy path: clicking the drawer trigger opens the shadcn Sheet with the current game's rule list; the current rule is visually highlighted.
- Happy path: clicking a rule in the drawer navigates to that rule and closes the drawer.
- Happy path: tapping `CopyLinkButton` writes `window.location.href` to clipboard and fires the success toast.
- Edge case: visiting `/rules/8-ball/does-not-exist` redirects to `/rules` and fires the not-found toast with the ID in the message.
- Edge case: visiting `/rules/bogus-game/6-1` redirects to `/rules` and fires the not-found toast.
- Error path: `navigator.clipboard.writeText` rejects (permissions denied) — error toast fires, original UI is not disturbed.
- Integration (a11y): rule article has a single `<h1>`; Attribution link has an accessible name; drawer has proper ARIA (shadcn Sheet handles this).

**Verification:**
- Visiting known/unknown URLs behaves per R9c.
- Drawer navigation works on a mobile viewport.
- Copy-link round-trips end-to-end in the integration test.

---

- [ ] **Unit 6: Usage instrumentation (Supabase event log — counts only)**

**Goal:** Capture post-launch usage signal (page opens, search volume, deep-link opens) so the owner can forecast demand for the future AI helper. Deliberately no free-text query storage.

**Requirements:** Success Criteria — post-launch usage metric.

**Dependencies:** Units 3 and 5 (events fire from the UI).

**Files:**
- Create: `supabase/migrations/20260417000000_rules_page_events.sql`
- Create: `src/rules/useRulesEvents.ts`
- Modify: `src/rules/RulesPage.tsx` (fire `page_open` on mount; fire `search_query` with `result_count` on debounced query change)
- Modify: `src/rules/RuleDetailPage.tsx` (fire `deep_link_open` with `game` + `rule_id` on mount after successful resolve)
- Test: `src/__tests__/database/rulesPageEvents.rls.test.ts`

**Approach:**
- **Migration:** create table `rules_page_events` with columns:
  - `id uuid primary key default gen_random_uuid()`
  - `event_type text not null check (event_type in ('page_open','search_query','deep_link_open'))`
  - `created_at timestamptz not null default now()`
  - `game text check (char_length(game) <= 40)`
  - `rule_id text check (char_length(rule_id) <= 40)`
  - `result_count integer check (result_count >= 0)`
  - (explicitly **no** `query` column)
- Enable RLS. Two policies:
  - INSERT — permissive for `anon` and `authenticated`; `with check (true)` — the column check constraints above bound payload size.
  - SELECT — `using (exists (select 1 from members where user_id = auth.uid() and role = 'developer'))` — mirrors the baseline migration's role-check pattern for developer-only access.
- `useRulesEvents` provides three fire-and-forget helpers: `logPageOpen()`, `logSearch(gameFilter, resultCount)`, `logDeepLink(game, ruleId)`. Inserts are sent via the existing Supabase client; errors are swallowed (silent telemetry).
- Typed payloads declared in `rulebook.types.ts`.

**Patterns to follow:**
- Existing `supabase/migrations/` SQL style.
- Existing `src/__tests__/database/*.rls.test.ts` structure.

**Test scenarios:**
- RLS happy path: anonymous client INSERT succeeds for all three valid `event_type` values.
- RLS error path: anonymous INSERT with `event_type = 'bogus'` is rejected by the check constraint.
- RLS error path: INSERT with `char_length(game) > 40` is rejected.
- RLS error path: anonymous SELECT returns zero rows (RLS denies the read).
- RLS happy path: developer-role client SELECT returns all inserted rows.
- Integration (UI): opening `/rules` produces one `page_open` row; settled search fires exactly one `search_query` row with `result_count` populated; opening a valid rule deep-link produces one `deep_link_open` row with correct `game` and `rule_id`.
- Edge case: a settled search with zero results still produces one row (`result_count = 0`).

**Verification:**
- Migration applies cleanly via `supabase db reset`.
- RLS test suite passes.
- Manual: open `/rules`, run a search, open a rule → three rows appear in the Supabase dashboard with the right event types.

---

## System-Wide Impact

- **Interaction graph:** Additive. New code imports from `src/rules/`, shared `ui/` primitives, `supabaseClient`, and react-router. No cross-feature side effects.
- **Error propagation:** Deep-link resolution misses → toast + redirect. Data-load failure → `RulesErrorBoundary` shows a branded fallback. Event-log insert errors are swallowed silently. PDF parsing errors are build-time and visible to the script operator.
- **State lifecycle risks:** The only persisted client state is `localStorage` key `rackem:rules:lastGame`. Server-side state is the append-only `rules_page_events` table.
- **API surface parity:** No existing interfaces touched.
- **Integration coverage:** Share-flow is covered (Unit 5 integration test: load a deep-link URL directly, Copy-link button round-trip). Unknown-ID fallback covered.
- **Unchanged invariants:** All existing auth-gated routes stay auth-gated. Existing `bca_rules_sections.json` is not deleted or referenced at runtime; consider cleanup in a follow-up task once v1 ships.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| PDF parsing produces noisy/wrong output (OCR artifacts, page breaks, multi-column) | Pre-cleanup verification step in Unit 1 fails loudly on ID collisions or HTML chars; owner spot-reads ≥3 rules per game against the source PDF before commit. Swap to alternate PDF library if heuristics insufficient. |
| Cleaned data size inflates the main bundle | `/rules` is a lazy route; Unit 1 reports total gzipped size against a <300 KB budget before commit. |
| Anonymous INSERT on `rules_page_events` attracts bots / drive-by noise | Table stores no free-text; payload columns are size-bounded; event-type is constrained. Worst case is inflated row counts — data remains usable. If noise becomes meaningful, add an Edge Function rate-limiter in a follow-up. |
| `localStorage` unavailable (private browsing, quota) | Falls back to `index.defaultGame`; tested in Unit 3. |
| Future CSI edition renumbers rules and breaks shared links | Accepted risk in v1 per Decision 2; unknown-ID toast gives a graceful landing. Redirect layer added when the first new edition lands, using real diffs as the design input. |
| CSI's hosted source-PDF URL changes / is taken down | Attribution link may go stale. Detect via periodic manual check; easy to update by re-running cleanup with a new `sourcePdfUrl`. |
| ~100-line file target is tight for some components | Components are pre-decomposed in Output Structure; implementer may split further without changing plan intent. |
| Clipboard API unavailable or permission denied | `CopyLinkButton` falls back to an error toast telling the user to copy manually; not fatal. |
| BCA and CSI eventually diverge (per origin contingency) | Data shape supports a future rulebook selector; v1 does not build it. |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` to index the new `src/rules/` folder, `scripts/clean-rulebook.ts`, the new migration, and any new test files.
- No feature flag; `/rules` is additive.
- Owner post-launch: run an aggregate query against `rules_page_events` (e.g., `SELECT event_type, COUNT(*) FROM rules_page_events WHERE created_at > now() - interval '4 weeks' GROUP BY event_type`) to see page-open, search, and deep-link volume. Use search volume as the proxy signal for future AI-helper demand.
- Document in the Unit 1 README (or a script comment) that running the cleanup requires downloading the current CSI PDF manually from CSI's website — it is not committed to the repo.

## Sources & References

- **Origin document:** [docs/brainstorms/official-rulebook-reader-requirements.md](../brainstorms/official-rulebook-reader-requirements.md)
- Routing pattern: `src/navigation/NavRoutes.tsx` (Public Routes block, lines 137–150)
- Public page template: `src/about/About.tsx`, `src/info/FormatComparison.tsx`
- RLS role-check pattern: `supabase/migrations/20251130010824_baseline.sql` (`EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = ...)`)
- Test pattern references: `src/__tests__/{unit,integration,database}/`
- Legacy rulebook data (kept, not read at runtime): `src/officalBCARulebook/bca_rules_sections.json`
