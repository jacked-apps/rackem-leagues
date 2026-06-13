---
title: "refactor: Split Manage Teams into shared content + edit page + setup-step page"
type: refactor
status: active
date: 2026-06-12
origin: docs/brainstorms/2026-06-12-wizard-aware-page-standard-requirements.md
---

# refactor: Split Manage Teams into shared content + edit page + setup-step page

## Overview

Make **Manage Teams** behave correctly in its two contexts by separating the
**editing content** from the **navigation chrome** — the first adopter of the
"content + per-context wrapper" standard from the origin brainstorm. Today
`src/operator/TeamManagement.tsx` (~860 lines) is one page that serves both a
quick **standalone edit** (from the league dashboard) and a **step in the
season-setup chain**, and its fixed footer always shows the setup chain's
"Save & Continue → Playoff Setup." So a quick edit drags the operator toward
playoffs. We **decompose the editing UI into small, reusable, single-responsibility
components** (Venues panel, Teams panel, Setup-summary card, …) composed by a thin
container, and wrap that container in **two thin route-pages**: an **edit page**
("Done → league," no playoffs knowledge) and a **setup-step page**
("Continue → playoffs," used only by the season-setup chain). The decomposition is
deliberate (Ed's app-wide standard: small composable components) and also advances
the "TeamManagement is too big" cleanup (LIST_FOR_ED #5).

## Problem Frame

The origin brainstorm framed this as "a page used both standalone and as a wizard
step." Investigation refined that (see Key Technical Decisions → *Reality
correction*):
- The **create-league wizard** (a real `WizardFlowShell` flow) already uses its
  own in-shell teams steps (`src/wizards/teams-v2/`) — it does **not** touch
  `TeamManagement`. Nothing to change there.
- The **season-setup** is **not** a shell wizard — it's a **hand-rolled page
  chain** stitched by `navigate()`: `SeasonCreationWizard` →
  `/league/:id/manage-teams?seasonId=` → (Save & Continue) →
  `/league/:id/season/:seasonId/playoffs-setup` (`PlayoffsSetupWizard`) →
  `/.../schedule-setup` (`ScheduleSetupPage`). `TeamManagement` is a standalone
  **page** in that chain.
- "Save & Continue" is **navigation only** — team edits already persist via the
  team/venue modals as you go. (see origin: the doc's "what does Save & Continue
  do" open question — answered: pure navigation.)

So the coupling to remove is "an edit page hardcodes the setup chain's next hop."
The clean fix is two route-pages over one shared content component.

## Requirements Trace

- **R1.** Establish the **content + per-context wrapper** standard with Teams as
  the first adopter (origin R1).
- **R2.** Remove setup-flow navigation knowledge from the editing content — it
  must not know "next is playoffs" (origin R2).
- **R3.** From the league dashboard, Manage Teams is a clean edit page: edit →
  **Done → back to the league**, no playoff push (origin R3).
- **R4.** League/season **creation still flows** Season → Teams → Playoffs →
  Schedule, with the **setup chain** owning "Continue" (origin R4). Do not break
  creation.
- **R5.** Teams first; Matchups is a deliberate follow-up that copies this shape
  (origin R5 / Deferred).
- **R6.** Consistency: the shape is reusable and documented so the next surface
  copies it (origin R6).

## Scope Boundaries

- **Not** touching the **create-league wizard** or its `teams-v2` in-shell steps
  — they already follow the in-shell step contract correctly.
- **Not** converting the hand-rolled season-setup chain into a `WizardFlowShell`
  flow (that's the bigger unification — see Deferred).
- **Not** redesigning the Teams editing UI (same venues/teams/captains controls;
  only the chrome/footer split changes).
- **Not** finishing the full `TeamManagement` god-component split (#5) — this
  advances it but isn't scoped to complete it.

### Deferred to Separate Tasks

- **Matchups**: same content + two-wrapper shape + a new standalone matchups
  route (so editing matchups stops re-opening the create-league wizard) —
  **separate plan**, after Teams proves the pattern.
- **Unify season-setup onto `WizardFlowShell`** so it's one mechanism with
  create-league (today: create-league = shell flow; season-setup = page chain) —
  **future**, larger refactor. This plan leaves the chain a chain.

## Context & Research

### Relevant Code and Patterns

- `src/operator/TeamManagement.tsx` — the page to split. Footer bottom bar (~L532-561)
  has "Save & Exit → /league/:id" + "Save & Continue → /league/:id/season/:seasonId/playoffs-setup".
  Data via `useTeamManagement(null, leagueId)`; chrome via `PageHeader` ("Back to League").
- `src/components/operator/TeamsCard.tsx` (L86,129) + `src/operator/LeagueDetail.tsx`
  (L425 conditional, L522) — **edit** entries (league dash) → keep on `/manage-teams`.
- `src/operator/SeasonCreationWizard.tsx` (L501) — **setup** entry → reroute to the
  new setup-teams route.
- `src/operator/PlayoffsSetupWizard.tsx` (L278,303,445 "Back to Teams") — **setup**
  back-links → reroute to the new setup-teams route.
- `src/operator/ScheduleSetupPage.tsx` (L84,119,136 back-to-teams) — **setup** back
  links → reroute to the new setup-teams route. (Confirm during build these are all
  setup-context, not an edit shortcut.)
- `src/navigation/NavRoutes.tsx` (L284 `league/:leagueId/manage-teams`) — add the new
  setup-teams route here.
- **Reference for "content rendered by a thin nav wrapper":** the schedule step
  pair — `src/wizards/schedule-v2/ScheduleWizardStep.tsx` wraps
  `src/components/season/ScheduleReview.tsx` (the content) and supplies its own
  Save & Exit / Save & Continue. Same content-vs-chrome split we're doing, just for
  a shell step rather than two routes.

### Institutional Learnings

- `docs/solutions/` has no entries on this; project memory: strong KISS; "rigor over
  kinda-fits" (this is the rigorous version of the flag Ed rejected); notes files ride
  with working commits; TABLE_OF_CONTENTS.md must be updated for new files.

### External References

- None — entirely in-repo React + react-router patterns.

## Key Technical Decisions

- **Reality correction (the load-bearing one):** the season-setup is a *page chain*,
  not a `WizardFlowShell` wizard, and `TeamManagement` is never inside a shell. So
  the fix is **two route-pages over one content component**, not "embed the page as a
  shell step." The brainstorm's principle (extract content; each context owns its
  exit) holds exactly — only the wrapper form (a route-page, not a shell step) differs.
- **Two routes, not one route + a context flag.** A flag (`?setup=1`) read inside the
  page leaves the playoffs-coupling living in the edit page and re-introduces the
  caller-discipline fragility Ed rejected as a paper-over. Two thin route-pages give
  each context exactly one job; the edit page genuinely knows nothing about playoffs.
  This is literally Ed's "two pages, same components."
- **The editing area is decomposed into small reusable components**, not one chunk
  (Ed's app-wide standard: small, single-responsibility, composable pieces; target
  ~100 lines). Natural pieces: a **Venues panel**, a **Teams panel/list**, a
  **Setup-summary card** (+ the already-separate `TeamEditorModal` /
  `VenueCreationModal`). A thin container `TeamManagementContent` takes `leagueId`,
  runs `useTeamManagement`, composes those pieces, and owns loading/error states —
  but **renders no footer/exit chrome**. Both wrappers (edit page, setup-step page)
  render the container + `PageHeader` + their own footer. Saving is unchanged (modals
  persist as you edit), so the content exposes no imperative "save" — the wrappers'
  footers are pure navigation. This split also advances LIST_FOR_ED #5.
- **New setup-teams route mirrors the existing setup chain** (`playoffs-setup`,
  `schedule-setup` are `/league/:leagueId/season/:seasonId/...`). Use the same shape,
  e.g. `/league/:leagueId/season/:seasonId/setup-teams`.
- **Sequencing protects creation:** build + route the setup-teams page and repoint the
  chain to it *before* stripping the playoffs button off `/manage-teams`, so the chain
  is never broken mid-refactor.

## High-Level Technical Design

> *Illustrates the intended approach; directional guidance for review, not
> implementation specification.*

```
                         ┌─────────────────────────────┐
                         │   TeamManagementContent     │  ← extracted, shared, DRY
                         │  (venues + teams + modals;  │     no footer / no exit
                         │   useTeamManagement(leagueId)│
                         └─────────────────────────────┘
                            ▲                        ▲
          renders content   │                        │   renders SAME content
                            │                        │
   /league/:id/manage-teams │                        │  /league/:id/season/:sid/setup-teams
   ┌────────────────────────┴───┐        ┌───────────┴──────────────────────┐
   │ TeamManagement (EDIT page) │        │ SetupTeamsPage (setup-chain step) │
   │ footer: [ Done → /league ] │        │ footer: [ Back ] [ Continue →     │
   │ knows NOTHING of playoffs  │        │           playoffs-setup ]        │
   └────────────────────────────┘        └───────────────────────────────────┘
        ▲ league dash (TeamsCard,                ▲ season-setup chain
          LeagueDetail edit links)                 (SeasonCreationWizard,
                                                    PlayoffsSetupWizard back,
                                                    ScheduleSetupPage back)
```

## Implementation Units

- [x] **Unit 1: Decompose the Teams editing area into reusable components (behavior-preserving)**

**Goal:** Break the editing UI out of the 860-line `TeamManagement` into small,
single-responsibility, reusable components composed by a thin container — no
footer/exit chrome — leaving on-screen behavior identical.

**Requirements:** R1, R2 (enables them); advances LIST_FOR_ED #5

**Dependencies:** None

**Files:**
- Create: `src/operator/team-management/` reusable pieces, e.g. `VenuesPanel.tsx`,
  `TeamsPanel.tsx`, `SetupSummaryCard.tsx` (final split decided during build — see
  Approach). Co-locate a `.test.tsx` per meaningful piece.
- Create: `src/operator/TeamManagementContent.tsx` (thin container that composes the
  pieces, runs `useTeamManagement(null, leagueId)`, owns loading/error states).
- Modify: `src/operator/TeamManagement.tsx` (render the container; keep its current
  footer for now).
- Test: `src/operator/TeamManagementContent.test.tsx` + per-piece tests.

**Approach:**
- Split the editing area into meaningful single-job pieces (aim ~100 lines each, don't
  over-atomize): the **Venues** section, the **Teams** list/section, the
  **Setup-summary** card. Reuse the already-separate modals (`TeamEditorModal`,
  `VenueCreationModal`) as-is. Each piece takes the data + handlers it needs as props.
- `TeamManagementContent` composes the pieces, owns the data hook + loading/error, and
  renders **everything except** `PageHeader` and the fixed bottom bar.
- For this unit, `TeamManagement` keeps its existing `PageHeader` + bottom bar (both
  buttons) and renders `<TeamManagementContent leagueId={leagueId} />` — so the page
  looks and behaves exactly as before. (The footer split happens in later units.)
- Decide the small content↔wrapper interface: most likely the wrappers need nothing
  from the content (saving is self-contained); confirm whether a footer's enable-state
  needs a "has teams + seasonId" signal — if so, expose it via a tiny callback/return,
  not by lifting all state up.

**Execution note:** Characterization-first — this is a large legacy component; capture
current behavior before moving it, then move in small pieces, so the decomposition is
provably behavior-preserving.

**Patterns to follow:** Ed's app-wide small-composable-component standard (project
CLAUDE.md); the content/chrome split in
`src/wizards/schedule-v2/ScheduleWizardStep.tsx` ↔ `src/components/season/ScheduleReview.tsx`.

**Test scenarios:**
- Happy path: each extracted piece renders from props in isolation (VenuesPanel shows
  venues + toggle; TeamsPanel shows team rows + add/edit affordances; SetupSummaryCard
  shows the counts).
- Happy path: `TeamManagementContent` composes the pieces for a league with teams
  (mock `useTeamManagement`).
- Edge: loading state renders the loading UI; error/no-league renders the error UI;
  zero-teams renders the empty/setup-summary state (no crash).
- Integration: opening the team/venue editor from `TeamsPanel`/`VenuesPanel` still
  drives the existing modals (the move didn't sever handlers).

**Verification:** `/manage-teams` looks and works exactly as before; the editing area is
now composed of reusable pieces; tsc + lint + build clean.

---

- [x] **Unit 2: New setup-teams page + route**

**Goal:** Add the season-setup chain's dedicated teams step: the shared content +
"Back" + "Continue → playoffs."

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Create: `src/operator/SetupTeamsPage.tsx`
- Modify: `src/navigation/NavRoutes.tsx` (add `league/:leagueId/season/:seasonId/setup-teams`)
- Test: `src/operator/SetupTeamsPage.test.tsx`

**Approach:**
- `SetupTeamsPage` reads `leagueId` + `seasonId` from params, renders `PageHeader` +
  `<TeamManagementContent leagueId={leagueId} />` + a footer with **Back** and
  **Continue →** that `navigate`s to `/league/:leagueId/season/:seasonId/playoffs-setup`.
  This is the *only* place that knows playoffs come after teams.
- Mirror the existing setup-page chrome (`PlayoffsSetupWizard` / `ScheduleSetupPage`)
  for header + footer styling so the chain feels consistent.
- Route added under the same operator-guarded block as `manage-teams`.

**Patterns to follow:** `src/operator/PlayoffsSetupWizard.tsx` / `ScheduleSetupPage.tsx`
for setup-chain page chrome + footer navigation.

**Test scenarios:**
- Happy path: renders the team content; "Continue →" navigates to the playoffs-setup
  route for the given league/season.
- Happy path: "Back" navigates to the expected prior step (the season step / league
  page — confirm target during build).
- Edge: renders correctly with a valid `seasonId` param; missing/invalid params degrade
  gracefully (no crash).

**Verification:** visiting the setup-teams route shows teams + a Continue that lands on
playoffs; tsc + lint + build clean.

---

- [x] **Unit 3: Repoint the season-setup chain at the setup-teams route**

**Goal:** Make the creation/setup chain use the new setup-teams page instead of
`/manage-teams`, so creation keeps flowing once the edit page loses its playoffs button.

**Requirements:** R4

**Dependencies:** Unit 2

**Files:**
- Modify: `src/operator/SeasonCreationWizard.tsx` (L501 → setup-teams)
- Modify: `src/operator/PlayoffsSetupWizard.tsx` (L278,303,445 "Back to Teams" → setup-teams)
- Modify: `src/operator/ScheduleSetupPage.tsx` (L84,119,136 back-to-teams → setup-teams)
- Test: extend `src/operator/SetupTeamsPage.test.tsx` (or add a small nav test) — and
  characterization of the creation chain if feasible.

**Approach:**
- Replace each **setup-context** navigation to `/league/:id/manage-teams?seasonId=`
  with the new `/league/:id/season/:seasonId/setup-teams`.
- **Leave the EDIT entries untouched**: `TeamsCard.tsx` (L86,129) and
  `LeagueDetail.tsx` (L425,522) keep pointing at `/manage-teams`.
- Verify each `ScheduleSetupPage` back-link is genuinely setup-context before repointing
  (the investigation flagged its `?seasonId=` is sometimes dropped — confirm intent).

**Patterns to follow:** the existing `navigate(...)` calls being replaced (same call
sites, new target).

**Test scenarios:**
- Integration (creation chain): from `SeasonCreationWizard` completion, the operator
  lands on setup-teams (not `/manage-teams`); "Continue →" reaches playoffs.
- Integration: `PlayoffsSetupWizard` "Back to Teams" returns to setup-teams (content
  intact for the season).
- Edge: the league-dash edit entries still land on `/manage-teams` (regression guard
  that we didn't repoint an edit path).

**Verification:** full create-league/season → teams → playoffs → schedule still flows
end-to-end with no `/manage-teams` hop in the setup chain.

---

- [x] **Unit 4: Make `/manage-teams` a clean edit page (drop the playoffs button)**

**Goal:** The standalone edit page exits only to the league — no "Continue → playoffs."

**Requirements:** R2, R3

**Dependencies:** Unit 3 (so the setup chain no longer relies on this button)

**Files:**
- Modify: `src/operator/TeamManagement.tsx`
- Test: `src/operator/TeamManagement.test.tsx`

**Approach:**
- Remove the "Save & Continue → playoffs-setup" button. The footer becomes a single
  **Done → `/league/:leagueId`** action (data already persists via modals, so "Done" is
  navigation; keep the wording plain — "Done" or "Back to League").
- Consider whether the bottom bar is still needed at all given `PageHeader` already has
  "Back to League" — proposed: keep one clear thumb-zone "Done" for mobile; this is a
  minor UI call (see Open Questions). The page now imports/knows nothing about
  playoffs-setup.

**Test scenarios:**
- Happy path: `/manage-teams` renders the team content + a single Done/Back-to-league
  exit; **no** "Continue"/"Playoff" control is present.
- Edge: with zero teams (setup-summary state) the page still renders without a
  playoffs button.
- Regression: clicking Done navigates to `/league/:leagueId`.

**Verification:** from the league dash, Manage Teams edits + returns to the league with
no playoff push; grep confirms no `playoffs-setup` reference remains in
`TeamManagement.tsx`; tsc + lint + build clean.

---

- [x] **Unit 5: Document the "content + two wrappers" standard + TOC**

**Goal:** Capture the reusable shape so Matchups (next) and future shared surfaces copy
it without re-deriving.

**Requirements:** R1, R6

**Dependencies:** Units 1-4

**Files:**
- Create: a short standard note (e.g. `docs/conventions/standalone-vs-flow-pages.md`)
  OR a concise section appended to the origin brainstorm — pick the lighter option.
- Modify: `TABLE_OF_CONTENTS.md` (new files: `TeamManagementContent.tsx`,
  `SetupTeamsPage.tsx`, the convention note).

**Approach:**
- One short page: "A surface used both standalone and inside a flow = one **content**
  component (no nav) + a **standalone edit page** wrapper + a **flow-step** wrapper
  (a shell step for `WizardFlowShell` flows; a chain route-page for hand-rolled chains
  like season-setup). The content owns saving; each wrapper owns its exit." Reference
  Teams as the worked example.

**Test scenarios:** Test expectation: none — documentation + index only.

**Verification:** the note exists and names the Teams files as the example; TOC updated.

## System-Wide Impact

- **Interaction graph:** touches the **season-setup page chain** (SeasonCreationWizard,
  PlayoffsSetupWizard, ScheduleSetupPage) + the standalone edit entries (TeamsCard,
  LeagueDetail). Does **not** touch the create-league `WizardFlowShell` flow or its
  `teams-v2` steps.
- **State lifecycle risks:** none new — saving is unchanged (modals persist as you
  edit); the buttons being moved are navigation-only.
- **API surface parity:** Matchups will mirror this shape later (deferred), incl. its
  own standalone route.
- **Integration coverage:** the load-bearing scenario unit tests won't fully prove is
  the **end-to-end creation chain** (season → teams → playoffs → schedule) — call it out
  for a manual pass on staging in addition to the nav tests.
- **Unchanged invariants:** the Teams editing UI/behavior, team/venue saving, the
  create-league wizard, and the playoffs/schedule setup pages are all unchanged; only
  *which page the teams step is* and *where the edit page exits* change.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Breaking league/season **creation** by repointing the chain | Build + route + repoint the setup-teams page (Units 2-3) BEFORE stripping the playoffs button (Unit 4); end-to-end creation test + manual staging pass |
| Mis-classifying a `/manage-teams` entry (edit vs setup) and repointing the wrong one | Explicit per-entry classification in Unit 3; regression test that edit entries still hit `/manage-teams`; the `?seasonId=` param is a hint, NOT the signal — classify by call site |
| Extraction subtly changes Teams behavior (860-line move) | Characterization-first in Unit 1; behavior-preserving intermediate (page renders content + old footer) before any nav change |
| `ScheduleSetupPage` back-link intent unclear (setup vs edit) | Verify in Unit 3 before repointing; if ambiguous, leave it and note it |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for the new files (Unit 5).
- No migrations, no env, no rollout concerns — pure client refactor.

## Open Questions

### Resolved During Planning

- *Is the season-setup a shell wizard or a page chain?* — **Page chain** (hand-rolled,
  `navigate()`-stitched). So the fix is two route-pages, not a shell step.
- *Does "Save & Continue" save?* — **No**, navigation only (modals persist as you edit).
- *Does the create-league wizard use TeamManagement?* — **No**, it uses in-shell
  `teams-v2` steps; out of scope.
- *One route + flag vs two routes?* — **Two routes** (clean separation; the flag was the
  rejected paper-over).

### Deferred to Implementation

- **Exact content↔wrapper interface** (does the footer need a "has teams + seasonId"
  enable signal from the content, or is it self-contained?) — settle when extracting.
- **Edit-page footer shape** — single "Done → league" bottom bar vs rely on the
  `PageHeader` "Back to League" only. Minor UI; confirm with Ed during build.
- **`SetupTeamsPage` "Back" target** + whether `ScheduleSetupPage`'s back-links are all
  setup-context — verify against the live chain.
- **New route path string** — proposed `/league/:leagueId/season/:seasonId/setup-teams`;
  finalize for consistency with the existing setup routes.

## Sources & References

- **Origin document:** docs/brainstorms/2026-06-12-wizard-aware-page-standard-requirements.md
- Related code: `src/operator/TeamManagement.tsx`, `src/operator/SeasonCreationWizard.tsx`,
  `src/operator/PlayoffsSetupWizard.tsx`, `src/operator/ScheduleSetupPage.tsx`,
  `src/components/operator/TeamsCard.tsx`, `src/operator/LeagueDetail.tsx`,
  `src/navigation/NavRoutes.tsx`; reference `src/wizards/schedule-v2/ScheduleWizardStep.tsx`.
- Related: LIST_FOR_ED #36 (split matchups editing — the deferred follow-up), #5
  (TeamManagement is too big — this advances it).
