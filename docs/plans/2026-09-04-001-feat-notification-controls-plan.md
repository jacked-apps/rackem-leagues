---
title: "feat: Notification controls — global rules, per-type defaults, per-chat overrides"
type: feat
status: not started
date: 2026-09-04
origin: docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md (Phase 2 — Notification subsystem)
---

# feat: Notification Controls

## Overview

Web Push works end to end as of 2026-09-04: a message reaches a closed phone,
and a message in the conversation you're reading stays quiet. What's missing is
**restraint** — any way for a person to say "not this chat", "not ten times in
a row", or "not at 2am."

Ed's gate, stated 2026-09-04: *"i dont want notifications going thru until we
have some individual settings."*

Ed's shape for those settings, same day: *"there needs to be like an overall set
of rules (perhaps in settings) then a per chat type… quiet times needs to be an
overall thing not necessarily a per chat thing. and some should be default
settings. like group chats i get notified once for that conversation and then
not again for 15 minutes. then they can change that time in each chat to a
different number of minutes or turn them on or off."*

That is a **three-level cascade**, and the app already has one: the
`resolved_league_preferences` view resolves league → org → system default. This
plan applies the same pattern to notifications rather than inventing a second
one.

## The model

```
System default              "group chats: on, 15 min between buzzes"
   ↓ overridden by
Member's per-type default   "MY team chats: on, 30 min"       (Settings)
   ↓ overridden by
Per-conversation override   "THIS chat: off"                   (in the chat)
```

Plus one rule that deliberately does **not** cascade:

```
Quiet hours                 global only — one setting, applies to everything
```

Quiet hours are a property of the person's day, not of any conversation, so
offering them per-chat would be a worse product and more state to reason about.

### Where each control lives

| Setting | Level | Lives in |
|---|---|---|
| Push on/off for this device | Global | Settings → Notifications *(shipped)* |
| Quiet hours | Global | Settings → Notifications |
| Per-type default: on/off + interval | Per conversation kind | Settings → Notifications |
| Override: on/off + interval | One conversation | The conversation's own menu |

### A note on `push_type_policy`

There is already a `push_type_policy` table keyed by conversation kind. It is
**not** a user setting — it's the system-level phase switch deciding whether a
channel is live at all (today only `direct` is true). It sits ABOVE everything
in this plan: if the kind is off there, nobody gets a push regardless of their
preferences. Keep the two clearly separate; don't let member preferences write
to it.

## Current State (verified against the staging DB, 2026-09-04)

The origin brainstorm predates the implementation and lists as "to build"
several things that are done. Verified state:

**Working today:**

