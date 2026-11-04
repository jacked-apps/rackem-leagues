---
title: "refactor: LIST_FOR_ED becomes a short list plus item files"
type: refactor
status: active
date: 2026-11-04
origin: docs/brainstorms/2026-11-04-tracking-docs-requirements.md
---

# refactor: LIST_FOR_ED becomes a short list plus item files

## Overview

`LIST_FOR_ED.md` has 33 sections and runs 1,416 lines. It becomes a short grouped list that Ed can skim in under a minute.

- Each line links to exactly one place that holds the detail. That's either an existing plan, brainstorm or audit doc, or one small item file in a new folder.
- A unit test keeps the list and the folder matched.
- A `CLAUDE.md` rule makes Claude re-check the top of the list against main before suggesting what to do next.

This is Part B of the origin brainstorm. Part A, the TOC replacement, gets its own plan and PR (see origin: `docs/brainstorms/2026-11-04-tracking-docs-requirements.md`). The origin's B6 says "34 sections", but the real file has 33 `##` sections, so 33 is used here.

## Problem Frame

Asking "what's next?" turns into an audit of finished and half-finished entries, and the entries are too long for Ed to read himself. The cause is a single hand-edited file that holds status, detail and priority all at once.

The fix splits those three apart:
- **Priority** lives only in the group a line sits in.
- **Detail** lives only in the item file or the doc it links to.
- **Finished** means the line and its item file are deleted.

(See origin, Problem frame and B1–B4.)

## Requirements Trace

- R1 (B1). One item file per item, created only when no existing doc already holds the detail. It holds a summary, kind, added date, checked date and the detail. Importance is never stored in it.
- R2 (B2). `LIST_FOR_ED.md` has one line per item, grouped, each linking to its item file or doc.
- R3 (B3). The PR that finishes an item deletes it. A gated item is deleted in its un-gate PR.
- R4 (B4/B4a). Groups are Now, Next, Later and Wish list, plus Gated. Only Ed moves items into Now or Next, and Now holds about 3 at most. New items go to Later.
- R5 (B4b). Before suggesting what's next, Claude re-checks the Now and Next items against main and updates their checked dates. Anything already done gets reported, not offered.
- R6 (B5). An owner field is reserved so `LIST_FOR_JACK.md` can be folded in later.
- R7 (B6). The migration audits every section. Ed approves the audit table before any old entry is deleted.
- R8 (B6a). "LIST_FOR_ED #N" pointers in the source get repointed.
- R9 (B6b). `CLAUDE.md` changes: the gating workflow, and "what's next" comes from the list.
- R10 (B6c). Memory notes point at items instead of repeating their status.
- R11 (Delivery). A small test ships with the change, so the PR isn't docs-only.

## Scope Boundaries

- `LIST_FOR_JACK.md` stays untouched. Only the owner field is reserved (origin B5).
- No automatic list rebuild (origin B7). Two PRs that each add a line to the same group can still clash on the list. That's accepted for now, and it's a one-line fix when it happens.
- The content of items isn't fixed. Items are moved and audited, not worked on.
- Applied migration files under `supabase/migrations/` keep their "LIST_FOR_ED #N" comments. An applied migration's text stays as it is.

### Deferred to Separate Tasks

- Part A, the TOC replacement, gets its own plan and PR from the same origin doc.

## Context & Research

### Relevant Code and Patterns

