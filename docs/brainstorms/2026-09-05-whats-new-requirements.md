# What's New — Requirements

**Date:** 2026-09-05
**Suggested branch:** `feat/whats-new`
**Status:** Brainstorm. Open questions below outnumber decisions on purpose.
**Relationship to prior work:** Supersedes the scope of
`docs/plans/2026-09-05-001-feat-whats-new-plan.md`, which was written before Ed
raised the archive and the "don't forget to write the entry" problem. That plan
should be rewritten from this rather than patched.

---

## 1. Overview

### Problem

Features ship and nobody hears about it. Push notifications, tournament
brackets, house rules, the payout calculator and the finances surface all went
live without a word to users. The About page had drifted far enough that two
shipped features were still sitting under "Coming Soon."

There are really **two** problems, and only the first is obvious:

1. **Users don't learn what changed.** No surface tells them.
2. **We forget to write it down.** Whatever surface exists, the note gets
   written when someone remembers — which is exactly the failure that produced
   the stale About page. A changelog nobody updates is worse than none, because
   it actively misinforms.

Problem 2 is the harder one and the reason this is a brainstorm rather than a
build.

### Not a broadcast message

Ed's first instinct was a message thread to all users. Reasons this doesn't fit,
kept from the earlier plan:

- A message can't be revised once sent.
- It devalues the inbox — messages are how a captain hears about a schedule
  change, and the unread badge has to keep meaning "a person needs me."
- "All users" isn't a scope announcements have; they're league- or org-scoped.

---

## 2. Users and what each one wants

| Who | What they want from this |
|---|---|
| **Player** | "Why does this look different?" — one line, plain language, once. |
| **Captain** | The same, plus anything that changes how they run their roster. |
| **League operator** | More detail. They're deciding whether to trust the app with their league, and a visible record of steady work is evidence. |
| **A prospective operator** | Same as above, but before signing up — so the page should be readable logged-out. |
| **Ed / Jack** | "What version is this person on?" and "did we ship the note?" |

Worth noticing: the operator and the prospect want *history*, while the player
wants *only what's new since last time*. That tension drives §4.

---

## 3. The archive question

Ed: *"there are some features like being able to see past updates and such."*

Options, roughly in order of effort:

**A. One long page, newest first.** Everything on one route, scroll for history.
Cheap. Gets unwieldy after a year, but a year is a long way off.

**B. Recent + an archive route.** Latest few on `/whats-new`, everything on
`/whats-new/archive`. Keeps the common case short.

**C. Per-version permalinks.** `/whats-new/v1.9.0`. Makes a version linkable —
useful in a support conversation ("that changed in 1.9, see here"), and it costs
almost nothing if entries are already keyed by version.

**D. Filter by audience.** Players see player-facing entries; operators can
switch to everything. Only worth it if operator-only entries turn out to be
numerous.

Leaning: **A + C to start** — one page, but each version anchored and linkable.
B when the page actually gets long, which is a nice problem. D probably never;
tagging entries is likely enough.

**Open:** does an operator want a *changed for you* view keyed to their last
visit, or is reverse-chronological with a "new since your last visit" divider
enough? The divider is much less machinery.

---

## 4. The real problem: not forgetting

Ed: *"a way we 'test' to make sure we dont forget to add the fix/feature etc to
the whats new thing."*

This is the part worth getting right. A few shapes, with what each actually
catches:

**Option 1 — Per-PR requirement.** CI fails if a PR touches `src/` without
touching the changelog file.
- *Catches:* everything.
- *Cost:* wrong most of the time. Refactors, test fixes, dependency bumps and
  internal cleanups have no user-facing effect. People learn to bypass a check
  that's usually wrong, and then it protects nothing.

**Option 2 — A PR label or checkbox.** "User-facing? → then a changelog entry is
required."
- *Catches:* whatever the author remembers to label.
- *Cost:* the forgetting we're trying to prevent just moves to the label.

**Option 3 — A release-time gate.** Cutting tag `vX.Y.Z` fails unless the
newest changelog entry's version equals `X.Y.Z`.
- *Catches:* the release with no notes at all — the actual observed failure.
- *Cost:* asks the question once per release, at the moment it matters, and
  can't be silently skipped because it blocks the deploy.
- *Doesn't catch:* a release whose notes exist but are incomplete.

**Option 4 — Derive a draft from commits.** Generate a starting list from
`feat:` / `fix:` commit subjects since the last tag, for a human to edit down.
- *Catches:* the blank-page problem, which is the real reason notes don't get
  written.
- *Cost:* commit subjects are written for us, not for players. "fix(db):
  renumber push_subscriptions migration off a duplicate version" means nothing
  to a league player. It's a **prompt**, never the published text.

Leaning: **3 + 4.** The gate makes forgetting impossible at the only moment that
counts; the draft makes remembering cheap. Neither 1 nor 2 survives contact with
a repo where most commits aren't user-facing.

**Open:** should the gate compare against `package.json` version, the git tag,
or both? They can drift — `package.json` says 1.8.0 today while main is far
ahead of the v1.8.0 tag.

**Open:** what happens on a hotfix release with genuinely nothing to tell users?
An explicit `entries: []` with a reason, so the gate is satisfied deliberately
rather than bypassed?

---

## 5. Version visibility

Not in Ed's ask, but earned its place today.

On 2026-09-05 we twice mistook a **stale bundle** for a **broken feature** — once
on the notification settings, once on the update button. Both times the question
was "am I actually running the new code?", and answering it needed DevTools.

A version string the user can read makes that a one-tap question. It also makes
a bug report usable: "I'm on 1.9.2 and X is broken" is actionable in a way that
"it's broken" isn't.

**Open:** where does it live? The What's New page is the obvious home, but it's
arguably more useful somewhere always reachable — the profile page, or the foot
of the drawer.

---

## 6. Content

- **Written for players.** "Fixed a race in `createTeamChat`" tells a league
  player nothing. "Creating a team chat twice by accident no longer makes two
  chats" tells them what changed for them.
- **Anything with no user-facing effect doesn't belong on the page.** A
  changelog padded with internal work is one nobody reads.
- **Entries live in a committed file, not the database.** Release notes belong
  to the release; runtime-editable notes can describe a build that isn't
  deployed. Needing a commit is the point.

**Open:** how much does a bug fix get said out loud? "Notifications now work
when the app is closed" is good news. "Notifications were broken for 8 days" is
honest but invites a question about how that happened. Probably: describe the
current state, don't narrate the failure — without ever claiming something
worked when it didn't.

---

## 7. Deliberately out of scope

- Emailing release notes — different problem, different consent question.
- An in-app editor for entries — the file is fine at this cadence.
- Per-user "what changed since YOUR last login" beyond a simple divider.
- Localisation.

---

## 8. Open questions, collected

1. Archive shape: one page, or recent + archive? (§3)
2. Per-version permalinks now or later? (§3)
3. "New since your last visit" divider, or nothing? (§3)
4. Release gate: compare against the tag, `package.json`, or both? (§4)
5. What satisfies the gate on a release with genuinely no user-facing change? (§4)
6. Where does the version string live — What's New, profile, or drawer? (§5)
7. How openly do we describe fixes to things that were broken? (§6)
8. Do operators need their own view, or is a tag enough? (§3)
