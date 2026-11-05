---
summary: Let an LO start an opt-in back-and-forth chat for everyone in the org
kind: idea
added: 2026-05-12
checked: 2026-11-04
---

Each season auto-creates a captain chat, team chats, season announcements and
org announcements. There's deliberately no auto-created "everyone in the org"
chat, because a 200-player free-for-all is a moderation disaster.

An LO may still want a deliberate, opt-in one ("the league's clubhouse"). The
data model already supports it through the `createGroupConversation`
SECURITY DEFINER function. No schema change needed.

## What it needs

1. An LO-only button: "Start an org-wide chat".
2. On click, call `createGroupConversation` with every player active across
   the org's active seasons (same query as the participants snapshot in
   `createOrgAnnouncementsChat`).
3. The chat is a normal `conversations` row, not `auto_managed=true`, so no
   trigger re-creates it. The LO owns rename, leave and delete.
4. Maybe hide the button until the org has about 5 active members, so it
   can't be created by accident in an empty org.
