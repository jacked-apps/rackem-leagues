---
title: "feat: What's New — a plain-language changelog users actually read"
type: feat
status: ready to build
date: 2026-09-05
origin: docs/brainstorms/2026-09-05-whats-new-requirements.md
supersedes: docs/plans/2026-09-05-001-feat-whats-new-plan.md
---

# feat: What's New

## Overview

Features ship and nobody hears about it. Push notifications, tournament
brackets, house rules, the payout calculator and the finances surface all went
live without a word, and the About page listed two shipped features under
"Coming Soon" for months.

Two problems, and only the first is obvious:

1. **Users don't learn what changed.**
2. **We forget to write it down.** A changelog nobody updates is worse than
   none — it actively misinforms. That's what happened to the About page.

This plan addresses both: a page users will actually read, and a process that
makes forgetting hard.

## The voice — the part that matters most

Ed, 2026-09-05: *"more informal and zero jargon easy to understand. so like
instead of 'bug fix: bla bla jargon blah' we do something like 'we fixed this
button so it doesn't double up a team chat'."*

**Rules:**

- **Say what changed for them, not what we did.** The reader is a pool player,
  not an engineer.
- **No jargon. None.** Not "service worker", "migration", "race condition",
  "cache", "dispatcher". If a word only makes sense to us, it doesn't go on the
  page.
- **Name the thing they can see** — the button, the screen, the chat.
- **Short.** One or two sentences. If it needs a paragraph, it's two entries or
  it doesn't belong.
- **No version numbers or ticket references in the text.**

**Worked examples, from real work on 2026-09-05:**

| Commit title (what we say to each other) | Entry (what we say to them) |
|---|---|
| `fix(pwa): SW had no SKIP_WAITING listener` | The app couldn't install its own updates. Tapping **Update** now actually updates it. |
| `fix(messages): make duplicate team chats impossible` | Tapping **Create team chat** twice made two identical chats. Now it makes one. |
| `fix(push): don't chime for the conversation you're already reading` | Your phone no longer buzzes for the chat you're already looking at. |
| `feat(notifications): per-chat and per-type controls` | You can now set quiet hours, and tell a busy team chat to notify you once instead of every message. |
| `fix(messages): keep the conversation header in view` | In a direct message, the other person's name stays at the top instead of scrolling away. |
| `fix(db): renumber push_subscriptions migration off a duplicate version` | *(nothing — no user-facing effect)* |

That last row is the discipline: **most of our commits don't belong on this
page.** A changelog padded with internal work is one nobody reads.

## When entries get written

**Per PR, by whoever wrote the change** — while the reasoning is fresh and the
user-facing effect is obvious. Writing them at release time means reconstructing
a fortnight of work from commit subjects, which is how they end up jargon-y.

A PR with no user-facing effect adds nothing. That's normal and expected.

Entries accumulate under an `unreleased` heading and get stamped with the
version at release.

## Key Decisions

- **Entries live in a committed file.** Release notes belong to the release; if
  they're editable at runtime they can describe a build that isn't deployed.
  Needing a commit is the point.
- **The release gate compares against the GIT TAG, not `package.json`.** The tag
  is what deploys, and the two have already drifted — `package.json` says 1.8.0
  while main is far past the v1.8.0 tag.
- **Nothing user-facing is always DECLARED, never inferred.** At PR level that is
  `[no-changelog]` in the description; at release level an explicit
  `noUserFacingChanges` reason. Both are one line, both are visible in review.
  The goal throughout is that you cannot forget — you can only decide.
- **The seen-marker is per USER, not per device** — a `members` column. Reading
  the notes on a laptop should clear the marker on a phone.
- **Quiet by design.** A small marker on the nav entry. No modal, no push, no
  unread count. An update the user didn't ask about shouldn't block what they
  came to do.
- **The page is public.** Readable logged-out, so a prospective operator can see
  a record of steady work before signing up.
- **Version string in two places** — the What's New page and the foot of the
  drawer. It's most useful when someone is confused, and that isn't when they'd
  go hunting for a changelog. On 2026-09-05 we mistook a stale bundle for a
  broken feature twice; both times the question was "am I on the new code?"

## Still open — Ed's call

- **How openly do we describe something that was broken?** Three registers, using
  the update bug:
  1. *"Fixed an issue where the app could fail to update."* — vague
  2. *"The app now updates properly when a new version is available."* —
     describes the present, doesn't dwell
  3. *"For about a week the app couldn't update itself. That's fixed."* — fully
     candid
  Recommendation is **2**: never claim something worked when it didn't, but
  don't narrate the failure either. **3** builds more trust with an operator
  evaluating the app, at the cost of inviting "how did that happen?" mid-sales
  conversation. The examples in this doc are written at level 2 — worth a look
  to see whether that reads right before it's set.

## Implementation Units

### Unit 1 — Content file + the page

**Shape: the current release in full, with earlier ones listed beneath it as
one-liners.** One route, one screen.

Ed, 2026-09-05: *"a single page with all of the new shit from the last year
would be too bulky"* — and then, on the list vs a separate archive route:
*"i think your idea of the list — date, release, and short explanation — is a
better idea than the /all page."*

