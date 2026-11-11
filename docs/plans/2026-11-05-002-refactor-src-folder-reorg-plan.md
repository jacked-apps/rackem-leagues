---
title: "refactor: Reorganise src/ folders (moves and renames only)"
type: refactor
status: completed
date: 2026-11-05
---

# refactor: Reorganise src/ folders (moves and renames only)

**Model screen:** none. This moves files; no screen changes how it looks or
behaves.

## Status

Units 0–8 done 2026-11-05. Before the moves, 53 files nothing used were
deleted (5, then 48). The app had 43 top-level `src/` folders and now has 38.
Every commit passed the build, lint (0 errors) and all 388 test files
(6,125 tests). Tests ran with 2 workers to fit in memory. Next: Ed reviews,
then a PR with `[no-changelog]`, then the TOC plan build.

## Overview

Move files in `src/` so each thing has one obvious home, without changing
what any code does. One PR. Ed approves the full old-to-new map before any
file moves. Then one commit per area, with the build, lint and every test
green after each.

## Problem Frame

`src/` grew one feature at a time (Ed and Claude, 2026-11-05):

- **Screens live in three kinds of place with no rule:** `pages/`, role
  folders (`player/`, `operator/`) and feature folders (`rooms/`,
  `brackets/`). Stats alone is split across `stats/`, `pages/`,
  `player/PlayerStats.tsx` and `components/stats/`.
- **One idea, several homes:**
  - Wizard parts are spread across `wizards/`, `components/wizard/`,
    `components/forms/` and `operator/*Wizard`.
  - The operator side has `operator/`, `operator/components/`,
    `components/operator/` and `leagueOperator/`.
  - Profile forms are split across `profile/`, `newPlayer/` and
    `completeProfile/`.
- **`components/` is a junk drawer:** 379 files, about 40 of them loose at
  the top, and many used by only one feature.
- **Small stuff:** a misspelt folder (`officalBCARulebook`), single-file
  folders (`home/`, `host/`, `assets/`), and a few files nothing imports.

**Why now:** no PRs are open. Most unmerged branches turn out to be
squash-merged already; Unit 0 sorts out the rest.

## Requirements Trace

- R1. Every file in `src/` has one obvious home, by the placement guide.
- R2. No behaviour changes. Every test passes after each commit, with the
  same test count as before.
- R3. Each area lands as its own commit, so a break points at one move.
- R4. Living docs, configs and scripts that name moved paths are updated in
  the same commit as the move. Historic docs (`docs/archive/`, dated plans
  and brainstorms) are not.
- R5. CLAUDE.md gains a short placement guide. It is a guide, not a strict
  rule (Ed: Jack likes a flat-ish layout; the repo is large; use judgment).
- R6. The TOC plan's paths, folder count and its "no source folders get
  reorganised" line are corrected deliberately.
- R7. Unfinished branches can be carried across the move with the same
  script and map.

## Scope Boundaries

- **No splitting big files** (112 files run over 300 lines). That changes
  code.
- **No merging duplicate components.** For example, `shared/Modal` vs
  shadcn `Dialog`.
- **No deleting live code.** Files with **zero importers** are listed in the
  map for Ed to decide (delete or keep). They are not deleted silently.
  - **Done 2026-11-05 (Ed: "delete the 5 files before we do this rework").**
    Deleted as the first commit on this branch:
    - `components/RegisterPlayerModal.tsx`
    - `components/SponsorLogos.tsx`
    - `components/player/TeamCard.tsx`
    - `leagueOperator/ChoiceStep.tsx`
    - `leagueOperator/QuestionStep.tsx`
  - **Still a candidate:** `assets/react.svg`, the unused Vite template
    image, handled in Unit 2.
- **No import-style sweep.** Imports change only where a target moved.
- **These folders stay where they are:** `src/__tests__/`, `src/test/`,
  `api/`, `hooks/`, `utils/`, `types/`, `schemas/`, `systems/`,
  `brackets/`, `rooms/`, `race/`, `whatsNew/`, `lib/` and `components/ui/`.