- **`src/whatsNew/notes/` is the pattern to copy.** It keeps one file per entry, plus a shape test at `src/whatsNew/__tests__/pendingNotes.test.ts`. That test reads the folder with `node:fs` from `process.cwd()` and has a `problems()` helper that is self-tested on a broken sample.
- **Where the test runs.** The vitest `unit` project includes `src/**/*.test.ts` except the database folder, so a test at `src/__tests__/unit/` runs there. CI runs it through `pnpm test:unit` (`.github/workflows/checks.yml`).
- **No YAML library is installed** (no `yaml`, `js-yaml` or `gray-matter`). The test parses its own flat frontmatter.
- **The current Gated section has three entries:** Become a Host, the Stop Stop explainer (staging-only for good), and the Scoring Workshop.
- **Live pointers to repoint (R8):**
  - `src/__tests__/README.md` (#27, twice)
  - `src/api/hooks/useMessageComposerStatus.ts` (#29)
  - `src/__tests__/database/messaging-phase1-season-activation.rls.test.ts` (#26)
  - `src/api/mutations/brackets.ts` and `src/components/PaymentMethodSetup.tsx` (each says "see LIST_FOR_ED.md")
  - `src/operator/LmsResultsSheet.tsx`
  - `MVP_FEATURE_LIST.md` (#29)
  - `docs/file-split-backlog.md` (#5)
  - `docs/research/2026-06-07-stale-cache-mutation-discipline.md` (#2)
  - `docs/league-system/intake-agent-howto.md` and `docs/league-system/intake-agent-prompt.md` (both say "copy it into LIST_FOR_ED.md")
- **History notes that just drop the number:**
  - `src/api/hooks/useMemberMutations.ts`, `src/api/hooks/useOrganizationMutations.ts` and `src/leagueOperator/LeagueOperatorApplication.tsx` (#7)
  - `src/operator/OperatorDashboard.tsx` (#8)
  - `src/operator/TeamEditorModal.tsx` (#16)
  - `src/components/scoring/UnifiedScoreboard.tsx` (#10)
  - `src/player/ScoreMatch.tsx` (#23)
  - `src/api/hooks/useMatches.ts` (#21/#22)
  - `src/hooks/lineup/useFargoStartPointsNegotiation.ts` (#22/#24)
- **Prose mentions that stay as they are:** `MERGE_GUIDE.md`, `MERGE_NOTES_lo-stack.md` and `docs/audits/2026-10-28-tiebreaker-audit.md`.

### Open PRs that edit LIST_FOR_ED.md (checked 2026-11-04)

| PR | Branch | What it does to the list |
|---|---|---|
| #317 | feat/room-race | Adds the league games-list alignment entry and rewrites the Game Room gated entry |
| #314 | fix/scoreboard-dark-mode-text | Deletes 9 sections it closed and adds 26 lines |
| #312 | fix/team-bonus-playoffs | Adds the "team bonus in playoffs" entry |
| #311 | feat/menu-favorites | Adds the "grouped menu + favorites" entry |
| #309 | feat/theme-palettes | Deletes the dark-mode scoreboard entry and adds the "Playoffs page" entry |

All five also delete TOC line 3 (the old "Last Updated" line).

### Institutional Learnings

- Memory `feedback_no_solo_doc_prs`: the list test is what makes this a real PR.
- Memory `feedback_pr_backlog_press_on`: Jack merges on his own schedule. Ed can still merge a narrow, low-risk PR himself when one blocks others.
- Memories `feedback_trust_recommendations` and `feedback_be_directive_on_queue`: Ed often hands over with "your call" or "go", not "what's next?". The re-check has to fire on any next-task pick, not only on that phrase.
- Memory `feedback_verbal_approval_sets_marker`: Ed's "looks good" counts as approval.

## Key Technical Decisions

- **The item folder is `docs/list/`, and files are named `YYYY-MM-DD-short-slug.md`.**
  - The date is the original entry's date when it has one, otherwise the migration date. The `added` field uses the same date.
  - The folder name doesn't mention Ed, so Jack's items can live there later (R6).
- **Item frontmatter is flat `key: value` lines.**
  - Required: `summary` (one line), `kind` (`task` or `idea`), `added`, and `checked` (both `YYYY-MM-DD`).
  - Optional: `owner` (`ed`, `jack` or `both`; when it's missing, the item is Ed's).
  - There's no group or priority field, so the list is the only place importance lives (origin B1).
  - The test's own small parser handles this format, so no dependency is added.
- **The list's shape.**
  - A header of about five lines says how the list works and where the rules live.
  - Then one `##` heading per group, in this order: Now, Next, Later, Wish list, Gated.
  - Under each heading, one bullet per item: a link, then a short summary on the same line.
  - Within Later and Wish list, lines are sorted by file name, so the order is fixed and nobody has to decide where a line goes.
- **The rules and the item format live in `CLAUDE.md`, with no separate README.** `CLAUDE.md` loads every session, so it's the one place Claude reliably reads (origin's guiding test). The list's header points to it for humans.
- **What the test checks** (`src/__tests__/unit/listForEd.test.ts`):
  - the first link on each bullet line is that line's target
  - targets are resolved from the repo root, and `http(s):` and `#` links are ignored
  - every target exists
  - every `docs/list/*.md` file is the target of exactly one line
  - every item has the four required fields in a valid form
  - only the five known group headings appear

  It does not check how many items Now holds. A rule of "about 3" is a judgment call, so the what's-next rule handles it by asking Ed to demote one. A failing build is the wrong tool for that. Each failure message names the file and the fix in one sentence.
- **This PR merges first, then each open PR converts its own list edit.**
  - Ed is asked to land this PR promptly, since it's a narrow, low-risk merge.
  - Once it's on main, each of the five open branches is rebased, and its `LIST_FOR_ED.md` change is rewritten in the new form:
    - added entries become item files plus one line
    - #314's and #309's closing deletions become deletions of the matching new items
  - That way each PR still carries its own item changes, so R3 holds and nothing points at code that isn't on main.
  - If one of the five merges first, its entries are folded into this PR during its rebase: this PR's version is kept and their content is added.

  The order was chosen after review. Stripping the open PRs' edits up front would have left a stretch where those entries were recorded nowhere, and a gated feature could land with no Gated entry.
- **The audit is checked against main as it is today.** Items that an open PR will close stay in the list as items, and that PR deletes them when it's rebased. Nothing is dropped because of unmerged work.
- **The Stop Stop explainer leaves the list.** It isn't waiting to be un-gated, because it's staging-only for good, so it doesn't fit Gated or the un-gate rule. Its "never un-gate" note moves to a comment at its gate in `src/navigation/NavRoutes.tsx`, unless an equivalent comment is already there.
- **The audit table is saved** as `docs/audits/2026-11-04-list-for-ed-migration.md`. It's a dated snapshot that records the evidence behind each drop and is never maintained, so it can't drift.
- **This PR's changes to shared files.**
  - It deletes TOC line 3 exactly as the five branches do, so that hunk is identical.
  - It adds TOC rows only in sections those branches don't touch.
  - In `CLAUDE.md` it edits only the Feature Gating section and adds the new rule.

## Open Questions

### Resolved During Planning

- **Where items live and how they're named:** see Key Technical Decisions.
- **Whether the Now cap is enforced by the test:** no. The rule asks Ed instead.
- **How gated items are written:** with fixed body headings ("Gate", "Entry points", "Verify on staging"), defined in `CLAUDE.md`. The test doesn't parse item bodies.

### Deferred to Implementation

- **Each section's verdict.** That's the audit's job, with Ed approving it.
- **The final one-line summary wording.** It's written during the move.
- **The exact Now and Next contents.** The audit proposes them, and Ed approves or changes them.

## Output Structure

    LIST_FOR_ED.md                                   (rewritten: header + 5 groups)
    docs/list/YYYY-MM-DD-<slug>.md                   (one per item without an existing doc)
    docs/audits/2026-11-04-list-for-ed-migration.md  (approved audit snapshot)
    src/__tests__/unit/listForEd.test.ts

## Implementation Units

- [ ] **Unit 1: The guard test's helpers**

**Goal:** The parsing and checking logic exists and has its own tests, before any content moves. That way CI stays green while the audit waits for Ed.

**Requirements:** R1, R2, R11

**Dependencies:** None

**Files:**
- Create: `src/__tests__/unit/listForEd.test.ts`

**Approach:**
- The helpers take text and file lists as input and never hard-code paths. They are:
  - a frontmatter parser
  - an item-problem checker
  - a list parser that returns groups and their target links
  - a matcher that compares list targets with the item files
- This unit ships only the self-tests on in-memory samples. The checks against the real `LIST_FOR_ED.md` are added in Unit 3. Until then the old file would fail them.

**Patterns to follow:**
- `src/whatsNew/__tests__/pendingNotes.test.ts`

**Test scenarios:**
- Happy path: a valid sample item parses to the expected fields, and a sample list with the five headings and two linked items passes.
- Edge case: the frontmatter parser handles a missing closing `---` and an empty value, and reports both.
- Error path: the item checker flags a missing `summary`, `kind: bug`, and `added: 11/04/2026`.
- Error path: the matcher reports a link to a missing file, an item with no line, an item with two lines, and a heading outside the five groups.
- Edge case: a line whose first link is `docs/plans/…` passes with no item file.
- Edge case: a second link in a summary, and `https://` or `#` links, are not counted as targets.

**Verification:**
- The self-tests pass, and the unit suite stays green on the branch.

- [ ] **Unit 2: The audit table (Ed approves)**

**Goal:** Every one of the 33 sections gets a verdict and a new home, and Ed signs off before anything is deleted.

**Requirements:** R4, R7

**Dependencies:** None (it can run alongside Unit 1)

**Files:**
- Create: `docs/audits/2026-11-04-list-for-ed-migration.md`
- Modify: `TABLE_OF_CONTENTS.md` (add the audit row)

**Approach:**
- Each section is checked against `origin/main`, its linked PRs and the existing plans. Verdicts:
  - **done, drop:** must cite evidence (a commit, merged PR or file)
  - **partly done:** becomes an item that says what's left
  - **open:** becomes an item
  - **has a doc:** the line links that doc
  - **needs Ed:** for NEEDS-ED-CONFIRM entries, staging checks such as "VERIFY PR #249", and anything the code can't answer
- The table proposes a group for every survivor:
  - Later by default
  - Wish list for ideas
  - Gated for Become a Host and the Scoring Workshop
  - up to 3 proposed for Now and about 5 for Next, so the list doesn't start with both empty
- Ed's approval of the table sets Now and Next. His changes are folded in. **Work stops here until Ed approves.**

**Execution note:** Spread the section checks across 4 agents or fewer. The main thread spot-checks every "done" verdict before the table reaches Ed.

**Test expectation:** none. This is an analysis document, and Ed's approval is the check.

**Verification:**
- Each of the 33 headings appears once in the table, and every "done" row cites evidence that's on main.
- Ed has approved the table.

- [ ] **Unit 3: Move the content and rewrite the list**

**Goal:** The approved table becomes item files plus the short list, and the real-file checks are switched on.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1, and Unit 2 approved

**Files:**
- Create: `docs/list/*.md`, one for each surviving item that has no existing doc
- Modify: `LIST_FOR_ED.md` (full rewrite)
- Modify: `src/__tests__/unit/listForEd.test.ts` (add the checks against the real files)
- Modify: `TABLE_OF_CONTENTS.md` (delete line 3 as the open branches do, and add a `docs/list/` row)
- Modify: `src/navigation/NavRoutes.tsx` (a comment on the Stop Stop gate, only if one is missing)

**Approach:**
- Each item gets:
  - its summary, in the frontmatter and on its list line
  - the useful detail from the old section, moved into the body. It's trimmed, not reworded into new claims.
  - `checked` set to the audit date
- Gated items use the fixed headings.

**Test scenarios:**
- Integration: the real-file checks pass with no dead links and no orphan items, and every heading is valid.

**Verification:**
- The list fits on about one screen. Each surviving row in the audit table matches exactly one list line.

- [ ] **Unit 4: Repoint references, rules and memory**

**Goal:** Nothing points at the old numbered sections any more, and the rules describe the new form.

**Requirements:** R5, R8, R9, R10

**Dependencies:** Unit 3

**Files:**
- Modify the live-pointer and history-note files listed under Context & Research.
- Modify `CLAUDE.md`:
  - the Feature Gating Workflow
  - a new "The list" section holding the item format, the group rules and the what's-next rule
- Modify (outside the repo): the memory notes `project_game_room_progress.md`, `project_room_race.md`, `project_sidebar_regroup_favorites.md`, `project_my_stats_page.md`, `feedback_list_for_ed_jack_in_repo.md` and `project_tracking_docs.md`, plus their `MEMORY.md` lines.

**Approach:**
- **Gating workflow.**
  - Step 1: add a gated item, meaning a `docs/list/` file with the Gate, Entry points and Verify on staging headings, plus one line under Gated.
  - Step 4: the un-gate PR deletes both the file and the line.
- **The what's-next rule fires whenever Claude chooses or suggests the next task**, including after "your call", "pick" or "go", not only when Ed types "what's next?". The steps:
  1. Re-check every Now and Next item against main, and update its `checked` date.
  2. Report anything that's already done, rather than offering it.
  3. If Now holds more than about 3 items, ask Ed which one to move down.
  4. If Now is empty, offer the top of Next.
  5. If Next is empty too, propose up to 3 Later items for Ed to promote. Never list all of Later.
  6. Any new item Claude adds goes to Later.
- **The finishing-PR rule:** a PR that finishes an item deletes the item file and its line.
- **Memory notes** keep the *why* but drop status lines such as "awaiting Ed's staging review". Each points to its `docs/list/` item instead.
- **Source edits are comment-only.**

**Test expectation:** none for comment and rule edits.

**Verification:**
- Grep for plain `LIST_FOR_ED` outside `supabase/migrations/`, `docs/plans/`, `docs/brainstorms/` and `docs/archive/`. The only hits allowed are `CLAUDE.md`, `TABLE_OF_CONTENTS.md`, `MERGE_GUIDE.md`, `MERGE_NOTES_lo-stack.md`, `docs/audits/` and the new list test. This is checked once by hand.
- `pnpm run build`, lint and the unit suite are all green.

- [ ] **Unit 5: Convert the five open PRs after this PR is on main**

**Goal:** Each open PR carries its own list change in the new form, so none of them conflicts with the rewrite, whatever order the rest merge in.

**Requirements:** R3, R7

**Dependencies:** This PR merged to main

**Files (on each of feat/room-race, fix/scoreboard-dark-mode-text, fix/team-bonus-playoffs, feat/menu-favorites and feat/theme-palettes):**
- Modify: `LIST_FOR_ED.md`. Take main's version, then re-apply the branch's intent as new lines.
- Create: `docs/list/*.md` for each entry the branch added. The Room Race gated item goes on `feat/room-race`.
- Delete: the `docs/list/` items that the branch closes. This covers #314's 9 closures and #309's dark-mode scoreboard entry, wherever they survived the audit.
- On `feat/room-race`: update the PR #317 body so its staging-checklist pointer names the new item path.

**Approach:**
- Rebase each branch onto main, which now has the rewrite. When the old-format `LIST_FOR_ED.md` hunk conflicts, take main's version and add the branch's lines.
- Run the list test on each branch, then push.
- **If any of the five merges before this PR:** rebase this PR instead, keep its version, and fold in that PR's entries. The audit table gets a row for each.

**Test scenarios:**
- Integration: on each rebased branch, the list test passes.
- Integration: a trial merge of each branch with main merges `LIST_FOR_ED.md`, `TABLE_OF_CONTENTS.md` and `CLAUDE.md` with no conflicts.

**Verification:**
- None of the five has a `LIST_FOR_ED.md` diff in the old format.
- Every gated feature on those branches has its Gated item on that branch.

## System-Wide Impact

- **Interaction graph:**
  - The new test runs in CI on every PR through `pnpm test:unit`. A PR that deletes an item file but leaves its line fails, and so does the reverse. That is intended.
  - Jack's own PRs rarely touch the list, so they're unaffected.
  - If main ever goes out of sync, the failure message says which file and line to fix.
- **Unchanged invariants:**
  - `LIST_FOR_JACK.md`, the What's New flow and applied migrations stay as they are.
  - The file name `LIST_FOR_ED.md` stays, so every existing mention of it still resolves.
- **State lifecycle:**
  - Old content is deleted only after Ed approves the audit.
  - Git history and the audit snapshot both keep a record of it.
  - Open-PR entries are never in limbo: they stay on their branches until each branch is converted.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| An audit agent marks an item done when it isn't | Every "done" row needs evidence on main, the main thread spot-checks it, and Ed approves the table |
| This PR waits a long time for Jack | Ask Ed to land it promptly, since it's narrow and low-risk. Meanwhile the open PRs keep their old-format edits, and any that merge first get folded in here |
| The list grows long again | New items go to Later, one line each. The what's-next rule keeps Now near 3 and never dumps Later |
| Item files drift away from the code | The `checked` date, plus the re-check on every next-task pick. The 3–4 week stale count is the real test (see origin, Success criteria) |
| The what's-next rule gets skipped | It fires on any next-task pick, not on one phrase, and it lives in `CLAUDE.md`, which loads every session |

## Documentation / Operational Notes

- The PR body includes `[no-changelog]`, because nothing changes for app users.
- The 4-week check, around 2026-12-02, is itself a Later item on the new list: ask what's next and count the stale Now and Next entries.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-11-04-tracking-docs-requirements.md](../brainstorms/2026-11-04-tracking-docs-requirements.md)
- Pattern: `src/whatsNew/__tests__/pendingNotes.test.ts`
- Open PRs affected: #309, #311, #312, #314, #317
