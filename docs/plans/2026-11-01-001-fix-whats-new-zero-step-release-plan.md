---
title: "fix: What's New — zero extra steps for Jack, no conflicts"
type: fix
status: proposed — awaiting Ed's go-ahead
date: 2026-11-01
amends: docs/plans/2026-09-05-002-feat-whats-new-plan.md
---

# fix: What's New ships itself

## The problem

What's New has two halves:

1. **Every PR adds a note.** A PR check enforces it, and it works.
2. **At release time, someone runs `stamp-whats-new.mjs`** to move the notes
   under the new version. Nothing enforces it, and it's a step only the
   release person can do.

Half 2 was missed on 1.10.0, 1.11.0 and 1.12.0. On 1.12.0 the stamp was pushed
after Jack had already run `npm version`, so his tag pointed at the commit from
before the stamp. Production shipped without the notes, and fixing that took a
second deploy that needed his approval.

There's a second, quieter cost. Every PR adds its note to the same array in
`releases.ts`, so two open PRs conflict with each other in that file. The
second PR to merge shows Jack a conflict.

**Ed's rule (2026-11-01):** Jack helps for free, as a last check. He merges
after a quick look, and he deploys. He should never hit a conflict, need
instructions, or have to remember an extra step. Any extra work lands on Ed's
side (Ed and Claude), or we drop the feature.

## How Jack releases today (unchanged by this plan)

Tags v1.10.0 to v1.12.0 were all made with `npm version <minor|patch>` on a
release branch. That bumps `package.json` and `package-lock.json`, commits
them as "1.12.0", and creates the tag. He then opens a PR, merges it, and
pushes the tag, which deploys.

## The fix

### Unit 1: the stamp runs inside `npm version`

npm runs a `version` script from `package.json` after it bumps the version and
before it commits. Anything that script `git add`s goes into the same commit,
which is the commit the tag points at. So:

- Add `"version": "node scripts/stamp-whats-new.mjs && git add src/whatsNew"`.
- The script reads the new version from `package.json` when no argument is
  given. This avoids `$npm_package_version`, which doesn't expand in Windows
  shells.
- **Nothing to stamp** (no notes) → it prints one line and exits 0. It must
  never block a release.
- **Already stamped** → it exits 0 instead of failing.

Result: Jack runs the same command as today, and the notes go out in the
commit he tags. No reminder needed, and no tag pointing at the wrong commit.

### Unit 2: one file per note, so PRs never conflict

- Each note is its own small file in `src/whatsNew/notes/`, named after the
  branch. It holds `text`, an optional `kind` and `forOperators`, and an
  optional `headline` (a few words).
- Two PRs never touch the same file, so they can't conflict.
- The page shows the unstamped notes the way it shows the `unreleased` block
  today: under "Latest changes", with no "New" badge. It picks them up with
  `import.meta.glob`.
- The stamp moves every note file into a new release block in `releases.ts`
  and deletes the files. Released history stays in `releases.ts` exactly as it
  is now.
- **Summary line:** the stamp joins the notes' `headline`s, e.g. "My Stats,
  fairer tiebreakers and standings". If no note has a headline, it uses "Fixes
  and improvements". Nobody has to write a summary at release time, and it
  stays a human-written phrase, not the first entry or a count.
- The `unreleased` block in `releases.ts` goes away. The notes folder replaces
  it.

### Unit 3: the PR check never goes red on Jack's release

The check passes when **any** of these is true:
- the PR adds a file under `src/whatsNew/notes/`
- the description has `[no-changelog]`
- **the PR changes the version in `package.json`** (a release PR). Today a
  quiet release with no notes would fail here. It's Jack's PR, so it must not.

### Unit 4: safety nets on Ed's side

- A unit test runs the stamp on a temporary copy of the repo's real files and
  checks that it succeeds and leaves no note files behind. Main can't hold
  anything the stamp would choke on, so Jack's `npm version` can't fail
  because of us.
- A unit test checks that every note file has the right shape (non-empty
  text, valid kind).
- Claude writes the note file as part of every user-facing PR. Ed reads it in
  the PR, which is where the "stay on track" value comes from.

### Unit 5: docs

- Update the header comment in `releases.ts`, the comments in the check and
  stamp scripts, and the What's New plan.
- Note the change in TABLE_OF_CONTENTS.md.
- **Nothing to tell Jack.** His routine is the same, and the only visible
  difference is that his release PR now also touches the What's New files.

## What it costs Ed

Nothing new. A note per user-facing PR is already the rule. It's now a new
file instead of an edit to a shared list.

## Not doing

- **Auto-tagging on merge, or GitHub Actions that commit to Jack's branch.**
  Both change how Jack releases, or add bot commits he'd see. Unit 1 gets the
  same result with no change for him.
- **The `changesets` npm package.** It's the industry tool for exactly this
  (one file per change, folded in at release), and this plan borrows its
  design. But it brings its own release command and changelog format, so it
  would change Jack's routine. The same idea in about 60 lines of our own
  script fits better.

## Done when

- Running `npm version patch` on a test branch stamps the notes into the
  version commit, and `git show` on the tag includes them.
- Two PRs that each add a note merge one after the other without a conflict.
- A release PR with no notes passes the What's New check.