- **`TABLE_OF_CONTENTS.md` and `components/COMPONENTS_INDEX.md` are not
  updated.** The TOC plan deletes both right after this.

### Deferred to Separate Tasks

- **Splitting oversized files:** a later list item, done area by area.
- **Merging duplicate pop-up, step and `VisibilityChoiceCard` components:**
  a later list item.
- **Deciding whether old v1 wizards** (`SeasonCreationWizard`,
  `PlayoffsSetupWizard`) are still needed.

## Context & Research

### Relevant Code and Patterns

- **The `@/*` alias maps to `src/*`**, in `tsconfig.app.json`,
  `vite.config.ts` and `vitest.config.ts`. About 3,000 imports use the
  alias and about 1,600 use relative paths.
- **`components.json` (shadcn) pins** `@/lib/utils`, `@/components/ui` and
  `@/hooks`. These must not move.
- **Lazy routes are typechecked.** `src/navigation/NavRoutes.tsx` (34
  `lazy(...)`), `components/season/ScheduleReview.tsx` and
  `operator/SeasonScheduleManager.tsx` all use literal `import()`. `tsc -b`
  checks these. No template `import()` or `import.meta.glob` points at a
  moving path.
- **Tests are not typechecked.** `tsconfig.app.json` excludes
  `src/__tests__`, `src/test` and `*.test.*`, and no other tsconfig includes
  them. There is no `typecheck` script in `package.json`.
  - A stale static import in a test still fails when vitest loads it, so
    that case is caught.
  - Some stale paths fail silently instead:
    - `vi.mock` / `vi.doMock` / `vi.importActual` strings, because a mock
      of a missing path can quietly stop mocking. 14 of these point at
      moving paths today.
    - `import type`
    - `typeof import(...)`
- **The `components/shared` barrel is used by 17 import lines.** Some
  import `Modal` together with `LoadingState` and `EmptyState` in one
  statement.
- **Places that name paths outside imports:**
  - `scripts/clean-rulebook.ts`
  - `scripts/clean-rulebook/writeModules.ts` (`OUTPUT_DIR`)
  - `scripts/audit-scan.sh` (lines 19 and 47 exclude the cleaned rulebook)
  - `src/rules/useRulebook.ts` (comments)
  - `src/__tests__/unit/cleanup.smoke.test.ts`
  - `src/themes/noFixedColours.test.ts`, whose `ALLOWED_FILES` is keyed by
    path prefix, including `src/dev/`
  - CLAUDE.md, `src/__tests__/README.md`, `docs/list/*.md` and memory files
