---
title: "refactor: Replace TABLE_OF_CONTENTS.md with a model-screen table, a plan line and a folder map"
type: refactor
status: active
date: 2026-11-05
origin: docs/brainstorms/2026-11-04-tracking-docs-requirements.md
---

# refactor: Replace TABLE_OF_CONTENTS.md with a model-screen table, a plan line and a folder map

**Model screen:** none. This changes no UI.

## Status

Not started. This is Part A of the tracking-docs requirements; Part B (the
list) merged as #318. A three-reviewer pass on 2026-11-05 was folded in.

## Overview

Delete the 2,316-line `TABLE_OF_CONTENTS.md` and the drifting
`src/components/COMPONENTS_INDEX.md` (202 lines). Replace them with three
things Claude actually uses:

1. A short **model-screen table** in `CLAUDE.md`: "this kind of screen → start
   from this one".
2. A required **"Model screen:"** line in every new plan.
3. A **folder map** in `README.md` for new developers.

One test keeps all three true, and also keeps the deleted files from coming
back. That makes this more than a docs-only PR.

## Problem Frame

The TOC was meant to help Claude reuse pieces and keep the app looking like
one app. It doesn't:
- 850 of 2,262 tracked files are missing from it.
- It conflicted on almost every PR.
- Claude searches the code rather than reading it.

