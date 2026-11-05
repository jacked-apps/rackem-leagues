---
summary: Let captains add non-team members, like a spouse, to the team chat
kind: idea
added: 2026-05-12
checked: 2026-11-04
---

Team chat membership follows the roster. A captain might want to add an
outsider, e.g. a player's spouse who wants league updates. The schema
already allows it (`conversation_participants.user_id` doesn't require
team membership). There's no UI.

## Scope when picked up

- Captain-only "Add member" inside the team chat view.
- Mark manually added outsiders (e.g. a "guest" badge) so the captain
  knows roster changes won't remove them.
- Make sure roster triggers only touch participants who are on the team
  roster. Outsiders are manual-in, manual-out.
- A captain "remove" option on guest entries.
