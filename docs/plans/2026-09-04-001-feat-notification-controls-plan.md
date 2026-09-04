---
title: "feat: Notification controls — per-chat mute + rate limiting (the gate on turning team chats on)"
type: feat
status: not started
date: 2026-09-04
origin: docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md (Phase 2 — Notification subsystem)
---

# feat: Notification Controls

## Overview

Web Push works end to end as of 2026-09-04: a message reaches a closed phone,
and a message in the conversation you're reading stays quiet. What's missing is
**restraint** — any way for a person to say "not this chat" or "not ten times in
a row."

Ed's gate, stated 2026-09-04: *"i dont want notifications going thru until we
have some individual settings."* This plan is that gate.

## Problem Frame

The v1 pipeline is deliberately all-or-nothing per person: a member either
receives every push the policy allows, or turns push off entirely on that
device. There is no middle setting. That's tolerable while only DMs push, and
becomes the "loud phone" problem the moment a group conversation does.

**Two mechanisms, and they solve different halves:**

- **Mute is opt-out.** It protects the person who thinks to go and set it, on
  the chat they already know is noisy. It does nothing for a first-time
  experience.
- **Rate limiting is default-on.** It protects everyone, including the player
  who never opens settings, on the very first busy night. A ten-message burst
  becomes one buzz.

Both matter, but rate limiting is what actually makes a team chat safe to turn
on. Mute is what makes it *tolerable to the individual who disagrees with the
default*.

## Current State (verified against the staging DB, 2026-09-04)

This section exists because the origin brainstorm predates the implementation
and describes several things as "to build" that are already done.

**Working today:**

| Capability | Where | State |
|---|---|---|
| Global on/off per device | `PushNotificationSetting` → `members.push_enabled` | Shipped |
| Per-conversation-kind switch | `push_type_policy` table | Shipped — a row flip, no code |
| Suppress-if-viewing | `sw.ts` + URL sync | Shipped 2026-09-04 (PR #261) |
| Block-aware fan-out | `get_push_recipients` | Shipped |
| System messages excluded | `get_push_recipients` | Shipped |
| Profanity-safe previews | dispatcher | Shipped |

**`push_type_policy` right now — only DMs push at all:**

| `conversation_kind` | `push_enabled` |
|---|---|
| `direct` | **true** |
| `team_chat` | false |
| `captains_chat` | false |
| `announcements` | false |
| `match_chat` | false |

**The important find:** `get_push_recipients` already filters on
`cp.notification_mode = 'all'`. The tri-state column exists on every
participant row and the dispatcher already honours it. **Per-chat mute is
UI-only work** — no migration, no dispatcher change. Setting a participant to
`'none'` today would already stop their pushes; nothing can set it.

## Scope

**In:**
1. Per-chat mute UI (two-state)
2. Server-side rate limiting

**Out (each its own later unit):**
- The "Mentions only" third state — meaningless until `@mention` routing exists
- Global pause with a duration picker (`notifications_paused_until`, no column yet)
- Quiet hours 10pm–7am — needs the timezone columns deferred to Phase 3
- Permission-denial UX (denied / unsupported / iOS-needs-install banner)
- Actually flipping `team_chat` on — a decision, not code, and the point of this work

## Key Decisions

- **Two-state, not tri-state, for now.** The column is
  `('all','mentions','none')` and stays that way; the UI offers On / Mute and
  writes `'all'` / `'none'`. Shipping a "Mentions only" option that silently
  behaves like Mute would be worse than not offering it. See
  [[feedback-dont-promise-unshipped]].
- **Rate limit is server-side, in the dispatcher.** It has to hold for a person
  who never opens the app; a client-side window can't do that.
- **Rate limiting suppresses the NOTIFICATION, never the message.** The message
  always lands in the conversation and always counts toward the unread badge.
- **Unread badges are unaffected by mute.** Muting a chat means "don't buzz me",
  not "hide it". The badge is how a muted chat still gets noticed.

## Open Questions

- **Rate-limit window length.** The brainstorm says 15 minutes idle. Untested
  against a real league night — a 15-minute window on a match-night chat might
  be so aggressive that important messages go unannounced. Suggest shipping 15
  and treating it as tunable (a config row, not a constant).
- **Does the first message after a quiet period always notify?** Assumed yes —
  the window is "idle since last notification", so the first message after 15
  quiet minutes buzzes. Worth confirming that's the felt behaviour.
- **Where does per-chat mute live in the UI?** Inside the conversation (a
  header menu item) is the natural place — you mute the chat you're annoyed by,
  while you're in it. The Messages settings modal is the alternative but puts
  the control far from the thing it controls.

## Implementation Units

### Unit 1 — Per-chat mute UI

**Goal:** a member can silence one conversation, from inside it.

- Read the current `notification_mode` for `(conversation, me)`.
- A control in `ConversationHeader`'s existing menu (it already hosts Leave /
  Block) — "Mute notifications" / "Unmute", writing `'none'` / `'all'`.
- Muted state must be visible in the conversation list too, so a muted chat is
  identifiable without opening it. Icon **plus** text or a label — never colour
  alone ([[user-colorblind]]).
- Optimistic, like `LmsEnteredCheckbox`: flip immediately, roll back on failure.
  A mute that appears not to have worked will be tapped repeatedly.

**No migration.** Column and dispatcher filter already exist.

**Tests:** mute writes `'none'`; unmute writes `'all'`; the list reflects muted
state; rollback on failure; a muted conversation still increments unread.

**Verify on staging:** mute a DM on the phone, have the other account send —
message arrives, no buzz. Unmute, send again — buzz returns.

### Unit 2 — Rate limiting

**Goal:** a burst of messages in one conversation produces one notification.

- Track `last_notified_at` per `(conversation_id, member_id)`. Natural home is a
  column on `conversation_participants` — the row already exists for every
  member of every conversation, so no new table and no lifecycle to manage.
- `get_push_recipients` gains the window check: exclude a recipient whose
  `last_notified_at` is within the window.
- The dispatcher stamps `last_notified_at` for the recipients it actually sent
  to — after a successful send, so a failed send doesn't start a quiet period.
- Window length in a config row, not a constant, so it's tunable without a
  deploy (mirrors `push_dispatch_config`).

**Migration:** additive column + the recipient-function change.

**Tests (DB, `src/__tests__/database/`):** first message notifies; a second
inside the window does not; one after the window does; the window is per
conversation (a DM still notifies while a team chat is inside its window); the
message and unread count are unaffected in every case.

**Verify on staging:** send five messages in ten seconds to a phone with the app
closed — one buzz, five messages visible on open.

### Unit 3 — Turn on `team_chat` (decision, not code)

Once 1 and 2 are on staging and verified, flip `push_type_policy.team_chat` to
`true` **on staging only** and live with it for a real league night before
touching production. This is the actual test of whether the restraint is enough.

## Follow-ups (not in this plan)

- "Mentions only" + `@mention` routing
- Global pause with duration picker
- Quiet hours
- Permission-denial UX
- `push_subscriptions` RLS — currently open; see `PRE_LAUNCH_CHECKLIST.md`