- **Checked and safe:**
  - vitest include/exclude, since only `src/__tests__/database/**` is
    path-specific and it doesn't move
  - the eslint override (`NavRoutes.tsx`, which doesn't move)
  - Playwright `tests/e2e`
  - the tests that read files by path (`sw.ts`, `utils/`, `themes/`,
    `whatsNew/`), since none of those move

### Unmerged branches (checked 2026-11-05)

`git cherry` shows unique commits on 24 branches. Most were squash-merged,
which `git cherry` can't see: #225, #226, #228, #276–#281. **The branches
that have unique work and no PR:**

- **Module workshop, June:** `feat/threshold-workshop` (65 commits),
  `docs/threshold-workshop-brainstorm`, `feat/threshold-math-modular`,
  `feat/handicap-entry-module`, `feat/sub-handling-modules` and
  `feat/scoreboard-module-brainstorm`. This work is paused for design
  reasons.
- `fix/promote-sub-to-real-player`: 7 commits, 2026-10-16.
- `feat/lms-schedule-import`: 3 commits, June.
- **Small chores and docs:**
  - `chore/lint-warnings-stale-disables`
  - `chore/cheap-cleanups`
  - `chore/toc-last-updated-date-only`
  - `chore/stamp-1-11-0`
  - `docs/bca-meeting-prep`
  - `feat/ui-modularity-audit`

## Placement Guide (goes into CLAUDE.md, Unit 8)

These are rules of thumb, not a strict rule. A judgment call that breaks one
for a clear reason is fine.

1. **Feature first.** If a feature has a folder (`rooms/`, `brackets/`,
   `messages/`, `stats/`, `wizards/`...), its screens, pieces and hooks go
   there. A feature folder beats a role folder.
2. **Role folders hold role-only screens that have no feature folder.**
   `player/` holds match-night screens and `operator/` holds league
   management.
3. **Feature-specific pieces live in the feature. Generic UI stays in
   `components/`**, even if only one feature uses it today. `App.tsx`,
   `navigation/` and `components/` itself don't count as features.
4. **Flat until it hurts.** Add a subfolder only when about 5 or more files
   clearly belong together, or when file names would clash.
5. **Standalone pages** that belong to no feature go in `pages/`.
6. **Layers stay put:** `api/`, `hooks/` (shared hooks), `utils/`,
   `types/`, `schemas/`, `components/ui/` (shadcn) and `lib/`.

## Key Technical Decisions

- **A committed move script, driven by a committed map.**
  - `scripts/reorg/move.ts` (run with tsx; no new dependency) moves each
    file and rewrite every reference, in both `@/` and relative form:
    - static imports, `export … from`, `import()` and `lazy()`
    - `import type` and `typeof import()`
    - the string arguments of `vi.mock`, `vi.doMock` and `vi.importActual`
  - `docs/audits/2026-11-05-src-reorg-map.md` lists every old → new path.
  - Both are committed, so a paused branch can be carried across later by
    re-running the script on it (R7).
- **Imports keep their style.** A rewritten import stays alias or relative
  as it was, so the diff shows only real path changes.
- **Rename-safe commits.** Each unit checks the diff for any file git sees
  as deleted plus added, instead of renamed. This happens to small files
  whose content is mostly import lines. Such a file gets a pure move commit
  first and its import fix after it, so `--follow` and blame keep working.
- **Path-keyed config changes ride with their move,** in the same commit,
  so every commit is green (R4).
- **The `components/shared` barrel stays.** Its `export … from` lines are
  repointed when a member moves, so callers don't change. This is the
  existing pattern, not a shim.
- **`shared/` and `modals/` mean different things.** `shared/` holds
  building blocks (`Modal`, `ConfirmDialog`, `LoadingState`, `EmptyState`,
  plus `AlertDialog` joining them). `modals/` holds specific pop-ups.
- **The wizard step kit is shared on purpose.** `components/wizard/` and the
  generic steps in `components/forms/` (`ChoiceStep`, `QuestionStep`,
  `DualDateStep`, `SimpleRadioChoice`, `WizardProgress`) are a reusable kit,
  so they go to `wizards/shared/` together, even where only one wizard uses
  a step today (guide rule 3). `components/forms/` then holds the generic
  form fields only: `DateField`, plus `FormField` from `newPlayer/`.
- **`pages/` stays, as the standalone-pages folder.** This is flatter than
  inventing feature folders for every info page, and fits Jack's
  preference.
- **`schemas/` stays.** `leagueOperatorSchema` is shared by
  `components/privacy/` and `components/previews/`. The two profile schemas
  have one importer each, but schemas are a layer.
- **`pages/HandicapLookupTest.tsx` stays.** Its route isn't `DevOnly`, and
  moving it into `dev/` would silently exempt it from the colour guard.
- **Old v1 wizards go to `wizards/season-v1/` and
  `wizards/playoffs-setup/`.** The name `season-v1` sits clearly next to
  `season-v2`.

## Target Layout

> *Directional. Unit 1 turns this into the full file-by-file map, by the
> placement guide and an import scan, for Ed to approve.*

| From | To |
|---|---|
| `officalBCARulebook/` | `bcaRulebook/` |
| `home/Home.tsx`, `host/BecomeHost.tsx` | `pages/` |
| `components/wizard/` + the step files in `components/forms/` | `wizards/shared/` |
| `newPlayer/FormField.tsx` | `components/forms/` (next to `DateField`) |
| `operator/SeasonCreationWizard.tsx`, `operator/wizardReducer.ts`, `data/seasonWizardSteps.tsx` | `wizards/season-v1/` |
| `operator/PlayoffsSetupWizard.tsx` | `wizards/playoffs-setup/` |
| `newPlayer/` | `profile/new-player/` |
| `completeProfile/` | `profile/complete/` |
| `leagueOperator/` (and `components/previews/`, if only it uses that) | `operator/application/` |
| Operator-specific files in `components/operator/` | `operator/components/` (no name clashes; checked) |
| `components/playoff/` | `operator/components/playoff/` |
| `pages/Messages.tsx`, `components/messages/`, `components/onboarding/` (only Messages uses it) | `messages/` |
| `components/stats/`, `components/StatsNavBar.tsx`, `player/PlayerStats.tsx`, `pages/TopShooters.tsx`, `pages/TeamStats.tsx`, `pages/FeatsOfExcellence.tsx` | `stats/` (screens in a `stats/pages/` subfolder if `stats/` passes about 25 files) |
| `components/match/` | `player/` (it is match-night only) |
| Feature-specific loose pop-ups and files in `components/` | the feature that owns them |
| `components/AlertDialog.tsx` | `components/shared/` (and into the barrel) |
| Generic loose files (`ErrorBoundary`, `ThemeToggle`, `InstallAppCard`, `PaymentMethodSetup`, `ProtectedRoute`, `NonProdGate`...) | stay in `components/` |

## Implementation Units

**Every unit after Unit 1 must pass this gate:**
- the build, lint and full `test:run` (unit and db) are green
- the test count matches the baseline
- the path checker (Unit 1) is clean
- the rename check is clean: no file shows as deleted plus added

- [x] **Unit 0: Branch triage**

**Goal:** No unfinished work gets stranded by the move without a decision.

**Requirements:** R7

**Dependencies:** None

**Files:** none (a short table goes in the PR description)

**Approach:**
- For each branch with unique work and no PR (listed above), Ed picks one
  of three outcomes:
  - **land first**, as a normal PR before this one
  - **port later**, by re-running the move script on it
  - **abandon**
- The likely picks:
  - the module-workshop branches: port later (paused)
  - `fix/promote-sub-to-real-player`: **sits, unused (Ed, 2026-11-05).** It was a one-time fix; the real need is
    `docs/list/2026-10-28-lo-fix-finished-lineup.md`. It only
    adds hand-run SQL under `database/maintenance/`, which this plan doesn't
    touch.
  - the small chores: abandon, or land
- Tell Jack before Unit 2 starts: no new branches until this merges.

**Test expectation:** none. This is a decision step.

**Verification:** Every branch on the list has an outcome.

- [x] **Unit 1: Tools, baseline and the map**

**Goal:** A safe way to move, a check for what the build can't see, and a
map Ed approves before anything moves.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 0

**Files:**
- Create: `scripts/reorg/move.ts`
- Create: `src/__tests__/unit/importPaths.test.ts`
- Create: `docs/audits/2026-11-05-src-reorg-map.md`
- Create: `scripts/reorg/paths.ts` (path logic shared with the checker), `src/__tests__/unit/reorgMove.test.ts`
- Merge in: the `refactor/toc-replacement` branch (2 doc commits), so Unit 8
  can edit that plan here.

**Approach:**
- **Record the baseline** on a clean tree: the build result, the lint result
  and the test count. A pre-existing failure gets fixed or recorded before
  any move.
- **The path checker** (`importPaths.test.ts`) resolves every relative and
  `@/` specifier in each file `tsconfig.app.json` excludes (tests and
  `src/test/**`). That covers static imports, `import type`,
  `typeof import()`, `import()` and `vi.*` strings. It resolves them the way
  the bundler does, with extensions and `index` files, and skips bare
  package names. It stays after the PR.
- **The move script** reads the map and moves the files of one unit at a
  time.
- **The map** applies the placement guide file by file, using an import
  scan, and lists the zero-importer files for Ed. Ed approves it before
  Unit 2. Jack is welcome to look too.

**Execution note:** Write the checker test-first, and prove it fails on a
planted bad path before relying on it.

**Test scenarios:**
- Happy path: on today's tree every specifier resolves, so the test passes.
- Error path: a planted `vi.mock('@/does/not/exist')` fails, naming the file
  and the specifier.
- Error path: a planted `import type { X } from '../nope'` in a test file
  fails.
- Edge case: a specifier with no extension that resolves to `index.ts` or
  `.tsx` passes.
- Edge case: a bare package name (`react`, `sonner`) is skipped.
- Integration: a dry run of the move script on one file updates that file's
  `@/` importers, its relative importers and a `vi.mock` string pointing at
  it.

**Verification:**
- The checker passes on the untouched tree and fails on planted bad paths.
- The script's dry run is correct.
- Ed has approved the map.

- [x] **Unit 2: Small fixes**

**Goal:** Fix the misspelt folder and fold the single-file page folders.
Delete only the zero-importer files Ed approved.

**Requirements:** R1, R4

**Dependencies:** Unit 1

**Files:**
- Move: `src/officalBCARulebook/` → `src/bcaRulebook/`
- Move: `src/home/Home.tsx`, `src/host/BecomeHost.tsx` → `src/pages/`
- Modify:
  - `scripts/clean-rulebook.ts`
  - `scripts/clean-rulebook/writeModules.ts`
  - `scripts/audit-scan.sh`
  - `src/rules/rulebook.types.ts`
  - `src/rules/useRulebook.ts` (comments)
  - `src/__tests__/unit/cleanup.smoke.test.ts`
- Delete: the zero-importer files Ed approved.

**Test expectation:** none beyond the gate. These are pure moves.

**Verification:**
- The gate is green.
- `audit:scan` still skips the cleaned rulebook.
- Nothing outside historic docs mentions `officalBCARulebook`.

- [x] **Unit 3: Wizards**

**Goal:** Every wizard part lives under `wizards/`, and `components/forms/`
holds only the generic fields.

**Requirements:** R1

**Dependencies:** Unit 2

**Files:**
- Move: `src/components/wizard/` and the step files in `src/components/forms/` → `src/wizards/shared/`
- Move: `src/newPlayer/FormField.tsx` → `src/components/forms/`
- Move: `src/operator/SeasonCreationWizard.tsx`, `src/operator/wizardReducer.ts`, `src/data/seasonWizardSteps.tsx` → `src/wizards/season-v1/`
- Move: `src/operator/PlayoffsSetupWizard.tsx` → `src/wizards/playoffs-setup/`

**Test expectation:** none beyond the gate.

**Verification:** The gate is green. The league, season and playoffs wizards
load in the browser.

- [x] **Unit 4: Profile forms**

**Goal:** One `profile/` home for editing a profile, a new player and
completing a profile.

**Requirements:** R1

**Dependencies:** Unit 3

**Files:**
- Move: `src/newPlayer/` → `src/profile/new-player/`
- Move: `src/completeProfile/` → `src/profile/complete/`

**Approach:** Each moved folder keeps its own `types.ts`, which is why these
are subfolders.

**Test expectation:** none beyond the gate.

**Verification:** The gate is green. The new-player, complete-profile and
profile pages render.

- [x] **Unit 5: Operator**

**Goal:** One operator tree.

**Requirements:** R1

**Dependencies:** Unit 4

**Files:**
- Move: `src/leagueOperator/` → `src/operator/application/`
- Move: `src/components/previews/` too, if only the application uses it.
- Move: the operator-specific files of `src/components/operator/` → `src/operator/components/`
- Move: `src/components/playoff/` → `src/operator/components/playoff/`

**Test expectation:** none beyond the gate.

**Verification:** The gate is green. The operator dashboard, league detail
and Become-an-LO pages render.

- [x] **Unit 6: Messages, stats and match pieces**

**Goal:** Messaging and stats each live in one feature folder. Match-night
pieces join `player/`.

**Requirements:** R1

**Dependencies:** Unit 5

**Files:**
- Move: `src/pages/Messages.tsx`, `src/components/messages/`,
  `src/components/onboarding/` → `src/messages/`
- Move: `src/components/stats/`, `src/components/StatsNavBar.tsx`,
  `src/player/PlayerStats.tsx`, `src/pages/TopShooters.tsx`,
  `src/pages/TeamStats.tsx`, `src/pages/FeatsOfExcellence.tsx` →
  `src/stats/`
- Move: `src/components/match/` → `src/player/`

**Test expectation:** none beyond the gate.

**Verification:** The gate is green. Messages, My Stats, Top Shooters and My
Match render.

- [x] **Unit 7: Loose components**

**Goal:** `components/` holds generic and shared things only.

**Requirements:** R1

**Dependencies:** Unit 6

**Files:**
- Move: feature-specific loose files and pop-ups in `src/components/` → the
  feature that owns them, as the approved map says
- Move: `src/components/AlertDialog.tsx` → `src/components/shared/`
- Modify: `src/components/shared/index.ts` (add `AlertDialog`; repoint any
  moved member)

**Test expectation:** none beyond the gate.

**Verification:** The gate is green. Every remaining loose file in
`components/` is generic or has two or more feature users.

- [x] **Unit 8: Docs and the guide**

**Goal:** Every living doc points at the new paths, and the guide is
written down.

**Requirements:** R4, R5, R6

**Dependencies:** Unit 7

**Files:**
- Modify: `CLAUDE.md` (add a short "Where files go" section with the
  placement guide), `src/__tests__/README.md`, and the `docs/list/*.md`
  items that name moved paths
- Modify: `docs/plans/2026-11-05-001-refactor-toc-replacement-plan.md`:
  - the model-screen table paths (`PlayerStats` moves to `stats/`;
    `NewPlayerForm` moves to `profile/new-player/`)
  - the folder count and the folder list
  - its "No source folders get reorganised" line, which becomes "done in
    the 002 plan"
- Modify: Claude memory files that name moved paths (outside the repo)

**Approach:** Grep living docs for each old path in the map. Skip
`docs/archive/`, and dated plans and brainstorms other than the TOC plan.

**Test expectation:** none beyond the gate. `listForEd.test.ts` keeps the
list's links honest.

**Verification:** The gate is green. No living doc names a path that no
longer exists. The TOC plan's table paths all exist.

## System-Wide Impact

- **Interaction graph:** lazy route imports are the only path surface that
  matters at runtime. The build typechecks them, and the browser checks in
  Units 3–6 cover the main routes.
- **Test routing:** co-located tests move with their source and stay in the
  unit project. Nothing moves into or out of `src/__tests__/database/`.
- **Unchanged invariants:**
  - routes and URLs
  - database calls
  - behaviour
  - the `@/` alias
  - shadcn's paths
  - the deploy workflows
- **PR:** the body carries `[no-changelog]`, since no user sees a change.
- **Jack:** no new branches until this merges. He gets told before Unit 2
  and again on merge. Later branches can be ported with the script.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| A stale `vi.mock` or type-only path, which the build can't see | Path checker; the move script rewrites `vi.*` strings; unchanged test count |
| A paused branch can't be rebased | Unit 0 triage; committed script + map to port it |
| Placement disputes (Jack) | Map approved before moving; the guide is rules of thumb |
| Git loses a rename | Per-unit rename check; split into a pure-move commit |
| Over-moving, which fights Jack's flat preference | Guide rules 3 and 4; generic UI stays in `components/` |
| Jack starts a branch mid-reorg | Told first; the PR stays short-lived |

## Sources & References

- **Conversation with Ed, 2026-11-05:**
  - "Is the file system consistent?"
  - "now might be the best time"
  - "Jack likes a flatish system... use your judgment"
- **Follows on:** `docs/plans/2026-11-05-001-refactor-toc-replacement-plan.md`.
- **Reviews, 2026-11-05:** the feasibility review and the adversarial review
  are folded in above.
- **Related memory:**
  - Overhaul branches own subsystem cleanup
  - Test placement determines vitest project
  - Stacked PRs strand work off main
