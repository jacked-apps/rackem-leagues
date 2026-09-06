---
title: "feat: Notification controls — a master switch, quiet hours, and per-type/per-chat vetoes"
type: feat
status: ready to build
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

Note this is **not** the same shape as the app's existing
`resolved_league_preferences` cascade, despite looking similar. That one is an
**override** cascade — a league setting replaces the org's, which replaces the
system default, and a lower level can set a value the level above didn't want.
Notifications work the opposite way: see "The model" below. Don't reach for the
resolved-preferences view as a template.

## The model

**Each level can only restrict further. No level can re-enable what one above
it turned off.** A notification is sent only when *every* level allows it —
they AND together.

```
Master switch          off → NOTHING notifies, full stop        (Settings)
   ↓ then
Quiet hours            inside the window → nothing notifies     (Settings)
   ↓ then
Per-type setting       "team chats: off"  → no team chat buzzes (Settings)
   ↓ then
Per-conversation       "this chat: off"   → this one stays quiet (in the chat)
                       "this chat: 20min" → quieter than the default, never louder
```

Ed, 2026-09-04, on why it works this way and not as overrides:

> *"the overall one is the master. if i turn off notifications set up quiet
> hours or whatever that means ALL of the messages do that. if i want to turn
> off notifications for all of them except one i can't use that and override the
> main — i have to turn the main on and turn the rest off. to me that is the
> only real way of doing this."*

So **"all off except one" is expressed as: master ON, then turn the others
off.** There is deliberately no way for a single chat to shout through a master
switch that is off, or through quiet hours.

The payoff is that "why didn't I get notified?" always has one answer: something
above it said no. An override model can't promise that — a master switch that
some chats ignore isn't a master switch.

Quiet hours in particular are a property of the person's day, not of any
conversation, so they're global and absolute. No per-chat exception.

### Where each control lives

| Setting | Level | Lives in |
|---|---|---|
| Push on/off for this device | Global | Settings → Notifications *(shipped)* |
| Quiet hours | Global | Settings → Notifications |
| Per-type default: on/off + interval | Per conversation kind | Settings → Notifications |
| This chat: off, or a LONGER interval | One conversation | The conversation's own menu |

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

- **Each level is a veto, not an override.** The resolver ANDs the levels
  together; it never lets a lower level re-enable something a higher one turned
  off. Concretely: `push_enabled AND NOT in_quiet_hours AND type_allows AND
  chat_allows`. This is the decision that shapes everything else, and it's
  worth stating in the SQL as a comment — the next person to read
  `get_push_recipients` will otherwise try to "fix" it into an override model.
- **`notification_mode` needs NO schema change.** An earlier revision of this
  plan called making it nullable "the one genuinely delicate change." That was
  wrong, and the veto rule is why: under an OVERRIDE model you must distinguish
  "explicitly all" from "unset", because either could win. Under a VETO model a
  chat can only subtract, so `'all'` and "unset" are the same thing — neither
  restricts. The check is simply `notification_mode <> 'none'`, which is
  effectively what `get_push_recipients` already does. No nullable migration, no
  backfill, no risk. (`'mentions'` also correctly blocks for now: with no
  @mention routing it can never fire, so treating it as a veto is honest.)
- **Per-type defaults get their own table**, not a JSONB blob on `members`:
  `member_notification_prefs(member_id, conversation_kind, push_enabled,
  interval_minutes)`. Mirrors `push_type_policy`'s shape, is queryable from
  `get_push_recipients` with a join, and adding a kind later is a row not a
  migration.
- **Resolution happens in SQL, in `get_push_recipients`.** It is already the one
  place that decides who gets a push; splitting the decision between SQL and the
  edge function would make "why was I not notified" unanswerable. With the
  veto model the whole thing is one boolean chain, which keeps it readable.
- **The interval resolves as `MAX(type_interval, chat_interval)`.** The veto
  rule applies to the number too: a chat can make itself quieter, never louder.
  Set 5 minutes against a 15-minute default and the effective value is still 15;
  set 20 and it's 20. Confirmed by Ed 2026-09-04: *"if the main is set for 15
  mins, if i set an individual to 5 it would still be 15 mins… if i changed it
  to 20 then it would be quieter longer."*
- **Intervals apply to GROUP chats only. A DM always buzzes.** (Ed, 2026-09-04:
  *"time out times should only apply to group chats."*) A DM is one person
  talking directly to you — holding those back would read as the app swallowing
  messages, not as restraint. The noise problem being solved here is many people
  in one room, which is a group-chat property.
  - `member_notification_prefs.interval_minutes` is NULL for `direct`, meaning
    no rate limiting, and the resolver skips the window check entirely for it.
  - The interval control is **not rendered** for a DM — neither in Settings nor
    in the conversation menu. An always-disabled input invites "why can't I set
    this?"; absence doesn't.
  - Everything else still applies to DMs: the master switch, quiet hours, and
    per-chat on/off all veto a DM normally.
- **Default interval: 5 minutes** for group kinds (Ed, 2026-09-04), not the
  brainstorm's 15. Stored per kind in `member_notification_prefs`, so it's
  tunable per person without a deploy.
- **The UI must not offer an interval below the current master.** This follows
  from the MAX rule and is the most likely place to look broken: pick "5 min" on
  a chat while your default is 15, nothing changes, and the app appears to have
  ignored you. Either hide the below-master options or state the effective value
  next to the control ("Your default is 15 min — this chat can only be quieter").
  Same applies to the on/off: a chat toggled ON while its type is OFF still gets
  nothing, and must say so rather than showing a cheerful enabled switch.
  **Ed 2026-09-04:** when a per-chat change is overruled by a higher level, show
  a toast pointing at the setting that actually governs it — e.g. "Team chats
  are muted in your notification settings. Change it there to hear this chat."
  Better than hiding the control: the person learns WHY, and where to go.
- **Rate limiting suppresses the NOTIFICATION, never the message.** Messages
  always land and always count toward the unread badge. Muting means "don't
  buzz me", not "hide it" — the badge is how a muted chat still gets noticed.
- **Two-state, not tri-state, for now.** The column keeps
  `('all','mentions','none')`; the UI offers On / Off. "Mentions only" stays
  unoffered until `@mention` routing exists — an option that silently behaves
  like Off is worse than no option.

## Open Questions

*(None outstanding. The remaining unknowns are things to learn from a real
league night — see Unit 4 — not decisions to make up front.)*
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

**Tests (DB, `src/__tests__/database/`):** every level vetoes independently; a
lower level can never re-enable a higher one; the interval resolves as MAX; a
DM is never rate-limited; first message notifies and a second inside the
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
