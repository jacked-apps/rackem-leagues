---
date: 2026-11-04
topic: tracking-docs
status: requirements
---

# Tracking docs that stay true: the TOC replacement and the new LIST_FOR_ED

## Problem frame

Two hand-kept docs have drifted until they work against their purpose:

- **`TABLE_OF_CONTENTS.md`** was meant to help Claude find reusable pieces and keep the app consistent and DRY. It doesn't do that.
  - 850 of 2,262 tracked files are missing from it.
  - Its "Last Updated" line (removed 2026-11-04) conflicted on every PR.
  - Claude searches the code instead of reading it, so a perfect file list still wouldn't have prevented the room-race UI rework. That rework happened because nobody asked "which existing screen is this like?", not because a file couldn't be found.
- **`LIST_FOR_ED.md`** is Ed's reminder list of tasks, ideas and wish-list items. It has three problems:
  - Finished and half-finished items stay on it, so "what's next?" turns into an audit.
  - Entries are so long that Ed can't skim the list himself.
  - At 33 sections and 1,416 lines, it's too long to read.

Both share one root cause: a single shared file that everyone hand-edits drifts, and it clashes whenever two PRs touch the same lines.

**The guiding test (Ed):** build only what Claude would actually use. A doc that exists "to keep Ed happy" and that Claude doesn't rely on just drifts again. What reliably reaches Claude:
- `CLAUDE.md` and the memory index, which are loaded every session
- files that sit next to the code Claude is already looking at

A separate document Claude has to remember to open does not reliably reach it.

## Part A: Replace the TOC with what Claude actually uses

- **A1. The trigger lives in `CLAUDE.md`.** A short rule: before building a screen, find the closest existing screen and start from its look and components. With it goes a small table of model screens, for example "scores games → the league scoring screen (`src/player/ScoreMatch.tsx` and `src/components/scoring/`)". The table holds a handful of rows, not an index.
- **A2. The model screen is chosen at plan time, where it gets reviewed.** Every plan that builds or changes UI carries a required **"Model screen:"** line. It names the existing screen it starts from and the components it reuses, or explains why no screen fits. This is the actual fix for the room-race rework: the choice is made and seen before any code exists, not remembered mid-build.
- **A3. A test keeps the model-screen table true.** It fails when a path named in the `CLAUDE.md` table no longer exists, so the one piece that matters most can't silently go stale.
- *Decided against (Ed, 2026-11-04): per-folder READMEs of reusable pieces.* Claude reaches code by searching and opening the file directly, so a README beside it would rarely be read. The repo already shows this: the `docs/league-system/modules/*/README.md` docs were skipped until a memory note had to force them. Revisit only if Claude misses a reusable piece even after starting from a model screen.
- **A4. A one-screen folder map for new developers.** It covers what each top-level folder holds and how things are filed, and it lives in the main README or beside it.
- **A5. Delete `TABLE_OF_CONTENTS.md`,** and remove every live instruction that points at it. A rule left behind that names a missing file makes Claude try to rebuild it. The places to change:
  - `CLAUDE.md`, the "Table of Contents Maintenance" section
  - Claude's memory note `feedback_table_of_contents_always.md` and its line in `MEMORY.md`
  - `README.md` (lines 161 and 202): point them at the A4 folder map
  - `CHEATSHEET.md:118`
  - the TOC rows in `MERGE_GUIDE.md` (lines 54 and 66)

  Historic plans and archive docs stay as they are. Nothing generated replaces the 2,262-row list, because Claude wouldn't read it.
- **A6. The existing `src/components/COMPONENTS_INDEX.md` gets decided, not ignored.** It's a 194-line "Reusable Components Library" last touched 2026-09-14, so it's a third hand-kept index already drifting. Either its useful content moves into the Part A replacement and the file is deleted, or it becomes that replacement. It must not survive as a fourth list.

## Part B: LIST_FOR_ED becomes a bucket of item files

- **B1. One file per item** in a dedicated folder, but only when nothing else already holds the detail. If an item already has a plan, brainstorm or audit doc in `docs/`, its list line links straight to that doc and no item file is made, so detail is never kept twice. An item file holds:
  - a one-line summary
  - its kind: task or idea
  - the date it was added, and the date it was last checked against the code
  - whatever detail was worked out

  Detail lives only in the item file. Importance is NOT stored in the file. It lives only in which group the item sits in on the short list (B2), so the two can't disagree.
