---
date: 2026-04-19
topic: league-house-rules
---

# League House Rules (Branch 2)

## Problem Frame

**The player jobs this feature serves:**

1. **Disputes mid-match.** A player needs to know what rule applies *in the league they are currently playing in* — not a union of every league they've ever been a member of. In most leagues, the league's house rules *are* the effective rules; the published CSI text is overridden or modified. Today Branch 1 only surfaces official CSI rules, so house-rule disputes fall back to "go ask the LO."

2. **Joining a new league.** A player already knows CSI rules from years of play. They're joining a new league run by a different organization. They want a focused "what's different here?" **diff view** — not the whole rulebook, just the deltas.

3. **Reference reading for operators and newcomers.** New LOs want to see what other leagues do. New players want a feel for how their league departs from standard.

**The LO jobs:**

4. **Authoring.** LOs write house rules at three levels of rigor:
   - **Lazy** — just dump rules with no tie to CSI text. Search still finds them; reader surfaces them via origin label.
   - **Typical** — write the rule and link it to the CSI rule it modifies.
   - **Meticulous** — link it AND match CSI's voice / structure so the house rule reads inline like an official rule.

   All three are allowed. Scenario 3 is encouraged via a **"Copy official text as starting point"** button when a CSI rule is linked.

**The feature integrates with Branch 1's reader** (the `/rules` page) rather than existing as a separate page. When a player reads the rulebook, the house rules that apply to them appear alongside CSI rules, clearly labeled with origin. The existing reader stays universal and public; house rules extend it without replacing it.

**Branch 3 (later)** will be an AI helper that interprets described events against both CSI + house rules. This branch lays the structured data that helper will retrieve against.

## Requirements

**Data**

- R1. Each house-rule record carries: `scope_type` (`'organization' | 'league'`), `scope_id` (FK — `organizations.id` or `leagues.id`), `game` (game slug from Branch 1's game registry, plus an explicit `'general'` option for rules that apply across all games), `effect_type` (`'override' | 'enhance' | 'standalone'`), `related_rule_id` (optional, references a key from Branch 1's `idMap` in `src/officalBCARulebook/cleaned/index.ts`), `title`, `body` (paragraphs as `string[]`).
- R2. Each record is tied to exactly one organization OR one league — never both, never neither. No season tier in v1.
- R3. `related_rule_id` is **required** when `effect_type` is `override` or `enhance`. It **must be empty** when `effect_type` is `standalone`. Effect-type semantics: `override` means the linked CSI rule no longer applies and this replaces it; `enhance` means the CSI rule still applies AND this adds to it; `standalone` means no CSI rule is involved.
- R4. Body paragraphs use the same plain-text format as Branch 1's `Rule.body` so one `RuleView` component can render both CSI and house rules.
- R5. **Single CSI link per house rule in v1.** A house rule that conceptually modifies multiple CSI rules is authored as multiple records (one per CSI link). Noted as a future enhancement if the one-to-one shape proves too rigid.
- R6. All house rules are **world-readable** (same public-access posture as the `/rules` reader). Write access is restricted per R27.

**Reader integration (overlay)**

- R7. A new **"House rules ▾"** filter chip is added to the `/rules` reader's chip row, alongside the existing game / "More games" / "All games" chips.
- R8. When the filter is OFF (the default first-load state for every user), the reader behaves exactly as Branch 1 ships: CSI rules only.
- R9. When the filter is ON, house rules are layered on top of CSI rules. Every house-rule card is **distinctly labeled with its origin** — the league or organization name (e.g., *Ed's Leagues*, *Downtown 8-Ball*). CSI rules keep their existing "Official / CSI" attribution.
- R10. **Default scope when the filter is toggled on** is the player's **active league** — a single league the player picks and the app remembers:
   - If the player is a member of exactly one league, that league becomes the active league automatically.
   - If the player is a member of multiple leagues OR no leagues (including logged-out users), a **scope picker sheet** opens the first time the filter is activated.
   - The active-league selection persists in `localStorage` under `rackem:rules:activeLeague`.
   - The player can change it anytime via the chevron on the filter chip (opens the same scope picker).
- R11. The scope picker lets the player choose from: their own league memberships (shown first, grouped), all leagues in all organizations they can see (which, per R6, is every league in the system), and an explicit **"My memberships (all)"** option that fans out across every league they belong to — this is no longer the default but is available for the comparison/browsing job.
- R12. **Differences-only mode (cheat-sheet job).** When the filter is scoped to a single league or org, a `Differences only` toggle appears near the chip. When enabled, the reader hides CSI rules that have no house-rule layered on top of them — showing only the deltas for that scope. Delivers Job 2 (joining a new league) as a proper diff view.
- R13. **Discoverability nudge.** For logged-in members who have never activated the filter, a one-time coach-mark / tooltip appears near the chip on their first `/rules` visit: *"Your league may have house rules that override these — turn this on to see them."* The nudge is dismissible and remembered per-user.

**Search**

- R14. Search is always inclusive across CSI rules AND every (world-readable) house rule across every org/league, regardless of the filter state. This is the implementation of Job 1's primary flow ("I'm in a dispute, show me everything that matches").
- R15. Each search-result card displays its origin label prominently (CSI, or the specific org / league name). Effect-type backlink ("Overrides CSI 2-2 →") is shown for `override` / `enhance` results.
- R16. **Result ordering** — CSI rules first, then the player's **active league's rules** (if an active league is set), then rules from the rest of the player's memberships, then any other readable house rules. This lets the player see their league's answer first when matches exist, while still preserving the cross-league comparison the user asked for.
- R17. **Search scales across two data sources.** Branch 1's `searchRulebook` (in-memory bundled data) stays as-is. A new `searchHouseRules(query, scope)` function queries Supabase on debounced changes. The `SearchResults` component merges both result streams in the order above. (Planning decides: per-keystroke DB query vs. eager-load of house rules on reader mount. The doc's stance is: v1 eager-loads on mount because the house-rule corpus will be small for a while.)

