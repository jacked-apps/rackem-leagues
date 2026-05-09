# Messaging System Overhaul — Requirements

**Date:** 2026-04-21
**Branch:** `messaging-system-overhaul`
**Status:** Requirements captured, reviewed (7 personas, 1 refinement pass). Refined 2026-05-09 — quiet-hours bypass for live matches, notification pause picker, image-attachment contradiction removed. Ready for planning.

---

## 1. Overview

### Problem

The current messaging system is functionally a chat MVP — DMs and manual group chats with Supabase realtime, unread badges, and read receipts — but it feels clunky and is not pulling its weight as the **social layer** of the league. Critical pieces are either half-built or unbuilt:

- Auto-created team chats and captain/LO chats exist in the schema but aren't wired to season activation.
- The profanity filter exists as a utility but is effectively inert on messages.
- Notification infrastructure is limited to badges + toasts; the `notifications_enabled` column on participants is read by nothing.
- No push notifications, no rate-limiting, no mention system, no reactions, no match-context awareness.

Without this overhaul, captains default to SMS/Facebook for night-of match coordination and the app becomes a schedule-viewer rather than the hub of league activity.

### Scope

**Full social-layer rebuild.** Ship in phases, each independently useful, so scope pressure trims *depth within a phase* rather than cutting whole features.

### Non-goals

- **Email notifications** (transactional or digest) — explicitly excluded.
- **Org-enforced profanity filtering** — deferred; user wants to discuss separately.
- **Age-based profanity enforcement** — platform no longer collects DOB; revisit if/when DOB returns.
- **Video attachments** — out of scope.
- **In-chat voice/video calls** — out of scope.

---

## 2. What exists today (verified against codebase)

| Surface | State |
|---|---|
| DMs (1-on-1) | Working, realtime |
| Manual group chats | Working, realtime |
| `conversations`, `messages`, `conversation_participants`, `blocked_users`, `user_reports` tables | All present with appropriate columns |
| `conversation_type` column on `conversations` (VARCHAR with CHECK constraint `IN ('direct','team_chat','captains_chat','announcements')`; **not** a Postgres ENUM) | Present; team/captains/announcements values unused |
| `auto_managed`, `scope_type`, `scope_id` columns on conversations | Present, unused. `scope_type` enum: `team | season | organization | none` |
| `conversations.archived_at` / `status` / `is_archived` | **Missing — needs to be added in Phase 1** to support season-end and match-night archival |
| DB functions for auto-creating team/captain/announcement chats | Exist in `database/messaging/` but no trigger calls them; all are SECURITY DEFINER and reference the CHECK constraint |
| `conversation_participants.notifications_enabled` (BOOLEAN NOT NULL), `is_muted` (BOOLEAN) | Present, read by nothing; boolean, not tri-state |
| Per-user profanity flag | `members.profanity_filter_enabled` already exists (from `database/messaging/add_profanity_filter_columns.sql`). Legacy `organizations.profanity_filter_enabled` (default TRUE) and `league_operators.profanity_filter_enabled` also exist but are dormant — org-level enforcement is a non-goal for this overhaul |
| League / venue / organization timezone column | **Missing** — no `timezone` column on `leagues`, `venues`, or `organizations`. Required prerequisite for any match-day-midnight logic (see Phase 4 prereqs) |
| `user_reports` schema | **Duplicated across `database/messaging/user_reports.sql` and `database/reporting/user_reports.sql` with different categories and status enums. Needs reconciliation before report-flow UI work (Phase 5 prereq)** |
| Read receipts (✓/✓✓), unread counts, edit/delete windows | Working |
| Blocking, muting (backend logic) | Working; muting UI present |
| Profanity utility (`src/utils/profanityFilter.ts`) | Wraps `@2toad/profanity`; only wired to team-name validation |
| Toast notifications (`sonner`) | Working for confirmations |
| Unread badge in navbar | Working |
| Push notifications | None |
| Reports (backend) | `user_reports` scaffolded; no UI |
| Reactions, mentions, pinned, typing indicators, threads | None |

Reference: `memory-bank/messagingSystemProgress.md` tracks prior phase work.

---

## 3. Goals & success criteria

**Goals**

1. **Auto-create the conversations leagues need** — team chats, captain chats, match-night chats, announcements — without operator intervention.
2. **Give users real notification control** — per-chat on/off, global toggle, rate-limited so group chats don't inundate, with `@mentions` as a pressure valve.
3. **Make profanity filtering actually work** as a user-controlled display filter.
4. **Close the "aliveness" gap** — reactions, @mentions, typing indicators, pinned messages, threads.
5. **Treat messaging as the hub of match coordination**, not a side feature.
6. **Give staff oversight without inbox clutter or notification spam.**

**Success looks like**