- **B2. A short hand-kept list on top.** `LIST_FOR_ED.md` becomes one line per item, grouped by importance, and each line links to its item file. Ed should be able to skim it in under a minute.
- **B3. Finished means deleted.** The PR that finishes an item deletes the item file and its list line in the same PR. A partly done item stays, and its summary says what's left. **A gated item is the exception:** merging doesn't finish it. It's deleted in the un-gate PR, matching the `CLAUDE.md` feature-gating workflow.
- **B4. Importance groups:** Now / Next / Later / Wish list. Separately there's a standing **Gated: awaiting staging review** group. Gated is a status, not an importance level.
- **B4a. Ed curates the top of the list.** Only Ed moves an item into Now or Next. Now holds about 3 items at most. Claude files every new item under Later unless Ed says otherwise. Without this, Claude-written items drift into Now and the list becomes an audit again.
- **B4b. "What's next?" has a built-in check.** Whenever Ed asks what's next, Claude first checks the Now and Next items against the code on main, and updates their last-checked dates. Anything already done gets reported, not offered. This is the backstop for B3: it runs because Ed asked, not because Claude remembered. If Now is empty, Claude says so and offers the top of Next. The gated group keeps its current role from the `CLAUDE.md` feature-gating workflow. The exact group names can be adjusted in planning.
- **B5. An owner field is reserved** so that `LIST_FOR_JACK.md` can fold in later, with items for Ed, Jack, or both. Folding Jack's list in is NOT part of this work.
- **B6. Moving the current list over includes an honest audit.** Each of the 34 sections is checked against the code and main:
  - done → dropped
  - partly done → rewritten as "what's left"
  - still open → becomes an item file with a short summary

  - can't tell from code (for example "NEEDS-ED-CONFIRM", staging checks, "VERIFY PR #249") → becomes an item marked "needs Ed", rather than guessed at

  The audit is presented as a table Ed approves before any old entry is deleted.
- **B6a. Code comments that cite "LIST_FOR_ED #N" get repointed.** Ten source files do, for example `src/__tests__/README.md` (#27) and `src/player/ScoreMatch.tsx` (#23). Live pointers go to the new item's path, and "closed #N" history notes just drop the number.
- **B6b. `CLAUDE.md` changes that come with Part B:** the feature-gating workflow names the Gated section of `LIST_FOR_ED.md` and how entries are added and removed. It's rewritten for the new form, with the gate locations and the staging verify line going into the item file. A line also says that for "what's next?", `LIST_FOR_ED.md` is the source.
- **B6c. One source of truth for "what's next".** Claude's memory notes stop repeating an item's status, like "awaiting Ed's staging review", and point to the item instead. Otherwise memory and the list drift apart.
- **B7. Clashes on the short list are accepted for now.** They're less frequent than the TOC's were and easy to resolve. If Ed likes the method, an automatic rebuild of the list after merges is a possible later step. That needs Jack, because it writes to main.

## Success criteria

- Asking "what's next on my list?" gives a short, true answer, with no audit and nothing already done.
- Ed can read the whole list himself, quickly.
- When Claude starts a screen, it starts from the model screen named in `CLAUDE.md`. The proof is the next UI feature landing close to the app's look on the first pass.
- No PR conflicts on a TOC-style shared index. Clashes on the short list itself are accepted for now (B7).
- Neither replacement drifts silently. The table test catches moved model screens, finished items leave the list in the PR that finishes them, and "what's next?" re-checks the top of the list.
- **The real test of Part B:** after 3–4 weeks of normal use, ask "what's next?" and count stale entries in Now and Next. Zero or near zero means it works. That result, not the first look right after the audit, decides whether the automatic rebuild (B7) is worth doing.
- Every UI plan written after Part A names its model screen.

## Scope boundaries

- Folding `LIST_FOR_JACK.md` into the new list: later (B5 only reserves the field).
- Automatic list rebuild on main: later, if Ed likes the method, and it needs Jack.
- Reorganising source folders: allowed later if the folder map shows a mess, but not part of this work.
- Fixing the content of `LIST_FOR_ED` items, as opposed to moving and auditing them: out of scope.

## Delivery

One brainstorm, **two plans and two PRs**, both on main:

1. **LIST_FOR_ED first (Part B).** It's smaller, Ed uses it daily, and he wants to see whether he likes the method.
2. **The TOC replacement (Part A).**

Neither depends on the other.

Part B also ships a small test: every list line points at a real file, and every item file has exactly one list line. That means it isn't a docs-only PR, which keeps Ed's "no solo doc PRs" rule intact. Part A carries the table test.

## Outstanding questions (for planning)

- Where the item files live and how they're named (for example by date and short slug).
- Whether the folder map (A4) goes in the root `README.md` or a separate short file.
- What happens to `COMPONENTS_INDEX.md`'s content (A6): fold the useful rows into the model-screen table, or drop it.
- Where the "Model screen:" line is enforced: the plan template, doc review, or a `CLAUDE.md` rule.