**Rule-detail view for a house rule**

- R18. Navigating to a house rule (from a search result or a scoped-filter list) opens a detail page that renders the same shape as the existing `RuleDetailPage`: heading, body paragraphs, attribution, drawer, Copy-link button. Attribution shows the organization/league name instead of "CSI", and (when `related_rule_id` is populated) a prominent banner: *"Overrides CSI Rule 2-2"* (or *"Enhances CSI Rule 2-2"*) linking to the CSI rule.
- R19. **Deep-link URLs are human-readable** — include the league (or org) slug plus a rule slug when available. Example shape: `/rules/house/eds-leagues/8-on-break-counts-as-win`. Planning decides the exact format; the requirement is the URL carries meaning when pasted into a text message and works with the existing Copy-link button.

**LO authoring — surfaces**

- R20. **`LeagueRules.tsx` (already in the repo as a stub at `/league-rules/:orgId`) is repurposed as the organization-wide house-rules authoring surface.** The existing deep-link from `OrganizationSettings` into `/league-rules/:orgId` stays; the page is expanded from its current placeholder into the full org-wide manager.
- R21. **League-specific rules are authored inside `LeagueSettings` at `/league/:leagueId/settings`.** A new "House rules" section lists that league's house rules with inline add / edit / delete controls.

**LO authoring — form fields**

