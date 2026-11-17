---
summary: Match-night chats for both teams that close themselves after the match
kind: task
added: 2026-11-17
checked: 2026-11-17
---

Ed, 2026-11-16, for the About page: match chats that auto delete. Not built
yet, so the About page leaves them off for now. Add them to About when this
ships.

Today only the `match_chat` conversation type exists; nothing creates match
chats, and `conversations.archived_at` is never set, so nothing closes or
clears a chat on its own.

The design is already written down in the messaging overhaul (Phase 3):
`docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md`,
decisions D10 to D14 and D26. In short: both full rosters, created at
midnight on match day, captains can't leave, archived 1 hour after the match
ends, and a per-player "don't include me in match chats" setting.