```
What's New

1.9.0 · March 4
  • Your phone no longer buzzes for the chat you're already looking at
  • You can set quiet hours so nothing comes through at night
  • Tapping Create team chat twice no longer makes two chats

─────────────────────────────
Earlier releases

1.8.2 · Feb 20 · Messaging fixes and faster standings
1.8.1 · Feb 11 · Playoff bracket setup
1.8.0 · Jan 30 · Tournament brackets
```

Each earlier row links to that release in full at `/whats-new/1.8.1`.

**Why this over a separate index route:** the bulk problem was never "a list of
releases", it was "every release's full entries on one page". One line each
isn't bulky, and keeping them here means "when did that change?" is answered by
scanning rather than by a second navigation. One surface instead of two, and one
less thing to drift.

**Rejected — scrolling UP to reveal older releases.** People expect newest at
the top and older as they scroll DOWN. Inverting it reads as broken before it
reads as clever, and on a phone there's no scrollbar to signal position.

**Rejected — a git hash on each row.** Ed confirmed the version number, not a
commit hash. A hash means nothing to a player and makes the page look like a
developer tool, which is the opposite of the voice.

**Files:**

- `src/whatsNew/releases.ts` — typed:
  `{ version: string | 'unreleased', date: string | null, summary: string, entries: { text: string, forOperators?: boolean }[], noUserFacingChanges?: string }`
  - `summary` is the one-liner the "Earlier releases" list shows. Written with
    the entries, not generated from them — a generated summary is either the first entry (often
    the least important) or a count (useless).
- `src/whatsNew/WhatsNewPage.tsx` — public. Renders the requested release in
  full (defaulting to the newest) plus the "Earlier releases" list beneath.
  One component serves both `/whats-new` and `/whats-new/:version`.
- `forOperators` entries carry a small tag; a tag, not a separate view.
- Running version at the foot of the single-release page.

**Tests:** `/whats-new` shows the newest RELEASED version in full (never
`unreleased`); the earlier-releases list shows every other release, newest
first, and excludes the one being displayed; `/whats-new/1.8.1` shows that one
in full; an unknown version in the URL falls back to the newest rather than
crashing; an operator-tagged entry renders its tag; a single-release history
shows no "Earlier releases" section at all rather than an empty heading.

### Unit 2 — The seen-marker

- Migration: `members.last_seen_whats_new text` (nullable; NULL = never looked,
  which is every existing user).
- `useHasUnseenWhatsNew()` — compares the newest *released* version against that
  column. `unreleased` entries never trigger it; users shouldn't be marked
  "new" for something not yet shipped.
- Nav entry in **both** `AppSidebar` and `AppDrawer` with the marker, per the
  door-and-room rule.
- Opening the page writes the current version.
- Marker uses shape and text, never colour alone.
- Tests: unseen when NULL; unseen when stored version is older; seen when equal;
  `unreleased` doesn't trigger; opening clears it.

### Unit 3 — The PR check: answer the question, don't skip it

Ed, 2026-09-05: *"some PRs wont actually need a whats new blurb. but the pr
SHOULD have a way to say yea this is not something user needs or wants to
know."*

A fourth job in `.github/workflows/checks.yml`. It passes when **either**:

- the PR adds or edits an entry in `src/whatsNew/releases.ts`, **or**
- the PR description contains `[no-changelog]`

**Why not "changed `src/` ⇒ must have an entry":** that's wrong most of the
time. Refactors, test fixes, dependency bumps, a migration renumber — none are
user-facing. A check that's usually wrong gets routed around, and then it
protects nothing.

The point of this shape is that **you can't forget, you can only decide.**
Declaring "no user-facing change" costs one line and is visible in review, so a
`[no-changelog]` on a PR that plainly changes something a player sees gets
caught by a human — which is the right place to catch a judgement call.

- The failure message quotes the two ways to pass and links the voice rules. A
  gate that doesn't say how to satisfy it just gets bypassed.
- Runs on `pull_request` only. Nothing to check on a direct push to main.

### Unit 4 — Stamping a release

Entries accumulate under `unreleased`. Cutting a tag turns that into a released
section, so the page and the release stay in step by construction — the entries
were written by the PRs that made up that release.

- `scripts/stamp-whats-new.mjs <version>` — renames the `unreleased` block to
  the version, sets today's date, and opens a fresh empty `unreleased`.
- Run when tagging, and the result committed with the tag.
- A second gate in the **production deploy workflow**: fail if the tag being
  released has no matching section, and no explicit `noUserFacingChanges`
  reason. Compares against the **git tag**, not `package.json` — those have
  already drifted (`package.json` says 1.8.0 while main is far past that tag).
- This runs **before the build**, so a release that forgot its notes fails fast
  rather than halfway through a deploy.

### Unit 5 — Backfill

One `unreleased` entry covering what's actually live now, written to the voice
rules. Ships with Units 1-4 so the page is never empty on arrival.

Covers: push notifications with their controls, tournament brackets, house
rules, league dues and payouts, operator scoring and corrections, the FargoRate
results sheet, and the messaging fixes.

## Follow-ups

- An in-app editor, if maintaining the file becomes the bottleneck. It won't at
  this cadence.
- A commit-derived **draft** to solve the blank page — a prompt for a human to
  rewrite, never published text. Worth it only once the cadence makes writing
  from scratch feel like a chore.
- Emailing release notes — different problem, different consent question.