| Capability | Where |
|---|---|
| Global on/off per device | `members.push_enabled` + Settings toggle |
| System per-kind switch | `push_type_policy` |
| Suppress-if-viewing | `sw.ts` + URL sync (PR #261) |
| Block-aware fan-out, system messages excluded, profanity-safe previews | `get_push_recipients` + dispatcher |

**`push_type_policy` — only DMs push at all right now:**
`direct` = true; `team_chat`, `captains_chat`, `announcements`, `match_chat` =
false. The "loud phone" problem is not live; it begins when a row is flipped.

**`conversation_participants` today:**
- `notification_mode varchar NOT NULL DEFAULT 'all'` — CHECK `('all','mentions','none')`
- `get_push_recipients` **already filters on `notification_mode = 'all'`**
- Legacy `is_muted` / `notifications_enabled` columns still present; the Phase 1
  plan says drop them in a Phase 2 cleanup once nothing reads them — that's this
  work.

## Key Decisions

- **`notification_mode` must become nullable to express "inherit".** It's
  currently `NOT NULL DEFAULT 'all'`, so every row asserts a value and there is
  no way to say "follow my default for this kind." Migration makes it nullable
  with NULL = inherit; existing `'all'` rows are backfilled to NULL so today's
  rows don't silently become permanent overrides. **This is the one genuinely
  delicate schema change in the plan** — done wrong, every existing participant
  becomes pinned to "always notify" and the new per-type defaults do nothing.
- **Per-type defaults get their own table**, not a JSONB blob on `members`:
  `member_notification_prefs(member_id, conversation_kind, push_enabled,
  interval_minutes)`. Mirrors `push_type_policy`'s shape, is queryable from
  `get_push_recipients` with a join, and adding a kind later is a row not a
  migration.
- **Resolution happens in SQL, in `get_push_recipients`.** It's already the one
  place that decides who gets a push; splitting the decision between SQL and the
  edge function would make "why didn't I get notified" unanswerable.
- **Rate limiting suppresses the NOTIFICATION, never the message.** Messages
  always land and always count toward the unread badge. Muting means "don't
  buzz me", not "hide it" — the badge is how a muted chat still gets noticed.
- **Two-state, not tri-state, for now.** The column keeps
  `('all','mentions','none')`; the UI offers On / Off. "Mentions only" stays
  unoffered until `@mention` routing exists — an option that silently behaves
  like Off is worse than no option.

## Open Questions

- **Default interval per kind.** The brainstorm says 15 minutes; Ed's example
  also says 15 for group chats. Untested against a real league night. Should
  DMs have an interval at all, or always buzz? A DM is a person talking directly
  to you — suggest DMs default to no interval, group kinds to 15 minutes.
- **Quiet hours needs a timezone.** Storing "22:00–07:00" is meaningless without
  knowing whose clock. Simplest: a per-member IANA timezone captured from the
  browser. The venue/org timezone columns the brainstorm mentions are Phase 3
  and are the wrong unit here anyway — quiet hours belong to the person.
- **Does a quiet-hours message notify later, or never?** Suggest never — it's
  already in the app with an unread badge when they wake up. A queue that fires
  at 7am is a second system to build and a nasty surprise.
- **Interval granularity in the UI.** A free-text minutes box invites "1" and
  "9999". Suggest a small preset list (Every message / 15 min / 30 min / 1 hr /
  Off) with the stored value still an integer, so a custom value remains
  possible later without a migration.

## Implementation Units

### Unit 1 — Schema + resolver

**Goal:** the cascade exists and the dispatcher honours it. No UI yet.

- Migration: `member_notification_prefs` table; `notification_mode` → nullable
  with the backfill described above; `notification_interval_minutes` (nullable)
  on `conversation_participants`; `last_notified_at` on
  `conversation_participants`; quiet-hours + timezone columns on `members`.
- Rewrite `get_push_recipients` to resolve conversation override → member type
  default → system default, apply the interval window, and drop anyone inside
  quiet hours.
- Dispatcher stamps `last_notified_at` after a **successful** send, so a failed
  send doesn't open a quiet period.
- Drop legacy `is_muted` / `notifications_enabled` once nothing reads them.

**Tests (DB, `src/__tests__/database/`):** each cascade level wins over the one
above it; NULL means inherit; first message notifies and a second inside the
window doesn't; the window is per conversation; quiet hours suppress; the
message and unread count are unaffected in every case.

### Unit 2 — Global settings UI

Settings → Notifications gains quiet hours (on/off + a start/end time) and a
per-kind default list (on/off + interval preset per conversation kind). Only
kinds live in `push_type_policy` are shown — no point offering a default for a
channel that can't push.

### Unit 3 — Per-chat override UI

A control in the conversation's own menu (alongside Leave / Block) — notify
on/off plus an interval, defaulting to "Use my default (30 min)" so the
inherited value is visible rather than implied. Muted state must also be visible
in the conversation list, by icon **plus** text, never colour alone
([[user-colorblind]]). Optimistic like `LmsEnteredCheckbox` — a mute that looks
like it didn't work gets tapped repeatedly.

### Unit 4 — Turn on `team_chat` (decision, not code)

With 1–3 on staging, flip `push_type_policy.team_chat` to `true` **on staging
only** and live through a real league night before touching production. That is
the actual test of whether the restraint is enough.

## Follow-ups (not in this plan)

- "Mentions only" + `@mention` routing
- Global pause with a duration picker (`notifications_paused_until`)
- Permission-denial UX (denied / unsupported / iOS-needs-install banner)
- `push_subscriptions` RLS — currently open; see `PRE_LAUNCH_CHECKLIST.md`
