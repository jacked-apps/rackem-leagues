---
title: "feat: What's New — telling users what changed, without using their inbox"
type: feat
status: not started
date: 2026-09-05
origin: Ed, 2026-09-05 — "i would like a way to update a whats new page or some way to tell the users what the new updates are. perhaps a message thread we can send to all users?"
---

# feat: What's New

## Overview

Features ship and nobody knows. Push notifications, tournament brackets, house
rules, the payout calculator and the finances surface all went in without a
word to users, and the About page had drifted far enough that two shipped
features were still listed under "Coming Soon."

This is the surface that closes that gap: a real changelog, plus a quiet marker
so people notice it once and never again.

## Why not a message to all users

Ed's first instinct was a message thread broadcast to everyone. Three reasons
this plan doesn't do that:

- **A message can't be revised.** Get a version wrong, or describe something
  that then changes, and it sits in every inbox permanently. A page is edited
  in a PR.
- **It devalues the inbox.** Messages are where a captain learns about a
  schedule change. Release notes competing with that make the unread badge stop
  meaning "a person needs me" — which is the one thing that badge has to keep
  meaning.
- **"All users" doesn't exist.** Announcements are scoped to a league or an
  organization (`scope_type` / `scope_id`). A global broadcast is new
  infrastructure, and inventing a scope that means "everyone" is the kind of
  thing that later leaks into places it shouldn't.

The reach is the same either way. The difference is that a page costs the user
nothing when they don't care.

## What ships

1. **A `/whats-new` page** — reverse-chronological releases, each with a
   version, a date, and a short list of changes in plain language.
2. **A nav marker** — a small "New" indicator next to the entry, which clears
   once the page is opened. Not a modal, not an interstitial: an update the user
   didn't ask about shouldn't block what they came to do.
3. **A hook from the update prompt** — after "Update Now" reloads onto a new
   version, the marker is there waiting. The prompt itself stays as-is.

## Key Decisions

- **Entries live in a committed file, not the database.** Release notes belong
  to the release: if they're editable at runtime they can describe a build that
  isn't deployed, which is worse than saying nothing. A `whatsNew.ts` array
  reviewed in the PR that ships the feature keeps notes and code honest with
  each other.
  - The tradeoff, stated plainly: adding an entry means a commit and a deploy.
    That is the point, not a limitation.
- **Written for players, not for us.** "Fixed a race in `createTeamChat`" tells
  a league player nothing. "Creating a team chat twice by accident no longer
  makes two chats" tells them what changed for them. Anything with no user-facing
  effect doesn't belong on the page at all.
- **The seen-marker is per USER, not per device.** A `members.last_seen_whats_new`
  column holding the last version viewed. localStorage would be simpler but
  wrong: a captain who reads the notes on their laptop shouldn't see "New" on
  their phone for a week. It also makes "how many people have seen this" a
  question the database can answer.
- **The marker is quiet.** No modal, no push, no unread count. A dot or a small
  "New" chip on the nav entry, cleared on open.
- **A player-visible version string.** Today "am I on the new build?" is
  unanswerable without DevTools — we hit exactly that twice on 2026-09-05, and
  twice mistook a stale bundle for a broken feature. Showing the running version
  at the bottom of this page makes it a one-tap question, for users and for us.

## Open Questions

- **Does an operator get different notes than a player?** Most releases contain
  both. Options: one list with a small "for operators" tag on the relevant
  entries, or two sections. Tagging is probably enough, and one list is one
  thing to maintain.
- **How far back does the page go?** Suggest keeping everything — it's cheap,
  and a visible history of steady work is worth something to a league operator
  deciding whether to trust the app.
- **Backfill?** The last two weeks alone cover push notifications, brackets,
  finances, house rules and the LMS sheet. Suggest a single "Recent" entry
  covering the current state rather than reconstructing history that nobody
  saw happen.

## Implementation Units

### Unit 1 — Content + page

- `src/whatsNew/releases.ts` — a typed array: `{ version, date, entries: [{ text, audience? }] }`.
- `src/whatsNew/WhatsNewPage.tsx` at `/whats-new`, public (no auth) so it can be
  linked from marketing and read by someone deciding whether to sign up.
- The running version rendered at the foot of the page.
- Tests: renders newest first; an empty list doesn't crash the page.

### Unit 2 — The seen-marker

- Migration: `members.last_seen_whats_new text` (nullable — NULL means never
  looked, which is also every existing user).
- A `useHasUnseenWhatsNew()` hook comparing the newest entry's version against
  that column.
- Nav entry in `AppSidebar` + `AppDrawer` with the marker. **Both**, per the
  door-and-room rule — a marker on one surface only is how a thing gets missed
  on mobile.
- Opening the page writes the current version.
- Marker uses shape and text, never colour alone.
- Tests: unseen when NULL; unseen when the stored version is older; seen when
  equal; opening clears it.

### Unit 3 — Backfill the first entry

One entry describing what's actually live, written for players. Ships in the
same release as Units 1–2, so the page is never empty on arrival.

## Follow-ups (not in this plan)

- An in-app editor for entries, if maintaining a file ever becomes the
  bottleneck. It won't at this cadence.
- Emailing release notes. Different problem, different consent question.