- Captains can open the app on match night and find a working group chat with their team without anyone setting anything up.
- A user in 3 team chats + 2 group DMs does not get a phone notification for every message — mentions and the first message after quiet time break through; follow-up chatter in muted or active conversations does not.
- LOs can oversee any team chat in their org without those chats cluttering their personal Messages list.
- A user can turn on profanity filtering once and never see a four-letter word in the app again (on their device), while senders type whatever they want.

**Primary success metric (measurable):**

- **Share of active matches with ≥1 chat message on match day** — directly observable in the database. Baseline will be ~0% before Phase 3 launches (match-night chats don't exist yet). Target: ≥40% of matches generate chat activity by end of first season after Phase 3 ships.
- Secondary: weekly active captains in team chats ≥ 50% of captain population after Phase 1 ships.
- Post-season survey: "Where did your team coordinate match night?" — with % selecting Rackem as directional confirmation.

The earlier "50% of coordination happens in Rackem" goal is replaced — the app cannot observe SMS/Facebook, so that metric was unmeasurable. The replacement proxies are all app-observable.

---

## 4. Decisions captured (from brainstorm)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Season-scoped auto-chats** — team and captain chats are created on season activation and archived at season end. New season = new chat. | Pool league rosters and captains churn between seasons. Clean slate each season matches how the business actually works. Archive is read-only and discoverable. |
| D2 | **All staff (owner/admin/league_rep) treated identically** for chat permissions. | Simplifies model; no reason to distinguish tiers for messaging. |
| D3 | **Staff use an Operator View** separate from their primary Messages inbox. | Staff would be auto-members of every team/captain/announcement chat in their org, which would drown their real inbox. Operator View is a dedicated section where they can browse org chats on demand. |
| D4 | **Staff receive no notifications for routine chat activity** in team/captain/announcement chats. | Same reason — inbox/notification spam. Staff opt in to attention via the `@staff` tag. |
| D5 | **`@staff` tag is scoped to the staff assigned to the chat's league**, not org-wide. | Avoids paging all 10 admins across an org for one league's issue. |
| D6 | **Captains cannot leave or mute the captain chat**; staff can. | Captain chat is how the LO broadcasts to captains — leaving it means missing critical info. Staff leaving reduces staff overwhelm without degrading league comms. |
| D7 | **Profanity filter is per-user display filter only.** Messages always save as original text. Sender always sees their own words. Filtered viewers see asterisks. | Respects adult bar-league culture; no org enforcement right now; no minors flow (no DOB). User may revisit org-enforcement later. |
| D8 | **Onboarding prompt on first Messages open** — asks about notifications and profanity filter together. Both discoverable in settings afterward. | Lower-friction than a settings scavenger hunt. |
| D9 | **Notification delivery: in-app + push (web + mobile).** No email (digest or transactional). | Keeps scope tight. Push is the critical channel for "I'm not in the app right now." |
| D10 | **Match-night chats include full rosters of both teams.** | Captains alone may be absent or on vacation; scorekeepers aren't identified in data. Full rosters ensures someone relevant is always in the chat. |
| D11 | **Match-night chat captains cannot mute/leave it; other players can.** | Captains are accountable for match-night coordination. Other players can opt out per-match if they want to. |
| D12 | **Match-night chats are created at 00:00 local league time on match day**, not when the match is originally scheduled (which can be weeks ahead during season schedule generation). | Avoids dozens of empty chats sitting in everyone's inbox for weeks. Creation is silent (no notification). |
| D13 | **Match-night chats archive 1 hour after match completion** (score submitted). Forfeits archive 1hr after forfeit recorded. Cancellations archive immediately with a system message. | Gives a brief window for "good game" exchanges and quick dispute clarification without lingering. *(Revised 2026-05-09 from original 2-hour window — user feedback that 2hr was longer than needed.)* |
| D14 | **Global per-user opt-out: "Don't include me in match chats."** If enabled, the user is never added to any match-night chat for their team. | Lets users beg off the whole match-chat experience. Captains can opt out too, with the caveat that they then have no match-night coordination surface (flagged in settings UI). |
| D15 | **All four feature themes in scope** (social polish, match-context, notification sophistication, moderation completion). Phase depth, not features. Watch for diminishing returns. | User directive. |
| D16 | **Risk-first phasing.** Validate the hypothesis "captains will use Rackem chat over SMS" at Phase 3 (match-night chats) before investing in Phase 4/5 polish. A measurable gate separates Phase 3 from Phase 4. | Four reviewers independently flagged that shipping polish before the hypothesis is tested is inverted risk. User invited expertise-based phasing decision. |
| D17 | **Quiet hours are hardcoded 10pm–7am local (no user UI initially).** Reconsider user-tunable controls post-launch if users request it. | Scope discipline. The UI surface (time pickers, day selectors, per-user timezone storage) is dispensable complexity for the MVP of this feature. |
| D18 | **`@staff` tag cut from this overhaul.** Staff are mentioned individually by username via the standard `@mention` autocomplete. The scoped-group-alias pattern is deferred to post-launch if captains request it. | `@staff` is a parallel mention-routing abstraction that `@mentions` + observer role already cover. Captains usually know their LO personally. Defers an entire rate-limit/audit subsystem. |
| D19 | **Image attachments cut entirely from this overhaul.** Defer to a separate post-launch brainstorm. | No stated goal required images. Shipping them means: Supabase Storage policies, client-side compression, scoped URLs, viewer UI, report-flow integration, retention policy — a lot of moderation surface for a feature that isn't load-bearing for the social-layer hypothesis. |
| D20 | **Thread replies cut entirely from this overhaul.** | Self-described as "defer if pressure" in the original doc — signals it isn't load-bearing. Reactions + mentions + pinned cover the conversational-clarity use cases. |
| D21 | **Match rich cards cut.** A plain-text link to the match page meets the navigational goal at zero schema/component cost. | Reviewer consensus: nice-to-have abstraction that doesn't serve a stated goal. |
| D22 | **Operator View oversight is transparent, not opaque.** When staff have read access to a team chat, a visible banner reads "LO can view this chat" and staff appear in the member list (e.g., as "Observer"). | Bar-league culture is informal and everyone knows the LO. Invisible oversight would be a trust-breaking choice. Transparent oversight is also simpler to implement (single `conversation_participants.role = 'observer'` flag gates both RLS and UI). |
| D23 | **Past-member representation uses `conversation_participants.left_at` timestamp** (column already exists). RLS allows SELECT on messages where `inserted_at <= left_at`; INSERT is blocked. UI shows a "Past member — read only" banner replacing the composer. | Simplest schema change (none), explicit time-boundary for RLS, reuses existing column. |
| D24 | **Captain lifecycle:** captaincy transfer sets old captain's `left_at` (becomes past member), adds new captain as active with cannot-leave flag. Captain account deletion preserves participant row with `left_at`. Captain suspension follows the same flow. | Prevents ghost members and orphan locks. Aligns with D23 past-member model. |
| D25 | **Multi-team player support:** one `conversation_participants` row per `(conversation_id, user_id)` — naturally dedups. A player on teams A and B has two team-chat memberships; if both play the same night they have two match-chat memberships. Accepted as design. | Simpler than cross-team chat dedup logic. Each chat is its own context. |
| D26 | **Quiet-hours bypass for live matches** *(added 2026-05-09)* — for any user whose team has an active match, push notifications from their match chat, team chat, and captain chat bypass the hardcoded 10pm–7am quiet hours. Other users are unaffected. Per-user, scoped to that user's own team's match. | Pool league nights regularly run past 10pm — sometimes past midnight. Suppressing match-coordination pings during the actual match defeats messaging's whole purpose. Per-user scoping ensures captains whose own team isn't playing tonight don't get pinged for other captains' matches (cross-cutting needs are covered by `@mention`, which always bypasses). |
| D27 | **Bypass cutoff timing** *(added 2026-05-09)* — match chat: bypass active until the chat archives (1hr post-match per revised D13). Team chat & captain chat: bypass ends the moment the user's match completes (no grace period; chats stay alive but resume normal quiet-hours behavior immediately). | Match chat is the active match-coordination surface and stays warm for 1hr post-match for cleanup chatter; team and captain chats are season-long surfaces and should snap back to normal as soon as the match is done so users aren't woken at midnight by routine team chatter. |
| D28 | **Notification pause feature** *(added 2026-05-09)* — extends the existing global "all notifications off" toggle into a duration picker: 1 hour, until tomorrow morning (7am local), until a chosen date, or until manually re-enabled. Pause overrides everything: per-chat tri-state, mentions, and live-match bypass. | Covers vacation mode, "I'm not at the pool hall tonight," and other temporary opt-outs without forcing per-chat micromanagement. Small UI surface on top of the toggle that already exists in spec. |

---

## 5. Feature requirements by theme

### 5.1 Stated wishlist (baseline — required)

#### Team chats (auto-created)

- One chat per team per season, `conversation_type = 'team_chat'`, `auto_managed = true`, `scope_type = 'team'`, `scope_id = teams.id`.
- Members: everyone on the team's roster (captain + all players). All can read and send.
- Created on **season activation** (the operator workflow that turns a draft season into an active one).
- Archived on **season end** (read-only, surfaced in an "Archived" tab/filter).
- Mid-season roster changes:
  - Player **added** to team → auto-added to chat with a system message ("Sally joined the team").
  - Player **removed** from team → moved to "past members" (can still read history but cannot send; no notifications). System message posted.
  - Player **transferred** to different team → removed from old chat (past-member read), added to new.

#### Captains chat (auto-created, season-scoped)

- One per league per season, `conversation_type = 'captains_chat'`, `auto_managed = true`, `scope_type = 'season'`, `scope_id = seasons.id`.
- Members:
  - **All team captains for that league's season** — required members, cannot leave or mute.
  - **All staff of the org** — auto-added but can leave; also have silent Operator View access regardless of membership (see §5.5).
- Mid-season captain changes:
  - Captaincy transferred → old captain moved to past-member, new captain auto-added.

#### Announcements

- One per season ("Season Announcements") and one per organization ("Organization Announcements"), `conversation_type = 'announcements'`, `auto_managed = true`.
- **Read-only replies for players.** Players can react with emoji but cannot post new messages or reply. Reactions are an explicit carve-out from the read-only rule.
- `@mentions` in announcements are staff-authored only (players cannot author mentions here). A staff → player mention notifies the mentioned player and does not open a reply thread. Reactions in announcements go through the normal report flow just like any other message.
- Only LO / staff can post. (Existing `AnnouncementModal` already handles composition.)
- Players can mute individual announcement channels but cannot leave.
- Staff oversight model applies (Operator View, see §5.5).

#### Profanity filter (display-time only)

- `members.profanity_filter_enabled` is the single source of truth per user. (The legacy `organizations.profanity_filter_enabled` and `league_operators.profanity_filter_enabled` columns remain dormant — org-enforcement is a non-goal.)
- Applied at render time on **every surface that renders message text**:
  - `MessageBubble` (message body)
  - Conversation list last-message preview
  - Push notification body (see §5.5 open questions — per-recipient server-side filtering required since push payloads are assembled server-side)
  - Message search results
  - System messages (e.g., "Sally joined the team") — filtered if they contain usernames/team names with profanity
- Sender sees their own messages unmodified, always.
- Database stores original text, always.
- **Note:** profanity filter is a display convenience, not a content guarantee. Raw text is observable via network inspection and push payloads (pre-filtering). If org-enforcement is ever re-scoped, server-side transformation is required.
- Toggle in Messages settings modal (already exists — extend).
- First-open prompt covers this (§5.2 onboarding).

#### Notifications — per-chat and global controls

- Every chat has **Notify / Mentions only / Mute** setting per user.
- **Schema change required:** add a new `notification_mode VARCHAR NOT NULL DEFAULT 'all' CHECK (notification_mode IN ('all','mentions','none'))` column on `conversation_participants`. Data-migrate from existing `is_muted` / `notifications_enabled`: `is_muted = TRUE` → `'none'`; otherwise `'all'`. Decide during Phase 2 planning whether `is_muted` is retired or kept as a derived flag. Regenerate `src/types/database.types.ts`.
- Global toggle: "All notifications off" — overrides per-chat settings when on.
- **Rate limit for group chats** (team, captains, match, group DMs):
  - Default behavior: first message after 15+ minutes of inactivity → notify. Subsequent messages within 15 min → silent. Reset after 15 min idle.
  - Exception: `@mention` or `@staff` tag always notifies (respects global off).
  - Direct messages (1-on-1) always notify (no rate limit).
- Quiet hours (global, default 10pm–7am local, hardcoded for v1 per D17): no push notifications during window; in-app tray still accumulates. Bypass rules:
  - `@mentions` always bypass (existing behavior).
  - **Live-match bypass (D26/D27):** if the user's own team has an active match (chat-creation through chat-archive window), push from their match chat, team chat, and captain chat bypass quiet hours. Cutoff: match chat = chat-archive (1hr post-match per D13); team/captain chat = match completion.
  - **Notification pause (D28):** when the user has paused notifications via the global toggle's duration picker (1hr / until 7am / until chosen date / until manually re-enabled), pause overrides *everything* — per-chat settings, mentions, and live-match bypass.

### 5.2 Onboarding prompt (first Messages open)

A one-time modal on first Messages-tab open per user:

1. **Enable push notifications?** (browser/mobile permission prompt → flip toggle in prefs)
2. **Filter profanity in messages?** (user-level toggle, default off)

Both are immediately editable in Messages settings. If dismissed without choosing, defaults are: notifications prompt re-shown on next open; profanity default off.

### 5.3 Social polish (theme A)

- **@mentions** — `@Username` autocomplete in composer. Autocomplete triggers on `@` keystroke, scoped to current chat members (not org-wide — prevents user enumeration), shows up to 8 results filtered by partial name, selected via Enter or tap, renders as a highlighted pill in the bubble. Mentioned users always notified regardless of mute/rate-limit/quiet-hours. Mention metadata stored in a separate `message_mentions` table keyed by `(message_id, mentioned_user_id)` — **not** embedded as raw text markers in the message body (avoids injection + enumeration risk).
- **Message reactions** — emoji reactions on any message (tap a message → emoji picker → reaction). No special moderation.
- **Typing indicators** — "John is typing…" below the composer; uses Supabase realtime presence. Multi-user behavior: show up to 2 names ("John and Maria are typing…"); beyond 2, collapse to "Several people are typing…"
- **Pinned messages** — captain can pin one message in team chats; captains + staff can pin in captain chats; LO can pin in announcements. One pin per chat to start (keep simple).
- **Failed-send error state** — when a message fails to send (network error, RLS rejection, rate limit hit), the bubble displays a failed indicator with a retry action. The failed message stays in place (not lost), and the composer text is preserved until successful send.
- **Thread replies** — reply-to-message creates a lightweight thread view. Defer to Phase 3 if scope pressure hits; reactions + mentions + pinned are the highest-value social-polish items.

### 5.4 Match-context chats (theme B)

- Auto-create `conversation_type = 'match_chat'`. **This requires a CHECK-constraint change, not an enum migration** — drop and recreate `conversations_conversation_type_check` with the new value, and verify each downstream SECURITY DEFINER function in `database/messaging/` (create_conversation_function.sql, create_announcement_conversation_function.sql, etc.) still matches. Consider migrating `conversation_type` to a real Postgres ENUM at the same time for future additions.
- Creation trigger runs at midnight local league time on match day — see §5.5 open questions for scheduler mechanism (pg_cron vs Supabase scheduled Edge Function).
- Members: full rosters of both teams (respecting D14 global opt-out).
- **Captains are force-members and cannot mute or leave the match chat.** Other players may mute and/or leave per-match (per D11).
- Archive 1 hour post match completion / forfeit / immediately on cancellation (per revised D13). For matches that never reach a completion/forfeit state (stuck in dispute, never scored): archive at end-of-match-day + 24 hours via the same scheduler that handles creation.
- **Match rich cards in chat** — when a match is referenced in any chat (e.g., captains chat), a card renders showing the two teams, date, venue, and tap-through to match page. Implemented as a content-type alongside text. Nice-to-have; defer if scope pressure.

### 5.5 Staff oversight (decided: transparent observer model)

Per D22 and D18, the staff oversight model is:

- **Observer role on `conversation_participants`** — staff are added to every team chat and announcement channel in their org with `role = 'observer'`. RLS allows SELECT for observers; INSERT is gated.
- **Transparent visibility** — a banner in each staff-observed chat reads "League staff can view this chat" so players know oversight is active. Staff appear in the member list as "Observer."
- **Inbox filter** — the primary conversation-list query filters OUT rows where the user's role is `observer`, so staff's personal Messages list stays clean. Observer chats are visible only in a dedicated "Operator View" surface.
- **No notifications for routine activity** — observer rows have `notification_mode = 'none'` by default and get no push notifications for regular messages.
- **Captain chat is different:** staff are **active participants** (`role = 'participant'`), not observers. They receive notifications and can post. They can still leave the captain chat if desired (per D6); they retain observer access to all team chats regardless.
- **`@staff` tag is cut** (per D18). Staff are mentioned individually by username. Observer rows are exposed in `@mention` autocomplete when staff are relevant participants.
- **Operator View UI ships in Phase 5**, not Phase 3. The inbox-filter logic (which does the bulk of the work in keeping staff inboxes clean) ships in Phase 1.

### 5.5.1 Operator View UI (Phase 5)

- Dedicated section in the left sidebar below personal chats, labeled "Operator View" (collapsible).
- Organized hierarchically: league → season → (team chats / captain chat / announcements).
- Each row shows chat name, last-message timestamp, an unread-count badge for `@mentions` of the staff member (regular messages don't count — observer mode).
- Tapping a chat opens it in the standard MessageView, with the "observing" banner, and a composer that's disabled for team/announcement chats (captain chat composer stays enabled since staff are active there).
- Archived chats from prior seasons appear grouped under each season header with a "past" indicator.

### 5.6 Past-member & captain lifecycle (Phase 1)

- **Past members** use `conversation_participants.left_at` (existing column). When a roster player is removed:
  - Their row's `left_at` is set to the removal timestamp.
  - RLS: past members retain SELECT on `messages` where `inserted_at <= left_at`; no SELECT access to messages after their departure.
  - INSERT is blocked (trigger on `conversation_participants` with `left_at IS NOT NULL`).
  - UI: in the past member's conversation list, the chat appears in the "Archived" section with a "Past member — read only" banner replacing the composer.
  - A system message is posted in the chat: "Sally left the team."
- **Captaincy transfer** (mid-season): old captain's `left_at` set (they become past member of captain chat, still active on team roster). New captain added to captain chat as active with cannot-leave flag.
- **Captain account deletion / suspension:** the participant row stays with `left_at` set — preserves chat history integrity. No ghost members.
- **Multi-team players:** one participant row per `(conversation_id, user_id)`. Dual memberships are allowed and represent separate contexts (e.g., two team chats, possibly two match-chats on the same night).
- **D14 opt-out (match chats) + promotion:** if a player with global opt-out is promoted to captain, the UI warns them at promotion time that the opt-out conflicts with captain match-chat lock; they must either un-opt-out or decline the captaincy.

### 5.7 Moderation completion (Phase 5)

- **Report flow UI** — "Report user" action on any message (overflow menu). Uses existing `user_reports` table (see §2 note: the two conflicting schemas in `database/messaging/` and `database/reporting/` must be reconciled as a Phase 5 prerequisite).
  - Flow: tap report → select reason (harassment / spam / offensive content / other) → optional free-text → confirmation ("Report submitted — we'll review within 48 hours") → no further reporter notification unless staff contacts them. Reported messages are **not** visually flagged to the reporter.
- **Operator review queue** — a dedicated moderation page for staff, scoped by role:
  - `league_rep` → sees reports for messages in chats within leagues they're assigned to.
  - `admin` / `owner` → sees reports across the entire org.
  - Actions: dismiss, delete message, warn user (sends a system DM), block user (scoped to league for league_rep; org-wide for admin/owner with explicit confirmation).
  - Every action writes to a `moderation_audit_log` table (actor, timestamp, target, action, optional reason). Tamper-evident via append-only writes; no UPDATE or DELETE RLS permission for non-service-role.
- **Block/unblock discoverability** — tap a sender's name on a message → menu with Block / Report / View Profile. Uses existing `blocked_users` logic.
- **Image attachments: CUT from this overhaul** (D19). Deferred to a separate post-launch brainstorm.

---

## 6. UX direction & "slick"

Brainstorm surfaced that "slick" is subjective. Proposed default direction (override-able):

- **iMessage/WhatsApp-style conversation list + thread view** — matches existing component structure (`ConversationList`, `MessageView`, `MessageBubble`). Keep.
- **Discord-style presence density** — typing indicators, subtle animations, reactions on hover.
- **Slack-style notification granularity** — per-channel Notify/Mentions only/Mute tri-state.
- **Clean, roomy composer** — autocomplete for mentions, emoji picker, attachment button.
- **Folder/filter UI for staff Operator View** — not a separate app, just a collapsible section below the user's normal chats.

Revisit if user wants a different feel (e.g., more game-like, or more utilitarian).

---

## 7. Defaults & assumptions (confirm or override)

1. Mid-season roster changes auto-update team chat membership (add on join, past-member-read on drop).
2. Rate limit: 15 min silent window after first notification, reset after 15 min idle. Per-(conversation, user) `last_notified_at` state kept server-side. "Activity" = push delivered, not presence. Rate-limited messages are dropped (not batched) to avoid surprise digests.
3. Quiet hours hardcoded 10pm–7am local, **not** user-adjustable (per D17). Revisit post-launch if users request it.
4. Onboarding prompt defaults: notifications asked now, profanity filter default off.
5. `@staff` tag is case-insensitive and always a single keyword (no individual staff handles to start).
6. One pin per chat (not a list).
7. Reactions: start with a small curated set (👍 ❤️ 😂 🎱 🍻) + full emoji picker.
8. Archived chats are read-only, searchable (by chat name and message content), grouped by season (most recent first) in an "Archived" filter/tab with a season filter chip. `scope_type` is immutable after creation.
9. League timezone for "midnight match day" comes from the match's venue timezone; fall back to org timezone, then UTC. **Prerequisite:** add IANA-string `timezone` column to `venues` (canonical) with `organizations.timezone` as fallback. Required migration before any Phase 4 match-chat work.
10. Match-night chat on reschedule:
    - If moved to a *different future day* and the old day's chat was already created → archive old chat with system message, create new on the new match day.
    - If moved to the *same day* (e.g., weather → different venue) → reuse existing chat, add system message noting the change.
    - If moved to a *day that is already past or today* → create chat immediately on reschedule entry.
    - If the old chat was already archived when the reschedule happens → do not resurrect; create fresh.

---

## 8. Open questions for planning

- **Scheduler choice** — pg_cron vs. Supabase Scheduled Edge Function for match-chat creation (§5.4 / Phase 3). Both viable; planning picks based on operational preferences.
- **`is_muted` column retirement** — keep as derived-from-`notification_mode`, or drop entirely once migrated? (Phase 1 planning.)
- **Dispatch worker implementation** — single Edge Function subscribing to message INSERT events, or DB-trigger + pg_net pushing to worker? (Phase 2 planning.)
- **APNs/FCM coordination with mobile partner** — who holds the push-tokens table of record (web app, shared)? Who handles stale-token cleanup? (Phase 2.)
- **Pin permissions** — in team chat, captain only, or captain + co-captain (if co-captain exists in data)? (Phase 4.)
- **Announcement reaction picker** — curated set only, or full emoji picker? (Phase 4 design.)
- **Reporting in archived chats** — suggest yes, with reduced urgency. (Phase 5.)
- **Operator View performance** — for large orgs (50+ teams), pagination/filter strategy. (Phase 5 design.)
- **Reaction set curation** — is 👍 ❤️ 😂 🎱 🍻 the right default set for bar-pool culture? Confirm with captains in discovery. (Phase 4.)
- **Pre-Phase 3 captain discovery** — recommended but not required: 2-week interview pass with 10-15 captains to validate the hub hypothesis. If we skip it, Phase 3 gate evaluation is the only validation.

---

## 9. Proposed phasing (risk-first, with gated validation)

Each phase is independently shippable — if we stop after any phase, users still get something useful. A **measurable gate** separates Phase 3 from Phase 4: Phase 3 tests the core hypothesis (captains will coordinate in Rackem), and Phases 4/5 only ship if Phase 3 moves the metric.

### Phase 1 — Schema foundations, auto-chats, staff inbox filter, profanity

**Schema work (prerequisites for every later phase):**
- Add `conversations.archived_at TIMESTAMPTZ NULL`.
- Add `conversation_participants.notification_mode` tri-state column (CHECK IN `'all','mentions','none'`), data-migrate from `is_muted`/`notifications_enabled`, decide `is_muted` retirement.
- Drop/recreate `conversations_conversation_type_check` to add `match_chat` value + verify downstream SECURITY DEFINER functions (done now so Phase 3 doesn't need a second schema migration).
- Add `venues.timezone` and `organizations.timezone` IANA-string columns, backfill with sensible defaults.
- Create `message_mentions (message_id, mentioned_user_id)` table (ready for Phase 4 autocomplete).
- Add `conversation_participants.role = 'observer'` enum value (for D22 staff oversight).
- Add `moderation_audit_log` table (append-only; used in Phase 5).
- Reconcile duplicate `user_reports` schemas — decide authoritative source, drop the losing duplicate.

**Feature work:**
- Auto-create team chats, captain chat, season-announcements, and org-announcements on season activation (D1, with mid-season roster-change hooks).
- Staff auto-added as `observer` to every team chat + announcements chat in their org (D22). Inbox-filter query hides observer rows from primary conversation list. **No Operator View UI yet** — that ships in Phase 5.
- Profanity filter wired end-to-end (display-time in MessageBubble, conversation list preview, system messages).
- Past-member model (D23): `left_at` + RLS + "Past member — read only" banner.
- Captain lifecycle rules (D24) encoded in captaincy-transfer / account-deletion / suspension paths.
- Failed-send error states in composer (baseline UX, belongs at foundation).
- Messages onboarding prompt: moved to **app first-load post-auth** per reviewer feedback (not Messages-tab-first-open). Asks about profanity filter; push permission moves to Phase 2's richer flow.

**Result:** auto-chats work. Staff inboxes stay clean. Profanity filter does what users expect. The data model is ready for everything else.

### Phase 2 — Notification subsystem (push + controls)

**New infrastructure:**
- Web Push + service worker + VAPID key management (secrets, not source control).
- `push_subscriptions` table keyed by `(member_id, endpoint)` with platform, auth, revoked_at.
- Dispatch worker: Supabase Edge Function triggered by new-message events, applies per-user filtering (tri-state, rate-limit, quiet-hours), dispatches to subscriptions. Retry + idempotency.
- Coordinate with mobile partner on APNs/FCM tokens (separate track, parallel to web).

**Client controls:**
- Per-chat tri-state UI (Notify / Mentions only / Mute) — wires up the Phase 1 column.
- Global "all notifications off" toggle, **with duration picker (D28):** 1hr / until 7am tomorrow / until chosen date / until manually re-enabled. New column on `members`: `notifications_paused_until TIMESTAMPTZ NULL`. Pause overrides everything (mentions and live-match bypass included).
- Rate-limit (15-min idle window) — per `(conversation, user)` `last_notified_at` state, server-side.
- Quiet hours hardcoded 10pm–7am local (D17) — no UI. At this phase, only `@mention` bypass exists; the live-match bypass (D26/D27) ships in Phase 3 once match chats exist.
- `@mention` notification-bypass routing (no autocomplete UI yet — that's Phase 4; but the notification fan-out logic that distinguishes "routine message" from "mention" must exist now because Phase 3 needs it).
- Permission-denial UX: detect denied / dismissed / unsupported / iOS-needs-PWA states; in-app banner with appropriate next-step copy.
- Push onboarding prompt fires on first message received while app not focused, or at season start for newly-active users.

**Result:** the "loud phone" problem is solved. Users trust the app's notification restraint. Mentioning someone actually reaches them.

### Phase 3 — Match-night chats (THE HYPOTHESIS TEST)

**Scheduler infrastructure:**
- pg_cron extension enabled OR scheduled Supabase Edge Function (single decision in Phase 3 planning). Runs every 15 min, scans matches with `match_date = today` per venue timezone.
- Idempotency: check for existing `match_chat` for the match before INSERT.
- Failure detection: if creation fails for a match, a dashboard alert surfaces in staff-facing tools; staff can manually trigger from match detail page.

**Feature work:**
- Match-night chat creation at 00:00 venue-local on match day.
- Full rosters of both teams (D10), captain force-membership (D11), global opt-out (D14 with promotion-time warning per §5.6).
- Edge cases: nil venue falls back to org timezone; empty roster after opt-outs still creates chat with remaining members; reschedule lifecycle per §7(10); forfeit / no-completion archive rules per §5.4.
- Archive 1hr post-completion (per revised D13); 24hr end-of-day for never-scored.
- **Live-match quiet-hours bypass (D26/D27):** dispatch worker checks at notify time whether the recipient's own team has a live match (= an unarchived `match_chat` exists for a match they're rostered on). If yes, push from match/team/captain chats bypasses quiet hours. Cutoff: match chat = chat-archive (1hr post-match); team/captain = match completion. Notification pause (D28) still overrides the bypass.
- System-message banners for lifecycle events (created, rescheduled, archived).
- "Share match to SMS" button on match detail page — generates deep-link back to Rackem match chat. Treats SMS as a *capture tool for dragging coordination back into Rackem*, not a competitor.
- Captain season-start onboarding nudge: "You have a team chat — post your first message."
- Instrumentation: baseline the primary success metric (% matches with ≥1 chat message on match day) + secondary metrics.

### ⚠ GATE — evaluate the hypothesis

**Run Phase 3 for one full season. Then:**
- If ≥40% of matches generate chat activity → the hypothesis holds; invest in Phase 4/5 polish.
- If metric doesn't move → Phases 4/5 are the wrong investment. Rescope or sunset the messaging ambition and redirect engineering capacity to core league-ops work (scoring, tiebreakers, preferences).
- If metric partially moves (20-40%) → ship Phase 4 only; re-evaluate Phase 5 separately.

No Phase 4/5 work begins before this gate evaluation.

### Phase 4 — Social polish (conditional on gate)

- `@mention` autocomplete UI (autocomplete dropdown, visual highlighting; data model already exists from Phase 1).
- Message reactions (curated set 👍 ❤️ 😂 🎱 🍻 + full picker).
- Typing indicators with multi-user collapse rule.
- Pinned messages (one per chat; captain-only in team chats; captains + staff in captain chat; staff-only in announcements).
- Empty states for conversation list (new user, no-teams, all-opted-out-plus-no-DMs).
- Captain opt-out warning copy + confirmation step in settings.
- Accessibility baseline: keyboard nav, aria-live for typing indicators, reaction picker a11y, emoji picker keyboard.
- **Cut from this phase:** thread replies (D20), match rich cards (D21).

**Result:** messaging feels modern. The conversational-clarity problems (who is this to? how do I react without a sentence?) are solved.

### Phase 5 — Operator View UI + moderation completion (conditional on gate)

- Operator View sidebar surface (§5.5.1). Observer chats browsable, mention-only unread signals, disabled composer for team/announcement chats.
- Report flow UI with reasons, confirmation, 48h expectation-setting.
- Operator review queue with role-scoped actions (league_rep scoped; admin/owner org-wide) and confirmation dialogs on destructive actions.
- `moderation_audit_log` writes for every action.
- Block/unblock discoverability via tap-on-sender-name menu.
- Archived chats tab with season grouping and search.
- **Cut from this phase:** image attachments (D19) — separate future brainstorm.

**Result:** safety, accountability, and staff empowerment all ship together. The social layer is complete.

### What never ships in this overhaul

Explicit cuts so planning doesn't silently resurrect them:
- Thread replies (D20)
- Match rich cards / inline match objects (D21)
- `@staff` scoped group tag (D18)
- Image / media attachments (D19)
- User-tunable quiet hours UI (D17)
- User-tunable live-match bypass duration (e.g., "extend my bypass 30 min after match end" or "shorten it") — defer; default rule per D26/D27 covers the common case
- "Always notify, ignore quiet hours" mode — defer; rare use case, easy add later
- Email notifications, digest or transactional (original non-goal)
- Voice/video calling (original non-goal)
- Org-enforced profanity filter (original non-goal)

---

## 10. References

- `memory-bank/messagingSystemProgress.md` — current-state architecture doc, phase history
- `database/messaging/` — existing tables, functions, triggers
- `src/pages/Messages.tsx` — main messaging page
- `src/components/messages/` — all chat UI components
- `src/utils/profanityFilter.ts` — `@2toad/profanity` wrapper
- `src/api/queries/messages.ts`, `src/api/mutations/messages.ts` — data access