- R22. The authoring form fields: `game` (single-select, options sourced from Branch 1's `rulebook.index.games` plus an explicit *"General / All games"* option), `effect_type` (radio: Override / Enhance / Standalone), `related CSI rule` (searchable picker reusing `searchRulebook` from Branch 1; required when Override/Enhance; hidden when Standalone), `title` (short text), `body` (textarea for paragraphs).
- R23. **"Copy official text as starting point"** button shown above the body textarea when `effect_type` is Override or Enhance and a CSI rule has been picked. Copies the CSI rule's body paragraphs into the textarea so the LO can edit from there, nudging toward Scenario 3 (meticulous authoring).

**LO authoring — interaction states**

- R24. **Delete requires confirmation.** Inline delete control opens a dialog showing the rule's title and a short body preview, with *"This cannot be undone. Delete anyway?"*. Success fires a sonner toast with an **Undo** action that re-inserts the rule within ~10 seconds before the delete is finalized. (No version history in v1; undo is the only safety net.)
- R25. **Effect-type switch protects the user's work.** If the LO switches `effect_type` from Override/Enhance to Standalone while a CSI rule is picked, the picked value is hidden (not silently cleared from state), and switching back restores it. Same for the Copy-text button — if it would overwrite a non-empty textarea, a confirm dialog appears.
- R26. **Required standard form states.** Loading (during save / picker search), validation (required-field errors inline under fields on blur, not only on submit), error (save failures surface via toast with retry; form stays open with values preserved), success (save closes the form and fires a success toast).

**LO authoring — access control**

- R27. Access control mirrors existing operator-staff patterns via the `organization_staff` table. Any `organization_staff` row whose `member_id` belongs to the current user and whose `organization_id` owns the rule's scope (directly for org-wide rules, or transitively via `leagues.organization_id` for league-specific rules) grants write access. All other users have read-only access. Exact predicate + RLS SQL: planning-time detail.

**No-merge display policy**

- R28. The reader does NOT automatically resolve conflicts between overlapping rules (e.g., both an org-wide and a league-specific override of CSI 2-2). All applicable house rules are shown, each clearly labeled. Ordering within a scope: **league-specific rules before org-wide rules** (more specific first) so the player's reading convention matches intuition, but we don't collapse or hide anything.

**Usage instrumentation**

- R29. Extend `rules_page_events` with new event types tracking feature usage tied to the stated jobs:
   - `house_filter_activated` — fires when a player turns the filter on (emitted with scope)
   - `differences_only_activated` — fires when the new cheat-sheet toggle is turned on
   - `house_rule_opened` — fires when a player opens a specific house rule's detail page
   - `scope_changed` — fires when the active league is changed
   - Adding these requires a schema migration that drops and recreates the existing `event_type` CHECK constraint (acknowledged; not "no schema redesign" as the prior draft claimed).
- R30. The **consumer** of these events is the product owner: they review the counts periodically (via Supabase dashboard or a query) to tell whether the filter-default choice is working and whether the differences-only toggle earns its keep. This is the same feedback loop the `rules_page_events` table was built for in Branch 1.

## Success Criteria

**Pre-launch (content / function correctness)**
- An LO can create one house rule at each scope (org-wide via `LeagueRules`, league-specific via `LeagueSettings`) with all three effect types. Each rule appears correctly labeled in the reader within seconds.
- A player in one league, filter on, sees CSI + that league's house rules only. Toggling filter off returns the reader to Branch 1 behavior exactly.
- A player with multiple league memberships sees the scope picker on first activation; their pick persists in localStorage.
- Searching for a keyword the house rule contains surfaces it in results, labeled with origin; the player's active league's rule sorts above other leagues'.
- **Differences-only** for a scoped view hides CSI-only rules; only deltas render.
- A house-rule deep link pasted into a text message renders an informative URL and opens the rule for the recipient.

**Post-launch (job-tied signals, not vanity activations)**
- Within 4 weeks after launch, the instrumentation reports measurable **`house_rule_opened`** events (indicating the reader's layering is actually used to answer questions), and at least a small cohort who engage with **`differences_only_activated`** (indicating the cheat-sheet job works). If either is near zero, the default behavior or discoverability needs revisiting. Exact thresholds set at launch after a short sampling baseline.

## Scope Boundaries

- No **season-scoped** house rules in v1. Data model's `scope_type` constraint restricts to `'organization' | 'league'`.
- No automatic **merge / conflict resolution** engine (R28).
- No **AI-assisted authoring** (rule refinement to match CSI voice). Deferred.
- No **version history** or audit log of who changed what. Delete undo (R24) is the only safety net.
- No **draft / publish** workflow. Save = live.
- No **stale-house-rule detection** when CSI publishes a new edition with renumbered rules. Deferred with Branch 1's edition redirect-map work.
- No dedicated **Season Settings** page.
- No **multi-CSI linking** for a single house rule (R5).
- No **rich-text body** for house rules — plain text paragraphs only (matches Branch 1 `Rule.body`).
- No **export / print** of house rules.

### Deferred to Separate Tasks

- **Season-tier house rules:** add when a real need surfaces. `scope_type` check constraint can be extended and a nullable `season_id` column added without migrating existing rows.
- **Branch 3 — AI rules helper:** interprets described events against CSI + house rules. Retrieves from the same structured dataset Branch 2 assembles.
- **AI-assisted LO authoring:** refine drafted rule text to match CSI voice.
- **Stale-rule flagging:** connect to the edition redirect-map deferred in Branch 1.
- **Multi-CSI linking:** a `related_rule_ids[]` array if the one-to-one shape proves too rigid (R5).
- **Rich-text / markdown body** if plain text proves insufficient for real LO use.
- **Auto-selection of active league** based on recent match activity instead of only localStorage persistence.

## Key Decisions

- **Default scope = active league (single), not "My memberships" (union).** Mid-match disputes concern one specific league; fanning out across all memberships creates noise. "My memberships" remains a selectable option in the picker.
- **Differences-only mode ships in v1.** The cheat-sheet job (joining a new league) is explicit; an interleaved view alone doesn't deliver it. The toggle is a small add that makes the job literal.
- **`LeagueRules.tsx` is repurposed, not duplicated.** The existing stub and `/league-rules/:orgId` route become the org-wide authoring surface — avoids orphaning a "coming soon" stub and a new parallel page.
- **House rules are world-readable.** Matches Branch 1's public-access posture and keeps RLS simple. Write access is separately gated via `organization_staff`.
- **Three effect types kept.** Override vs. Enhance is a real semantic distinction (does CSI still apply?) that the Branch 3 helper will need. Standalone is clearly different from both.
- **Single `related_rule_id` per rule in v1.** Simpler data model; LOs split multi-link rules into records. Flagged as a future enhancement.
- **LO authoring lives inside existing settings pages** (OrganizationSettings already deep-links to `LeagueRules.tsx`; LeagueSettings gets a new section). Matches existing information architecture.
- **Search across two data sources.** CSI uses Branch 1's in-memory `searchRulebook`; house rules use a new `searchHouseRules` that queries Supabase. Merged in `SearchResults`. v1 eager-loads house rules on reader mount; per-keystroke DB fanout only if data size forces it.
- **Column naming: `scope_type` + `scope_id`.** More self-describing than `preferences.entity_type` / `entity_id`; doesn't conflict with the existing table. The new `house_rules` table parallels the `preferences` pattern structurally without reusing the same column names.
- **User-facing terminology: "CSI" / "Official".** Matches Branch 1's source data and the Branch 1 Attribution component. "BCA" is used internally in folder names (`officalBCARulebook`) but the UI consistently says "CSI" or "Official".
- **No-merge display, with specificity-based ordering.** More-specific (league) rules show before less-specific (org) rules within a matching set. Still labels everything and lets the player read.

## Dependencies / Assumptions

- **Branch 1 is the substrate.** Cleaned rulebook modules under `src/officalBCARulebook/cleaned/` and the `idMap` in `index.ts` are used for CSI rule lookup and linking validation. This branch stacks on `feature/official-rulebook-reader`.
- **Pre-existing surface:** `src/operator/LeagueRules.tsx` (110 lines) is wired to route `/league-rules/:orgId` and linked from `OrganizationSettings.tsx`. This branch expands that stub into the real manager (R20).
- **Membership is derived, not stored.** A user's player-membership in a league is computed via `team_players` → `teams.league_id`. Organization membership is the set of orgs whose leagues the user plays in. Operator-staff membership is read from `organization_staff.member_id`. "Active league" (R10) is per-device (localStorage), not a server-side concept — matches how `rackem:rules:lastGame` already works in Branch 1.
- **All organizations and leagues are publicly visible for v1** (matches current app state — no published/unlisted flag exists). The new `house_rules` SELECT RLS therefore grants SELECT to `anon` + `authenticated` with no scope predicate.
- **`organization_staff`** table exists and carries enough role information to tell "is this user staff of this org". The RLS predicate is a planning-time detail.
- **Branch 1 primitives are reusable for UI, not search.** `FilterChip`, `Sheet`, `PageHeader`, `SearchInput`, `RuleView`, `CopyLinkButton`, plus the shared `Rule` types — all reused. Branch 1's `useRulebookSearch` stays a CSI-only scanner; the merged search in R17 is new.
- **CSI edition is stable for v1's useful life.** Current edition: 2023-06-01. If CSI republishes with renumbering during the 4-week success-criteria window, `related_rule_id` back-references may silently break until the deferred stale-rule flagging lands.
- **`preferences` table** is a structural precedent only (tiered key/value prefs). The new `house_rules` table does not reuse its column names (see Key Decisions).
- **shadcn/ui primitives are sufficient.** No new shared primitives expected for this branch.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Exact SQL schema for the `house_rules` table (columns, constraints, composite unique indexes — e.g., should `(scope_type, scope_id, related_rule_id, title)` be unique?).
- [Affects R27][Technical] Exact RLS write-access predicate — which `organization_staff.position` values grant house-rule edit, and whether a league-level operator role exists that would also grant write to that league's rules.
- [Affects R17][Technical] House-rule search implementation — eager-load on `/rules` mount vs. per-keystroke Supabase queries. Decide based on expected corpus size during planning.
- [Affects R19][Technical] Deep-link URL shape and slug-generation strategy for house rules.
- [Affects R10][Technical] Scope picker implementation — shadcn `Sheet` reused from Branch 1 vs. a popover or dropdown menu. Design call at planning time.
- [Affects R13][Technical] Implementation of the one-time discoverability nudge (localStorage flag? member-profile flag?) — especially if we want it to survive a device change.
- [Affects R16][Technical] Exact result-ordering algorithm within each group (by rule ID? by author date? by closest-match score?).
- [Affects R29][Technical] Whether the new event types use the existing `rules_page_events` columns or require an additional `scope_type` / `scope_id` column on that table.

## Next Steps

-> `/ce:plan` for structured implementation planning of Branch 2 (League House Rules).