The room-race rework happened because nobody asked "which existing screen
does this look and act like?". The room-race plan did name a "sibling to
copy" (`src/rooms/games/coinflip/`), but that was a sibling in wiring, not in
look. So the fix has two parts:
- The question asked from the user's side.
- The answer written where Ed reviews it, at plan time. `CLAUDE.md` is loaded
  every session, so it carries the rule. (See origin, Part A and "The guiding
  test".)

## Requirements Trace

- R1 (A1). `CLAUDE.md` holds the rule: start a screen from the existing one it
  most looks and behaves like, from the user's side. The rule comes with a
  table of a handful of model screens.
- R2 (A2). Every new plan carries a **"Model screen:"** line in one of two
  forms:
  - It names an existing screen (at least one real `src/` path) and what it
    reuses.
  - Or it says "none" with a reason. "None" is not allowed when the plan
    changes screen files.
- R3 (A3). A test fails when a path in the model-screen table no longer
  exists.
- R4 (A4). `README.md` has a one-screen folder map.
- R5 (A5). `TABLE_OF_CONTENTS.md` is deleted, and every live instruction that
  names it is removed or repointed. That includes Claude's memory.
- R6 (A6). `COMPONENTS_INDEX.md` is deleted, not kept as a fourth list.
- Success criteria (origin):
  - Every UI plan written after Part A names its model screen.
  - **The next UI feature lands close to the app's look on the first pass.**
    The test proves only the first. The second is checked by Ed reading the
    line at plan review. That's why the line sits at the top of the plan.

## Scope Boundaries

- No per-folder READMEs. Ed decided against them on 2026-11-04.
- No generated file index replaces the TOC.
- Historic docs stay as written, TOC mentions included. That covers:
  - plans, brainstorms and audits
  - `archive/`, `docs/archive/`, `future/` (last edited 2025) and
    `memory-bank/`
  - the `MERGE_NOTES_*` files
- No source folders get reorganised here. That was done first, in `docs/plans/2026-11-05-002-refactor-src-folder-reorg-plan.md`.
- `LIST_FOR_ED.md` and `docs/list/` are not touched.

## Context & Research

### Relevant Code and Patterns

- **Test pattern to mirror:** `src/__tests__/unit/listForEd.test.ts` and
  `listForEd.helpers.ts`. They use pure helpers plus self-tests, then a last
  block that runs on the real files with `readdirSync`, `readFileSync` and
  `existsSync`. The vitest `unit` project picks up `src/**/*.test.ts`.
- **CLAUDE.md:** the "Table of Contents Maintenance" section (lines 51–64) is
  the one to replace. The existing "Planning" section only applies in Planner
  Mode, so the new plan rule must not live there.
- **README.md:** "Project structure" (about lines 123–162) is one fenced
  block.
  - The `src/` children are indented two spaces, alphabetical, with no
    groups. It lists 10 of the (then) 43 top-level `src/` folders.
  - Children of `supabase/`, `tests/` and `docs/` are indented the same way.
- **Live TOC instructions in the repo:**
  - `CLAUDE.md:52`
  - `README.md:161` and `:202`
  - `CHEATSHEET.md:118`
  - `MERGE_GUIDE.md:54` and `:66`

  Nothing in `src/`, `.github/`, `scripts/`, `package.json` or `.claude/`
  refers to it.
- **Live mentions in Claude's memory**, which loads every session:
  - `feedback_table_of_contents_always.md` and its `MEMORY.md` line
  - `feedback_seed_files_dev_only.md`: "label dev-only in the file header and
    in TABLE_OF_CONTENTS.md"
  - `feedback_overhaul_includes_cleanup.md`: links
    `[[feedback-table-of-contents-always]]`
  - `project_room_race.md`: notes on TOC conflicts
  - `MEMORY.md`'s Tracking docs line: "Next: plan Part A"
- **COMPONENTS_INDEX.md:** only the TOC, the requirements doc and two
  finished plans (coin-flip, game-room) refer to it.
- **Existing paths:** all 13 paths in the draft table exist. So do
  `src/components/forms/` and `src/components/PaymentMethodSetup.tsx`.
- **Plans past the cutoff:** only one plan in `docs/plans/` is dated
  2026-11-05 or later: this one, which has the line. Every top-level plan has
  a `YYYY-MM-DD-` prefix. The one subfolder is skipped by a non-recursive
  read.

### Institutional Learnings

- An instruction left behind that names a missing file makes Claude try to
  rebuild it (origin A5). So the removal has to reach memory too, and the
  test also checks the file stays gone.
- A hand-kept index drifts. The table survives only because it's tiny and
  checked.

## Key Technical Decisions

- **The rule asks "looks and behaves like, from the user's side".** That's
  not "which code to copy wiring from". The room-race plan named a wiring
  sibling and still got the look wrong.
- **The rule also covers UI work with no plan.** Many small UI asks never go
  through ce-plan. Before writing a new screen or a new section of one, Claude
  names its model screen in chat, so Ed can correct the pick early. No test
  can check this. The rule is the trigger.
- **"Model screen:" is required on every plan dated on or after 2026-11-05,
  not only UI plans.** This deliberately widens origin A2, because a test
  can't reliably tell whether a plan is a UI plan. Non-UI plans write "none"
  with a reason. Two checks keep "none" honest:
  - A plan that says "none" but lists a Create or Modify on a non-test
    `src/**/*.tsx` file fails, with "this plan changes screen files; name a
    model screen".
  - A non-"none" line must contain at least one backticked `src/` path that
    exists.

  Older plans are exempt.
- **The rule lives in its own section, `### Start from an existing screen`,**
  under "Claude Code Specific Features", not in Planner-Mode "Planning". The
  test finds the table under that exact heading.
- **COMPONENTS_INDEX.md is deleted.**
  - Its live rules already live where Claude reads them: InfoButton is in
    memory, NonProdGate is in Feature Gating, shadcn-first is in User
    Preferences.
  - Its "Component Patterns" become reuse entries in the table: the wizard
    row names `src/wizards/shared/`, and a draft payment row names
    `PaymentMethodSetup`.
  - The privacy pieces (`ContactInfoExposure`, `VisibilityChoiceCard`) serve
    one flow and get no row.
  - Making the index the replacement was rejected, because it's a component
    list and the question that failed was about screens.
- **The folder map goes in `README.md`** by extending "Project structure". A
  new developer opens the README first.
- **The test checks the map in both directions, at top level only.**
  - Every top-level `src/` folder is named, and every named one exists.
  - Top-level folders change rarely, so one line per new folder is cheap.
    That's unlike the TOC, which wanted a row per file.
  - Only names are checked, not descriptions. Descriptions are reviewed by
    eye.
  - Real folders are read from disk, keeping only folders that contain at
    least one file. An empty leftover folder doesn't fail one machine and pass
    CI.
  - The fixed map format: in the fenced block, start at the line beginning
    `src/`, then collect lines matching two spaces, a name and `/`. Stop at
    the first unindented line. No blank lines inside the `src/` list,
    alphabetical as now.
- **The test also fails if `TABLE_OF_CONTENTS.md` or
  `src/components/COMPONENTS_INDEX.md` exists again**, with a message that
  points at `CLAUDE.md`. Dozens of older plans still say "update the TOC", so
  "don't recreate it" needs to be a check, not just a sentence.
- **One `CLAUDE.md` sentence names the removed files**: they're gone, older
  plan steps asking for them are skipped, and they aren't recreated. It is the
  single allowed live mention.

## Open Questions

### Resolved During Planning

- Where the folder map lives, what happens to COMPONENTS_INDEX, and where
  "Model screen:" is enforced: see the decisions above.
- Whether `future/` is historic: yes, its files were last edited in 2025.

### Deferred to Implementation

- **The exact table rows.** Ed confirms or edits them in the PR before merge,
  since "which screen is this like?" is his call. Draft:

  | Kind of screen | Model screen | Reuse |
  |---|---|---|
  | Scoring games, incl. a race | `src/player/ScoreMatch.tsx` | `src/components/scoring/` (scoreboard, GameButtonRow) |
  | Picking a lineup | `src/player/MatchLineup.tsx` | `src/hooks/lineup/` |
  | A one-page form (not a wizard) | `src/profile/new-player/NewPlayerForm.tsx` | `src/components/forms/FormField.tsx` fields, `src/components/forms/DateField.tsx`, a form hook + a submit hook |
  | A multi-step setup flow | `src/wizards/league-v2/` | `src/wizards/shared/` (wizard shell, steps, state hook) |
  | An operator page of cards | `src/operator/LeagueDetail.tsx` | `src/operator/components/` cards |
  | Stats with filters | `src/stats/PlayerStats.tsx` | `src/stats/` |
  | Chat / messages | `src/messages/Messages.tsx` | `src/messages/` |
  | Settings and toggles | `src/operator/LeagueSettings.tsx` | its preference cards |
  | Taking a payment / card on file | `src/components/PaymentMethodSetup.tsx` | `src/components/PaymentCardForm.tsx` |
  | A pop-up or confirm | `src/components/modals/` | `src/components/shared/` (`Modal`, `ConfirmDialog`, `AlertDialog`), shadcn `Dialog` |

- **The one-line descriptions** for each of the 38 folders (after the 002 reorg), written while
  reading each folder.

## Implementation Units

- [ ] **Unit 1: Guard test**

**Goal:** One test that keeps the table, the plan line and the folder map
true, and the old indexes gone.

**Requirements:** R2, R3, R4, R5

**Dependencies:** None. Write it first, so it fails against current main.

**Files:**
- Create: `src/__tests__/unit/modelScreens.test.ts`
- Create: `src/__tests__/unit/modelScreens.helpers.ts`

**Approach:**
- Write pure helpers that:
  - read the table rows and paths under `### Start from an existing screen`
    in `CLAUDE.md`
  - read a plan's "Model screen:" line, its form (none or named) and its
    backticked `src/` paths
  - read a plan's `Create:` and `Modify:` file paths
  - read the README map's `src/` names, using the format in Key Technical
    Decisions
- Self-tests feed the helpers sample text. A last block runs them on the
  real `CLAUDE.md`, the top-level `docs/plans/*.md`, `README.md` and the
  `src/` folders on disk.
- Plan dates come from the filename prefix. The cutoff is 2026-11-05,
  inclusive.

**Execution note:** Test-first. See the real-file checks fail on main before
Units 2–4.

**Patterns to follow:** `src/__tests__/unit/listForEd.test.ts` and
`listForEd.helpers.ts`, including readable problem messages.

**Test scenarios:**
- **Table**
  - Happy path: two rows with existing paths → no problems, and both rows are
    returned. A file path and a folder path (trailing `/`) both count.
  - Error path: a row naming a missing path → a problem naming the path.
  - Error path: the heading is missing, or the table is empty → a problem.
  - Edge case: backticked text that isn't a `src/` path (e.g. `Dialog`) is
    ignored.
- **Plan line**
  - Happy path: a plan dated 2026-11-05 (the cutoff day) with a named line
    whose `src/` path exists → OK.
  - Happy path: a plan with "Model screen: none. Changes no UI." whose Files
    lists only `.ts` and test files → OK.
  - Error path: a plan dated 2026-11-06 with no line → a problem naming the
    file and saying how to fix it.
  - Error path: "none", but Files lists `Modify: src/rooms/RoomPage.tsx` → "this
    plan changes screen files; name a model screen".
  - Edge case: "none", and Files lists only `src/foo.test.tsx` → OK.
  - Error path: a named line with no `src/` path, or a path that doesn't exist
    → a problem.
  - Edge case: a plan dated 2026-11-04 with no line → ignored. A file with no
    date prefix → ignored.
- **Folder map**
  - Happy path: the map names exactly the real folders → OK.
  - Error path: a real folder is missing from the map → a problem naming it.
    A mapped folder that doesn't exist → a problem naming it.
  - Edge case: `supabase/` with `migrations/` right after the `src/` list is
    not read as a `src/` folder.
  - Edge case: an empty folder on disk isn't required. Files at the `src/`
    root (`App.tsx`) aren't required.
- **Old indexes**
  - Error path: `TABLE_OF_CONTENTS.md` exists → a problem pointing at
    `CLAUDE.md`. The same for `COMPONENTS_INDEX.md`.
- **Integration:** the real files pass, which fails until Units 2–4 land.

**Verification:**
- The self-tests pass.
- The real-file block fails on current main, then passes after Units 2–4.

- [ ] **Unit 2: CLAUDE.md, the screen rule, the table and the plan line**

**Goal:** Replace the TOC section with what Claude should do instead.

**Requirements:** R1, R2, R5

**Dependencies:** Unit 1, because the heading and format are fixed there.

**Files:**
- Modify: `CLAUDE.md`

**Approach:**
- Replace "Table of Contents Maintenance" with `### Start from an existing
  screen`, kept short. It holds:
  - The rule: ask which existing screen this most looks and behaves like from
    the user's side, not which code to copy wiring from. Mirror its layout and
    reuse its components.
  - The table, with the rows Ed confirms.
  - The plan line: every plan in `docs/plans/` carries "Model screen:" near
    the top. It either names the screen with a real `src/` path and what it
    reuses, or says "none" with a reason. Name the test.
  - UI work with no plan: name the model screen in chat before writing a new
    screen or a new section of one.
  - Moving a model screen means updating its row.
  - The one sentence naming the removed files (see Key Technical Decisions).
- Link the look details already in Claude's memory ("Same look on every
  page") rather than repeating them.

**Patterns to follow:** the Part B "The list" section in `CLAUDE.md`: short
rules, with the test named.

**Test expectation:** none for this unit by itself. Unit 1's real-file
checks cover it.

**Verification:**
- The table and plan-line checks pass.
- The only `TABLE_OF_CONTENTS` mention left in `CLAUDE.md` is the one
  "removed" sentence.

- [ ] **Unit 3: README folder map and the other repo pointers**

**Goal:** A new developer sees what every top-level `src/` folder holds, and
no live repo doc names the TOC.

**Requirements:** R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `README.md`, `CHEATSHEET.md`, `MERGE_GUIDE.md`

**Approach:**
- README "Project structure" covers all 38 top-level `src/` folders: one
  short line each, alphabetical, no blank lines.
  - That includes `__tests__`, `test`, `assets`, `dev` and
    `officalBCARulebook` (spelled as on disk).
  - Folders outside `src/` keep their current entries.
- Replace the TOC lines:
  - Root files list `CLAUDE.md`, `LIST_FOR_ED.md` and `docs/list/`.
  - The Documentation section points at the map and `CLAUDE.md`.
- `CHEATSHEET.md:118`: drop the TOC step.
- `MERGE_GUIDE.md`: drop the TOC conflict rows (54, 66).

**Test expectation:** none for this unit by itself. Unit 1's folder-map
check covers it.

**Verification:**
- The folder-map check passes.
- `git grep TABLE_OF_CONTENTS`, outside the historic folders in Scope
  Boundaries, finds only the one `CLAUDE.md` sentence and this plan.

- [ ] **Unit 4: Delete the old indexes; clean Claude's memory**

**Goal:** The old indexes are gone, and nothing anywhere tells Claude to
rebuild them.

**Requirements:** R5, R6

**Dependencies:** Units 2–3

**Files:**
- Delete: `TABLE_OF_CONTENTS.md`, `src/components/COMPONENTS_INDEX.md`
- Outside the repo, in Claude's memory:
  - Delete `feedback_table_of_contents_always.md` and its `MEMORY.md` line.
  - `feedback_seed_files_dev_only.md`: the "dev-only" label goes in the file
    header only.
  - `feedback_overhaul_includes_cleanup.md`: drop the TOC clause and its dead
    link.
  - `project_room_race.md`: drop the TOC conflict note.
  - `project_tracking_docs.md` and its `MEMORY.md` line: Part A done.

**Approach:**
- Same PR as Units 1–3, with `[no-changelog]` in the description, since users
  see nothing.
- Tick this plan's units. Also tick Unit 5 of
  `docs/plans/2026-11-04-001-refactor-list-for-ed-bucket-plan.md`, which was
  left unticked on purpose.

**Test expectation:** none for this unit by itself. Unit 1's old-index check
covers it.

**Verification:**
- Build, lint and the unit suite pass.
- A search of the memory folder for `TABLE_OF_CONTENTS` or
  `COMPONENTS_INDEX` comes back empty.

## System-Wide Impact

- **Interaction graph:** Claude's own workflow is the main consumer.
  `CLAUDE.md` is loaded every session. ce-plan output gains the line through
  the rule, not through plugin edits.
- **People:**
  - Jack has fewer merge conflicts.
  - New developers read the README map.
  - Ed confirms the table rows and reads the line at plan review.
- **Unchanged invariants:**
  - No app code or UI changes.
  - Historic docs keep their TOC mentions.
  - The `listForEd` guard is untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Claude recreates the TOC because an older plan says to update it | The `CLAUDE.md` sentence, the cleaned memory, and the test that fails if the file exists again |
| "None" becomes a rubber stamp | "None" fails when the plan changes screen files. Ed reads the line at plan review |
| A named screen is the wrong sibling (wiring, not look) | The rule asks from the user's side. Ed reviews the pick. The test can't judge it, and the plan says so |
| The table grows into a new index | "A handful of rows", each a checked path, curated by Ed |
| A new top-level `src/` folder fails CI until the README line is added | It's one line, and the failure message names the folder. That's rare compared with the TOC's per-file rows |
| New branches still edit `TABLE_OF_CONTENTS.md` | None are open (all merged 2026-11-05). A later branch takes the delete when it merges main |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-11-04-tracking-docs-requirements.md](../brainstorms/2026-11-04-tracking-docs-requirements.md) (Part A)
- **Part B plan:** `docs/plans/2026-11-04-001-refactor-list-for-ed-bucket-plan.md` (#318)
- **Test pattern:** `src/__tests__/unit/listForEd.test.ts`
- **Room-race "sibling" example:** `docs/plans/2026-11-03-001-feat-room-race-plan.md`
- **Rule origin:** Claude memory "Same look on every page"
