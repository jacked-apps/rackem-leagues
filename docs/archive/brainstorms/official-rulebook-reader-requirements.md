---
date: 2026-04-17
topic: official-rulebook-reader
---

# Official Rulebook Reader (Global)

## Problem Frame

**Primary user job: settling disputes.** When a foul, break requirement, or scoring edge case is in question during league play, a player (or LO, or opponent) needs to pull up the authoritative rulebook text fast. Players rarely read the rulebook casually; the lookup almost always happens under time pressure in an ongoing match.

**Secondary capability: cover-to-cover reading.** New players, LOs, and the curious should also be able to read the rulebook front-to-back if they want to. This isn't a daily driver but must be possible.

Today, the app ships a raw PDF-to-text dump of the official rulebook (`src/officalBCARulebook/bca_rules_sections.json`) that is not renderable as a readable document: multiple rules are concatenated into single paragraphs, page headers and figure captions appear mid-sentence, and there is no searchable structure.

This feature delivers a single, well-formatted, searchable home for the official rulebook so players can look up a specific rule to settle a dispute, and LOs or new members can read it through. It does **not** cover league-specific house rules (a separate follow-on branch) and does **not** yet interpret rules against a described event (a later AI helper feature that will build on this reader's structured data).

**Acknowledged gap:** A search-only reader only fully solves the dispute job when the two parties agree on what the rule *means*, not just what it *says*. When the disagreement is about interpretation, this feature gets the players to the right text; the follow-on AI helper is what completes the job. This branch is deliberately the foundation the AI helper will retrieve against.

## Requirements

**Data**

- R1. The official rulebook is available in the app in structured form: distinct game sections (8-Ball, 9-Ball, 10-Ball, etc.), each with individually addressable numbered rules (e.g., `6-1`, `6-2`), a heading, and clean body text.
- R2. Page headers, running footers, page numbers, and other artifacts of the source PDF are not visible in the rendered reader.
- R3. Each numbered rule has a stable ID that can be deep-linked to from other parts of the app or future features. When CSI publishes a new edition that renumbers rules, a redirect map (old-ID → new-ID) is maintained alongside the cleaned data so previously shared deep-links continue to resolve.

**Reader UI**

- R4. A dedicated global rules page exists at a single URL (e.g., `/rules`), linked from the app's primary navigation (the existing public NavBar). The link is visible to logged-out users as well as logged-in users, since the route is public.
- R5. On entry (no deep link), the page shows: a search input and a game picker (8-Ball / 9-Ball / 10-Ball / … / All games) at the top, and the table of contents for the currently selected game below. Users can scroll the TOC to any rule and read cover-to-cover within that game. The most recently selected game is remembered in local storage so returning users skip the picker.
- R5a. When "All games" is selected, the TOC shows every game grouped with collapsible headers so cover-to-cover reading of the whole rulebook remains possible.
- R6. The reader is built mobile-first (the app's convention). Specifically: the search input stays sticky at the top of the viewport while scrolling; the TOC collapses into a drawer on narrow viewports; rule links and TOC items meet a 44×44 px minimum touch target; rules render with semantic heading structure (`h2` per game, `h3` per rule heading) so screen readers can navigate by rule; a skip-link lands the user on the main content; on desktop, pressing `/` focuses the search input.

**Search**

- R7. A search input on the rules page accepts a keyword or phrase and lists every rule whose heading or body contains a match. Input is debounced while typing.
- R8. A game filter (dropdown or equivalent) scopes search results to a single game (8-Ball, 9-Ball, 10-Ball, etc.) or to "All games" (default). "All games" means no filter, not a separate section in the data.
- R9. Search results show the rule's ID, heading, and a body-text snippet (~120–160 chars) centered on the match with the matched term highlighted. If the match is in the heading only, the first ~150 chars of the body are shown instead. Clicking a result deep-links to that rule in the reader.
- R9a. **Empty query state:** when the search input is empty, the reader shows the table of contents / game list (default browsing view), not a blank results pane.
- R9b. **Zero-results state:** when a query produces no matches, show a single clear message naming the query and the active filter (e.g., `No rules match "jump cue" in 9-Ball`) with two actions: clear the filter, or clear the search.
- R9c. **Unknown deep-link ID:** when a user opens a `/rules/…` link pointing to a rule ID that no longer exists in the current rulebook, the app consults the edition redirect map first. If mapped, it forwards to the new ID. If unmapped, it lands on `/rules` with a visible `Rule <id> is no longer in the current rulebook — showing all rules instead.` message.

**Access**

- R10. The rules page is a **public route** (no login required). It lives in the `Public Routes` block of `src/navigation/NavRoutes.tsx` so that share-links sent to an opposing player during a dispute open directly without hitting a login wall.

**Attribution**

- R11. Every rule page and the rulebook landing display: the publishing organization (CSI / BCA), the effective date of the source edition (e.g., "August 12, 2025 edition"), and a link to the original source PDF. This lets a player confirm authority when the in-app text is challenged in a dispute.

## Success Criteria

**Content correctness (pre-launch)**
- The product owner reads the whole rulebook in the reader and agrees it looks clean and correct against the committed source PDF.
- Search for a known term ("jump cue") returns every rule mentioning that term; filtering to "9-Ball" narrows the hits.
- Clicking a search result lands the user directly at the referenced rule in the reader.
- A shared `/rules/…` deep-link opened by a second user on mobile loads directly to the rule, with the game context visible.

**Usage (post-launch)**
- Within the first 4 weeks after launch, the `/rules` page shows at least a modest volume of real traffic across three signals: page opens, search queries executed, and rule deep-links opened. Specific thresholds and the instrumentation approach (Supabase-native, a lightweight analytics event, or page-view counts) are a planning-time decision — the requirement is that *something* is in place by launch so the owner can tell whether the feature is being used.

## Scope Boundaries

- No league-scoped or organization-scoped **house rules** in this branch. That is the follow-on Branch 2.
- No AI helper / rule interpreter in this branch. That is a later, separate feature.
- No figures / diagrams rendered in v1. Figure references in the text appear as "See Figure 6-2" without an image. The one existing PNG (`src/officalBCARulebook/BCA Rules Figure 2-1.png`) stays in the repo for a future figures feature but is explicitly not rendered anywhere by the v1 reader.
- No editing of official rules from inside the app. The rulebook is static content, updated by a one-time cleanup pass whenever the source PDF is re-issued.
- No exporting, printing, or PDF-download features.
- No commenting, bookmarking, or highlighting by users.
- No version history / diffing between rulebook editions.

## Key Decisions

- **Global, not league-scoped:** The official rulebook is universal content, so it lives at a single global URL rather than being nested under a league. Revisits the user's earlier "league-scoped only" answer because cover-to-cover reading covers all games, not just the one a given league plays.
- **Tiered scope pattern is deferred to Branch 2 (house rules):** The official rulebook itself is not tiered (there is one official rulebook). House rules will mirror the existing `preferences` table's scope pattern (organization / league / season) in their own table. Adding a season scope option is also a Branch 2 concern.
- **Cleanup script is re-runnable per edition:** The script (checked into the repo) is run once now against the Aug 2025 source PDF and re-run whenever CSI publishes a new edition. Its output (cleaned structured data + a redirect map for renumbered rules) is committed to the repo. Runtime stays simple and fast — no live PDF parsing on every request. Before the first cleanup, the script operator verifies a representative sample of rule IDs across games are (a) unique, (b) consistently formatted, and (c) match what the reader will expose as permalink keys.
- **Keyword search + game filter, no category filter in v1:** Matches the most common lookup pattern (find a word, optionally narrow to the game you play) without over-building taxonomy.
- **Skip figures in v1:** Source-PDF figure extraction and asset management would materially expand scope. Text-only is enough to verify rules and answer most questions. Figures can be added as a follow-on without changing the data model.
- **Public route at launch:** `/rules` ships as a public route in `NavRoutes.tsx` (no auth wrapper). Rationale: the dispute-primary user job frequently involves sending a rule link to an opposing player; a login wall on that link breaks the flow. CSI rules are publicly published by CSI, so this is not redistributing confidential content. Revised from the earlier login-required stance after the Problem Frame was sharpened around dispute resolution.
- **Official rules before house rules:** House rules (Branch 2) are where most real league disputes live, but building house rules first would still leave players guessing about the baseline. The official rulebook is also the substrate the future AI helper will retrieve against, and its content already exists (needs cleanup, not authorship). Ship the foundation (this branch) first so Branch 2 can reference official rule IDs and the AI helper can use the same structured data.
- **Cleanup produces both a reader-ready data shape AND a shape the AI helper can retrieve against:** Even though the AI helper is a later feature, the cleanup output format (chunked rules with stable IDs, clean body text, game/section context) is designed so that re-doing cleanup for retrieval later is unnecessary. Specific format is a planning decision; the constraint is that it serve both callers.

## Dependencies / Assumptions

- **Source PDF is committed to the repo** at `src/officalBCARulebook/official_rules_of_csi__08122025.pdf` (CSI Official Rules, August 12, 2025 edition, ~3 MB). Any contributor can re-run the cleanup script against this committed source without external access.
- **"BCA" and "CSI" are treated as the same rulebook.** They are functionally synonymous in the pool community today (CSI publishes the BCAPL rulebook). The UI uses the neutral label **"Official Rules"** to avoid brand ambiguity. **Contingency:** if at any point BCA and CSI publish genuinely divergent rulebooks, the feature must be able to host both side-by-side (e.g., via a rulebook selector). The data model should leave room for this without requiring a rewrite — but building the selector is explicitly out of v1 scope.
- **Rule IDs in the source are used verbatim as permalink keys** (e.g., `6-1`, `8-3`). Pre-cleanup verification confirms IDs are unique and consistently formatted across games. The per-edition redirect map (see R3 and the re-runnable cleanup decision) absorbs future renumbering without breaking old share-links.
- **Existing app conventions apply.** The page uses shadcn/ui components only, file length stays under ~100 lines per the project's standing preferences, and the feature lands on its own branch. Because a full reader (shell, TOC, game picker, search input, results list, rule view, deep-link resolver, redirect map) cannot fit in one ~100-line file, the implementer should plan to decompose into several small focused components up front rather than refactoring later.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Cleanup output format: one JSON file, per-game JSON files, or generated static TypeScript/MDX? Choice depends on bundle size, build-time ergonomics, and whether the file-size preference (~100 lines/file) pushes toward per-game splitting. The format must serve both the reader and the future AI helper without re-cleanup.
- [Affects R7][Technical] Search implementation: in-memory filter over the cleaned data vs. a lightweight client-side index (e.g., Fuse.js or MiniSearch) vs. deferring to Postgres full-text search. Depends on data size once cleaned and on how fuzzy vs. exact the match should be.
- [Affects R5][Technical] Visual treatment of the TOC on desktop: sticky left-rail vs. accordion vs. top tabs. The IA decision (search + game picker + TOC on entry) is fixed; only the visual container is open.
- [Affects R3][Technical] URL shape for rule deep-links: `/rules#6-1`, `/rules/6-1`, or `/rules/8-ball/6-1`. Trade-offs between shareability, back-button behavior, and routing complexity; whichever is chosen must satisfy the "shared link opens directly to the rule with game context visible" success criterion.
- [Affects R8][Product] Keyword search assumes users know canonical rulebook vocabulary ("jump cue" vs. "the ball hopped"). No v1 requirement addresses vocabulary mismatch. Revisit if zero-results rates are high post-launch; adding category browsing or synonym expansion is cheapest in the AI helper phase.
- [Affects Success Criteria] Instrumentation stack for the post-launch usage metric — Supabase event logging, a dedicated analytics service, or page-view tracking — is a planning-time decision. The commitment is that the metric exists at launch, not which library produces it.

## Next Steps

-> `/ce:plan` for structured implementation planning of Branch 1 (Official Rulebook Reader).
